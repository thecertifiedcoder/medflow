import type { Certainty } from "@/lib/schemas/intake";
import { Badge, SourceTag } from "./Badge";

export interface EvidenceCardProps {
  label: string;
  value: string;
  sourceQuote?: string;
  certainty: Certainty;
  duration?: string | null;
  severity?: string | null;
  className?: string;
}

/**
 * Displays an AI-extracted intake fact alongside its provenance boundary and verbatim patient quote.
 * Dashed purple AI styling signals unverified machine output; solid patient quote block anchors evidence.
 */
export function EvidenceCard({
  label,
  value,
  sourceQuote,
  certainty,
  duration,
  severity,
  className = "",
}: EvidenceCardProps) {
  return (
    <article
      className={`mf-panel ${className}`.trim()}
      data-source="ai"
    >
      <div className="mf-panel__head">
        <span className="mf-eyebrow">{label}</span>
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag source="ai" label="AI Draft" />
          <Badge tone={certainty === "explicit" ? "brand" : "caution"}>
            {certainty === "explicit" ? "Explicitly stated" : "Unclear / needs review"}
          </Badge>
        </div>
      </div>

      <div className="mf-panel__body">
        <p className="mf-t-card m-0 text-[var(--mf-text)]">{value}</p>

        {(duration || severity) && (
          <dl className="mf-dl m-0">
            {duration ? (
              <>
                <dt>Duration</dt>
                <dd>{duration}</dd>
              </>
            ) : null}
            {severity ? (
              <>
                <dt>Severity</dt>
                <dd>{severity}</dd>
              </>
            ) : null}
          </dl>
        )}

        {sourceQuote ? (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <SourceTag source="patient" label="Verbatim patient quote" />
            </div>
            <blockquote className="mf-quote !text-[var(--mf-fs-body-sm)]">
              &ldquo;{sourceQuote}&rdquo;
            </blockquote>
          </div>
        ) : (
          <div className="rounded-[4px] border border-dashed border-[var(--mf-caution)] bg-[var(--mf-caution-tint)] px-3 py-2 text-[13px] text-[var(--mf-caution)]">
            No exact verbatim source quote matched — verify directly against the
            patient&apos;s original narrative.
          </div>
        )}
      </div>
    </article>
  );
}
