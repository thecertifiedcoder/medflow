import { z } from "zod";
import {
  AiStatusSchema,
  AuditActionSchema,
  AuditActorTypeSchema,
  CertaintySchema,
  ClinicalIntakeBriefSchema,
  INTAKE_LIMITS,
  InputModeSchema,
  StaffAssignedPrioritySchema,
  StaffReviewStatusSchema,
  StaffRoleSchema,
  TranscriptionStatusSchema,
  WorkflowStatusSchema,
} from "./intake";

export const DemoPersonaSchema = z.enum(["admin", "clinical_staff"]);
export type DemoPersona = z.infer<typeof DemoPersonaSchema>;

export const AuthModeSchema = z.enum(["firebase", "demo"]);
export type AuthMode = z.infer<typeof AuthModeSchema>;

export const DemoStatusResponseSchema = z
  .object({
    enabled: z.boolean(),
    configured: z.boolean(),
    facilityPublicCode: z.string().min(1).max(64),
    hasActiveDemoSession: z.boolean(),
  })
  .strict();
export type DemoStatusResponse = z.infer<typeof DemoStatusResponseSchema>;

export const DemoLogoutResponseSchema = z
  .object({
    loggedOut: z.literal(true),
    revoked: z.boolean(),
  })
  .strict();
export type DemoLogoutResponse = z.infer<typeof DemoLogoutResponseSchema>;

export const AuthorizedFacilityMembershipSchema = z
  .object({
    facilityId: z.string().min(1).max(128),
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
    email: z.string().email(),
    displayName: z.string().min(1).max(120),
    active: z.boolean(),
    role: StaffRoleSchema,
    facilityIds: z.array(z.string().min(1).max(128)).min(1),
    memberships: z.array(AuthorizedFacilityMembershipSchema).min(1),
  })
  .strict();
export type ResolvedStaffProfile = z.infer<typeof ResolvedStaffProfileSchema>;

const VerifiedUserIdentitySchema = z
  .object({
    uid: z.string().min(1).max(128),
    email: z.string().nullable(),
    emailVerified: z.boolean(),
    displayName: z.string().nullable(),
  })
  .strict();

export const PostgresStaffSessionResponseSchema = z.discriminatedUnion(
  "authorizationStatus",
  [
    z
      .object({
        authenticated: z.literal(true),
        verifiedByServer: z.literal(true),
        authMode: AuthModeSchema,
        demoPersona: DemoPersonaSchema.nullable(),
        sessionExpiresAt: z.string().datetime().nullable(),
        projectId: z.string().min(1),
        authorizationModel: z.literal("neon_postgres_server_rbac"),
        user: VerifiedUserIdentitySchema,
        authorizationStatus: z.literal("authorized"),
        staffProfile: ResolvedStaffProfileSchema,
        activeFacility: AuthorizedFacilityMembershipSchema,
      })
      .strict(),
    z
      .object({
        authenticated: z.literal(true),
        verifiedByServer: z.literal(true),
        authMode: z.literal("firebase"),
        demoPersona: z.null(),
        sessionExpiresAt: z.null(),
        projectId: z.string().min(1),
        authorizationModel: z.literal("neon_postgres_server_rbac"),
        user: VerifiedUserIdentitySchema,
        authorizationStatus: z.literal("unprovisioned"),
        staffProfile: z.null(),
        activeFacility: z.null(),
        message: z.string().min(1),
      })
      .strict(),
    z
      .object({
        authenticated: z.literal(true),
        verifiedByServer: z.literal(true),
        authMode: z.literal("firebase"),
        demoPersona: z.null(),
        sessionExpiresAt: z.null(),
        projectId: z.string().min(1),
        authorizationModel: z.literal("neon_postgres_server_rbac"),
        user: VerifiedUserIdentitySchema,
        authorizationStatus: z.literal("inactive"),
        staffProfile: z.null(),
        activeFacility: z.null(),
        message: z.string().min(1),
      })
      .strict(),
  ],
);
export type PostgresStaffSessionResponse = z.infer<
  typeof PostgresStaffSessionResponseSchema
