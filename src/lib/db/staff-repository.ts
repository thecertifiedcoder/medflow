import { and, asc, eq, ne, sql, type SQL } from "drizzle-orm";
import { getDb, type MedFlowDatabase } from "@/db";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  intakeEvidence,
  patientIntakes,
  staffProfiles,
  type AiBriefProvenanceEnvelope,
} from "@/db/schema";
import { assertServerRuntime } from "@/lib/env/server";
import type {
  AiStatus,
  AuditAction,
  AuditActorType,
  Certainty,
  ClinicalIntakeBrief,
  InputMode,
  StaffAssignedPriority,
  StaffReviewStatus,
  StaffRole,
  TranscriptionStatus,
  WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  AuthorizedFacilityMembership,
  EvidenceFieldCategory,
  EvidenceVerificationStatus,
  StaffIntakeAuditEvent,
  StaffIntakeDetail,
  StaffIntakeEvidenceItem,
  StaffQueueItem,
} from "@/lib/schemas/staff-api";

export interface StaffAuthorizationRecord {
  readonly profile: {
    readonly uid: string;
    readonly email: string;
    readonly displayName: string;
    readonly active: boolean;
  };
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
  readonly intake: StaffIntakeDetail;
  readonly evidence: readonly StaffIntakeEvidenceItem[];
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

/**
 * Reusable server-only repository boundary for Neon PostgreSQL clinical staff reads.
 * Every tenant-owned method requires an explicit, server-verified `facilityId`.
 */
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
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return toIso(value);
}

/**
 * Creates the authoritative Drizzle ORM implementation of StaffRepository.
 * Lazily resolves the pooled DATABASE_URL connection only when a query executes.
 */
