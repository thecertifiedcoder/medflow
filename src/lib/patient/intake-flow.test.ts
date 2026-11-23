import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRecordingDuration,
  parseAndValidateAge,
  resolveSubmitTranscriptRaw,
  stepAgeValue,
  validateNarrativeForContinue,
} from "./intake-flow";

test("parseAndValidateAge keeps blank age optional and validates 0-120 range", () => {
  assert.deepEqual(parseAndValidateAge(""), { valid: true, age: undefined });
  assert.deepEqual(parseAndValidateAge("   "), { valid: true, age: undefined });
  assert.deepEqual(parseAndValidateAge("0"), { valid: true, age: 0 });
  assert.deepEqual(parseAndValidateAge("42"), { valid: true, age: 42 });
  assert.deepEqual(parseAndValidateAge("120"), { valid: true, age: 120 });

  assert.equal(parseAndValidateAge("-1").valid, false);
  assert.equal(parseAndValidateAge("121").valid, false);
  assert.equal(parseAndValidateAge("34.5").valid, false);
  assert.equal(parseAndValidateAge("abc").valid, false);
});

test("stepAgeValue steps safely without pre-filling zero unexpectedly", () => {
  assert.equal(stepAgeValue("", 1), "1");
  assert.equal(stepAgeValue("", -1), "0");
  assert.equal(stepAgeValue("0", -1), "0");
  assert.equal(stepAgeValue("1", -1), "0");
  assert.equal(stepAgeValue("35", 1), "36");
  assert.equal(stepAgeValue("120", 1), "120");
  assert.equal(stepAgeValue("150", 1), "120");
});

test("validateNarrativeForContinue enforces minimum and maximum narrative bounds", () => {
  assert.equal(validateNarrativeForContinue("").valid, false);
  assert.equal(validateNarrativeForContinue("   ").valid, false);
  assert.equal(validateNarrativeForContinue("pain").valid, false);

  const ok = validateNarrativeForContinue("  Headache since yesterday evening.  ");
  assert.equal(ok.valid, true);
  if (ok.valid) {
    assert.equal(ok.trimmedNarrative, "Headache since yesterday evening.");
  }

  assert.equal(validateNarrativeForContinue("a".repeat(4001)).valid, false);
});

test("formatRecordingDuration formats mm:ss consistently", () => {
  assert.equal(formatRecordingDuration(0), "0:00");
  assert.equal(formatRecordingDuration(7), "0:07");
  assert.equal(formatRecordingDuration(65), "1:05");
  assert.equal(formatRecordingDuration(90), "1:30");
});

test("resolveSubmitTranscriptRaw preserves separate raw transcript for voice mode", () => {
  assert.equal(
    resolveSubmitTranscriptRaw({
      inputMode: "typed",
      transcriptRaw: "ignored raw",
      narrative: "Typed chest discomfort",
    }),
    undefined,
  );

  assert.equal(
    resolveSubmitTranscriptRaw({
      inputMode: "voice",
      transcriptRaw: "my body dey hot",
      narrative: "My body has been hot since last night.",
    }),
    "my body dey hot",
  );
});
