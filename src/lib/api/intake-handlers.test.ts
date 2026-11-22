import test from "node:test";
import assert from "node:assert/strict";
import {
  handleCreatePatientIntakePost,
  handleExtractIntakeBriefPost,
  handleTranscribePatientAudioPost,
} from "./intake-handlers";
import type {
  CreatedPatientIntakeResult,
  IntakeForExtractionRecord,
  StaffAuthorizationRecord,
  StaffRepository,
} from "@/lib/db/staff-repository";
import {
  TokenVerificationError,
  type VerifiedStaffToken,
} from "@/lib/firebase/admin-auth";
import type { VerifyTokenFn } from "@/lib/auth/staff-authorization";
import type { ClinicalIntakeBrief } from "@/lib/schemas/intake";

const FIXED_NOW = new Date("2026-11-22T12:00:00.000Z");
const INTAKE_UUID = "00000000-0000-4000-8000-000000000199";

const SAMPLE_BRIEF: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value: "Sharp chest tightness",
    sourceQuote: "sharp chest tightness",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Chest tightness for two hours",
      sourceQuote: "sharp chest tightness for about two hours",
      certainty: "explicit",
      duration: "about two hours",
      severity: null,
    },
  ],
  relevantContext: [],
  reportedDetailsToReview: [],
  missingOrUnclear: ["Medication list not provided"],
  clinicianSummary: "Patient reports sharp chest tightness for two hours.",
  limitations: [
    "Non-authoritative AI draft; requires qualified clinical staff review.",
  ],
};

const VERIFIED_NURSE_TOKEN: VerifiedStaffToken = {
  uid: "staff-nurse-01",
  email: "nurse.demo@medflow.synthetic",
  emailVerified: true,
  displayName: "Nurse Demo",
  authTime: 1_763_812_000,
  expiresAt: 1_763_815_600,
  projectId: "daring-brace-jw1xt",
};

const verifyNurseToken: VerifyTokenFn = async (header) => {
  if (!header || !header.startsWith("Bearer ")) {
    throw new TokenVerificationError(
      401,
      "MISSING_OR_INVALID_AUTH_HEADER",
      "A valid Authorization header is required.",
    );
  }
  return VERIFIED_NURSE_TOKEN;
};

