import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "caution"
  | "danger"
  | "ai"
  | "dashed";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "",
  brand: "mf-chip--brand",
  info: "mf-chip--info",
  success: "mf-chip--success",
  warning: "mf-chip--warning",
  caution: "mf-chip--caution",
  danger: "mf-chip--danger",
  ai: "mf-chip--ai",
  dashed: "mf-chip--dashed",
};

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

/**
 * Rectangular clinical status chip (4px radius; never pill-shaped).
 */
export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span className={`mf-chip ${TONE_CLASSES[tone]} ${className}`.trim()}>
      {dot ? <span className="mf-dot" aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}

export type SignalSource = "patient" | "ai" | "calc" | "nurse";

const SOURCE_META: Record<
  SignalSource,
  { defaultLabel: string; icon: IconName }
> = {
  patient: { defaultLabel: "Patient", icon: "quote" },
  ai: { defaultLabel: "AI Draft", icon: "scanText" },
  calc: { defaultLabel: "Deterministic check", icon: "calculator" },
  nurse: { defaultLabel: "Staff", icon: "userCheck" },
};

export interface SourceTagProps {
  source: SignalSource;
  label?: string;
  className?: string;
}

/**
 * Signal provenance tag — separates data origin from workflow priority.
 * Dashed purple border is reserved strictly for unverified AI-drafted output.
 */
export function SourceTag({ source, label, className = "" }: SourceTagProps) {
  const meta = SOURCE_META[source];
  return (
    <span
      className={`mf-src ${className}`.trim()}
      data-source={source}
    >
      <Icon name={meta.icon} size="sm" />
      <span>{label ?? meta.defaultLabel}</span>
    </span>
  );
}

export type ConnectionState =
  | "connected"
  | "updating"
  | "reconnecting"
  | "unavailable";

const CONNECTION_META: Record<
  ConnectionState,
  { defaultLabel: string; icon: IconName; spin?: boolean }
> = {
  connected: { defaultLabel: "Live queue", icon: "wifi" },
  updating: { defaultLabel: "Connecting", icon: "refresh", spin: true },
  reconnecting: { defaultLabel: "Reconnecting", icon: "refresh", spin: true },
  unavailable: { defaultLabel: "Offline", icon: "wifiOff" },
};

export interface ConnectionChipProps {
  state: ConnectionState;
  label?: string;
  className?: string;
}

export function ConnectionChip({
  state,
  label,
  className = "",
}: ConnectionChipProps) {
  const meta = CONNECTION_META[state];
  return (
    <span
      className={`mf-conn ${className}`.trim()}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <Icon name={meta.icon} size="sm" spin={meta.spin} />
      <span>{label ?? meta.defaultLabel}</span>
    </span>
  );
}
