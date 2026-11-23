import test from "node:test";
import assert from "node:assert/strict";
import {
  extractClinicalIntakeBrief,
  groundBriefQuotesAgainstNarrative,
  isSupportedAudioMimeType,
  normalizeAudioMimeType,
  transcribePatientAudio,
} from "./service";
import type { ClinicalIntakeBrief } from "@/lib/schemas/intake";

const NARRATIVE =
  "I have had sharp chest tightness for about two hours after walking upstairs, plus mild dizziness.";

const RAW_BRIEF: ClinicalIntakeBrief = {
  schemaVersion: "1.0",
  languageDetected: "en",
  chiefConcern: {
    value: "Sharp chest tightness",
    sourceQuote: "sharp chest tightness",
    certainty: "explicit",
  },
  symptoms: [
    {
      value: "Chest tightness after walking upstairs",
      sourceQuote: "sharp chest tightness for about two hours",
      certainty: "explicit",
      duration: "about two hours",
      severity: null,
    },
    {
      value: "Shortness of breath with radiation to left arm",
      sourceQuote: "shortness of breath radiating to my left arm",
      certainty: "explicit",
      duration: null,
      severity: null,
    },
  ],
  relevantContext: [
    {
      value: "Started after walking upstairs",
      sourceQuote: "after walking upstairs",
      certainty: "explicit",
    },
    {
      value: "History of hypertension",
      sourceQuote: "I take lisinopril every day",
      certainty: "explicit",
    },
  ],
  reportedDetailsToReview: [
    {
      detail: "Chest tightness with dizziness",
      sourceQuote: "sharp chest tightness for about two hours",
      context: "Reported directly by patient",
    },
    {
      detail: "Hallucinated detail not in text",
      sourceQuote: "I fainted twice this morning",
      context: "Unverified quote",
    },
  ],
  missingOrUnclear: ["Medication history not stated"],
  clinicianSummary:
    "Patient reports two hours of sharp chest tightness after walking upstairs with mild dizziness.",
  limitations: [
    "Non-authoritative AI draft; requires qualified clinical staff review.",
  ],
};

test("groundBriefQuotesAgainstNarrative preserves exact verbatim substrings and strips hallucinated quotes", () => {
  const { brief, hasGroundedClaims, ungroundedCount } =
    groundBriefQuotesAgainstNarrative(RAW_BRIEF, NARRATIVE);

  assert.equal(hasGroundedClaims, true);
  assert.equal(ungroundedCount, 3);

  // Verbatim chiefConcern quote is preserved
  assert.equal(brief.chiefConcern.sourceQuote, "sharp chest tightness");
  assert.equal(brief.chiefConcern.certainty, "explicit");

  // First symptom is verbatim -> preserved
  assert.equal(
    brief.symptoms[0]?.sourceQuote,
    "sharp chest tightness for about two hours",
  );
  assert.equal(brief.symptoms[0]?.certainty, "explicit");

  // Second symptom has fabricated quote -> quote removed and certainty demoted to "unclear"
  assert.equal(brief.symptoms[1]?.sourceQuote, undefined);
  assert.equal(brief.symptoms[1]?.certainty, "unclear");

  // Relevant context: first preserved, second demoted
  assert.equal(
    brief.relevantContext[0]?.sourceQuote,
    "after walking upstairs",
  );
  assert.equal(brief.relevantContext[0]?.certainty, "explicit");
  assert.equal(brief.relevantContext[1]?.sourceQuote, undefined);
  assert.equal(brief.relevantContext[1]?.certainty, "unclear");

  // reportedDetailsToReview only retains items whose sourceQuote exists verbatim
  assert.equal(brief.reportedDetailsToReview.length, 1);
  assert.equal(
    brief.reportedDetailsToReview[0]?.detail,
    "Chest tightness with dizziness",
  );

  // Baseline limitations remain intact while ungroundedCount records the 3 stripped quotes
  assert.equal(ungroundedCount, 3);
  assert.ok(
    brief.limitations.some((line: string) =>
      line.includes("requires qualified clinical staff review"),
    ),
  );
});

test("isSupportedAudioMimeType and normalizeAudioMimeType handle codec suffixes cleanly", () => {
  assert.equal(normalizeAudioMimeType("Audio/WebM;codecs=opus"), "audio/webm");
  assert.equal(isSupportedAudioMimeType("audio/webm;codecs=opus"), true);
  assert.equal(isSupportedAudioMimeType("audio/mp4"), true);
  assert.equal(isSupportedAudioMimeType("video/mp4"), false);
  assert.equal(isSupportedAudioMimeType("application/octet-stream"), false);
});

