import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  AUDIT_ACTION_ACTOR_MAP,
  CANONICAL_DEMO_FACILITY,
  doesAuditActionRequireReason,
  isConsistentStaffReviewState,
  isValidAuditActionForActor,
} from "./invariants";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  intakeEvidence,
  patientIntakes,
  staffProfiles,
} from "./schema";
import { parseOptionalSeedAdminEnv } from "./seed";
import {
  AuditActionSchema,
  AuditActorTypeSchema,
  type AuditAction,
  type AuditActorType,
  type ClinicalIntakeBrief,
} from "../lib/schemas/intake";

const REPO_ROOT = process.cwd();
const INITIAL_SQL = fs.readFileSync(
  path.join(REPO_ROOT, "drizzle", "0000_initial_medflow_schema.sql"),
  "utf8",
);
const TRIGGERS_SQL = fs.readFileSync(
  path.join(REPO_ROOT, "drizzle", "0001_immutability_triggers.sql"),
  "utf8",
);
const JOURNAL = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, "drizzle", "meta", "_journal.json"),
    "utf8",
  ),
) as { entries: Array<{ tag: string }> };
const ENV_EXAMPLE = fs.readFileSync(
  path.join(REPO_ROOT, ".env.example"),
  "utf8",
);

const SYNTHETIC_BRIEF: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  chiefConcern: {
    value: "Headache since yesterday",
    sourceQuote: "My head has been paining me since yesterday",
    certainty: "explicit",
  },
  symptoms: [],
  relevantContext: [],
  reportedDetailsToReview: [],
  missingOrUnclear: ["Severity not stated"],
  clinicianSummary: "Synthetic patient reports headache since yesterday.",
  limitations: ["Draft extraction only; requires staff review."],
};

test("Drizzle schema defines all 6 canonical MedFlow PostgreSQL tables", () => {
  const tableNames = [
    facilities,
    staffProfiles,
    facilityMemberships,
    patientIntakes,
    intakeEvidence,
    auditEvents,
  ].map((t) => getTableConfig(t).name);

  assert.deepEqual(tableNames, [
    "facilities",
    "staff_profiles",
    "facility_memberships",
    "patient_intakes",
    "intake_evidence",
    "audit_events",
  ]);
});

test("Requirement 1: Composite foreign keys enforce facility_id consistency for intake_evidence and audit_events", () => {
  assert.match(
    INITIAL_SQL,
    /CONSTRAINT "patient_intakes_id_facility_id_uq" UNIQUE\("id","facility_id"\)/,
  );
  assert.match(
    INITIAL_SQL,
    /ALTER TABLE "intake_evidence" ADD CONSTRAINT "intake_evidence_intake_facility_fk" FOREIGN KEY \("intake_id","facility_id"\) REFERENCES "public"\."patient_intakes"\("id","facility_id"\) ON DELETE restrict/,
  );
  assert.match(
    INITIAL_SQL,
    /ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_intake_facility_fk" FOREIGN KEY \("intake_id","facility_id"\) REFERENCES "public"\."patient_intakes"\("id","facility_id"\) ON DELETE restrict/,
  );
});

test("Requirement 2: intake_evidence is immutable except one-way is_current true -> false transition", () => {
  assert.match(
    TRIGGERS_SQL,
    /CREATE TRIGGER "intake_evidence_immutability_trg"\s+BEFORE UPDATE OR DELETE ON "public"\."intake_evidence"/,
  );
  assert.match(
    TRIGGERS_SQL,
    /IF TG_OP = 'DELETE' THEN[\s\S]*?RAISE EXCEPTION/,
  );
  assert.match(
    TRIGGERS_SQL,
    /IF NOT \(OLD\.is_current IS TRUE AND NEW\.is_current IS FALSE\) THEN/,
  );
  for (const immutableColumn of [
    "id",
    "intake_id",
    "facility_id",
    "extraction_run_id",
    "field_category",
    "field_path",
    "claim_value",
    "certainty",
    "source_quote",
    "verification_status",
    "span_start",
    "span_end",
    "engine_version",
    "narrative_sha256",
    "created_at",
  ]) {
    assert.ok(
      TRIGGERS_SQL.includes(
        `NEW.${immutableColumn} IS DISTINCT FROM OLD.${immutableColumn}`,
      ),
      `Expected intake_evidence trigger to guard immutable column ${immutableColumn}`,
    );
  }
  assert.match(
    INITIAL_SQL,
    /CREATE UNIQUE INDEX "intake_evidence_current_field_uq" ON "intake_evidence" USING btree \("intake_id","field_path"\) WHERE "intake_evidence"\."is_current" = true;/,
  );
});

