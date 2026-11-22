import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoSessionClearCookieHeader,
  buildDemoSessionSetCookieHeader,
  createInMemoryRevocationStore,
  DEMO_CSRF_HEADER_VALUE,
  DEMO_SESSION_COOKIE_NAME,
  DemoSessionError,
  extractDemoSessionCookie,
  mintDemoSessionToken,
  resolveDemoCookieSecurityContext,
  validateDemoCsrfRequest,
  verifyDemoSessionToken,
} from "./demo-session";
import {
  requireAuthorizedStaff,
  resolveStaffSession,
  StaffAuthorizationError,
  type VerifyTokenFn,
} from "./staff-authorization";
import {
  handleDemoLogoutPost,
  handleDemoSessionCreatePost,
  handleDemoStatusGet,
  type DemoPostRequestInput,
} from "@/lib/api/demo-handlers";
import {
  handleStaffAdminFacilityGet,
  handleStaffQueueGet,
  handleStaffSessionGet,
} from "@/lib/api/staff-handlers";
import type {
  FacilityAdminOverviewRecord,
  StaffAuthorizationRecord,
  StaffRepository,
} from "@/lib/db/staff-repository";
import {
  TokenVerificationError,
  type VerifiedStaffToken,
} from "@/lib/firebase/admin-auth";

const TEST_SECRET =
  "synthetic-test-only-demo-session-secret-0123456789abcdef0123456789";

const ENABLED_DEMO_ENV: Record<string, string | undefined> = {
  NODE_ENV: "development",
  MEDFLOW_DEMO_MODE_ENABLED: "true",
  MEDFLOW_DEMO_SESSION_SECRET: TEST_SECRET,
  MEDFLOW_DEMO_SESSION_TTL_SECONDS: "3600",
};

const DISABLED_DEMO_ENV: Record<string, string | undefined> = {
  NODE_ENV: "production",
};

const MISCONFIGURED_DEMO_ENV: Record<string, string | undefined> = {
  NODE_ENV: "production",
  MEDFLOW_DEMO_MODE_ENABLED: "true",
  MEDFLOW_DEMO_SESSION_SECRET: "too-short-secret",
};

const FIXED_BASE_TIME = new Date("2026-11-22T12:00:00.000Z");

const DEMO_ADMIN_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "demo-admin-01",
    email: "demo.admin@medflow.synthetic",
    displayName: "Demo Administrator (Synthetic)",
    active: true,
  },
  memberships: [
    {
      facilityId: "demo-clinic-01",
      facilityName: "MedFlow Synthetic Demo Clinic",
      facilityPublicCode: "DEMO-CLINIC-01",
      role: "admin",
      isDemo: true,
    },
  ],
};

const DEMO_STAFF_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "demo-staff-01",
    email: "demo.staff@medflow.synthetic",
    displayName: "Demo Clinical Staff (Synthetic)",
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

const REAL_FIREBASE_STAFF_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "firebase-real-nurse-01",
    email: "real.nurse@medflow.synthetic",
    displayName: "Real Firebase Nurse",
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

const SAMPLE_FACILITY_OVERVIEW: FacilityAdminOverviewRecord = {
  facilityId: "demo-clinic-01",
  facilityName: "MedFlow Synthetic Demo Clinic",
  facilityPublicCode: "DEMO-CLINIC-01",
  timezone: "Africa/Lagos",
  isDemo: true,
  active: true,
  activeStaffCount: 2,
  totalIntakesCount: 0,
  unassignedIntakesCount: 0,
};

function createDemoTestRepository(
  recordsByUid: Record<string, StaffAuthorizationRecord | null> = {
    "demo-admin-01": DEMO_ADMIN_RECORD,
    "demo-staff-01": DEMO_STAFF_RECORD,
    "firebase-real-nurse-01": REAL_FIREBASE_STAFF_RECORD,
  },
): StaffRepository {
  return {
    async findStaffAuthorizationByUid(uid: string) {
      return recordsByUid[uid] ?? null;
    },
    async listFacilityIntakes() {
      return {
        items: [],
        total: 0,
        unassignedCount: 0,
        aiUnavailableCount: 0,
      };
    },
    async findFacilityIntakeDetail() {
      return null;
    },
    async getFacilityAdminOverview(facilityId: string) {
      if (facilityId === "demo-clinic-01") {
        return SAMPLE_FACILITY_OVERVIEW;
      }
      return null;
    },
  };
}

