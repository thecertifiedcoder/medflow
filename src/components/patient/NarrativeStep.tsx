import { Button, Icon } from "@/components/ui";
import { INTAKE_LIMITS, type InputMode } from "@/lib/schemas/intake";
import { TranscriptEditor } from "./TranscriptEditor";
import { VoiceRecorder } from "./VoiceRecorder";

export interface NarrativeStepProps {
  readonly inputMode: InputMode;
  readonly onModeChange: (mode: InputMode) => void;
  readonly narrative: string;
  readonly onNarrativeChange: (value: string) => void;
  readonly showTranscriptEditor: boolean;
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly recordingSeconds: number;
  readonly voiceError: string | null;
  readonly narrativeError: string | null;
  readonly onStartRecording: () => void;
  readonly onStopAndTranscribe: () => void;
  readonly onCancelRecording: () => void;
  readonly onRecordAgain: () => void;
  readonly onReturnToTranscriptEditor: () => void;
  readonly onContinue: () => void;
}

export function NarrativeStep({
  inputMode,
  onModeChange,
  narrative,
  onNarrativeChange,
  showTranscriptEditor,
  isRecording,
  isTranscribing,
  recordingSeconds,
  voiceError,
  narrativeError,
  onStartRecording,
  onStopAndTranscribe,
  onCancelRecording,
  onRecordAgain,
  onReturnToTranscriptEditor,
  onContinue,
}: NarrativeStepProps) {
  const trimmedLength = narrative.trim().length;
  const isBusyVoice = isRecording || isTranscribing;

  return (
    <section
      aria-labelledby="step2-heading"
      className="mf-step-enter grid gap-5"
      data-testid="patient-step-2"
    >
      <div className="grid gap-1.5">
        <h1
          id="step2-heading"
          className="m-0 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--mf-text)] sm:text-[1.75rem]"
        >
          What brings you in today?
        </h1>
        <p className="m-0 text-[15.5px] leading-[1.5] text-[var(--mf-text-secondary)]">
          Tell us in your own words. Take your time.
        </p>
      </div>

      {/* Prominent Speak / Type Segmented Selector */}
      <fieldset className="mf-seg" disabled={isBusyVoice}>
        <legend className="mf-sr-only">Choose how to share your concern</legend>
        <div
          className="grid grid-cols-2 gap-2 rounded-[8px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-1"
          role="radiogroup"
          aria-label="How would you like to share?"
        >
          <button
            type="button"
            role="radio"
            aria-checked={inputMode === "voice"}
            disabled={isBusyVoice}
            onClick={() => onModeChange("voice")}
            data-testid="mode-voice-btn"
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[6px] px-3 text-[15px] transition-colors ${
              inputMode === "voice"
                ? "bg-[var(--mf-primary)] font-semibold text-white shadow-xs"
                : "bg-transparent font-medium text-[var(--mf-text)] hover:bg-[var(--mf-surface)]/70"
            }`}
          >
            <Icon name="mic" size="btn" />
            <span>Speak</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={inputMode === "typed"}
            disabled={isBusyVoice}
            onClick={() => onModeChange("typed")}
            data-testid="mode-typed-btn"
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[6px] px-3 text-[15px] transition-colors ${
              inputMode === "typed"
                ? "border border-[var(--mf-primary-dark)] bg-[var(--mf-surface)] font-semibold text-[var(--mf-primary-dark)] shadow-xs"
                : "bg-transparent font-medium text-[var(--mf-text-secondary)] hover:bg-[var(--mf-surface)]/70 hover:text-[var(--mf-text)]"
            }`}
          >
            <Icon name="edit" size="btn" />
            <span>Type</span>
          </button>
        </div>
      </fieldset>

      {/* Voice Experience */}
      {inputMode === "voice" ? (
        showTranscriptEditor ? (
          <TranscriptEditor
            narrative={narrative}
            onNarrativeChange={onNarrativeChange}
            validationError={narrativeError}
            onRecordAgain={onRecordAgain}
            onContinue={onContinue}
          />
        ) : (
          <div className="grid gap-3">
            <VoiceRecorder
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              recordingSeconds={recordingSeconds}
              voiceError={voiceError}
              onStartRecording={onStartRecording}
              onStopAndTranscribe={onStopAndTranscribe}
              onCancelRecording={onCancelRecording}
              onSwitchToType={() => onModeChange("typed")}
              hasExistingStatement={trimmedLength > 0}
              onReturnToStatement={
                trimmedLength > 0 ? onReturnToTranscriptEditor : undefined
              }
            />

            {!isBusyVoice ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onModeChange("typed")}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[6px] px-3 text-[13.5px] font-semibold text-[var(--mf-text-secondary)] transition-colors hover:bg-[var(--mf-surface-subtle)] hover:text-[var(--mf-text)]"
                >
                  <Icon name="edit" size="sm" />
                  <span>Prefer to type instead?</span>
                </button>
              </div>
            ) : null}
          </div>
        )
      ) : (
        /* Typed Experience */
        <div className="mf-step-enter grid gap-5" data-testid="typed-intake-panel">
          <div className="grid gap-4 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4 sm:p-5">
            <div className="grid gap-1">
              <h2 className="m-0 text-[1.1875rem] font-semibold text-[var(--mf-text)]">
                Write what brings you in.
              </h2>
              <p className="m-0 text-[14.5px] text-[var(--mf-text-secondary)]">
                Tell us what you&apos;ve been experiencing in your own words.
              </p>
            </div>

            <div className="mf-field">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="confirmed-narrative" className="mf-label">
                  Your concern
                </label>
                <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                  {trimmedLength} / {INTAKE_LIMITS.maxNarrativeLength}
                </span>
              </div>

              <textarea
                id="confirmed-narrative"
                className="mf-textarea mf-textarea--lg"
                rows={6}
                maxLength={INTAKE_LIMITS.maxNarrativeLength}
                placeholder="Start typing here..."
                aria-invalid={narrativeError ? true : undefined}
                aria-describedby={
                  narrativeError ? "narrative-error" : "typed-narrative-hint"
                }
                value={narrative}
                onChange={(e) => onNarrativeChange(e.target.value)}
                data-testid="confirmed-narrative-textarea"
              />

              <span id="typed-narrative-hint" className="mf-hint">
                You can include when it started, how it feels and anything else
                you want the care team to know.
              </span>

              {narrativeError ? (
                <p id="narrative-error" role="alert" className="mf-error m-0">
                  <Icon name="circleAlert" size="sm" />
                  <span>{narrativeError}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => onModeChange("voice")}
              data-testid="switch-to-speak-btn"
              className="order-2 sm:order-1"
            >
              <Icon name="mic" size="btn" />
              Switch to Speak
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
      )}
    </section>
  );
}
