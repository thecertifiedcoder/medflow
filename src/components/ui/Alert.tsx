import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type AlertTone = "info" | "warning" | "danger" | "success";

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "text-[var(--mf-info-ink)] bg-[var(--mf-info-soft)] border-[var(--mf-info-border)]",
  warning:
    "text-[var(--mf-warning-ink)] bg-[var(--mf-warning-soft)] border-[var(--mf-warning-border)]",
  danger:
    "text-[var(--mf-danger-ink)] bg-[var(--mf-danger-soft)] border-[var(--mf-danger-border)]",
  success:
    "text-[var(--mf-success-ink)] bg-[var(--mf-success-soft)] border-[var(--mf-success-border)]",
};

const DEFAULT_ICON: Record<AlertTone, IconName> = {
  info: "info",
  warning: "alert",
  danger: "alert",
  success: "check",
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  icon,
  children,
  className = "",
}: AlertProps) {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-[13px] leading-relaxed ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      <Icon
        name={icon ?? DEFAULT_ICON[tone]}
        size="md"
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        {title && (
          <strong className="mb-0.5 block text-[13px] font-bold">
            {title}
          </strong>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
