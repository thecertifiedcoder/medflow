import {
  WORKFLOW_PRIORITY_LABELS,
  type StaffAssignedPriority,
} from "@/lib/schemas/intake";
import { Icon, type IconName } from "./Icon";

const PRIORITY_STYLE: Record<
  StaffAssignedPriority,
  { chipClass: string; icon: IconName }
> = {
  unassigned: {
    chipClass: "mf-chip--dashed",
    icon: "clock",
  },
  immediate_review: {
    chipClass: "mf-chip--danger",
    icon: "alert",
  },
  priority_review: {
    chipClass: "mf-chip--warning",
    icon: "circleAlert",
  },
  routine_review: {
    chipClass: "mf-chip--brand",
    icon: "checkCircle",
  },
};

export interface PriorityLabelProps {
  priority: StaffAssignedPriority;
  className?: string;
}

/**
 * Operational staff-assigned workflow priority chip (D-019 compliant).
 * Never uses clinical TEWS/SATS colours, shapes, scores, or target time limits.
 * Always combines icon + explicit text label alongside colour.
 */
export function PriorityLabel({
  priority,
  className = "",
}: PriorityLabelProps) {
  const style = PRIORITY_STYLE[priority];

  return (
    <span className={`mf-chip ${style.chipClass} ${className}`.trim()}>
      <Icon name={style.icon} size="sm" />
      <span>{WORKFLOW_PRIORITY_LABELS[priority]}</span>
    </span>
  );
}
