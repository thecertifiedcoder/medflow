import test from "node:test";
import assert from "node:assert/strict";
import {
  handleStaffBriefReviewPost,
  handleStaffIntakeDetailGet,
  handleStaffPriorityPost,
  handleStaffQueueGet,
  handleStaffSessionGet,
  handleStaffStartReviewPost,
  handleStaffStatusPost,
  parseStaffQueueSearchParams,
} from "./staff-handlers";
import { DatabaseUnavailableError } from "@/lib/db/errors";
import type {
  FacilityIntakeDetailRecord,
  ListFacilityIntakesParams,
  ListFacilityIntakesResult,
  StaffAuthorizationRecord,
  StaffRepository,
} from "@/lib/db/staff-repository";
import {
  TokenVerificationError,
  type VerifiedStaffToken,
} from "@/lib/firebase/admin-auth";
import type { VerifyTokenFn } from "@/lib/auth/staff-authorization";
import type { StaffQueueItem } from "@/lib/schemas/staff-api";

const FIXED_NOW = new Date("2026-11-22T12:00:00.000Z");
const SHA_64 = "a".repeat(64);
const SHA_64_B = "b".repeat(64);
const INTAKE_UUID_1 = "11111111-1111-4111-8111-111111111111";
const INTAKE_UUID_2 = "22222222-2222-4222-8222-222222222222";
const EXTRACTION_RUN_UUID = "33333333-3333-4333-8333-333333333333";
const EVIDENCE_UUID_1 = "44444444-4444-4444-8444-444444444444";
const AUDIT_UUID_1 = "55555555-5555-4555-8555-555555555555";
const AUDIT_UUID_2 = "66666666-6666-4666-8666-666666666666";

const VERIFIED_TOKEN: VerifiedStaffToken = {
  uid: "staff-nurse-01",
  email: "nurse.demo@medflow.synthetic",
  emailVerified: true,
  displayName: "Nurse Demo",
  authTime: 1_763_812_000,
  expiresAt: 1_763_815_600,
  projectId: "daring-brace-jw1xt",
};

const verifyValidToken: VerifyTokenFn = async (header) => {
  if (!header || !header.startsWith("Bearer ")) {
    throw new TokenVerificationError(
      401,
      "MISSING_OR_INVALID_AUTH_HEADER",
      "A valid Authorization: Bearer <Firebase ID token> header is required.",
    );
  }
  return VERIFIED_TOKEN;
};

const AUTHORIZED_STAFF_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "staff-nurse-01",
    email: "nurse.demo@medflow.synthetic",
    displayName: "Nurse Demo",
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

const SAMPLE_QUEUE_ITEMS: readonly StaffQueueItem[] = [
  {
    id: INTAKE_UUID_1,
    facilityId: "demo-clinic-01",
    referenceCode: "MF-1001",
    patientDisplayName: "Synthetic Patient A",
    age: 34,
    inputMode: "voice",
    transcriptionStatus: "succeeded",
    aiStatus: "succeeded",
    staffReviewStatus: "not_reviewed",
    staffAssignedPriority: "unassigned",
    workflowStatus: "new",
    demoRecord: true,
    createdAt: "2026-11-22T11:30:00.000Z",
    updatedAt: "2026-11-22T11:30:05.000Z",
  },
  {
    id: INTAKE_UUID_2,
    facilityId: "demo-clinic-01",
    referenceCode: "MF-1002",
    patientDisplayName: "Synthetic Patient B",
    age: 62,
    inputMode: "typed",
    transcriptionStatus: "not_applicable",
    aiStatus: "failed",
    staffReviewStatus: "not_reviewed",
    staffAssignedPriority: "immediate_review",
    workflowStatus: "in_review",
    demoRecord: true,
    createdAt: "2026-11-22T11:35:00.000Z",
    updatedAt: "2026-11-22T11:36:00.000Z",
  },
];