function makeDemoPostInput(
  overrides: Partial<DemoPostRequestInput> = {},
): DemoPostRequestInput {
  return {
    url: "https://medflow-demo.run.app/api/demo/session/admin",
    cookieHeader: null,
    csrfHeader: DEMO_CSRF_HEADER_VALUE,
    originHeader: "https://medflow-demo.run.app",
    refererHeader: null,
    hostHeader: "medflow-demo.run.app",
    forwardedHostHeader: "medflow-demo.run.app",
    forwardedProtoHeader: "https",
    rawBodyText: "",
    ...overrides,
  };
}

function extractCookiePairFromSetCookie(setCookieHeader: string | null): string {
  assert.ok(setCookieHeader, "Expected Set-Cookie header");
  const firstSegment = setCookieHeader.split(";")[0]?.trim() ?? "";
  assert.ok(
    firstSegment.startsWith(`${DEMO_SESSION_COOKIE_NAME}=`),
    `Expected cookie name ${DEMO_SESSION_COOKIE_NAME}, got: ${firstSegment}`,
  );
  return firstSegment;
}

const rejectFirebaseToken: VerifyTokenFn = async () => {
  throw new TokenVerificationError(
    401,
    "MISSING_OR_INVALID_AUTH_HEADER",
    "No Firebase Bearer token provided.",
  );
};

// =============================================================================
// 1. Session creation, verification, expiration, tampering, and revocation
// =============================================================================

