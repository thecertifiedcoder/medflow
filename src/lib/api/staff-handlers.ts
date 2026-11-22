import { NextResponse } from "next/server";
import { z } from "zod";
import type { DemoSessionRevocationStore } from "@/lib/auth/demo-session";
import {
  requireAuthorizedStaff,
  resolveStaffSession,
  StaffAuthorizationError,
  type VerifyTokenFn,
} from "@/lib/auth/staff-authorization";
import { toSafeDatabaseError } from "@/lib/db/errors";
import {
  createDrizzleStaffRepository,
  type StaffRepository,
} from "@/lib/db/staff-repository";
import { assertServerRuntime } from "@/lib/env/server";
import { jsonError } from "@/lib/http/errors";
import {
  StaffAssignedPrioritySchema,
  WorkflowStatusSchema,
  type StaffAssignedPriority,
  type StaffRole,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import {
  PostgresStaffSessionResponseSchema,
  StaffAdminFacilityOverviewResponseSchema,
  StaffBriefReviewRequestSchema,
  StaffIntakeDetailResponseSchema,
  StaffPriorityMutationRequestSchema,
  StaffQueueResponseSchema,
  StaffStartReviewRequestSchema,
  StaffStatusMutationRequestSchema,
} from "@/lib/schemas/staff-api";

export interface StaffHandlerDeps {
  readonly verifyToken?: VerifyTokenFn;
  readonly repository?: StaffRepository;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => Date;
  readonly revocationStore?: DemoSessionRevocationStore;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const FACILITY_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const UUID_Schema = z.string().uuid();

const ALLOWED_QUEUE_QUERY_KEYS = new Set([
  "facilityId",
  "workflowStatus",
  "priority",
  "includeCompleted",
  "limit",
  "offset",
]);

const ALL_STAFF_ROLES: readonly StaffRole[] = ["nurse", "doctor", "admin"];
const CLINICAL_REVIEWER_ROLES: readonly StaffRole[] = ["nurse", "doctor"];
const ADMIN_ONLY_ROLES: readonly StaffRole[] = ["admin"];

export interface ParsedStaffQueueSearchParams {
  readonly facilityId?: string;
  readonly workflowStatus?: WorkflowStatus;
  readonly priority?: StaffAssignedPriority;
  readonly includeCompleted: boolean;
  readonly limit: number;
  readonly offset: number;
}

export function parseStaffQueueSearchParams(
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: ParsedStaffQueueSearchParams }
  | { readonly ok: false; readonly message: string } {
  for (const key of searchParams.keys()) {
    if (!ALLOWED_QUEUE_QUERY_KEYS.has(key)) {
      return {
        ok: false,
        message: `Unsupported query parameter "${key}".`,
      };
    }
  }

  const rawFacilityId = searchParams.get("facilityId")?.trim();
  if (rawFacilityId !== undefined && rawFacilityId.length > 0) {
    if (!FACILITY_ID_REGEX.test(rawFacilityId)) {
      return {
        ok: false,
        message: "Invalid facilityId query parameter.",
      };
    }
  }

  let workflowStatus: WorkflowStatus | undefined;
  const rawWorkflowStatus = searchParams.get("workflowStatus")?.trim();
  if (rawWorkflowStatus !== undefined && rawWorkflowStatus.length > 0) {
    const parsedStatus = WorkflowStatusSchema.safeParse(rawWorkflowStatus);
    if (!parsedStatus.success) {
      return {
        ok: false,
        message: "Invalid workflowStatus query parameter.",
      };
    }
    workflowStatus = parsedStatus.data;
  }

  let priority: StaffAssignedPriority | undefined;
  const rawPriority = searchParams.get("priority")?.trim();
  if (rawPriority !== undefined && rawPriority.length > 0) {
    const parsedPriority = StaffAssignedPrioritySchema.safeParse(rawPriority);
    if (!parsedPriority.success) {
      return {
        ok: false,
        message: "Invalid priority query parameter.",
      };
    }
    priority = parsedPriority.data;
  }

  let includeCompleted = false;
  const rawIncludeCompleted = searchParams.get("includeCompleted")?.trim();
  if (rawIncludeCompleted !== undefined && rawIncludeCompleted.length > 0) {
    if (rawIncludeCompleted !== "true" && rawIncludeCompleted !== "false") {
      return {
        ok: false,
        message: 'includeCompleted must be "true" or "false".',
      };
    }
    includeCompleted = rawIncludeCompleted === "true";
  }

  let limit = 25;
  const rawLimit = searchParams.get("limit")?.trim();
  if (rawLimit !== undefined && rawLimit.length > 0) {
    if (!/^\d+$/.test(rawLimit)) {
      return { ok: false, message: "limit must be an integer between 1 and 100." };
    }
    const parsedLimit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return { ok: false, message: "limit must be an integer between 1 and 100." };
    }
    limit = parsedLimit;
  }

  let offset = 0;
  const rawOffset = searchParams.get("offset")?.trim();
  if (rawOffset !== undefined && rawOffset.length > 0) {
    if (!/^\d+$/.test(rawOffset)) {
      return { ok: false, message: "offset must be a non-negative integer." };
    }
    const parsedOffset = Number.parseInt(rawOffset, 10);
    if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
      return { ok: false, message: "offset must be a non-negative integer." };
    }
    offset = parsedOffset;
  }

  return {
    ok: true,
    data: {
      ...(rawFacilityId ? { facilityId: rawFacilityId } : {}),
      ...(workflowStatus ? { workflowStatus } : {}),
      ...(priority ? { priority } : {}),
      includeCompleted,
      limit,
      offset,
    },
  };
}

