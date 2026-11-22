import { NextResponse } from "next/server";
import {
  CANONICAL_DEMO_FACILITY,
  getSyntheticDemoIdentity,
  type DemoPersonaKey,
} from "@/db/invariants";
import {
  assertDemoModeReady,
  assertEmptyDemoRequestBody,
  buildDemoSessionClearCookieHeader,
  buildDemoSessionSetCookieHeader,
  DEMO_SESSION_REUSE_THRESHOLD_SECONDS,
  DemoSessionError,
  extractDemoSessionCookie,
  getGlobalDemoRevocationStore,
  mintDemoSessionToken,
  resolveDemoCookieSecurityContext,
  validateDemoCsrfRequest,
  verifyDemoSessionToken,
  type DemoSessionRevocationStore,
} from "@/lib/auth/demo-session";
import { toSafeDatabaseError } from "@/lib/db/errors";
import {
  createDrizzleStaffRepository,
  type StaffRepository,
} from "@/lib/db/staff-repository";
import { assertServerRuntime, getDemoModeConfig } from "@/lib/env/server";
import { jsonError } from "@/lib/http/errors";
import {
  DemoLogoutResponseSchema,
  DemoStatusResponseSchema,
  PostgresStaffSessionResponseSchema,
  type AuthorizedFacilityMembership,
  type ResolvedStaffProfile,
} from "@/lib/schemas/staff-api";

export interface DemoHandlerDeps {
  readonly repository?: StaffRepository;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => Date;
  readonly revocationStore?: DemoSessionRevocationStore;
}

