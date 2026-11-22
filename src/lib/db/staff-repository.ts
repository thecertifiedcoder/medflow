import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, ne, or } from "drizzle-orm";
import { getDb, type MedFlowDatabase } from "@/db";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  intakeEvidence,
  patientIntakes,
  staffProfiles,
} from "@/db/schema";
import { assertServerRuntime } from "@/lib/env/server";
import {
  ClinicalIntakeBriefSchema,
  isAllowedStatusTransition,
  sortIntakesDeterministically,
  type AiStatus,
  type ClinicalIntakeBrief,
  type CreateIntakeRequest,
  type InputMode,
  type StaffAssignedPriority,
  type StaffReviewStatus,
  type StaffRole,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  AssignableStaffPriority,
  AuthorizedFacilityMembership,
  StaffIntakeAuditEvent,
  StaffIntakeDetailRecord,
  StaffIntakeEvidenceRecord,
  StaffQueueItem,
} from "@/lib/schemas/staff-api";

export interface StaffProfileRecord {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly active: boolean;
}

export interface StaffAuthorizationRecord {
  readonly profile: StaffProfileRecord;
  readonly memberships: readonly AuthorizedFacilityMembership[];
}

export interface ListFacilityIntakesParams {
  readonly facilityId: string;
  readonly workflowStatus?: WorkflowStatus;
  readonly priority?: StaffAssignedPriority;
  readonly includeCompleted: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface ListFacilityIntakesResult {
  readonly items: readonly StaffQueueItem[];
  readonly total: number;
  readonly unassignedCount: number;
  readonly aiUnavailableCount: number;
}

export interface FacilityIntakeDetailRecord {
  readonly intake: StaffIntakeDetailRecord;
  readonly evidence: readonly StaffIntakeEvidenceRecord[];
  readonly auditEvents: readonly StaffIntakeAuditEvent[];
}

export interface FacilityAdminOverviewRecord {
  readonly facilityId: string;
  readonly facilityName: string;
  readonly facilityPublicCode: string;
  readonly timezone: string;
  readonly isDemo: boolean;
  readonly active: boolean;
  readonly activeStaffCount: number;
  readonly totalIntakesCount: number;
  readonly unassignedIntakesCount: number;
}

export interface CreatedPatientIntakeResult {
  readonly id: string;
  readonly facilityId: string;
  readonly facilityPublicCode: string;
  readonly referenceCode: string;
  readonly inputMode: InputMode;
  readonly confirmedNarrative: string;
  readonly age: number | null;
  readonly workflowStatus: WorkflowStatus;
  readonly aiStatus: AiStatus;
  readonly createdAt: string;
  readonly deduplicated: boolean;
}

export interface IntakeForExtractionRecord {
  readonly id: string;
  readonly facilityId: string;
  readonly referenceCode: string;
  readonly confirmedNarrative: string;
  readonly inputMode: InputMode;
  readonly age: number | null;
  readonly aiStatus: AiStatus;
  readonly aiModelId: string | null;
  readonly aiBrief: ClinicalIntakeBrief | null;
  readonly aiErrorCode: string | null;
  readonly updatedAt: string;
}

export type StaffMutationResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly status: number;
    };

