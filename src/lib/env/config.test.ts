import test from "node:test";
import assert from "node:assert/strict";
import { getPublicConfig } from "./public";
import {
  getDatabaseUrl,
  getMigrationDatabaseUrl,
  getServerConfig,
} from "./server";

test("getPublicConfig returns canonical demo-clinic defaults when env vars are unset", () => {
  const cfg = getPublicConfig({});
  assert.equal(cfg.demoFacilityPublicCode, "DEMO-CLINIC-01");
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

test("retired demo-facility-001 and DEMO-FACILITY normalize to canonical demo-clinic-01 and DEMO-CLINIC-01", () => {
  const pub = getPublicConfig({
    NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE: "DEMO-FACILITY",
  });
  assert.equal(pub.demoFacilityPublicCode, "DEMO-CLINIC-01");

  const srv = getServerConfig({
    DEMO_FACILITY_ID: "demo-facility-001",
    NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE: "DEMO-FACILITY",
  });
  assert.equal(srv.demoFacilityId, "demo-clinic-01");
  assert.equal(srv.demoFacilityPublicCode, "DEMO-CLINIC-01");
});

test("getServerConfig uses canonical demo-clinic-01, approved Gemini models, and never exposes raw secrets", () => {
  const cfg = getServerConfig({
    GEMINI_API_KEY: "test-placeholder-only",
    DATABASE_URL:
      "postgresql://user:pass@ep-demo-pooler.eu-central-1.aws.neon.tech/medflow?sslmode=require",
    DATABASE_URL_UNPOOLED:
      "postgresql://user:pass@ep-demo.eu-central-1.aws.neon.tech/medflow?sslmode=require",
    MAX_AUDIO_UPLOAD_BYTES: "5242880",
    MAX_AUDIO_DURATION_SECONDS: "60",
  });

  assert.equal(cfg.demoFacilityId, "demo-clinic-01");
  assert.equal(cfg.demoFacilityName, "MedFlow Synthetic Demo Clinic");
  assert.equal(cfg.demoFacilityPublicCode, "DEMO-CLINIC-01");
  assert.equal(cfg.geminiExtractionModel, "gemini-4-hydrogen");
  assert.equal(cfg.geminiTranscribeModel, "gemini-3.5-transcribe");
  assert.equal(cfg.maxAudioUploadBytes, 5242880);
  assert.equal(cfg.maxAudioDurationSeconds, 60);
  assert.equal(cfg.hasGeminiApiKey, true);
  assert.equal(cfg.hasDatabaseUrl, true);
  assert.equal(cfg.hasDatabaseUrlUnpooled, true);
  assert.equal("geminiApiKey" in cfg, false);
  assert.equal("databaseUrl" in cfg, false);
  assert.equal("databaseUrlUnpooled" in cfg, false);
});

test("getServerConfig falls back safely on invalid numeric bounds and non-postgres URLs", () => {
  const cfg = getServerConfig({
    DATABASE_URL: "http://not-a-postgres-uri",
    DATABASE_URL_UNPOOLED: "   ",
    MAX_AUDIO_UPLOAD_BYTES: "-500",
    MAX_AUDIO_DURATION_SECONDS: "not-a-number",
  });

  assert.equal(cfg.maxAudioUploadBytes, 10 * 1024 * 1024);
  assert.equal(cfg.maxAudioDurationSeconds, 90);
  assert.equal(cfg.hasGeminiApiKey, false);
  assert.equal(cfg.hasDatabaseUrl, false);
  assert.equal(cfg.hasDatabaseUrlUnpooled, false);
});

test("getDatabaseUrl and getMigrationDatabaseUrl enforce valid server-only PostgreSQL URIs", () => {
  const pooled =
    "postgresql://user:pass@ep-demo-pooler.eu-central-1.aws.neon.tech/medflow?sslmode=require";
  const unpooled =
    "postgresql://user:pass@ep-demo.eu-central-1.aws.neon.tech/medflow?sslmode=require";

  assert.equal(getDatabaseUrl({ DATABASE_URL: pooled }), pooled);
  assert.equal(
    getMigrationDatabaseUrl({
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: unpooled,
    }),
    unpooled,
  );
  assert.equal(getMigrationDatabaseUrl({ DATABASE_URL: pooled }), pooled);

  assert.throws(() => getDatabaseUrl({}), /DATABASE_URL is not configured/);
  assert.throws(
    () => getDatabaseUrl({ DATABASE_URL: "mysql://bad" }),
    /must be a valid PostgreSQL connection URI/,
  );
  assert.throws(
    () =>
      getMigrationDatabaseUrl({
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: "https://bad",
      }),
    /DATABASE_URL_UNPOOLED must be a valid PostgreSQL connection URI/,
  );
});