export interface DemoPostRequestInput {
  readonly url: string;
  readonly cookieHeader: string | null;
  readonly csrfHeader: string | null;
  readonly originHeader: string | null;
  readonly refererHeader: string | null;
  readonly hostHeader: string | null;
  readonly forwardedHostHeader: string | null;
  readonly forwardedProtoHeader: string | null;
  readonly forwardedHeader?: string | null;
  readonly rawBodyText: string;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function handleDemoHandlerError(error: unknown): NextResponse {
  if (error instanceof DemoSessionError) {
    return jsonError(error.statusCode, error.errorCode, error.message);
  }
  const safeDbError = toSafeDatabaseError(error);
  return jsonError(
    safeDbError.statusCode,
    safeDbError.errorCode,
    safeDbError.message,
  );
}

/**
 * GET /api/demo/status
 * Returns non-secret server-evaluated Hackathon Demo Mode availability.
 */
export function handleDemoStatusGet(
  deps: DemoHandlerDeps = {},
  request: { readonly cookieHeader?: string | null } = {},
): NextResponse {
  assertServerRuntime();
  const config = getDemoModeConfig(deps.env);

  let hasActiveDemoSession = false;
  if (config.enabled && config.configured) {
    const rawCookie = extractDemoSessionCookie(request.cookieHeader);
    if (rawCookie) {
      try {
        verifyDemoSessionToken(rawCookie, {
          env: deps.env,
          now: deps.now,
          revocationStore:
            deps.revocationStore ?? getGlobalDemoRevocationStore(),
        });
        hasActiveDemoSession = true;
      } catch {
        hasActiveDemoSession = false;
      }
    }
  }

  const payload = DemoStatusResponseSchema.parse({
    enabled: config.enabled,
    configured: config.configured,
    facilityPublicCode: CANONICAL_DEMO_FACILITY.publicCode,
    hasActiveDemoSession,
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

/**
 * POST /api/demo/session/admin | POST /api/demo/session/staff
 *
 * Establishes a signed, HTTP-only Demo Mode session for a fixed server-defined
 * synthetic persona bound exclusively to `demo-clinic-01`.
 *
 * Security controls:
 * - Requires CSRF custom header + same-origin Origin/Host match.
 * - Rejects any client-supplied body parameters (`role`, `facilityId`, `uid`, etc.).
 * - Fails closed when Demo Mode is disabled (`403`) or missing secret (`503`).
 * - Reuses an active valid same-persona session idempotently (avoiding churn on
 *   accidental duplicate requests) and revokes any previous different-persona session.
 * - Verifies the seeded synthetic identity and `demo-clinic-01` (`is_demo=true`)
 *   against PostgreSQL before issuing the session cookie.
 */
export async function handleDemoSessionCreatePost(
  persona: DemoPersonaKey,
  request: DemoPostRequestInput,
  deps: DemoHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  try {
    validateDemoCsrfRequest({
      csrfHeader: request.csrfHeader,
      originHeader: request.originHeader,
      refererHeader: request.refererHeader,
      hostHeader: request.hostHeader,
      forwardedHostHeader: request.forwardedHostHeader,
    });

    assertEmptyDemoRequestBody(request.rawBodyText);

    const { ttlSeconds } = assertDemoModeReady(deps.env);
    const now = deps.now ?? (() => new Date());
    const nowSeconds = Math.floor(now().getTime() / 1000);
    const revocationStore =
      deps.revocationStore ?? getGlobalDemoRevocationStore();
    const repository = deps.repository ?? createDrizzleStaffRepository();
    const identity = getSyntheticDemoIdentity(persona);

    // Inspect any existing demo cookie so we either reuse an active same-persona
    // session idempotently or revoke a superseded different-persona session.
    let activeTokenToReuse: string | null = null;
    let activeExpiresAtSeconds: number | null = null;
    const existingCookie = extractDemoSessionCookie(request.cookieHeader);

    if (existingCookie) {
      try {
        const existingSession = verifyDemoSessionToken(existingCookie, {
          env: deps.env,
          now,
          revocationStore,
        });

        const remainingSeconds = existingSession.expiresAt - nowSeconds;
        if (
          existingSession.persona === persona &&
          remainingSeconds >= DEMO_SESSION_REUSE_THRESHOLD_SECONDS
        ) {
          activeTokenToReuse = existingCookie;
          activeExpiresAtSeconds = existingSession.expiresAt;
        } else {
          revocationStore.revoke(
            existingSession.sid,
            existingSession.expiresAt,
            nowSeconds,
          );
        }
      } catch {
        // Invalid, expired, or already-revoked previous cookie is safely ignored
        // and overwritten with a fresh session cookie below.
      }
    }

    // Verify canonical synthetic facility & demo staff profile exist in PostgreSQL.
    const record = await repository.findStaffAuthorizationByUid(identity.uid);
    const demoMembership = record?.memberships.find(
      (m) => m.facilityId === CANONICAL_DEMO_FACILITY.id && m.isDemo === true,
    );

    if (!record || !record.profile.active || !demoMembership) {
      return jsonError(
        503,
        "DEMO_FACILITY_NOT_SEEDED",
        "The canonical synthetic demo facility or demo staff profile is not provisioned in PostgreSQL. Run npm run db:seed first.",
      );
    }

    if (demoMembership.role !== identity.role) {
      return jsonError(
        403,
        "DEMO_ROLE_MISMATCH",
        "Demo identity role binding does not match the authorized synthetic facility configuration.",
      );
    }

    let cookieToken: string;
    let cookieMaxAgeSeconds: number;
    let expiresAtIso: string;

    if (activeTokenToReuse && activeExpiresAtSeconds !== null) {
      cookieToken = activeTokenToReuse;
      cookieMaxAgeSeconds = Math.max(1, activeExpiresAtSeconds - nowSeconds);
      expiresAtIso = new Date(activeExpiresAtSeconds * 1000).toISOString();
    } else {
      const minted = mintDemoSessionToken(persona, {
        env: deps.env,
        now,
        revocationStore,
      });
      cookieToken = minted.token;
      cookieMaxAgeSeconds = ttlSeconds;
      expiresAtIso = new Date(minted.session.expiresAt * 1000).toISOString();
    }

    const lockedFacility: AuthorizedFacilityMembership = {
      facilityId: CANONICAL_DEMO_FACILITY.id,
      facilityName: demoMembership.facilityName,
      facilityPublicCode: demoMembership.facilityPublicCode,
      role: identity.role,
      isDemo: true,
    };

    const staffProfile: ResolvedStaffProfile = {
      uid: identity.uid,
      email: record.profile.email,
      displayName: record.profile.displayName,
      active: true,
      role: identity.role,
      facilityIds: [CANONICAL_DEMO_FACILITY.id],
      memberships: [lockedFacility],
    };

    const payload = PostgresStaffSessionResponseSchema.parse({
      authenticated: true,
      verifiedByServer: true,
      authMode: "demo",
      demoPersona: persona,
      sessionExpiresAt: expiresAtIso,
      projectId: "medflow-demo-mode",
      authorizationModel: "neon_postgres_server_rbac",
      user: {
        uid: identity.uid,
        email: record.profile.email,
        emailVerified: true,
        displayName: record.profile.displayName,
      },
      authorizationStatus: "authorized",
      staffProfile,
      activeFacility: lockedFacility,
    });

    const cookieContext = resolveDemoCookieSecurityContext({
      url: request.url,
      forwardedProto: request.forwardedProtoHeader,
      forwardedHeader: request.forwardedHeader,
      originHeader: request.originHeader,
      refererHeader: request.refererHeader,
      hostHeader: request.hostHeader,
      forwardedHostHeader: request.forwardedHostHeader,
      nodeEnv: deps.env?.NODE_ENV,
    });
    const setCookieHeader = buildDemoSessionSetCookieHeader(
      cookieToken,
      cookieMaxAgeSeconds,
      cookieContext,
    );

    const response = NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
    response.headers.set("Set-Cookie", setCookieHeader);
    return response;
  } catch (error) {
    return handleDemoHandlerError(error);
  }
}

/**
 * POST /api/demo/logout
 * Revokes any active Demo Mode session server-side and clears the HTTP-only cookie.
 */
export async function handleDemoLogoutPost(
  request: Omit<DemoPostRequestInput, "rawBodyText">,
  deps: DemoHandlerDeps = {},
): Promise<NextResponse> {
  assertServerRuntime();

  try {
    validateDemoCsrfRequest({
      csrfHeader: request.csrfHeader,
      originHeader: request.originHeader,
      refererHeader: request.refererHeader,
      hostHeader: request.hostHeader,
      forwardedHostHeader: request.forwardedHostHeader,
    });

    const now = deps.now ?? (() => new Date());
    const nowSeconds = Math.floor(now().getTime() / 1000);
    const revocationStore =
      deps.revocationStore ?? getGlobalDemoRevocationStore();
    const existingCookie = extractDemoSessionCookie(request.cookieHeader);

    let revoked = false;
    if (existingCookie) {
      try {
        const verified = verifyDemoSessionToken(existingCookie, {
          env: deps.env,
          now,
          revocationStore,
        });
        revocationStore.revoke(verified.sid, verified.expiresAt, nowSeconds);
        revoked = true;
      } catch {
        // Already expired, invalid, or Demo Mode disabled; still clear cookie cleanly.
      }
    }

    const cookieContext = resolveDemoCookieSecurityContext({
      url: request.url,
      forwardedProto: request.forwardedProtoHeader,
      forwardedHeader: request.forwardedHeader,
      originHeader: request.originHeader,
      refererHeader: request.refererHeader,
      hostHeader: request.hostHeader,
      forwardedHostHeader: request.forwardedHostHeader,
      nodeEnv: deps.env?.NODE_ENV,
    });
    const clearCookieHeader = buildDemoSessionClearCookieHeader(cookieContext);

    const payload = DemoLogoutResponseSchema.parse({
      loggedOut: true,
      revoked,
    });

    const response = NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
    response.headers.set("Set-Cookie", clearCookieHeader);
    return response;
  } catch (error) {
    return handleDemoHandlerError(error);
  }
}
