import test from "node:test";
import assert from "node:assert/strict";
import {
  requireAuthorizedStaff,
  resolveStaffSession,
  StaffAuthorizationError,
  type VerifyTokenFn,
} from "./staff-authorization";
import {
  extractBearerToken,
  TokenVerificationError,
  type VerifiedStaffToken,
} from "@/lib/firebase/admin-auth";
import type {
  StaffAuthorizationRecord,
  StaffRepository,
} from "@/lib/db/staff-repository";

function createVerifiedToken(
  overrides: Partial<VerifiedStaffToken> = {},
): VerifiedStaffToken {
  return {
    uid: "staff-uid-01",
    email: "nurse.synthetic@medflow.demo",
    emailVerified: true,
    displayName: "Nurse Synthetic",
    authTime: 1_763_812_000,
    expiresAt: 1_763_815_600,
    projectId: "daring-brace-jw1xt",
    ...overrides,
  };
}

function createMockRepository(
  record: StaffAuthorizationRecord | null,
): {
  readonly repository: StaffRepository;
  readonly queriedUids: string[];
} {
  const queriedUids: string[] = [];
  const repository: StaffRepository = {
    async findStaffAuthorizationByUid(uid: string) {
      queriedUids.push(uid);
      return record;
    },
    async listFacilityIntakes() {
      throw new Error("Unexpected listFacilityIntakes call");
    },
    async findFacilityIntakeDetail() {
      throw new Error("Unexpected findFacilityIntakeDetail call");
    },
  };
  return { repository, queriedUids };
}

const ACTIVE_DEMO_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "staff-uid-01",
    email: "nurse.synthetic@medflow.demo",
    displayName: "Nurse Synthetic",
    active: true,
  },
  memberships: [
    {
      facilityId: "demo-clinic-01",
      facilityName: "MedFlow Synthetic Demo Clinic",
      facilityPublicCode: "DEMO-CLINIC-01",
      role: "nurse",
      isDemo: true,
    },
  ],
};

test("resolveStaffSession authorizes valid Firebase token with active PostgreSQL staff profile and facility membership", async () => {
  const { repository, queriedUids } = createMockRepository(ACTIVE_DEMO_RECORD);
  const verifyToken: VerifyTokenFn = async () => createVerifiedToken();

  const result = await resolveStaffSession({
    authorizationHeader: "Bearer valid-token",
    verifyToken,
    repository,
  });

  assert.equal(result.status, "authorized");
  assert.deepEqual(queriedUids, ["staff-uid-01"]);
  assert.equal(result.activeFacility.facilityId, "demo-clinic-01");
  assert.equal(result.activeFacility.role, "nurse");
  assert.equal(result.staffProfile.uid, "staff-uid-01");
  assert.deepEqual(result.staffProfile.facilityIds, ["demo-clinic-01"]);
});

test("resolveStaffSession maps missing, malformed, or expired Firebase tokens to 401 StaffAuthorizationError", async () => {
  const { repository, queriedUids } = createMockRepository(ACTIVE_DEMO_RECORD);

  const missingTokenVerifier: VerifyTokenFn = async () => {
    throw new TokenVerificationError(
      401,
      "MISSING_OR_INVALID_AUTH_HEADER",
      "A valid Authorization: Bearer <Firebase ID token> header is required.",
    );
  };

  await assert.rejects(
    () =>
      resolveStaffSession({
        authorizationHeader: null,
        verifyToken: missingTokenVerifier,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "MISSING_OR_INVALID_AUTH_HEADER");
      return true;
    },
  );

  const expiredTokenVerifier: VerifyTokenFn = async () => {
    throw new TokenVerificationError(
      401,
      "INVALID_OR_EXPIRED_TOKEN",
      "The provided Firebase ID token is invalid, expired, or revoked.",
    );
  };

  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer expired-token",
        verifyToken: expiredTokenVerifier,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "INVALID_OR_EXPIRED_TOKEN");
      return true;
    },
  );

  // Database must never be queried when token verification fails.
  assert.deepEqual(queriedUids, []);
});

test("resolveStaffSession rejects unverified email claims with 403 EMAIL_NOT_VERIFIED before querying PostgreSQL", async () => {
  const { repository, queriedUids } = createMockRepository(ACTIVE_DEMO_RECORD);
  const unverifiedVerifier: VerifyTokenFn = async () => {
    throw new TokenVerificationError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Clinical staff access requires a verified Google email address.",
    );
  };

  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer unverified-email-token",
        verifyToken: unverifiedVerifier,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "EMAIL_NOT_VERIFIED");
      return true;
    },
  );

  assert.deepEqual(queriedUids, []);
});