test("extractClinicalIntakeBrief and transcribePatientAudio fail gracefully when GEMINI_API_KEY is missing", async () => {
  const extraction = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {},
  });
  assert.equal(extraction.aiStatus, "failed");
  assert.equal(extraction.aiErrorCode, "GEMINI_API_KEY_MISSING");
  assert.equal(extraction.aiBrief, null);

  await assert.rejects(
    () =>
      transcribePatientAudio({
        audioBase64: Buffer.from("synthetic-audio").toString("base64"),
        mimeType: "audio/webm",
        env: {
          // Even when OpenRouter is configured, audio must NEVER be sent to OpenRouter
          OPENROUTER_API_KEY: "sk-or-test-key-should-not-be-used-for-audio",
        },
      }),
    /GEMINI_API_KEY is not configured/,
  );
});

test("Provider Test A: Gemini primary succeeds with ThinkingLevel.LOW and OpenRouter is NOT called", async () => {
  let geminiCalls = 0;
  let openRouterCalls = 0;
  let observedModel = "";
  let observedThinkingLevel: unknown = undefined;

  const outcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
    },
    geminiGenerateFn: async (params) => {
      geminiCalls += 1;
      observedModel = params.model;
      observedThinkingLevel = params.thinkingLevel;
      return JSON.stringify({
        ...RAW_BRIEF,
        symptoms: [RAW_BRIEF.symptoms[0]],
        relevantContext: [RAW_BRIEF.relevantContext[0]],
        reportedDetailsToReview: [RAW_BRIEF.reportedDetailsToReview[0]],
      });
    },
    openRouterFetchImpl: async () => {
      openRouterCalls += 1;
      throw new Error("OpenRouter must not be called when Gemini succeeds");
    },
  });

  assert.equal(geminiCalls, 1);
  assert.equal(openRouterCalls, 0);
  assert.equal(observedModel, "gemini-4-hydrogen");
  assert.equal(observedThinkingLevel, "LOW");
  assert.equal(outcome.aiStatus, "succeeded");
  assert.equal(outcome.provider, "gemini");
  assert.equal(outcome.aiModelId, "gemini-4-hydrogen");
  assert.equal(outcome.aiErrorCode, null);
  assert.equal(
    outcome.aiBrief?.chiefConcern.sourceQuote,
    "sharp chest tightness",
  );
});

