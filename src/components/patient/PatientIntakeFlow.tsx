"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
  SourceTag,
} from "@/components/ui";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import {
  INTAKE_LIMITS,
  type CreateIntakeResponse,
  type InputMode,
} from "@/lib/schemas/intake";
import {
  StaffApiClientError,
  submitPatientIntake,
  transcribePatientAudioRequest,
} from "@/lib/staff/api-client";

interface SyntheticExamplePreset {
  readonly id: string;
  readonly label: string;
  readonly displayName: string;
  readonly age: string;
  readonly inputMode: InputMode;
  readonly transcriptRaw?: string;
  readonly narrative: string;
}

const SYNTHETIC_EXAMPLE_PRESETS: readonly SyntheticExamplePreset[] = [
  {
    id: "chest-tightness",
    label: "Example 1: Chest tightness & dizziness (English)",
    displayName: "Adebayo O. (Synthetic Demo)",
    age: "54",
    inputMode: "typed",
    narrative:
      "I started feeling tightness in the center of my chest about two hours ago after climbing the stairs. I also feel lightheaded and slightly short of breath when walking. I take amlodipine for high blood pressure.",
  },
  {
    id: "pidgin-fever",
    label: "Example 2: Fever & headache (Nigerian English / Pidgin)",
    displayName: "Chidinma K. (Synthetic Demo)",
    age: "29",
    inputMode: "voice",
    transcriptRaw:
      "Since yesterday night my body dey hot well well and I get strong headache behind my eye.",
    narrative:
      "Since yesterday night my body dey hot well well and I get strong headache behind my eyes. I vomit once this morning after drinking water and my joints dey pain me.",
  },
  {
    id: "vague-fatigue",
    label: "Example 3: Brief concern needing nurse clarification",
    displayName: "Tunde M. (Synthetic Demo)",
    age: "41",
    inputMode: "typed",
    narrative:
      "I just do not feel fine since morning and my body feels weak.",
  },
];

const PATIENT_JOURNEY_STEPS = [
  { step: "1", label: "Instructions & Details" },
  { step: "2", label: "Reason for Visit (Type or Speak)" },
  { step: "3", label: "Review & Confirm Statement" },
] as const;

const MAX_RECORDING_SECONDS = 90;

function generateClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pt-${crypto.randomUUID()}`;
  }
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const base64 = reader.result.split(",")[1] ?? reader.result;
        resolve(base64);
      } else {
        reject(new Error("Unable to encode recorded audio."));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export function PatientIntakeFlow() {
  const [inputMode, setInputMode] = useState<InputMode>("typed");
  const [patientDisplayName, setPatientDisplayName] = useState<string>("");
  const [ageText, setAgeText] = useState<string>("");
  const [transcriptRaw, setTranscriptRaw] = useState<string>("");
  const [transcriptionModel, setTranscriptionModel] = useState<string | null>(
    null,
  );
  const [narrative, setNarrative] = useState<string>("");
  const [patientConfirmed, setPatientConfirmed] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateClientIdempotencyKey(),
  );

  // Voice recording & transcription state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] =
    useState<CreateIntakeResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const stopMediaResources = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      stopMediaResources();
    };
  }, []);

  const handleApplySyntheticPreset = (preset: SyntheticExamplePreset) => {
    setPatientDisplayName(preset.displayName);
    setAgeText(preset.age);
    setInputMode(preset.inputMode);
    setTranscriptRaw(preset.transcriptRaw ?? "");
    setTranscriptionModel(
      preset.inputMode === "voice" ? "gemini-3.5-transcribe" : null,
    );
    setNarrative(preset.narrative);
    setPatientConfirmed(false);
    setSubmitError(null);
    setVoiceError(null);
    setVoiceNotice(null);
    setIdempotencyKey(generateClientIdempotencyKey());
  };

  const handleClearDraft = () => {
    stopMediaResources();
    setPatientDisplayName("");
    setAgeText("");
    setTranscriptRaw("");
    setTranscriptionModel(null);
    setNarrative("");
    setPatientConfirmed(false);
    setSubmitError(null);
    setVoiceError(null);
    setVoiceNotice(null);
    setIdempotencyKey(generateClientIdempotencyKey());
  };

  const handleStartAnotherIntake = () => {
    handleClearDraft();
    setSubmittedReceipt(null);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const handleStartRecording = async () => {
    setVoiceError(null);
    setVoiceNotice(null);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError(
        "Voice recording is not supported in this browser environment. You can type or edit your transcript directly in the box below.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      let chosenMimeType = "";
      for (const candidate of preferredTypes) {
        if (
          typeof MediaRecorder.isTypeSupported === "function" &&
          MediaRecorder.isTypeSupported(candidate)
        ) {
          chosenMimeType = candidate;
          break;
        }
      }

      const recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || chosenMimeType || "audio/webm";
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        });
        stopMediaResources();

        if (recordedBlob.size === 0) {
          setVoiceError(
            "No audio was captured. Please try recording again or type your statement below.",
          );
          return;
        }

        setIsTranscribing(true);
        setVoiceError(null);
        try {
          const audioBase64 = await blobToBase64(recordedBlob);
          const result = await transcribePatientAudioRequest({
            audioBase64,
            mimeType,
          });
          setTranscriptRaw(result.transcriptRaw);
          setTranscriptionModel(result.transcriptionModel);
          setNarrative(result.transcriptRaw);
          setPatientConfirmed(false);
          setVoiceNotice(
            "Voice transcript generated. Please review and edit the text below before confirming.",
          );
        } catch (err) {
          setVoiceError(
            err instanceof StaffApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Voice transcription failed. You can retry recording or type directly in the box below.",
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.start();

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (
            next >= MAX_RECORDING_SECONDS &&
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
          ) {
            mediaRecorderRef.current.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      stopMediaResources();
      setVoiceError(
        "Microphone access was denied or unavailable. You can type or edit your transcript directly in the box below.",
      );
    }
  };

  const handleStopAndTranscribe = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      stopMediaResources();
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
    audioChunksRef.current = [];
    stopMediaResources();
    setRecordingSeconds(0);
  };

  const trimmedNarrative = narrative.trim();
  const hasValidNarrativeLength =
    trimmedNarrative.length >= INTAKE_LIMITS.minNarrativeLength &&
    trimmedNarrative.length <= INTAKE_LIMITS.maxNarrativeLength;

  const handleSubmitIntake = async () => {
    if (!hasValidNarrativeLength || !patientConfirmed || isSubmitting) {
      return;
    }

    setSubmitError(null);
    let parsedAge: number | undefined;
    if (ageText.trim().length > 0) {
      const numericAge = Number.parseInt(ageText.trim(), 10);
      if (
        !Number.isFinite(numericAge) ||
        numericAge < 0 ||
        numericAge > INTAKE_LIMITS.maxAge
      ) {
        setSubmitError(
          `Please enter a valid age between 0 and ${INTAKE_LIMITS.maxAge}, or leave age blank.`,
        );
        return;
      }
      parsedAge = numericAge;
    }

    setIsSubmitting(true);
    try {
      const response = await submitPatientIntake({
        facilityPublicCode: CANONICAL_DEMO_FACILITY.publicCode,
        ...(patientDisplayName.trim().length > 0
          ? { patientDisplayName: patientDisplayName.trim() }
          : {}),
        ...(parsedAge !== undefined ? { age: parsedAge } : {}),
        inputMode,
        ...(inputMode === "voice"
          ? {
              transcriptRaw:
                transcriptRaw.trim().length > 0
                  ? transcriptRaw.trim()
                  : trimmedNarrative,
            }
          : {}),
        confirmedNarrative: trimmedNarrative,
        idempotencyKey,
      });

      setSubmittedReceipt(response);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch (err) {
      setSubmitError(
        err instanceof StaffApiClientError
          ? err.message
          : "Unable to submit your intake statement right now. Please try again or speak to the clinic front desk.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedReceipt) {
    return (
      <div
        className="grid min-w-0 gap-5"
        data-testid="intake-submission-receipt"
      >
        <Alert
          tone="danger"
          title="If your symptoms worsen at any time, alert clinic staff in person immediately"
        >
          Your intake statement has been delivered to the{" "}
          <strong>{CANONICAL_DEMO_FACILITY.name}</strong> queue, but submitting
          this form{" "}
          <strong>
            does not mean a doctor or nurse has cleared you to wait
          </strong>
          . If you experience severe pain, trouble breathing, bleeding, or feel
          faint, speak to the front desk right now.
        </Alert>

        <ClinicalPanel
          source="patient"
          sourceLabel="Intake submitted · Saved in Neon PostgreSQL"
          title="Your statement has been received by the clinic queue"
          subtitle={`Facility: ${CANONICAL_DEMO_FACILITY.name} (${submittedReceipt.facilityPublicCode})`}
          action={
            <Badge tone="success" icon="checkCircle">
              Submitted
            </Badge>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
              <div className="mf-eyebrow">Your patient check-in reference</div>
              <div
                className="mf-mono mt-1 text-[28px] font-bold tracking-tight text-[var(--mf-text)]"
                data-testid="submitted-reference-code"
              >
                {submittedReceipt.referenceCode}
              </div>
              <p className="m-0 mt-1 text-[13.5px] text-[var(--mf-text-secondary)]">
                Show or mention this reference code when called by the intake
                nurse.
              </p>
            </div>

            <dl className="mf-dl m-0">
              <dt>Patient name / alias</dt>
              <dd>{patientDisplayName.trim() || "Walk-in Patient"}</dd>
              {ageText.trim() ? (
                <>
                  <dt>Reported age</dt>
                  <dd>{ageText.trim()} years</dd>
                </>
              ) : null}
              <dt>Capture mode</dt>
              <dd className="capitalize">{submittedReceipt.inputMode}</dd>
              <dt>AI structuring status</dt>
              <dd>
                <Badge
                  tone={
                    submittedReceipt.aiStatus === "succeeded"
                      ? "info"
                      : submittedReceipt.aiStatus ===
                          "needs_human_clarification"
                        ? "caution"
                        : "neutral"
                  }
                >
                  {submittedReceipt.aiStatus.replaceAll("_", " ")}
                </Badge>
              </dd>
            </dl>

            <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3.5">
              <div className="mf-eyebrow mb-1">
                Confirmed verbatim statement stored for clinical staff
              </div>
              <blockquote className="mf-quote m-0">
                &ldquo;{trimmedNarrative}&rdquo;
              </blockquote>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mf-border)] pt-4">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleStartAnotherIntake}
                data-testid="submit-another-intake-btn"
              >
                <Icon name="clipboard" size="btn" />
                Submit Another Synthetic Intake
              </Button>
              <ButtonLink href="/" variant="secondary" size="md">
                <Icon name="arrowLeft" size="btn" />
                Return to Home
              </ButtonLink>
            </div>
          </div>
        </ClinicalPanel>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5" data-testid="patient-intake-flow">
      {/* 1. Prominent Emergency Human-Help Safety Banner */}
      <Alert
        tone="danger"
        title="Need immediate medical help? Speak to clinic staff right now"
      >
        If you have severe chest pain, difficulty breathing, heavy bleeding,
        sudden weakness, or feel faint,{" "}
        <strong>
          do not wait to complete this form — alert the front desk or nursing
          staff in person immediately
        </strong>
        . MedFlow is an intake assistant, not a doctor.
      </Alert>

      {/* Patient Introduction & Progress Bar */}
      <div className="mf-pt__bar flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag source="patient" label="Patient Self-Intake" />
          <span className="text-[13px] font-medium text-[var(--mf-text-secondary)]">
            {CANONICAL_DEMO_FACILITY.name} (
            <code className="mf-mono text-[12px] text-[var(--mf-text)]">
              {CANONICAL_DEMO_FACILITY.publicCode}
            </code>
            )
          </span>
        </div>
        <Badge tone="neutral">Synthetic demo · No real PHI</Badge>
      </div>

      <div className="min-w-0">
        <h1 className="mf-pt__title">
          Tell the clinic staff what brings you in today
        </h1>
        <p className="mf-pt__lead">
          Share your symptoms in your own words (including Nigerian English or
          Pidgin). You will review and confirm your exact statement before it is
          shared with clinical staff.
        </p>

        {/* Visual 3-Step Patient Journey Indicator */}
        <ol
          aria-label="Patient intake steps"
          className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-3"
        >
          {PATIENT_JOURNEY_STEPS.map((item) => (
            <li
              key={item.step}
              className="flex min-w-0 items-center gap-2.5 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-3.5 py-2.5"
            >
              <span className="mf-mono inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--mf-primary)] text-[12px] font-semibold text-white">
                {item.step}
              </span>
              <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Main Patient Form Surface */}
      <div className="mf-pt__form min-w-0">
        {/* Step 1: Optional Patient Information */}
        <section
          aria-labelledby="pt-step-1-heading"
          className="grid min-w-0 gap-4 border-b border-[var(--mf-border)] pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-1-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 1 · Your details (optional)
            </h2>
            <Badge tone="neutral">Synthetic identifiers only</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="mf-field">
              <label htmlFor="patient-display-name" className="mf-label">
                <span>Name or alias</span>
                <span className="mf-label__req">Optional</span>
              </label>
              <input
                id="patient-display-name"
                type="text"
                className="mf-input mf-input--lg"
                maxLength={INTAKE_LIMITS.maxDisplayNameLength}
                placeholder="e.g., Adebayo O. (Synthetic)"
                value={patientDisplayName}
                onChange={(e) => setPatientDisplayName(e.target.value)}
                data-testid="patient-name-input"
              />
            </div>

            <div className="mf-field">
              <label htmlFor="patient-age" className="mf-label">
                <span>Age in years</span>
                <span className="mf-label__req">Optional (0–120)</span>
              </label>
              <input
                id="patient-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={INTAKE_LIMITS.maxAge}
                className="mf-input mf-input--lg"
                placeholder="e.g., 34"
                value={ageText}
                onChange={(e) => setAgeText(e.target.value)}
                data-testid="patient-age-input"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Choose Input Mode & Describe Reason for Visit */}
        <section
          aria-labelledby="pt-step-2-heading"
          className="grid min-w-0 gap-4 border-b border-[var(--mf-border)] pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-2-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 2 · Reason for your visit
            </h2>
            <SourceTag
              source="patient"
              label={inputMode === "voice" ? "Voice Mode" : "Typed Mode"}
            />
          </div>

          <fieldset className="mf-seg mf-seg--lg min-w-0">
            <legend className="mf-seg__legend">
              How would you like to share your concern?
            </legend>
            <div
              className="mf-seg__opts"
              role="radiogroup"
              aria-label="Intake input mode"
            >
              <label
                className="mf-seg__opt"
                data-testid="mode-typed-btn"
                onClick={() => setInputMode("typed")}
              >
                <input
                  type="radio"
                  name="intakeInputMode"
                  value="typed"
                  checked={inputMode === "typed"}
                  onChange={() => setInputMode("typed")}
                />
                <span>
                  <Icon name="clipboard" size="btn" />
                  Type my concern
                </span>
              </label>

              <label
                className="mf-seg__opt"
                data-testid="mode-voice-btn"
                onClick={() => setInputMode("voice")}
              >
                <input
                  type="radio"
                  name="intakeInputMode"
                  value="voice"
                  checked={inputMode === "voice"}
                  onChange={() => setInputMode("voice")}
                />
                <span>
                  <Icon name="mic" size="btn" />
                  Speak my concern
                </span>
              </label>
            </div>
          </fieldset>

          {/* Optional Synthetic Presets for Quick Inspection */}
          <div className="min-w-0 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-[var(--mf-text-secondary)]">
                Load a synthetic patient example:
              </span>
              {narrative.length > 0 && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={handleClearDraft}
                >
                  Clear fields
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SYNTHETIC_EXAMPLE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="!h-auto !whitespace-normal !py-2 text-left"
                  onClick={() => handleApplySyntheticPreset(preset)}
                  data-testid={`preset-${preset.id}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {inputMode === "voice" && (
            <div
              className="grid gap-3 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4"
              data-testid="voice-intake-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--mf-text)]">
                  <Icon name="mic" size="md" />
                  Voice Capture &amp; Transcript Review
                </div>
                <Badge tone={isRecording ? "danger" : "info"}>
                  {isRecording
                    ? `Recording · ${recordingSeconds}s / ${MAX_RECORDING_SECONDS}s`
                    : isTranscribing
                      ? "Transcribing with Gemini..."
                      : "Max 90s · Audio never stored"}
                </Badge>
              </div>
              <p className="m-0 text-[13.5px] text-[var(--mf-text-secondary)]">
                Record your spoken concern (up to 90 seconds). MedFlow
                transcribes your speech on the server using Gemini and places
                the draft transcript in the box below so you can review, edit,
                and confirm it before submission.
              </p>

              {voiceError && (
                <Alert tone="warning" title="Voice capture notice">
                  {voiceError}
                </Alert>
              )}

              {voiceNotice && !voiceError && (
                <Alert tone="success" title="Transcript ready for review">
                  {voiceNotice}
                  {transcriptionModel ? ` (${transcriptionModel})` : ""}
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {!isRecording ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={isTranscribing}
                    disabled={isTranscribing}
                    onClick={() => void handleStartRecording()}
                    data-testid="start-voice-recording-btn"
                  >
                    <Icon name="mic" size="btn" />
                    {isTranscribing
                      ? "Transcribing audio..."
                      : transcriptRaw
                        ? "Record Again"
                        : "Start Voice Recording"}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleStopAndTranscribe}
                      data-testid="stop-voice-recording-btn"
                    >
                      <Icon name="check" size="btn" />
                      Stop &amp; Transcribe ({recordingSeconds}s)
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleCancelRecording}
                      data-testid="cancel-voice-recording-btn"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>

              {transcriptRaw && (
                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-3 text-[13px] text-[var(--mf-text-secondary)]">
                  <div className="mf-eyebrow mb-1">
                    Original raw voice transcript (preserved alongside your
                    confirmed edits)
                  </div>
                  <p className="m-0">{transcriptRaw}</p>
                </div>
              )}
            </div>
          )}

          <div className="mf-field">
            <label
              htmlFor="confirmed-narrative"
              className="mf-label justify-between"
            >
              <span>
                {inputMode === "voice"
                  ? "Review and edit your written transcript"
                  : "Describe your symptoms in your own words"}
              </span>
              <span className="mf-mono text-[12px] font-normal text-[var(--mf-text-muted)]">
                {trimmedNarrative.length} / {INTAKE_LIMITS.maxNarrativeLength}{" "}
                chars
              </span>
            </label>

            <div className="mf-help">
              Include when your symptoms started, how they feel, and any
              medications or allergies you want the nurse or doctor to know.
            </div>

            <textarea
              id="confirmed-narrative"
              className="mf-textarea mf-textarea--lg"
              rows={5}
              maxLength={INTAKE_LIMITS.maxNarrativeLength}
              placeholder="Example: I started feeling tightness in the center of my chest about two hours ago after climbing the stairs..."
              value={narrative}
              onChange={(e) => {
                setNarrative(e.target.value);
                setPatientConfirmed(false);
              }}
              data-testid="confirmed-narrative-textarea"
            />
          </div>
        </section>

        {/* Step 3: Review & Confirm Captured Statement */}
        <section
          aria-labelledby="pt-step-3-heading"
          className="grid gap-4"
          data-testid="patient-review-step"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-3-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 3 · Review and confirm your statement
            </h2>
            <Badge tone={patientConfirmed ? "success" : "neutral"}>
              {patientConfirmed ? "Statement confirmed" : "Review required"}
            </Badge>
          </div>

          {hasValidNarrativeLength ? (
            <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="mf-eyebrow">
                  Statement preview for clinical staff
                </span>
                <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                  {patientDisplayName.trim() || "Walk-in Patient (Anonymous)"}
                  {ageText.trim() ? ` · ${ageText.trim()}y` : ""}
                </span>
              </div>
              <blockquote className="mf-quote m-0">
                &ldquo;{trimmedNarrative}&rdquo;
              </blockquote>
            </div>
          ) : (
            <p className="m-0 text-[14px] text-[var(--mf-text-secondary)]">
              Enter at least {INTAKE_LIMITS.minNarrativeLength} characters above
              (or choose a synthetic example) to preview your confirmed
              statement.
            </p>
          )}

          <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
            <label
              htmlFor="patient-confirm-checkbox"
              className="flex cursor-pointer items-start gap-3 text-[15px] font-medium leading-[1.48] text-[var(--mf-text)]"
            >
              <input
                id="patient-confirm-checkbox"
                type="checkbox"
                checked={patientConfirmed}
                disabled={!hasValidNarrativeLength || isSubmitting}
                onChange={(e) => setPatientConfirmed(e.target.checked)}
                data-testid="patient-confirm-checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--mf-primary)]"
              />
              <span>
                I have reviewed the statement above and confirm it accurately
                reflects what I want the clinic staff to read. I understand this
                is a synthetic demonstration prototype and does not provide
                medical advice or clearance to wait.
              </span>
            </label>
          </div>

          {submitError && (
            <Alert tone="danger" title="Unable to submit intake">
              {submitError}
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mf-border)] pt-4">
            <ButtonLink href="/" variant="secondary" size="md">
              <Icon name="arrowLeft" size="btn" />
              Return to Home
            </ButtonLink>

            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={
                !hasValidNarrativeLength || !patientConfirmed || isSubmitting
              }
              onClick={() => void handleSubmitIntake()}
              data-testid="submit-intake-btn"
            >
              <Icon name="check" size="btn" />
              {isSubmitting
                ? "Saving & Structuring Intake..."
                : "Confirm & Submit Intake"}
            </Button>
          </div>
        </section>
      </div>

      {/* What Happens After Submission (Patient-Friendly Transparency) */}
      <ClinicalPanel
        source="patient"
        sourceLabel="What happens next"
        title="How clinic staff receive your confirmed statement"
        subtitle="Your words remain intact from check-in to clinical review."
      >
        <ol className="m-0 grid list-none gap-2.5 p-0 text-[14px] text-[var(--mf-text-secondary)]">
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              1
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Stored verbatim:
              </strong>{" "}
              Your confirmed statement is saved immutably in the facility intake
              queue and assigned a patient reference code.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              2
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Evidence-linked summary:
              </strong>{" "}
              MedFlow drafts a structured summary for the nurse or doctor where
              every extracted detail points back to your exact words.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              3
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Human clinician review:
              </strong>{" "}
              A qualified nurse or doctor reviews your statement and assigns
              operational review priority.
            </span>
          </li>
        </ol>
      </ClinicalPanel>
    </div>
  );
}
