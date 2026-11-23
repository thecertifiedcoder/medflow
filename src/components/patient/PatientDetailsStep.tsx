import { Button, Icon } from "@/components/ui";
import { INTAKE_LIMITS } from "@/lib/schemas/intake";
import { AgeSelector } from "./AgeSelector";

export interface PatientDetailsStepProps {
  readonly patientDisplayName: string;
  readonly onNameChange: (value: string) => void;
  readonly ageText: string;
  readonly onAgeChange: (value: string) => void;
  readonly ageError: string | null;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
}

export function PatientDetailsStep({
  patientDisplayName,
  onNameChange,
  ageText,
  onAgeChange,
  ageError,
  onContinue,
  onSkip,
}: PatientDetailsStepProps) {
  return (
    <section
      aria-labelledby="step1-heading"
      className="mf-step-enter grid gap-6"
      data-testid="patient-step-1"
    >
      <div className="grid gap-1.5 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <h1
            id="step1-heading"
            className="m-0 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--mf-text)] sm:text-[1.75rem]"
          >
            Let&apos;s get started.
          </h1>
          <span className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--mf-text-secondary)]">
            Optional
          </span>
        </div>
        <p className="m-0 text-[15.5px] leading-[1.5] text-[var(--mf-text-secondary)]">
          Just a couple of details before you tell us what&apos;s happening.
        </p>
      </div>

      <div className="grid gap-6 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5 sm:p-6">
        {/* Name input */}
        <div className="mf-field">
          <label htmlFor="patient-display-name" className="mf-label">
            <span>What should we call you?</span>
            <span className="mf-label__req">Optional</span>
          </label>
          <input
            id="patient-display-name"
            type="text"
            autoComplete="name"
            className="mf-input mf-input--lg"
            maxLength={INTAKE_LIMITS.maxDisplayNameLength}
            placeholder="Enter your name or preferred name"
            value={patientDisplayName}
            onChange={(e) => onNameChange(e.target.value)}
            data-testid="patient-name-input"
          />
        </div>

        <hr className="mf-divider" />

        {/* Centred square-style Age Selector */}
        <div className="grid justify-items-center gap-3 py-1">
          <span className="text-[15.5px] font-semibold text-[var(--mf-text)]">
            How old are you?
          </span>
          <AgeSelector
            value={ageText}
            onChange={onAgeChange}
            error={ageError}
          />
        </div>
      </div>

      {/* Primary CTA + Secondary Skip action */}
      <div className="grid gap-2.5">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          data-testid="step1-continue-btn"
        >
          Continue
          <Icon name="arrow" size="btn" />
        </Button>

        <button
          type="button"
          onClick={onSkip}
          data-testid="step1-skip-btn"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[6px] text-[14.5px] font-semibold text-[var(--mf-primary-dark)] transition-colors hover:bg-[var(--mf-primary-tint)]"
        >
          Skip for now
        </button>
      </div>
    </section>
  );
}
