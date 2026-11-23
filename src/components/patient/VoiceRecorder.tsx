import { Button, Icon } from "@/components/ui";
import {
  formatRecordingDuration,
  MAX_VOICE_RECORDING_SECONDS,
} from "@/lib/patient/intake-flow";

export interface VoiceRecorderProps {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly recordingSeconds: number;
  readonly voiceError: string | null;
  readonly onStartRecording: () => void;
  readonly onStopAndTranscribe: () => void;
  readonly onCancelRecording: () => void;
  readonly onSwitchToType: () => void;
  readonly hasExistingStatement: boolean;
  readonly onReturnToStatement?: () => void;
}

export function VoiceRecorder({
  isRecording,
  isTranscribing,
  recordingSeconds,
  voiceError,
  onStartRecording,
  onStopAndTranscribe,
  onCancelRecording,
  onSwitchToType,
  hasExistingStatement,
  onReturnToStatement,
}: VoiceRecorderProps) {
  if (isTranscribing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid justify-items-center gap-4 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-5 py-10 text-center"
        data-testid="voice-transcribing-state"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--mf-primary-tint)] text-[var(--mf-primary-dark)]">
          <Icon name="loader" size="xl" spin />
        </div>
        <div className="grid gap-1">
          <p className="m-0 text-[18px] font-semibold text-[var(--mf-text)]">
            Turning your voice into words...
          </p>
          <p className="m-0 text-[14.5px] text-[var(--mf-text-secondary)]">
            Please keep this screen open for a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-5 rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-5 py-7 sm:p-8"
      data-testid="voice-intake-panel"
    >
      {/* Friendly non-technical mic unavailable / transcription error message */}
      {voiceError ? (
        <div
          role="alert"
          className="grid gap-3 rounded-[6px] border border-[var(--mf-warning)] border-l-4 bg-[var(--mf-warning-tint)] p-4 text-left"
          data-testid="voice-error-banner"
        >
          <div className="flex items-start gap-2.5">
            <Icon
              name="micOff"
              size="md"
              className="mt-0.5 shrink-0 text-[var(--mf-warning)]"
            />
            <div className="grid gap-1">
              <p className="m-0 text-[15px] font-semibold text-[var(--mf-text)]">
                Voice recording issue
              </p>
              <p className="m-0 text-[14px] leading-[1.45] text-[var(--mf-text)]">
                {voiceError}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onSwitchToType}
              data-testid="voice-fallback-type-btn"
            >
              Type your concern instead
              <Icon name="arrow" size="btn" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Centerpiece Circular Microphone Control */}
      <div className="grid justify-items-center gap-5 py-2 text-center">
        {!isRecording ? (
          <>
            <button
              type="button"
              onClick={onStartRecording}
              aria-label="Tap to start speaking"
              data-testid="start-voice-recording-btn"
              className="group relative flex h-[144px] w-[144px] items-center justify-center rounded-full border-4 border-[var(--mf-primary-tint)] bg-[var(--mf-primary)] text-white shadow-sm transition-transform duration-150 hover:bg-[var(--mf-primary-dark)] active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--mf-focus)]"
            >
              <Icon name="mic" size="xl" className="!h-11 !w-11" />
            </button>

            <div className="grid gap-1">
              <p className="m-0 text-[18px] font-semibold text-[var(--mf-text)]">
                Tap to start speaking
              </p>
              <p className="m-0 max-w-[34ch] text-[14px] leading-[1.45] text-[var(--mf-text-secondary)]">
                Speak naturally. You can review your words before submitting.
              </p>
            </div>

            {hasExistingStatement && onReturnToStatement ? (
              <button
                type="button"
                onClick={onReturnToStatement}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[6px] px-3 text-[13.5px] font-semibold text-[var(--mf-primary-dark)] hover:bg-[var(--mf-primary-tint)]"
              >
                <span>Keep existing statement</span>
                <Icon name="arrow" size="sm" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onStopAndTranscribe}
              aria-label="Stop recording and review words"
              data-testid="stop-voice-circle-btn"
              className="mf-voice-halo flex h-[144px] w-[144px] flex-col items-center justify-center gap-2 rounded-full border-4 border-[var(--mf-primary-light)] bg-[var(--mf-navy-900)] text-white transition-colors hover:bg-[var(--mf-navy-800)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--mf-focus)]"
            >
              <span className="mf-bars is-listening inline-flex" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="mf-mono text-[20px] font-semibold tracking-tight text-white">
                {formatRecordingDuration(recordingSeconds)}
              </span>
            </button>

            <div className="grid gap-1" role="status" aria-live="polite">
              <div className="flex items-center justify-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--mf-danger)]"
                />
                <span className="text-[16px] font-semibold text-[var(--mf-text)]">
                  Listening... ({formatRecordingDuration(recordingSeconds)} /{" "}
                  {formatRecordingDuration(MAX_VOICE_RECORDING_SECONDS)})
                </span>
              </div>
              <p className="m-0 text-[13.5px] text-[var(--mf-text-secondary)]">
                Tap Stop Recording when you finish speaking.
              </p>
            </div>

            <div className="grid w-full gap-2.5 sm:max-w-[320px]">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={onStopAndTranscribe}
                data-testid="stop-voice-recording-btn"
              >
                <Icon name="square" size="sm" />
                Stop Recording
              </Button>

              <button
                type="button"
                onClick={onCancelRecording}
                data-testid="cancel-voice-recording-btn"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[6px] text-[14px] font-semibold text-[var(--mf-text-secondary)] transition-colors hover:bg-[var(--mf-surface-subtle)] hover:text-[var(--mf-text)]"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
