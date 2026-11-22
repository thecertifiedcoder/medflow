import {
  CANONICAL_DEMO_FACILITY,
  isReservedDemoUid,
  type DemoPersonaKey,
} from "@/db/invariants";
import {
  DemoSessionError,
  extractDemoSessionCookie,
  verifyDemoSessionToken,
  type DemoSessionRevocationStore,
} from "@/lib/auth/demo-session";
import { assertServerRuntime } from "@/lib/env/server";
import {
  createDrizzleStaffRepository,
  type StaffRepository,
} from "@/lib/db/staff-repository";
import {
  TokenVerificationError,
  verifyStaffBearerToken,
  type VerifiedStaffToken,
} from "@/lib/firebase/admin-auth";
import type { StaffRole } from "@/lib/schemas/intake";
import type {
  AuthMode,
  AuthorizedFacilityMembership,
  ResolvedStaffProfile,
} from "@/lib/schemas/staff-api";

export type VerifyTokenFn = (
  authorizationHeader: string | null | undefined,
) => Promise<VerifiedStaffToken>;

export class StaffAuthorizationError extends Error {
  readonly statusCode: 401 | 403 | 503;
  readonly errorCode: string;

  constructor(statusCode: 401 | 403 | 503, errorCode: string, message: string) {
    super(message);
    this.name = "StaffAuthorizationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export interface StaffSessionAuthorized {
  readonly status: "authorized";
  readonly authMode: AuthMode;
  readonly demoPersona: DemoPersonaKey | null;
  readonly sessionExpiresAt: string | null;
  readonly token: VerifiedStaffToken;
  readonly staffProfile: ResolvedStaffProfile;
  readonly activeFacility: AuthorizedFacilityMembership;
}

export interface StaffSessionUnprovisioned {
  readonly status: "unprovisioned";
  readonly authMode: "firebase";
  readonly demoPersona: null;
  readonly sessionExpiresAt: null;
  readonly token: VerifiedStaffToken;
  readonly message: string;
}

export interface StaffSessionInactive {
  readonly status: "inactive";
  readonly authMode: "firebase";
  readonly demoPersona: null;
  readonly sessionExpiresAt: null;
  readonly token: VerifiedStaffToken;
  readonly message: string;
}

export type StaffSessionResolution =
  | StaffSessionAuthorized
  | StaffSessionUnprovisioned
  | StaffSessionInactive;

export interface ResolveStaffSessionOptions {
  readonly authorizationHeader: string | null | undefined;
  readonly cookieHeader?: string | null | undefined;
  readonly requestedFacilityId?: string | null;
  readonly strictFacilityMatch?: boolean;
  readonly verifyToken?: VerifyTokenFn;
  readonly repository?: StaffRepository;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => Date;
  readonly revocationStore?: DemoSessionRevocationStore;
}

export interface RequireAuthorizedStaffOptions
  extends ResolveStaffSessionOptions {
  readonly allowedRoles?: readonly StaffRole[];
}

/**
 * Reusable server-side authentication + PostgreSQL authorization boundary.
 *
 * Supports two cleanly separated server-verified authentication paths:
 * 1. Firebase ID Token (`Authorization: Bearer <token>`): verifies Google/Firebase
 *    token signature & `email_verified === true` on the server, rejects reserved
 *    synthetic demo UIDs, and resolves `staff_profiles` + `facility_memberships`
 *    authoritatively from Neon PostgreSQL.
 * 2. Hackathon Demo Mode HTTP-only signed cookie (`medflow_demo_session`): only
 *    accepted when `MEDFLOW_DEMO_MODE_ENABLED=true` and `MEDFLOW_DEMO_SESSION_SECRET`
 *    is valid; verifies HMAC signature, expiration, and revocation registry, then
 *    verifies the synthetic demo identity & `demo-clinic-01` (`is_demo = true`)
 *    strictly in PostgreSQL with zero cross-facility or role escalation paths.
 */
export async function resolveStaffSession(
  options: ResolveStaffSessionOptions,
): Promise<StaffSessionResolution> {
  assertServerRuntime();

  const repo = options.repository ?? createDrizzleStaffRepository();
  const hasAuthorizationHeader =
    typeof options.authorizationHeader === "string" &&
    options.authorizationHeader.trim().length > 0;
  const demoCookieToken = !hasAuthorizationHeader
    ? extractDemoSessionCookie(options.cookieHeader)
    : null;

  // Path B: Hackathon Demo Mode HTTP-only signed cookie (when no Bearer token is supplied)
  if (!hasAuthorizationHeader && demoCookieToken) {
    let verifiedDemo;
    try {
      verifiedDemo = verifyDemoSessionToken(demoCookieToken, {
        env: options.env,
        now: options.now,
        revocationStore: options.revocationStore,
      });
    } catch (error) {
      if (error instanceof DemoSessionError) {
        const statusCode: 401 | 403 | 503 =
          error.statusCode === 400 ? 401 : error.statusCode;
        throw new StaffAuthorizationError(
          statusCode,
          error.errorCode,
          error.message,
        );
      }
      throw error;
    }

    const requestedFacilityId = options.requestedFacilityId?.trim() || null;
    if (
      requestedFacilityId &&
      requestedFacilityId !== CANONICAL_DEMO_FACILITY.id
    ) {
      throw new StaffAuthorizationError(
        403,
        "FACILITY_ACCESS_DENIED",
        "Hackathon Demo Mode sessions are strictly restricted to the canonical synthetic demo facility.",
      );
    }

    const record = await repo.findStaffAuthorizationByUid(
      verifiedDemo.identity.uid,
    );
    const demoMembership = record?.memberships.find(
      (m) => m.facilityId === CANONICAL_DEMO_FACILITY.id && m.isDemo === true,
    );

    if (!record || !record.profile.active || !demoMembership) {
      throw new StaffAuthorizationError(
        503,
        "DEMO_FACILITY_NOT_SEEDED",
        "The canonical synthetic demo facility or demo staff profile is not provisioned in PostgreSQL. Run npm run db:seed first.",
      );
    }

    // Enforce the fixed, server-defined persona role strictly (never allow escalation).
    if (demoMembership.role !== verifiedDemo.identity.role) {
      throw new StaffAuthorizationError(
        403,
        "DEMO_ROLE_MISMATCH",
        "Demo identity role binding does not match the authorized synthetic facility configuration.",
      );
    }

    const lockedFacility: AuthorizedFacilityMembership = {
      facilityId: CANONICAL_DEMO_FACILITY.id,
      facilityName: demoMembership.facilityName,
      facilityPublicCode: demoMembership.facilityPublicCode,
      role: verifiedDemo.identity.role,
      isDemo: true,
    };

    const staffProfile: ResolvedStaffProfile = {
      uid: verifiedDemo.identity.uid,
      email: record.profile.email,
      displayName: record.profile.displayName,
      active: true,
      role: verifiedDemo.identity.role,
      facilityIds: [CANONICAL_DEMO_FACILITY.id],
      memberships: [lockedFacility],
    };

    return {
      status: "authorized",
      authMode: "demo",
      demoPersona: verifiedDemo.persona,
      sessionExpiresAt: new Date(verifiedDemo.expiresAt * 1000).toISOString(),
      token: {
        uid: verifiedDemo.identity.uid,
        email: record.profile.email,
        emailVerified: true,
        displayName: record.profile.displayName,
        authTime: verifiedDemo.issuedAt,
        expiresAt: verifiedDemo.expiresAt,
        projectId: "medflow-demo-mode",
      },
      staffProfile,
      activeFacility: lockedFacility,
    };
  }

  // Path A: Standard Firebase Authentication Bearer ID token
  const verify = options.verifyToken ?? verifyStaffBearerToken;

  let token: VerifiedStaffToken;
  try {
    token = await verify(options.authorizationHeader);
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      throw new StaffAuthorizationError(
        error.statusCode,
        error.errorCode,
        error.message,
      );
    }
    throw error;
  }