test("POST /api/demo/session/admin and /staff create signed HTTP-only cookies for fixed server personas", async () => {
  const revocationStore = createInMemoryRevocationStore();
  const repo = createDemoTestRepository();

  const adminRes = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput(),
    {
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );

  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.headers.get("cache-control"), "no-store");
  const adminSetCookie = adminRes.headers.get("set-cookie");
  assert.ok(adminSetCookie);
  assert.match(adminSetCookie, /HttpOnly/i);
  assert.match(adminSetCookie, /Secure/i);
  assert.match(adminSetCookie, /SameSite=None/i);
  assert.match(adminSetCookie, /Partitioned/i);
  assert.match(adminSetCookie, /Path=\//i);

  const adminBody = (await adminRes.json()) as {
    authMode: string;
    demoPersona: string;
    user: { uid: string };
    activeFacility: { facilityId: string; role: string; isDemo: boolean };
  };
  assert.equal(adminBody.authMode, "demo");
  assert.equal(adminBody.demoPersona, "admin");
  assert.equal(adminBody.user.uid, "demo-admin-01");
  assert.equal(adminBody.activeFacility.facilityId, "demo-clinic-01");
  assert.equal(adminBody.activeFacility.role, "admin");
  assert.equal(adminBody.activeFacility.isDemo, true);

  const staffRes = await handleDemoSessionCreatePost(
    "clinical_staff",
    makeDemoPostInput({
      url: "https://medflow-demo.run.app/api/demo/session/staff",
    }),
    {
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );

  assert.equal(staffRes.status, 200);
  const staffBody = (await staffRes.json()) as {
    authMode: string;
    demoPersona: string;
    user: { uid: string };
    activeFacility: { facilityId: string; role: string; isDemo: boolean };
  };
  assert.equal(staffBody.authMode, "demo");
  assert.equal(staffBody.demoPersona, "clinical_staff");
  assert.equal(staffBody.user.uid, "demo-staff-01");
  assert.equal(staffBody.activeFacility.facilityId, "demo-clinic-01");
  assert.equal(staffBody.activeFacility.role, "nurse");
  assert.equal(staffBody.activeFacility.isDemo, true);
});

test("verifyDemoSessionToken rejects expired, malformed, tampered-payload, wrong-secret, and revoked tokens", () => {
  const revocationStore = createInMemoryRevocationStore();
  const minted = mintDemoSessionToken("admin", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  });

  // Valid at T + 60s.
  const valid = verifyDemoSessionToken(minted.token, {
    env: ENABLED_DEMO_ENV,
    now: () => new Date(FIXED_BASE_TIME.getTime() + 60_000),
    revocationStore,
  });
  assert.equal(valid.identity.uid, "demo-admin-01");
  assert.equal(valid.identity.role, "admin");

  // Expired at T + 3601s.
  assert.throws(
    () =>
      verifyDemoSessionToken(minted.token, {
        env: ENABLED_DEMO_ENV,
        now: () => new Date(FIXED_BASE_TIME.getTime() + 3_601_000),
        revocationStore,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DemoSessionError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "DEMO_SESSION_EXPIRED");
      return true;
    },
  );

  // Tampered payload (attempting role escalation from clinical_staff -> admin).
  const staffMinted = mintDemoSessionToken("clinical_staff", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  });
  const [ver, encodedPayload, sig] = staffMinted.token.split(".");
  assert.ok(ver && encodedPayload && sig);
  const decoded = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  decoded.role = "admin";
  decoded.persona = "admin";
  const tamperedPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString(
    "base64url",
  );
  const tamperedToken = `${ver}.${tamperedPayload}.${sig}`;

  assert.throws(
    () =>
      verifyDemoSessionToken(tamperedToken, {
        env: ENABLED_DEMO_ENV,
        now: () => FIXED_BASE_TIME,
        revocationStore,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DemoSessionError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "DEMO_SESSION_INVALID");
      return true;
    },
  );

  // Wrong signing secret fails verification.
  assert.throws(
    () =>
      verifyDemoSessionToken(minted.token, {
        env: {
          ...ENABLED_DEMO_ENV,
          MEDFLOW_DEMO_SESSION_SECRET: "different-high-entropy-secret-".repeat(2),
        },
        now: () => FIXED_BASE_TIME,
        revocationStore,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DemoSessionError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "DEMO_SESSION_INVALID");
      return true;
    },
  );

  // Malformed strings fail verification.
  for (const bad of ["", "not-a-token", "v2.abc.def", "v1..sig", "v1.abc."]) {
    assert.throws(
      () =>
        verifyDemoSessionToken(bad, {
          env: ENABLED_DEMO_ENV,
          now: () => FIXED_BASE_TIME,
          revocationStore,
        }),
      (err: unknown) => {
        assert.ok(err instanceof DemoSessionError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.errorCode, "DEMO_SESSION_INVALID");
        return true;
      },
    );
  }

  // Revocation immediately invalidates the token.
  revocationStore.revoke(
    minted.session.sid,
    minted.session.expiresAt,
    Math.floor(FIXED_BASE_TIME.getTime() / 1000),
  );
  assert.throws(
    () =>
      verifyDemoSessionToken(minted.token, {
        env: ENABLED_DEMO_ENV,
        now: () => FIXED_BASE_TIME,
        revocationStore,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DemoSessionError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.errorCode, "DEMO_SESSION_REVOKED");
      return true;
    },
  );
});

