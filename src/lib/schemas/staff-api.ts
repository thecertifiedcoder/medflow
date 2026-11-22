import { z } from "zod";
import {
  AiStatusSchema,
  AuditActionSchema,
  AuditActorTypeSchema,
  CertaintySchema,
  ClinicalIntakeBriefSchema,
  InputModeSchema,
  StaffAssignedPrioritySchema,
  StaffReviewStatusSchema,
  StaffRoleSchema,
  TranscriptionStatusSchema,
  WorkflowStatusSchema,
} from "@/lib/schemas/intake";

export const FACILITY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FacilityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(FACILITY_ID_REGEX, "Invalid facility identifier format.");

export const IntakeIdParamSchema = z
  .string()
  .trim()
  .regex(UUID_REGEX, "Intake identifier must be a valid UUID.");

export const EvidenceFieldCategorySchema = z.enum([
  "chief_concern",
  "symptom",
  "relevant_context",
  "reported_detail_to_review",
]);
export type EvidenceFieldCategory = z.infer<typeof EvidenceFieldCategorySchema>;

export const EvidenceVerificationStatusSchema = z.enum([
  "exact_quote_match",
  "missing_quote",
  "quote_not_found",
  "ambiguous_quote",
]);
export type EvidenceVerificationStatus = z.infer<
  typeof EvidenceVerificationStatusSchema
>;

export const AiBriefProvenanceEnvelopeSchema = z
  .object({
    intakeId: z.string().min(1),
    narrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
    draftAndEvidenceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    modelId: z.string().min(1),
    extractionSchemaVersion: z.string().min(1),
    evidenceEngineVersion: z.string().min(1),
    createdAt: z.string().min(1),
    hmacSha256: z.string().min(1),
  })
  .strict();

export const AuthorizedFacilityMembershipSchema = z
  .object({
    facilityId: FacilityIdSchema,
    facilityName: z.string().min(1).max(120),
    facilityPublicCode: z.string().min(1).max(64),
    role: StaffRoleSchema,
    isDemo: z.boolean(),
  })
  .strict();
export type AuthorizedFacilityMembership = z.infer<
  typeof AuthorizedFacilityMembershipSchema
>;

export const ResolvedStaffProfileSchema = z
  .object({
    uid: z.string().min(1).max(128),
    email: z.string().email().max(254),
    displayName: z.string().min(1).max(120),
    active: z.boolean(),
    role: StaffRoleSchema,
    facilityIds: z.array(FacilityIdSchema).min(1).max(20),
    memberships: z.array(AuthorizedFacilityMembershipSchema).min(1).max(20),
  })
  .strict();
export type ResolvedStaffProfile = z.infer<typeof ResolvedStaffProfileSchema>;

const SessionIdentitySchema = z
  .object({
    uid: z.string().min(1),
    email: z.string().email().nullable(),
    emailVerified: z.literal(true),
    displayName: z.string().nullable(),
  })
  .strict();

const SessionBaseSchema = z.object({
  authenticated: z.literal(true),
  verifiedByServer: z.literal(true),
  projectId: z.string().min(1),
  authorizationModel: z.literal("neon_postgres_server_rbac"),
  user: SessionIdentitySchema,
});

export const PostgresStaffSessionResponseSchema = z.discriminatedUnion(
  "authorizationStatus",
  [
    SessionBaseSchema.extend({
      authorizationStatus: z.literal("authorized"),
      staffProfile: ResolvedStaffProfileSchema,
      activeFacility: AuthorizedFacilityMembershipSchema,
    }).strict(),
    SessionBaseSchema.extend({
      authorizationStatus: z.literal("unprovisioned"),
      staffProfile: z.null(),
      activeFacility: z.null(),
      message: z.string().min(1),
    }).strict(),
    SessionBaseSchema.extend({
      authorizationStatus: z.literal("inactive"),
      staffProfile: z.null(),
      activeFacility: z.null(),
      message: z.string().min(1),
    }).strict(),
  ],
);
export type PostgresStaffSessionResponse = z.infer<
  typeof PostgresStaffSessionResponseSchema
>;

// =============================================================================
// Staff Queue API Contracts (GET /api/staff/intakes)
// =============================================================================

export const STAFF_QUEUE_DEFAULT_LIMIT = 50;
export const STAFF_QUEUE_MAX_LIMIT = 100;