const SAMPLE_DETAIL_RECORD: FacilityIntakeDetailRecord = {
  intake: {
    id: INTAKE_UUID_1,
    facilityId: "demo-clinic-01",
    referenceCode: "MF-1001",
    demoRecord: true,
    patientDisplayName: "Synthetic Patient A",
    age: 34,
    patientSource: {
      inputMode: "voice",
      transcriptionStatus: "succeeded",
      transcriptionModel: "gemini-2.5-flash",
      transcriptRaw: "I have had sharp chest tightness for about two hours.",
      confirmedNarrative:
        "I have had sharp chest tightness for about two hours after walking upstairs.",
      confirmedNarrativeSha256: SHA_64,
      transcriptConfirmedAt: "2026-11-22T11:29:50.000Z",
    },
    aiDraft: {
      status: "succeeded",
      schemaVersion: "1.0",
      modelId: "gemini-2.5-flash",
      brief: {
        schemaVersion: "1.0",
        languageDetected: "en",
        chiefConcern: {
          value: "Sharp chest tightness",
          sourceQuote: "sharp chest tightness",
          certainty: "explicit",
        },
        symptoms: [
          {
            value: "Chest tightness after exertion",
            sourceQuote: "sharp chest tightness for about two hours",
            certainty: "explicit",
            duration: "2 hours",
            severity: null,
          },
        ],
        relevantContext: [
          {
            value: "Onset after walking upstairs",
            sourceQuote: "after walking upstairs",
            certainty: "explicit",
          },
        ],
        reportedDetailsToReview: [
          {
            detail: "Exertional chest tightness",
            sourceQuote: "sharp chest tightness for about two hours",
            context: "Reported directly by synthetic patient",
          },
        ],
        missingOrUnclear: ["Medication history not stated"],
        clinicianSummary:
          "Synthetic patient reports 2 hours of sharp chest tightness following stair climbing.",
        limitations: [
          "Non-authoritative AI intake draft; requires qualified clinical staff review.",
        ],
      },
      provenance: {
        intakeId: INTAKE_UUID_1,
        narrativeSha256: SHA_64,
        draftAndEvidenceSha256: SHA_64_B,
        modelId: "gemini-2.5-flash",
        extractionSchemaVersion: "1.0",
        evidenceEngineVersion: "eie-1.0.0",
        createdAt: "2026-11-22T11:30:05.000Z",
        hmacSha256: "placeholder-hmac",
      },
      errorCode: null,
    },
    staffReview: {
      status: "corrected",
      reviewedBrief: {
        schemaVersion: "1.0",
        chiefConcern: {
          value: "Chest tightness on exertion (staff reviewed)",
          sourceQuote: "sharp chest tightness",
          certainty: "explicit",
        },
        symptoms: [],
        relevantContext: [],
        reportedDetailsToReview: [],
        missingOrUnclear: ["Vital signs pending nurse assessment"],
        clinicianSummary:
          "Nurse-reviewed copy preserving separate patient narrative and AI draft.",
        limitations: ["Reviewed by nurse on duty."],
      },
      correctionNote: "Clarified onset trigger during bedside check-in.",
      reviewedByUid: "staff-nurse-01",
      reviewedAt: "2026-11-22T11:45:00.000Z",
    },
    workflow: {
      staffAssignedPriority: "immediate_review",
      priorityReason: "Nurse prioritized due to reported chest tightness.",
      workflowStatus: "in_review",
    },
    createdAt: "2026-11-22T11:30:00.000Z",
    updatedAt: "2026-11-22T11:45:00.000Z",
  },
  evidence: [
    {
      id: EVIDENCE_UUID_1,
      intakeId: INTAKE_UUID_1,
      facilityId: "demo-clinic-01",
      extractionRunId: EXTRACTION_RUN_UUID,
      isCurrent: true,
      fieldCategory: "chief_concern",
      fieldPath: "chiefConcern",
      claimValue: "Sharp chest tightness",
      certainty: "explicit",
      sourceQuote: "sharp chest tightness",
      verificationStatus: "exact_quote_match",
      spanStart: 11,
      spanEnd: 32,
      engineVersion: "eie-1.0.0",
      narrativeSha256: SHA_64,
      createdAt: "2026-11-22T11:30:05.000Z",
    },
  ],
  auditEvents: [
    {
      id: AUDIT_UUID_1,
      facilityId: "demo-clinic-01",
      intakeId: INTAKE_UUID_1,
      actorType: "patient",
      actorUid: null,
      actorRole: null,
      actorDisplayName: null,
      action: "intake_created",
      fromValue: null,
      toValue: "new",
      reason: null,
      createdAt: "2026-11-22T11:30:00.000Z",
    },
    {
      id: AUDIT_UUID_2,
      facilityId: "demo-clinic-01",
      intakeId: INTAKE_UUID_1,
      actorType: "staff",
      actorUid: "staff-nurse-01",
      actorRole: "nurse",
      actorDisplayName: "Nurse Demo",
      action: "priority_assigned",
      fromValue: "unassigned",
      toValue: "immediate_review",
      reason: "Nurse prioritized due to reported chest tightness.",
      createdAt: "2026-11-22T11:45:00.000Z",
    },
  ],
};