const NURSE_AUTH_RECORD: StaffAuthorizationRecord = {
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

const ADMIN_AUTH_RECORD: StaffAuthorizationRecord = {
  profile: {
    uid: "staff-admin-01",
    email: "admin.demo@medflow.synthetic",
    displayName: "Admin Demo",
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

function createMockRepository(
  overrides: Partial<StaffRepository> = {},
): StaffRepository {
  const defaultCreated: CreatedPatientIntakeResult = {
    id: INTAKE_UUID,
    facilityId: "demo-clinic-01",
    facilityPublicCode: "DEMO-CLINIC-01",
    referenceCode: "MF-1099",
    workflowStatus: "new",
    aiStatus: "queued",
    confirmedNarrative:
      "I have had sharp chest tightness for about two hours after walking upstairs.",
    inputMode: "typed",
    age: 45,
    createdAt: FIXED_NOW.toISOString(),
    deduplicated: false,
  };

  return {
    async findStaffAuthorizationByUid() {
      return NURSE_AUTH_RECORD;
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
    async createPatientIntake() {
      return { ok: true, data: defaultCreated };
    },
    async findIntakeForExtraction(intakeId, facilityId) {
      if (facilityId === "demo-clinic-01" && intakeId === INTAKE_UUID) {
        return {
          id: INTAKE_UUID,
          facilityId: "demo-clinic-01",
          referenceCode: "MF-1099",
          confirmedNarrative:
            "I have had sharp chest tightness for about two hours after walking upstairs.",
          age: 45,
          inputMode: "typed",
          aiStatus: "failed",
          aiModelId: "gemini-4-hydrogen",
          aiBrief: null,
          aiErrorCode: "GEMINI_UNEXPECTED_ERROR",
          updatedAt: FIXED_NOW.toISOString(),
        };
      }
      return null;
    },
    async recordIntakeExtractionResult(params): Promise<IntakeForExtractionRecord> {
      return {
        id: params.intakeId,
        facilityId: params.facilityId,
        referenceCode: "MF-1099",
        confirmedNarrative:
          "I have had sharp chest tightness for about two hours after walking upstairs.",
        inputMode: "typed",
        age: 45,
        aiStatus: params.aiStatus,
        aiModelId: params.aiModelId,
        aiBrief: params.aiBrief,
        aiErrorCode: params.aiErrorCode,
        updatedAt: FIXED_NOW.toISOString(),
      };
    },
    ...overrides,
  };
}

test("POST /api/intakes persists patient intake before Gemini extraction and returns 201 receipt", async () => {
  let extractionRecorded = false;
  const repo = createMockRepository({
    async recordIntakeExtractionResult(params) {
      extractionRecorded = true;
      assert.equal(params.intakeId, INTAKE_UUID);
      assert.equal(params.aiStatus, "succeeded");
      assert.equal(params.aiBrief?.chiefConcern.value, "Sharp chest tightness");
      return {
        id: params.intakeId,
        facilityId: params.facilityId,
        referenceCode: "MF-1099",
        confirmedNarrative:
          "I have had sharp chest tightness for about two hours after walking upstairs.",
        inputMode: "typed",
        age: 45,
        aiStatus: "succeeded",
        aiModelId: params.aiModelId,
        aiBrief: params.aiBrief,
        aiErrorCode: null,
        updatedAt: FIXED_NOW.toISOString(),
      };
    },
  });

  const req = new Request("http://localhost:3000/api/intakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facilityPublicCode: "DEMO-CLINIC-01",
      idempotencyKey: "idem-key-12345678",
      patientDisplayName: "Synthetic Patient Test",
      age: 45,
      inputMode: "typed",
      confirmedNarrative:
        "I have had sharp chest tightness for about two hours after walking upstairs.",
    }),
  });

  const res = await handleCreatePatientIntakePost(req, {
    repository: repo,
    extractBrief: async () => ({
      aiStatus: "succeeded",
      aiModelId: "gemini-4-hydrogen",
      aiSchemaVersion: "1.0",
      aiBrief: SAMPLE_BRIEF,
      aiErrorCode: null,
    }),
  });

  assert.equal(res.status, 201);
  assert.equal(extractionRecorded, true);
  const body = (await res.json()) as {
    intakeId: string;
    referenceCode: string;
    facilityPublicCode: string;
    aiStatus: string;
    deduplicated: boolean;
  };
  assert.equal(body.intakeId, INTAKE_UUID);
  assert.equal(body.referenceCode, "MF-1099");
  assert.equal(body.facilityPublicCode, "DEMO-CLINIC-01");
  assert.equal(body.aiStatus, "succeeded");
  assert.equal(body.deduplicated, false);
});

test("POST /api/intakes preserves persisted intake (201, aiStatus=failed) even when Gemini extraction throws", async () => {
  const req = new Request("http://localhost:3000/api/intakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facilityPublicCode: "DEMO-CLINIC-01",
      idempotencyKey: "idem-key-failure-test",
      inputMode: "typed",
      confirmedNarrative:
        "I have had sharp chest tightness for about two hours after walking upstairs.",
    }),
  });

  const res = await handleCreatePatientIntakePost(req, {
    repository: createMockRepository(),
    extractBrief: async () => {
      throw new Error("Simulated upstream Gemini network timeout");
    },
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    intakeId: string;
    aiStatus: string;
  };
  assert.equal(body.intakeId, INTAKE_UUID);
  assert.equal(body.aiStatus, "failed");
});

