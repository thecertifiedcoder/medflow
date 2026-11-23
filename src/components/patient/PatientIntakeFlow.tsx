"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import {
  MAX_VOICE_RECORDING_SECONDS,
  parseAndValidateAge,
  resolveSubmitTranscriptRaw,
  validateNarrativeForContinue,
  type IntakeStep,
} from "@/lib/patient/intake-flow";
import {
  type CreateIntakeResponse,
  type InputMode,
} from "@/lib/schemas/intake";
import {
  StaffApiClientError,
  submitPatientIntake,
  transcribePatientAudioRequest,
} from "@/lib/staff/api-client";
import { IntakeProgress } from "./IntakeProgress";
import { IntakeReviewStep } from "./IntakeReviewStep";
import { IntakeSuccess } from "./IntakeSuccess";
import { NarrativeStep } from "./NarrativeStep";
import { PatientDetailsStep } from "./PatientDetailsStep";

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
        reject(new Error("Unable to prepare recorded audio."));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export function PatientIntakeFlow() {
  const [step, setStep] = useState<IntakeStep>(1);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [patientDisplayName, setPatientDisplayName] = useState<string>("");
  const [ageText, setAgeText] = useState<string>("");
  const [ageError, setAgeError] = useState<string | null>(null);

  // Voice & statement state (transcriptRaw preserved internally separate from confirmed edits)
  const [transcriptRaw, setTranscriptRaw] = useState<string>("");
  const [narrative, setNarrative] = useState<string>("");
  const [showTranscriptEditor, setShowTranscriptEditor] =
    useState<boolean>(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [patientConfirmed, setPatientConfirmed] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateClientIdempotencyKey(),
  );

  // Voice recording & transcription state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

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

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  const handleGoToStep = (nextStep: IntakeStep) => {
    setStep(nextStep);
    scrollToTop();
  };

  // Step 1 actions
  const handleStep1Continue = () => {
    const validation = parseAndValidateAge(ageText);
    if (!validation.valid) {
      setAgeError(validation.error);
      return;
    }
    setAgeError(null);
    handleGoToStep(2);
  };

  const handleStep1Skip = () => {
    const validation = parseAndValidateAge(ageText);
    if (!validation.valid) {
      setAgeText("");
    }
    setAgeError(null);
    handleGoToStep(2);
  };

  // Step 2 voice actions
  const handleStartRecording = async () => {
    setVoiceError(null);
    setNarrativeError(null);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError(
        "Microphone access isn't available right now. You can type your concern instead.",
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
            "No sound was captured. Please try speaking again or type your concern instead.",
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
          setNarrative(result.transcriptRaw);
          setShowTranscriptEditor(true);
          setPatientConfirmed(false);
          setNarrativeError(null);
        } catch (err) {
          setVoiceError(
            err instanceof StaffApiClientError
              ? err.message
              : "We couldn't turn your voice into text right now. You can try again or type your concern instead.",
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
            next >= MAX_VOICE_RECORDING_SECONDS &&
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
        "Microphone access isn't available right now. You can type your concern instead.",
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

  const handleStep2Continue = () => {
    const check = validateNarrativeForContinue(narrative);
    if (!check.valid) {
      setNarrativeError(check.error);
      return;
    }
    setNarrativeError(null);
    handleGoToStep(3);
  };

  // Submission
  const handleSubmitIntake = async () => {
    const ageCheck = parseAndValidateAge(ageText);
    if (!ageCheck.valid) {
      setAgeError(ageCheck.error);
      handleGoToStep(1);
      return;
    }

    const narrativeCheck = validateNarrativeForContinue(narrative);
    if (!narrativeCheck.valid) {
      setNarrativeError(narrativeCheck.error);
      handleGoToStep(2);
      return;
    }

    if (!patientConfirmed || isSubmitting) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const resolvedRawTranscript = resolveSubmitTranscriptRaw({
        inputMode,
        transcriptRaw,
        narrative: narrativeCheck.trimmedNarrative,
      });

      const response = await submitPatientIntake({
        facilityPublicCode: CANONICAL_DEMO_FACILITY.publicCode,
        ...(patientDisplayName.trim().length > 0
          ? { patientDisplayName: patientDisplayName.trim() }
          : {}),
        ...(ageCheck.age !== undefined ? { age: ageCheck.age } : {}),
        inputMode,
        ...(resolvedRawTranscript ? { transcriptRaw: resolvedRawTranscript } : {}),
        confirmedNarrative: narrativeCheck.trimmedNarrative,
        idempotencyKey,
      });

      setSubmittedReceipt(response);
      scrollToTop();
    } catch (err) {
      setSubmitError(
        err instanceof StaffApiClientError
          ? err.message
          : "Unable to save your intake right now. Your words are still here — please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartAnotherIntake = () => {
    stopMediaResources();
    setStep(1);
    setInputMode("voice");
    setPatientDisplayName("");
    setAgeText("");
    setAgeError(null);
    setTranscriptRaw("");
    setNarrative("");
    setShowTranscriptEditor(false);
    setNarrativeError(null);
    setPatientConfirmed(false);
    setVoiceError(null);
    setSubmitError(null);
    setSubmittedReceipt(null);
    setIdempotencyKey(generateClientIdempotencyKey());
    scrollToTop();
  };

  if (submittedReceipt) {
    return (
      <div className="grid min-w-0 gap-5">
        <IntakeSuccess
          receipt={submittedReceipt}
          patientDisplayName={patientDisplayName}
          ageText={ageText}
          trimmedNarrative={narrative.trim()}
          onStartAnother={handleStartAnotherIntake}
        />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5" data-testid="patient-intake-flow">
      {/* Compact Urgent-Help Banner */}
      <aside
        role="alert"
        data-testid="intake-safety-banner"
        className="flex items-start gap-2.5 rounded-[8px] border border-[var(--mf-danger)]/40 border-l-4 border-l-[var(--mf-danger)] bg-[var(--mf-danger-tint)] px-3.5 py-2.5 text-[13px] leading-[1.42] text-[var(--mf-text)]"
      >
        <Icon
          name="alert"
          size="sm"
          className="mt-0.5 shrink-0 text-[var(--mf-danger-dark)]"
        />
        <p className="m-0">
          <strong className="font-semibold text-[var(--mf-danger-dark)]">
            Need urgent medical help?
          </strong>{" "}
          Do not wait to complete this form—alert clinic staff immediately if you experience{" "}
          <span className="font-semibold text-[var(--mf-danger-dark)]">
            severe chest pain, difficulty breathing, heavy bleeding, sudden weakness, or feeling faint
          </span>
          .
        </p>
      </aside>

      {/* Compact 3-Step Progress Header */}
      <IntakeProgress
        currentStep={step}
        onBack={
          step > 1
            ? () => handleGoToStep(step === 3 ? 2 : 1)
            : undefined
        }
      />

      {/* Single Active Step */}
      {step === 1 ? (
        <PatientDetailsStep
          patientDisplayName={patientDisplayName}
          onNameChange={setPatientDisplayName}
          ageText={ageText}
          onAgeChange={(val) => {
            setAgeText(val);
            if (ageError) setAgeError(null);
          }}
          ageError={ageError}
          onContinue={handleStep1Continue}
          onSkip={handleStep1Skip}
        />
      ) : null}

      {step === 2 ? (
        <NarrativeStep
          inputMode={inputMode}
          onModeChange={(nextMode) => {
            setInputMode(nextMode);
            setVoiceError(null);
            setNarrativeError(null);
            if (
              nextMode === "voice" &&
              transcriptRaw.trim().length > 0 &&
              narrative.trim().length > 0
            ) {
              setShowTranscriptEditor(true);
            }
          }}
          narrative={narrative}
          onNarrativeChange={(val) => {
            setNarrative(val);
            setPatientConfirmed(false);
            if (narrativeError) setNarrativeError(null);
          }}
          showTranscriptEditor={showTranscriptEditor}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          recordingSeconds={recordingSeconds}
          voiceError={voiceError}
          narrativeError={narrativeError}
          onStartRecording={() => void handleStartRecording()}
          onStopAndTranscribe={handleStopAndTranscribe}
          onCancelRecording={handleCancelRecording}
          onRecordAgain={() => {
            setShowTranscriptEditor(false);
            setVoiceError(null);
            setNarrativeError(null);
          }}
          onReturnToTranscriptEditor={() => setShowTranscriptEditor(true)}
          onContinue={handleStep2Continue}
        />
      ) : null}

      {step === 3 ? (
        <IntakeReviewStep
          patientDisplayName={patientDisplayName}
          ageText={ageText}
          trimmedNarrative={narrative.trim()}
          patientConfirmed={patientConfirmed}
          onConfirmChange={setPatientConfirmed}
          onEditDetails={() => handleGoToStep(1)}
          onEditStatement={() => {
            if (inputMode === "voice" && narrative.trim().length > 0) {
              setShowTranscriptEditor(true);
            }
            handleGoToStep(2);
          }}
          onBack={() => handleGoToStep(2)}
          onSubmit={() => void handleSubmitIntake()}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : null}

      <p className="m-0 pb-2 text-center text-[12px] text-[var(--mf-text-secondary)]">
        Synthetic hackathon demonstration · Do not enter real patient details
      </p>
    </div>
  );
}
