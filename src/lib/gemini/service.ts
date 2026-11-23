import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import {
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_FREE_ROUTER_MODEL,
  requestOpenRouterClinicalBriefCompletion,
} from "@/lib/ai/openrouter";
import {
  assertServerRuntime,
  getOpenRouterApiKey,
  getServerConfig,
} from "@/lib/env/server";
import {
  ClinicalIntakeBriefSchema,
  type AiStatus,
  type ClinicalIntakeBrief,
  type InputMode,
} from "@/lib/schemas/intake";

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
]);

export const CLINICAL_BRIEF_SCHEMA_VERSION = "1.0" as const;
export const DEFAULT_GEMINI_EXTRACTION_TIMEOUT_MS = 12_000;
export const DEFAULT_GEMINI_TRANSCRIBE_TIMEOUT_MS = 20_000;

export type ExtractionProviderName = "gemini" | "openrouter";

export interface QuoteGroundingResult {
  readonly brief: ClinicalIntakeBrief;
  readonly hasGroundedClaims: boolean;
  readonly ungroundedCount: number;
}

export interface GeminiExtractionOutcome {
  readonly aiStatus: AiStatus;
  readonly aiModelId: string;
  readonly aiSchemaVersion: string;
  readonly aiBrief: ClinicalIntakeBrief | null;
  readonly aiErrorCode: string | null;
  readonly provider?: ExtractionProviderName;
}

export interface GeminiTranscriptionOutcome {
  readonly transcriptRaw: string;
  readonly transcriptionModel: string;
  readonly languageDetected: string;
}

export type GeminiTextGenerateFn = (params: {
  readonly model: string;
  readonly prompt: string;
  readonly systemInstruction: string;
  readonly responseSchema: Schema;
  readonly thinkingLevel?: ThinkingLevel;
  readonly timeoutMs: number;
}) => Promise<string | undefined>;

function logProviderEvent(payload: {
  readonly event: string;
  readonly provider: ExtractionProviderName;
  readonly modelId: string;
  readonly outcome: "succeeded" | "needs_human_clarification" | "failed" | "fallback";
  readonly errorCategory: string | null;
  readonly durationMs: number;
  readonly attempt: number;
  readonly requestId?: string;
}): void {
  // Never log patient narrative, transcript, prompts, or credentials.
  const line = JSON.stringify({
    level: payload.outcome === "failed" ? "warn" : "info",
    scope: "medflow.ai.extraction",
    ...payload,
  });
  if (payload.outcome === "failed") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Deterministically verifies that every sourceQuote in a structured brief is
 * an exact substring of the patient's confirmedNarrative.
 *
 * - If a quote is an exact substring of confirmedNarrative, it is kept intact.
 * - If a quote is NOT an exact substring, sourceQuote is removed and the item's
 *   certainty is demoted to "unclear" (or ungrounded reportedDetailsToReview items
 *   are removed so unverified claims are never displayed as grounded evidence).
 */
export function groundBriefQuotesAgainstNarrative(
  rawBrief: ClinicalIntakeBrief,
  confirmedNarrative: string,
): QuoteGroundingResult {
  const narrative = confirmedNarrative;
  let ungroundedCount = 0;
  let groundedCount = 0;

  const isExactSubstring = (quote: string | undefined): quote is string => {
    if (!quote) return false;
    const trimmed = quote.trim();
    if (trimmed.length === 0) return false;
    return narrative.includes(trimmed);
  };

  let chiefConcern = { ...rawBrief.chiefConcern };
  if (chiefConcern.sourceQuote !== undefined) {
    if (isExactSubstring(chiefConcern.sourceQuote)) {
      chiefConcern = {
        ...chiefConcern,
        sourceQuote: chiefConcern.sourceQuote.trim(),
      };
      groundedCount += 1;
    } else {
      ungroundedCount += 1;
      chiefConcern = {
        value: chiefConcern.value,
        certainty: "unclear",
      };
    }
  }

  const symptoms = rawBrief.symptoms.map((item) => {
    if (item.sourceQuote !== undefined) {
      if (isExactSubstring(item.sourceQuote)) {
        groundedCount += 1;
        return {
          ...item,
          sourceQuote: item.sourceQuote.trim(),
        };
      }
      ungroundedCount += 1;
      return {
        value: item.value,
        certainty: "unclear" as const,
        ...(item.duration !== undefined ? { duration: item.duration } : {}),
        ...(item.severity !== undefined ? { severity: item.severity } : {}),
      };
    }
    return item;
  });

  const relevantContext = rawBrief.relevantContext.map((item) => {
    if (item.sourceQuote !== undefined) {
      if (isExactSubstring(item.sourceQuote)) {
        groundedCount += 1;
        return {
          ...item,
          sourceQuote: item.sourceQuote.trim(),
        };
      }
      ungroundedCount += 1;
      return {
        value: item.value,
        certainty: "unclear" as const,
      };
    }
    return item;
  });

  const reportedDetailsToReview = rawBrief.reportedDetailsToReview
    .filter((item) => {
      if (isExactSubstring(item.sourceQuote)) {
        groundedCount += 1;
        return true;
      }
      ungroundedCount += 1;
      return false;
    })
    .map((item) => ({
      ...item,
      sourceQuote: item.sourceQuote.trim(),
    }));

  const normalizedBrief: ClinicalIntakeBrief = ClinicalIntakeBriefSchema.parse({
    schemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
    ...(rawBrief.languageDetected
      ? { languageDetected: rawBrief.languageDetected }
      : {}),
    chiefConcern,
    symptoms,
    relevantContext,
    reportedDetailsToReview,
    missingOrUnclear: rawBrief.missingOrUnclear,
    clinicianSummary: rawBrief.clinicianSummary,
    limitations:
      rawBrief.limitations.length > 0
        ? rawBrief.limitations
        : [
            "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
          ],
  });

  return {
    brief: normalizedBrief,
    hasGroundedClaims: groundedCount > 0,
    ungroundedCount,
  };
}

/**
 * Strips optional Markdown JSON code fences (e.g. ```json ... ```) without
 * guessing or fabricating missing JSON structure.
 */
export function stripMarkdownJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced && fenced[1] ? fenced[1].trim() : trimmed;
}

