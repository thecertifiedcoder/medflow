/**
 * MedFlow Idempotent Synthetic Seed Script
 *
 * Canonical synthetic facility (per ADR D-020):
 * - id: "demo-clinic-01"
 * - public_code: "DEMO-CLINIC-01"
 * - name: "MedFlow Synthetic Demo Clinic"
 *
 * Also seeds:
 * - 2 active synthetic staff accounts (demo-admin-01, demo-staff-01)
 * - 5 synthetic patient intakes (MF-DEMO-0101 .. MF-DEMO-0105) with their audit events
 */

import { createHash } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  CANONICAL_DEMO_FACILITY,
  SYNTHETIC_DEMO_IDENTITIES,
} from "@/db/invariants";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  patientIntakes,
  staffProfiles,
} from "@/db/schema";
import { getMigrationDatabaseUrl } from "@/lib/env/server";
import type { ClinicalIntakeBrief } from "@/lib/schemas/intake";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const NARRATIVE_0101 =
  "I have had chest tightness and dizziness since 6am this morning after climbing the stairs. When I sit down it eases a bit, but my heart still feels fast and I have not taken any medication today.";

const BRIEF_0101: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value: "Chest tightness and dizziness since 6am after climbing stairs",
    sourceQuote:
      "chest tightness and dizziness since 6am this morning after climbing the stairs",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Chest tightness",
      duration: "Since 6am this morning",
      severity: "Eases slightly when sitting down",
      certainty: "explicit",
      sourceQuote: "chest tightness and dizziness since 6am this morning",
    },
    {
      value: "Dizziness",
      duration: "Since 6am this morning",
      severity: null,
      certainty: "explicit",
      sourceQuote: "chest tightness and dizziness since 6am this morning",
    },
    {
      value: "Fast heartbeat sensation",
      duration: null,
      severity: null,
      certainty: "explicit",
      sourceQuote: "my heart still feels fast",
    },
  ],
  relevantContext: [
    {
      value: "No medication taken today",
      certainty: "explicit",
      sourceQuote: "I have not taken any medication today",
    },
  ],
  reportedDetailsToReview: [
    {
      detail: "Exertional onset of chest tightness with persistent fast heartbeat sensation",
      sourceQuote:
        "chest tightness and dizziness since 6am this morning after climbing the stairs",
      context: "Reported directly by patient in typed intake",
    },
  ],
  missingOrUnclear: [
    "Known cardiovascular history or hypertension status not reported",
    "Drug allergies not stated",
    "Whether chest tightness radiates to arm, jaw, or back",
  ],
  clinicianSummary:
    "Patient reports onset of chest tightness and dizziness at 6am today after climbing stairs, partially easing at rest with ongoing sensation of a fast heartbeat. No medications taken today. Past medical history and allergies remain unstated.",
  limitations: [
    "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
  ],
};

const TRANSCRIPT_RAW_0102 =
  "Good morning nurse, since three days now my body dey hot well well especially for night and my belle dey turn me when I chop.";

const NARRATIVE_0102 =
  "Good morning nurse, since three days now my body dey hot well well especially for night and my belle dey turn me when I eat anything. I took paracetamol yesterday night.";

const BRIEF_0102: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en-NG",
  chiefConcern: {
    value:
      "Three-day fever ('body dey hot') worsening at night with post-meal nausea ('belle dey turn me')",
    sourceQuote:
      "since three days now my body dey hot well well especially for night and my belle dey turn me when I eat anything",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Fever / hot body sensation",
      duration: "3 days",
      severity: "Reported as 'well well' especially at night",
      certainty: "explicit",
      sourceQuote:
        "since three days now my body dey hot well well especially for night",
    },
    {
      value: "Nausea / stomach upset after eating",
      duration: "3 days",
      severity: null,
      certainty: "explicit",
      sourceQuote: "my belle dey turn me when I eat anything",
    },
  ],
  relevantContext: [
    {
      value: "Took paracetamol last night",
      certainty: "explicit",
      sourceQuote: "I took paracetamol yesterday night",
    },
  ],
  reportedDetailsToReview: [
    {
      detail:
        "Nigerian Pidgin expression of 3-day nocturnal fever and post-prandial nausea",
      sourceQuote:
        "my body dey hot well well especially for night and my belle dey turn me when I eat anything",
      context: "Voice transcript edited and confirmed by patient",
    },
  ],
  missingOrUnclear: [
    "Measured thermometer temperature not provided",
    "Presence or absence of vomiting or diarrhea not specified",
    "Known medication allergies not stated",
  ],
  clinicianSummary:
    "Voice intake (Nigerian English/Pidgin, confirmed and edited by patient) reporting a 3-day history of feverishness worse at night and nausea after eating. Patient self-administered paracetamol last night. Hydration status and vomiting history require nurse verification.",
  limitations: [
    "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
  ],
};

