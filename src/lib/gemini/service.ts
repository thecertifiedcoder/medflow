import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  ClinicalIntakeBriefSchema,
  type AiStatus,
  type ClinicalIntakeBrief,
  type InputMode,
} from "@/lib/schemas/intake";
import { assertServerRuntime, getServerConfig } from "@/lib/env/server";

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
}

export interface GeminiTranscriptionOutcome {
  readonly transcriptRaw: string;
  readonly transcriptionModel: string;
  readonly languageDetected: string;
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

const GEMINI_CLINICAL_BRIEF_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: {
      type: Type.STRING,
      description: 'Must be "1.0".',
    },
    languageDetected: {
      type: Type.STRING,
      description: 'Language detected in the patient narrative, e.g. "en" or "en-NG".',
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

const EXTRACTION_SYSTEM_INSTRUCTION = `You are the MedFlow Clinical Intake Structuring Assistant.
STRICT SAFETY & PROVENANCE RULES:
1. You are NOT a doctor. Never diagnose diseases, never suggest treatments or medications, never assign triage urgency, and never state that a patient is safe to wait.
2. Only organize facts explicitly reported in the patient's confirmed narrative.
3. Support Nigerian English and Nigerian Pidgin expressions (for example: "my body dey hot", "belle dey turn me", "chest dey tight me") while preserving the exact original words in every sourceQuote.
4. Every "sourceQuote" MUST be an exact, character-for-character verbatim substring copied from the patient's confirmed narrative. Do not paraphrase or alter punctuation inside sourceQuote.
5. Explicitly list missing or unclear details (such as unstated duration, severity, medications, or allergies) in "missingOrUnclear".
6. Always include at least one clear statement in "limitations" explaining that the AI draft is non-authoritative and requires clinical staff verification.
7. If the patient narrative is too vague to identify any specific symptom (e.g. "I just don't feel right today, please let me talk to someone"), set chiefConcern.certainty to "unclear", leave symptoms empty, and list the needed clarifications in "missingOrUnclear".`;

export async function extractClinicalIntakeBrief(params: {
  confirmedNarrative: string;
  inputMode: InputMode;
  age?: number | null;
  env?: Record<string, string | undefined>;
}): Promise<GeminiExtractionOutcome> {
  assertServerRuntime();
  const env = params.env ?? process.env;
  const config = getServerConfig(env);
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return {
      aiStatus: "failed",
      aiModelId: config.geminiExtractionModel,
      aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
      aiBrief: null,
      aiErrorCode: "GEMINI_API_KEY_MISSING",
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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

    const response = await ai.models.generateContent({
      model: config.geminiExtractionModel,
      contents: prompt,
      config: {
        systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_CLINICAL_BRIEF_RESPONSE_SCHEMA,
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      return {
        aiStatus: "failed",
        aiModelId: config.geminiExtractionModel,
        aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
        aiBrief: null,
        aiErrorCode: "GEMINI_EMPTY_RESPONSE",
      };
    }

    const parsedJson: unknown = JSON.parse(rawText);
    const rawObj =
      typeof parsedJson === "object" && parsedJson !== null
        ? (parsedJson as Record<string, unknown>)
        : {};
    const validatedBrief = ClinicalIntakeBriefSchema.safeParse({
      ...rawObj,
      schemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
      limitations:
        Array.isArray(rawObj.limitations) && rawObj.limitations.length > 0
          ? rawObj.limitations
          : [
              "Non-authoritative AI intake draft; requires qualified clinical staff verification.",
            ],
    });

    if (!validatedBrief.success) {
      return {
        aiStatus: "failed",
        aiModelId: config.geminiExtractionModel,
        aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
        aiBrief: null,
        aiErrorCode: "GEMINI_SCHEMA_VALIDATION_FAILED",
      };
    }

    const grounded = groundBriefQuotesAgainstNarrative(
      validatedBrief.data,
      params.confirmedNarrative,
    );

    const needsClarification =
      grounded.brief.chiefConcern.certainty === "unclear" &&
      grounded.brief.symptoms.length === 0;

    return {
      aiStatus: needsClarification ? "needs_human_clarification" : "succeeded",
      aiModelId: config.geminiExtractionModel,
      aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
      aiBrief: grounded.brief,
      aiErrorCode: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const errorCode = errMsg.includes("JSON")
      ? "GEMINI_INVALID_JSON"
      : "GEMINI_EXTRACTION_ERROR";
    return {
      aiStatus: "failed",
      aiModelId: config.geminiExtractionModel,
      aiSchemaVersion: CLINICAL_BRIEF_SCHEMA_VERSION,
      aiBrief: null,
      aiErrorCode: errorCode,
    };
  }
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

  const cleanBase64 = params.audioBase64.replace(/^data:[^;]+;base64,/, "").trim();
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
    const response = await ai.models.generateContent({
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
    });
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
    const fallbackResponse = await fallbackAi.models.generateContent({
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
    });
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
