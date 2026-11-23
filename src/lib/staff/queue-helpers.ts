import {
  WORKFLOW_PRIORITY_LABELS,
  type AiStatus,
  type ClinicalIntakeBrief,
  type StaffAssignedPriority,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type { StaffQueueItem } from "@/lib/schemas/staff-api";

export type QueuePrimaryTab = "all" | "needs_review" | "in_progress";

export type ClinicalBadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "caution"
  | "danger";

export interface DisplayBadgeMeta {
  readonly label: string;
  readonly tone: ClinicalBadgeTone;
}

export const AI_UNAVAILABLE_STAFF_COPY = {
  title: "AI summary unavailable",
  body: "The patient's statement is saved and can still be reviewed.",
  retryLabel: "Retry AI Summary",
  retryFailedMessage:
    "Unable to generate the AI summary right now. The patient's statement is saved and can still be reviewed.",
} as const;

export function getPatientDisplayTitle(
  patientDisplayName: string | null | undefined,
): string {
  const trimmed = patientDisplayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Walk-in patient";
}

export function getQueueWorkflowBadge(status: WorkflowStatus): DisplayBadgeMeta {
  switch (status) {
    case "new":
      return { label: "New", tone: "info" };
    case "in_review":
      return { label: "In Review", tone: "brand" };
    case "awaiting_clarification":
      return { label: "Awaiting Clarification", tone: "caution" };
    case "completed":
      return { label: "Completed", tone: "success" };
  }
}

export function getQueueAiStateBadge(aiStatus: AiStatus): DisplayBadgeMeta {
  switch (aiStatus) {
    case "succeeded":
      return { label: "Summary Ready", tone: "neutral" };
    case "failed":
      return { label: "Summary Unavailable", tone: "warning" };
    case "needs_human_clarification":
      return { label: "Needs Clarification", tone: "caution" };
    case "queued":
    case "processing":
      return { label: "Preparing Summary", tone: "neutral" };
  }
}

/**
 * Returns a staff-assigned priority display label ONLY when clinical staff
 * have actually assigned one. Returns null for "unassigned" so queue cards
 * stay uncluttered and never imply an AI-generated priority.
 */
export function getAssignedPriorityBadge(
  priority: StaffAssignedPriority,
): DisplayBadgeMeta | null {
  switch (priority) {
    case "unassigned":
      return null;
    case "immediate_review":
      return {
        label: WORKFLOW_PRIORITY_LABELS.immediate_review,
        tone: "danger",
      };
    case "priority_review":
      return {
        label: WORKFLOW_PRIORITY_LABELS.priority_review,
        tone: "warning",
      };
    case "routine_review":
      return {
        label: WORKFLOW_PRIORITY_LABELS.routine_review,
        tone: "brand",
      };
  }
}

/**
 * Formats a concise, strictly data-derived queue summary line.
 * Example: "12 active intakes · 4 need attention"
 */
export function buildQueueSummaryText(params: {
  readonly total: number;
  readonly needsAttentionCount: number;
  readonly hasActiveFilter: boolean;
}): string {
  const totalWord = params.total === 1 ? "intake" : "intakes";
  const baseLabel = params.hasActiveFilter
    ? `${params.total} matching ${totalWord}`
    : `${params.total} active ${totalWord}`;

  if (params.total === 0 || params.needsAttentionCount <= 0) {
    return baseLabel;
  }

  const verb = params.needsAttentionCount === 1 ? "needs" : "need";
  return `${baseLabel} · ${params.needsAttentionCount} ${verb} attention`;
}

/**
 * Applies the primary queue tab ("All" | "Needs Review" | "In Progress")
 * without altering the server's deterministic ordering.
 */
export function filterQueueItemsByPrimaryTab(
  items: readonly StaffQueueItem[],
  tab: QueuePrimaryTab,
): readonly StaffQueueItem[] {
  if (tab === "all") return items;
  if (tab === "needs_review") {
    return items.filter(
      (item) =>
        item.workflowStatus === "new" ||
        item.staffReviewStatus === "not_reviewed" ||
        item.aiStatus === "failed" ||
        item.aiStatus === "needs_human_clarification",
    );
  }
  return items.filter(
    (item) =>
      item.workflowStatus === "in_review" ||
      item.workflowStatus === "awaiting_clarification",
  );
}

/**
 * Checks whether a supporting quotation exists verbatim in the immutable
 * patient-confirmed narrative. Unverified quotes are never shown as grounded.
 */
export function isVerbatimSupportingQuote(
  quote: string | null | undefined,
  confirmedNarrative: string,
): quote is string {
  if (!quote) return false;
  const trimmed = quote.trim();
  if (trimmed.length === 0) return false;
  return confirmedNarrative.includes(trimmed);
}

/**
 * Counts how many grounded supporting quotes exist across a brief.
 */
export function countVerifiedBriefQuotes(
  brief: ClinicalIntakeBrief | null,
  confirmedNarrative: string,
): number {
  if (!brief) return 0;
  let count = 0;

  if (isVerbatimSupportingQuote(brief.chiefConcern.sourceQuote, confirmedNarrative)) {
    count += 1;
  }
  for (const s of brief.symptoms) {
    if (isVerbatimSupportingQuote(s.sourceQuote, confirmedNarrative)) {
      count += 1;
    }
  }
  for (const c of brief.relevantContext) {
    if (isVerbatimSupportingQuote(c.sourceQuote, confirmedNarrative)) {
      count += 1;
    }
  }
  for (const d of brief.reportedDetailsToReview) {
    if (isVerbatimSupportingQuote(d.sourceQuote, confirmedNarrative)) {
      count += 1;
    }
  }

  return count;
}

export function formatClinicalTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDetailedTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
