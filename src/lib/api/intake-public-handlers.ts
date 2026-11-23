import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { DemoSessionRevocationStore } from "@/lib/auth/demo-session";
import type { VerifyTokenFn } from "@/lib/firebase/token-types";
import {
  describeSafeServerError,
  toSafeDatabaseError,
} from "@/lib/db/errors";
import {
  createDrizzleStaffRepository,
  type StaffRepository,
} from "@/lib/db/staff-repository";
import { assertServerRuntime } from "@/lib/env/server";
import {
  extractClinicalIntakeBrief,
  transcribePatientAudio,
  type GeminiExtractionOutcome,
  type GeminiTranscriptionOutcome,
} from "@/lib/gemini/service";
import { jsonError } from "@/lib/http/errors";
import {
  CreateIntakeRequestSchema,
  CreateIntakeResponseSchema,
  TranscribeAudioResponseSchema,
} from "@/lib/schemas/intake";

const TranscribeAudioRequestSchema = z.object({
  audioBase64: z.string().trim().min(8, "Audio payload is required."),
  mimeType: z.string().trim().min(3, "Audio MIME type is required."),
});

export interface IntakeApiHandlerDependencies {
  readonly repository?: StaffRepository;
  readonly verifyToken?: VerifyTokenFn;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => Date;
  readonly revocationStore?: DemoSessionRevocationStore;
  readonly extractBrief?: (params: {
    confirmedNarrative: string;
    inputMode: "typed" | "voice";
    age?: number | null;
    requestId?: string;
  }) => Promise<GeminiExtractionOutcome>;
  readonly transcribeAudio?: (params: {
    audioBase64: string;
    mimeType: string;
  }) => Promise<GeminiTranscriptionOutcome>;
}

export function resolveIntakeRequestId(request: Request): string {
  const vercelId = request.headers.get("x-vercel-id")?.trim();
  if (vercelId && vercelId.length > 0) {
    return vercelId.slice(0, 64);
  }
  const existing = request.headers.get("x-request-id")?.trim();
  if (existing && existing.length > 0) {
    return existing.slice(0, 64);
  }
  return randomUUID();
}

export function buildIntakeResponseHeaders(
  requestId: string,
): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
}