test("Requirement 3: Complete action-to-actor mapping is enforced in both TypeScript invariants and PostgreSQL CHECK constraints", () => {
  const allActions = AuditActionSchema.options as readonly AuditAction[];
  const allActors = AuditActorTypeSchema.options as readonly AuditActorType[];

  // Verify every canonical AuditAction is explicitly mapped
  assert.deepEqual(
    Object.keys(AUDIT_ACTION_ACTOR_MAP).sort(),
    [...allActions].sort(),
  );

  // Exhaustively verify all 10 x 3 = 30 (action, actorType) combinations
  const expectedMapping: Record<AuditAction, AuditActorType> = {
    intake_created: "patient",
    transcript_confirmed: "patient",
    ai_completed: "system",
    ai_failed: "system",
    review_started: "staff",
    priority_assigned: "staff",
    priority_changed: "staff",
    status_changed: "staff",
    brief_confirmed: "staff",
    brief_corrected: "staff",
  };

  for (const action of allActions) {
    for (const actorType of allActors) {
      assert.equal(
        isValidAuditActionForActor(action, actorType),
        expectedMapping[action] === actorType,
        `Unexpected mapping result for action=${action}, actorType=${actorType}`,
      );
    }
  }

  // Verify reason requirements
  assert.equal(doesAuditActionRequireReason("priority_changed"), true);
  assert.equal(doesAuditActionRequireReason("brief_corrected"), true);
  assert.equal(doesAuditActionRequireReason("intake_created"), false);
  assert.equal(doesAuditActionRequireReason("ai_completed"), false);
  assert.equal(doesAuditActionRequireReason("priority_assigned"), false);

  // Verify PostgreSQL CHECK constraint mirrors all 10 actions & 3 actor groups
  assert.match(INITIAL_SQL, /CONSTRAINT "audit_events_action_actor_mapping_chk"/);
  assert.match(
    INITIAL_SQL,
    /"audit_events"\."action" IN \('intake_created', 'transcript_confirmed'\)\s+AND "audit_events"\."actor_type" = 'patient'/,
  );
  assert.match(
    INITIAL_SQL,
    /"audit_events"\."action" IN \('ai_completed', 'ai_failed'\)\s+AND "audit_events"\."actor_type" = 'system'/,
  );
  assert.match(
    INITIAL_SQL,
    /'review_started'[\s\S]*?'priority_assigned'[\s\S]*?'priority_changed'[\s\S]*?'status_changed'[\s\S]*?'brief_confirmed'[\s\S]*?'brief_corrected'[\s\S]*?AND "audit_events"\."actor_type" = 'staff'/,
  );
  assert.match(
    INITIAL_SQL,
    /CONSTRAINT "audit_events_actor_identity_chk"/,
  );
  assert.match(
    TRIGGERS_SQL,
    /CREATE TRIGGER "audit_events_append_only_trg"\s+BEFORE UPDATE OR DELETE ON "public"\."audit_events"/,
  );
});

