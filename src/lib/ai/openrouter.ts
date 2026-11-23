import { assertServerRuntime, getOpenRouterApiKey } from "@/lib/env/server";
import type { InputMode } from "@/lib/schemas/intake";

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions" as const;

export const OPENROUTER_FREE_ROUTER_MODEL = "openrouter/free" as const;

export const DEFAULT_OPENROUTER_TIMEOUT_MS = 14_000;

export const OPENROUTER_CLINICAL_BRIEF_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: "string",
      enum: ["1.0"],
      description: 'Must be "1.0".',
    },
    languageDetected: {
      type: ["string", "null"],
      description:
        'Language detected in the patient narrative, e.g. "en" or "en-NG".',
    },
    chiefConcern: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: {
          type: "string",
          description:
            "Concise non-diagnostic summary of the patient's primary reported concern (max 300 chars).",
        },
        sourceQuote: {
          type: ["string", "null"],
          description:
            "Exact verbatim substring copied directly from the patient's confirmed narrative, or null if unclear.",
        },
        certainty: {
          type: "string",
          enum: ["explicit", "unclear"],
        },
      },
      required: ["value", "certainty"],
    },
    symptoms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string" },
          sourceQuote: { type: ["string", "null"] },
          certainty: {
            type: "string",
            enum: ["explicit", "unclear"],
          },
          duration: { type: ["string", "null"] },
          severity: { type: ["string", "null"] },
        },
        required: ["value", "certainty"],
      },
    },
    relevantContext: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string" },
          sourceQuote: { type: ["string", "null"] },
          certainty: {
            type: "string",
            enum: ["explicit", "unclear"],
          },
        },
        required: ["value", "certainty"],
      },
    },
    reportedDetailsToReview: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          detail: { type: "string" },
          sourceQuote: { type: "string" },
          context: { type: "string" },
        },
        required: ["detail", "sourceQuote", "context"],
      },
    },
    missingOrUnclear: {
      type: "array",
      items: { type: "string" },
    },
    clinicianSummary: {
      type: "string",
      description:
        "Neutral, non-diagnostic factual summary of what the patient stated and what remains unstated (max 1200 chars).",
    },
    limitations: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
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
} as const;

export interface OpenRouterRawCompletionResult {
  readonly ok: true;
  readonly rawText: string;
  readonly returnedModel: string;
  readonly persistedModelId: string;
  readonly attempt: number;
  readonly durationMs: number;
}

export interface OpenRouterCompletionFailure {
  readonly ok: false;
  readonly errorCode:
    | "OPENROUTER_API_KEY_MISSING"
    | "OPENROUTER_UPSTREAM_UNAVAILABLE"
    | "OPENROUTER_TIMEOUT"
    | "OPENROUTER_AUTH_ERROR"
    | "OPENROUTER_EMPTY_RESPONSE"
    | "OPENROUTER_REQUEST_ERROR";
  readonly persistedModelId: string;
  readonly attempt: number;
  readonly durationMs: number;
  readonly httpStatus: number | null;
}

export type OpenRouterCallOutcome =
  | OpenRouterRawCompletionResult
  | OpenRouterCompletionFailure;

/**
 * Formats the persisted `ai_model_id` value (max 80 chars for existing
 * `patient_intakes.ai_model_id` varchar(80) column) so operators can see both
 * the OpenRouter provider and the actual free model returned by the router.
 */
export function formatOpenRouterModelId(returnedModel: string | null | undefined): string {
  const trimmed = returnedModel?.trim() ?? "";
  if (!trimmed || trimmed === OPENROUTER_FREE_ROUTER_MODEL) {
    return OPENROUTER_FREE_ROUTER_MODEL;
  }
  const prefixed = trimmed.startsWith("openrouter:")
    ? trimmed
    : `openrouter:${trimmed}`;
  return prefixed.slice(0, 80);
}

/**
 * Extracts plain text content from an OpenAI/OpenRouter chat completion JSON
 * payload, supporting both string content and structured content part arrays.
 */
export function extractOpenRouterMessageText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return null;

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
    return joined.length > 0 ? joined : null;
  }

  return null;
}

/**
 * Calls OpenRouter's OpenAI-compatible chat completions endpoint using the
 * dynamic free-model router (`openrouter/free`).
 *
 * Strategy:
 * - Attempt 1: strict JSON Schema (`response_format.type = "json_schema"`) with
 *   `provider.require_parameters = true`.
 * - Attempt 2 (only if Attempt 1 returns HTTP 400/404/422 indicating no active
 *   free route supports strict json_schema parameters): JSON object mode
 *   (`response_format.type = "json_object"`) with explicit JSON contract rules.
 * - Never sends audio, never logs prompts/narratives/keys, and uses bounded
 *   request timeouts so serverless functions never hang.
 */