/**
 * Normalizes explicit null/empty values ONLY on known optional fields
 * (`languageDetected`, `sourceQuote`, `duration`, `severity`) without ever
 * removing unknown or forbidden keys — so strict Zod validation still rejects
 * `diagnosis`, `priority`, `triageColor`, `urgencyScore`, `treatment`,
 * `prescription`, `safeToWait`, or any unexpected field.
 */
function normalizeNullableOptionalSlots(
  rawObj: Record<string, unknown>,
): Record<string, unknown> {
  const normalizeEvidenceItem = (item: unknown): unknown => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const copy = { ...(item as Record<string, unknown>) };
    if (
      copy.sourceQuote === null ||
      (typeof copy.sourceQuote === "string" && copy.sourceQuote.trim() === "")
    ) {
      delete copy.sourceQuote;
    }
    return copy;
  };

  const normalizeSymptomItem = (item: unknown): unknown => {
    const base = normalizeEvidenceItem(item);
    if (!base || typeof base !== "object" || Array.isArray(base)) return base;
    const copy = { ...(base as Record<string, unknown>) };
    if (typeof copy.duration === "string" && copy.duration.trim() === "") {
      copy.duration = null;
    }
    if (typeof copy.severity === "string" && copy.severity.trim() === "") {
      copy.severity = null;
    }
    return copy;
  };

  const normalized: Record<string, unknown> = { ...rawObj };

  if (
    normalized.languageDetected === null ||
    (typeof normalized.languageDetected === "string" &&
      normalized.languageDetected.trim() === "")
  ) {
    delete normalized.languageDetected;
  }

  if (normalized.chiefConcern !== undefined) {
    normalized.chiefConcern = normalizeEvidenceItem(normalized.chiefConcern);
  }

  if (Array.isArray(normalized.symptoms)) {
    normalized.symptoms = normalized.symptoms.map(normalizeSymptomItem);
  }

  if (Array.isArray(normalized.relevantContext)) {
    normalized.relevantContext = normalized.relevantContext.map(
      normalizeEvidenceItem,
    );
  }

  normalized.schemaVersion = CLINICAL_BRIEF_SCHEMA_VERSION;
  normalized.limitations =
    Array.isArray(normalized.limitations) && normalized.limitations.length > 0
      ? normalized.limitations
      : [
          "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
        ];

  return normalized;
}

/**
 * Shared post-processing pipeline executed identically for BOTH Gemini and
 * OpenRouter outputs:
 * 1. Strict JSON parsing.
 * 2. Strict Zod schema validation (`ClinicalIntakeBriefSchema`).
 * 3. Deterministic Evidence Integrity Engine quote grounding
 *    (`groundBriefQuotesAgainstNarrative`).
 */