test("POST /api/intakes returns 200 without re-extracting on deduplicated idempotent retry", async () => {
  let extractCalled = false;
  const req = new Request("http://localhost:3000/api/intakes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facilityPublicCode: "DEMO-CLINIC-01",
      idempotencyKey: "idem-key-dedup-test",
      inputMode: "typed",
      confirmedNarrative:
        "I have had sharp chest tightness for about two hours after walking upstairs.",
    }),
  });

  const res = await handleCreatePatientIntakePost(req, {
    repository: createMockRepository({
      async createPatientIntake() {
        return {
          ok: true,
          data: {
            id: INTAKE_UUID,
            facilityId: "demo-clinic-01",
            facilityPublicCode: "DEMO-CLINIC-01",
            referenceCode: "MF-1099",
            workflowStatus: "new",
            aiStatus: "succeeded",
            confirmedNarrative:
              "I have had sharp chest tightness for about two hours after walking upstairs.",
            inputMode: "typed",
            age: 45,
            createdAt: FIXED_NOW.toISOString(),
            deduplicated: true,
          },
        };
      },
    }),
    extractBrief: async () => {
      extractCalled = true;
      throw new Error("Should not be called on deduplicated intake");
    },
  });

  assert.equal(res.status, 200);
  assert.equal(extractCalled, false);
});

test("POST /api/intakes/transcribe validates audio payload and returns transcribed narrative", async () => {
  const req = new Request("http://localhost:3000/api/intakes/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mimeType: "audio/webm;codecs=opus",
      audioBase64: Buffer.from("synthetic-voice-sample").toString("base64"),
    }),
  });

  const res = await handleTranscribePatientAudioPost(req, {
    transcribeAudio: async () => ({
      transcriptRaw:
        "Abeg, my head dey pound since yesterday and my body hot.",
      transcriptionModel: "gemini-3.5-transcribe",
      languageDetected: "en-NG",
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    transcriptRaw: string;
    transcriptionModel: string;
  };
  assert.match(body.transcriptRaw, /my head dey pound/);
  assert.equal(body.transcriptionModel, "gemini-3.5-transcribe");
});

test("POST /api/intakes/[intakeId]/extract allows clinical staff to retry extraction and blocks admin role with 403", async () => {
  const nurseReq = new Request(
    `http://localhost:3000/api/intakes/${INTAKE_UUID}/extract`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer nurse-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ facilityId: "demo-clinic-01" }),
    },
  );

  const nurseRes = await handleExtractIntakeBriefPost(
    nurseReq,
    { intakeId: INTAKE_UUID },
    {
      verifyToken: verifyNurseToken,
      repository: createMockRepository(),
      extractBrief: async () => ({
        aiStatus: "succeeded",
        aiModelId: "gemini-4-hydrogen",
        aiSchemaVersion: "1.0",
        aiBrief: SAMPLE_BRIEF,
        aiErrorCode: null,
      }),
      now: () => FIXED_NOW,
    },
  );

  assert.equal(nurseRes.status, 200);
  const nurseBody = (await nurseRes.json()) as {
    intakeId: string;
    aiStatus: string;
    aiModelId: string;
  };
  assert.equal(nurseBody.intakeId, INTAKE_UUID);
  assert.equal(nurseBody.aiStatus, "succeeded");
  assert.equal(nurseBody.aiModelId, "gemini-4-hydrogen");

  // Admin role must be rejected with 403 INSUFFICIENT_STAFF_ROLE
  const adminReq = new Request(
    `http://localhost:3000/api/intakes/${INTAKE_UUID}/extract`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ facilityId: "demo-clinic-01" }),
    },
  );

  const adminRes = await handleExtractIntakeBriefPost(
    adminReq,
    { intakeId: INTAKE_UUID },
    {
      verifyToken: verifyNurseToken,
      repository: createMockRepository({
        async findStaffAuthorizationByUid() {
          return ADMIN_AUTH_RECORD;
        },
      }),
    },
  );

  assert.equal(adminRes.status, 403);
  const adminBody = (await adminRes.json()) as { error: { code: string } };
  assert.equal(adminBody.error.code, "INSUFFICIENT_STAFF_ROLE");
});
