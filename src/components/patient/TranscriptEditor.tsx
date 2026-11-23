import { Button, Icon } from "@/components/ui";
import { INTAKE_LIMITS } from "@/lib/schemas/intake";

export interface TranscriptEditorProps {
  readonly narrative: string;
  readonly onNarrativeChange: (value: string) => void;
  readonly validationError: string | null;
  readonly onRecordAgain: () => void;
  readonly onContinue: () => void;
}

export function TranscriptEditor({
  narrative,
  onNarrativeChange,
  validationError,
  onRecordAgain,
  onContinue,
}: TranscriptEditorProps) {
  const trimmedLength = narrative.trim().length;

  return (
    <div
      className="mf-step-enter grid gap-5"
      data-testid="voice-transcript-editor"
    >
      <div className="grid gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-[4px] bg-[var(--mf-success-tint)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--mf-success-dark)]">
          <Icon name="checkCircle" size="sm" />
          <span>Voice captured</span>
        </div>
        <h2 className="m-0 text-[1.375rem] font-semibold leading-[1.25] text-[var(--mf-text)]">
          Here&apos;s what we heard.
        </h2>
        <p className="m-0 text-[15px] leading-[1.5] text-[var(--mf-text-secondary)]">
          Review your words and make any corrections before continuing.
        </p>
      </div>

      <div className="mf-field rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="confirmed-narrative" className="mf-label">
            Your statement
          </label>
          <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
            {trimmedLength} / {INTAKE_LIMITS.maxNarrativeLength}
          </span>
        </div>

        <textarea
          id="confirmed-narrative"
          className="mf-textarea mf-textarea--lg mt-1.5"
          rows={6}
          maxLength={INTAKE_LIMITS.maxNarrativeLength}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={
            validationError ? "narrative-error" : "transcript-editor-hint"
          }
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          data-testid="confirmed-narrative-textarea"
        />

        <span id="transcript-editor-hint" className="mf-hint">
          Edit any wording above so it matches exactly what you want staff to
          read.
        </span>

        {validationError ? (
          <p id="narrative-error" role="alert" className="mf-error m-0">
            <Icon name="circleAlert" size="sm" />
            <span>{validationError}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onRecordAgain}
          data-testid="record-again-btn"
          className="order-2 sm:order-1"
        >
          <Icon name="mic" size="btn" />
          Record Again
        </Button>

        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          data-testid="step2-continue-btn"
          className="order-1 sm:order-2"
        >
          Continue
          <Icon name="arrow" size="btn" />
        </Button>
      </div>
    </div>
  );
}
