import {
  WORKFLOW_PRIORITY_LABELS,
  type StaffAssignedPriority,
} from "@/lib/schemas/intake";

const PRIORITY_STYLES: Record<StaffAssignedPriority, string> = {
  immediate_review: "text-[var(--mf-danger-ink)] bg-[var(--mf-danger-soft)]",
  priority_review: "text-[var(--mf-warning-ink)] bg-[var(--mf-warning-soft)]",
  routine_review: "text-[#4a625c] bg-[#edf1ee]",
  unassigned:
    "text-[#53645e] bg-[#f3f5f2] border border-dashed border-[#cbd5ce]",
};

export interface PriorityLabelProps {
  priority: StaffAssignedPriority;
  className?: string;
}

/**
 * Staff-assigned workflow priority label (docs/18 §3.2).
 * Always for queue organisation only — never a validated clinical triage scale.
 */
export function PriorityLabel({
  priority,
  className = "",
}: PriorityLabelProps) {
  const showDot = priority !== "unassigned";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold leading-none whitespace-nowrap ${PRIORITY_STYLES[priority]} ${className}`.trim()}
    >
      {showDot && (
        <span
          className="h-[7px] w-[7px] rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      <span>{WORKFLOW_PRIORITY_LABELS[priority]}</span>
    </span>
  );
}
