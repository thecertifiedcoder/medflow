import { Icon } from "@/components/ui";
import {
  INTAKE_STEP_DEFINITIONS,
  type IntakeStep,
} from "@/lib/patient/intake-flow";

export interface IntakeProgressProps {
  readonly currentStep: IntakeStep;
  readonly onBack?: () => void;
}

export function IntakeProgress({ currentStep, onBack }: IntakeProgressProps) {
  const activeDef =
    INTAKE_STEP_DEFINITIONS.find((item) => item.step === currentStep) ?? {
      step: 1,
      title: "About You",
      shortLabel: "About you",
    };
  const percent = Math.round((currentStep / 3) * 100);

  return (
    <div className="grid gap-2.5" data-testid="intake-progress">
      <div className="flex items-center justify-between gap-2">
        {currentStep > 1 && onBack ? (
          <button
            type="button"
            onClick={onBack}
            data-testid="intake-back-btn"
            className="inline-flex min-h-[40px] -ml-2 items-center gap-1 rounded-[6px] px-2 text-[14px] font-semibold text-[var(--mf-primary-dark)] transition-colors hover:bg-[var(--mf-primary-tint)]"
          >
            <Icon name="chevronLeft" size="sm" />
            <span>Back</span>
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-[var(--mf-text-secondary)]">
            Patient intake
          </span>
        )}

        <span className="mf-mono text-[12.5px] font-semibold text-[var(--mf-text-secondary)]">
          Step {currentStep} of 3 · {activeDef.shortLabel}
        </span>
      </div>

      {/* Linear 3-segment step bar */}
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={currentStep}
        aria-label={`Step ${currentStep} of 3: ${activeDef.title}`}
        className="grid grid-cols-3 gap-1.5"
      >
        {INTAKE_STEP_DEFINITIONS.map((item) => {
          const isCompletedOrCurrent = item.step <= currentStep;
          return (
            <span
              key={item.step}
              aria-label={`Step ${item.step}: ${item.shortLabel}`}
              data-step-state={
                item.step < currentStep
                  ? "completed"
                  : item.step === currentStep
                    ? "current"
                    : "upcoming"
              }
              className={`h-1.5 rounded-[2px] transition-colors duration-200 ${
                isCompletedOrCurrent
                  ? "bg-[var(--mf-primary)]"
                  : "bg-[var(--mf-border)]"
              }`}
            />
          );
        })}
      </div>

      <span className="mf-sr-only" aria-live="polite">
        Step {currentStep} of 3 ({percent}%): {activeDef.title}
      </span>
    </div>
  );
}
