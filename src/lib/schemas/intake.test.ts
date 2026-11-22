import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditEventSchema,
  ClinicalIntakeBriefSchema,
  CreateIntakeRequestSchema,
  isAllowedStatusTransition,
  sortIntakesDeterministically,
} from "./intake";

test("ClinicalIntakeBriefSchema accepts canonical docs/09 fields (symptoms[].value, reportedDetailsToReview[].detail)", () => {
  const validBrief = {
    schemaVersion: "1.0" as const,
    languageDetected: "en",
    chiefConcern: {
      value: "Headache and dizziness",
      sourceQuote: "My head has been paining me since yesterday evening.",
      certainty: "explicit" as const,
    },
    symptoms: [
      {
        value: "Headache",
        duration: "since yesterday evening",
        severity: null,
        sourceQuote: "My head has been paining me since yesterday evening.",
        certainty: "explicit" as const,
      },
    ],
    relevantContext: [],
    reportedDetailsToReview: [
      {
        detail: "Dizziness reported this morning",
        sourceQuote: "I started feeling dizzy this morning.",
        context:
          "Patient-reported detail; clinical significance must be assessed by staff.",
      },
    ],
    missingOrUnclear: ["Severity not stated"],
    clinicianSummary:
      "Patient reports headache since yesterday evening and dizziness this morning.",
    limitations: [
      "AI-generated intake draft — not a diagnosis or clinical urgency decision.",
    ],
  };

  const parsed = ClinicalIntakeBriefSchema.safeParse(validBrief);
  assert.equal(parsed.success, true);
});

test("ClinicalIntakeBriefSchema rejects forbidden clinical authority fields and legacy field names", () => {
  const withDiagnosis = {
    schemaVersion: "1.0",
    chiefConcern: { value: "Headache", certainty: "explicit" },
    symptoms: [],
    relevantContext: [],
    reportedDetailsToReview: [],
    missingOrUnclear: [],
    clinicianSummary: "Summary",
    limitations: ["Draft only"],
    diagnosis: "Migraine",
  };
  assert.equal(ClinicalIntakeBriefSchema.safeParse(withDiagnosis).success, false);

  const withLegacyCueAndName = {
    schemaVersion: "1.0",
    chiefConcern: { value: "Headache", certainty: "explicit" },
    symptoms: [{ name: "Headache", certainty: "explicit" }],
    relevantContext: [],
    reportedDetailsToReview: [
      { cue: "Dizziness", sourceQuote: "dizzy", context: "Reported" },
    ],
    missingOrUnclear: [],
    clinicianSummary: "Summary",
    limitations: ["Draft only"],
  };
  assert.equal(
    ClinicalIntakeBriefSchema.safeParse(withLegacyCueAndName).success,
    false,
  );
});

test("AuditEventSchema enforces three-way actorType rules (patient, staff, system)", () => {
  const patientEvent = AuditEventSchema.safeParse({
    id: "evt-1",
    facilityId: "demo-facility-001",
    intakeId: "intake-1",
    actorType: "patient",
    action: "intake_created",
    createdAt: "2026-11-22T10:00:00.000Z",
  });
  assert.equal(patientEvent.success, true);

  const systemEvent = AuditEventSchema.safeParse({
    id: "evt-2",
    facilityId: "demo-facility-001",
    intakeId: "intake-1",
    actorType: "system",
    action: "ai_completed",
    createdAt: "2026-11-22T10:00:05.000Z",
  });
  assert.equal(systemEvent.success, true);

  const staffEvent = AuditEventSchema.safeParse({
    id: "evt-3",
    facilityId: "demo-facility-001",
    intakeId: "intake-1",
    actorType: "staff",
    actorUid: "uid-nurse-1",
    actorRole: "nurse",
    actorDisplayName: "Nurse A. Bello",
    action: "priority_assigned",
    fromValue: "unassigned",
    toValue: "priority_review",
    reason: "Reviewed confirmed statement and queued for priority assessment.",
    createdAt: "2026-11-22T10:05:00.000Z",
  });
  assert.equal(staffEvent.success, true);

  // Patient or system MUST NOT carry nurse/doctor/admin staff roles
  const invalidPatientWithRole = AuditEventSchema.safeParse({
    id: "evt-4",
    facilityId: "demo-facility-001",
    intakeId: "intake-1",
    actorType: "patient",
    actorRole: "nurse",
    action: "intake_created",
    createdAt: "2026-11-22T10:00:00.000Z",
  });
  assert.equal(invalidPatientWithRole.success, false);

  // Staff MUST provide actorUid and actorRole
  const invalidStaffWithoutRole = AuditEventSchema.safeParse({
    id: "evt-5",
    facilityId: "demo-facility-001",
    intakeId: "intake-1",
    actorType: "staff",
    action: "priority_assigned",
    createdAt: "2026-11-22T10:05:00.000Z",
  });
  assert.equal(invalidStaffWithoutRole.success, false);
});

test("CreateIntakeRequestSchema keeps patient age optional and blocks privileged client fields", () => {
  const withoutAge = CreateIntakeRequestSchema.safeParse({
    facilityPublicCode: "DEMO-FACILITY",
    inputMode: "typed",
    confirmedNarrative: "My head has been paining me since yesterday evening.",
    idempotencyKey: "idem-key-12345678",
  });
  assert.equal(withoutAge.success, true);

  const withOptionalAge = CreateIntakeRequestSchema.safeParse({
    facilityPublicCode: "DEMO-FACILITY",
    patientDisplayName: "T. Adebayo",
    age: 34,
    inputMode: "voice",
    transcriptRaw: "My head has been paining me since yesterday.",
    confirmedNarrative: "My head has been paining me since yesterday evening.",
    idempotencyKey: "idem-key-87654321",
  });
  assert.equal(withOptionalAge.success, true);

  const withForbiddenPriority = CreateIntakeRequestSchema.safeParse({
    facilityPublicCode: "DEMO-FACILITY",
    inputMode: "typed",
    confirmedNarrative: "My head has been paining me since yesterday evening.",
    idempotencyKey: "idem-key-12345678",
    staffAssignedPriority: "immediate_review",
  });
  assert.equal(withForbiddenPriority.success, false);
});

test("isAllowedStatusTransition enforces docs/09 allowed workflow transitions", () => {
  assert.equal(isAllowedStatusTransition("new", "in_review"), true);
  assert.equal(isAllowedStatusTransition("new", "awaiting_clarification"), true);
  assert.equal(isAllowedStatusTransition("new", "completed"), false);
  assert.equal(isAllowedStatusTransition("in_review", "completed"), true);
  assert.equal(
    isAllowedStatusTransition("awaiting_clarification", "completed"),
    true,
  );
  assert.equal(isAllowedStatusTransition("completed", "in_review"), false);
});

test("sortIntakesDeterministically orders Unassigned first, then Immediate, Priority, Routine, oldest first", () => {
  const sorted = sortIntakesDeterministically([
    { id: "r1", staffAssignedPriority: "routine_review", createdAtMs: 100 },
    { id: "p1", staffAssignedPriority: "priority_review", createdAtMs: 200 },
    { id: "u2", staffAssignedPriority: "unassigned", createdAtMs: 300 },
    { id: "i1", staffAssignedPriority: "immediate_review", createdAtMs: 150 },
    { id: "u1", staffAssignedPriority: "unassigned", createdAtMs: 250 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["u1", "u2", "i1", "p1", "r1"],
  );
});
