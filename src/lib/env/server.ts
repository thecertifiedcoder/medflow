export interface ServerConfig {
  readonly demoFacilityId: string;
  readonly demoFacilityName: string;
  readonly demoFacilityPublicCode: string;
  readonly geminiExtractionModel: string;
  readonly geminiTranscribeModel: string;
  readonly maxAudioUploadBytes: number;
  readonly maxAudioDurationSeconds: number;
  readonly hasGeminiApiKey: boolean;
}

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

export function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server configuration cannot be accessed in a browser runtime.");
  }
}

export function getServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  assertServerRuntime();

  const geminiKey = env.GEMINI_API_KEY?.trim();

  return {
    demoFacilityId: env.DEMO_FACILITY_ID?.trim() || "demo-facility-001",
    demoFacilityName:
      env.DEMO_FACILITY_NAME?.trim() || "MedFlow Synthetic Demo Facility",
    demoFacilityPublicCode:
      env.NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE?.trim() || "DEMO-FACILITY",
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
  };
}