test("unprovisioned staff user returns unprovisioned in resolveStaffSession and 403 STAFF_NOT_PROVISIONED in requireAuthorizedStaff", async () => {
  const { repository } = createMockRepository(null);
  const verifyToken: VerifyTokenFn = async () =>
    createVerifiedToken({ uid: "unprovisioned-uid" });

  const session = await resolveStaffSession({
    authorizationHeader: "Bearer valid-token",
    verifyToken,
    repository,
  });
  assert.equal(session.status, "unprovisioned");

  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer valid-token",
        verifyToken,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "STAFF_NOT_PROVISIONED");
      return true;
    },
  );
});

test("inactive staff profile and active profile with zero active memberships are both rejected with 403 STAFF_INACTIVE", async () => {
  const inactiveProfileRecord: StaffAuthorizationRecord = {
    profile: { ...ACTIVE_DEMO_RECORD.profile, active: false },
    memberships: [],
  };
  const zeroMembershipsRecord: StaffAuthorizationRecord = {
    profile: { ...ACTIVE_DEMO_RECORD.profile, active: true },
    memberships: [],
  };
  const verifyToken: VerifyTokenFn = async () => createVerifiedToken();

  for (const record of [inactiveProfileRecord, zeroMembershipsRecord]) {
    const { repository } = createMockRepository(record);
    const session = await resolveStaffSession({
      authorizationHeader: "Bearer valid-token",
      verifyToken,
      repository,
    });
    assert.equal(session.status, "inactive");

    await assert.rejects(
      () =>
        requireAuthorizedStaff({
          authorizationHeader: "Bearer valid-token",
          verifyToken,
          repository,
        }),
      (err: unknown) => {
        assert.ok(err instanceof StaffAuthorizationError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.errorCode, "STAFF_INACTIVE");
        return true;
      },
    );
  }
});

test("multi-facility staff resolves requested authorized facility and denies unauthorized facility under strictFacilityMatch", async () => {
  const multiFacilityRecord: StaffAuthorizationRecord = {
    profile: ACTIVE_DEMO_RECORD.profile,
    memberships: [
      {
        facilityId: "demo-clinic-01",
        facilityName: "MedFlow Synthetic Demo Clinic",
        facilityPublicCode: "DEMO-CLINIC-01",
        role: "nurse",
        isDemo: true,
      },
      {
        facilityId: "demo-clinic-02",
        facilityName: "MedFlow Synthetic Overflow Clinic",
        facilityPublicCode: "DEMO-CLINIC-02",
        role: "doctor",
        isDemo: true,
      },
    ],
  };
  const { repository } = createMockRepository(multiFacilityRecord);
  const verifyToken: VerifyTokenFn = async () => createVerifiedToken();

  const authorizedSecond = await requireAuthorizedStaff({
    authorizationHeader: "Bearer valid-token",
    requestedFacilityId: "demo-clinic-02",
    verifyToken,
    repository,
  });
  assert.equal(authorizedSecond.activeFacility.facilityId, "demo-clinic-02");
  assert.equal(authorizedSecond.activeFacility.role, "doctor");
  assert.equal(authorizedSecond.staffProfile.role, "doctor");

  // Strict match rejects an unowned facility ID with 403 FACILITY_ACCESS_DENIED.
  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer valid-token",
        requestedFacilityId: "unauthorized-clinic-99",
        verifyToken,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "FACILITY_ACCESS_DENIED");
      return true;
    },
  );
});

test("requireAuthorizedStaff enforces role-based access control using PostgreSQL membership role", async () => {
  const { repository } = createMockRepository(ACTIVE_DEMO_RECORD); // role: "nurse"
  const verifyToken: VerifyTokenFn = async () => createVerifiedToken();

  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer valid-token",
        allowedRoles: ["doctor", "admin"],
        verifyToken,
        repository,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "INSUFFICIENT_STAFF_ROLE");
      return true;
    },
  );

  const allowed = await requireAuthorizedStaff({
    authorizationHeader: "Bearer valid-token",
    allowedRoles: ["nurse", "doctor", "admin"],
    verifyToken,
    repository,
  });
  assert.equal(allowed.activeFacility.role, "nurse");
});

test("extractBearerToken rejects missing/malformed headers and accepts structurally valid compact JWTs", () => {
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(""), null);
  assert.equal(extractBearerToken("Basic abc.def.ghi"), null);
  assert.equal(extractBearerToken("Bearer not-a-jwt"), null);
  assert.equal(
    extractBearerToken("Bearer headerPart.payloadPart.signaturePart"),
    "headerPart.payloadPart.signaturePart",
  );
});
