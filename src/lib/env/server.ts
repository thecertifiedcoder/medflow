export interface ServerConfig {
  readonly demoFacilityId: string;
  readonly demoFacilityName: string;
  readonly demoFacilityPublicCode: string;
  readonly geminiExtractionModel: string;
  readonly geminiTranscribeModel: string;
  readonly maxAudioUploadBytes: number;
  readonly maxAudioDurationSeconds: number;
  readonly hasGeminiApiKey: boolean;
  readonly hasDatabaseUrl: boolean;
  readonly hasDatabaseUrlUnpooled: boolean;
}

const DEFAULT_DEMO_FACILITY_ID = "demo-clinic-01";
const RETIRED_DEMO_FACILITY_ID = "demo-facility-001";
const DEFAULT_DEMO_FACILITY_NAME = "MedFlow Synthetic Demo Clinic";
const DEFAULT_DEMO_FACILITY_PUBLIC_CODE = "DEMO-CLINIC-01";
const RETIRED_DEMO_FACILITY_PUBLIC_CODE = "DEMO-FACILITY";
const DEFAULT_EXTRACTION_MODEL = "gemini-4-hydrogen";
const DEFAULT_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const DEFAULT_MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_AUDIO_SECONDS = 90;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server configuration cannot be accessed in a browser runtime.");
  }
}

/**
 * Returns the runtime Neon PostgreSQL connection string (DATABASE_URL).
 * Strictly server-only; never expose in client bundles or API responses.
 */
export function getDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  assertServerRuntime();
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Configure the server-only Neon PostgreSQL runtime connection string before connecting.",
    );
  }
  if (!isPostgresUrl(url)) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection URI (postgres:// or postgresql://).",
    );
  }
  return url;
}

/**
 * Returns the direct (unpooled) Neon PostgreSQL connection string for schema
 * migrations and founder-run CLI scripts. Falls back to DATABASE_URL only if
 * DATABASE_URL_UNPOOLED is not set.
 */
export function getMigrationDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  assertServerRuntime();
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) {
    if (!isPostgresUrl(unpooled)) {
      throw new Error(
        "DATABASE_URL_UNPOOLED must be a valid PostgreSQL connection URI (postgres:// or postgresql://).",
      );
    }
    return unpooled;
  }
  return getDatabaseUrl(env);
}

export function getServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  assertServerRuntime();

  const geminiKey = env.GEMINI_API_KEY?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const databaseUrlUnpooled = env.DATABASE_URL_UNPOOLED?.trim();

  const rawFacilityId = env.DEMO_FACILITY_ID?.trim();
  const normalizedFacilityId =
    !rawFacilityId ||
    rawFacilityId.toLowerCase() === RETIRED_DEMO_FACILITY_ID
      ? DEFAULT_DEMO_FACILITY_ID
      : rawFacilityId;

  const rawPublicCode = env.NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE?.trim();
  const normalizedPublicCode =
    !rawPublicCode ||
    rawPublicCode.toUpperCase() === RETIRED_DEMO_FACILITY_PUBLIC_CODE
      ? DEFAULT_DEMO_FACILITY_PUBLIC_CODE
      : rawPublicCode;

  return {
    demoFacilityId: normalizedFacilityId,
    demoFacilityName:
      env.DEMO_FACILITY_NAME?.trim() || DEFAULT_DEMO_FACILITY_NAME,
    demoFacilityPublicCode: normalizedPublicCode,
    geminiExtractionModel:
      env.GEMINI_EXTRACTION_MODEL?.trim() || DEFAULT_EXTRACTION_MODEL,
    geminiTranscribeModel:
      env.GEMINI_TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIBE_MODEL,
    maxAudioUploadBytes: parsePositiveInt(
      env.MAX_AUDIO_UPLOAD_BYTES,
      DEFAULT_MAX_AUDIO_BYTES,
    ),
    maxAudioDurationSeconds: parsePositiveInt(
      env.MAX_AUDIO_DURATION_SECONDS,
      DEFAULT_MAX_AUDIO_SECONDS,
    ),
    hasGeminiApiKey: Boolean(geminiKey && geminiKey.length > 0),
    hasDatabaseUrl: Boolean(databaseUrl && isPostgresUrl(databaseUrl)),
    hasDatabaseUrlUnpooled: Boolean(
      databaseUrlUnpooled && isPostgresUrl(databaseUrlUnpooled),
    ),
  };
}
