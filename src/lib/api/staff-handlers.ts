import { NextResponse } from "next/server";
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
import { AppHttpError, jsonError } from "@/lib/http/errors";
import type { StaffRole } from "@/lib/schemas/intake";
import {
  FacilityIdSchema,
  IntakeIdParamSchema,
  PostgresStaffSessionResponseSchema,
  STAFF_QUEUE_DEFAULT_LIMIT,
  StaffAdminFacilityOverviewResponseSchema,
  StaffIntakeDetailResponseSchema,
  StaffQueueQuerySchema,
  StaffQueueResponseSchema,
  type PostgresStaffSessionResponse,
  type StaffAdminFacilityOverviewResponse,
  type StaffIntakeDetailResponse,
  type StaffQueueQuery,
  type StaffQueueResponse,
} from "@/lib/schemas/staff-api";

export const ALL_CLINICAL_STAFF_ROLES: readonly StaffRole[] = [
  "nurse",
  "doctor",
  "admin",
];

export const ADMIN_ONLY_ROLES: readonly StaffRole[] = ["admin"];

export interface StaffHandlerDeps {
  readonly verifyToken?: VerifyTokenFn;
  readonly repository?: StaffRepository;
  readonly now?: () => Date;
  readonly env?: Record<string, string | undefined>;
  readonly revocationStore?: DemoSessionRevocationStore;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function handleUnexpectedStaffApiError(error: unknown): NextResponse {
  if (error instanceof StaffAuthorizationError) {
    return jsonError(error.statusCode, error.errorCode, error.message);
  }
  if (error instanceof AppHttpError) {
    return jsonError(error.status, error.code, error.publicMessage);
  }
  const safeDbError = toSafeDatabaseError(error);
  return jsonError(
    safeDbError.statusCode,
    safeDbError.errorCode,
    safeDbError.message,
  );
}

/**
 * Parses URLSearchParams for GET /api/staff/intakes strictly, rejecting unknown
 * or malformed values before any database call occurs.
 */
export function parseStaffQueueSearchParams(
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: StaffQueueQuery }
  | { readonly ok: false; readonly message: string } {
  const allowedKeys = new Set([
    "facilityId",
    "workflowStatus",
    "priority",
    "includeCompleted",
    "limit",
    "offset",
  ]);

  for (const key of searchParams.keys()) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        message: `Unsupported queue query parameter: "${key}".`,
      };
    }
  }

  const rawFacilityId = searchParams.get("facilityId") ?? undefined;
  const rawWorkflowStatus = searchParams.get("workflowStatus") ?? undefined;
  const rawPriority = searchParams.get("priority") ?? undefined;
  const rawIncludeCompleted = searchParams.get("includeCompleted");
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");

  let includeCompleted = false;
  if (rawIncludeCompleted !== null) {
    if (rawIncludeCompleted === "true") {
      includeCompleted = true;
    } else if (rawIncludeCompleted === "false") {
      includeCompleted = false;
    } else {
      return {
        ok: false,
        message: 'Query parameter "includeCompleted" must be "true" or "false".',
      };
    }
  }

  let limit = STAFF_QUEUE_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      return {
        ok: false,
        message: 'Query parameter "limit" must be a positive integer.',
      };
    }
    limit = Number.parseInt(rawLimit, 10);
  }

  let offset = 0;
  if (rawOffset !== null) {
    if (!/^\d+$/.test(rawOffset)) {
      return {
        ok: false,
        message: 'Query parameter "offset" must be a non-negative integer.',
      };
    }
    offset = Number.parseInt(rawOffset, 10);
  }

  const parsed = StaffQueueQuerySchema.safeParse({
    facilityId: rawFacilityId,
    workflowStatus: rawWorkflowStatus,
    priority: rawPriority,
    includeCompleted,
    limit,
    offset,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "One or more queue query parameters are invalid.",
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Core handler for GET /api/staff/session.
 * Verifies Firebase ID token or Hackathon Demo cookie server-side and resolves
 * staff profile & active facility membership authoritatively from Neon PostgreSQL.
 */
export async function handleStaffSessionGet(
  request: {
    readonly authorizationHeader: string | null;
    readonly cookieHeader?: string | null;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const rawFacilityId = request.searchParams.get("facilityId");
  let requestedFacilityId: string | null = null;
  if (rawFacilityId !== null && rawFacilityId.trim().length > 0) {
    const parsedFacility = FacilityIdSchema.safeParse(rawFacilityId);
    if (!parsedFacility.success) {
      return jsonError(
        400,
        "INVALID_FACILITY_ID",
        "The requested facility identifier format is invalid.",
      );
    }
    requestedFacilityId = parsedFacility.data;
  }

  try {
    const resolution = await resolveStaffSession({
      authorizationHeader: request.authorizationHeader,
      cookieHeader: request.cookieHeader,
      requestedFacilityId,
      strictFacilityMatch: false,
      verifyToken: deps.verifyToken,
      repository: deps.repository ?? createDrizzleStaffRepository(),
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const base = {
      authenticated: true as const,
      verifiedByServer: true as const,
      authMode: resolution.authMode,
      demoPersona: resolution.demoPersona,
      sessionExpiresAt: resolution.sessionExpiresAt,
      projectId: resolution.token.projectId,
      authorizationModel: "neon_postgres_server_rbac" as const,
      user: {
        uid: resolution.token.uid,
        email: resolution.token.email,
        emailVerified: true as const,
        displayName: resolution.token.displayName,
      },
    };

    let payload: PostgresStaffSessionResponse;
    if (resolution.status === "authorized") {
      payload = PostgresStaffSessionResponseSchema.parse({
        ...base,
        authorizationStatus: "authorized",
        staffProfile: resolution.staffProfile,
        activeFacility: resolution.activeFacility,
      });
    } else if (resolution.status === "unprovisioned") {
      payload = PostgresStaffSessionResponseSchema.parse({
        ...base,
        authorizationStatus: "unprovisioned",
        staffProfile: null,
        activeFacility: null,
        message: resolution.message,
      });
    } else {
      payload = PostgresStaffSessionResponseSchema.parse({
        ...base,
        authorizationStatus: "inactive",
        staffProfile: null,
        activeFacility: null,
        message: resolution.message,
      });
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleUnexpectedStaffApiError(error);
  }
}

/**
 * Core handler for GET /api/staff/intakes.
 * Enforces Firebase identity or Demo session + PostgreSQL facility membership
 * and returns only bounded queue summaries for the authenticated staff member's verified facility.
 */
export async function handleStaffQueueGet(
  request: {
    readonly authorizationHeader: string | null;
    readonly cookieHeader?: string | null;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedQuery = parseStaffQueueSearchParams(request.searchParams);
  if (!parsedQuery.ok) {
    return jsonError(400, "INVALID_QUERY_PARAMS", parsedQuery.message);
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authContext = await requireAuthorizedStaff({
      authorizationHeader: request.authorizationHeader,
      cookieHeader: request.cookieHeader,
      requestedFacilityId: parsedQuery.data.facilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: ALL_CLINICAL_STAFF_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const result = await repository.listFacilityIntakes({
      facilityId: authContext.activeFacility.facilityId,
      workflowStatus: parsedQuery.data.workflowStatus,
      priority: parsedQuery.data.priority,
      includeCompleted: parsedQuery.data.includeCompleted,
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
    });

    const payload: StaffQueueResponse = StaffQueueResponseSchema.parse({
      facility: authContext.activeFacility,
      items: result.items,
      pagination: {
        limit: parsedQuery.data.limit,
        offset: parsedQuery.data.offset,
        total: result.total,
        hasMore: parsedQuery.data.offset + result.items.length < result.total,
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
    return handleUnexpectedStaffApiError(error);
  }
}

/**
 * Core handler for GET /api/staff/intakes/[intakeId].
 * Resolves the intake strictly inside the authenticated staff member's verified
 * facility and returns a safe 404 without revealing cross-facility existence.
 */
export async function handleStaffIntakeDetailGet(
  request: {
    readonly authorizationHeader: string | null;
    readonly cookieHeader?: string | null;
    readonly intakeId: string;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedIntakeId = IntakeIdParamSchema.safeParse(request.intakeId);
  if (!parsedIntakeId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "The requested intake identifier is not a valid UUID.",
    );
  }

  const rawFacilityId = request.searchParams.get("facilityId");
  let requestedFacilityId: string | null = null;
  if (rawFacilityId !== null && rawFacilityId.trim().length > 0) {
    const parsedFacility = FacilityIdSchema.safeParse(rawFacilityId);
    if (!parsedFacility.success) {
      return jsonError(
        400,
        "INVALID_FACILITY_ID",
        "The requested facility identifier format is invalid.",
      );
    }
    requestedFacilityId = parsedFacility.data;
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authContext = await requireAuthorizedStaff({
      authorizationHeader: request.authorizationHeader,
      cookieHeader: request.cookieHeader,
      requestedFacilityId,
      strictFacilityMatch: true,
      allowedRoles: ALL_CLINICAL_STAFF_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const record = await repository.findFacilityIntakeDetail(
      authContext.activeFacility.facilityId,
      parsedIntakeId.data,
    );

    if (!record) {
      return jsonError(
        404,
        "INTAKE_NOT_FOUND",
        "No intake record with this identifier was found in your authorized facility.",
      );
    }

    const payload: StaffIntakeDetailResponse =
      StaffIntakeDetailResponseSchema.parse({
        facility: authContext.activeFacility,
        intake: record.intake,
        evidence: record.evidence,
        auditEvents: record.auditEvents,
        fetchedAt: now().toISOString(),
      });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleUnexpectedStaffApiError(error);
  }
}

/**
 * Core handler for GET /api/staff/admin/facility.
 * Strictly enforces `admin` role in PostgreSQL and returns a read-only overview
 * of the administrator's authorized facility (no provisioning or intake mutations).
 */
export async function handleStaffAdminFacilityGet(
  request: {
    readonly authorizationHeader: string | null;
    readonly cookieHeader?: string | null;
    readonly searchParams: URLSearchParams;
  },
  deps: StaffHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const rawFacilityId = request.searchParams.get("facilityId");
  let requestedFacilityId: string | null = null;
  if (rawFacilityId !== null && rawFacilityId.trim().length > 0) {
    const parsedFacility = FacilityIdSchema.safeParse(rawFacilityId);
    if (!parsedFacility.success) {
      return jsonError(
        400,
        "INVALID_FACILITY_ID",
        "The requested facility identifier format is invalid.",
      );
    }
    requestedFacilityId = parsedFacility.data;
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const now = deps.now ?? (() => new Date());

  try {
    const authContext = await requireAuthorizedStaff({
      authorizationHeader: request.authorizationHeader,
      cookieHeader: request.cookieHeader,
      requestedFacilityId,
      strictFacilityMatch: true,
      allowedRoles: ADMIN_ONLY_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    const overview = repository.getFacilityAdminOverview
      ? await repository.getFacilityAdminOverview(
          authContext.activeFacility.facilityId,
        )
      : null;

    if (!overview) {
      return jsonError(
        404,
        "FACILITY_NOT_FOUND",
        "No facility record was found for your authorized facility scope.",
      );
    }

    const payload: StaffAdminFacilityOverviewResponse =
      StaffAdminFacilityOverviewResponseSchema.parse({
        facility: {
          facilityId: overview.facilityId,
          facilityName: overview.facilityName,
          facilityPublicCode: overview.facilityPublicCode,
          role: "admin",
          isDemo: overview.isDemo,
          timezone: overview.timezone,
          active: overview.active,
        },
        metrics: {
          activeStaffCount: overview.activeStaffCount,
          totalIntakesCount: overview.totalIntakesCount,
          unassignedIntakesCount: overview.unassignedIntakesCount,
        },
        roleBoundaries: {
          currentRole: "admin",
          isDemoSession: authContext.authMode === "demo",
          canAccessAdminOverview: true,
          staffProvisioningSupportedInPhase: false,
          intakeMutationsSupportedInPhase: false,
        },
        fetchedAt: now().toISOString(),
      });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return handleUnexpectedStaffApiError(error);
  }
}