function createRepository(overrides: Partial<StaffRepository> = {}): StaffRepository {
  return {
    async findStaffAuthorizationByUid() {
      return AUTHORIZED_STAFF_RECORD;
    },
    async listFacilityIntakes(): Promise<ListFacilityIntakesResult> {
      return {
        items: SAMPLE_QUEUE_ITEMS,
        total: SAMPLE_QUEUE_ITEMS.length,
        unassignedCount: 1,
        aiUnavailableCount: 1,
      };
    },
    async findFacilityIntakeDetail(facilityId, intakeId) {
      if (facilityId === "demo-clinic-01" && intakeId === INTAKE_UUID_1) {
        return SAMPLE_DETAIL_RECORD;
      }
      return null;
    },
    ...overrides,
  };
}

// =============================================================================
// GET /api/staff/session
// =============================================================================

test("GET /api/staff/session returns authorized PostgreSQL RBAC session with Cache-Control: no-store", async () => {
  const res = await handleStaffSessionGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository(),
    },
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.authorizationModel, "neon_postgres_server_rbac");
  assert.equal(body.authorizationStatus, "authorized");
  assert.equal(
    (body.activeFacility as { facilityId: string }).facilityId,
    "demo-clinic-01",
  );
  assert.equal((body.staffProfile as { role: string }).role, "nurse");
});

test("GET /api/staff/session cleanly distinguishes unprovisioned and inactive accounts", async () => {
  const unprovisionedRes = await handleStaffSessionGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository({
        async findStaffAuthorizationByUid() {
          return null;
        },
      }),
    },
  );
  assert.equal(unprovisionedRes.status, 200);
  const unprovisionedBody = (await unprovisionedRes.json()) as Record<
    string,
    unknown
  >;
  assert.equal(unprovisionedBody.authorizationStatus, "unprovisioned");
  assert.equal(unprovisionedBody.staffProfile, null);

  const inactiveRes = await handleStaffSessionGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository({
        async findStaffAuthorizationByUid() {
          return {
            profile: { ...AUTHORIZED_STAFF_RECORD.profile, active: false },
            memberships: [],
          };
        },
      }),
    },
  );
  assert.equal(inactiveRes.status, 200);
  const inactiveBody = (await inactiveRes.json()) as Record<string, unknown>;
  assert.equal(inactiveBody.authorizationStatus, "inactive");
  assert.equal(inactiveBody.activeFacility, null);
});

test("GET /api/staff/session rejects malformed facilityId with 400 and missing auth with 401", async () => {
  const badFacilityRes = await handleStaffSessionGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams("facilityId=bad/facility;drop"),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository(),
    },
  );
  assert.equal(badFacilityRes.status, 400);
  assert.equal(badFacilityRes.headers.get("cache-control"), "no-store");

  const unauthRes = await handleStaffSessionGet(
    {
      authorizationHeader: null,
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository(),
    },
  );
  assert.equal(unauthRes.status, 401);
});

