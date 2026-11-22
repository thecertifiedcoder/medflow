import type { AuditActorType, StaffRole } from "@/lib/schemas/intake";
import { SourceTag, type SignalSource } from "./Badge";

export interface TimelineEntry {
  id: string;
  timestamp: string;
  actorType: AuditActorType;
  actorDisplayName?: string;
  actorRole?: StaffRole;
  actionLabel: string;
  fromValue?: string;
  toValue?: string;
  reason?: string;
  isOverride?: boolean;
}

const ACTOR_SOURCE_MAP: Record<
  AuditActorType,
  { source: SignalSource; label: string }
> = {
  patient: { source: "patient", label: "Patient" },
  staff: { source: "nurse", label: "Staff" },
  system: { source: "calc", label: "System" },
};

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  className?: string;
}

/**
 * Append-only workflow audit timeline (.mf-audit) with IBM Plex Mono timestamps
 * and explicit patient / staff / system actor provenance tags (D-007).
 */
export function Timeline({ entries, className = "" }: TimelineProps) {
  return (
    <ol className={`mf-audit m-0 list-none p-0 ${className}`.trim()}>
      {entries.map((entry) => {
        const actorMeta = ACTOR_SOURCE_MAP[entry.actorType];
        const actorRoleLabel =
          entry.actorType === "staff" && entry.actorRole
            ? `Staff · ${entry.actorRole}`
            : actorMeta.label;
        const highlightOverride =
          entry.isOverride || Boolean(entry.fromValue && entry.toValue);

        return (
          <li
            key={entry.id}
            className={`mf-audit__item ${
              highlightOverride ? "mf-audit__item--override" : ""
            }`.trim()}
          >
            <time className="mf-audit__time">{entry.timestamp}</time>
            <div className="mf-audit__what">
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source={actorMeta.source} label={actorRoleLabel} />
                {entry.actorDisplayName ? (
                  <span className="text-[13px] font-medium text-[var(--mf-text-secondary)]">
                    {entry.actorDisplayName}
                  </span>
                ) : null}
              </div>

              <div className="font-semibold text-[var(--mf-text)]">
                {entry.actionLabel}
              </div>

              {(entry.fromValue || entry.toValue) && (
                <div className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                  {entry.fromValue ? <span>{entry.fromValue}</span> : null}
                  {entry.fromValue && entry.toValue ? (
                    <span className="mx-1.5" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  {entry.toValue ? (
                    <strong className="font-semibold text-[var(--mf-text)]">
                      {entry.toValue}
                    </strong>
                  ) : null}
                </div>
              )}

              {entry.reason ? (
                <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
                  Reason: &ldquo;{entry.reason}&rdquo;
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
