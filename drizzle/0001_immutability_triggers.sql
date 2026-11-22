-- MedFlow PostgreSQL Immutability & Append-Only Enforcement Triggers
-- Applied immediately after 0000_initial_medflow_schema.sql via `drizzle-kit migrate`.

CREATE OR REPLACE FUNCTION "public"."medflow_enforce_patient_intake_immutability"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
    OR NEW.reference_code IS DISTINCT FROM OLD.reference_code
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.demo_record IS DISTINCT FROM OLD.demo_record
    OR NEW.patient_display_name IS DISTINCT FROM OLD.patient_display_name
    OR NEW.age IS DISTINCT FROM OLD.age
    OR NEW.input_mode IS DISTINCT FROM OLD.input_mode
    OR NEW.transcription_status IS DISTINCT FROM OLD.transcription_status
    OR NEW.transcription_model IS DISTINCT FROM OLD.transcription_model
    OR NEW.transcript_raw IS DISTINCT FROM OLD.transcript_raw
    OR NEW.confirmed_narrative IS DISTINCT FROM OLD.confirmed_narrative
    OR NEW.confirmed_narrative_sha256 IS DISTINCT FROM OLD.confirmed_narrative_sha256
    OR NEW.transcript_confirmed_at IS DISTINCT FROM OLD.transcript_confirmed_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'patient_intakes immutable source narrative and identity fields cannot be modified after creation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "patient_intakes_immutability_trg"
BEFORE UPDATE ON "public"."patient_intakes"
FOR EACH ROW
EXECUTE FUNCTION "public"."medflow_enforce_patient_intake_immutability"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."medflow_enforce_intake_evidence_immutability"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'intake_evidence records are immutable and cannot be deleted';
  END IF;

  IF NOT (OLD.is_current IS TRUE AND NEW.is_current IS FALSE) THEN
    RAISE EXCEPTION 'intake_evidence only permits a one-way is_current transition from true to false';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.intake_id IS DISTINCT FROM OLD.intake_id
    OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
    OR NEW.extraction_run_id IS DISTINCT FROM OLD.extraction_run_id
    OR NEW.field_category IS DISTINCT FROM OLD.field_category
    OR NEW.field_path IS DISTINCT FROM OLD.field_path
    OR NEW.claim_value IS DISTINCT FROM OLD.claim_value
    OR NEW.certainty IS DISTINCT FROM OLD.certainty
    OR NEW.source_quote IS DISTINCT FROM OLD.source_quote
    OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.span_start IS DISTINCT FROM OLD.span_start
    OR NEW.span_end IS DISTINCT FROM OLD.span_end
    OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
    OR NEW.narrative_sha256 IS DISTINCT FROM OLD.narrative_sha256
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'intake_evidence fields are immutable after insertion except is_current transitioning true to false';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "intake_evidence_immutability_trg"
BEFORE UPDATE OR DELETE ON "public"."intake_evidence"
FOR EACH ROW
EXECUTE FUNCTION "public"."medflow_enforce_intake_evidence_immutability"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."medflow_enforce_audit_events_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is strictly append-only; % operations are forbidden', TG_OP;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "audit_events_append_only_trg"
BEFORE UPDATE OR DELETE ON "public"."audit_events"
FOR EACH ROW
EXECUTE FUNCTION "public"."medflow_enforce_audit_events_append_only"();