// =============================================================================
// GET /api/staff/intakes
// =============================================================================

test("GET /api/staff/intakes scopes queries to verified facility and returns minimal queue fields only", async () => {
  let capturedParams: ListFacilityIntakesParams | null = null;
  const repo = createRepository({
    async listFacilityIntakes(params) {
      capturedParams = params;
      return {
        items: SAMPLE_QUEUE_ITEMS,
        total: 3,
        unassignedCount: 1,
        aiUnavailableCount: 1,
      };
    },
  });

  const res = await handleStaffQueueGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams(
        "workflowStatus=new&priority=unassigned&limit=2&offset=0",
      ),
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(capturedParams, {
    facilityId: "demo-clinic-01",
    workflowStatus: "new",
    priority: "unassigned",
    includeCompleted: false,
    limit: 2,
    offset: 0,
  });

  const body = (await res.json()) as {
    items: Record<string, unknown>[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    counts: { unassigned: number; aiUnavailable: number };
    fetchedAt: string;
  };
  assert.equal(body.items.length, 2);
  assert.equal(body.pagination.total, 3);
  assert.equal(body.pagination.hasMore, true);
  assert.equal(body.counts.unassigned, 1);
  assert.equal(body.counts.aiUnavailable, 1);
  assert.equal(body.fetchedAt, FIXED_NOW.toISOString());

  // Queue projection must exclude full patient narrative, raw transcript, and briefs.
  for (const item of body.items) {
    assert.equal("confirmedNarrative" in item, false);
    assert.equal("transcriptRaw" in item, false);
    assert.equal("aiBrief" in item, false);
    assert.equal("staffReviewedBrief" in item, false);
  }
});

test("GET /api/staff/intakes handles empty queue cleanly", async () => {
  const res = await handleStaffQueueGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository({
        async listFacilityIntakes() {
          return {
            items: [],
            total: 0,
            unassignedCount: 0,
            aiUnavailableCount: 0,
          };
        },
      }),
      now: () => FIXED_NOW,
    },
  );

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    items: unknown[];
    pagination: { total: number; hasMore: boolean };
    counts: { unassigned: number; aiUnavailable: number };
  };
  assert.deepEqual(body.items, []);
  assert.equal(body.pagination.total, 0);
  assert.equal(body.pagination.hasMore, false);
  assert.equal(body.counts.unassigned, 0);
  assert.equal(body.counts.aiUnavailable, 0);
});

test("GET /api/staff/intakes denies cross-facility queue requests with 403 and never queries unauthorized tenant", async () => {
  let listCalled = false;
  const repo = createRepository({
    async listFacilityIntakes() {
      listCalled = true;
      return {
        items: [],
        total: 0,
        unassignedCount: 0,
        aiUnavailableCount: 0,
      };
    },
  });

  const res = await handleStaffQueueGet(
    {
      authorizationHeader: "Bearer good-token",
      searchParams: new URLSearchParams("facilityId=other-clinic-99"),
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "FACILITY_ACCESS_DENIED");
  assert.equal(listCalled, false);
});

test("parseStaffQueueSearchParams and GET /api/staff/intakes reject malformed or unsupported query params with 400", async () => {
  const invalidQueries = [
    "limit=abc",
    "limit=0",
    "limit=500",
    "offset=-5",
    "workflowStatus=invalid_status",
    "priority=red_triage",
    "includeCompleted=yes",
    "unknownParam=1",
    "facilityId=../../etc",
  ];

  for (const qs of invalidQueries) {
    const parsed = parseStaffQueueSearchParams(new URLSearchParams(qs));
    assert.equal(parsed.ok, false, `Expected "${qs}" to be rejected`);

    const res = await handleStaffQueueGet(
      {
        authorizationHeader: "Bearer good-token",
        searchParams: new URLSearchParams(qs),
      },
      {
        verifyToken: verifyValidToken,
        repository: createRepository(),
      },
    );
    assert.equal(res.status, 400, `Expected HTTP 400 for "${qs}"`);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "INVALID_QUERY_PARAMS");
  }
});

