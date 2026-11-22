import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "text-[#52625c] bg-[#eef1ee] border-[#e3e8e3]",
  brand:
    "text-[var(--mf-brand-strong)] bg-[var(--mf-brand-soft)] border-[#d3e5dc]",
  info: "text-[var(--mf-info-ink)] bg-[var(--mf-info-soft)] border-[var(--mf-info-border)]",
  success:
    "text-[var(--mf-success-ink)] bg-[var(--mf-success-soft)] border-[var(--mf-success-border)]",
  warning:
    "text-[var(--mf-warning-ink)] bg-[var(--mf-warning-soft)] border-[var(--mf-warning-border)]",
  danger:
    "text-[var(--mf-danger-ink)] bg-[var(--mf-danger-soft)] border-[var(--mf-danger-border)]",
};

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