export async function requestOpenRouterClinicalBriefCompletion(params: {
  readonly systemInstruction: string;
  readonly userPrompt: string;
  readonly inputMode: InputMode;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly requestId?: string;
}): Promise<OpenRouterCallOutcome> {
  assertServerRuntime();
  const startedAt = Date.now();
  const env = params.env ?? process.env;
  const apiKey = getOpenRouterApiKey(env);

  if (!apiKey) {
    return {
      ok: false,
      errorCode: "OPENROUTER_API_KEY_MISSING",
      persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
      attempt: 0,
      durationMs: Date.now() - startedAt,
      httpStatus: null,
    };
  }

  const fetchFn = params.fetchImpl ?? fetch;
  const timeoutMs = params.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;

  const jsonContractReminder = [
    params.systemInstruction,
    "",
    "OUTPUT FORMAT CONTRACT (CRITICAL):",
    "Return ONLY one valid JSON object matching this exact top-level shape with NO extra keys and NO markdown commentary:",
    '{"schemaVersion":"1.0","languageDetected":"en","chiefConcern":{"value":"...","sourceQuote":"...","certainty":"explicit|unclear"},"symptoms":[{"value":"...","sourceQuote":"...","certainty":"explicit|unclear","duration":null,"severity":null}],"relevantContext":[{"value":"...","sourceQuote":"...","certainty":"explicit|unclear"}],"reportedDetailsToReview":[{"detail":"...","sourceQuote":"...","context":"..."}],"missingOrUnclear":["..."],"clinicianSummary":"...","limitations":["..."]}',
    "NEVER include diagnosis, priority, triageColor, urgencyScore, treatment, prescription, or safeToWait fields.",
  ].join("\n");

  const modes: ReadonlyArray<{
    readonly attempt: number;
    readonly useJsonSchema: boolean;
  }> = [
    { attempt: 1, useJsonSchema: true },
    { attempt: 2, useJsonSchema: false },
  ];

  let lastFailure: OpenRouterCompletionFailure = {
    ok: false,
    errorCode: "OPENROUTER_REQUEST_ERROR",
    persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
    attempt: 1,
    durationMs: 0,
    httpStatus: null,
  };

  for (const mode of modes) {
    const attemptStart = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Title": "MedFlow Synthetic Clinical Intake Prototype",
      };

      const bodyPayload: Record<string, unknown> = {
        model: OPENROUTER_FREE_ROUTER_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: mode.useJsonSchema
              ? params.systemInstruction
              : jsonContractReminder,
          },
          {
            role: "user",
            content: params.userPrompt,
          },
        ],
        response_format: mode.useJsonSchema
          ? {
              type: "json_schema",
              json_schema: {
                name: "medflow_clinical_intake_brief",
                strict: true,
                schema: OPENROUTER_CLINICAL_BRIEF_JSON_SCHEMA,
              },
            }
          : { type: "json_object" },
      };

      if (mode.useJsonSchema) {
        bodyPayload.provider = { require_parameters: true };
      }

      const response = await fetchFn(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      const elapsed = Date.now() - attemptStart;

      if (!response.ok) {
        const status = response.status;
        // Consume body safely without ever logging provider internals or echoed text
        await response.text().catch(() => "");

        if (status === 401 || status === 403) {
          return {
            ok: false,
            errorCode: "OPENROUTER_AUTH_ERROR",
            persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
            attempt: mode.attempt,
            durationMs: Date.now() - startedAt,
            httpStatus: status,
          };
        }

        const isSchemaRouteUnsupported =
          mode.useJsonSchema &&
          (status === 400 || status === 404 || status === 422);

        if (isSchemaRouteUnsupported) {
          lastFailure = {
            ok: false,
            errorCode: "OPENROUTER_REQUEST_ERROR",
            persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
            attempt: mode.attempt,
            durationMs: elapsed,
            httpStatus: status,
          };
          continue;
        }

        const isTransient =
          status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

        return {
          ok: false,
          errorCode: isTransient
            ? "OPENROUTER_UPSTREAM_UNAVAILABLE"
            : "OPENROUTER_REQUEST_ERROR",
          persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
          attempt: mode.attempt,
          durationMs: Date.now() - startedAt,
          httpStatus: status,
        };
      }

      const jsonPayload: unknown = await response.json().catch(() => null);
      const returnedModel =
        jsonPayload &&
        typeof jsonPayload === "object" &&
        typeof (jsonPayload as { model?: unknown }).model === "string" &&
        (jsonPayload as { model: string }).model.trim().length > 0
          ? (jsonPayload as { model: string }).model.trim()
          : OPENROUTER_FREE_ROUTER_MODEL;

      const rawText = extractOpenRouterMessageText(jsonPayload);
      if (!rawText) {
        lastFailure = {
          ok: false,
          errorCode: "OPENROUTER_EMPTY_RESPONSE",
          persistedModelId: formatOpenRouterModelId(returnedModel),
          attempt: mode.attempt,
          durationMs: Date.now() - startedAt,
          httpStatus: response.status,
        };
        if (mode.useJsonSchema) {
          continue;
        }
        return lastFailure;
      }

      return {
        ok: true,
        rawText,
        returnedModel,
        persistedModelId: formatOpenRouterModelId(returnedModel),
        attempt: mode.attempt,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError");

      return {
        ok: false,
        errorCode: isAbort
          ? "OPENROUTER_TIMEOUT"
          : "OPENROUTER_UPSTREAM_UNAVAILABLE",
        persistedModelId: OPENROUTER_FREE_ROUTER_MODEL,
        attempt: mode.attempt,
        durationMs: Date.now() - startedAt,
        httpStatus: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ...lastFailure,
    durationMs: Date.now() - startedAt,
  };
}