test("Idempotent same-persona reuse, cross-persona revocation on switch, and POST /api/demo/logout revocation", async () => {
  const revocationStore = createInMemoryRevocationStore();
  const repo = createDemoTestRepository();

  // 1. Enter as Demo Admin.
  const firstAdminRes = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput(),
    {
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  const firstAdminCookie = extractCookiePairFromSetCookie(
    firstAdminRes.headers.get("set-cookie"),
  );

  // 2. Repeated click on Demo Admin within reuse window reuses same session token idempotently.
  const secondAdminRes = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput({ cookieHeader: firstAdminCookie }),
    {
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => new Date(FIXED_BASE_TIME.getTime() + 10_000),
      revocationStore,
    },
  );
  const secondAdminCookie = extractCookiePairFromSetCookie(
    secondAdminRes.headers.get("set-cookie"),
  );
  assert.equal(
    secondAdminCookie,
    firstAdminCookie,
    "Same-persona rapid retry should reuse active valid session idempotently",
  );

  // 3. Switching to Demo Clinical Staff mints a new cookie and revokes the previous Admin session.
  const switchToStaffRes = await handleDemoSessionCreatePost(
    "clinical_staff",
    makeDemoPostInput({
      url: "https://medflow-demo.run.app/api/demo/session/staff",
      cookieHeader: firstAdminCookie,
    }),
    {
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => new Date(FIXED_BASE_TIME.getTime() + 20_000),
      revocationStore,
    },
  );
  assert.equal(switchToStaffRes.status, 200);
  const staffCookie = extractCookiePairFromSetCookie(
    switchToStaffRes.headers.get("set-cookie"),
  );
  assert.notEqual(staffCookie, firstAdminCookie);

  // Replaying the superseded Admin cookie must fail with 401 DEMO_SESSION_REVOKED.
  const replayedAdminSessionRes = await handleStaffSessionGet(
    {
      authorizationHeader: null,
      cookieHeader: firstAdminCookie,
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => new Date(FIXED_BASE_TIME.getTime() + 25_000),
      revocationStore,
    },
  );
  assert.equal(replayedAdminSessionRes.status, 401);
  const replayBody = (await replayedAdminSessionRes.json()) as {
    error: { code: string };
  };
  assert.equal(replayBody.error.code, "DEMO_SESSION_REVOKED");

  // 4. Logout revokes the active Staff cookie and emits a clearing Set-Cookie header.
  const logoutRes = await handleDemoLogoutPost(
    {
      url: "https://medflow-demo.run.app/api/demo/logout",
      cookieHeader: staffCookie,
      csrfHeader: DEMO_CSRF_HEADER_VALUE,
      originHeader: "https://medflow-demo.run.app",
      refererHeader: null,
      hostHeader: "medflow-demo.run.app",
      forwardedHostHeader: "medflow-demo.run.app",
      forwardedProtoHeader: "https",
    },
    {
      env: ENABLED_DEMO_ENV,
      now: () => new Date(FIXED_BASE_TIME.getTime() + 30_000),
      revocationStore,
    },
  );
  assert.equal(logoutRes.status, 200);
  const logoutBody = (await logoutRes.json()) as {
    loggedOut: boolean;
    revoked: boolean;
  };
  assert.equal(logoutBody.loggedOut, true);
  assert.equal(logoutBody.revoked, true);
  const clearCookie = logoutRes.headers.get("set-cookie") ?? "";
  assert.match(clearCookie, /Max-Age=0/i);
  assert.match(clearCookie, /HttpOnly/i);

  // Replaying the logged-out Staff cookie must fail with 401 DEMO_SESSION_REVOKED.
  const afterLogoutRes = await handleStaffQueueGet(
    {
      authorizationHeader: null,
      cookieHeader: staffCookie,
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => new Date(FIXED_BASE_TIME.getTime() + 35_000),
      revocationStore,
    },
  );
  assert.equal(afterLogoutRes.status, 401);
  const afterLogoutBody = (await afterLogoutRes.json()) as {
    error: { code: string };
  };
  assert.equal(afterLogoutBody.error.code, "DEMO_SESSION_REVOKED");
});

// =============================================================================
// 2. CSRF protection & client payload injection prevention
// =============================================================================

