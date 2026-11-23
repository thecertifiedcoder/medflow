import { Icon } from "@/components/ui";
import { stepAgeValue } from "@/lib/patient/intake-flow";
import { INTAKE_LIMITS } from "@/lib/schemas/intake";

export interface AgeSelectorProps {
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly error?: string | null;
}

export function AgeSelector({ value, onChange, error }: AgeSelectorProps) {
  const numericValue =
    value.trim().length > 0 && /^\d+$/.test(value.trim())
      ? Number.parseInt(value.trim(), 10)
      : null;

  const canDecrement = numericValue !== null && numericValue > 0;
  const canIncrement =
    numericValue === null || numericValue < INTAKE_LIMITS.maxAge;

  return (
    <div className="grid justify-items-center gap-2.5">
      <div className="flex w-full items-center justify-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onChange(stepAgeValue(value, -1))}
          disabled={!canDecrement}
          aria-label="Decrease age by one year"
          data-testid="age-decrement-btn"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[var(--mf-border-input)] bg-[var(--mf-surface)] text-[var(--mf-text)] transition-colors hover:bg-[var(--mf-surface-subtle)] active:translate-y-px disabled:cursor-not-allowed disabled:border-[var(--mf-border)] disabled:bg-[var(--mf-surface-subtle)] disabled:text-[var(--mf-text-secondary)]/50"
        >
          <Icon name="minus" size="md" />
        </button>

        {/* Centred square tactile age surface */}
        <label
          htmlFor="patient-age"
          className={`flex h-[156px] w-[156px] flex-col items-center justify-center rounded-[10px] border bg-[var(--mf-surface)] p-3 text-center transition-colors focus-within:outline-3 focus-within:outline-[var(--mf-focus)] ${
            error
              ? "border-2 border-[var(--mf-danger)]"
              : "border-[var(--mf-border-input)] hover:border-[var(--mf-text)]"
          }`}
        >
          <span className="mf-eyebrow text-[11px] text-[var(--mf-text-secondary)]">
            Age
          </span>
          <input
            id="patient-age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Your age in years (optional, 0 to 120)"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "patient-age-error" : "patient-age-hint"}
            placeholder="—"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            data-testid="patient-age-input"
            className="mf-age-field mf-mono w-full border-0 bg-transparent p-0 text-center text-[2.5rem] font-semibold leading-[1.1] text-[var(--mf-text)] placeholder:text-[var(--mf-border-input)] focus:outline-none"
          />
          <span
            id="patient-age-hint"
            className="mt-1 text-[13px] font-medium text-[var(--mf-text-secondary)]"
          >
            years
          </span>
        </label>

        <button
          type="button"
          onClick={() => onChange(stepAgeValue(value, 1))}
          disabled={!canIncrement}
          aria-label="Increase age by one year"
          data-testid="age-increment-btn"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[var(--mf-border-input)] bg-[var(--mf-surface)] text-[var(--mf-text)] transition-colors hover:bg-[var(--mf-surface-subtle)] active:translate-y-px disabled:cursor-not-allowed disabled:border-[var(--mf-border)] disabled:bg-[var(--mf-surface-subtle)] disabled:text-[var(--mf-text-secondary)]/50"
        >
          <Icon name="plus" size="md" />
        </button>
      </div>

      <p className="m-0 text-[12.5px] text-[var(--mf-text-secondary)]">
        Optional · Tap − / + or type a number (0–{INTAKE_LIMITS.maxAge})
      </p>

      {error ? (
        <p
          id="patient-age-error"
          role="alert"
          className="mf-error m-0 justify-center text-center"
        >
          <Icon name="circleAlert" size="sm" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
