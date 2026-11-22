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

  // Explicit grounding note appended to limitations
  assert.ok(
    brief.limitations.some((line: string) =>
      line.includes("3 AI-proposed quote(s)"),
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
        env: {},
      }),
    /GEMINI_API_KEY is not configured/,
  );
});