export function createDrizzleStaffRepository(
  dbOverride?: MedFlowDatabase,
): StaffRepository {
  assertServerRuntime();

  const resolveDb = (): MedFlowDatabase => dbOverride ?? getDb();

  return {
    async findStaffAuthorizationByUid(
      uid: string,
    ): Promise<StaffAuthorizationRecord | null> {
      assertServerRuntime();
      const db = resolveDb();

      const profileRows = await db
        .select({
          uid: staffProfiles.uid,
          email: staffProfiles.email,
          displayName: staffProfiles.displayName,
          active: staffProfiles.active,
        })
        .from(staffProfiles)
        .where(eq(staffProfiles.uid, uid))
        .limit(1);

      const profile = profileRows[0];
      if (!profile) {
        return null;
      }

      if (!profile.active) {
        return {
          profile,
          memberships: [],
        };
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
          eq(facilityMemberships.facilityId, facilities.id),
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
        memberships: membershipRows.map((row) => ({
          facilityId: row.facilityId,
          facilityName: row.facilityName,
          facilityPublicCode: row.facilityPublicCode,
          role: row.role as StaffRole,
          isDemo: row.isDemo,
        })),
      };
    },

    async listFacilityIntakes(
      params: ListFacilityIntakesParams,
    ): Promise<ListFacilityIntakesResult> {
      assertServerRuntime();
      const db = resolveDb();

      // Mandatory facility filter: every query is strictly tenant-scoped on the server.
      const conditions: SQL[] = [
        eq(patientIntakes.facilityId, params.facilityId),
      ];

      if (params.workflowStatus) {
        conditions.push(eq(patientIntakes.workflowStatus, params.workflowStatus));
      } else if (!params.includeCompleted) {
        conditions.push(ne(patientIntakes.workflowStatus, "completed"));
      }

      if (params.priority) {
        conditions.push(
          eq(patientIntakes.staffAssignedPriority, params.priority),
        );
      }

      const whereClause = and(...conditions);

      // Deterministic queue ordering per docs/13 FR-11 & docs/08 §9:
      // 0: unassigned, 1: immediate_review, 2: priority_review, 3: routine_review,
      // then oldest submission first, then stable UUID tiebreaker.
      const priorityRankSql = sql<number>`CASE ${patientIntakes.staffAssignedPriority}
        WHEN 'unassigned' THEN 0
        WHEN 'immediate_review' THEN 1
        WHEN 'priority_review' THEN 2
        WHEN 'routine_review' THEN 3
        ELSE 4
      END`;

      const [rows, aggregateRows] = await Promise.all([
        db
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
          .where(whereClause)
          .orderBy(
            asc(priorityRankSql),
            asc(patientIntakes.createdAt),
            asc(patientIntakes.id),
          )
          .limit(params.limit)
          .offset(params.offset),
        db
          .select({
            total: sql<number>`count(*)::int`,
            unassignedCount: sql<number>`count(*) filter (where ${patientIntakes.staffAssignedPriority} = 'unassigned')::int`,
            aiUnavailableCount: sql<number>`count(*) filter (where ${patientIntakes.aiStatus} in ('failed', 'needs_human_clarification'))::int`,
          })
          .from(patientIntakes)
          .where(whereClause),
      ]);

      const totals = aggregateRows[0] ?? {
        total: 0,
        unassignedCount: 0,
        aiUnavailableCount: 0,
      };

      const items: StaffQueueItem[] = rows.map((row) => ({
        id: row.id,
        facilityId: row.facilityId,
        referenceCode: row.referenceCode,
        patientDisplayName: row.patientDisplayName ?? null,
        age: row.age ?? null,
        inputMode: row.inputMode as InputMode,
        transcriptionStatus: row.transcriptionStatus as TranscriptionStatus,
        aiStatus: row.aiStatus as AiStatus,
        staffReviewStatus: row.staffReviewStatus as StaffReviewStatus,
        staffAssignedPriority:
          row.staffAssignedPriority as StaffAssignedPriority,
        workflowStatus: row.workflowStatus as WorkflowStatus,
        demoRecord: row.demoRecord,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      }));

      return {
        items,
        total: Number(totals.total ?? 0),
        unassignedCount: Number(totals.unassignedCount ?? 0),
        aiUnavailableCount: Number(totals.aiUnavailableCount ?? 0),
      };
    },

    async findFacilityIntakeDetail(
      facilityId: string,
      intakeId: string,
    ): Promise<FacilityIntakeDetailRecord | null> {
      assertServerRuntime();
      const db = resolveDb();

      // Strictly scoped by BOTH intake id and server-verified facility_id.
      // Cross-facility records return null, preventing cross-tenant existence disclosure.
      const intakeRows = await db
        .select({
          id: patientIntakes.id,
          facilityId: patientIntakes.facilityId,
          referenceCode: patientIntakes.referenceCode,
          demoRecord: patientIntakes.demoRecord,
          patientDisplayName: patientIntakes.patientDisplayName,
          age: patientIntakes.age,
          inputMode: patientIntakes.inputMode,
          transcriptionStatus: patientIntakes.transcriptionStatus,
          transcriptionModel: patientIntakes.transcriptionModel,
          transcriptRaw: patientIntakes.transcriptRaw,
          confirmedNarrative: patientIntakes.confirmedNarrative,
          confirmedNarrativeSha256: patientIntakes.confirmedNarrativeSha256,
          transcriptConfirmedAt: patientIntakes.transcriptConfirmedAt,
          aiStatus: patientIntakes.aiStatus,
          aiSchemaVersion: patientIntakes.aiSchemaVersion,
          aiModelId: patientIntakes.aiModelId,
          aiBrief: patientIntakes.aiBrief,
          aiBriefProvenance: patientIntakes.aiBriefProvenance,
          aiErrorCode: patientIntakes.aiErrorCode,
          staffReviewStatus: patientIntakes.staffReviewStatus,
          staffReviewedBrief: patientIntakes.staffReviewedBrief,
          staffCorrectionNote: patientIntakes.staffCorrectionNote,
          reviewedByUid: patientIntakes.reviewedByUid,
          reviewedAt: patientIntakes.reviewedAt,
          staffAssignedPriority: patientIntakes.staffAssignedPriority,
          priorityReason: patientIntakes.priorityReason,
          workflowStatus: patientIntakes.workflowStatus,
          createdAt: patientIntakes.createdAt,
          updatedAt: patientIntakes.updatedAt,
        })
        .from(patientIntakes)
        .where(
          and(
            eq(patientIntakes.id, intakeId),
            eq(patientIntakes.facilityId, facilityId),
          ),
        )
        .limit(1);

      const row = intakeRows[0];
      if (!row) {
        return null;
      }

      const [evidenceRows, auditRows] = await Promise.all([
        db
          .select({
            id: intakeEvidence.id,
            intakeId: intakeEvidence.intakeId,
            facilityId: intakeEvidence.facilityId,
            extractionRunId: intakeEvidence.extractionRunId,
            isCurrent: intakeEvidence.isCurrent,
            fieldCategory: intakeEvidence.fieldCategory,
            fieldPath: intakeEvidence.fieldPath,
            claimValue: intakeEvidence.claimValue,
            certainty: intakeEvidence.certainty,
            sourceQuote: intakeEvidence.sourceQuote,
            verificationStatus: intakeEvidence.verificationStatus,
            spanStart: intakeEvidence.spanStart,
            spanEnd: intakeEvidence.spanEnd,
            engineVersion: intakeEvidence.engineVersion,
            narrativeSha256: intakeEvidence.narrativeSha256,
            createdAt: intakeEvidence.createdAt,
          })
          .from(intakeEvidence)
          .where(
            and(
              eq(intakeEvidence.facilityId, facilityId),
              eq(intakeEvidence.intakeId, intakeId),
              eq(intakeEvidence.isCurrent, true),
            ),
          )
          .orderBy(
            asc(intakeEvidence.fieldCategory),
            asc(intakeEvidence.fieldPath),
            asc(intakeEvidence.createdAt),
          ),
        db
          .select({
            id: auditEvents.id,
            facilityId: auditEvents.facilityId,
            intakeId: auditEvents.intakeId,
            actorType: auditEvents.actorType,
            actorUid: auditEvents.actorUid,
            actorRole: auditEvents.actorRole,
            actorDisplayName: auditEvents.actorDisplayName,
            action: auditEvents.action,
            fromValue: auditEvents.fromValue,
            toValue: auditEvents.toValue,
            reason: auditEvents.reason,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.facilityId, facilityId),
              eq(auditEvents.intakeId, intakeId),
            ),
          )
          .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id)),
      ]);

      const intake: StaffIntakeDetail = {
        id: row.id,
        facilityId: row.facilityId,
        referenceCode: row.referenceCode,
        demoRecord: row.demoRecord,
        patientDisplayName: row.patientDisplayName ?? null,
        age: row.age ?? null,
        patientSource: {
          inputMode: row.inputMode as InputMode,
          transcriptionStatus: row.transcriptionStatus as TranscriptionStatus,
          transcriptionModel: row.transcriptionModel ?? null,
          transcriptRaw: row.transcriptRaw ?? null,
          confirmedNarrative: row.confirmedNarrative,
          confirmedNarrativeSha256: row.confirmedNarrativeSha256,
          transcriptConfirmedAt: toNullableIso(row.transcriptConfirmedAt),
        },
        aiDraft: {
          status: row.aiStatus as AiStatus,
          schemaVersion: row.aiSchemaVersion ?? null,
          modelId: row.aiModelId ?? null,
          brief: (row.aiBrief ?? null) as ClinicalIntakeBrief | null,
          provenance: (row.aiBriefProvenance ??
            null) as AiBriefProvenanceEnvelope | null,
          errorCode: row.aiErrorCode ?? null,
        },
        staffReview: {
          status: row.staffReviewStatus as StaffReviewStatus,
          reviewedBrief: (row.staffReviewedBrief ??
            null) as ClinicalIntakeBrief | null,
          correctionNote: row.staffCorrectionNote ?? null,
          reviewedByUid: row.reviewedByUid ?? null,
          reviewedAt: toNullableIso(row.reviewedAt),
        },
        workflow: {
          staffAssignedPriority:
            row.staffAssignedPriority as StaffAssignedPriority,
          priorityReason: row.priorityReason ?? null,
          workflowStatus: row.workflowStatus as WorkflowStatus,
        },
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      };

      const evidence: StaffIntakeEvidenceItem[] = evidenceRows.map((ev) => ({
        id: ev.id,
        intakeId: ev.intakeId,
        facilityId: ev.facilityId,
        extractionRunId: ev.extractionRunId,
        isCurrent: ev.isCurrent,
        fieldCategory: ev.fieldCategory as EvidenceFieldCategory,
        fieldPath: ev.fieldPath,
        claimValue: ev.claimValue,
        certainty: ev.certainty as Certainty,
        sourceQuote: ev.sourceQuote ?? null,
        verificationStatus: ev.verificationStatus as EvidenceVerificationStatus,
        spanStart: ev.spanStart ?? null,
        spanEnd: ev.spanEnd ?? null,
        engineVersion: ev.engineVersion,
        narrativeSha256: ev.narrativeSha256,
        createdAt: toIso(ev.createdAt),
      }));

      const audit: StaffIntakeAuditEvent[] = auditRows.map((evt) => ({
        id: evt.id,
        facilityId: evt.facilityId,
        intakeId: evt.intakeId,
        actorType: evt.actorType as AuditActorType,
        actorUid: evt.actorUid ?? null,
        actorRole: (evt.actorRole ?? null) as StaffRole | null,
        actorDisplayName: evt.actorDisplayName ?? null,
        action: evt.action as AuditAction,
        fromValue: evt.fromValue ?? null,
        toValue: evt.toValue ?? null,
        reason: evt.reason ?? null,
        createdAt: toIso(evt.createdAt),
      }));

      return {
        intake,
        evidence,
        auditEvents: audit,
      };
    },

    async getFacilityAdminOverview(
      facilityId: string,
    ): Promise<FacilityAdminOverviewRecord | null> {
      assertServerRuntime();
      const db = resolveDb();

      const facilityRows = await db
        .select({
          id: facilities.id,
          name: facilities.name,
          publicCode: facilities.publicCode,
          timezone: facilities.timezone,
          isDemo: facilities.isDemo,
          active: facilities.active,
        })
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1);

      const facilityRow = facilityRows[0];
      if (!facilityRow) {
        return null;
      }

      const [staffCounts, intakeCounts] = await Promise.all([
        db
          .select({
            activeStaffCount: sql<number>`count(*)::int`,
          })
          .from(facilityMemberships)
          .innerJoin(
            staffProfiles,
            eq(facilityMemberships.staffUid, staffProfiles.uid),
          )
          .where(
            and(
              eq(facilityMemberships.facilityId, facilityId),
              eq(facilityMemberships.active, true),
              eq(staffProfiles.active, true),
            ),
          ),
        db
          .select({
            totalIntakesCount: sql<number>`count(*)::int`,
            unassignedIntakesCount: sql<number>`count(*) filter (where ${patientIntakes.staffAssignedPriority} = 'unassigned')::int`,
          })
          .from(patientIntakes)
          .where(eq(patientIntakes.facilityId, facilityId)),
      ]);

      return {
        facilityId: facilityRow.id,
        facilityName: facilityRow.name,
        facilityPublicCode: facilityRow.publicCode,
        timezone: facilityRow.timezone,
        isDemo: facilityRow.isDemo,
        active: facilityRow.active,
        activeStaffCount: Number(staffCounts[0]?.activeStaffCount ?? 0),
        totalIntakesCount: Number(intakeCounts[0]?.totalIntakesCount ?? 0),
        unassignedIntakesCount: Number(
          intakeCounts[0]?.unassignedIntakesCount ?? 0,
        ),
      };
    },
  };
}
