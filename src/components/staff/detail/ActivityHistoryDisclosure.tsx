"use client";

import { useState } from "react";
import { Icon, Timeline, type TimelineEntry } from "@/components/ui";
import type { AuditAction } from "@/lib/schemas/intake";
import type { StaffIntakeAuditEvent } from "@/lib/schemas/staff-api";
import { formatDetailedTimestamp } from "@/lib/staff/queue-helpers";

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  intake_created: "Patient intake submitted",
  transcript_confirmed: "Voice statement confirmed by patient",
  ai_completed: "AI summary generated",
  ai_failed: "AI summary unavailable",
  review_started: "Clinical review started",
  priority_assigned: "Operational priority assigned",
  priority_changed: "Operational priority updated",
  status_changed: "Workflow status updated",
  brief_confirmed: "AI summary confirmed by staff",
  brief_corrected: "Staff-reviewed summary saved",
};

interface ActivityHistoryDisclosureProps {
  readonly auditEvents: readonly StaffIntakeAuditEvent[];
}

export function ActivityHistoryDisclosure({
  auditEvents,
}: ActivityHistoryDisclosureProps) {
  const [expanded, setExpanded] = useState(false);

  const eventCount = auditEvents.length;
  const entries: TimelineEntry[] = auditEvents.map((event) => ({
    id: event.id,
    timestamp: formatDetailedTimestamp(event.createdAt),
    actorType: event.actorType,
    actorDisplayName: event.actorDisplayName ?? undefined,
    actorRole: event.actorRole ?? undefined,
    actionLabel: AUDIT_ACTION_LABELS[event.action],
    fromValue: event.fromValue
      ? event.fromValue.replaceAll("_", " ")
      : undefined,
    toValue: event.toValue ? event.toValue.replaceAll("_", " ") : undefined,
    reason: event.reason ?? undefined,
    isOverride:
      event.action === "priority_changed" ||
      event.action === "brief_corrected",
  }));

  return (
    <section
      aria-labelledby="activity-history-heading"
      className="overflow-hidden rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)]"
      data-testid="activity-history-section"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="activity-history-panel"
        onClick={() => setExpanded((prev) => !prev)}
        data-testid="activity-history-toggle"
        className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 py-3.5 text-left transition-colors hover:bg-[var(--mf-surface-subtle)]"
      >
        <div className="flex items-center gap-2.5">
          <Icon
            name="history"
            size="md"
            className="text-[var(--mf-text-secondary)]"
          />
          <h2
            id="activity-history-heading"
            className="mf-t-card m-0 text-[var(--mf-text)]"
          >
            Activity History · {eventCount}{" "}
            {eventCount === 1 ? "event" : "events"}
          </h2>
        </div>

        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--mf-text-secondary)]">
          <span>{expanded ? "Hide" : "Show"}</span>
          <Icon
            name="chevronDown"
            size="sm"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {expanded && (
        <div
          id="activity-history-panel"
          className="border-t border-[var(--mf-border)] px-5 py-4"
          data-testid="activity-history-timeline"
        >
          {entries.length === 0 ? (
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              No activity events recorded yet.
            </p>
          ) : (
            <Timeline entries={entries} />
          )}
        </div>
      )}
    </section>
  );
}