export function parseValidateAndGroundBriefText(
  rawText: string,
  confirmedNarrative: string,
  providerPrefix: "GEMINI" | "OPENROUTER",
):
  | {
      readonly ok: true;
      readonly aiStatus: "succeeded" | "needs_human_clarification";
      readonly brief: ClinicalIntakeBrief;
      readonly ungroundedCount: number;
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
    } {
  const cleanedText = stripMarkdownJsonFences(rawText);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch {
    return { ok: false, errorCode: `${providerPrefix}_INVALID_JSON` };
  }

  if (
    !parsedJson ||
    typeof parsedJson !== "object" ||
    Array.isArray(parsedJson)
  ) {
    return {
      ok: false,
      errorCode: `${providerPrefix}_SCHEMA_VALIDATION_FAILED`,
    };
  }

  const candidate = normalizeNullableOptionalSlots(
    parsedJson as Record<string, unknown>,
  );

  const validated = ClinicalIntakeBriefSchema.safeParse(candidate);
  if (!validated.success) {
    return {
      ok: false,
      errorCode: `${providerPrefix}_SCHEMA_VALIDATION_FAILED`,
    };
  }

  const grounded = groundBriefQuotesAgainstNarrative(
    validated.data,
    confirmedNarrative,
  );

  const needsClarification =
    grounded.brief.chiefConcern.certainty === "unclear" &&
    grounded.brief.symptoms.length === 0;

  return {
    ok: true,
    aiStatus: needsClarification ? "needs_human_clarification" : "succeeded",
    brief: grounded.brief,
    ungroundedCount: grounded.ungroundedCount,
  };
}

const GEMINI_CLINICAL_BRIEF_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: {
      type: Type.STRING,
      description: 'Must be "1.0".',
    },
    languageDetected: {
      type: Type.STRING,
      description:
        'Language detected in the patient narrative, e.g. "en" or "en-NG".',
    },
    chiefConcern: {
      type: Type.OBJECT,
      properties: {
        value: {
          type: Type.STRING,
          description:
            "Concise non-diagnostic summary of the patient's primary reported concern (max 300 chars).",
        },
        sourceQuote: {
          type: Type.STRING,
          description:
            "Exact verbatim substring copied directly from the patient's confirmed narrative.",
        },
        certainty: {
          type: Type.STRING,
          enum: ["explicit", "unclear"],
        },
      },
      required: ["value", "certainty"],
    },
    symptoms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING },
          sourceQuote: {
            type: Type.STRING,
            description:
              "Exact verbatim substring copied directly from the patient's confirmed narrative.",
          },
          certainty: {
            type: Type.STRING,
            enum: ["explicit", "unclear"],
          },
          duration: { type: Type.STRING, nullable: true },
          severity: { type: Type.STRING, nullable: true },
        },
        required: ["value", "certainty"],
      },
    },
    relevantContext: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING },
          sourceQuote: {
            type: Type.STRING,
            description:
              "Exact verbatim substring copied directly from the patient's confirmed narrative.",
          },
          certainty: {
            type: Type.STRING,
            enum: ["explicit", "unclear"],
          },
        },
        required: ["value", "certainty"],
      },
    },
    reportedDetailsToReview: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          detail: { type: Type.STRING },
          sourceQuote: {
            type: Type.STRING,
            description:
              "Exact verbatim substring copied directly from the patient's confirmed narrative.",
          },
          context: { type: Type.STRING },
        },
        required: ["detail", "sourceQuote", "context"],
      },
    },
    missingOrUnclear: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    clinicianSummary: {
      type: Type.STRING,
      description:
        "Neutral, non-diagnostic factual summary of what the patient stated and what remains unstated (max 1200 chars). Never diagnose, prescribe, or assign urgency.",
    },
    limitations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "At least one explicit limitation note reminding staff that this draft is non-diagnostic and requires human verification.",
    },
  },
  required: [
    "schemaVersion",
    "chiefConcern",
    "symptoms",
    "relevantContext",
    "reportedDetailsToReview",
    "missingOrUnclear",
    "clinicianSummary",
    "limitations",
  ],
};

