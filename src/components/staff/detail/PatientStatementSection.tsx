"use client";

import { Icon } from "@/components/ui";
import type { StaffIntakeDetailRecord } from "@/lib/schemas/staff-api";
import { formatDetailedTimestamp } from "@/lib/staff/queue-helpers";

interface PatientStatementSectionProps {
  readonly intake: StaffIntakeDetailRecord;
}

export function PatientStatementSection({
  intake,
}: PatientStatementSectionProps) {
  const { patientSource, aiDraft } = intake;
  const hasDistinctRawTranscript =
    patientSource.inputMode === "voice" &&
    Boolean(patientSource.transcriptRaw) &&
    patientSource.transcriptRaw?.trim() !==
      patientSource.confirmedNarrative.trim();

  return (
    <section
      aria-labelledby="patient-statement-heading"
      className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5"
      data-testid="patient-statement-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="grid gap-0.5">
          <h2
            id="patient-statement-heading"
            className="mf-t-card m-0 text-[var(--mf-text)]"
          >
            What the patient said
          </h2>
          <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
            Patient&apos;s confirmed statement · Saved permanently and never
            overwritten by staff edits.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--mf-surface-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--mf-text-secondary)]">
          <Icon
            name={patientSource.inputMode === "voice" ? "mic" : "edit"}
            size="sm"
          />
          {patientSource.inputMode === "voice"
            ? "Voice intake"
            : "Typed intake"}
        </span>
      </div>

      <blockquote
        className="mf-quote !text-[16px] !leading-[1.6]"
        data-testid="patient-confirmed-narrative"
      >
        {patientSource.confirmedNarrative}
      </blockquote>

      {hasDistinctRawTranscript && (
        <details className="mt-3 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-3.5 py-2.5">
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--mf-text)]">
            View original voice transcript before patient edits
          </summary>
          <p className="m-0 mt-2 text-[14px] leading-[1.5] text-[var(--mf-text-secondary)]">
            {patientSource.transcriptRaw}
          </p>
        </details>
      )}

      <details
        className="mt-3 border-t border-[var(--mf-border)] pt-3"
        data-testid="technical-details-disclosure"
      >
        <summary className="cursor-pointer text-[12.5px] font-medium text-[var(--mf-text-secondary)] hover:text-[var(--mf-text)]">
          Technical details
        </summary>
        <dl className="mf-dl mt-2.5 mb-0 rounded-[4px] bg-[var(--mf-surface-subtle)] p-3 text-[12.5px]">
          <dt>Reference</dt>
          <dd className="mf-mono">{intake.referenceCode}</dd>
          <dt>Input mode</dt>
          <dd className="capitalize">{patientSource.inputMode}</dd>
          {patientSource.transcriptConfirmedAt && (
            <>
              <dt>Confirmed at</dt>
              <dd>
                {formatDetailedTimestamp(patientSource.transcriptConfirmedAt)}
              </dd>
            </>
          )}
          <dt>Statement SHA-256</dt>
          <dd className="mf-mono break-all text-[11.5px]">
            {patientSource.confirmedNarrativeSha256}
          </dd>
          {aiDraft.modelId && (
            <>
              <dt>AI extraction model</dt>
              <dd className="mf-mono text-[12px]">{aiDraft.modelId}</dd>
            </>
          )}
          {patientSource.transcriptionModel && (
            <>
              <dt>Voice transcription model</dt>
              <dd className="mf-mono text-[12px]">
                {patientSource.transcriptionModel}
              </dd>
            </>
          )}
        </dl>
      </details>
    </section>
  );
}
