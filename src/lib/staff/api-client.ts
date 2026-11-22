import {
  CreateIntakeResponseSchema,
  TranscribeAudioResponseSchema,
  type CreateIntakeRequest,
  type CreateIntakeResponse,
  type StaffAssignedPriority,
  type TranscribeAudioResponse,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import {
  DemoLogoutResponseSchema,
  DemoStatusResponseSchema,
  IntakeExtractionResponseSchema,
  PostgresStaffSessionResponseSchema,
  StaffAdminFacilityOverviewResponseSchema,
  StaffIntakeDetailResponseSchema,
  StaffQueueResponseSchema,
  type DemoLogoutResponse,
  type DemoPersona,
  type DemoStatusResponse,
  type IntakeExtractionResponse,
  type PostgresStaffSessionResponse,
  type StaffAdminFacilityOverviewResponse,
  type StaffBriefReviewRequest,
  type StaffIntakeDetailResponse,
  type StaffPriorityMutationRequest,
  type StaffQueueResponse,
  type StaffStatusMutationRequest,
} from "@/lib/schemas/staff-api";

export const DEMO_CSRF_HEADER_NAME = "x-medflow-demo-csrf";
export const DEMO_CSRF_HEADER_VALUE = "1";

export type GetIdTokenFn = (forceRefresh?: boolean) => Promise<string | null>;

export class StaffApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "StaffApiClientError";
    this.status = status;
    this.code = code;
  }

  get isAuthExpired(): boolean {
    return (
      this.status === 401 ||
      this.code === "INVALID_OR_EXPIRED_TOKEN" ||
      this.code === "DEMO_SESSION_EXPIRED" ||
      this.code === "DEMO_SESSION_REVOKED" ||
      this.code === "DEMO_SESSION_INVALID"
    );
  }
}

function parseErrorBody(
  status: number,
  rawBody: unknown,
  fallbackMessage: string,
): StaffApiClientError {
  if (
    rawBody &&
    typeof rawBody === "object" &&
    "error" in rawBody &&
    typeof (rawBody as { error?: unknown }).error === "object" &&
    (rawBody as { error?: unknown }).error !== null
  ) {
    const errObj = (rawBody as { error: { code?: unknown; message?: unknown } })
      .error;
    const code =
      typeof errObj.code === "string" && errObj.code.length > 0
        ? errObj.code
        : "API_REQUEST_FAILED";
    const message =
      typeof errObj.message === "string" && errObj.message.length > 0
        ? errObj.message
        : fallbackMessage;
    return new StaffApiClientError(status, code, message);
  }
  return new StaffApiClientError(status, "API_REQUEST_FAILED", fallbackMessage);
}

async function performAuthenticatedRequest(options: {
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly getIdToken: GetIdTokenFn;
  readonly allowCookieFallback?: boolean;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<unknown> {
  const fetchFn = options.fetchImpl ?? fetch;
  const executeAttempt = async (forceRefresh: boolean): Promise<Response> => {
    const token = await options.getIdToken(forceRefresh);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.method === "POST") {
      headers["Content-Type"] = "application/json";
    }
    if (token && token.trim().length > 0) {
      headers.Authorization = `Bearer ${token}`;
    } else if (!options.allowCookieFallback) {
      // Allow cookie-based demo session fallback whenever no Firebase token is active
    }

    return fetchFn(options.path, {
      method: options.method,
      headers,
      credentials: "include",
      cache: "no-store",
      ...(options.method === "POST"
        ? { body: JSON.stringify(options.body ?? {}) }
        : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  };

  let response = await executeAttempt(false);
  if (response.status === 401) {
    const refreshedToken = await options.getIdToken(true);
    if (refreshedToken) {
      response = await executeAttempt(true);
    }
  }

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      `Request to ${options.path} failed with HTTP ${response.status}.`,
    );
  }

  return rawBody;
}

// =============================================================================
// Hackathon Demo Mode Client Helpers
// =============================================================================

export async function fetchDemoStatus(options?: {
  readonly signal?: AbortSignal;
}): Promise<DemoStatusResponse> {
  const response = await fetch("/api/demo/status", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      "Unable to check Hackathon Demo Mode status.",
    );
  }

  return DemoStatusResponseSchema.parse(rawBody);
}

export async function createDemoSession(
  persona: DemoPersona,
): Promise<PostgresStaffSessionResponse> {
  const endpoint =
    persona === "admin"
      ? "/api/demo/session/admin"
      : "/api/demo/session/staff";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      [DEMO_CSRF_HEADER_NAME]: DEMO_CSRF_HEADER_VALUE,
    },
    credentials: "include",
    cache: "no-store",
  });

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      "Unable to start Hackathon Demo Mode session.",
    );
  }

  return PostgresStaffSessionResponseSchema.parse(rawBody);
}

export async function logoutDemoSession(): Promise<DemoLogoutResponse> {
  const response = await fetch("/api/demo/logout", {
    method: "POST",
    headers: {
      Accept: "application/json",
      [DEMO_CSRF_HEADER_NAME]: DEMO_CSRF_HEADER_VALUE,
    },
    credentials: "include",
    cache: "no-store",
  });

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      "Unable to sign out of Hackathon Demo Mode.",
    );
  }

  return DemoLogoutResponseSchema.parse(rawBody);
}

