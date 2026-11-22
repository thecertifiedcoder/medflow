import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { ClinicalIntakeBrief } from "@/lib/schemas/intake";

/**
 * Server-generated Evidence Integrity provenance envelope persisted alongside
 * `ai_brief` once Milestone 3 is implemented (docs/09 §8, docs/19 §4 Step 5).
 */
export interface AiBriefProvenanceEnvelope {
  readonly intakeId: string;
  readonly narrativeSha256: string;
  readonly draftAndEvidenceSha256: string;
  readonly modelId: string;
  readonly extractionSchemaVersion: string;
  readonly evidenceEngineVersion: string;
  readonly createdAt: string;
  readonly hmacSha256: string;
}

// =============================================================================
// PostgreSQL Enums (authoritative domain vocabulary per docs/09 & docs/19)
// =============================================================================

export const staffRoleEnum = pgEnum("staff_role", ["nurse", "doctor", "admin"]);

export const inputModeEnum = pgEnum("input_mode", ["typed", "voice"]);

export const transcriptionStatusEnum = pgEnum("transcription_status", [
  "not_applicable",
  "succeeded",
  "failed",
]);

export const aiStatusEnum = pgEnum("ai_status", [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "needs_human_clarification",
]);

export const staffReviewStatusEnum = pgEnum("staff_review_status", [
  "not_reviewed",
  "confirmed",
  "corrected",
]);

export const staffAssignedPriorityEnum = pgEnum("staff_assigned_priority", [
  "unassigned",
  "immediate_review",
  "priority_review",
  "routine_review",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "new",
  "in_review",
  "awaiting_clarification",
  "completed",
]);

export const evidenceFieldCategoryEnum = pgEnum("evidence_field_category", [
  "chief_concern",
  "symptom",
  "relevant_context",
  "reported_detail_to_review",
]);

export const evidenceCertaintyEnum = pgEnum("evidence_certainty", [
  "explicit",
  "unclear",
]);

export const evidenceVerificationStatusEnum = pgEnum(
  "evidence_verification_status",
  ["exact_quote_match", "missing_quote", "quote_not_found", "ambiguous_quote"],
);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "patient",
  "staff",
  "system",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "intake_created",
  "transcript_confirmed",
  "ai_completed",
  "ai_failed",
  "review_started",
  "priority_assigned",
  "priority_changed",
  "status_changed",
  "brief_confirmed",
  "brief_corrected",
]);

// =============================================================================
// Table 1: facilities
// =============================================================================

export const facilities = pgTable(
  "facilities",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    publicCode: varchar("public_code", { length: 64 }).notNull(),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Africa/Lagos"),
    isDemo: boolean("is_demo").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("facilities_public_code_uq").on(t.publicCode),
    check("facilities_id_format_chk", sql`${t.id} ~ '^[a-zA-Z0-9_-]+$'`),
    check(
      "facilities_public_code_format_chk",
      sql`${t.publicCode} ~ '^[A-Z0-9_-]+$'`,
    ),
    check("facilities_name_nonempty_chk", sql`char_length(btrim(${t.name})) >= 1`),
  ],
);

// =============================================================================
// Table 2: staff_profiles (keyed by Firebase Auth UID)
// =============================================================================

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    uid: varchar("uid", { length: 128 }).primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("staff_profiles_email_uq").on(t.email),
    check("staff_profiles_uid_format_chk", sql`${t.uid} ~ '^[a-zA-Z0-9_-]+$'`),
    check(
      "staff_profiles_display_name_nonempty_chk",
      sql`char_length(btrim(${t.displayName})) >= 1`,
    ),
  ],
);

// =============================================================================
// Table 3: facility_memberships (normalized per-facility staff roles)
// =============================================================================

export const facilityMemberships = pgTable(
  "facility_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUid: varchar("staff_uid", { length: 128 })
      .notNull()
      .references(() => staffProfiles.uid, { onDelete: "restrict" }),
    facilityId: varchar("facility_id", { length: 128 })
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    role: staffRoleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("facility_memberships_staff_facility_uq").on(
      t.staffUid,
      t.facilityId,
    ),
    index("facility_memberships_facility_active_idx").on(
      t.facilityId,
      t.active,
    ),
    index("facility_memberships_staff_active_idx").on(t.staffUid, t.active),
  ],
);

// =============================================================================
// Table 4: patient_intakes
// Preserves immutable confirmed narrative, separate AI draft + provenance,
// separate staff-reviewed brief, and staff-controlled operational priority.
// =============================================================================