// =============================================================================
// GET /api/staff/intakes/[intakeId]
// =============================================================================

test("GET /api/staff/intakes/[intakeId] returns separated patient narrative, AI draft, EIE evidence, staff review, and audit events", async () => {
  const res = await handleStaffIntakeDetailGet(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      searchParams: new URLSearchParams("facilityId=demo-clinic-01"),
    },
    {
      verifyToken: verifyValidToken,
      repository: createRepository(),
      now: () => FIXED_NOW,
    },
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = (await res.json()) as {
    intake: {
      patientSource: { confirmedNarrative: string; confirmedNarrativeSha256: string };
      aiDraft: { status: string; brief: { chiefConcern: { value: string } } };
      staffReview: { status: string; reviewedBrief: { chiefConcern: { value: string } } };
      workflow: { staffAssignedPriority: string };
    };
    evidence: Array<{ verificationStatus: string; spanStart: number; spanEnd: number }>;
    auditEvents: Array<{ action: string; actorType: string }>;
  };

  assert.equal(
    body.intake.patientSource.confirmedNarrative,
    SAMPLE_DETAIL_RECORD.intake.patientSource.confirmedNarrative,
  );
  assert.equal(body.intake.patientSource.confirmedNarrativeSha256, SHA_64);
  // AI draft and staff-reviewed copy remain distinctly separated.
  assert.notEqual(
    body.intake.aiDraft.brief.chiefConcern.value,
    body.intake.staffReview.reviewedBrief.chiefConcern.value,
  );
  assert.equal(body.intake.workflow.staffAssignedPriority, "immediate_review");
  assert.equal(body.evidence.length, 1);
  const firstEvidence = body.evidence[0];
  assert.ok(firstEvidence);
  assert.equal(firstEvidence.verificationStatus, "exact_quote_match");
  assert.equal(firstEvidence.spanStart, 11);
  assert.equal(firstEvidence.spanEnd, 32);
  assert.equal(body.auditEvents.length, 2);
  assert.equal(body.auditEvents[0]?.actorType, "patient");
  assert.equal(body.auditEvents[1]?.actorType, "staff");
});

test("GET /api/staff/intakes/[intakeId] returns 400 on malformed intakeId before touching auth or database", async () => {
  let dbTouched = false;
  const repo = createRepository({
    async findStaffAuthorizationByUid() {
      dbTouched = true;
      return AUTHORIZED_STAFF_RECORD;
    },
  });

  for (const badId of ["not-a-uuid", "12345", "../etc/passwd"]) {
    const res = await handleStaffIntakeDetailGet(
      {
        authorizationHeader: "Bearer good-token",
        intakeId: badId,
        searchParams: new URLSearchParams(),
      },
      {
        verifyToken: verifyValidToken,
        repository: repo,
      },
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "INVALID_INTAKE_ID");
  }
  assert.equal(dbTouched, false);
});

