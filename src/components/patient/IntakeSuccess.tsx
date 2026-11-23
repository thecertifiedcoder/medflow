import { ButtonLink, Icon, SignalRule } from "@/components/ui";
import type { CreateIntakeResponse } from "@/lib/schemas/intake";

export interface IntakeSuccessProps {
  readonly receipt: CreateIntakeResponse;
  readonly patientDisplayName: string;
  readonly ageText: string;
  readonly trimmedNarrative: string;
  readonly onStartAnother: () => void;
}

export function IntakeSuccess({
  receipt,
  patientDisplayName,
  ageText,
  trimmedNarrative,
  onStartAnother,
}: IntakeSuccessProps) {
  return (
    <section
      aria-labelledby="intake-success-heading"
      role="status"
      className="mf-step-enter grid gap-5 py-2"
      data-testid="intake-submission-receipt"
    >
      <div className="grid justify-items-center gap-3 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-5 py-7 text-center sm:p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--mf-success-tint)] text-[var(--mf-success-dark)]">
          <Icon name="checkCircle" size="xl" />
        </div>

        <SignalRule className="w-full max-w-[180px]" />

        <div className="grid gap-1">
          <h1
            id="intake-success-heading"
            className="m-0 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--mf-text)]"
          >
            Your information has been saved.
          </h1>
          <p className="m-0 text-[15.5px] text-[var(--mf-text-secondary)]">
            Your demonstration intake has been recorded.
          </p>
        </div>

        {/* Distinct Reference Code Card */}
        <div className="mt-2 w-full rounded-[8px] border border-[var(--mf-primary)]/30 bg-[var(--mf-primary-tint)] px-4 py-4">
          <div className="mf-eyebrow text-[var(--mf-primary-dark)]">
            Patient Reference Code
          </div>
          <div
            className="mf-mono mt-1 text-[1.875rem] font-bold tracking-tight text-[var(--mf-text)]"
            data-testid="submitted-reference-code"
          >
            {receipt.referenceCode}
          </div>
          <p className="m-0 mt-1 text-[13px] text-[var(--mf-text-secondary)]">
            Save or note this reference for demonstration review.
          </p>
        </div>
      </div>

      {/* Recorded Summary */}
      <div className="grid gap-3 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5">
        <dl className="mf-dl m-0 text-[14.5px]">
          <dt>Name</dt>
          <dd>{patientDisplayName.trim() || "Walk-in patient (anonymous)"}</dd>
          {ageText.trim() ? (
            <>
              <dt>Age</dt>
              <dd className="mf-mono">{ageText.trim()} years</dd>
            </>
          ) : null}
        </dl>

        <hr className="mf-divider" />

        <div className="grid gap-1.5">
          <div className="mf-eyebrow">Confirmed statement</div>
          <blockquote className="mf-quote m-0 text-[15px]">
            &ldquo;{trimmedNarrative}&rdquo;
          </blockquote>
        </div>
      </div>

      {/* Clinical Safety & Prototype Reminder */}
      <div
        role="alert"
        className="flex items-start gap-3 rounded-[8px] border border-[var(--mf-warning)] border-l-4 bg-[var(--mf-warning-tint)] p-4 text-[13.5px] leading-[1.45] text-[var(--mf-text)]"
      >
        <Icon
          name="alert"
          size="md"
          className="mt-0.5 shrink-0 text-[var(--mf-warning)]"
        />
        <p className="m-0">
          This is a synthetic demonstration prototype—a real clinic has not
          received this submission. Submitting this form does not mean anyone is
          cleared to wait; if you ever need urgent help, alert staff directly.
        </p>
      </div>

      <div className="grid gap-2.5">
        <ButtonLink
          href="/"
          variant="primary"
          size="lg"
          fullWidth
          data-testid="intake-done-btn"
        >
          Done
        </ButtonLink>

        <button
          type="button"
          onClick={onStartAnother}
          data-testid="submit-another-intake-btn"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[6px] text-[14px] font-semibold text-[var(--mf-primary-dark)] transition-colors hover:bg-[var(--mf-primary-tint)]"
        >
          Start another synthetic intake
        </button>
      </div>
    </section>
  );
}