test("Demo session creation and logout enforce CSRF header and same-origin checks", async () => {
  const repo = createDemoTestRepository();

  // Missing custom header -> 403 CSRF_HEADER_REQUIRED
  const missingHeaderRes = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput({ csrfHeader: null }),
    { repository: repo, env: ENABLED_DEMO_ENV },
  );
  assert.equal(missingHeaderRes.status, 403);
  assert.equal(
    ((await missingHeaderRes.json()) as { error: { code: string } }).error.code,
    "CSRF_HEADER_REQUIRED",
  );

  // Cross-origin Origin header -> 403 CSRF_ORIGIN_MISMATCH
  const crossOriginRes = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput({ originHeader: "https://evil.example.com" }),
    { repository: repo, env: ENABLED_DEMO_ENV },
  );
  assert.equal(crossOriginRes.status, 403);
  assert.equal(
    ((await crossOriginRes.json()) as { error: { code: string } }).error.code,
    "CSRF_ORIGIN_MISMATCH",
  );

  // Cross-origin Referer without Origin -> 403 CSRF_ORIGIN_MISMATCH
  assert.throws(
    () =>
      validateDemoCsrfRequest({
        csrfHeader: DEMO_CSRF_HEADER_VALUE,
        originHeader: null,
        refererHeader: "https://evil.example.com/phish",
        hostHeader: "medflow-demo.run.app",
      }),
    (err: unknown) => {
      assert.ok(err instanceof DemoSessionError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "CSRF_ORIGIN_MISMATCH");
      return true;
    },
  );
});