export const EXTRACTION_SYSTEM_INSTRUCTION = `You are the MedFlow Clinical Intake Structuring Assistant.
STRICT SAFETY & PROVENANCE RULES:
1. You are NOT a doctor. Never diagnose diseases, never suggest treatments or medications, never assign triage urgency, never assign staff priority, and never state that a patient is safe to wait or medically cleared.
2. Only organize facts explicitly reported in the patient's confirmed narrative.
3. Support Nigerian English and Nigerian Pidgin expressions (for example: "my body dey hot", "belle dey turn me", "chest dey tight me") while preserving the exact original words in every sourceQuote.
4. Every "sourceQuote" MUST be an exact, character-for-character verbatim substring copied from the patient's confirmed narrative. Do not paraphrase or alter punctuation inside sourceQuote.
5. Explicitly list missing or unclear details (such as unstated duration, severity, medications, or allergies) in "missingOrUnclear".
6. Always include at least one clear statement in "limitations" explaining that the AI draft is non-authoritative and requires clinical staff verification.
7. If the patient narrative is too vague to identify any specific symptom (e.g. "I just don't feel right today, please let me talk to someone"), set chiefConcern.certainty to "unclear", leave symptoms empty, and list the needed clarifications in "missingOrUnclear".`;

function classifyGeminiError(err: unknown): {
  readonly code: string;
  readonly isAuthError: boolean;
} {
  const errName = err instanceof Error ? err.name : "";
  const errMsg = err instanceof Error ? err.message : "Unknown error";

  if (errName === "TimeoutError" || /timeout|aborted/i.test(errMsg)) {
    return { code: "GEMINI_TIMEOUT", isAuthError: false };
  }
  if (/API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(errMsg)) {
    return { code: "GEMINI_AUTH_ERROR", isAuthError: true };
  }
  if (/503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(errMsg)) {
    return { code: "GEMINI_UPSTREAM_UNAVAILABLE", isAuthError: false };
  }
  if (/404|NOT_FOUND/i.test(errMsg)) {
    return { code: "GEMINI_MODEL_UNAVAILABLE", isAuthError: false };
  }
  if (/JSON/i.test(errMsg)) {
    return { code: "GEMINI_INVALID_JSON", isAuthError: false };
  }
  return { code: "GEMINI_EXTRACTION_ERROR", isAuthError: false };
}

function createDefaultGeminiGenerator(apiKey: string): GeminiTextGenerateFn {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  return async (params) => {
    const response = await withTimeout(
      ai.models.generateContent({
        model: params.model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
          ...(params.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: params.thinkingLevel } }
            : {}),
        },
      }),
      params.timeoutMs,
      `Gemini model ${params.model} timed out after ${params.timeoutMs}ms`,
    );

    return response.text;
  };
}

/**
 * Extracts a structured, evidence-grounded ClinicalIntakeBrief using the
 * approved provider chain:
 *   1. Primary Gemini extraction (`gemini-4-hydrogen`, ThinkingLevel.LOW)
 *   2. Gemini fallback (`gemini-3.1-flash-lite`)
 *   3. Automatic OpenRouter free-model router fallback (`openrouter/free`)
 *   4. Safe failure (`aiStatus: "failed"`, `aiBrief: null`) while preserving intake
 *
 * Every provider output enters the exact same strict Zod + Evidence Integrity
 * Engine (`groundBriefQuotesAgainstNarrative`) post-processing pipeline.
 */