test("GET /api/staff/intakes/[intakeId] returns identical safe 404 for missing and cross-facility intakes without existence oracle", async () => {
  const facilityScopedLookups: Array<{ facilityId: string; intakeId: string }> =
    [];
  const repo = createRepository({
    async findFacilityIntakeDetail(facilityId, intakeId) {
      facilityScopedLookups.push({ facilityId, intakeId });
      // Suppose INTAKE_UUID_2 exists in "other-clinic-99" only; scoped query for demo-clinic-01 returns null.
      if (facilityId === "other-clinic-99" && intakeId === INTAKE_UUID_2) {
        return SAMPLE_DETAIL_RECORD;
      }
      return null;
    },
  });

  const crossFacilityLookupRes = await handleStaffIntakeDetailGet(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_2,
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );

  const nonExistentLookupRes = await handleStaffIntakeDetailGet(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: "99999999-9999-4999-8999-999999999999",
      searchParams: new URLSearchParams(),
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );

  assert.equal(crossFacilityLookupRes.status, 404);
  assert.equal(nonExistentLookupRes.status, 404);
  assert.deepEqual(
    await crossFacilityLookupRes.json(),
    await nonExistentLookupRes.json(),
  );
  // Repository was strictly queried with the caller's authorized facility only.
  assert.deepEqual(
    facilityScopedLookups.map((entry) => entry.facilityId),
    ["demo-clinic-01", "demo-clinic-01"],
  );

  // Explicit cross-facility query parameter returns 403 FACILITY_ACCESS_DENIED.
  const explicitCrossTenantRes = await handleStaffIntakeDetailGet(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_2,
      searchParams: new URLSearchParams("facilityId=other-clinic-99"),
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );
  assert.equal(explicitCrossTenantRes.status, 403);
  const crossBody = (await explicitCrossTenantRes.json()) as {
    error: { code: string };
  };
  assert.equal(crossBody.error.code, "FACILITY_ACCESS_DENIED");
});

// =============================================================================
// Safe Database Failure Masking (No Connection Strings / SQL / Internals Leaked)
// =============================================================================

test("Staff API routes return safe 503/500 responses without exposing DATABASE_URL, SQL, or pg driver details", async () => {
  const missingDbUrlError = new Error(
    "DATABASE_URL is not configured for postgresql://secret_user:secret_pass@ep-cool-host.neon.tech/medflow",
  );
  const pgConnRefused = Object.assign(
    new Error("connect ECONNREFUSED 10.0.0.1:5432 SELECT * FROM patient_intakes"),
    { code: "ECONNREFUSED" },
  );
  const unexpectedSqlError = new Error(
    'relation "patient_intakes" syntax error near SELECT * FROM staff_profiles WHERE uid = $1',
  );

  const cases: Array<{
    err: unknown;
    expectedStatus: number;
    expectedCode: string;
  }> = [
    {
      err: missingDbUrlError,
      expectedStatus: 503,
      expectedCode: "DATABASE_UNAVAILABLE",
    },
    {
      err: new DatabaseUnavailableError(),
      expectedStatus: 503,
      expectedCode: "DATABASE_UNAVAILABLE",
    },
    {
      err: pgConnRefused,
      expectedStatus: 503,
      expectedCode: "DATABASE_UNAVAILABLE",
    },
    {
      err: unexpectedSqlError,
      expectedStatus: 500,
      expectedCode: "DATABASE_QUERY_FAILED",
    },
  ];

  for (const testCase of cases) {
    const failingRepo = createRepository({
      async listFacilityIntakes() {
        throw testCase.err;
      },
    });

    const res = await handleStaffQueueGet(
      {
        authorizationHeader: "Bearer good-token",
        searchParams: new URLSearchParams(),
      },
      {
        verifyToken: verifyValidToken,
        repository: failingRepo,
      },
    );

    assert.equal(res.status, testCase.expectedStatus);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const rawText = await res.text();
    const parsed = JSON.parse(rawText) as {
      error: { code: string; message: string };
    };
    assert.equal(parsed.error.code, testCase.expectedCode);
    assert.doesNotMatch(
      rawText,
      /postgresql:\/\/|secret_pass|neon\.tech|SELECT \*|ECONNREFUSED|patient_intakes|staff_profiles/i,
    );
  }
});

// =============================================================================
// Milestone 2 Clinical Staff Mutations (Review, Brief Review, Priority, Status)
// =============================================================================

