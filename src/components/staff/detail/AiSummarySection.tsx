"use client";

import { useState } from "react";
import { Badge, Button, Icon } from "@/components/ui";
import type { StaffIntakeDetailRecord } from "@/lib/schemas/staff-api";
import {
  AI_UNAVAILABLE_STAFF_COPY,
  countVerifiedBriefQuotes,
  isVerbatimSupportingQuote,
} from "@/lib/staff/queue-helpers";

interface AiSummarySectionProps {
  readonly intake: StaffIntakeDetailRecord;
  readonly isClinicalReviewer: boolean;
  readonly isExtracting: boolean;
  readonly extractionError: string | null;
  readonly onRetryExtraction: () => void;
}

function SupportingQuoteToggle({
  quote,
  confirmedNarrative,
  itemKey,
  defaultOpen = false,
}: {
  readonly quote: string | undefined;
  readonly confirmedNarrative: string;
  readonly itemKey: string;
  readonly defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isVerified = isVerbatimSupportingQuote(quote, confirmedNarrative);

  if (!isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--mf-caution)]">
        <Icon name="alert" size="sm" />
        Not directly quoted — confirm with patient
      </span>
    );
  }

  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`supporting-quote-${itemKey}`}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12.5px] font-medium text-[var(--mf-primary-dark)] hover:underline"
      >
        <Icon name="quote" size="sm" />
        <span>{open ? "Hide supporting statement" : "Supporting statement"}</span>
      </button>

      {open && (
        <blockquote
          id={`supporting-quote-${itemKey}`}
          className="m-0 rounded-[4px] border-l-2 border-[var(--mf-primary)] bg-[var(--mf-canvas)] px-3 py-2 text-[13.5px] leading-[1.45] text-[var(--mf-text)]"
        >
          <span className="block text-[11px] font-semibold tracking-wide text-[var(--mf-text-secondary)] uppercase">
            From patient&apos;s statement
          </span>
          &ldquo;{quote.trim()}&rdquo;
        </blockquote>
      )}
    </div>
  );
}