>;

export const StaffQueueItemSchema = z
  .object({
    id: z.string().uuid(),
    facilityId: z.string().min(1).max(128),
    referenceCode: z.string().min(1).max(32),
    patientDisplayName: z.string().max(80).nullable(),
    age: z.number().int().min(0).max(120).nullable(),
    narrativePreview: z.string().max(200).nullable().optional(),
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
        limit: z.number().int().min(1).max(100),
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

export const StaffIntakeEvidenceRecordSchema = z
  .object({
    id: z.string().uuid(),
    intakeId: z.string().uuid(),
    facilityId: z.string().min(1).max(128),
    extractionRunId: z.string().uuid(),
    isCurrent: z.boolean(),
    fieldCategory: EvidenceFieldCategorySchema,
    fieldPath: z.string().min(1).max(120),
    claimValue: z.string().min(1).max(500),
    certainty: CertaintySchema,
    sourceQuote: z.string().min(1).max(500).nullable(),
    verificationStatus: EvidenceVerificationStatusSchema,
    spanStart: z.number().int().min(0).nullable(),
    spanEnd: z.number().int().min(1).nullable(),
    engineVersion: z.string().min(1).max(32),
    narrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeEvidenceRecord = z.infer<
  typeof StaffIntakeEvidenceRecordSchema
>;

export const StaffIntakeAuditEventSchema = z
  .object({
    id: z.string().uuid(),
    facilityId: z.string().min(1).max(128),
    intakeId: z.string().uuid(),
    actorType: AuditActorTypeSchema,
    actorUid: z.string().min(1).max(128).nullable(),
    actorRole: StaffRoleSchema.nullable(),
    actorDisplayName: z.string().min(1).max(120).nullable(),
    action: AuditActionSchema,
    fromValue: z.string().max(120).nullable(),
    toValue: z.string().max(120).nullable(),
    reason: z.string().max(500).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeAuditEvent = z.infer<typeof StaffIntakeAuditEventSchema>;

export const AiBriefProvenanceEnvelopeSchema = z
  .object({
    intakeId: z.string().min(1),
    narrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
    draftAndEvidenceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    modelId: z.string().min(1),
    extractionSchemaVersion: z.string().min(1),
    evidenceEngineVersion: z.string().min(1),
    createdAt: z.string().datetime(),
    hmacSha256: z.string().min(1),
  })
  .strict();

export const StaffIntakeDetailRecordSchema = z
  .object({
    id: z.string().uuid(),
    facilityId: z.string().min(1).max(128),
    referenceCode: z.string().min(1).max(32),
    demoRecord: z.boolean(),
    patientDisplayName: z.string().max(80).nullable(),
    age: z.number().int().min(0).max(120).nullable(),
    patientSource: z
      .object({
        inputMode: InputModeSchema,
        transcriptionStatus: TranscriptionStatusSchema,
        transcriptionModel: z.string().max(80).nullable(),
        transcriptRaw: z.string().max(4000).nullable(),
        confirmedNarrative: z.string().min(5).max(4000),
        confirmedNarrativeSha256: z.string().regex(/^[0-9a-f]{64}$/),
        transcriptConfirmedAt: z.string().datetime().nullable(),
      })
      .strict(),
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
    staffReview: z
      .object({
        status: StaffReviewStatusSchema,
        reviewedBrief: ClinicalIntakeBriefSchema.nullable(),
        correctionNote: z.string().max(500).nullable(),
        reviewedByUid: z.string().max(128).nullable(),
        reviewedAt: z.string().datetime().nullable(),
      })
      .strict(),
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
export type StaffIntakeDetailRecord = z.infer<
  typeof StaffIntakeDetailRecordSchema
>;

export const StaffIntakeDetailResponseSchema = z
  .object({
    facility: AuthorizedFacilityMembershipSchema,
    intake: StaffIntakeDetailRecordSchema,
    evidence: z.array(StaffIntakeEvidenceRecordSchema),
    auditEvents: z.array(StaffIntakeAuditEventSchema),
    fetchedAt: z.string().datetime(),
  })
  .strict();
export type StaffIntakeDetailResponse = z.infer<
  typeof StaffIntakeDetailResponseSchema
>;

export const StaffAdminFacilityOverviewResponseSchema = z
  .object({
    facility: z
      .object({
        facilityId: z.string().min(1).max(128),
        facilityName: z.string().min(1).max(120),
        facilityPublicCode: z.string().min(1).max(64),
        timezone: z.string().min(1).max(64),
        isDemo: z.boolean(),
        active: z.boolean(),
        role: z.literal("admin"),
      })
      .strict(),
    metrics: z
      .object({
        activeStaffCount: z.number().int().min(0),
        totalIntakesCount: z.number().int().min(0),
        unassignedIntakesCount: z.number().int().min(0),
      })
      .strict(),
    roleBoundaries: z
      .object({
        currentRole: z.literal("admin"),
        isDemoSession: z.boolean(),
        canViewAdminOverview: z.literal(true),
        canViewFacilityQueue: z.literal(true),
        staffProvisioningMode: z.literal("cli_seed_only"),
      })
      .strict(),
    fetchedAt: z.string().datetime(),
  })
  .strict();
export type StaffAdminFacilityOverviewResponse = z.infer<
  typeof StaffAdminFacilityOverviewResponseSchema
>;

// =============================================================================
// Milestone 2: Clinical Staff Review, Priority, Status & Extraction Schemas
// =============================================================================

export const StaffStartReviewRequestSchema = z
  .object({
    facilityId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();
export type StaffStartReviewRequest = z.infer<
  typeof StaffStartReviewRequestSchema
>;

export const StaffBriefReviewRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("confirm"),
      facilityId: z.string().trim().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("correct"),
      facilityId: z.string().trim().min(1).max(128).optional(),
      reviewedBrief: ClinicalIntakeBriefSchema,
      correctionNote: z
        .string()
        .trim()
        .min(
          3,
          "A correction note of at least 3 characters is required when editing the intake brief.",
        )
        .max(INTAKE_LIMITS.maxCorrectionNoteLength),
    })
    .strict(),
]);
export type StaffBriefReviewRequest = z.infer<
  typeof StaffBriefReviewRequestSchema
>;

export const AssignableStaffPrioritySchema = z.enum([
  "immediate_review",
  "priority_review",
  "routine_review",
]);
export type AssignableStaffPriority = z.infer<
  typeof AssignableStaffPrioritySchema
>;

export const StaffPriorityMutationRequestSchema = z
  .object({
    facilityId: z.string().trim().min(1).max(128).optional(),
    priority: AssignableStaffPrioritySchema,
    reason: z
      .string()
      .trim()
      .max(INTAKE_LIMITS.maxPriorityReasonLength)
      .optional(),
  })
  .strict();
export type StaffPriorityMutationRequest = z.infer<
  typeof StaffPriorityMutationRequestSchema
>;

export const StaffStatusMutationRequestSchema = z
  .object({
    facilityId: z.string().trim().min(1).max(128).optional(),
    workflowStatus: WorkflowStatusSchema,
    reason: z
      .string()
      .trim()
      .max(INTAKE_LIMITS.maxPriorityReasonLength)
      .optional(),
  })
  .strict();
export type StaffStatusMutationRequest = z.infer<
  typeof StaffStatusMutationRequestSchema
>;

export const IntakeExtractionResponseSchema = z
  .object({
    intakeId: z.string().uuid(),
    referenceCode: z.string().min(1).max(32),
    aiStatus: AiStatusSchema,
    aiModelId: z.string().nullable(),
    aiBrief: ClinicalIntakeBriefSchema.nullable(),
    aiErrorCode: z.string().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IntakeExtractionResponse = z.infer<
  typeof IntakeExtractionResponseSchema
>;
