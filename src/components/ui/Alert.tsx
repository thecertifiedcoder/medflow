import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type AlertTone =
  | "info"
  | "warning"
  | "caution"
  | "danger"
  | "success"
  | "ai";

const TONE_CLASS: Record<AlertTone, string> = {
  info: "mf-banner--info",
  warning: "mf-banner--warning",
  caution: "mf-banner--caution",
  danger: "mf-banner--danger",
  success: "mf-banner--success",
  ai: "mf-banner--ai",
};

const DEFAULT_ICON: Record<AlertTone, IconName> = {
  info: "info",
  warning: "alert",
  caution: "circleAlert",
  danger: "alert",
  success: "checkCircle",
  ai: "scanText",
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  icon?: IconName;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  icon,
  action,
  children,
  className = "",
}: AlertProps) {
  const isUrgent = tone === "danger" || tone === "warning";

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      className={`mf-banner ${action ? "" : "mf-banner--simple"} ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} size="lg" />
      <div className="min-w-0">
        {title ? <div className="mf-banner__title">{title}</div> : null}
        <div className="mf-banner__text">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