const NARRATIVE_0103 =
  "I just do not feel right today and my body feels strange. Please I want to talk to someone at the desk when it is my turn.";

const BRIEF_0103: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value:
      "Generalised unspecified malaise ('do not feel right today'); requires direct human clarification",
    sourceQuote: "I just do not feel right today and my body feels strange",
    certainty: "unclear",
  },
  symptoms: [],
  relevantContext: [],
  reportedDetailsToReview: [
    {
      detail: "Patient requested direct conversation at the desk due to vague symptoms",
      sourceQuote: "I just do not feel right today and my body feels strange",
      context: "Narrative lacks specific anatomical or symptom details",
    },
  ],
  missingOrUnclear: [
    "Specific primary symptom or anatomical location not described",
    "Onset time and severity not provided",
    "Current medications, allergies, and medical history not provided",
  ],
  clinicianSummary:
    "Patient submitted a brief narrative stating they do not feel right today and requested to speak with staff directly. No specific symptoms, duration, or medical history were provided; flagged for direct human clarification.",
  limitations: [
    "Narrative is intentionally vague; direct clinical staff interview required.",
  ],
};

const NARRATIVE_0104 =
  "I have sharp lower abdominal pain on my right side and I feel nauseous. I am allergic to penicillin.";

const BRIEF_0104: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value: "Sharp right-sided lower abdominal pain with nausea",
    sourceQuote:
      "sharp lower abdominal pain on my right side and I feel nauseous",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Right lower abdominal pain",
      duration: null,
      severity: "Sharp",
      certainty: "explicit",
      sourceQuote: "sharp lower abdominal pain on my right side",
    },
    {
      value: "Nausea",
      duration: null,
      severity: null,
      certainty: "explicit",
      sourceQuote: "I feel nauseous",
    },
  ],
  relevantContext: [
    {
      value: "Allergic to penicillin",
      certainty: "explicit",
      sourceQuote: "I am allergic to penicillin",
    },
  ],
  reportedDetailsToReview: [
    {
      detail:
        "Localized sharp right lower abdominal pain with documented penicillin allergy",
      sourceQuote:
        "sharp lower abdominal pain on my right side and I feel nauseous",
      context: "Onset duration and severity require immediate nurse verification",
    },
  ],
  missingOrUnclear: [
    "Onset time and duration of the right lower abdominal pain are missing",
    "Numeric or functional pain severity not stated",
    "Fever, vomiting, or pregnancy status not reported",
  ],
  clinicianSummary:
    "Patient reports sharp right lower abdominal pain accompanied by nausea and states a penicillin allergy. Duration and exact onset of the pain were omitted from the narrative and require immediate staff verification.",
  limitations: [
    "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
  ],
};

const NARRATIVE_0105 =
  "I have had a dry cough for five days that keeps waking me up at night. I take amlodipine 5mg daily for blood pressure and I have no known drug allergies.";

const AI_BRIEF_0105: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value: "Dry cough for five days",
    sourceQuote: "dry cough for five days that keeps waking me up at night",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Dry cough",
      duration: "5 days",
      severity: null,
      certainty: "explicit",
      sourceQuote: "dry cough for five days that keeps waking me up at night",
    },
  ],
  relevantContext: [
    {
      value: "Takes amlodipine 5mg daily for blood pressure",
      certainty: "explicit",
      sourceQuote: "I take amlodipine 5mg daily for blood pressure",
    },
    {
      value: "No known drug allergies",
      certainty: "explicit",
      sourceQuote: "I have no known drug allergies",
    },
  ],
  reportedDetailsToReview: [
    {
      detail: "Five-day nocturnal dry cough in patient on antihypertensive therapy",
      sourceQuote: "dry cough for five days that keeps waking me up at night",
      context: "Patient on daily amlodipine 5mg",
    },
  ],
  missingOrUnclear: [
    "Presence or absence of fever or shortness of breath not stated",
  ],
  clinicianSummary:
    "Patient reports a 5-day history of dry cough waking them at night. Currently taking amlodipine 5mg daily for hypertension and reports no known drug allergies.",
  limitations: [
    "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
  ],
};

