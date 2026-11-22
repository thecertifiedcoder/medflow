import { z } from "zod";

export const INTAKE_LIMITS = {
  maxDisplayNameLength: 80,
  maxAge: 120,
  minNarrativeLength: 5,
  maxNarrativeLength: 4000,
  maxCorrectionNoteLength: 500,
  maxPriorityReasonLength: 500,
  maxIdempotencyKeyLength: 128,
} as const;

export const CertaintySchema = z.enum(["explicit", "unclear"]);
export type Certainty = z.infer<typeof CertaintySchema>;

export const InputModeSchema = z.enum(["typed", "voice"]);
export type InputMode = z.infer<typeof InputModeSchema>;

export const TranscriptionStatusSchema = z.enum([
  "not_applicable",
  "succeeded",
  "failed",
]);
export type TranscriptionStatus = z.infer<typeof TranscriptionStatusSchema>;

export const AiStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
  "needs_human_clarification",
]);
export type AiStatus = z.infer<typeof AiStatusSchema>;

export const StaffReviewStatusSchema = z.enum([
  "not_reviewed",
  "confirmed",
  "corrected",
]);
export type StaffReviewStatus = z.infer<typeof StaffReviewStatusSchema>;

export const StaffAssignedPrioritySchema = z.enum([
  "unassigned",
  "immediate_review",
  "priority_review",
  "routine_review",
]);
export type StaffAssignedPriority = z.infer<typeof StaffAssignedPrioritySchema>;

export const WorkflowStatusSchema = z.enum([
  "new",
  "in_review",
  "awaiting_clarification",
  "completed",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const StaffRoleSchema = z.enum(["nurse", "doctor", "admin"]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const AuditActorTypeSchema = z.enum(["patient", "staff", "system"]);
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;

export const AuditActionSchema = z.enum([
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
export type AuditAction = z.infer<typeof AuditActionSchema>;

/**
 * Authoritative extraction schema per docs/09_DATA_MODEL_AND_API_CONTRACTS.md
 * and Founder Decision D-006.
 * Strict objects reject forbidden clinical authority fields (diagnosis, priority,
 * triageColor, urgencyScore, treatment, prescription, safeToWait).
 */
export const EvidenceItemSchema = z
  .object({
    value: z.string().trim().min(1).max(300),
    sourceQuote: z.string().trim().min(1).max(500).optional(),
    certainty: CertaintySchema,
  })
  .strict();
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const SymptomItemSchema = EvidenceItemSchema.extend({
  duration: z.string().trim().min(1).max(120).nullable().optional(),
  severity: z.string().trim().min(1).max(120).nullable().optional(),
}).strict();
export type SymptomItem = z.infer<typeof SymptomItemSchema>;

export const ReportedDetailToReviewSchema = z
  .object({
    detail: z.string().trim().min(1).max(300),
    sourceQuote: z.string().trim().min(1).max(500),
    context: z.string().trim().min(1).max(300),
  })
  .strict();
export type ReportedDetailToReview = z.infer<
  typeof ReportedDetailToReviewSchema
>;

export const ClinicalIntakeBriefSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    languageDetected: z.string().trim().min(1).max(40).optional(),
    chiefConcern: EvidenceItemSchema,
    symptoms: z.array(SymptomItemSchema).max(20),
    relevantContext: z.array(EvidenceItemSchema).max(20),
    reportedDetailsToReview: z.array(ReportedDetailToReviewSchema).max(15),
    missingOrUnclear: z.array(z.string().trim().min(1).max(240)).max(20),
    clinicianSummary: z.string().trim().min(1).max(1200),
    limitations: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  })
  .strict();
export type ClinicalIntakeBrief = z.infer<typeof ClinicalIntakeBriefSchema>;

/**
 * Authoritative AuditEvent schema per docs/09 and Founder Decision D-007.
 * Explicitly separates patient, staff, and system actors.
 */
export const AuditEventSchema = z
  .object({
    id: z.string().min(1).max(128),
    facilityId: z.string().min(1).max(128),
    intakeId: z.string().min(1).max(128),
    actorType: AuditActorTypeSchema,
    actorUid: z.string().trim().min(1).max(128).optional(),
    actorRole: StaffRoleSchema.optional(),
    actorDisplayName: z.string().trim().min(1).max(120).optional(),
    action: AuditActionSchema,
    fromValue: z.string().trim().max(120).optional(),
    toValue: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(INTAKE_LIMITS.maxPriorityReasonLength).optional(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.actorType === "staff") {
      if (!event.actorUid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actorUid"],
          message: "Staff audit events require actorUid.",
        });
      }
      if (!event.actorRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actorRole"],
          message: "Staff audit events require actorRole.",
        });
      }
    } else {
      if (event.actorRole !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actorRole"],
          message:
            "Non-staff audit events must not include a clinical staff actorRole.",
        });
      }
      if (event.actorUid !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actorUid"],
          message: "Non-staff audit events must not include a staff actorUid.",
        });
      }
    }
  });
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Public patient intake creation request per docs/09 and Founder Decision D-008.
 * Strict object prevents public clients from supplying facilityId, priority,
 * workflowStatus, aiStatus, aiBrief, or staff roles.
 */