test("Client cannot inject role, facilityId, or uid in demo session POST body", async () => {
  const repo = createDemoTestRepository();

  for (const injectedBody of [
    JSON.stringify({ role: "admin" }),
    JSON.stringify({ facilityId: "other-clinic-99" }),
    JSON.stringify({ uid: "real-staff-uid" }),
    "not-json",
  ]) {
    const res = await handleDemoSessionCreatePost(
      "clinical_staff",
      makeDemoPostInput({ rawBodyText: injectedBody }),
      { repository: repo, env: ENABLED_DEMO_ENV },
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.ok(
      body.error.code === "UNSUPPORTED_REQUEST_BODY" ||
        body.error.code === "INVALID_REQUEST_BODY",
    );
  }
});

// =============================================================================
// 3. Role separation & strict facility isolation
// =============================================================================

test("GET /api/staff/admin/facility enforces role separation: Demo Admin 200, Demo Clinical Staff 403, unauthenticated 401", async () => {
  const revocationStore = createInMemoryRevocationStore();
  const repo = createDemoTestRepository();

  const adminToken = mintDemoSessionToken("admin", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  }).token;
  const staffToken = mintDemoSessionToken("clinical_staff", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  }).token;

  const adminCookie = `${DEMO_SESSION_COOKIE_NAME}=${encodeURIComponent(adminToken)}`;
  const staffCookie = `${DEMO_SESSION_COOKIE_NAME}=${encodeURIComponent(staffToken)}`;

  // Demo Admin -> 200 with canonical demo-clinic-01 overview.
  const adminRes = await handleStaffAdminFacilityGet(
    {
      authorizationHeader: null,
      cookieHeader: adminCookie,
      searchParams: new URLSearchParams("facilityId=demo-clinic-01"),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  assert.equal(adminRes.status, 200);
  const adminOverview = (await adminRes.json()) as {
    facility: { facilityId: string; isDemo: boolean; role: string };
    metrics: { activeStaffCount: number; totalIntakesCount: number };
    roleBoundaries: { currentRole: string; isDemoSession: boolean };
  };
  assert.equal(adminOverview.facility.facilityId, "demo-clinic-01");
  assert.equal(adminOverview.facility.isDemo, true);
  assert.equal(adminOverview.facility.role, "admin");
  assert.equal(adminOverview.metrics.activeStaffCount, 2);
  assert.equal(adminOverview.roleBoundaries.currentRole, "admin");
  assert.equal(adminOverview.roleBoundaries.isDemoSession, true);

  // Demo Clinical Staff -> 403 INSUFFICIENT_STAFF_ROLE (cannot access admin-only endpoint).
  const staffRes = await handleStaffAdminFacilityGet(
    {
      authorizationHeader: null,
      cookieHeader: staffCookie,
      searchParams: new URLSearchParams("facilityId=demo-clinic-01"),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  assert.equal(staffRes.status, 403);
  const staffErr = (await staffRes.json()) as { error: { code: string } };
  assert.equal(staffErr.error.code, "INSUFFICIENT_STAFF_ROLE");

  // Unauthenticated -> 401.
  const unauthRes = await handleStaffAdminFacilityGet(
    {
      authorizationHeader: null,
      cookieHeader: null,
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  assert.equal(unauthRes.status, 401);
});

test("Demo sessions are strictly isolated to demo-clinic-01 and denied access to any other facilityId", async () => {
  const revocationStore = createInMemoryRevocationStore();
  const repo = createDemoTestRepository();

  const adminToken = mintDemoSessionToken("admin", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  }).token;
  const adminCookie = `${DEMO_SESSION_COOKIE_NAME}=${encodeURIComponent(adminToken)}`;

  const crossFacilityQueueRes = await handleStaffQueueGet(
    {
      authorizationHeader: null,
      cookieHeader: adminCookie,
      searchParams: new URLSearchParams("facilityId=real-hospital-99"),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  assert.equal(crossFacilityQueueRes.status, 403);
  assert.equal(
    ((await crossFacilityQueueRes.json()) as { error: { code: string } }).error
      .code,
    "FACILITY_ACCESS_DENIED",
  );

  const crossFacilityAdminRes = await handleStaffAdminFacilityGet(
    {
      authorizationHeader: null,
      cookieHeader: adminCookie,
      searchParams: new URLSearchParams("facilityId=real-hospital-99"),
    },
    {
      verifyToken: rejectFirebaseToken,
      repository: repo,
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
  );
  assert.equal(crossFacilityAdminRes.status, 403);
  assert.equal(
    ((await crossFacilityAdminRes.json()) as { error: { code: string } }).error
      .code,
    "FACILITY_ACCESS_DENIED",
  );
});

// =============================================================================
// 4. Configuration fail-closed behavior & Firebase Auth preservation
// =============================================================================

test("Demo Mode fails closed when disabled (403) or missing secret (503), and /api/demo/status reports safe booleans", async () => {
  const repo = createDemoTestRepository();

  const disabledStatus = handleDemoStatusGet({ env: DISABLED_DEMO_ENV });
  assert.equal(disabledStatus.status, 200);
  assert.deepEqual(await disabledStatus.json(), {
    enabled: false,
    configured: false,
    facilityPublicCode: "DEMO-CLINIC-01",
    hasActiveDemoSession: false,
  });

  const disabledPost = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput(),
    { repository: repo, env: DISABLED_DEMO_ENV },
  );
  assert.equal(disabledPost.status, 403);
  assert.equal(
    ((await disabledPost.json()) as { error: { code: string } }).error.code,
    "DEMO_MODE_DISABLED",
  );

  const misconfiguredStatus = handleDemoStatusGet({
    env: MISCONFIGURED_DEMO_ENV,
  });
  assert.equal(misconfiguredStatus.status, 200);
  assert.deepEqual(await misconfiguredStatus.json(), {
    enabled: true,
    configured: false,
    facilityPublicCode: "DEMO-CLINIC-01",
    hasActiveDemoSession: false,
  });

  const revocationStore = createInMemoryRevocationStore();
  const activeToken = mintDemoSessionToken("admin", {
    env: ENABLED_DEMO_ENV,
    now: () => FIXED_BASE_TIME,
    revocationStore,
  }).token;
  const activeStatus = handleDemoStatusGet(
    {
      env: ENABLED_DEMO_ENV,
      now: () => FIXED_BASE_TIME,
      revocationStore,
    },
    {
      cookieHeader: `${DEMO_SESSION_COOKIE_NAME}=${encodeURIComponent(activeToken)}`,
    },
  );
  assert.equal(activeStatus.status, 200);
  assert.deepEqual(await activeStatus.json(), {
    enabled: true,
    configured: true,
    facilityPublicCode: "DEMO-CLINIC-01",
    hasActiveDemoSession: true,
  });

  const misconfiguredPost = await handleDemoSessionCreatePost(
    "admin",
    makeDemoPostInput(),
    { repository: repo, env: MISCONFIGURED_DEMO_ENV },
  );
  assert.equal(misconfiguredPost.status, 503);
  assert.equal(
    ((await misconfiguredPost.json()) as { error: { code: string } }).error
      .code,
    "DEMO_MODE_MISCONFIGURED",
  );
});

test("Firebase Authentication remains fully functional and rejects reserved synthetic demo UIDs on Bearer path", async () => {
  const repo = createDemoTestRepository();

  const verifyRealFirebase: VerifyTokenFn = async () =>
    ({
      uid: "firebase-real-nurse-01",
      email: "real.nurse@medflow.synthetic",
      emailVerified: true,
      displayName: "Real Firebase Nurse",
      authTime: 1_763_812_000,
      expiresAt: 1_763_815_600,
      projectId: "daring-brace-jw1xt",
    }) satisfies VerifiedStaffToken;

  const session = await resolveStaffSession({
    authorizationHeader: "Bearer real-firebase-jwt",
    cookieHeader: null,
    verifyToken: verifyRealFirebase,
    repository: repo,
    env: ENABLED_DEMO_ENV,
  });
  assert.equal(session.status, "authorized");
  assert.equal(session.authMode, "firebase");
  assert.equal(session.demoPersona, null);
  assert.equal(session.staffProfile.uid, "firebase-real-nurse-01");

  // Reserved synthetic demo UID presented on a Firebase Bearer token must be rejected.
  const verifySpoofedDemoUid: VerifyTokenFn = async () =>
    ({
      uid: "demo-admin-01",
      email: "spoof@example.com",
      emailVerified: true,
      displayName: "Spoof",
      authTime: 1_763_812_000,
      expiresAt: 1_763_815_600,
      projectId: "daring-brace-jw1xt",
    }) satisfies VerifiedStaffToken;

  await assert.rejects(
    () =>
      requireAuthorizedStaff({
        authorizationHeader: "Bearer spoofed-firebase-jwt",
        cookieHeader: null,
        verifyToken: verifySpoofedDemoUid,
        repository: repo,
        env: ENABLED_DEMO_ENV,
      }),
    (err: unknown) => {
      assert.ok(err instanceof StaffAuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorCode, "RESERVED_DEMO_UID");
      return true;
    },
  );
});

test("Cookie security helper sets Secure; SameSite=None; Partitioned in HTTPS/production and SameSite=Lax on local HTTP", () => {
  const prodCtx = resolveDemoCookieSecurityContext({
    url: "https://medflow.run.app/api/demo/session/admin",
    forwardedProto: "https",
    nodeEnv: "production",
  });
  const prodSet = buildDemoSessionSetCookieHeader("tok-123", 3600, prodCtx);
  assert.match(prodSet, /HttpOnly/);
  assert.match(prodSet, /Secure/);
  assert.match(prodSet, /SameSite=None/);
  assert.match(prodSet, /Partitioned/);
  assert.match(prodSet, /Max-Age=3600/);

  const prodClear = buildDemoSessionClearCookieHeader(prodCtx);
  assert.match(prodClear, /Max-Age=0/);
  assert.match(prodClear, /Secure/);

  const localDevCtx = resolveDemoCookieSecurityContext({
    url: "http://localhost:3000/api/demo/session/admin",
    forwardedProto: "http",
    nodeEnv: "development",
  });
  const localSet = buildDemoSessionSetCookieHeader("tok-123", 3600, localDevCtx);
  assert.match(localSet, /HttpOnly/);
  assert.match(localSet, /SameSite=Lax/);
  assert.doesNotMatch(localSet, /Secure/);

  assert.equal(
    extractDemoSessionCookie(
      `other=1; ${DEMO_SESSION_COOKIE_NAME}=v1.abc.def; theme=light`,
    ),
    "v1.abc.def",
  );
  assert.equal(extractDemoSessionCookie("other=1"), null);
});