export interface StaffRepository {
  findStaffAuthorizationByUid(
    uid: string,
  ): Promise<StaffAuthorizationRecord | null>;
  listFacilityIntakes(
    params: ListFacilityIntakesParams,
  ): Promise<ListFacilityIntakesResult>;
  findFacilityIntakeDetail(
    facilityId: string,
    intakeId: string,
  ): Promise<FacilityIntakeDetailRecord | null>;
  getFacilityAdminOverview?(
    facilityId: string,
  ): Promise<FacilityAdminOverviewRecord | null>;
  createPatientIntake?(
    input: CreateIntakeRequest,
  ): Promise<StaffMutationResult<CreatedPatientIntakeResult>>;
  findIntakeForExtraction?(
    intakeId: string,
    facilityId?: string,
  ): Promise<IntakeForExtractionRecord | null>;
  recordIntakeExtractionResult?(params: {
    intakeId: string;
    facilityId: string;
    aiStatus: AiStatus;
    aiModelId: string;
    aiSchemaVersion: string;
    aiBrief: ClinicalIntakeBrief | null;
    aiErrorCode: string | null;
  }): Promise<IntakeForExtractionRecord | null>;
  startStaffIntakeReview?(params: {
    facilityId: string;
    intakeId: string;
    actorUid: string;
    actorRole: StaffRole;
    actorDisplayName?: string;
  }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>>;
  saveStaffBriefReview?(
    params:
      | {
          facilityId: string;
          intakeId: string;
          actorUid: string;
          actorRole: StaffRole;
          actorDisplayName?: string;
          action: "confirm";
        }
      | {
          facilityId: string;
          intakeId: string;
          actorUid: string;
          actorRole: StaffRole;
          actorDisplayName?: string;
          action: "correct";
          reviewedBrief: ClinicalIntakeBrief;
          correctionNote: string;
        },
  ): Promise<StaffMutationResult<FacilityIntakeDetailRecord>>;
  assignOrUpdateStaffPriority?(params: {
    facilityId: string;
    intakeId: string;
    actorUid: string;
    actorRole: StaffRole;
    actorDisplayName?: string;
    priority: AssignableStaffPriority;
    reason?: string;
  }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>>;
  updateStaffWorkflowStatus?(params: {
    facilityId: string;
    intakeId: string;
    actorUid: string;
    actorRole: StaffRole;
    actorDisplayName?: string;
    workflowStatus: WorkflowStatus;
    reason?: string;
  }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>>;
}

function parseAiBriefSafely(raw: unknown): ClinicalIntakeBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = ClinicalIntakeBriefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function computeSha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function generateReferenceCode(now = new Date()): string {
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[bytes[i]! % alphabet.length];
  }
  return `MF-${yyyy}${mm}${dd}-${suffix}`;
}

export function createDrizzleStaffRepository(
  dbInstance?: MedFlowDatabase,
): StaffRepository {
  const resolveDb = (): MedFlowDatabase => {
    assertServerRuntime();
    return dbInstance ?? getDb();
  };

  async function findFacilityIntakeDetailInternal(
    facilityId: string,
    intakeId: string,
  ): Promise<FacilityIntakeDetailRecord | null> {
    const db = resolveDb();

    const [row] = await db
      .select()
      .from(patientIntakes)
      .where(
        and(
          eq(patientIntakes.id, intakeId),
          eq(patientIntakes.facilityId, facilityId),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    const evidenceRows = await db
      .select()
      .from(intakeEvidence)
      .where(
        and(
          eq(intakeEvidence.facilityId, facilityId),
          eq(intakeEvidence.intakeId, intakeId),
          eq(intakeEvidence.isCurrent, true),
        ),
      )
      .orderBy(asc(intakeEvidence.createdAt), asc(intakeEvidence.fieldPath));

    const auditRows = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.facilityId, facilityId),
          eq(auditEvents.intakeId, intakeId),
        ),
      )
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

    const intake: StaffIntakeDetailRecord = {
      id: row.id,
      facilityId: row.facilityId,
      referenceCode: row.referenceCode,
      demoRecord: row.demoRecord,
      patientDisplayName: row.patientDisplayName ?? null,
      age: row.age ?? null,
      patientSource: {
        inputMode: row.inputMode,
        transcriptionStatus: row.transcriptionStatus,
        transcriptionModel: row.transcriptionModel ?? null,
        transcriptRaw: row.transcriptRaw ?? null,
        confirmedNarrative: row.confirmedNarrative,
        confirmedNarrativeSha256: row.confirmedNarrativeSha256,
        transcriptConfirmedAt: row.transcriptConfirmedAt
          ? row.transcriptConfirmedAt.toISOString()
          : null,
      },
      aiDraft: {
        status: row.aiStatus,
        schemaVersion: row.aiSchemaVersion ?? null,
        modelId: row.aiModelId ?? null,
        brief: parseAiBriefSafely(row.aiBrief),
        provenance: row.aiBriefProvenance ?? null,
        errorCode: row.aiErrorCode ?? null,
      },
      staffReview: {
        status: row.staffReviewStatus,
        reviewedBrief: parseAiBriefSafely(row.staffReviewedBrief),
        correctionNote: row.staffCorrectionNote ?? null,
        reviewedByUid: row.reviewedByUid ?? null,
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      },
      workflow: {
        staffAssignedPriority: row.staffAssignedPriority,
        priorityReason: row.priorityReason ?? null,
        workflowStatus: row.workflowStatus,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    const evidence: StaffIntakeEvidenceRecord[] = evidenceRows.map((ev) => ({
      id: ev.id,
      intakeId: ev.intakeId,
      facilityId: ev.facilityId,
      extractionRunId: ev.extractionRunId,
      isCurrent: ev.isCurrent,
      fieldCategory: ev.fieldCategory,
      fieldPath: ev.fieldPath,
      claimValue: ev.claimValue,
      certainty: ev.certainty,
      sourceQuote: ev.sourceQuote ?? null,
      verificationStatus: ev.verificationStatus,
      spanStart: ev.spanStart ?? null,
      spanEnd: ev.spanEnd ?? null,
      engineVersion: ev.engineVersion,
      narrativeSha256: ev.narrativeSha256,
      createdAt: ev.createdAt.toISOString(),
    }));

    const mappedAuditEvents: StaffIntakeAuditEvent[] = auditRows.map((evt) => ({
      id: evt.id,
      facilityId: evt.facilityId,
      intakeId: evt.intakeId,
      actorType: evt.actorType,
      actorUid: evt.actorUid ?? null,
      actorRole: evt.actorRole ?? null,
      actorDisplayName: evt.actorDisplayName ?? null,
      action: evt.action,
      fromValue: evt.fromValue ?? null,
      toValue: evt.toValue ?? null,
      reason: evt.reason ?? null,
      createdAt: evt.createdAt.toISOString(),
    }));

    return {
      intake,
      evidence,
      auditEvents: mappedAuditEvents,
    };
  }

  return {
    async findStaffAuthorizationByUid(
      uid: string,
    ): Promise<StaffAuthorizationRecord | null> {
      const db = resolveDb();

      const [profile] = await db
        .select({
          uid: staffProfiles.uid,
          email: staffProfiles.email,
          displayName: staffProfiles.displayName,
          active: staffProfiles.active,
        })
        .from(staffProfiles)
        .where(eq(staffProfiles.uid, uid))
        .limit(1);

      if (!profile) {
        return null;
      }

      const membershipRows = await db
        .select({
          facilityId: facilities.id,
          facilityName: facilities.name,
          facilityPublicCode: facilities.publicCode,
          role: facilityMemberships.role,
          isDemo: facilities.isDemo,
        })
        .from(facilityMemberships)
        .innerJoin(
          facilities,
          eq(facilities.id, facilityMemberships.facilityId),
        )
        .where(
          and(
            eq(facilityMemberships.staffUid, uid),
            eq(facilityMemberships.active, true),
            eq(facilities.active, true),
          ),
        )
        .orderBy(asc(facilities.id));

      return {
        profile,
        memberships: membershipRows,
      };
    },

    async listFacilityIntakes(
      params: ListFacilityIntakesParams,
    ): Promise<ListFacilityIntakesResult> {
      const db = resolveDb();

      const conditions = [eq(patientIntakes.facilityId, params.facilityId)];

      if (params.workflowStatus) {
        conditions.push(
          eq(patientIntakes.workflowStatus, params.workflowStatus),
        );
      } else if (!params.includeCompleted) {
        conditions.push(ne(patientIntakes.workflowStatus, "completed"));
      }

      if (params.priority) {
        conditions.push(
          eq(patientIntakes.staffAssignedPriority, params.priority),
        );
      }

      const matchingRows = await db
        .select({
          id: patientIntakes.id,
          facilityId: patientIntakes.facilityId,
          referenceCode: patientIntakes.referenceCode,
          patientDisplayName: patientIntakes.patientDisplayName,
          age: patientIntakes.age,
          inputMode: patientIntakes.inputMode,
          transcriptionStatus: patientIntakes.transcriptionStatus,
          aiStatus: patientIntakes.aiStatus,
          staffReviewStatus: patientIntakes.staffReviewStatus,
          staffAssignedPriority: patientIntakes.staffAssignedPriority,
          workflowStatus: patientIntakes.workflowStatus,
          demoRecord: patientIntakes.demoRecord,
          createdAt: patientIntakes.createdAt,
          updatedAt: patientIntakes.updatedAt,
        })
        .from(patientIntakes)
        .where(and(...conditions));

      let unassignedCount = 0;
      let aiUnavailableCount = 0;
      for (const row of matchingRows) {
        if (row.staffAssignedPriority === "unassigned") {
          unassignedCount += 1;
        }
        if (
          row.aiStatus === "failed" ||
          row.aiStatus === "needs_human_clarification"
        ) {
          aiUnavailableCount += 1;
        }
      }

      const sortable = matchingRows.map((row) => ({
        ...row,
        createdAtMs: row.createdAt.getTime(),
      }));
      const sorted = sortIntakesDeterministically(sortable);
      const sliced = sorted.slice(
        params.offset,
        params.offset + params.limit,
      );

      const items: StaffQueueItem[] = sliced.map((row) => ({
        id: row.id,
        facilityId: row.facilityId,
        referenceCode: row.referenceCode,
        patientDisplayName: row.patientDisplayName ?? null,
        age: row.age ?? null,
        inputMode: row.inputMode,
        transcriptionStatus: row.transcriptionStatus,
        aiStatus: row.aiStatus,
        staffReviewStatus: row.staffReviewStatus,
        staffAssignedPriority: row.staffAssignedPriority,
        workflowStatus: row.workflowStatus,
        demoRecord: row.demoRecord,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));

      return {
        items,
        total: matchingRows.length,
        unassignedCount,
        aiUnavailableCount,
      };
    },

    async findFacilityIntakeDetail(
      facilityId: string,
      intakeId: string,
    ): Promise<FacilityIntakeDetailRecord | null> {
      return findFacilityIntakeDetailInternal(facilityId, intakeId);
    },

    async getFacilityAdminOverview(
      facilityId: string,
    ): Promise<FacilityAdminOverviewRecord | null> {
      const db = resolveDb();

      const [facility] = await db
        .select()
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1);

      if (!facility) {
        return null;
      }

      const staffRows = await db
        .select({ id: facilityMemberships.id })
        .from(facilityMemberships)
        .innerJoin(
          staffProfiles,
          eq(staffProfiles.uid, facilityMemberships.staffUid),
        )
        .where(
          and(
            eq(facilityMemberships.facilityId, facilityId),
            eq(facilityMemberships.active, true),
            eq(staffProfiles.active, true),
          ),
        );

      const intakeRows = await db
        .select({
          id: patientIntakes.id,
          staffAssignedPriority: patientIntakes.staffAssignedPriority,
        })
        .from(patientIntakes)
        .where(eq(patientIntakes.facilityId, facilityId));

      let unassignedIntakesCount = 0;
      for (const row of intakeRows) {
        if (row.staffAssignedPriority === "unassigned") {
          unassignedIntakesCount += 1;
        }
      }

      return {
        facilityId: facility.id,
        facilityName: facility.name,
        facilityPublicCode: facility.publicCode,
        timezone: facility.timezone,
        isDemo: facility.isDemo,
        active: facility.active,
        activeStaffCount: staffRows.length,
        totalIntakesCount: intakeRows.length,
        unassignedIntakesCount,
      };
    },

    async createPatientIntake(
      input: CreateIntakeRequest,
    ): Promise<StaffMutationResult<CreatedPatientIntakeResult>> {
      const db = resolveDb();

      const [facility] = await db
        .select({
          id: facilities.id,
          publicCode: facilities.publicCode,
          isDemo: facilities.isDemo,
          active: facilities.active,
        })
        .from(facilities)
        .where(
          and(
            eq(facilities.publicCode, input.facilityPublicCode.trim()),
            eq(facilities.active, true),
          ),
        )
        .limit(1);

      if (!facility) {
        return {
          ok: false,
          code: "FACILITY_NOT_FOUND",
          message: `Active facility with code "${input.facilityPublicCode}" was not found.`,
          status: 404,
        };
      }

      const [existing] = await db
        .select()
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.facilityId, facility.id),
            eq(patientIntakes.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) {
        return {
          ok: true,
          data: {
            id: existing.id,
            facilityId: existing.facilityId,
            facilityPublicCode: facility.publicCode,
            referenceCode: existing.referenceCode,
            inputMode: existing.inputMode,
            confirmedNarrative: existing.confirmedNarrative,
            age: existing.age ?? null,
            workflowStatus: existing.workflowStatus,
            aiStatus: existing.aiStatus,
            createdAt: existing.createdAt.toISOString(),
            deduplicated: true,
          },
        };
      }

      const confirmedNarrativeSha256 = computeSha256Hex(
        input.confirmedNarrative,
      );
      const referenceCode = generateReferenceCode();
      const now = new Date();

      const inserted = await db.transaction(async (tx) => {
        const [newIntake] = await tx
          .insert(patientIntakes)
          .values({
            facilityId: facility.id,
            referenceCode,
            idempotencyKey: input.idempotencyKey,
            demoRecord: facility.isDemo,
            patientDisplayName: input.patientDisplayName?.trim() || null,
            age: input.age ?? null,
            inputMode: input.inputMode,
            transcriptionStatus:
              input.inputMode === "voice" ? "succeeded" : "not_applicable",
            transcriptionModel:
              input.inputMode === "voice" ? "gemini-3.5-transcribe" : null,
            transcriptRaw:
              input.inputMode === "voice"
                ? input.transcriptRaw?.trim() || input.confirmedNarrative
                : null,
            confirmedNarrative: input.confirmedNarrative,
            confirmedNarrativeSha256,
            transcriptConfirmedAt: now,
            aiStatus: "queued",
            workflowStatus: "new",
            staffAssignedPriority: "unassigned",
            staffReviewStatus: "not_reviewed",
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!newIntake) {
          throw new Error("Failed to insert patient intake record.");
        }

        await tx.insert(auditEvents).values({
          facilityId: facility.id,
          intakeId: newIntake.id,
          actorType: "patient",
          actorUid: null,
          actorRole: null,
          actorDisplayName: null,
          action: "intake_created",
          fromValue: null,
          toValue: "new",
          reason: null,
          createdAt: now,
        });

        if (newIntake.inputMode === "voice") {
          await tx.insert(auditEvents).values({
            facilityId: facility.id,
            intakeId: newIntake.id,
            actorType: "patient",
            actorUid: null,
            actorRole: null,
            actorDisplayName: null,
            action: "transcript_confirmed",
            fromValue: null,
            toValue: "confirmed",
            reason: null,
            createdAt: new Date(now.getTime() + 1),
          });
        }

        return newIntake;
      });

      return {
        ok: true,
        data: {
          id: inserted.id,
          facilityId: inserted.facilityId,
          facilityPublicCode: facility.publicCode,
          referenceCode: inserted.referenceCode,
          inputMode: inserted.inputMode,
          confirmedNarrative: inserted.confirmedNarrative,
          age: inserted.age ?? null,
          workflowStatus: inserted.workflowStatus,
          aiStatus: inserted.aiStatus,
          createdAt: inserted.createdAt.toISOString(),
          deduplicated: false,
        },
      };
    },

    async findIntakeForExtraction(
      intakeId: string,
      facilityId?: string,
    ): Promise<IntakeForExtractionRecord | null> {
      const db = resolveDb();
      const conditions = [eq(patientIntakes.id, intakeId)];
      if (facilityId) {
        conditions.push(eq(patientIntakes.facilityId, facilityId));
      }

      const [row] = await db
        .select()
        .from(patientIntakes)
        .where(and(...conditions))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        facilityId: row.facilityId,
        referenceCode: row.referenceCode,
        confirmedNarrative: row.confirmedNarrative,
        inputMode: row.inputMode,
        age: row.age ?? null,
        aiStatus: row.aiStatus,
        aiModelId: row.aiModelId ?? null,
        aiBrief: parseAiBriefSafely(row.aiBrief),
        aiErrorCode: row.aiErrorCode ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    async recordIntakeExtractionResult(params: {
      intakeId: string;
      facilityId: string;
      aiStatus: AiStatus;
      aiModelId: string;
      aiSchemaVersion: string;
      aiBrief: ClinicalIntakeBrief | null;
      aiErrorCode: string | null;
    }): Promise<IntakeForExtractionRecord | null> {
      const db = resolveDb();
      const now = new Date();

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(patientIntakes)
          .set({
            aiStatus: params.aiStatus,
            aiModelId: params.aiModelId,
            aiSchemaVersion: params.aiSchemaVersion,
            aiBrief: params.aiBrief,
            aiErrorCode: params.aiErrorCode,
            updatedAt: now,
          })
          .where(
            and(
              eq(patientIntakes.id, params.intakeId),
              eq(patientIntakes.facilityId, params.facilityId),
            ),
          )
          .returning();

        if (!row) {
          return null;
        }

        const auditAction =
          params.aiStatus === "failed" ? "ai_failed" : "ai_completed";

        await tx.insert(auditEvents).values({
          facilityId: params.facilityId,
          intakeId: params.intakeId,
          actorType: "system",
          actorUid: null,
          actorRole: null,
          actorDisplayName: null,
          action: auditAction,
          fromValue: null,
          toValue: params.aiStatus,
          reason: params.aiErrorCode ?? null,
          createdAt: now,
        });

        return row;
      });

      if (!updated) {
        return null;
      }

      return {
        id: updated.id,
        facilityId: updated.facilityId,
        referenceCode: updated.referenceCode,
        confirmedNarrative: updated.confirmedNarrative,
        inputMode: updated.inputMode,
        age: updated.age ?? null,
        aiStatus: updated.aiStatus,
        aiModelId: updated.aiModelId ?? null,
        aiBrief: parseAiBriefSafely(updated.aiBrief),
        aiErrorCode: updated.aiErrorCode ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      };
    },

    async startStaffIntakeReview(params: {
      facilityId: string;
      intakeId: string;
      actorUid: string;
      actorRole: StaffRole;
      actorDisplayName?: string;
    }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>> {
      const db = resolveDb();

      const [existing] = await db
        .select()
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.id, params.intakeId),
            eq(patientIntakes.facilityId, params.facilityId),
          ),
        )
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found in this facility.",
          status: 404,
        };
      }