export async function extractClinicalIntakeBrief(params: {
  confirmedNarrative: string;
  inputMode: InputMode;
  age?: number | null;
  env?: Record<string, string | undefined>;
  requestId?: string;
  timeoutMs?: number;
  geminiGenerateFn?: GeminiTextGenerateFn;
  openRouterFetchImpl?: typeof fetch;
}): Promise<GeminiExtractionOutcome> {
  assertServerRuntime();
  const env = params.env ?? process.env;
  const config = getServerConfig(env);
  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  const openRouterApiKey = getOpenRouterApiKey(env);

  const prompt = [
    `Input Mode: ${params.inputMode}`,
    params.age !== undefined && params.age !== null
      ? `Patient Reported Age: ${params.age}`
      : "Patient Reported Age: Not provided",
    "Patient Confirmed Narrative (copy sourceQuote substrings verbatim from between the markers):",
    "---BEGIN_CONFIRMED_NARRATIVE---",
    params.confirmedNarrative,
    "---END_CONFIRMED_NARRATIVE---",
  ].join("\n");

  let lastErrorCode = "GEMINI_API_KEY_MISSING";
  let lastModelId = config.geminiExtractionModel;
  const geminiTimeoutMs =
    params.timeoutMs ?? DEFAULT_GEMINI_EXTRACTION_TIMEOUT_MS;

  // Step 1 & 2: Primary Gemini + Gemini Fallback
  if (geminiApiKey || params.geminiGenerateFn) {
    const candidateModels = Array.from(
      new Set([config.geminiExtractionModel, "gemini-3.1-flash-lite"]),
    );
    const generateFn =
      params.geminiGenerateFn ?? createDefaultGeminiGenerator(geminiApiKey!);

    for (let idx = 0; idx < candidateModels.length; idx += 1) {
      const modelId = candidateModels[idx]!;
      const attempt = idx + 1;
      const attemptStart = Date.now();
      lastModelId = modelId;

      try {
        const useLowThinking =
          modelId === "gemini-4-hydrogen" || modelId === "gemini-4-neon";

        const rawText = (
          await generateFn({
            model: modelId,
            prompt,
            systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
            responseSchema: GEMINI_CLINICAL_BRIEF_RESPONSE_SCHEMA,
            thinkingLevel: useLowThinking ? ThinkingLevel.LOW : undefined,
            timeoutMs: geminiTimeoutMs,
          })
        )?.trim();

        const durationMs = Date.now() - attemptStart;

        if (!rawText) {
          lastErrorCode = "GEMINI_EMPTY_RESPONSE";
          logProviderEvent({
            event: "gemini_attempt_failed",
            provider: "gemini",
            modelId,
            outcome: "failed",
            errorCategory: lastErrorCode,
            durationMs,
            attempt,
            requestId: params.requestId,
          });
          continue;
        }

        const processed = parseValidateAndGroundBriefText(
          rawText,
          params.confirmedNarrative,
          "GEMINI",
        );

        if (!processed.ok) {
          lastErrorCode = processed.errorCode;
          logProviderEvent({
            event: "gemini_validation_failed",
            provider: "gemini",
            modelId,
            outcome: "failed",
            errorCategory: processed.errorCode,
            durationMs,
            attempt,
            requestId: params.requestId,
          });
          continue;
        }

        logProviderEvent({
          event: "extraction_succeeded",
          provider: "gemini",
          modelId,
          outcome: processed.aiStatus,
          errorCategory: null,
          durationMs,
          attempt,
          requestId: params.requestId,
        });

        return {
          aiStatus: processed.aiStatus,
          aiModelId: modelId,
          aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
          aiBrief: processed.brief,
          aiErrorCode: null,
          provider: "gemini",
        };
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastErrorCode = classified.code;

        logProviderEvent({
          event: "gemini_attempt_error",
          provider: "gemini",
          modelId,
          outcome: "failed",
          errorCategory: classified.code,
          durationMs: Date.now() - attemptStart,
          attempt,
          requestId: params.requestId,
        });

        if (classified.isAuthError) {
          break;
        }
      }
    }
  }

  // Step 3: Automatic OpenRouter Free-Model Fallback (Text extraction only)
  if (openRouterApiKey) {
    logProviderEvent({
      event: "fallback_to_openrouter",
      provider: "openrouter",
      modelId: OPENROUTER_FREE_ROUTER_MODEL,
      outcome: "fallback",
      errorCategory: lastErrorCode,
      durationMs: 0,
      attempt: 1,
      requestId: params.requestId,
    });

    const orTimeoutMs = params.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
    const orResult = await requestOpenRouterClinicalBriefCompletion({
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      userPrompt: prompt,
      inputMode: params.inputMode,
      env,
      fetchImpl: params.openRouterFetchImpl,
      timeoutMs: orTimeoutMs,
      requestId: params.requestId,
    });

    if (orResult.ok) {
      const processed = parseValidateAndGroundBriefText(
        orResult.rawText,
        params.confirmedNarrative,
        "OPENROUTER",
      );

      if (processed.ok) {
        logProviderEvent({
          event: "extraction_succeeded",
          provider: "openrouter",
          modelId: orResult.persistedModelId,
          outcome: processed.aiStatus,
          errorCategory: null,
          durationMs: orResult.durationMs,
          attempt: orResult.attempt,
          requestId: params.requestId,
        });

        return {
          aiStatus: processed.aiStatus,
          aiModelId: orResult.persistedModelId,
          aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
          aiBrief: processed.brief,
          aiErrorCode: null,
          provider: "openrouter",
        };
      }

      logProviderEvent({
        event: "openrouter_validation_failed",
        provider: "openrouter",
        modelId: orResult.persistedModelId,
        outcome: "failed",
        errorCategory: processed.errorCode,
        durationMs: orResult.durationMs,
        attempt: orResult.attempt,
        requestId: params.requestId,
      });

      return {
        aiStatus: "failed",
        aiModelId: orResult.persistedModelId,
        aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
        aiBrief: null,
        aiErrorCode: processed.errorCode,
        provider: "openrouter",
      };
    }

    logProviderEvent({
      event: "openrouter_attempt_failed",
      provider: "openrouter",
      modelId: orResult.persistedModelId,
      outcome: "failed",
      errorCategory: orResult.errorCode,
      durationMs: orResult.durationMs,
      attempt: orResult.attempt,
      requestId: params.requestId,
    });

    return {
      aiStatus: "failed",
      aiModelId: orResult.persistedModelId,
      aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
      aiBrief: null,
      aiErrorCode: orResult.errorCode,
      provider: "openrouter",
    };
  }

  // Step 4: Safe failure when Gemini failed (or unconfigured) and OpenRouter key is absent
  return {
    aiStatus: "failed",
    aiModelId: lastModelId,
    aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
    aiBrief: null,
    aiErrorCode: lastErrorCode,
    provider: "gemini",
  };
}

