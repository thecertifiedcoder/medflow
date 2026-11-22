import test from "node:test";
import assert from "node:assert/strict";
import { getPublicConfig } from "./public";
import { getServerConfig } from "./server";

test("getPublicConfig returns safe defaults when env vars are unset", () => {
  const cfg = getPublicConfig({});
  assert.equal(cfg.demoFacilityPublicCode, "DEMO-FACILITY");
  assert.equal(cfg.appEnv, "development");
});

test("getPublicConfig trims explicit public values", () => {
  const cfg = getPublicConfig({
    NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE: "  CALABAR-DEMO  ",
    NEXT_PUBLIC_APP_ENV: "preview",
  });
  assert.equal(cfg.demoFacilityPublicCode, "CALABAR-DEMO");
  assert.equal(cfg.appEnv, "preview");
});

test("getServerConfig uses approved Gemini models and never exposes raw secret value", () => {
  const cfg = getServerConfig({
    GEMINI_API_KEY: "test-placeholder-only",
    MAX_AUDIO_UPLOAD_BYTES: "5242880",
    MAX_AUDIO_DURATION_SECONDS: "60",
  });

  assert.equal(cfg.geminiExtractionModel, "gemini-4-hydrogen");
  assert.equal(cfg.geminiTranscribeModel, "gemini-3.5-transcribe");
  assert.equal(cfg.maxAudioUploadBytes, 5242880);
  assert.equal(cfg.maxAudioDurationSeconds, 60);
  assert.equal(cfg.hasGeminiApiKey, true);
  assert.equal("geminiApiKey" in cfg, false);
});

test("getServerConfig falls back safely on invalid numeric bounds", () => {
  const cfg = getServerConfig({
    MAX_AUDIO_UPLOAD_BYTES: "-500",
    MAX_AUDIO_DURATION_SECONDS: "not-a-number",
  });

  assert.equal(cfg.maxAudioUploadBytes, 10 * 1024 * 1024);
  assert.equal(cfg.maxAudioDurationSeconds, 90);
  assert.equal(cfg.hasGeminiApiKey, false);
});