test("Provider Test B: Gemini 503/429 triggers OpenRouter openrouter/free fallback with identical Zod + EIE grounding", async () => {
  const attemptedGeminiModels: string[] = [];
  const openRouterRequests: Array<{
    url: string;
    authHeader: string | null;
    body: Record<string, unknown>;
  }> = [];

  const testSecret = "sk-or-synthetic-secret-must-never-leak";

  const outcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: testSecret,
    },
    geminiGenerateFn: async (params) => {
      attemptedGeminiModels.push(params.model);
      if (params.model === "gemini-4-hydrogen") {
        throw new Error("503 UNAVAILABLE: model experiencing high demand");
      }
      throw new Error("429 RESOURCE_EXHAUSTED: rate limit exceeded");
    },
    openRouterFetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      openRouterRequests.push({
        url: String(input),
        authHeader: headers.get("Authorization"),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });

      return new Response(
        JSON.stringify({
          id: "gen-test-001",
          model: "meta-llama/llama-3.3-70b-instruct:free",
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify(RAW_BRIEF),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  // Tried primary Gemini + Gemini fallback before OpenRouter
  assert.deepEqual(attemptedGeminiModels, [
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
  ]);
  assert.equal(openRouterRequests.length, 1);
  assert.equal(
    openRouterRequests[0]?.url,
    "https://openrouter.ai/api/v1/chat/completions",
  );
  assert.equal(openRouterRequests[0]?.authHeader, `Bearer ${testSecret}`);
  assert.equal(openRouterRequests[0]?.body.model, "openrouter/free");
  assert.deepEqual(openRouterRequests[0]?.body.provider, {
    require_parameters: true,
  });

  // Validated & grounded identically to Gemini
  assert.equal(outcome.aiStatus, "succeeded");
  assert.equal(outcome.provider, "openrouter");
  assert.equal(
    outcome.aiModelId,
    "openrouter:meta-llama/llama-3.3-70b-instruct:free",
  );
  assert.ok(outcome.aiModelId.length <= 80);
  assert.equal(outcome.aiErrorCode, null);

  // Verbatim quote kept; hallucinated quote stripped & demoted to "unclear"
  assert.equal(
    outcome.aiBrief?.symptoms[0]?.sourceQuote,
    "sharp chest tightness for about two hours",
  );
  assert.equal(outcome.aiBrief?.symptoms[1]?.sourceQuote, undefined);
  assert.equal(outcome.aiBrief?.symptoms[1]?.certainty, "unclear");
  assert.equal(outcome.aiBrief?.reportedDetailsToReview.length, 1);

  // Secret never leaked in outcome
  assert.equal(JSON.stringify(outcome).includes(testSecret), false);
});

test("Provider Test B2: OpenRouter retries once with json_object when json_schema returns 404/422 and clamps >80 char model IDs", async () => {
  const responseFormatTypes: string[] = [];
  const longReturnedModel =
    "provider-with-a-very-long-namespace/extraordinarily-long-free-model-identifier-version-2026:free";

  const outcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "sk-or-test-fallback-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async (_input, init) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as {
        response_format?: { type?: string };
      };
      responseFormatTypes.push(parsed.response_format?.type ?? "none");

      if (responseFormatTypes.length === 1) {
        return new Response(
          JSON.stringify({ error: { message: "No endpoints found for json_schema" } }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const cleanBrief = {
        ...RAW_BRIEF,
        symptoms: [RAW_BRIEF.symptoms[0]],
        relevantContext: [RAW_BRIEF.relevantContext[0]],
        reportedDetailsToReview: [RAW_BRIEF.reportedDetailsToReview[0]],
      };
      return new Response(
        JSON.stringify({
          model: longReturnedModel,
          choices: [
            {
              message: {
                role: "assistant",
                content: "```json\n" + JSON.stringify(cleanBrief) + "\n```",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.deepEqual(responseFormatTypes, ["json_schema", "json_object"]);
  assert.equal(outcome.aiStatus, "succeeded");
  assert.equal(outcome.provider, "openrouter");
  assert.equal(outcome.aiModelId.length, 80);
  assert.ok(outcome.aiModelId.startsWith("openrouter:"));
});

test("Provider Test C: Both Gemini and OpenRouter unavailable fails safely with aiStatus=failed", async () => {
  const outcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "sk-or-test-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async () =>
      new Response(JSON.stringify({ error: "Service overloaded" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
  });

  assert.equal(outcome.aiStatus, "failed");
  assert.equal(outcome.aiBrief, null);
  assert.equal(outcome.provider, "openrouter");
  assert.equal(outcome.aiErrorCode, "OPENROUTER_UPSTREAM_UNAVAILABLE");
});

test("Provider Test D: Missing OPENROUTER_API_KEY fails safely after Gemini outage without calling OpenRouter", async () => {
  let openRouterCalls = 0;

  const outcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async () => {
      openRouterCalls += 1;
      throw new Error("Should not call OpenRouter without OPENROUTER_API_KEY");
    },
  });

  assert.equal(openRouterCalls, 0);
  assert.equal(outcome.aiStatus, "failed");
  assert.equal(outcome.aiBrief, null);
  assert.equal(outcome.provider, "gemini");
  assert.equal(outcome.aiErrorCode, "GEMINI_UPSTREAM_UNAVAILABLE");
});

test("Provider Test E: Invalid OpenRouter JSON, forbidden clinical fields, and missing fields are rejected", async () => {
  // 1. Malformed JSON
  const malformedOutcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "sk-or-test-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "test-free/model:free",
          choices: [{ message: { content: "{ this is not valid JSON" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  assert.equal(malformedOutcome.aiStatus, "failed");
  assert.equal(malformedOutcome.aiBrief, null);
  assert.equal(malformedOutcome.aiErrorCode, "OPENROUTER_INVALID_JSON");

  // 2. Forbidden clinical fields (diagnosis, priority, triageColor, safeToWait, prescription)
  const forbiddenOutcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "sk-or-test-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "test-free/model:free",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...RAW_BRIEF,
                  diagnosis: "Possible angina",
                  priority: "immediate_review",
                  triageColor: "red",
                  safeToWait: false,
                  prescription: "Aspirin 300mg",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  assert.equal(forbiddenOutcome.aiStatus, "failed");
  assert.equal(forbiddenOutcome.aiBrief, null);
  assert.equal(
    forbiddenOutcome.aiErrorCode,
    "OPENROUTER_SCHEMA_VALIDATION_FAILED",
  );

  // 3. Missing required fields (no chiefConcern / clinicianSummary)
  const missingFieldsOutcome = await extractClinicalIntakeBrief({
    confirmedNarrative: NARRATIVE,
    age: 42,
    inputMode: "typed",
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      OPENROUTER_API_KEY: "sk-or-test-key",
    },
    geminiGenerateFn: async () => {
      throw new Error("503 UNAVAILABLE");
    },
    openRouterFetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "test-free/model:free",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schemaVersion: "1.0",
                  symptoms: [],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  assert.equal(missingFieldsOutcome.aiStatus, "failed");
  assert.equal(missingFieldsOutcome.aiBrief, null);
  assert.equal(
    missingFieldsOutcome.aiErrorCode,
    "OPENROUTER_SCHEMA_VALIDATION_FAILED",
  );
});