export function logIntakeDiagnostic(payload: {
  readonly level: "info" | "warn" | "error";
  readonly route: string;
  readonly stage: string;
  readonly requestId: string;
  readonly durationMs: number;
  readonly httpStatus?: number;
  readonly aiStatus?: string;
  readonly aiModelId?: string | null;
  readonly errorCategory?: string;
  readonly errorName?: string;
  readonly pgCode?: string | null;
  readonly constraint?: string | null;
}): void {
  // Structured non-PHI operational telemetry only.
  // Never logs patient name, narrative, transcript, secrets, or SQL text.
  const line = JSON.stringify({
    scope: "medflow.api.intakes",
    ...payload,
  });
  if (payload.level === "error") {
    console.error(line);
  } else if (payload.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * POST /api/intakes
 * Public patient intake submission endpoint.
 * Kept strictly decoupled from staff authorization so public patient intake
 * submissions never depend on Firebase Admin SDK initialization.
 */
export async function handleCreatePatientIntakePost(
  request: Request,
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = resolveIntakeRequestId(request);
  let currentStage = "assert_runtime";

  try {
    assertServerRuntime();
    currentStage = "parse_body";

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(
        400,
        "INVALID_JSON_BODY",
        "Request body must be valid JSON.",
        { requestId },
      );
    }

    currentStage = "validate_payload";
    const parsed = CreateIntakeRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return jsonError(
        400,
        "INVALID_INTAKE_PAYLOAD",
        firstIssue?.message ?? "Invalid patient intake payload.",
        { requestId },
      );
    }

    currentStage = "init_repository";
    const repository = deps.repository ?? createDrizzleStaffRepository();
    const extractBrief = deps.extractBrief ?? extractClinicalIntakeBrief;

    if (!repository.createPatientIntake) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Patient intake repository is unavailable.",
        { requestId },
      );
    }

    currentStage = "persist_intake";
    const createdResult = await repository.createPatientIntake(parsed.data);
    if (!createdResult.ok) {
      return jsonError(
        createdResult.status,
        createdResult.code,
        createdResult.message,
        { requestId },
      );
    }

    const created = createdResult.data;
    let finalAiStatus = created.aiStatus;
    let finalAiModelId: string | null = null;

    if (
      (!created.deduplicated || created.aiStatus === "queued") &&
      repository.recordIntakeExtractionResult
    ) {
      currentStage = "extract_brief";
      try {
        const outcome = await extractBrief({
          confirmedNarrative: created.confirmedNarrative,
          inputMode: created.inputMode,
          age: created.age,
          requestId,
        });
        finalAiModelId = outcome.aiModelId;

        currentStage = "record_extraction";
        const updated = await repository.recordIntakeExtractionResult({
          intakeId: created.id,
          facilityId: created.facilityId,
          aiStatus: outcome.aiStatus,
          aiModelId: outcome.aiModelId,
          aiSchemaVersion: outcome.aiSchemaVersion,
          aiBrief: outcome.aiBrief,
          aiErrorCode: outcome.aiErrorCode,
        });

        if (updated) {
          finalAiStatus = updated.aiStatus;
        } else {
          finalAiStatus = outcome.aiStatus;
        }
      } catch (aiErr) {
        // Critical invariant: AI failure must NEVER fail or lose a persisted intake.
        const safeErr = describeSafeServerError(aiErr);
        logIntakeDiagnostic({
          level: "warn",
          route: "POST /api/intakes",
          stage: currentStage,
          requestId,
          durationMs: Date.now() - startedAt,
          errorCategory: safeErr.category,
          errorName: safeErr.errorName,
          pgCode: safeErr.pgCode,
          constraint: safeErr.constraint,
        });

        try {
          const fallbackUpdated = await repository.recordIntakeExtractionResult({
            intakeId: created.id,
            facilityId: created.facilityId,
            aiStatus: "failed",
            aiModelId: "gemini-4-hydrogen",
            aiSchemaVersion: "1.0",
            aiBrief: null,
            aiErrorCode: "AI_EXTRACTION_UNEXPECTED_ERROR",
          });
          finalAiStatus = fallbackUpdated ? fallbackUpdated.aiStatus : "failed";
        } catch (recordFailErr) {
          const safeRecordErr = describeSafeServerError(recordFailErr);
          logIntakeDiagnostic({
            level: "warn",
            route: "POST /api/intakes",
            stage: "record_extraction_failure",
            requestId,
            durationMs: Date.now() - startedAt,
            errorCategory: safeRecordErr.category,
            errorName: safeRecordErr.errorName,
            pgCode: safeRecordErr.pgCode,
            constraint: safeRecordErr.constraint,
          });
          finalAiStatus = "failed";
        }
      }
    }

    currentStage = "serialize_response";
    const payload = CreateIntakeResponseSchema.parse({
      intakeId: created.id,
      referenceCode: created.referenceCode,
      facilityPublicCode: created.facilityPublicCode,
      inputMode: created.inputMode,
      aiStatus: finalAiStatus,
      createdAt: created.createdAt,
      deduplicated: created.deduplicated,
    });

    const httpStatus = created.deduplicated ? 200 : 201;
    logIntakeDiagnostic({
      level: "info",
      route: "POST /api/intakes",
      stage: "completed",
      requestId,
      durationMs: Date.now() - startedAt,
      httpStatus,
      aiStatus: finalAiStatus,
      aiModelId: finalAiModelId,
    });

    return NextResponse.json(payload, {
      status: httpStatus,
      headers: buildIntakeResponseHeaders(requestId),
    });
  } catch (error) {
    const safeDb = toSafeDatabaseError(error);
    const diag = describeSafeServerError(error);

    logIntakeDiagnostic({
      level: "error",
      route: "POST /api/intakes",
      stage: currentStage,
      requestId,
      durationMs: Date.now() - startedAt,
      httpStatus: safeDb.statusCode,
      errorCategory: diag.category,
      errorName: diag.errorName,
      pgCode: diag.pgCode,
      constraint: diag.constraint,
    });

    return jsonError(safeDb.statusCode, safeDb.errorCode, safeDb.message, {
      requestId,
    });
  }
}

/**
 * POST /api/intakes/transcribe
 * Server-side Gemini audio transcription endpoint for voice-based patient intake.
 */
export async function handleTranscribePatientAudioPost(
  request: Request,
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = resolveIntakeRequestId(request);

  try {
    assertServerRuntime();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(
        400,
        "INVALID_JSON_BODY",
        "Request body must be valid JSON.",
        { requestId },
      );
    }

    const parsed = TranscribeAudioRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return jsonError(
        400,
        "INVALID_TRANSCRIBE_PAYLOAD",
        firstIssue?.message ?? "Invalid audio transcription request.",
        { requestId },
      );
    }

    const transcribe = deps.transcribeAudio ?? transcribePatientAudio;

    const outcome = await transcribe({
      audioBase64: parsed.data.audioBase64,
      mimeType: parsed.data.mimeType,
    });

    const payload = TranscribeAudioResponseSchema.parse({
      transcriptRaw: outcome.transcriptRaw,
      transcriptionModel: outcome.transcriptionModel,
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: buildIntakeResponseHeaders(requestId),
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Voice transcription failed. You can retry or switch to typed intake.";
    const status =
      message.includes("Unsupported audio MIME type") ||
      message.includes("exceeds maximum allowed size") ||
      message.includes("empty")
        ? 400
        : 502;
    const diag = describeSafeServerError(err);
    logIntakeDiagnostic({
      level: "warn",
      route: "POST /api/intakes/transcribe",
      stage: "transcribe_audio",
      requestId,
      durationMs: Date.now() - startedAt,
      httpStatus: status,
      errorCategory: diag.category,
      errorName: diag.errorName,
    });
    return jsonError(status, "TRANSCRIPTION_FAILED", message, { requestId });
  }
}
