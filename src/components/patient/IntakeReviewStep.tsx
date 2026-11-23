import { Alert, Button, Icon } from "@/components/ui";

export interface IntakeReviewStepProps {
  readonly patientDisplayName: string;
  readonly ageText: string;
  readonly trimmedNarrative: string;
  readonly patientConfirmed: boolean;
  readonly onConfirmChange: (checked: boolean) => void;
  readonly onEditDetails: () => void;
  readonly onEditStatement: () => void;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
  readonly submitError: string | null;
}

export function IntakeReviewStep({
  patientDisplayName,
  ageText,
  trimmedNarrative,
  patientConfirmed,
  onConfirmChange,
  onEditDetails,
  onEditStatement,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: IntakeReviewStepProps) {
  const displayName = patientDisplayName.trim() || "Walk-in patient (anonymous)";
  const trimmedAge = ageText.trim();

  return (
    <section
      aria-labelledby="step3-heading"
      className="mf-step-enter grid gap-4"
      data-testid="patient-review-step"
    >
      <div className="grid gap-1">
        <h1
          id="step3-heading"
          className="m-0 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--mf-text)] sm:text-[1.75rem]"
        >
          Review your information.
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-[var(--mf-text-secondary)]">
          Please make sure everything looks right before sending.
        </p>
      </div>

      {/* Summary card */}
      <div className="grid gap-3.5 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4 sm:p-5">
        {/* Your details */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mf-eyebrow m-0">Your details</h2>
            <button
              type="button"
              onClick={onEditDetails}
              disabled={isSubmitting}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] px-2 text-[13px] font-semibold text-[var(--mf-primary-dark)] hover:bg-[var(--mf-primary-tint)] disabled:opacity-50"
            >
              <Icon name="edit" size="sm" />
              Edit
            </button>
          </div>
          <dl className="mf-dl m-0 text-[15px]">
            <dt>Name</dt>
            <dd>{displayName}</dd>
            {trimmedAge ? (
              <>
                <dt>Age</dt>
                <dd className="mf-mono">{trimmedAge} years</dd>
              </>
            ) : null}
          </dl>
        </div>

        <hr className="mf-divider" />

        {/* Your statement */}
        <div className="grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mf-eyebrow m-0">Your statement</h2>
            <button
              type="button"
              onClick={onEditStatement}
              disabled={isSubmitting}
              data-testid="review-edit-statement-btn"
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] px-2 text-[13px] font-semibold text-[var(--mf-primary-dark)] hover:bg-[var(--mf-primary-tint)] disabled:opacity-50"
            >
              <Icon name="edit" size="sm" />
              Edit
            </button>
          </div>
          <blockquote className="mf-quote m-0 text-[16px]">
            &ldquo;{trimmedNarrative}&rdquo;
          </blockquote>
        </div>
      </div>

      {/* Explicit Confirmation Checkbox */}
      <div className="rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4 sm:p-5">
        <label
          htmlFor="patient-confirm-checkbox"
          className="flex cursor-pointer items-start gap-3 text-[15px] font-medium leading-[1.48] text-[var(--mf-text)]"
        >
          <input
            id="patient-confirm-checkbox"
            type="checkbox"
            checked={patientConfirmed}
            disabled={isSubmitting}
            onChange={(e) => onConfirmChange(e.target.checked)}
            data-testid="patient-confirm-checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--mf-primary)]"
          />
          <span>
            I confirm that this is an accurate statement of what I want the
            clinic staff to read.
          </span>
        </label>

        <p className="m-0 mt-3 border-t border-[var(--mf-border)] pt-3 text-[12.5px] leading-[1.45] text-[var(--mf-text-secondary)]">
          This is a synthetic demonstration prototype, not a replacement for
          real clinical care or medical advice. Submitting does not clear anyone
          to wait if symptoms feel urgent.
        </p>
      </div>

      {submitError ? (
        <Alert tone="danger" title="Unable to submit intake">
          {submitError}
        </Alert>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-[auto_1fr]">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={isSubmitting}
          onClick={onBack}
          data-testid="step3-back-btn"
          className="order-2 sm:order-1"
        >
          Back
        </Button>

        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={!patientConfirmed || isSubmitting}
          onClick={onSubmit}
          data-testid="submit-intake-btn"
          className="order-1 sm:order-2"
        >
          {!isSubmitting ? <Icon name="check" size="btn" /> : null}
          {isSubmitting ? "Submitting..." : "Submit Intake"}
        </Button>
      </div>
    </section>
  );
}
