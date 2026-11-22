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
  readonly demoModeEnabled: boolean;
  readonly demoModeReady: boolean;
}

export interface DemoModeConfig {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly ttlSeconds: number;
  readonly configError: string | null;
}

export const MIN_DEMO_SESSION_SECRET_LENGTH = 32;
export const DEFAULT_DEMO_SESSION_TTL_SECONDS = 7200; // 2 hours
export const MIN_DEMO_SESSION_TTL_SECONDS = 300; // 5 minutes
export const MAX_DEMO_SESSION_TTL_SECONDS = 28800; // 8 hours

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

/**
 * Evaluates server-only Hackathon Demo Mode configuration (DA-1).
 *
 * - Disabled by default whenever MEDFLOW_DEMO_MODE_ENABLED is not strictly "true".
 * - Fails closed if enabled without a valid server-only MEDFLOW_DEMO_SESSION_SECRET
 *   of at least 32 characters.
 * - Never returns the raw signing secret.
 */
export function getDemoModeConfig(
  env: Record<string, string | undefined> = process.env,
): DemoModeConfig {
  assertServerRuntime();

  const rawEnabled = env.MEDFLOW_DEMO_MODE_ENABLED?.trim().toLowerCase();
  const enabled = rawEnabled === "true";

  const rawTtl = env.MEDFLOW_DEMO_SESSION_TTL_SECONDS?.trim();
  let ttlSeconds = DEFAULT_DEMO_SESSION_TTL_SECONDS;
  let ttlInvalid = false;

  if (rawTtl !== undefined && rawTtl.length > 0) {
    if (!/^\d+$/.test(rawTtl)) {
      ttlInvalid = true;
    } else {
      const parsed = Number.parseInt(rawTtl, 10);
      if (
        !Number.isFinite(parsed) ||
        parsed < MIN_DEMO_SESSION_TTL_SECONDS ||
        parsed > MAX_DEMO_SESSION_TTL_SECONDS
      ) {
        ttlInvalid = true;
      } else {
        ttlSeconds = parsed;
      }
    }
  }

  if (!enabled) {
    return {
      enabled: false,
      configured: false,
      ttlSeconds,
      configError: null,
    };
  }

  const secret = env.MEDFLOW_DEMO_SESSION_SECRET?.trim() ?? "";
  if (secret.length < MIN_DEMO_SESSION_SECRET_LENGTH) {
    return {
      enabled: true,
      configured: false,
      ttlSeconds,
      configError:
        "MEDFLOW_DEMO_SESSION_SECRET must be configured with at least 32 characters when Demo Mode is enabled.",
    };
  }

  if (ttlInvalid) {
    return {
      enabled: true,
      configured: false,
      ttlSeconds: DEFAULT_DEMO_SESSION_TTL_SECONDS,
      configError: `MEDFLOW_DEMO_SESSION_TTL_SECONDS must be an integer between ${MIN_DEMO_SESSION_TTL_SECONDS} and ${MAX_DEMO_SESSION_TTL_SECONDS}.`,
    };
  }

  return {
    enabled: true,
    configured: true,
    ttlSeconds,
    configError: null,
  };
}

/**
 * Returns the server-only HMAC signing secret for Hackathon Demo Mode sessions.
 * Throws if Demo Mode is disabled or the secret fails validation (fail-closed).
 */
export function getDemoSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  assertServerRuntime();
  const config = getDemoModeConfig(env);
  if (!config.enabled) {
    throw new Error("Hackathon Demo Mode is disabled on this server.");
  }
  if (!config.configured) {
    throw new Error(
      config.configError ?? "Hackathon Demo Mode session configuration is invalid.",
    );
  }
  return env.MEDFLOW_DEMO_SESSION_SECRET!.trim();
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
    demoModeEnabled: getDemoModeConfig(env).enabled,
    demoModeReady:
      getDemoModeConfig(env).enabled && getDemoModeConfig(env).configured,
  };
}
