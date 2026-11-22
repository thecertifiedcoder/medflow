import {
  PostgresStaffSessionResponseSchema,
  StaffIntakeDetailResponseSchema,
  StaffQueueResponseSchema,
  type PostgresStaffSessionResponse,
  type StaffIntakeDetailResponse,
  type StaffQueueResponse,
} from "@/lib/schemas/staff-api";
import type {
  StaffAssignedPriority,
  WorkflowStatus,
} from "@/lib/schemas/intake";

export class StaffApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly isAuthExpired: boolean;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "StaffApiClientError";
    this.status = status;
    this.code = code;
    this.isAuthExpired = status === 401;
  }
}

export type GetBearerTokenFn = (forceRefresh?: boolean) => Promise<string | null>;

interface AuthorizedFetchOptions {
  readonly url: string;
  readonly getIdToken: GetBearerTokenFn;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

interface ParsedErrorResponse {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

async function parseErrorBody(response: Response): Promise<{
  code: string;
  message: string;
}> {
  const body = (await response.json().catch(() => null)) as
    | ParsedErrorResponse
    | null;
  const code =
    typeof body?.error?.code === "string" && body.error.code.length > 0
      ? body.error.code
      : `HTTP_${response.status}`;
  const message =
    typeof body?.error?.message === "string" && body.error.message.length > 0
      ? body.error.message
      : response.status === 401
        ? "Your clinical staff session has expired. Please sign in again."
        : "Unable to complete the clinical data request right now.";
  return { code, message };
}

/**
 * Executes an authenticated same-origin GET request using the active Firebase
 * ID token. On HTTP 401, attempts a single forced Firebase token refresh before
 * surfacing a clear session-expired error.
 */
async function authorizedGetJson(
  options: AuthorizedFetchOptions,
): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;

  const attempt = async (forceRefresh: boolean): Promise<Response> => {
    const token = await options.getIdToken(forceRefresh);
    if (!token) {
      throw new StaffApiClientError(
        401,
        "SESSION_EXPIRED",
        "Your clinical staff session has expired. Please sign in again.",
      );
    }

    return doFetch(options.url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: options.signal,
    });
  };

  let response = await attempt(false);
  if (response.status === 401) {
    // Retry once with a freshly refreshed Firebase ID token in case the cached JWT expired.
    response = await attempt(true);
  }

  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    throw new StaffApiClientError(response.status, parsed.code, parsed.message);
  }

  return response.json();
}

export async function fetchStaffSession(options: {
  readonly getIdToken: GetBearerTokenFn;
  readonly facilityId?: string | null;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<PostgresStaffSessionResponse> {
  const params = new URLSearchParams();
  if (options.facilityId) {
    params.set("facilityId", options.facilityId);
  }
  const qs = params.toString();
  const url = qs ? `/api/staff/session?${qs}` : "/api/staff/session";

  const raw = await authorizedGetJson({
    url,
    getIdToken: options.getIdToken,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  const parsed = PostgresStaffSessionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_SESSION_RESPONSE",
      "Received an unexpected session verification response from the server.",
    );
  }
  return parsed.data;
}

export interface FetchStaffQueueParams {
  readonly getIdToken: GetBearerTokenFn;
  readonly facilityId: string;
  readonly workflowStatus?: WorkflowStatus | "";
  readonly priority?: StaffAssignedPriority | "";
  readonly includeCompleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export async function fetchStaffQueue(
  params: FetchStaffQueueParams,
): Promise<StaffQueueResponse> {
  const query = new URLSearchParams();
  query.set("facilityId", params.facilityId);
  if (params.workflowStatus) {
    query.set("workflowStatus", params.workflowStatus);
  }
  if (params.priority) {
    query.set("priority", params.priority);
  }
  if (params.includeCompleted) {
    query.set("includeCompleted", "true");
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  if (typeof params.offset === "number" && params.offset > 0) {
    query.set("offset", String(params.offset));
  }

  const raw = await authorizedGetJson({
    url: `/api/staff/intakes?${query.toString()}`,
    getIdToken: params.getIdToken,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
  });

  const parsed = StaffQueueResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_QUEUE_RESPONSE",
      "Received an unexpected queue payload from the server.",
    );
  }
  return parsed.data;
}

export interface FetchStaffIntakeDetailParams {
  readonly getIdToken: GetBearerTokenFn;
  readonly facilityId: string;
  readonly intakeId: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export async function fetchStaffIntakeDetail(
  params: FetchStaffIntakeDetailParams,
): Promise<StaffIntakeDetailResponse> {
  const query = new URLSearchParams();
  query.set("facilityId", params.facilityId);

  const raw = await authorizedGetJson({
    url: `/api/staff/intakes/${encodeURIComponent(params.intakeId)}?${query.toString()}`,
    getIdToken: params.getIdToken,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
  });

  const parsed = StaffIntakeDetailResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_DETAIL_RESPONSE",
      "Received an unexpected intake detail payload from the server.",
    );
  }
  return parsed.data;
}
