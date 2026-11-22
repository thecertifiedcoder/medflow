import type { AuditActorType } from "@/lib/schemas/intake";
import { Badge, type BadgeTone } from "./Badge";

export interface TimelineEntry {
  readonly id: string;
  readonly title: string;
  readonly actorType: AuditActorType;
  readonly actorLabel: string;
  readonly timestampLabel: string;
  readonly transitionLabel?: string;
  readonly reason?: string;
  readonly isDemo?: boolean;
}

const ACTOR_TONE: Record<AuditActorType, BadgeTone> = {
  patient: "info",
  staff: "brand",
  system: "neutral",
};

const ACTOR_TYPE_TEXT: Record<AuditActorType, string> = {
  patient: "Patient",
  staff: "Staff",
  system: "System",
};

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  emptyMessage?: string;
  className?: string;
}

export function Timeline({
  entries,
  emptyMessage = "No audit events recorded yet.",
  className = "",
}: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="m-0 text-[13px] text-[var(--mf-muted)]">{emptyMessage}</p>
    );
  }

  return (
    <ol className={`m-0 grid list-none p-0 ${className}`.trim()}>
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        return (
          <li
            key={entry.id}
            className="grid grid-cols-[20px_1fr] gap-2.5 min-h-[52px]"
          >
            <div className="relative flex justify-center" aria-hidden="true">
              {!isLast && (
                <span className="absolute top-3 bottom-[-4px] w-px bg-[var(--mf-line-strong)]" />
              )}
              <span className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--mf-brand-soft)] bg-[var(--mf-brand)]" />
            </div>

            <div className={isLast ? "pb-1" : "pb-4"}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-[var(--mf-ink)]">
                  {entry.title}
                </span>
                <Badge tone={ACTOR_TONE[entry.actorType]}>
                  {ACTOR_TYPE_TEXT[entry.actorType]}
                </Badge>
              </div>
              <p className="m-0 mt-0.5 text-[12px] text-[var(--mf-muted)]">
                {entry.actorLabel} · {entry.timestampLabel}
                {entry.isDemo ? " · DEMO DATA" : ""}
              </p>
              {entry.transitionLabel && (
                <p className="m-0 mt-1 text-[12px] font-medium text-[var(--mf-ink-secondary)]">
                  {entry.transitionLabel}
                </p>
              )}
              {entry.reason && (
                <p className="m-0 mt-1 rounded-[7px] bg-[var(--mf-surface-soft)] px-2.5 py-1.5 text-[12px] text-[var(--mf-ink-secondary)]">
                  Reason: {entry.reason}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