test("Requirement 4: Staff review fields enforce strict internal consistency in TypeScript and PostgreSQL CHECK constraints", () => {
  const now = new Date("2026-11-22T12:00:00.000Z");

  // Valid states
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "not_reviewed",
      staffReviewedBrief: null,
      reviewedByUid: null,
      reviewedAt: null,
      staffCorrectionNote: null,
    }),
    true,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "confirmed",
      staffReviewedBrief: null,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: null,
    }),
    true,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "confirmed",
      staffReviewedBrief: SYNTHETIC_BRIEF,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: null,
    }),
    true,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "corrected",
      staffReviewedBrief: SYNTHETIC_BRIEF,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: "Adjusted symptom onset wording per patient statement.",
    }),
    true,
  );

  // Invalid states
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "not_reviewed",
      staffReviewedBrief: null,
      reviewedByUid: "staff_uid_1",
      reviewedAt: null,
      staffCorrectionNote: null,
    }),
    false,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "not_reviewed",
      staffReviewedBrief: SYNTHETIC_BRIEF,
      reviewedByUid: null,
      reviewedAt: null,
      staffCorrectionNote: null,
    }),
    false,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "confirmed",
      staffReviewedBrief: null,
      reviewedByUid: null,
      reviewedAt: now,
      staffCorrectionNote: null,
    }),
    false,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "confirmed",
      staffReviewedBrief: null,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: "Should not carry correction note when confirmed",
    }),
    false,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "corrected",
      staffReviewedBrief: null,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: "Missing reviewed brief",
    }),
    false,
  );
  assert.equal(
    isConsistentStaffReviewState({
      staffReviewStatus: "corrected",
      staffReviewedBrief: SYNTHETIC_BRIEF,
      reviewedByUid: "staff_uid_1",
      reviewedAt: now,
      staffCorrectionNote: "no",
    }),
    false,
  );

  // PostgreSQL CHECK constraint presence
  assert.match(
    INITIAL_SQL,
    /CONSTRAINT "patient_intakes_staff_review_consistency_chk"/,
  );
  assert.match(
    TRIGGERS_SQL,
    /CREATE TRIGGER "patient_intakes_immutability_trg"\s+BEFORE UPDATE ON "public"\."patient_intakes"/,
  );
});

test("Requirements 5, 6, 7, 8: Canonical demo-clinic-01 identifiers, migration journal, server-only DB vars, and deferred EVIDENCE_HMAC_SECRET", () => {
  assert.equal(CANONICAL_DEMO_FACILITY.id, "demo-clinic-01");
  assert.equal(CANONICAL_DEMO_FACILITY.publicCode, "DEMO-CLINIC-01");

  // Retired facility identifiers must not exist in .env.example
  assert.equal(ENV_EXAMPLE.includes("demo-facility-001"), false);
  assert.equal(ENV_EXAMPLE.includes("DEMO-FACILITY"), false);
  assert.match(ENV_EXAMPLE, /^NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE=DEMO-CLINIC-01$/m);
  assert.match(ENV_EXAMPLE, /^DEMO_FACILITY_ID=demo-clinic-01$/m);

  // Server-only DATABASE_URL and DATABASE_URL_UNPOOLED present; never NEXT_PUBLIC_
  assert.match(ENV_EXAMPLE, /^DATABASE_URL=postgresql:\/\//m);
  assert.match(ENV_EXAMPLE, /^DATABASE_URL_UNPOOLED=postgresql:\/\//m);
  assert.equal(ENV_EXAMPLE.includes("NEXT_PUBLIC_DATABASE_URL"), false);

  // EVIDENCE_HMAC_SECRET is deferred until Milestone 3 (must not be declared as an active env var yet)
  assert.equal(/^EVIDENCE_HMAC_SECRET=/m.test(ENV_EXAMPLE), false);

  // Drizzle migration journal registers both schema and triggers migrations in order
  assert.deepEqual(
    JOURNAL.entries.map((entry) => entry.tag),
    ["0000_initial_medflow_schema", "0001_immutability_triggers"],
  );
});

test("parseOptionalSeedAdminEnv handles facility-only mode, valid admin input, and rejects partial or invalid input", () => {
  assert.equal(parseOptionalSeedAdminEnv({}), null);

  const valid = parseOptionalSeedAdminEnv({
    SEED_ADMIN_UID: "firebase_uid_synthetic_01",
    SEED_ADMIN_EMAIL: "admin.synthetic@example.org",
    SEED_ADMIN_DISPLAY_NAME: "Dr. Synthetic Admin",
  });
  assert.deepEqual(valid, {
    uid: "firebase_uid_synthetic_01",
    email: "admin.synthetic@example.org",
    displayName: "Dr. Synthetic Admin",
    role: "admin",
  });

  // Partial configuration fails safely rather than silently skipping
  assert.throws(() =>
    parseOptionalSeedAdminEnv({
      SEED_ADMIN_UID: "firebase_uid_synthetic_01",
    }),
  );

  // Invalid role rejected
  assert.throws(() =>
    parseOptionalSeedAdminEnv({
      SEED_ADMIN_UID: "firebase_uid_synthetic_01",
      SEED_ADMIN_EMAIL: "admin.synthetic@example.org",
      SEED_ADMIN_DISPLAY_NAME: "Dr. Synthetic Admin",
      SEED_ADMIN_ROLE: "superadmin",
    }),
  );
});
