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
  AuthorizedFacilityMembership,
  ResolvedStaffProfile,
} from "@/lib/schemas/staff-api";

export type VerifyTokenFn = (
  authorizationHeader: string | null | undefined,
) => Promise<VerifiedStaffToken>;

export class StaffAuthorizationError extends Error {
  readonly statusCode: 401 | 403;
  readonly errorCode: string;

  constructor(statusCode: 401 | 403, errorCode: string, message: string) {
    super(message);
    this.name = "StaffAuthorizationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export interface StaffSessionAuthorized {
  readonly status: "authorized";
  readonly token: VerifiedStaffToken;
  readonly staffProfile: ResolvedStaffProfile;
  readonly activeFacility: AuthorizedFacilityMembership;
}

export interface StaffSessionUnprovisioned {
  readonly status: "unprovisioned";
  readonly token: VerifiedStaffToken;
  readonly message: string;
}

export interface StaffSessionInactive {
  readonly status: "inactive";
  readonly token: VerifiedStaffToken;
  readonly message: string;
}

export type StaffSessionResolution =
  | StaffSessionAuthorized
  | StaffSessionUnprovisioned
  | StaffSessionInactive;

export interface ResolveStaffSessionOptions {
  readonly authorizationHeader: string | null | undefined;
  readonly requestedFacilityId?: string | null;
  readonly strictFacilityMatch?: boolean;
  readonly verifyToken?: VerifyTokenFn;
  readonly repository?: StaffRepository;
}

export interface RequireAuthorizedStaffOptions
  extends ResolveStaffSessionOptions {
  readonly allowedRoles?: readonly StaffRole[];
}

/**
 * Reusable server-side authentication + PostgreSQL authorization boundary.
 *
 * 1. Verifies Firebase ID token signature & email_verified claim on the server.
 * 2. Resolves staff_profiles + active facility_memberships + active facilities
 *    exclusively from Neon PostgreSQL (never trusting client UID/role/facility).
 * 3. Distinguishes authorized, unprovisioned, and inactive states cleanly.
 */
export async function resolveStaffSession(
  options: ResolveStaffSessionOptions,
): Promise<StaffSessionResolution> {
  assertServerRuntime();

  const verify = options.verifyToken ?? verifyStaffBearerToken;
  const repo = options.repository ?? createDrizzleStaffRepository();

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

  const record = await repo.findStaffAuthorizationByUid(token.uid);
  if (!record) {
    return {
      status: "unprovisioned",
      token,
      message:
        "Your Google identity is verified, but clinical staff access has not been provisioned for this account.",
    };
  }

  if (!record.profile.active || record.memberships.length === 0) {
    return {
      status: "inactive",
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