      const nextWorkflowStatus: WorkflowStatus =
        existing.workflowStatus === "new"
          ? "in_review"
          : existing.workflowStatus;

      const now = new Date();
      await db.transaction(async (tx) => {
        if (existing.workflowStatus === "new") {
          await tx
            .update(patientIntakes)
            .set({
              workflowStatus: nextWorkflowStatus,
              updatedAt: now,
            })
            .where(
              and(
                eq(patientIntakes.id, params.intakeId),
                eq(patientIntakes.facilityId, params.facilityId),
              ),
            );
        }

        await tx.insert(auditEvents).values({
          facilityId: params.facilityId,
          intakeId: params.intakeId,
          actorType: "staff",
          actorUid: params.actorUid,
          actorRole: params.actorRole,
          actorDisplayName: params.actorDisplayName ?? null,
          action: "review_started",
          fromValue: existing.workflowStatus,
          toValue: nextWorkflowStatus,
          reason: null,
          createdAt: now,
        });
      });

      const detail = await findFacilityIntakeDetailInternal(
        params.facilityId,
        params.intakeId,
      );
      if (!detail) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found after review start.",
          status: 404,
        };
      }

      return { ok: true, data: detail };
    },

    async saveStaffBriefReview(
      params:
        | {
            facilityId: string;
            intakeId: string;
            actorUid: string;
            actorRole: StaffRole;
            actorDisplayName?: string;
            action: "confirm";
          }
        | {
            facilityId: string;
            intakeId: string;
            actorUid: string;
            actorRole: StaffRole;
            actorDisplayName?: string;
            action: "correct";
            reviewedBrief: ClinicalIntakeBrief;
            correctionNote: string;
          },
    ): Promise<StaffMutationResult<FacilityIntakeDetailRecord>> {
      const db = resolveDb();

      const [existing] = await db
        .select()
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.id, params.intakeId),
            eq(patientIntakes.facilityId, params.facilityId),
          ),
        )
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found in this facility.",
          status: 404,
        };
      }

      if (params.action === "confirm" && !existing.aiBrief) {
        return {
          ok: false,
          code: "AI_BRIEF_MISSING",
          message:
            "Cannot confirm an AI brief when no AI draft is available. Run AI extraction or enter a staff-reviewed brief.",
          status: 400,
        };
      }

      const now = new Date();
      const nextWorkflowStatus: WorkflowStatus =
        existing.workflowStatus === "new"
          ? "in_review"
          : existing.workflowStatus;

      const nextReviewStatus: StaffReviewStatus =
        params.action === "confirm" ? "confirmed" : "corrected";
      const nextReviewedBrief: ClinicalIntakeBrief | null =
        params.action === "correct" ? params.reviewedBrief : null;
      const nextCorrectionNote: string | null =
        params.action === "correct" ? params.correctionNote.trim() : null;
      const auditAction =
        params.action === "confirm" ? "brief_confirmed" : "brief_corrected";

      await db.transaction(async (tx) => {
        await tx
          .update(patientIntakes)
          .set({
            staffReviewStatus: nextReviewStatus,
            staffReviewedBrief: nextReviewedBrief,
            staffCorrectionNote: nextCorrectionNote,
            reviewedByUid: params.actorUid,
            reviewedAt: now,
            workflowStatus: nextWorkflowStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(patientIntakes.id, params.intakeId),
              eq(patientIntakes.facilityId, params.facilityId),
            ),
          );

        await tx.insert(auditEvents).values({
          facilityId: params.facilityId,
          intakeId: params.intakeId,
          actorType: "staff",
          actorUid: params.actorUid,
          actorRole: params.actorRole,
          actorDisplayName: params.actorDisplayName ?? null,
          action: auditAction,
          fromValue: existing.staffReviewStatus,
          toValue: nextReviewStatus,
          reason: nextCorrectionNote,
          createdAt: now,
        });
      });

      const detail = await findFacilityIntakeDetailInternal(
        params.facilityId,
        params.intakeId,
      );
      if (!detail) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found after brief review.",
          status: 404,
        };
      }

      return { ok: true, data: detail };
    },

    async assignOrUpdateStaffPriority(params: {
      facilityId: string;
      intakeId: string;
      actorUid: string;
      actorRole: StaffRole;
      actorDisplayName?: string;
      priority: AssignableStaffPriority;
      reason?: string;
    }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>> {
      const db = resolveDb();

      const [existing] = await db
        .select()
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.id, params.intakeId),
            eq(patientIntakes.facilityId, params.facilityId),
          ),
        )
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found in this facility.",
          status: 404,
        };
      }

      const trimmedReason = params.reason?.trim() || null;
      const isInitialAssignment =
        existing.staffAssignedPriority === "unassigned";

      if (!isInitialAssignment && (!trimmedReason || trimmedReason.length < 3)) {
        return {
          ok: false,
          code: "PRIORITY_REASON_REQUIRED",
          message:
            "A reason of at least 3 characters is required when changing an already-assigned operational priority.",
          status: 400,
        };
      }

      const now = new Date();
      const nextWorkflowStatus: WorkflowStatus =
        existing.workflowStatus === "new"
          ? "in_review"
          : existing.workflowStatus;
      const auditAction = isInitialAssignment
        ? "priority_assigned"
        : "priority_changed";

      await db.transaction(async (tx) => {
        await tx
          .update(patientIntakes)
          .set({
            staffAssignedPriority: params.priority as StaffAssignedPriority,
            priorityReason: trimmedReason ?? existing.priorityReason ?? null,
            workflowStatus: nextWorkflowStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(patientIntakes.id, params.intakeId),
              eq(patientIntakes.facilityId, params.facilityId),
            ),
          );

        await tx.insert(auditEvents).values({
          facilityId: params.facilityId,
          intakeId: params.intakeId,
          actorType: "staff",
          actorUid: params.actorUid,
          actorRole: params.actorRole,
          actorDisplayName: params.actorDisplayName ?? null,
          action: auditAction,
          fromValue: existing.staffAssignedPriority,
          toValue: params.priority,
          reason: trimmedReason,
          createdAt: now,
        });
      });

      const detail = await findFacilityIntakeDetailInternal(
        params.facilityId,
        params.intakeId,
      );
      if (!detail) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message:
            "Requested patient intake was not found after priority update.",
          status: 404,
        };
      }

      return { ok: true, data: detail };
    },

    async updateStaffWorkflowStatus(params: {
      facilityId: string;
      intakeId: string;
      actorUid: string;
      actorRole: StaffRole;
      actorDisplayName?: string;
      workflowStatus: WorkflowStatus;
      reason?: string;
    }): Promise<StaffMutationResult<FacilityIntakeDetailRecord>> {
      const db = resolveDb();

      const [existing] = await db
        .select()
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.id, params.intakeId),
            eq(patientIntakes.facilityId, params.facilityId),
          ),
        )
        .limit(1);

      if (!existing) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message: "Requested patient intake was not found in this facility.",
          status: 404,
        };
      }

      if (
        !isAllowedStatusTransition(
          existing.workflowStatus,
          params.workflowStatus,
        )
      ) {
        return {
          ok: false,
          code: "INVALID_WORKFLOW_STATUS_TRANSITION",
          message: `Cannot transition workflow status from "${existing.workflowStatus}" to "${params.workflowStatus}".`,
          status: 400,
        };
      }

      const trimmedReason = params.reason?.trim() || null;
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(patientIntakes)
          .set({
            workflowStatus: params.workflowStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(patientIntakes.id, params.intakeId),
              eq(patientIntakes.facilityId, params.facilityId),
            ),
          );

        await tx.insert(auditEvents).values({
          facilityId: params.facilityId,
          intakeId: params.intakeId,
          actorType: "staff",
          actorUid: params.actorUid,
          actorRole: params.actorRole,
          actorDisplayName: params.actorDisplayName ?? null,
          action: "status_changed",
          fromValue: existing.workflowStatus,
          toValue: params.workflowStatus,
          reason: trimmedReason,
          createdAt: now,
        });
      });

      const detail = await findFacilityIntakeDetailInternal(
        params.facilityId,
        params.intakeId,
      );
      if (!detail) {
        return {
          ok: false,
          code: "INTAKE_NOT_FOUND",
          message:
            "Requested patient intake was not found after status transition.",
          status: 404,
        };
      }

      return { ok: true, data: detail };
    },
  };
}
