import { INTAKE_LIMITS, type InputMode } from "@/lib/schemas/intake";

export type IntakeStep = 1 | 2 | 3;

export interface IntakeStepDefinition {
  readonly step: IntakeStep;
  readonly title: string;
  readonly shortLabel: string;
}

export const INTAKE_STEP_DEFINITIONS: readonly IntakeStepDefinition[] = [
  { step: 1, title: "About You", shortLabel: "About you" },
  { step: 2, title: "Tell Us What's Happening", shortLabel: "Your concern" },
  { step: 3, title: "Review and Submit", shortLabel: "Review" },
] as const;

export const MAX_VOICE_RECORDING_SECONDS = 90;

export type AgeValidationResult =
  | { readonly valid: true; readonly age: number | undefined }
  | { readonly valid: false; readonly error: string };

/**
 * Validates optional patient age (0-120 whole years).
 * Blank or whitespace-only values are accepted as undefined so age remains optional.
 */
export function parseAndValidateAge(ageText: string): AgeValidationResult {
  const trimmed = ageText.trim();
  if (trimmed.length === 0) {
    return { valid: true, age: undefined };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      error: `Enter a whole number between 0 and ${INTAKE_LIMITS.maxAge}, or leave blank.`,
    };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > INTAKE_LIMITS.maxAge) {
    return {
      valid: false,
      error: `Age must be between 0 and ${INTAKE_LIMITS.maxAge} years.`,
    };
  }

  return { valid: true, age: parsed };
}

/**
 * Steps age up or down while keeping blank state intentional (starts at 1 when incremented from blank).
 */
export function stepAgeValue(currentText: string, delta: -1 | 1): string {
  const trimmed = currentText.trim();
  if (trimmed.length === 0) {
    return delta > 0 ? "1" : "0";
  }

  const validation = parseAndValidateAge(trimmed);
  if (!validation.valid || validation.age === undefined) {
    const fallback = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(fallback)) {
      return delta > 0 ? "1" : "0";
    }
    const clampedFallback = Math.min(
      INTAKE_LIMITS.maxAge,
      Math.max(0, fallback),
    );
    return String(clampedFallback);
  }

  const next = Math.min(
    INTAKE_LIMITS.maxAge,
    Math.max(0, validation.age + delta),
  );
  return String(next);
}

export type NarrativeValidationResult =
  | { readonly valid: true; readonly trimmedNarrative: string }
  | { readonly valid: false; readonly error: string };

export function validateNarrativeForContinue(
  narrative: string,
): NarrativeValidationResult {
  const trimmed = narrative.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: "Please describe what brings you in before continuing.",
    };
  }
  if (trimmed.length < INTAKE_LIMITS.minNarrativeLength) {
    return {
      valid: false,
      error: `Please share a few more words (at least ${INTAKE_LIMITS.minNarrativeLength} characters).`,
    };
  }
  if (trimmed.length > INTAKE_LIMITS.maxNarrativeLength) {
    return {
      valid: false,
      error: `Please keep your description under ${INTAKE_LIMITS.maxNarrativeLength} characters.`,
    };
  }
  return { valid: true, trimmedNarrative: trimmed };
}

export function formatRecordingDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface IntakePayloadDraft {
  readonly patientDisplayName: string;
  readonly ageText: string;
  readonly inputMode: InputMode;
  readonly transcriptRaw: string;
  readonly narrative: string;
}

/**
 * Resolves the effective transcriptRaw sent alongside voice submissions while preserving
 * patient edits inside confirmedNarrative.
 */
export function resolveSubmitTranscriptRaw(
  draft: Pick<IntakePayloadDraft, "inputMode" | "transcriptRaw" | "narrative">,
): string | undefined {
  if (draft.inputMode !== "voice") {
    return undefined;
  }
  const raw = draft.transcriptRaw.trim();
  if (raw.length > 0) {
    return raw;
  }
  const edited = draft.narrative.trim();
  return edited.length > 0 ? edited : undefined;
}
