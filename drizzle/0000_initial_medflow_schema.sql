CREATE TYPE "public"."ai_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'needs_human_clarification');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('intake_created', 'transcript_confirmed', 'ai_completed', 'ai_failed', 'review_started', 'priority_assigned', 'priority_changed', 'status_changed', 'brief_confirmed', 'brief_corrected');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('patient', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."evidence_certainty" AS ENUM('explicit', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."evidence_field_category" AS ENUM('chief_concern', 'symptom', 'relevant_context', 'reported_detail_to_review');--> statement-breakpoint
CREATE TYPE "public"."evidence_verification_status" AS ENUM('exact_quote_match', 'missing_quote', 'quote_not_found', 'ambiguous_quote');--> statement-breakpoint
CREATE TYPE "public"."input_mode" AS ENUM('typed', 'voice');--> statement-breakpoint
CREATE TYPE "public"."staff_assigned_priority" AS ENUM('unassigned', 'immediate_review', 'priority_review', 'routine_review');--> statement-breakpoint
CREATE TYPE "public"."staff_review_status" AS ENUM('not_reviewed', 'confirmed', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('nurse', 'doctor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."transcription_status" AS ENUM('not_applicable', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('new', 'in_review', 'awaiting_clarification', 'completed');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" varchar(128) NOT NULL,
	"intake_id" uuid NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_uid" varchar(128),
	"actor_role" "staff_role",
	"actor_display_name" varchar(120),
	"action" "audit_action" NOT NULL,
	"from_value" varchar(120),
	"to_value" varchar(120),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_identity_chk" CHECK ((
        "audit_events"."actor_type" = 'staff'
        AND "audit_events"."actor_uid" IS NOT NULL
        AND "audit_events"."actor_role" IS NOT NULL
      ) OR (
        "audit_events"."actor_type" IN ('patient', 'system')
        AND "audit_events"."actor_uid" IS NULL
        AND "audit_events"."actor_role" IS NULL
      )),
	CONSTRAINT "audit_events_action_actor_mapping_chk" CHECK ((
        "audit_events"."action" IN ('intake_created', 'transcript_confirmed')
        AND "audit_events"."actor_type" = 'patient'
      ) OR (
        "audit_events"."action" IN ('ai_completed', 'ai_failed')
        AND "audit_events"."actor_type" = 'system'
      ) OR (
        "audit_events"."action" IN (
          'review_started',
          'priority_assigned',
          'priority_changed',
          'status_changed',
          'brief_confirmed',
          'brief_corrected'
        )
        AND "audit_events"."actor_type" = 'staff'
      )),
	CONSTRAINT "audit_events_reason_required_chk" CHECK ((
        "audit_events"."action" NOT IN ('priority_changed', 'brief_corrected')
        AND ("audit_events"."reason" IS NULL OR char_length("audit_events"."reason") <= 500)
      ) OR (
        "audit_events"."action" IN ('priority_changed', 'brief_corrected')
        AND "audit_events"."reason" IS NOT NULL
        AND char_length(btrim("audit_events"."reason")) >= 3
        AND char_length("audit_events"."reason") <= 500
      ))
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"public_code" varchar(64) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Lagos' NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_public_code_uq" UNIQUE("public_code"),
	CONSTRAINT "facilities_id_format_chk" CHECK ("facilities"."id" ~ '^[a-zA-Z0-9_-]+$'),
	CONSTRAINT "facilities_public_code_format_chk" CHECK ("facilities"."public_code" ~ '^[A-Z0-9_-]+$'),
	CONSTRAINT "facilities_name_nonempty_chk" CHECK (char_length(btrim("facilities"."name")) >= 1)
);
--> statement-breakpoint
CREATE TABLE "facility_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_uid" varchar(128) NOT NULL,
	"facility_id" varchar(128) NOT NULL,
	"role" "staff_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_memberships_staff_facility_uq" UNIQUE("staff_uid","facility_id")
);
--> statement-breakpoint
CREATE TABLE "intake_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_id" uuid NOT NULL,
	"facility_id" varchar(128) NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"field_category" "evidence_field_category" NOT NULL,
	"field_path" varchar(120) NOT NULL,
	"claim_value" text NOT NULL,
	"certainty" "evidence_certainty" NOT NULL,
	"source_quote" text,
	"verification_status" "evidence_verification_status" NOT NULL,
	"span_start" integer,
	"span_end" integer,
	"engine_version" varchar(32) NOT NULL,
	"narrative_sha256" char(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_evidence_run_field_uq" UNIQUE("intake_id","extraction_run_id","field_path"),
	CONSTRAINT "intake_evidence_field_path_nonempty_chk" CHECK (char_length(btrim("intake_evidence"."field_path")) >= 1),
	CONSTRAINT "intake_evidence_claim_value_len_chk" CHECK (char_length(btrim("intake_evidence"."claim_value")) >= 1 AND char_length("intake_evidence"."claim_value") <= 500),
	CONSTRAINT "intake_evidence_source_quote_len_chk" CHECK ("intake_evidence"."source_quote" IS NULL OR (char_length("intake_evidence"."source_quote") >= 1 AND char_length("intake_evidence"."source_quote") <= 500)),
	CONSTRAINT "intake_evidence_narrative_sha256_chk" CHECK ("intake_evidence"."narrative_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "intake_evidence_status_span_chk" CHECK ((
        "intake_evidence"."verification_status" = 'exact_quote_match'
        AND "intake_evidence"."source_quote" IS NOT NULL
        AND char_length("intake_evidence"."source_quote") >= 1
        AND "intake_evidence"."span_start" IS NOT NULL
        AND "intake_evidence"."span_end" IS NOT NULL
        AND "intake_evidence"."span_start" >= 0
        AND "intake_evidence"."span_end" > "intake_evidence"."span_start"
      ) OR (
        "intake_evidence"."verification_status" = 'missing_quote'
        AND "intake_evidence"."source_quote" IS NULL
        AND "intake_evidence"."span_start" IS NULL
        AND "intake_evidence"."span_end" IS NULL
      ) OR (
        "intake_evidence"."verification_status" IN ('quote_not_found', 'ambiguous_quote')
        AND "intake_evidence"."source_quote" IS NOT NULL
        AND char_length("intake_evidence"."source_quote") >= 1
        AND "intake_evidence"."span_start" IS NULL
        AND "intake_evidence"."span_end" IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "patient_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" varchar(128) NOT NULL,
	"reference_code" varchar(32) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"demo_record" boolean DEFAULT false NOT NULL,
	"patient_display_name" varchar(80),
	"age" smallint,
	"input_mode" "input_mode" NOT NULL,
	"transcription_status" "transcription_status" DEFAULT 'not_applicable' NOT NULL,
	"transcription_model" varchar(80),
	"transcript_raw" text,
	"confirmed_narrative" text NOT NULL,
	"confirmed_narrative_sha256" char(64) NOT NULL,
	"transcript_confirmed_at" timestamp with time zone,
	"ai_status" "ai_status" DEFAULT 'queued' NOT NULL,
	"ai_schema_version" varchar(16),
	"ai_model_id" varchar(80),
	"ai_brief" jsonb,
	"ai_brief_provenance" jsonb,
	"ai_error_code" varchar(80),
	"staff_review_status" "staff_review_status" DEFAULT 'not_reviewed' NOT NULL,
	"staff_reviewed_brief" jsonb,
	"staff_correction_note" text,
	"reviewed_by_uid" varchar(128),
	"reviewed_at" timestamp with time zone,
	"staff_assigned_priority" "staff_assigned_priority" DEFAULT 'unassigned' NOT NULL,
	"priority_reason" text,
	"workflow_status" "workflow_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_intakes_id_facility_id_uq" UNIQUE("id","facility_id"),
	CONSTRAINT "patient_intakes_facility_ref_uq" UNIQUE("facility_id","reference_code"),
	CONSTRAINT "patient_intakes_facility_idem_uq" UNIQUE("facility_id","idempotency_key"),
	CONSTRAINT "patient_intakes_reference_code_format_chk" CHECK ("patient_intakes"."reference_code" ~ '^[A-Z0-9-]+$' AND char_length("patient_intakes"."reference_code") >= 4),
	CONSTRAINT "patient_intakes_idempotency_key_format_chk" CHECK ("patient_intakes"."idempotency_key" ~ '^[a-zA-Z0-9_-]+$' AND char_length("patient_intakes"."idempotency_key") >= 8),
	CONSTRAINT "patient_intakes_age_range_chk" CHECK ("patient_intakes"."age" IS NULL OR ("patient_intakes"."age" >= 0 AND "patient_intakes"."age" <= 120)),
	CONSTRAINT "patient_intakes_narrative_len_chk" CHECK (char_length("patient_intakes"."confirmed_narrative") >= 5 AND char_length("patient_intakes"."confirmed_narrative") <= 4000),
	CONSTRAINT "patient_intakes_narrative_sha256_chk" CHECK ("patient_intakes"."confirmed_narrative_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "patient_intakes_transcript_raw_len_chk" CHECK ("patient_intakes"."transcript_raw" IS NULL OR (char_length("patient_intakes"."transcript_raw") >= 1 AND char_length("patient_intakes"."transcript_raw") <= 4000)),
	CONSTRAINT "patient_intakes_ai_succeeded_brief_chk" CHECK ("patient_intakes"."ai_status" <> 'succeeded' OR "patient_intakes"."ai_brief" IS NOT NULL),
	CONSTRAINT "patient_intakes_priority_reason_chk" CHECK (("patient_intakes"."staff_assigned_priority" = 'unassigned' AND "patient_intakes"."priority_reason" IS NULL) OR ("patient_intakes"."staff_assigned_priority" <> 'unassigned' AND ("patient_intakes"."priority_reason" IS NULL OR char_length("patient_intakes"."priority_reason") <= 500))),
	CONSTRAINT "patient_intakes_staff_review_consistency_chk" CHECK ((
        "patient_intakes"."staff_review_status" = 'not_reviewed'
        AND "patient_intakes"."staff_reviewed_brief" IS NULL
        AND "patient_intakes"."reviewed_by_uid" IS NULL
        AND "patient_intakes"."reviewed_at" IS NULL
        AND "patient_intakes"."staff_correction_note" IS NULL
      ) OR (
        "patient_intakes"."staff_review_status" = 'confirmed'
        AND "patient_intakes"."reviewed_by_uid" IS NOT NULL
        AND "patient_intakes"."reviewed_at" IS NOT NULL
        AND "patient_intakes"."staff_correction_note" IS NULL
      ) OR (
        "patient_intakes"."staff_review_status" = 'corrected'
        AND "patient_intakes"."staff_reviewed_brief" IS NOT NULL
        AND "patient_intakes"."reviewed_by_uid" IS NOT NULL
        AND "patient_intakes"."reviewed_at" IS NOT NULL
        AND "patient_intakes"."staff_correction_note" IS NOT NULL
        AND char_length(btrim("patient_intakes"."staff_correction_note")) >= 3
        AND char_length("patient_intakes"."staff_correction_note") <= 500
      ))
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"uid" varchar(128) PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_email_uq" UNIQUE("email"),
	CONSTRAINT "staff_profiles_uid_format_chk" CHECK ("staff_profiles"."uid" ~ '^[a-zA-Z0-9_-]+$'),
	CONSTRAINT "staff_profiles_display_name_nonempty_chk" CHECK (char_length(btrim("staff_profiles"."display_name")) >= 1)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_uid_staff_profiles_uid_fk" FOREIGN KEY ("actor_uid") REFERENCES "public"."staff_profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_intake_facility_fk" FOREIGN KEY ("intake_id","facility_id") REFERENCES "public"."patient_intakes"("id","facility_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_staff_uid_staff_profiles_uid_fk" FOREIGN KEY ("staff_uid") REFERENCES "public"."staff_profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_evidence" ADD CONSTRAINT "intake_evidence_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_evidence" ADD CONSTRAINT "intake_evidence_intake_facility_fk" FOREIGN KEY ("intake_id","facility_id") REFERENCES "public"."patient_intakes"("id","facility_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_intakes" ADD CONSTRAINT "patient_intakes_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_intakes" ADD CONSTRAINT "patient_intakes_reviewed_by_uid_staff_profiles_uid_fk" FOREIGN KEY ("reviewed_by_uid") REFERENCES "public"."staff_profiles"("uid") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_facility_intake_created_idx" ON "audit_events" USING btree ("facility_id","intake_id","created_at","id");--> statement-breakpoint
CREATE INDEX "facility_memberships_facility_active_idx" ON "facility_memberships" USING btree ("facility_id","active");--> statement-breakpoint
CREATE INDEX "facility_memberships_staff_active_idx" ON "facility_memberships" USING btree ("staff_uid","active");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_evidence_current_field_uq" ON "intake_evidence" USING btree ("intake_id","field_path") WHERE "intake_evidence"."is_current" = true;--> statement-breakpoint
CREATE INDEX "intake_evidence_facility_intake_current_idx" ON "intake_evidence" USING btree ("facility_id","intake_id","is_current");--> statement-breakpoint
CREATE INDEX "patient_intakes_facility_queue_idx" ON "patient_intakes" USING btree ("facility_id","workflow_status","staff_assigned_priority","created_at","id");--> statement-breakpoint
CREATE INDEX "patient_intakes_facility_created_idx" ON "patient_intakes" USING btree ("facility_id","created_at");