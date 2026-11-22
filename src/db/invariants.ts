import type {
  AuditAction,
  AuditActorType,
  ClinicalIntakeBrief,
  StaffReviewStatus,
} from "@/lib/schemas/intake";

/**
 * Sole canonical synthetic demo facility identifiers (approved Milestone 1D).
 * Retired legacy values: demo-facility-001 / DEMO-FACILITY.
 */
export const CANONICAL_DEMO_FACILITY = {
  id: "demo-clinic-01",
  publicCode: "DEMO-CLINIC-01",
  name: "MedFlow Synthetic Demo Clinic",
  timezone: "Africa/Lagos",
  isDemo: true,
  active: true,
} as const;

/**
 * Authoritative action-to-actor mapping enforced both in TypeScript and in
 * PostgreSQL CHECK constraint `audit_events_action_actor_mapping_chk`.
 */
export const AUDIT_ACTION_ACTOR_MAP: Readonly<
  Record<AuditAction, AuditActorType>
> = {
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
} as const;

/**
 * Audit actions that require a non-empty staff reason (>= 3 trimmed characters)
 * enforced by PostgreSQL CHECK constraint `audit_events_reason_required_chk`.
 */
export const AUDIT_ACTIONS_REQUIRING_REASON: readonly AuditAction[] = [
  "priority_changed",
  "brief_corrected",
] as const;

export const MIN_AUDIT_REASON_LENGTH = 3;

export function isValidAuditActionForActor(
  action: AuditAction,
  actorType: AuditActorType,
): boolean {
  return AUDIT_ACTION_ACTOR_MAP[action] === actorType;
}

export function doesAuditActionRequireReason(action: AuditAction): boolean {
  return AUDIT_ACTIONS_REQUIRING_REASON.includes(action);
}

export interface StaffReviewStateFields {
  readonly staffReviewStatus: StaffReviewStatus;
  readonly staffReviewedBrief: ClinicalIntakeBrief | null;
  readonly reviewedByUid: string | null;
  readonly reviewedAt: Date | string | null;
  readonly staffCorrectionNote: string | null;
}

/**
 * Pure mirror of PostgreSQL CHECK constraint `patient_intakes_staff_review_consistency_chk`.
 * Ensures staff_review_status, staff_reviewed_brief, reviewed_by_uid, reviewed_at,
 * and staff_correction_note remain internally consistent.
 */
export function isConsistentStaffReviewState(
  fields: StaffReviewStateFields,
): boolean {
  const hasReviewedBy =
    typeof fields.reviewedByUid === "string" &&
    fields.reviewedByUid.trim().length > 0;
  const hasReviewedAt = fields.reviewedAt !== null;
  const hasReviewedBrief = fields.staffReviewedBrief !== null;
  const trimmedNote = fields.staffCorrectionNote?.trim() ?? "";

  switch (fields.staffReviewStatus) {
    case "not_reviewed":
      return (
        !hasReviewedBrief &&
        !hasReviewedBy &&
        !hasReviewedAt &&
        fields.staffCorrectionNote === null
      );
    case "confirmed":
      return (
        hasReviewedBy &&
        hasReviewedAt &&
        fields.staffCorrectionNote === null
      );
    case "corrected":
      return (
        hasReviewedBrief &&
        hasReviewedBy &&
        hasReviewedAt &&
        fields.staffCorrectionNote !== null &&
        trimmedNote.length >= MIN_AUDIT_REASON_LENGTH
      );
  }
}