export const patientIntakes = pgTable(
  "patient_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: varchar("facility_id", { length: 128 })
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    referenceCode: varchar("reference_code", { length: 32 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    demoRecord: boolean("demo_record").notNull().default(false),

    // Minimal optional patient context (D-008: age & display name always optional)
    patientDisplayName: varchar("patient_display_name", { length: 80 }),
    age: smallint("age"),

    // Immutable patient capture fields
    inputMode: inputModeEnum("input_mode").notNull(),
    transcriptionStatus: transcriptionStatusEnum("transcription_status")
      .notNull()
      .default("not_applicable"),
    transcriptionModel: varchar("transcription_model", { length: 80 }),
    transcriptRaw: text("transcript_raw"),
    confirmedNarrative: text("confirmed_narrative").notNull(),
    confirmedNarrativeSha256: char("confirmed_narrative_sha256", {
      length: 64,
    }).notNull(),
    transcriptConfirmedAt: timestamp("transcript_confirmed_at", {
      withTimezone: true,
    }),

    // Non-authoritative AI extraction draft (never overwrites confirmed_narrative)
    aiStatus: aiStatusEnum("ai_status").notNull().default("queued"),
    aiSchemaVersion: varchar("ai_schema_version", { length: 16 }),
    aiModelId: varchar("ai_model_id", { length: 80 }),
    aiBrief: jsonb("ai_brief").$type<ClinicalIntakeBrief>(),
    aiBriefProvenance: jsonb(
      "ai_brief_provenance",
    ).$type<AiBriefProvenanceEnvelope>(),
    aiErrorCode: varchar("ai_error_code", { length: 80 }),

    // Separate staff-reviewed copy (never overwrites ai_brief or confirmed_narrative)
    staffReviewStatus: staffReviewStatusEnum("staff_review_status")
      .notNull()
      .default("not_reviewed"),
    staffReviewedBrief: jsonb(
      "staff_reviewed_brief",
    ).$type<ClinicalIntakeBrief>(),
    staffCorrectionNote: text("staff_correction_note"),
    reviewedByUid: varchar("reviewed_by_uid", { length: 128 }).references(
      () => staffProfiles.uid,
      { onDelete: "restrict" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    // Exclusively staff-controlled workflow state (never set by AI)
    staffAssignedPriority: staffAssignedPriorityEnum("staff_assigned_priority")
      .notNull()
      .default("unassigned"),
    priorityReason: text("priority_reason"),
    workflowStatus: workflowStatusEnum("workflow_status")
      .notNull()
      .default("new"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite unique key enabling composite foreign keys from child tables
    // (ensuring intake_evidence & audit_events facility_id always matches parent)
    unique("patient_intakes_id_facility_id_uq").on(t.id, t.facilityId),
    unique("patient_intakes_facility_ref_uq").on(t.facilityId, t.referenceCode),
    unique("patient_intakes_facility_idem_uq").on(
      t.facilityId,
      t.idempotencyKey,
    ),
    index("patient_intakes_facility_queue_idx").on(
      t.facilityId,
      t.workflowStatus,
      t.staffAssignedPriority,
      t.createdAt,
      t.id,
    ),
    index("patient_intakes_facility_created_idx").on(t.facilityId, t.createdAt),
    check(
      "patient_intakes_reference_code_format_chk",
      sql`${t.referenceCode} ~ '^[A-Z0-9-]+$' AND char_length(${t.referenceCode}) >= 4`,
    ),
    check(
      "patient_intakes_idempotency_key_format_chk",
      sql`${t.idempotencyKey} ~ '^[a-zA-Z0-9_-]+$' AND char_length(${t.idempotencyKey}) >= 8`,
    ),
    check(
      "patient_intakes_age_range_chk",
      sql`${t.age} IS NULL OR (${t.age} >= 0 AND ${t.age} <= 120)`,
    ),
    check(
      "patient_intakes_narrative_len_chk",
      sql`char_length(${t.confirmedNarrative}) >= 5 AND char_length(${t.confirmedNarrative}) <= 4000`,
    ),
    check(
      "patient_intakes_narrative_sha256_chk",
      sql`${t.confirmedNarrativeSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "patient_intakes_transcript_raw_len_chk",
      sql`${t.transcriptRaw} IS NULL OR (char_length(${t.transcriptRaw}) >= 1 AND char_length(${t.transcriptRaw}) <= 4000)`,
    ),
    check(
      "patient_intakes_ai_succeeded_brief_chk",
      sql`${t.aiStatus} <> 'succeeded' OR ${t.aiBrief} IS NOT NULL`,
    ),
    check(
      "patient_intakes_priority_reason_chk",
      sql`(${t.staffAssignedPriority} = 'unassigned' AND ${t.priorityReason} IS NULL) OR (${t.staffAssignedPriority} <> 'unassigned' AND (${t.priorityReason} IS NULL OR char_length(${t.priorityReason}) <= 500))`,
    ),
    // Requirement 4: strict internal consistency across all staff review fields
    check(
      "patient_intakes_staff_review_consistency_chk",
      sql`(
        ${t.staffReviewStatus} = 'not_reviewed'
        AND ${t.staffReviewedBrief} IS NULL
        AND ${t.reviewedByUid} IS NULL
        AND ${t.reviewedAt} IS NULL
        AND ${t.staffCorrectionNote} IS NULL
      ) OR (
        ${t.staffReviewStatus} = 'confirmed'
        AND ${t.reviewedByUid} IS NOT NULL
        AND ${t.reviewedAt} IS NOT NULL
        AND ${t.staffCorrectionNote} IS NULL
      ) OR (
        ${t.staffReviewStatus} = 'corrected'
        AND ${t.staffReviewedBrief} IS NOT NULL
        AND ${t.reviewedByUid} IS NOT NULL
        AND ${t.reviewedAt} IS NOT NULL
        AND ${t.staffCorrectionNote} IS NOT NULL
        AND char_length(btrim(${t.staffCorrectionNote})) >= 3
        AND char_length(${t.staffCorrectionNote}) <= 500
      )`,
    ),
  ],
);

// =============================================================================
// Table 5: intake_evidence (Evidence Integrity Engine field-level verification)
// Immutable after insertion except one-way is_current: true -> false (enforced
// by PostgreSQL BEFORE UPDATE OR DELETE trigger in 0001_immutability_triggers.sql).
// =============================================================================

export const intakeEvidence = pgTable(
  "intake_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    intakeId: uuid("intake_id").notNull(),
    facilityId: varchar("facility_id", { length: 128 })
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    extractionRunId: uuid("extraction_run_id").notNull(),
    isCurrent: boolean("is_current").notNull().default(true),

    fieldCategory: evidenceFieldCategoryEnum("field_category").notNull(),
    fieldPath: varchar("field_path", { length: 120 }).notNull(),
    claimValue: text("claim_value").notNull(),
    certainty: evidenceCertaintyEnum("certainty").notNull(),
    sourceQuote: text("source_quote"),

    // Server-derived deterministic provenance state & UTF-16 half-open [start, end)
    verificationStatus: evidenceVerificationStatusEnum(
      "verification_status",
    ).notNull(),
    spanStart: integer("span_start"),
    spanEnd: integer("span_end"),
    engineVersion: varchar("engine_version", { length: 32 }).notNull(),
    narrativeSha256: char("narrative_sha256", { length: 64 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Requirement 1: composite FK guarantees facility_id matches parent patient_intakes row
    foreignKey({
      name: "intake_evidence_intake_facility_fk",
      columns: [t.intakeId, t.facilityId],
      foreignColumns: [patientIntakes.id, patientIntakes.facilityId],
    }).onDelete("restrict"),
    unique("intake_evidence_run_field_uq").on(
      t.intakeId,
      t.extractionRunId,
      t.fieldPath,
    ),
    uniqueIndex("intake_evidence_current_field_uq")
      .on(t.intakeId, t.fieldPath)
      .where(sql`${t.isCurrent} = true`),
    index("intake_evidence_facility_intake_current_idx").on(
      t.facilityId,
      t.intakeId,
      t.isCurrent,
    ),
    check(
      "intake_evidence_field_path_nonempty_chk",
      sql`char_length(btrim(${t.fieldPath})) >= 1`,
    ),
    check(
      "intake_evidence_claim_value_len_chk",
      sql`char_length(btrim(${t.claimValue})) >= 1 AND char_length(${t.claimValue}) <= 500`,
    ),
    check(
      "intake_evidence_source_quote_len_chk",
      sql`${t.sourceQuote} IS NULL OR (char_length(${t.sourceQuote}) >= 1 AND char_length(${t.sourceQuote}) <= 500)`,
    ),
    check(
      "intake_evidence_narrative_sha256_chk",
      sql`${t.narrativeSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    // Exact UTF-16 span required iff verification_status = 'exact_quote_match'
    check(
      "intake_evidence_status_span_chk",
      sql`(
        ${t.verificationStatus} = 'exact_quote_match'
        AND ${t.sourceQuote} IS NOT NULL
        AND char_length(${t.sourceQuote}) >= 1
        AND ${t.spanStart} IS NOT NULL
        AND ${t.spanEnd} IS NOT NULL
        AND ${t.spanStart} >= 0
        AND ${t.spanEnd} > ${t.spanStart}
      ) OR (
        ${t.verificationStatus} = 'missing_quote'
        AND ${t.sourceQuote} IS NULL
        AND ${t.spanStart} IS NULL
        AND ${t.spanEnd} IS NULL
      ) OR (
        ${t.verificationStatus} IN ('quote_not_found', 'ambiguous_quote')
        AND ${t.sourceQuote} IS NOT NULL
        AND char_length(${t.sourceQuote}) >= 1
        AND ${t.spanStart} IS NULL
        AND ${t.spanEnd} IS NULL
      )`,
    ),
  ],
);

// =============================================================================
// Table 6: audit_events (append-only 3-actor audit log per D-007 & Req 3)
// Strictly append-only via BEFORE UPDATE OR DELETE trigger in 0001_immutability_triggers.sql.
// =============================================================================

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: varchar("facility_id", { length: 128 })
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    intakeId: uuid("intake_id").notNull(),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorUid: varchar("actor_uid", { length: 128 }).references(
      () => staffProfiles.uid,
      { onDelete: "restrict" },
    ),
    actorRole: staffRoleEnum("actor_role"),
    actorDisplayName: varchar("actor_display_name", { length: 120 }),
    action: auditActionEnum("action").notNull(),
    fromValue: varchar("from_value", { length: 120 }),
    toValue: varchar("to_value", { length: 120 }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite FK guarantees audit event facility_id matches parent intake's facility_id
    foreignKey({
      name: "audit_events_intake_facility_fk",
      columns: [t.intakeId, t.facilityId],
      foreignColumns: [patientIntakes.id, patientIntakes.facilityId],
    }).onDelete("restrict"),
    index("audit_events_facility_intake_created_idx").on(
      t.facilityId,
      t.intakeId,
      t.createdAt,
      t.id,
    ),
    // D-007: staff actors MUST have actor_uid + actor_role; patient/system MUST NOT
    check(
      "audit_events_actor_identity_chk",
      sql`(
        ${t.actorType} = 'staff'
        AND ${t.actorUid} IS NOT NULL
        AND ${t.actorRole} IS NOT NULL
      ) OR (
        ${t.actorType} IN ('patient', 'system')
        AND ${t.actorUid} IS NULL
        AND ${t.actorRole} IS NULL
      )`,
    ),
    // Requirement 3: complete database-level action-to-actor validation
    check(
      "audit_events_action_actor_mapping_chk",
      sql`(
        ${t.action} IN ('intake_created', 'transcript_confirmed')
        AND ${t.actorType} = 'patient'
      ) OR (
        ${t.action} IN ('ai_completed', 'ai_failed')
        AND ${t.actorType} = 'system'
      ) OR (
        ${t.action} IN (
          'review_started',
          'priority_assigned',
          'priority_changed',
          'status_changed',
          'brief_confirmed',
          'brief_corrected'
        )
        AND ${t.actorType} = 'staff'
      )`,
    ),
    // Priority changes and brief corrections require a non-empty reason
    check(
      "audit_events_reason_required_chk",
      sql`(
        ${t.action} NOT IN ('priority_changed', 'brief_corrected')
        AND (${t.reason} IS NULL OR char_length(${t.reason}) <= 500)
      ) OR (
        ${t.action} IN ('priority_changed', 'brief_corrected')
        AND ${t.reason} IS NOT NULL
        AND char_length(btrim(${t.reason})) >= 3
        AND char_length(${t.reason}) <= 500
      )`,
    ),
  ],
);

// Inferred TypeScript row types
export type FacilityRow = typeof facilities.$inferSelect;
export type NewFacilityRow = typeof facilities.$inferInsert;
export type StaffProfileRow = typeof staffProfiles.$inferSelect;
export type NewStaffProfileRow = typeof staffProfiles.$inferInsert;
export type FacilityMembershipRow = typeof facilityMemberships.$inferSelect;
export type NewFacilityMembershipRow = typeof facilityMemberships.$inferInsert;
export type PatientIntakeRow = typeof patientIntakes.$inferSelect;
export type NewPatientIntakeRow = typeof patientIntakes.$inferInsert;
export type IntakeEvidenceRow = typeof intakeEvidence.$inferSelect;
export type NewIntakeEvidenceRow = typeof intakeEvidence.$inferInsert;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
