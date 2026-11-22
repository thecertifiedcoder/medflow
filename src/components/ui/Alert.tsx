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
  iconSpin?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  icon,
  iconSpin,
  action,
  children,
  className = "",
}: AlertProps) {
  const isUrgent = tone === "danger" || tone === "warning";
  const resolvedIcon = icon ?? DEFAULT_ICON[tone];
  const shouldSpin = iconSpin ?? resolvedIcon === "loader";

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      className={`mf-banner ${action ? "" : "mf-banner--simple"} ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      <Icon name={resolvedIcon} size="lg" spin={shouldSpin} />
      <div className="min-w-0">
        {title ? <div className="mf-banner__title">{title}</div> : null}
        <div className="mf-banner__text">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