export function AiSummarySection({
  intake,
  isClinicalReviewer,
  isExtracting,
  extractionError,
  onRetryExtraction,
}: AiSummarySectionProps) {
  const { aiDraft, patientSource } = intake;
  const brief = aiDraft.brief;
  const confirmedNarrative = patientSource.confirmedNarrative;
  const verifiedQuoteCount = countVerifiedBriefQuotes(
    brief,
    confirmedNarrative,
  );

  // Concise, non-technical AI failure / unavailable panel
  if (!brief || aiDraft.status === "failed") {
    return (
      <section
        aria-labelledby="ai-summary-heading"
        className="rounded-[6px] border border-[var(--mf-warning)]/40 bg-[var(--mf-warning-tint)] p-5"
        data-testid="ai-unavailable-panel"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Icon
              name="alert"
              size="md"
              className="mt-0.5 shrink-0 text-[var(--mf-warning)]"
            />
            <div className="grid gap-1">
              <h2
                id="ai-summary-heading"
                className="mf-t-card m-0 text-[var(--mf-text)]"
              >
                {AI_UNAVAILABLE_STAFF_COPY.title}
              </h2>
              <p className="m-0 text-[14px] text-[var(--mf-text)]">
                {extractionError ?? AI_UNAVAILABLE_STAFF_COPY.body}
              </p>
            </div>
          </div>

          {isClinicalReviewer && (
            <div className="shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isExtracting}
                disabled={isExtracting}
                onClick={onRetryExtraction}
                data-testid="retry-ai-extraction-btn"
              >
                <Icon name="refresh" size="sm" spin={isExtracting} />
                {AI_UNAVAILABLE_STAFF_COPY.retryLabel}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ai-summary-heading"
      className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5"
      data-testid="ai-summary-section"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mf-border)] pb-3">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="ai-summary-heading"
              className="mf-t-card m-0 text-[var(--mf-text)]"
            >
              AI Summary
            </h2>
            {aiDraft.status === "needs_human_clarification" ? (
              <Badge tone="caution">Needs Clarification</Badge>
            ) : (
              <Badge tone="info">AI Draft</Badge>
            )}
          </div>
          <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
            {verifiedQuoteCount > 0
              ? `Organized from the patient's statement · ${verifiedQuoteCount} verified supporting ${verifiedQuoteCount === 1 ? "quote" : "quotes"}.`
              : "Organized from the patient's statement · No direct supporting quotes matched; confirm details directly."}
          </p>
        </div>

        {isClinicalReviewer && (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            loading={isExtracting}
            disabled={isExtracting}
            onClick={onRetryExtraction}
            data-testid="retry-ai-extraction-btn"
          >
            <Icon name="refresh" size="sm" spin={isExtracting} />
            Regenerate
          </Button>
        )}
      </div>

      {extractionError && (
        <div
          role="alert"
          className="rounded-[4px] border border-[var(--mf-warning)]/40 bg-[var(--mf-warning-tint)] px-3.5 py-2.5 text-[13.5px] text-[var(--mf-text)]"
        >
          {extractionError}
        </div>
      )}

      {/* Chief Concern */}
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mf-eyebrow">Chief concern</span>
          {brief.chiefConcern.certainty === "unclear" && (
            <Badge tone="caution">Unclear</Badge>
          )}
        </div>
        <p className="m-0 text-[15.5px] font-semibold text-[var(--mf-text)]">
          {brief.chiefConcern.value}
        </p>
        <SupportingQuoteToggle
          quote={brief.chiefConcern.sourceQuote}
          confirmedNarrative={confirmedNarrative}
          itemKey="chief-concern"
          defaultOpen
        />
      </div>

      {/* Reported Symptoms */}
      {brief.symptoms.length > 0 && (
        <div className="grid gap-2.5 border-t border-[var(--mf-border)] pt-3.5">
          <span className="mf-eyebrow">Reported symptoms</span>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {brief.symptoms.map((symptom, idx) => (
              <li
                key={`${symptom.value}-${idx}`}
                className="grid gap-1 rounded-[5px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-medium text-[var(--mf-text)]">
                    {symptom.value}
                  </span>
                  {symptom.certainty === "unclear" && (
                    <Badge tone="caution">Unclear</Badge>
                  )}
                </div>
                {(symptom.duration || symptom.severity) && (
                  <div className="text-[13px] text-[var(--mf-text-secondary)]">
                    {symptom.duration ? `Duration: ${symptom.duration}` : ""}
                    {symptom.duration && symptom.severity ? " · " : ""}
                    {symptom.severity ? `Severity: ${symptom.severity}` : ""}
                  </div>
                )}
                <SupportingQuoteToggle
                  quote={symptom.sourceQuote}
                  confirmedNarrative={confirmedNarrative}
                  itemKey={`symptom-${idx}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relevant Context */}
      {brief.relevantContext.length > 0 && (
        <div className="grid gap-2 border-t border-[var(--mf-border)] pt-3.5">
          <span className="mf-eyebrow">Relevant context</span>
          <ul className="m-0 grid list-none gap-2 p-0">
            {brief.relevantContext.map((item, idx) => (
              <li
                key={`${item.value}-${idx}`}
                className="grid gap-1 text-[14px] text-[var(--mf-text)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>{item.value}</span>
                  {item.certainty === "unclear" && (
                    <Badge tone="caution">Unclear</Badge>
                  )}
                </div>
                <SupportingQuoteToggle
                  quote={item.sourceQuote}
                  confirmedNarrative={confirmedNarrative}
                  itemKey={`context-${idx}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reported Details to Review (only verbatim-verified quotes) */}
      {brief.reportedDetailsToReview.length > 0 && (
        <div className="grid gap-2 border-t border-[var(--mf-border)] pt-3.5">
          <span className="mf-eyebrow">Reported details to verify</span>
          <ul className="m-0 grid list-none gap-2 p-0">
            {brief.reportedDetailsToReview.map((item, idx) => (
              <li
                key={`${item.detail}-${idx}`}
                className="grid gap-1 rounded-[5px] bg-[var(--mf-surface-subtle)] p-3 text-[13.5px]"
              >
                <span className="font-semibold text-[var(--mf-text)]">
                  {item.detail}
                </span>
                <span className="text-[var(--mf-text-secondary)]">
                  {item.context}
                </span>
                <SupportingQuoteToggle
                  quote={item.sourceQuote}
                  confirmedNarrative={confirmedNarrative}
                  itemKey={`detail-${idx}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing or Unclear Details */}
      {brief.missingOrUnclear.length > 0 && (
        <div className="grid gap-1.5 rounded-[5px] border border-[var(--mf-caution)]/35 bg-[var(--mf-caution-tint)] p-3.5">
          <span className="text-[12.5px] font-semibold text-[var(--mf-caution)]">
            Details needing clarification
          </span>
          <ul className="m-0 grid list-disc gap-1 pl-4 text-[13.5px] text-[var(--mf-text)]">
            {brief.missingOrUnclear.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Concise Summary Note & Limitations */}
      <div className="grid gap-2 border-t border-[var(--mf-border)] pt-3.5">
        <span className="mf-eyebrow">Summary note</span>
        <p className="m-0 text-[14px] leading-[1.55] text-[var(--mf-text)]">
          {brief.clinicianSummary}
        </p>
        <p className="m-0 text-[12.5px] text-[var(--mf-text-secondary)]">
          {brief.limitations.join(" · ")}
        </p>
      </div>
    </section>
  );
}