export function normalizeAudioMimeType(rawMimeType: string): string {
  const baseMime = rawMimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (baseMime === "audio/mp3") return "audio/mpeg";
  if (baseMime === "audio/x-wav") return "audio/wav";
  return baseMime;
}

export function isSupportedAudioMimeType(rawMimeType: string): boolean {
  const baseMime = rawMimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_AUDIO_MIME_TYPES.has(baseMime);
}

/**
 * Voice transcription remains strictly Gemini-only (`POST /api/intakes/transcribe`).
 * Audio recordings are never sent to OpenRouter.
 */
export async function transcribePatientAudio(params: {
  audioBase64: string;
  mimeType: string;
  env?: Record<string, string | undefined>;
}): Promise<GeminiTranscriptionOutcome> {
  assertServerRuntime();
  const env = params.env ?? process.env;
  const config = getServerConfig(env);
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  if (!isSupportedAudioMimeType(params.mimeType)) {
    throw new Error(
      `Unsupported audio MIME type "${params.mimeType}". Use WebM, MP4, WAV, MP3, OGG, or AAC.`,
    );
  }

  const cleanBase64 = params.audioBase64
    .replace(/^data:[^;]+;base64,/, "")
    .trim();
  const byteLength = Buffer.from(cleanBase64, "base64").byteLength;
  if (byteLength === 0) {
    throw new Error("Audio payload is empty.");
  }
  if (byteLength > config.maxAudioUploadBytes) {
    throw new Error(
      `Audio upload exceeds maximum allowed size (${config.maxAudioUploadBytes} bytes).`,
    );
  }

  const normalizedMimeType = normalizeAudioMimeType(params.mimeType);

  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const prompt =
    "Transcribe this patient intake audio recording accurately word-for-word. Preserve Nigerian English or Nigerian Pidgin phrases exactly as spoken. Output only the verbatim transcript text with no commentary or formatting.";

  let transcriptText = "";
  let usedModel = config.geminiTranscribeModel;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: config.geminiTranscribeModel,
        contents: [
          {
            inlineData: {
              mimeType: normalizedMimeType,
              data: cleanBase64,
            },
          },
          prompt,
        ],
      }),
      DEFAULT_GEMINI_TRANSCRIBE_TIMEOUT_MS,
      "Gemini transcription timed out.",
    );
    transcriptText = response.text?.trim() ?? "";
  } catch {
    usedModel = config.geminiExtractionModel;
    const fallbackAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    const fallbackResponse = await withTimeout(
      fallbackAi.models.generateContent({
        model: config.geminiExtractionModel,
        contents: [
          {
            inlineData: {
              mimeType: normalizedMimeType,
              data: cleanBase64,
            },
          },
          prompt,
        ],
      }),
      DEFAULT_GEMINI_TRANSCRIBE_TIMEOUT_MS,
      "Gemini fallback transcription timed out.",
    );
    transcriptText = fallbackResponse.text?.trim() ?? "";
  }

  if (!transcriptText) {
    throw new Error(
      "Could not detect clear speech in the audio recording. Please try speaking again or type your intake.",
    );
  }

  const hasPidginMarkers = /\b(dey|belle|una|wetin|abeg|pikin|wahala)\b/i.test(
    transcriptText,
  );

  return {
    transcriptRaw: transcriptText,
    transcriptionModel: usedModel,
    languageDetected: hasPidginMarkers ? "en-NG" : "en",
  };
}
