import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { DemoSessionRevocationStore } from "@/lib/auth/demo-session";
import {
  requireAuthorizedStaff,
  StaffAuthorizationError,
  type VerifyTokenFn,
} from "@/lib/auth/staff-authorization";
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
  type StaffRole,
} from "@/lib/schemas/intake";
import { IntakeExtractionResponseSchema } from "@/lib/schemas/staff-api";

const IntakeIdParamSchema = z.string().uuid("Intake ID must be a valid UUID.");

const TranscribeAudioRequestSchema = z.object({
  audioBase64: z.string().trim().min(8, "Audio payload is required."),
  mimeType: z.string().trim().min(3, "Audio MIME type is required."),
});

const ExtractIntakeRequestBodySchema = z
  .object({
    facilityId: z.string().trim().min(1).max(128).optional(),
  })
  .optional();

const CLINICAL_EXTRACTION_ROLES: readonly StaffRole[] = ["nurse", "doctor"];

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

function resolveRequestId(request: Request): string {
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

function buildResponseHeaders(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
}

function logIntakeDiagnostic(payload: {
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
 * Persists the patient-confirmed intake first in Neon PostgreSQL, then runs
 * server-side AI extraction (Gemini primary -> Gemini fallback -> OpenRouter
 * free-model fallback) without ever blocking, failing, or losing the persisted
 * intake if AI extraction fails.
 */
export async function handleCreatePatientIntakePost(
  request: Request,
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  assertServerRuntime();
  const startedAt = Date.now();
  const requestId = resolveRequestId(request);
  let currentStage = "parse_body";

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

  try {
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
      headers: buildResponseHeaders(requestId),
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
  assertServerRuntime();
  const requestId = resolveRequestId(request);

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

  try {
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
      headers: buildResponseHeaders(requestId),
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
    return jsonError(status, "TRANSCRIPTION_FAILED", message, { requestId });
  }
}

/**
 * POST /api/intakes/[intakeId]/extract
 * Authenticated clinical staff endpoint to trigger or retry server-side
 * structured extraction (Gemini -> OpenRouter fallback) on an existing intake.
 */
export async function handleExtractIntakeBriefPost(
  request: Request,
  params: { intakeId: string },
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  assertServerRuntime();
  const startedAt = Date.now();
  const requestId = resolveRequestId(request);
  let currentStage = "validate_params";

  const parsedId = IntakeIdParamSchema.safeParse(params.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
      { requestId },
    );
  }

  let requestedFacilityId: string | undefined;
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      const parsedBody = ExtractIntakeRequestBodySchema.safeParse(
        JSON.parse(text),
      );
      if (parsedBody.success && parsedBody.data?.facilityId) {
        requestedFacilityId = parsedBody.data.facilityId;
      }
    }
  } catch {
    // Optional body
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const extractBrief = deps.extractBrief ?? extractClinicalIntakeBrief;

  try {
    currentStage = "authorize_staff";
    const authSession = await requireAuthorizedStaff({
      authorizationHeader: request.headers.get("authorization"),
      cookieHeader: request.headers.get("cookie"),
      requestedFacilityId: requestedFacilityId ?? null,
      strictFacilityMatch: true,
      allowedRoles: CLINICAL_EXTRACTION_ROLES,
      verifyToken: deps.verifyToken,
      repository,
      env: deps.env,
      now: deps.now,
      revocationStore: deps.revocationStore,
    });

    if (
      !repository.findIntakeForExtraction ||
      !repository.recordIntakeExtractionResult
    ) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Extraction persistence repository is unavailable.",
        { requestId },
      );
    }

    currentStage = "load_intake";
    const intake = await repository.findIntakeForExtraction(
      parsedId.data,
      authSession.activeFacility.facilityId,
    );

    if (!intake) {
      return jsonError(
        404,
        "INTAKE_NOT_FOUND",
        "Requested patient intake was not found in this facility.",
        { requestId },
      );
    }

    currentStage = "extract_brief";
    let outcome: GeminiExtractionOutcome;
    try {
      outcome = await extractBrief({
        confirmedNarrative: intake.confirmedNarrative,
        inputMode: intake.inputMode,
        age: intake.age,
        requestId,
      });
    } catch (aiErr) {
      const safeErr = describeSafeServerError(aiErr);
      logIntakeDiagnostic({
        level: "warn",
        route: "POST /api/intakes/[intakeId]/extract",
        stage: currentStage,
        requestId,
        durationMs: Date.now() - startedAt,
        errorCategory: safeErr.category,
        errorName: safeErr.errorName,
      });
      outcome = {
        aiStatus: "failed",
        aiModelId: "gemini-4-hydrogen",
        aiSchemaVersion: "1.0",
        aiBrief: null,
        aiErrorCode: "AI_EXTRACTION_UNEXPECTED_ERROR",
      };
    }

    currentStage = "record_extraction";
    const updated = await repository.recordIntakeExtractionResult({
      intakeId: intake.id,
      facilityId: authSession.activeFacility.facilityId,
      aiStatus: outcome.aiStatus,
      aiModelId: outcome.aiModelId,
      aiSchemaVersion: outcome.aiSchemaVersion,
      aiBrief: outcome.aiBrief,
      aiErrorCode: outcome.aiErrorCode,
    });

    if (!updated) {
      return jsonError(
        404,
        "INTAKE_NOT_FOUND",
        "Requested patient intake was not found after extraction.",
        { requestId },
      );
    }

    currentStage = "serialize_response";
    const payload = IntakeExtractionResponseSchema.parse({
      intakeId: updated.id,
      referenceCode: updated.referenceCode,
      aiStatus: updated.aiStatus,
      aiModelId: updated.aiModelId,
      aiBrief: updated.aiBrief,
      aiErrorCode: updated.aiErrorCode,
      updatedAt: updated.updatedAt,
    });

    logIntakeDiagnostic({
      level: "info",
      route: "POST /api/intakes/[intakeId]/extract",
      stage: "completed",
      requestId,
      durationMs: Date.now() - startedAt,
      httpStatus: 200,
      aiStatus: updated.aiStatus,
      aiModelId: updated.aiModelId,
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: buildResponseHeaders(requestId),
    });
  } catch (error) {
    if (error instanceof StaffAuthorizationError) {
      return jsonError(error.statusCode, error.errorCode, error.message, {
        requestId,
      });
    }
    const safeDb = toSafeDatabaseError(error);
    const diag = describeSafeServerError(error);

    logIntakeDiagnostic({
      level: "error",
      route: "POST /api/intakes/[intakeId]/extract",
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