export const StaffQueueQuerySchema = z
  .object({
    facilityId: FacilityIdSchema.optional(),
    workflowStatus: WorkflowStatusSchema.optional(),
    priority: StaffAssignedPrioritySchema.optional(),
    includeCompleted: z.boolean().default(false),
    limit: z
      .number()
      .int()
      .min(1)
      .max(STAFF_QUEUE_MAX_LIMIT)
      .default(STAFF_QUEUE_DEFAULT_LIMIT),
    offset: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();
export type StaffQueueQuery = z.infer<typeof StaffQueueQuerySchema>;

/**
 * Intentionally excludes full confirmedNarrative, transcriptRaw, aiBrief,
 * staffReviewedBrief, and provenance envelopes so queue list reads return
 * only the minimum fields needed for queue operation.
 */
export const StaffQueueItemSchema = z
  .object({
    id: IntakeIdParamSchema,
    facilityId: FacilityIdSchema,
    referenceCode: z.string().min(1).max(32),
    patientDisplayName: z.string().max(80).nullable(),
    age: z.number().int().min(0).max(120).nullable(),
    inputMode: InputModeSchema,
    transcriptionStatus: TranscriptionStatusSchema,
    aiStatus: AiStatusSchema,
    staffReviewStatus: StaffReviewStatusSchema,
    staffAssignedPriority: StaffAssignedPrioritySchema,
    workflowStatus: WorkflowStatusSchema,
    demoRecord: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type StaffQueueItem = z.infer<typeof StaffQueueItemSchema>;

export const StaffQueueResponseSchema = z
  .object({
    facility: AuthorizedFacilityMembershipSchema,
    items: z.array(StaffQueueItemSchema),
    pagination: z
      .object({
        limit: z.number().int().min(1).max(STAFF_QUEUE_MAX_LIMIT),
        offset: z.number().int().min(0),
        total: z.number().int().min(0),
        hasMore: z.boolean(),
      })
      .strict(),
    counts: z
      .object({
        unassigned: z.number().int().min(0),
        aiUnavailable: z.number().int().min(0),
      })
      .strict(),
    fetchedAt: z.string().datetime(),
  })
  .strict();
export type StaffQueueResponse = z.infer<typeof StaffQueueResponseSchema>;

// =============================================================================
// Staff Intake Detail API Contracts (GET /api/staff/intakes/[intakeId])
// =============================================================================

export const StaffIntakeEvidenceItemSchema = z
  .object({
    id: IntakeIdParamSchema,
    intakeId: IntakeIdParamSchema,
    facilityId: FacilityIdSchema,
    extractionRunId: IntakeIdParamSchema,
    isCurrent: z.boolean(),
    fieldCategory: EvidenceFieldCategorySchema,
    fieldPath: z.string().min(1).max(120),
    claimValue: z.string().min(1).max(500),
    certainty: CertaintySchema,
    sourceQuote: z.string().max(500).nullable(),
    verificationStatus: EvidenceVerificationStatusSchema,
    spanStart: z.number().int().min(0).nullable(),
    spanEnd: z.number().int().min(1).nullable(),
    engineVersion: z.string().min(1).max(32),
    narrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeEvidenceItem = z.infer<
  typeof StaffIntakeEvidenceItemSchema
>;

export const StaffIntakeAuditEventSchema = z
  .object({
    id: IntakeIdParamSchema,
    facilityId: FacilityIdSchema,
    intakeId: IntakeIdParamSchema,
    actorType: AuditActorTypeSchema,
    actorUid: z.string().max(128).nullable(),
    actorRole: StaffRoleSchema.nullable(),
    actorDisplayName: z.string().max(120).nullable(),
    action: AuditActionSchema,
    fromValue: z.string().max(120).nullable(),
    toValue: z.string().max(120).nullable(),
    reason: z.string().max(500).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeAuditEvent = z.infer<typeof StaffIntakeAuditEventSchema>;

export const StaffIntakeDetailSchema = z
  .object({
    id: IntakeIdParamSchema,
    facilityId: FacilityIdSchema,
    referenceCode: z.string().min(1).max(32),
    demoRecord: z.boolean(),
    patientDisplayName: z.string().max(80).nullable(),
    age: z.number().int().min(0).max(120).nullable(),

    // Immutable patient capture source (never overwritten by AI or staff review)
    patientSource: z
      .object({
        inputMode: InputModeSchema,
        transcriptionStatus: TranscriptionStatusSchema,
        transcriptionModel: z.string().max(80).nullable(),
        transcriptRaw: z.string().nullable(),
        confirmedNarrative: z.string().min(1),
        confirmedNarrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
        transcriptConfirmedAt: z.string().datetime().nullable(),
      })
      .strict(),

    // Non-authoritative AI draft (distinct from patientSource and staffReview)
    aiDraft: z
      .object({
        status: AiStatusSchema,
        schemaVersion: z.string().max(16).nullable(),
        modelId: z.string().max(80).nullable(),
        brief: ClinicalIntakeBriefSchema.nullable(),
        provenance: AiBriefProvenanceEnvelopeSchema.nullable(),
        errorCode: z.string().max(80).nullable(),
      })
      .strict(),

    // Separate staff-reviewed copy (never overwrites patientSource or aiDraft)
    staffReview: z
      .object({
        status: StaffReviewStatusSchema,
        reviewedBrief: ClinicalIntakeBriefSchema.nullable(),
        correctionNote: z.string().max(500).nullable(),
        reviewedByUid: z.string().max(128).nullable(),
        reviewedAt: z.string().datetime().nullable(),
      })
      .strict(),

    // Staff-controlled workflow state (never set by AI)
    workflow: z
      .object({
        staffAssignedPriority: StaffAssignedPrioritySchema,
        priorityReason: z.string().max(500).nullable(),
        workflowStatus: WorkflowStatusSchema,
      })
      .strict(),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeDetail = z.infer<typeof StaffIntakeDetailSchema>;

export const StaffIntakeDetailResponseSchema = z
  .object({
    facility: AuthorizedFacilityMembershipSchema,
    intake: StaffIntakeDetailSchema,
    evidence: z.array(StaffIntakeEvidenceItemSchema),
    auditEvents: z.array(StaffIntakeAuditEventSchema),
    fetchedAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeDetailResponse = z.infer<
  typeof StaffIntakeDetailResponseSchema
>;