const STAFF_REVIEWED_BRIEF_0105: ClinicalIntakeBrief = {
  ...AI_BRIEF_0105,
  chiefConcern: {
    value:
      "Nocturnal dry cough for 5 days (staff verified: no fever or dyspnea at rest)",
    sourceQuote: "dry cough for five days that keeps waking me up at night",
    certainty: "explicit",
  },
  missingOrUnclear: [],
  clinicianSummary:
    "Staff-reviewed brief: Patient reports a 5-day nocturnal dry cough. Nurse verification confirmed no fever, no chest pain, and no shortness of breath at rest. Takes amlodipine 5mg daily; no known drug allergies.",
  limitations: [
    "Reviewed and updated by clinical intake nurse during patient check-in.",
  ],
};

async function runSeed(): Promise<void> {
  const connectionString = getMigrationDatabaseUrl();
  const isLocalhost =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1");

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15_000,
    ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
  });

  try {
    const db = drizzle(pool);
    const now = new Date();

    console.log(
      `[MedFlow Seed] Upserting canonical facility: ${CANONICAL_DEMO_FACILITY.id} (${CANONICAL_DEMO_FACILITY.publicCode})...`,
    );

    await db
      .insert(facilities)
      .values({
        id: CANONICAL_DEMO_FACILITY.id,
        name: CANONICAL_DEMO_FACILITY.name,
        publicCode: CANONICAL_DEMO_FACILITY.publicCode,
        timezone: CANONICAL_DEMO_FACILITY.timezone,
        isDemo: CANONICAL_DEMO_FACILITY.isDemo,
        active: CANONICAL_DEMO_FACILITY.active,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: facilities.id,
        set: {
          name: CANONICAL_DEMO_FACILITY.name,
          publicCode: CANONICAL_DEMO_FACILITY.publicCode,
          timezone: CANONICAL_DEMO_FACILITY.timezone,
          isDemo: CANONICAL_DEMO_FACILITY.isDemo,
          active: CANONICAL_DEMO_FACILITY.active,
          updatedAt: now,
        },
      });

    const syntheticIdentities = [
      SYNTHETIC_DEMO_IDENTITIES.admin,
      SYNTHETIC_DEMO_IDENTITIES.clinical_staff,
    ] as const;

    for (const identity of syntheticIdentities) {
      console.log(
        `[MedFlow Seed] Upserting synthetic staff profile & membership: ${identity.uid} (${identity.role})...`,
      );

      await db
        .insert(staffProfiles)
        .values({
          uid: identity.uid,
          email: identity.email,
          displayName: identity.displayName,
          active: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: staffProfiles.uid,
          set: {
            email: identity.email,
            displayName: identity.displayName,
            active: true,
            updatedAt: now,
          },
        });

      await db
        .insert(facilityMemberships)
        .values({
          staffUid: identity.uid,
          facilityId: identity.facilityId,
          role: identity.role,
          active: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [facilityMemberships.staffUid, facilityMemberships.facilityId],
          set: {
            role: identity.role,
            active: true,
            updatedAt: now,
          },
        });
    }

    const nurseIdentity = SYNTHETIC_DEMO_IDENTITIES.clinical_staff;

    const syntheticIntakes = [
      {
        id: "00000000-0000-4000-8000-000000000101",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        referenceCode: "MF-DEMO-0101",
        idempotencyKey: "seed-demo-intake-0101",
        demoRecord: true,
        patientDisplayName: "Oluwaseun Adeyemi",
        age: 54,
        inputMode: "typed" as const,
        transcriptionStatus: "not_applicable" as const,
        transcriptionModel: null,
        transcriptRaw: null,
        confirmedNarrative: NARRATIVE_0101,
        confirmedNarrativeSha256: sha256Hex(NARRATIVE_0101),
        transcriptConfirmedAt: new Date(now.getTime() - 45 * 60 * 1000),
        aiStatus: "succeeded" as const,
        aiSchemaVersion: "1.0",
        aiModelId: "gemini-4-hydrogen",
        aiBrief: BRIEF_0101,
        aiBriefProvenance: null,
        aiErrorCode: null,
        staffReviewStatus: "not_reviewed" as const,
        staffReviewedBrief: null,
        staffCorrectionNote: null,
        reviewedByUid: null,
        reviewedAt: null,
        staffAssignedPriority: "unassigned" as const,
        priorityReason: null,
        workflowStatus: "new" as const,
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 44 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        referenceCode: "MF-DEMO-0102",
        idempotencyKey: "seed-demo-intake-0102",
        demoRecord: true,
        patientDisplayName: "Ngozi Chukwu",
        age: 29,
        inputMode: "voice" as const,
        transcriptionStatus: "succeeded" as const,
        transcriptionModel: "gemini-3.5-transcribe",
        transcriptRaw: TRANSCRIPT_RAW_0102,
        confirmedNarrative: NARRATIVE_0102,
        confirmedNarrativeSha256: sha256Hex(NARRATIVE_0102),
        transcriptConfirmedAt: new Date(now.getTime() - 35 * 60 * 1000),
        aiStatus: "succeeded" as const,
        aiSchemaVersion: "1.0",
        aiModelId: "gemini-4-hydrogen",
        aiBrief: BRIEF_0102,
        aiBriefProvenance: null,
        aiErrorCode: null,
        staffReviewStatus: "confirmed" as const,
        staffReviewedBrief: null,
        staffCorrectionNote: null,
        reviewedByUid: nurseIdentity.uid,
        reviewedAt: new Date(now.getTime() - 25 * 60 * 1000),
        staffAssignedPriority: "priority_review" as const,
        priorityReason:
          "Three-day persistent fever and nausea reported in voice intake; prioritized for nurse review.",
        workflowStatus: "in_review" as const,
        createdAt: new Date(now.getTime() - 35 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 25 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-8000-000000000103",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        referenceCode: "MF-DEMO-0103",
        idempotencyKey: "seed-demo-intake-0103",
        demoRecord: true,
        patientDisplayName: "Ibrahim Musa",
        age: 41,
        inputMode: "typed" as const,
        transcriptionStatus: "not_applicable" as const,
        transcriptionModel: null,
        transcriptRaw: null,
        confirmedNarrative: NARRATIVE_0103,
        confirmedNarrativeSha256: sha256Hex(NARRATIVE_0103),
        transcriptConfirmedAt: new Date(now.getTime() - 30 * 60 * 1000),
        aiStatus: "needs_human_clarification" as const,
        aiSchemaVersion: "1.0",
        aiModelId: "gemini-4-hydrogen",
        aiBrief: BRIEF_0103,
        aiBriefProvenance: null,
        aiErrorCode: null,
        staffReviewStatus: "not_reviewed" as const,
        staffReviewedBrief: null,
        staffCorrectionNote: null,
        reviewedByUid: null,
        reviewedAt: null,
        staffAssignedPriority: "unassigned" as const,
        priorityReason: null,
        workflowStatus: "awaiting_clarification" as const,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-8000-000000000104",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        referenceCode: "MF-DEMO-0104",
        idempotencyKey: "seed-demo-intake-0104",
        demoRecord: true,
        patientDisplayName: "Zainab Abdullahi",
        age: 33,
        inputMode: "typed" as const,
        transcriptionStatus: "not_applicable" as const,
        transcriptionModel: null,
        transcriptRaw: null,
        confirmedNarrative: NARRATIVE_0104,
        confirmedNarrativeSha256: sha256Hex(NARRATIVE_0104),
        transcriptConfirmedAt: new Date(now.getTime() - 22 * 60 * 1000),
        aiStatus: "succeeded" as const,
        aiSchemaVersion: "1.0",
        aiModelId: "gemini-4-hydrogen",
        aiBrief: BRIEF_0104,
        aiBriefProvenance: null,
        aiErrorCode: null,
        staffReviewStatus: "confirmed" as const,
        staffReviewedBrief: null,
        staffCorrectionNote: null,
        reviewedByUid: nurseIdentity.uid,
        reviewedAt: new Date(now.getTime() - 15 * 60 * 1000),
        staffAssignedPriority: "immediate_review" as const,
        priorityReason:
          "Patient reports sharp right lower abdominal pain and known penicillin allergy; missing onset duration requires immediate nurse verification.",
        workflowStatus: "in_review" as const,
        createdAt: new Date(now.getTime() - 22 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 15 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-8000-000000000105",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        referenceCode: "MF-DEMO-0105",
        idempotencyKey: "seed-demo-intake-0105",
        demoRecord: true,
        patientDisplayName: "Tunde Bakare",
        age: 62,
        inputMode: "typed" as const,
        transcriptionStatus: "not_applicable" as const,
        transcriptionModel: null,
        transcriptRaw: null,
        confirmedNarrative: NARRATIVE_0105,
        confirmedNarrativeSha256: sha256Hex(NARRATIVE_0105),
        transcriptConfirmedAt: new Date(now.getTime() - 60 * 60 * 1000),
        aiStatus: "succeeded" as const,
        aiSchemaVersion: "1.0",
        aiModelId: "gemini-4-hydrogen",
        aiBrief: AI_BRIEF_0105,
        aiBriefProvenance: null,
        aiErrorCode: null,
        staffReviewStatus: "corrected" as const,
        staffReviewedBrief: STAFF_REVIEWED_BRIEF_0105,
        staffCorrectionNote:
          "Clarified during nurse check-in that the dry cough is primarily nocturnal and patient has no fever or shortness of breath at rest.",
        reviewedByUid: nurseIdentity.uid,
        reviewedAt: new Date(now.getTime() - 10 * 60 * 1000),
        staffAssignedPriority: "routine_review" as const,
        priorityReason:
          "Stable 5-day dry cough after nurse clarification; queued for routine outpatient consultation.",
        workflowStatus: "completed" as const,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
    ];

    for (const intake of syntheticIntakes) {
      console.log(
        `[MedFlow Seed] Ensuring synthetic patient intake: ${intake.referenceCode}...`,
      );
      await db
        .insert(patientIntakes)
        .values(intake)
        .onConflictDoNothing({ target: patientIntakes.id });
    }

    const syntheticAuditEvents = [
      // MF-DEMO-0101
      {
        id: "00000000-0000-4000-9000-000000000101",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000101",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "intake_created" as const,
        fromValue: null,
        toValue: "new",
        reason: null,
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000102",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000101",
        actorType: "system" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "ai_completed" as const,
        fromValue: null,
        toValue: "succeeded",
        reason: null,
        createdAt: new Date(now.getTime() - 44 * 60 * 1000),
      },
      // MF-DEMO-0102
      {
        id: "00000000-0000-4000-9000-000000000201",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000102",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "intake_created" as const,
        fromValue: null,
        toValue: "new",
        reason: null,
        createdAt: new Date(now.getTime() - 35 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000202",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000102",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "transcript_confirmed" as const,
        fromValue: null,
        toValue: "confirmed",
        reason: null,
        createdAt: new Date(now.getTime() - 35 * 60 * 1000 + 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000203",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000102",
        actorType: "system" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "ai_completed" as const,
        fromValue: null,
        toValue: "succeeded",
        reason: null,
        createdAt: new Date(now.getTime() - 34 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000204",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000102",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "brief_confirmed" as const,
        fromValue: "not_reviewed",
        toValue: "confirmed",
        reason: null,
        createdAt: new Date(now.getTime() - 26 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000205",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000102",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "priority_assigned" as const,
        fromValue: "unassigned",
        toValue: "priority_review",
        reason:
          "Three-day persistent fever and nausea reported in voice intake; prioritized for nurse review.",
        createdAt: new Date(now.getTime() - 25 * 60 * 1000),
      },
      // MF-DEMO-0103
      {
        id: "00000000-0000-4000-9000-000000000301",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000103",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "intake_created" as const,
        fromValue: null,
        toValue: "new",
        reason: null,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000302",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000103",
        actorType: "system" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "ai_completed" as const,
        fromValue: null,
        toValue: "needs_human_clarification",
        reason: null,
        createdAt: new Date(now.getTime() - 29 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000303",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000103",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "status_changed" as const,
        fromValue: "new",
        toValue: "awaiting_clarification",
        reason: "Awaiting direct desk clarification from patient.",
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      // MF-DEMO-0104
      {
        id: "00000000-0000-4000-9000-000000000401",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000104",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "intake_created" as const,
        fromValue: null,
        toValue: "new",
        reason: null,
        createdAt: new Date(now.getTime() - 22 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000402",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000104",
        actorType: "system" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "ai_completed" as const,
        fromValue: null,
        toValue: "succeeded",
        reason: null,
        createdAt: new Date(now.getTime() - 21 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000403",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000104",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "brief_confirmed" as const,
        fromValue: "not_reviewed",
        toValue: "confirmed",
        reason: null,
        createdAt: new Date(now.getTime() - 16 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000404",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000104",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "priority_assigned" as const,
        fromValue: "unassigned",
        toValue: "immediate_review",
        reason:
          "Patient reports sharp right lower abdominal pain and known penicillin allergy; missing onset duration requires immediate nurse verification.",
        createdAt: new Date(now.getTime() - 15 * 60 * 1000),
      },
      // MF-DEMO-0105
      {
        id: "00000000-0000-4000-9000-000000000501",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000105",
        actorType: "patient" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "intake_created" as const,
        fromValue: null,
        toValue: "new",
        reason: null,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000502",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000105",
        actorType: "system" as const,
        actorUid: null,
        actorRole: null,
        actorDisplayName: null,
        action: "ai_completed" as const,
        fromValue: null,
        toValue: "succeeded",
        reason: null,
        createdAt: new Date(now.getTime() - 59 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000503",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000105",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "brief_corrected" as const,
        fromValue: "not_reviewed",
        toValue: "corrected",
        reason:
          "Clarified during nurse check-in that the dry cough is primarily nocturnal and patient has no fever or shortness of breath at rest.",
        createdAt: new Date(now.getTime() - 12 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000504",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000105",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "priority_assigned" as const,
        fromValue: "unassigned",
        toValue: "routine_review",
        reason:
          "Stable 5-day dry cough after nurse clarification; queued for routine outpatient consultation.",
        createdAt: new Date(now.getTime() - 11 * 60 * 1000),
      },
      {
        id: "00000000-0000-4000-9000-000000000505",
        facilityId: CANONICAL_DEMO_FACILITY.id,
        intakeId: "00000000-0000-4000-8000-000000000105",
        actorType: "staff" as const,
        actorUid: nurseIdentity.uid,
        actorRole: nurseIdentity.role,
        actorDisplayName: nurseIdentity.displayName,
        action: "status_changed" as const,
        fromValue: "in_review",
        toValue: "completed",
        reason: "Nurse intake review complete; handed off to outpatient queue.",
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
    ];

    for (const ev of syntheticAuditEvents) {
      await db
        .insert(auditEvents)
        .values(ev)
        .onConflictDoNothing({ target: auditEvents.id });
    }

    console.log(
      "[MedFlow Seed] Seed complete: demo-clinic-01, 2 staff profiles, and 5 synthetic patient intakes (MF-DEMO-0101 .. MF-DEMO-0105).",
    );
  } finally {
    await pool.end();
  }
}

export interface OptionalSeedAdminConfig {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: "admin" | "nurse" | "doctor";
}

export function parseOptionalSeedAdminEnv(
  env: Record<string, string | undefined> = process.env,
): OptionalSeedAdminConfig | null {
  const uid = env.SEED_ADMIN_UID?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const displayName = env.SEED_ADMIN_DISPLAY_NAME?.trim();
  const rawRole = env.SEED_ADMIN_ROLE?.trim();

  if (!uid && !email && !displayName && !rawRole) {
    return null;
  }

  if (!uid || !email || !displayName) {
    throw new Error(
      "Incomplete SEED_ADMIN_* configuration: SEED_ADMIN_UID, SEED_ADMIN_EMAIL, and SEED_ADMIN_DISPLAY_NAME must all be provided together.",
    );
  }

  const role = rawRole ?? "admin";
  if (role !== "admin" && role !== "nurse" && role !== "doctor") {
    throw new Error(
      `Invalid SEED_ADMIN_ROLE "${role}". Must be one of: admin, nurse, doctor.`,
    );
  }

  return {
    uid,
    email,
    displayName,
    role,
  };
}

const isCliEntry =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]?.endsWith("seed.ts"));

if (isCliEntry) {
  runSeed().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown seed error";
    console.error(`[MedFlow Seed Error] ${message}`);
    process.exit(1);
  });
}