test("POST /api/staff/intakes/[intakeId]/review starts clinical review for nurse and blocks admin role with 403", async () => {
  const repo = createRepository({
    async startStaffIntakeReview(params) {
      assert.equal(params.facilityId, "demo-clinic-01");
      assert.equal(params.intakeId, INTAKE_UUID_1);
      assert.equal(params.actorUid, "staff-nurse-01");
      return { ok: true, data: SAMPLE_DETAIL_RECORD };
    },
  });

  const res = await handleStaffStartReviewPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: { facilityId: "demo-clinic-01" },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );
  assert.equal(res.status, 200);

  // Admin role is blocked from clinical mutations with 403 INSUFFICIENT_STAFF_ROLE
  const adminRepo = createRepository({
    async findStaffAuthorizationByUid() {
      return {
        profile: {
          uid: "demo-admin-01",
          email: "demo.admin@medflow.synthetic",
          displayName: "Demo Administrator",
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
    },
  });

  const adminRes = await handleStaffStartReviewPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: {},
    },
    {
      verifyToken: verifyValidToken,
      repository: adminRepo,
    },
  );
  assert.equal(adminRes.status, 403);
  const adminBody = (await adminRes.json()) as { error: { code: string } };
  assert.equal(adminBody.error.code, "INSUFFICIENT_STAFF_ROLE");
});

test("POST /api/staff/intakes/[intakeId]/brief-review supports confirming AI brief and saving corrected staff copy with mandatory note", async () => {
  let savedAction: string | null = null;
  const repo = createRepository({
    async saveStaffBriefReview(params) {
      savedAction = params.action;
      return { ok: true, data: SAMPLE_DETAIL_RECORD };
    },
  });

  const confirmRes = await handleStaffBriefReviewPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: { action: "confirm" },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );
  assert.equal(confirmRes.status, 200);
  assert.equal(savedAction, "confirm");

  // Corrected action without valid correctionNote must be rejected with 400
  const invalidCorrectRes = await handleStaffBriefReviewPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: {
        action: "correct",
        reviewedBrief: SAMPLE_DETAIL_RECORD.intake.staffReview.reviewedBrief,
        correctionNote: "no",
      },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );
  assert.equal(invalidCorrectRes.status, 400);

  const validCorrectRes = await handleStaffBriefReviewPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: {
        action: "correct",
        reviewedBrief: SAMPLE_DETAIL_RECORD.intake.staffReview.reviewedBrief,
        correctionNote: "Clarified onset trigger during bedside check-in.",
      },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );
  assert.equal(validCorrectRes.status, 200);
  assert.equal(savedAction, "correct");
});

test("POST /api/staff/intakes/[intakeId]/priority and /status enforce domain mutation rules cleanly", async () => {
  const repo = createRepository({
    async assignOrUpdateStaffPriority(params) {
      if (!params.reason) {
        return {
          ok: false,
          status: 400,
          code: "PRIORITY_CHANGE_REASON_REQUIRED",
          message:
            "Changing an already-assigned operational priority requires an explicit clinical or operational reason.",
        };
      }
      return { ok: true, data: SAMPLE_DETAIL_RECORD };
    },
    async updateStaffWorkflowStatus(params) {
      assert.equal(params.workflowStatus, "completed");
      return { ok: true, data: SAMPLE_DETAIL_RECORD };
    },
  });

  const missingReasonRes = await handleStaffPriorityPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: { priority: "priority_review" },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
    },
  );
  assert.equal(missingReasonRes.status, 400);
  const errBody = (await missingReasonRes.json()) as { error: { code: string } };
  assert.equal(errBody.error.code, "PRIORITY_CHANGE_REASON_REQUIRED");

  const validPriorityRes = await handleStaffPriorityPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: {
        priority: "immediate_review",
        reason: "Escalated after nurse bedside check.",
      },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );
  assert.equal(validPriorityRes.status, 200);

  const statusRes = await handleStaffStatusPost(
    {
      authorizationHeader: "Bearer good-token",
      intakeId: INTAKE_UUID_1,
      body: {
        workflowStatus: "completed",
        reason: "Handed off to attending physician.",
      },
    },
    {
      verifyToken: verifyValidToken,
      repository: repo,
      now: () => FIXED_NOW,
    },
  );
  assert.equal(statusRes.status, 200);
});

