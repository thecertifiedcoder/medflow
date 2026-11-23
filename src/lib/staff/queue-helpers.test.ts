import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_UNAVAILABLE_STAFF_COPY,
  buildQueueSummaryText,
  countVerifiedBriefQuotes,
  filterQueueItemsByPrimaryTab,
  getAssignedPriorityBadge,
  getPatientDisplayTitle,
  getQueueAiStateBadge,
  getQueueWorkflowBadge,
  isVerbatimSupportingQuote,
} from "./queue-helpers";
import type { StaffQueueItem } from "@/lib/schemas/staff-api";
import type { ClinicalIntakeBrief } from "@/lib/schemas/intake";

function makeQueueItem(overrides: Partial<StaffQueueItem> = {}): StaffQueueItem {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    facilityId: "demo-clinic-01",
    referenceCode: "MF-DEMO-0101",
    patientDisplayName: "Adaeze Okafor",
    age: 34,
    inputMode: "typed",
    transcriptionStatus: "not_applicable",
    narrativePreview: "I have had sharp chest tightness for two hours.",
    workflowStatus: "new",
    staffAssignedPriority: "unassigned",
    aiStatus: "succeeded",
    staffReviewStatus: "not_reviewed",
    demoRecord: true,
    createdAt: "2026-11-22T10:00:00.000Z",
    updatedAt: "2026-11-22T10:00:00.000Z",
    ...overrides,
  };
}

test("buildQueueSummaryText formats concise data-derived active and filtered counts", () => {
  assert.equal(
    buildQueueSummaryText({
      total: 12,
      needsAttentionCount: 4,
      hasActiveFilter: false,
    }),
    "12 active intakes · 4 need attention",
  );
  assert.equal(
    buildQueueSummaryText({
      total: 1,
      needsAttentionCount: 1,
      hasActiveFilter: false,
    }),
    "1 active intake · 1 needs attention",
  );
  assert.equal(
    buildQueueSummaryText({
      total: 3,
      needsAttentionCount: 0,
      hasActiveFilter: true,
    }),
    "3 matching intakes",
  );
  assert.equal(
    buildQueueSummaryText({
      total: 0,
      needsAttentionCount: 0,
      hasActiveFilter: false,
    }),
    "0 active intakes",
  );
});

test("filterQueueItemsByPrimaryTab preserves server order and separates Needs Review vs In Progress", () => {
  const items: StaffQueueItem[] = [
    makeQueueItem({
      id: "00000000-0000-4000-8000-000000000001",
      referenceCode: "MF-001",
      workflowStatus: "new",
      staffReviewStatus: "not_reviewed",
      aiStatus: "succeeded",
    }),
    makeQueueItem({
      id: "00000000-0000-4000-8000-000000000002",
      referenceCode: "MF-002",
      workflowStatus: "in_review",
      staffReviewStatus: "confirmed",
      aiStatus: "succeeded",
    }),
    makeQueueItem({
      id: "00000000-0000-4000-8000-000000000003",
      referenceCode: "MF-003",
      workflowStatus: "awaiting_clarification",
      staffReviewStatus: "not_reviewed",
      aiStatus: "failed",
    }),
  ];

  assert.deepEqual(
    filterQueueItemsByPrimaryTab(items, "all").map((i) => i.referenceCode),
    ["MF-001", "MF-002", "MF-003"],
  );
  assert.deepEqual(
    filterQueueItemsByPrimaryTab(items, "needs_review").map(
      (i) => i.referenceCode,
    ),
    ["MF-001", "MF-003"],
  );
  assert.deepEqual(
    filterQueueItemsByPrimaryTab(items, "in_progress").map(
      (i) => i.referenceCode,
    ),
    ["MF-002", "MF-003"],
  );
});

test("clinical badges use plain human labels and hide unassigned priority", () => {
  assert.equal(getPatientDisplayTitle("Adaeze Okafor"), "Adaeze Okafor");
  assert.equal(getPatientDisplayTitle("   "), "Walk-in patient");
  assert.equal(getPatientDisplayTitle(null), "Walk-in patient");

  assert.equal(getQueueWorkflowBadge("new").label, "New");
  assert.equal(getQueueWorkflowBadge("in_review").label, "In Review");
  assert.equal(
    getQueueWorkflowBadge("awaiting_clarification").label,
    "Awaiting Clarification",
  );
  assert.equal(getQueueWorkflowBadge("completed").label, "Completed");

  assert.equal(getQueueAiStateBadge("succeeded").label, "Summary Ready");
  assert.equal(getQueueAiStateBadge("failed").label, "Summary Unavailable");
  assert.equal(
    getQueueAiStateBadge("needs_human_clarification").label,
    "Needs Clarification",
  );

  // Unassigned priority must stay hidden so cards stay calm and never imply AI priority
  assert.equal(getAssignedPriorityBadge("unassigned"), null);
  assert.equal(
    getAssignedPriorityBadge("immediate_review")?.label,
    "Immediate review",
  );
  assert.equal(
    getAssignedPriorityBadge("priority_review")?.label,
    "Priority review",
  );
  assert.equal(
    getAssignedPriorityBadge("routine_review")?.label,
    "Routine review",
  );

  // Plain-language AI unavailable copy avoids technical jargon
  assert.equal(AI_UNAVAILABLE_STAFF_COPY.title, "AI summary unavailable");
  assert.equal(
    AI_UNAVAILABLE_STAFF_COPY.body,
    "The patient's statement is saved and can still be reviewed.",
  );
  assert.equal(AI_UNAVAILABLE_STAFF_COPY.retryLabel, "Retry AI Summary");
});

test("isVerbatimSupportingQuote and countVerifiedBriefQuotes strictly verify verbatim substrings", () => {
  const narrative =
    "I have had sharp chest tightness for two hours and mild dizziness.";
  assert.equal(
    isVerbatimSupportingQuote("sharp chest tightness", narrative),
    true,
  );
  assert.equal(
    isVerbatimSupportingQuote("shortness of breath", narrative),
    false,
  );
  assert.equal(isVerbatimSupportingQuote("   ", narrative), false);
  assert.equal(isVerbatimSupportingQuote(undefined, narrative), false);

  const brief: ClinicalIntakeBrief = {
    schemaVersion: "1.0",
    languageDetected: "en",
    chiefConcern: {
      value: "Chest tightness",
      sourceQuote: "sharp chest tightness",
      certainty: "explicit",
    },
    symptoms: [
      {
        value: "Dizziness",
        sourceQuote: "mild dizziness",
        certainty: "explicit",
        duration: null,
        severity: null,
      },
      {
        value: "Unverified symptom",
        sourceQuote: "not in narrative",
        certainty: "unclear",
        duration: null,
        severity: null,
      },
    ],
    relevantContext: [],
    reportedDetailsToReview: [],
    missingOrUnclear: [],
    clinicianSummary: "Patient reports chest tightness and dizziness.",
    limitations: ["Non-authoritative AI draft."],
  };

  assert.equal(countVerifiedBriefQuotes(brief, narrative), 2);
  assert.equal(countVerifiedBriefQuotes(null, narrative), 0);
});
