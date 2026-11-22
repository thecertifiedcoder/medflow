import type { Certainty } from "@/lib/schemas/intake";
import { Badge } from "./Badge";

export interface EvidenceCardProps {
  value: string;
  certainty: Certainty;
  sourceQuote?: string;
  duration?: string | null;
  severity?: string | null;
  provenanceLabel?: string;
  className?: string;
}

export function EvidenceCard({
  value,
  certainty,
  sourceQuote,
  duration,
  severity,
  provenanceLabel = "Extracted from confirmed patient narrative · AI-generated draft",
  className = "",
}: EvidenceCardProps) {
  const isExplicit = certainty === "explicit";

  return (
    <article
      className={`rounded-[11px] border border-[var(--mf-line)] bg-[var(--mf-surface)] p-3.5 ${className}`.trim()}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-[13px] font-bold text-[var(--mf-ink)]">
          {value}
        </h4>
        <Badge tone={isExplicit ? "success" : "warning"}>
          {isExplicit ? "Explicitly reported" : "Unclear / needs clarification"}
        </Badge>
      </div>

      {sourceQuote ? (
        <blockquote className="m-0 rounded-r-[7px] border-l-2 border-[#84aa99] bg-[var(--mf-surface-soft)] px-3 py-2 text-[13px] leading-relaxed text-[var(--mf-ink-secondary)]">
          “{sourceQuote}”
        </blockquote>
      ) : (
        <p className="m-0 rounded-[7px] bg-[var(--mf-warning-soft)] px-3 py-2 text-[12px] text-[var(--mf-warning-ink)]">
          No exact supporting quote identified — verify directly against the
          patient&apos;s statement.
        </p>
      )}

      {(duration !== undefined || severity !== undefined) && (
        <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--mf-muted)]">
          {duration !== undefined && (
            <div className="flex gap-1">
              <dt className="font-semibold text-[var(--mf-ink-secondary)]">
                Duration:
              </dt>
              <dd className="m-0">{duration ?? "Not stated"}</dd>
            </div>
          )}
          {severity !== undefined && (
            <div className="flex gap-1">
              <dt className="font-semibold text-[var(--mf-ink-secondary)]">
                Severity:
              </dt>
              <dd className="m-0">{severity ?? "Not stated"}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="m-0 mt-2.5 text-[11px] text-[var(--mf-muted)]">
        {provenanceLabel}
      </p>
    </article>
  );
}