export const CreateIntakeRequestSchema = z
  .object({
    facilityPublicCode: z.string().trim().min(1).max(64),
    patientDisplayName: z
      .string()
      .trim()
      .max(INTAKE_LIMITS.maxDisplayNameLength)
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    age: z
      .number()
      .int("Age must be a whole number.")
      .min(0, "Age cannot be negative.")
      .max(INTAKE_LIMITS.maxAge, "Please enter a valid age.")
      .optional(),
    inputMode: InputModeSchema,
    transcriptRaw: z
      .string()
      .trim()
      .max(INTAKE_LIMITS.maxNarrativeLength)
      .optional(),
    confirmedNarrative: z
      .string()
      .trim()
      .min(
        INTAKE_LIMITS.minNarrativeLength,
        "Please describe what you are experiencing before submitting.",
      )
      .max(
        INTAKE_LIMITS.maxNarrativeLength,
        "Statement exceeds the maximum allowed length.",
      ),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(INTAKE_LIMITS.maxIdempotencyKeyLength),
  })
  .strict();
export type CreateIntakeRequest = z.infer<typeof CreateIntakeRequestSchema>;

const ALLOWED_STATUS_TRANSITIONS: Record<
  WorkflowStatus,
  readonly WorkflowStatus[]
> = {
  new: ["in_review", "awaiting_clarification"],
  in_review: ["awaiting_clarification", "completed"],
  awaiting_clarification: ["in_review", "completed"],
  completed: [],
};

export function isAllowedStatusTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Deterministic workflow ordering per docs/13 FR-11 and docs/08 §9:
 * 1. Unassigned / awaiting staff review first
 * 2. Staff-assigned Immediate review
 * 3. Staff-assigned Priority review
 * 4. Staff-assigned Routine review
 * Within each group: oldest submission first, then stable ID tiebreaker.
 * Workflow organisation only — never a validated clinical triage protocol.
 */
export const WORKFLOW_PRIORITY_RANK: Record<StaffAssignedPriority, number> = {
  unassigned: 0,
  immediate_review: 1,
  priority_review: 2,
  routine_review: 3,
};

export const WORKFLOW_PRIORITY_LABELS: Record<StaffAssignedPriority, string> = {
  unassigned: "Unassigned",
  immediate_review: "Immediate review",
  priority_review: "Priority review",
  routine_review: "Routine review",
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  new: "New",
  in_review: "In review",
  awaiting_clarification: "Awaiting clarification",
  completed: "Intake review completed",
};

export interface QueueSortableIntake {
  readonly id: string;
  readonly staffAssignedPriority: StaffAssignedPriority;
  readonly createdAtMs: number;
}

export function compareQueueIntakes(
  a: QueueSortableIntake,
  b: QueueSortableIntake,
): number {
  const rankDiff =
    WORKFLOW_PRIORITY_RANK[a.staffAssignedPriority] -
    WORKFLOW_PRIORITY_RANK[b.staffAssignedPriority];
  if (rankDiff !== 0) return rankDiff;

  const timeDiff = a.createdAtMs - b.createdAtMs;
  if (timeDiff !== 0) return timeDiff;

  return a.id.localeCompare(b.id);
}

export function sortIntakesDeterministically<T extends QueueSortableIntake>(
  intakes: readonly T[],
): T[] {
  return [...intakes].sort(compareQueueIntakes);
}