function handleStaffRouteError(error: unknown): NextResponse {
  if (error instanceof StaffAuthorizationError) {
    return jsonError(error.statusCode, error.errorCode, error.message);
  }
  const safeDb = toSafeDatabaseError(error);
  return jsonError(safeDb.statusCode, safeDb.errorCode, safeDb.message);
}

/**
 * GET /api/staff/session
 */
export async function handleStaffSessionGet(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const rawFacilityId = input.searchParams.get("facilityId")?.trim();
  if (rawFacilityId && !FACILITY_ID_REGEX.test(rawFacilityId)) {
    return jsonError(
      400,
      "INVALID_QUERY_PARAMS",
      "Invalid facilityId query parameter.",
    );
  }

  try {
    const resolution = await resolveStaffSession({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: rawFacilityId ?? null,
      strictFacilityMatch: false,
      verifyToken: deps.verifyToken,
      repository: deps.repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (resolution.status === "authorized") {
      const payload = PostgresStaffSessionResponseSchema.parse({
        authenticated: true,
        verifiedByServer: true,
        authMode: resolution.authMode,
        demoPersona: resolution.demoPersona,
        sessionExpiresAt: resolution.sessionExpiresAt,
        projectId: resolution.token.projectId,
        authorizationModel: "neon_postgres_server_rbac",
        user: {
          uid: resolution.token.uid,
          email: resolution.token.email,
          emailVerified: resolution.token.emailVerified,
          displayName: resolution.token.displayName,
        },
        authorizationStatus: "authorized",
        staffProfile: resolution.staffProfile,
        activeFacility: resolution.activeFacility,
      });

      return NextResponse.json(payload, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    }

    const payload = PostgresStaffSessionResponseSchema.parse({
      authenticated: true,
      verifiedByServer: true,
      authMode: "firebase",
      demoPersona: null,
      sessionExpiresAt: null,
      projectId: resolution.token.projectId,
      authorizationModel: "neon_postgres_server_rbac",
      user: {
        uid: resolution.token.uid,
        email: resolution.token.email,
        emailVerified: resolution.token.emailVerified,
        displayName: resolution.token.displayName,
      },
      authorizationStatus: resolution.status,
      staffProfile: null,
      activeFacility: null,
      message: resolution.message,
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * GET /api/staff/intakes
 */
export async function handleStaffQueueGet(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedQuery = parseStaffQueueSearchParams(input.searchParams);
  if (!parsedQuery.ok) {
    return jsonError(400, "INVALID_QUERY_PARAMS", parsedQuery.message);
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: parsedQuery.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: ALL_STAFF_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const result = await repository.listFacilityIntakes({
      facilityId: authSession.activeFacility.facilityId,
      workflowStatus: parsedQuery.data.workflowStatus,
      priority: parsedQuery.data.priority,
      includeCompleted: parsedQuery.data.includeCompleted,
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
    });

    const payload = StaffQueueResponseSchema.parse({
      facility: authSession.activeFacility,
      items: result.items,
      pagination: {
        limit: parsedQuery.data.limit,
        offset: parsedQuery.data.offset,
        total: result.total,
        hasMore:
          parsedQuery.data.offset + result.items.length < result.total,
      },
      counts: {
        unassigned: result.unassignedCount,
        aiUnavailable: result.aiUnavailableCount,
      },
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * GET /api/staff/intakes/[intakeId]
 */
export async function handleStaffIntakeDetailGet(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly intakeId: string;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = UUID_Schema.safeParse(input.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
    );
  }

  const rawFacilityId = input.searchParams.get("facilityId")?.trim();
  if (rawFacilityId && !FACILITY_ID_REGEX.test(rawFacilityId)) {
    return jsonError(
      400,
      "INVALID_QUERY_PARAMS",
      "Invalid facilityId query parameter.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: rawFacilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: ALL_STAFF_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const detail = await repository.findFacilityIntakeDetail(
      authSession.activeFacility.facilityId,
      parsedId.data,
    );

    if (!detail) {
      return jsonError(
        404,
        "INTAKE_NOT_FOUND",
        "No intake record with this identifier was found in your authorized facility.",
      );
    }

    const payload = StaffIntakeDetailResponseSchema.parse({
      facility: authSession.activeFacility,
      intake: detail.intake,
      evidence: detail.evidence,
      auditEvents: detail.auditEvents,
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * GET /api/staff/admin/facility
 */
export async function handleStaffAdminFacilityGet(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const rawFacilityId = input.searchParams.get("facilityId")?.trim();
  if (rawFacilityId && !FACILITY_ID_REGEX.test(rawFacilityId)) {
    return jsonError(
      400,
      "INVALID_QUERY_PARAMS",
      "Invalid facilityId query parameter.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: rawFacilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: ADMIN_ONLY_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (!repository.getFacilityAdminOverview) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Facility overview repository method is not available.",
      );
    }

    const overview = await repository.getFacilityAdminOverview(
      authSession.activeFacility.facilityId,
    );

    if (!overview) {
      return jsonError(
        404,
        "FACILITY_NOT_FOUND",
        "Authorized facility overview could not be found.",
      );
    }

    const payload = StaffAdminFacilityOverviewResponseSchema.parse({
      facility: {
        facilityId: overview.facilityId,
        facilityName: overview.facilityName,
        facilityPublicCode: overview.facilityPublicCode,
        timezone: overview.timezone,
        isDemo: overview.isDemo,
        active: overview.active,
        role: "admin",
      },
      metrics: {
        activeStaffCount: overview.activeStaffCount,
        totalIntakesCount: overview.totalIntakesCount,
        unassignedIntakesCount: overview.unassignedIntakesCount,
      },
      roleBoundaries: {
        currentRole: "admin",
        isDemoSession: authSession.authMode === "demo",
        canViewAdminOverview: true,
        canViewFacilityQueue: true,
        staffProvisioningMode: "cli_seed_only",
      },
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

// =============================================================================
// Milestone 2: Clinical Staff Mutations (Nurse / Doctor Only)
// =============================================================================

/**
 * POST /api/staff/intakes/[intakeId]/review
 */
export async function handleStaffStartReviewPost(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly intakeId: string;
    readonly body: unknown;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = UUID_Schema.safeParse(input.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
    );
  }

  const parsedBody = StaffStartReviewRequestSchema.safeParse(
    input.body ?? {},
  );
  if (!parsedBody.success) {
    return jsonError(
      400,
      "INVALID_REVIEW_START_PAYLOAD",
      parsedBody.error.issues[0]?.message ?? "Invalid review start request.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: parsedBody.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: CLINICAL_REVIEWER_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (!repository.startStaffIntakeReview) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Review start operation is unavailable.",
      );
    }

    const result = await repository.startStaffIntakeReview({
      facilityId: authSession.activeFacility.facilityId,
      intakeId: parsedId.data,
      actorUid: authSession.staffProfile.uid,
      actorRole: authSession.activeFacility.role,
      actorDisplayName: authSession.staffProfile.displayName,
    });

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    const payload = StaffIntakeDetailResponseSchema.parse({
      facility: authSession.activeFacility,
      intake: result.data.intake,
      evidence: result.data.evidence,
      auditEvents: result.data.auditEvents,
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * POST /api/staff/intakes/[intakeId]/brief-review
 */
export async function handleStaffBriefReviewPost(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly intakeId: string;
    readonly body: unknown;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = UUID_Schema.safeParse(input.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
    );
  }

  const parsedBody = StaffBriefReviewRequestSchema.safeParse(input.body);
  if (!parsedBody.success) {
    return jsonError(
      400,
      "INVALID_BRIEF_REVIEW_PAYLOAD",
      parsedBody.error.issues[0]?.message ??
        "Invalid staff brief review payload.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: parsedBody.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: CLINICAL_REVIEWER_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (!repository.saveStaffBriefReview) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Brief review operation is unavailable.",
      );
    }

    const result =
      parsedBody.data.action === "confirm"
        ? await repository.saveStaffBriefReview({
            facilityId: authSession.activeFacility.facilityId,
            intakeId: parsedId.data,
            actorUid: authSession.staffProfile.uid,
            actorRole: authSession.activeFacility.role,
            actorDisplayName: authSession.staffProfile.displayName,
            action: "confirm",
          })
        : await repository.saveStaffBriefReview({
            facilityId: authSession.activeFacility.facilityId,
            intakeId: parsedId.data,
            actorUid: authSession.staffProfile.uid,
            actorRole: authSession.activeFacility.role,
            actorDisplayName: authSession.staffProfile.displayName,
            action: "correct",
            reviewedBrief: parsedBody.data.reviewedBrief,
            correctionNote: parsedBody.data.correctionNote,
          });

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    const payload = StaffIntakeDetailResponseSchema.parse({
      facility: authSession.activeFacility,
      intake: result.data.intake,
      evidence: result.data.evidence,
      auditEvents: result.data.auditEvents,
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * POST /api/staff/intakes/[intakeId]/priority
 */
export async function handleStaffPriorityPost(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly intakeId: string;
    readonly body: unknown;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = UUID_Schema.safeParse(input.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
    );
  }

  const parsedBody = StaffPriorityMutationRequestSchema.safeParse(input.body);
  if (!parsedBody.success) {
    return jsonError(
      400,
      "INVALID_PRIORITY_PAYLOAD",
      parsedBody.error.issues[0]?.message ?? "Invalid priority payload.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: parsedBody.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: CLINICAL_REVIEWER_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (!repository.assignOrUpdateStaffPriority) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Priority mutation operation is unavailable.",
      );
    }

    const result = await repository.assignOrUpdateStaffPriority({
      facilityId: authSession.activeFacility.facilityId,
      intakeId: parsedId.data,
      actorUid: authSession.staffProfile.uid,
      actorRole: authSession.activeFacility.role,
      actorDisplayName: authSession.staffProfile.displayName,
      priority: parsedBody.data.priority,
      reason: parsedBody.data.reason,
    });

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    const payload = StaffIntakeDetailResponseSchema.parse({
      facility: authSession.activeFacility,
      intake: result.data.intake,
      evidence: result.data.evidence,
      auditEvents: result.data.auditEvents,
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}

/**
 * POST /api/staff/intakes/[intakeId]/status
 */
export async function handleStaffStatusPost(
  input: {
    readonly authorizationHeader: string | null | undefined;
    readonly cookieHeader?: string | null | undefined;
    readonly intakeId: string;
    readonly body: unknown;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = UUID_Schema.safeParse(input.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
    );
  }

  const parsedBody = StaffStatusMutationRequestSchema.safeParse(input.body);
  if (!parsedBody.success) {
    return jsonError(
      400,
      "INVALID_STATUS_PAYLOAD",
      parsedBody.error.issues[0]?.message ?? "Invalid workflow status payload.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: input.authorizationHeader,
      cookieHeader: input.cookieHeader,
      requestedFacilityId: parsedBody.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: CLINICAL_REVIEWER_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (!repository.updateStaffWorkflowStatus) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Workflow status mutation operation is unavailable.",
      );
    }

    const result = await repository.updateStaffWorkflowStatus({
      facilityId: authSession.activeFacility.facilityId,
      intakeId: parsedId.data,
      actorUid: authSession.staffProfile.uid,
      actorRole: authSession.activeFacility.role,
      actorDisplayName: authSession.staffProfile.displayName,
      workflowStatus: parsedBody.data.workflowStatus,
      reason: parsedBody.data.reason,
    });

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    const payload = StaffIntakeDetailResponseSchema.parse({
      facility: authSession.activeFacility,
      intake: result.data.intake,
      evidence: result.data.evidence,
      auditEvents: result.data.auditEvents,
      fetchedAt: now().toISOString(),
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleStaffRouteError(error);
  }
}
