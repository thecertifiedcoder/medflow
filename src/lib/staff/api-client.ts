import {
  DemoLogoutResponseSchema,
  DemoStatusResponseSchema,
  PostgresStaffSessionResponseSchema,
  StaffAdminFacilityOverviewResponseSchema,
  StaffIntakeDetailResponseSchema,
  StaffQueueResponseSchema,
  type DemoLogoutResponse,
  type DemoPersona,
  type DemoStatusResponse,
  type PostgresStaffSessionResponse,
  type StaffAdminFacilityOverviewResponse,
  type StaffIntakeDetailResponse,
  type StaffQueueResponse,
} from "@/lib/schemas/staff-api";
import type {
  StaffAssignedPriority,
  WorkflowStatus,
} from "@/lib/schemas/intake";

export const DEMO_CSRF_HEADER_NAME = "X-MedFlow-Demo-Request";
export const DEMO_CSRF_HEADER_VALUE = "1";

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
  readonly allowCookieFallback?: boolean;
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
 * Executes an authenticated same-origin GET request using either:
 * - An active Firebase ID token (`Authorization: Bearer <token>`), retrying once
 *   with a forced Firebase token refresh on HTTP 401, OR
 * - A server-signed HTTP-only Hackathon Demo Mode session cookie (`credentials: "include"`)
 *   when no Firebase token is active and `allowCookieFallback` is enabled.
 */
async function authorizedGetJson(
  options: AuthorizedFetchOptions,
): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;
  const allowCookieFallback = options.allowCookieFallback ?? true;

  const initialToken = await options.getIdToken(false);

  if (!initialToken) {
    if (!allowCookieFallback) {
      throw new StaffApiClientError(
        401,
        "SESSION_EXPIRED",
        "Your clinical staff session has expired. Please sign in again.",
      );
    }

    const cookieResponse = await doFetch(options.url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    });

    if (!cookieResponse.ok) {
      const parsed = await parseErrorBody(cookieResponse);
      throw new StaffApiClientError(
        cookieResponse.status,
        parsed.code,
        parsed.message,
      );
    }

    return cookieResponse.json();
  }

  let response = await doFetch(options.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${initialToken}`,
    },
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  });

  if (response.status === 401) {
    // Retry once with a freshly refreshed Firebase ID token in case the cached JWT expired.
    const refreshedToken = await options.getIdToken(true);
    if (!refreshedToken) {
      throw new StaffApiClientError(
        401,
        "SESSION_EXPIRED",
        "Your clinical staff session has expired. Please sign in again.",
      );
    }

    response = await doFetch(options.url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
      },
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
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
  readonly allowCookieFallback?: boolean;
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
    allowCookieFallback: options.allowCookieFallback ?? true,
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

export interface FetchStaffAdminFacilityOverviewParams {
  readonly getIdToken: GetBearerTokenFn;
  readonly facilityId: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export async function fetchStaffAdminFacilityOverview(
  params: FetchStaffAdminFacilityOverviewParams,
): Promise<StaffAdminFacilityOverviewResponse> {
  const query = new URLSearchParams();
  query.set("facilityId", params.facilityId);

  const raw = await authorizedGetJson({
    url: `/api/staff/admin/facility?${query.toString()}`,
    getIdToken: params.getIdToken,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
  });

  const parsed = StaffAdminFacilityOverviewResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_ADMIN_OVERVIEW_RESPONSE",
      "Received an unexpected administrator facility overview payload from the server.",
    );
  }
  return parsed.data;
}

/**
 * Fetches server-evaluated Hackathon Demo Mode status (always HTTP 200) to
 * check availability and whether an active HTTP-only demo session cookie exists.
 */
export async function fetchDemoStatus(
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<DemoStatusResponse> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch("/api/demo/status", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    throw new StaffApiClientError(response.status, parsed.code, parsed.message);
  }

  const raw = await response.json();
  const parsed = DemoStatusResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_DEMO_STATUS_RESPONSE",
      "Received an unexpected demo status payload from the server.",
    );
  }
  return parsed.data;
}

/**
 * Establishes a fixed, server-controlled Hackathon Demo Mode session via an
 * HTTP-only signed cookie. Sends no role or facility body fields.
 */
export async function createDemoSession(
  persona: DemoPersona,
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<PostgresStaffSessionResponse> {
  const doFetch = options.fetchImpl ?? fetch;
  const endpoint =
    persona === "admin" ? "/api/demo/session/admin" : "/api/demo/session/staff";

  const response = await doFetch(endpoint, {
    method: "POST",
    headers: {
      [DEMO_CSRF_HEADER_NAME]: DEMO_CSRF_HEADER_VALUE,
    },
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    throw new StaffApiClientError(response.status, parsed.code, parsed.message);
  }

  const raw = await response.json();
  const parsed = PostgresStaffSessionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_DEMO_SESSION_RESPONSE",
      "Received an unexpected demo session response from the server.",
    );
  }
  return parsed.data;
}

/**
 * Revokes the active Hackathon Demo Mode session server-side and clears its
 * HTTP-only cookie.
 */
export async function logoutDemoSession(
  options: {
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<DemoLogoutResponse> {
  const doFetch = options.fetchImpl ?? fetch;

  const response = await doFetch("/api/demo/logout", {
    method: "POST",
    headers: {
      [DEMO_CSRF_HEADER_NAME]: DEMO_CSRF_HEADER_VALUE,
    },
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    throw new StaffApiClientError(response.status, parsed.code, parsed.message);
  }

  const raw = await response.json();
  const parsed = DemoLogoutResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffApiClientError(
      502,
      "INVALID_LOGOUT_RESPONSE",
      "Received an unexpected logout response from the server.",
    );
  }
  return parsed.data;
}