// =============================================================================
// Staff Session, Queue, Detail & Admin Overview Helpers
// =============================================================================

export async function fetchStaffSession(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly facilityId?: string | null;
  readonly allowCookieFallback?: boolean;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<PostgresStaffSessionResponse> {
  const params = new URLSearchParams();
  if (options.facilityId) {
    params.set("facilityId", options.facilityId);
  }
  const qs = params.toString();
  const path = qs ? `/api/staff/session?${qs}` : "/api/staff/session";

  const rawBody = await performAuthenticatedRequest({
    path,
    method: "GET",
    getIdToken: options.getIdToken,
    allowCookieFallback: options.allowCookieFallback ?? true,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  return PostgresStaffSessionResponseSchema.parse(rawBody);
}

export async function fetchStaffQueue(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly facilityId: string;
  readonly workflowStatus?: WorkflowStatus | "";
  readonly priority?: StaffAssignedPriority | "";
  readonly includeCompleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<StaffQueueResponse> {
  const params = new URLSearchParams();
  params.set("facilityId", options.facilityId);
  if (options.workflowStatus) {
    params.set("workflowStatus", options.workflowStatus);
  }
  if (options.priority) {
    params.set("priority", options.priority);
  }
  if (options.includeCompleted !== undefined) {
    params.set("includeCompleted", String(options.includeCompleted));
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes?${params.toString()}`,
    method: "GET",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  return StaffQueueResponseSchema.parse(rawBody);
}

export async function fetchStaffIntakeDetail(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly facilityId: string;
  readonly intakeId: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<StaffIntakeDetailResponse> {
  const params = new URLSearchParams();
  params.set("facilityId", options.facilityId);

  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes/${encodeURIComponent(options.intakeId)}?${params.toString()}`,
    method: "GET",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  return StaffIntakeDetailResponseSchema.parse(rawBody);
}

export async function fetchStaffAdminFacilityOverview(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly facilityId: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<StaffAdminFacilityOverviewResponse> {
  const params = new URLSearchParams();
  params.set("facilityId", options.facilityId);

  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/admin/facility?${params.toString()}`,
    method: "GET",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  return StaffAdminFacilityOverviewResponseSchema.parse(rawBody);
}

// =============================================================================
// Milestone 2: Patient Submission, Audio Transcription & Staff Mutations
// =============================================================================

export async function submitPatientIntake(
  payload: CreateIntakeRequest,
): Promise<CreateIntakeResponse> {
  const response = await fetch("/api/intakes", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      "Failed to submit patient intake.",
    );
  }

  return CreateIntakeResponseSchema.parse(rawBody);
}

export async function transcribePatientAudioRequest(params: {
  readonly audioBase64: string;
  readonly mimeType: string;
}): Promise<TranscribeAudioResponse> {
  const response = await fetch("/api/intakes/transcribe", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  const rawBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseErrorBody(
      response.status,
      rawBody,
      "Failed to transcribe patient voice recording.",
    );
  }

  return TranscribeAudioResponseSchema.parse(rawBody);
}

export async function triggerIntakeExtraction(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly intakeId: string;
  readonly facilityId?: string;
}): Promise<IntakeExtractionResponse> {
  const rawBody = await performAuthenticatedRequest({
    path: `/api/intakes/${encodeURIComponent(options.intakeId)}/extract`,
    method: "POST",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    body: options.facilityId ? { facilityId: options.facilityId } : {},
  });

  return IntakeExtractionResponseSchema.parse(rawBody);
}

export async function startStaffIntakeReviewRequest(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly intakeId: string;
  readonly facilityId?: string;
}): Promise<StaffIntakeDetailResponse> {
  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes/${encodeURIComponent(options.intakeId)}/review`,
    method: "POST",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    body: options.facilityId ? { facilityId: options.facilityId } : {},
  });

  return StaffIntakeDetailResponseSchema.parse(rawBody);
}

export async function submitStaffBriefReviewRequest(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly intakeId: string;
  readonly payload: StaffBriefReviewRequest;
}): Promise<StaffIntakeDetailResponse> {
  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes/${encodeURIComponent(options.intakeId)}/brief-review`,
    method: "POST",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    body: options.payload,
  });

  return StaffIntakeDetailResponseSchema.parse(rawBody);
}

export async function updateStaffPriorityRequest(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly intakeId: string;
  readonly payload: StaffPriorityMutationRequest;
}): Promise<StaffIntakeDetailResponse> {
  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes/${encodeURIComponent(options.intakeId)}/priority`,
    method: "POST",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    body: options.payload,
  });

  return StaffIntakeDetailResponseSchema.parse(rawBody);
}

export async function updateStaffWorkflowStatusRequest(options: {
  readonly getIdToken: GetIdTokenFn;
  readonly intakeId: string;
  readonly payload: StaffStatusMutationRequest;
}): Promise<StaffIntakeDetailResponse> {
  const rawBody = await performAuthenticatedRequest({
    path: `/api/staff/intakes/${encodeURIComponent(options.intakeId)}/status`,
    method: "POST",
    getIdToken: options.getIdToken,
    allowCookieFallback: true,
    body: options.payload,
  });

  return StaffIntakeDetailResponseSchema.parse(rawBody);
}