  if (isReservedDemoUid(token.uid)) {
    throw new StaffAuthorizationError(
      403,
      "RESERVED_DEMO_UID",
      "Synthetic demo identifiers cannot be used for Firebase staff authentication.",
    );
  }

  const record = await repo.findStaffAuthorizationByUid(token.uid);
  if (!record) {
    return {
      status: "unprovisioned",
      authMode: "firebase",
      demoPersona: null,
      sessionExpiresAt: null,
      token,
      message:
        "Your Google identity is verified, but clinical staff access has not been provisioned for this account.",
    };
  }

  if (!record.profile.active || record.memberships.length === 0) {
    return {
      status: "inactive",
      authMode: "firebase",
      demoPersona: null,
      sessionExpiresAt: null,
      token,
      message:
        "Your staff profile is inactive or has no active facility memberships.",
    };
  }

  const requestedFacilityId = options.requestedFacilityId?.trim() || null;
  let activeFacility: AuthorizedFacilityMembership | undefined;

  if (requestedFacilityId) {
    activeFacility = record.memberships.find(
      (m) => m.facilityId === requestedFacilityId,
    );
    if (!activeFacility && options.strictFacilityMatch) {
      throw new StaffAuthorizationError(
        403,
        "FACILITY_ACCESS_DENIED",
        "Your staff account is not authorized to access the requested facility.",
      );
    }
  }

  const resolvedFacility = activeFacility ?? record.memberships[0];
  if (!resolvedFacility) {
    return {
      status: "inactive",
      authMode: "firebase",
      demoPersona: null,
      sessionExpiresAt: null,
      token,
      message:
        "Your staff profile is inactive or has no active facility memberships.",
    };
  }

  const staffProfile: ResolvedStaffProfile = {
    uid: record.profile.uid,
    email: record.profile.email,
    displayName: record.profile.displayName,
    active: record.profile.active,
    role: resolvedFacility.role,
    facilityIds: record.memberships.map((m) => m.facilityId),
    memberships: [...record.memberships],
  };

  return {
    status: "authorized",
    authMode: "firebase",
    demoPersona: null,
    sessionExpiresAt: null,
    token,
    staffProfile,
    activeFacility: resolvedFacility,
  };
}

/**
 * Enforces an active, provisioned, facility-scoped staff session and optional
 * clinical role check on every protected MedFlow API Route Handler.
 */
export async function requireAuthorizedStaff(
  options: RequireAuthorizedStaffOptions,
): Promise<StaffSessionAuthorized> {
  const resolution = await resolveStaffSession({
    ...options,
    strictFacilityMatch: options.strictFacilityMatch ?? true,
  });

  if (resolution.status === "unprovisioned") {
    throw new StaffAuthorizationError(
      403,
      "STAFF_NOT_PROVISIONED",
      resolution.message,
    );
  }

  if (resolution.status === "inactive") {
    throw new StaffAuthorizationError(
      403,
      "STAFF_INACTIVE",
      resolution.message,
    );
  }

  if (
    options.allowedRoles &&
    options.allowedRoles.length > 0 &&
    !options.allowedRoles.includes(resolution.activeFacility.role)
  ) {
    throw new StaffAuthorizationError(
      403,
      "INSUFFICIENT_STAFF_ROLE",
      "Your assigned clinical role is not authorized to perform this action.",
    );
  }

  return resolution;
}
