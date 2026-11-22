import { NextResponse } from "next/server";
import { z } from "zod";
import type { DemoSessionRevocationStore } from "@/lib/auth/demo-session";
import {
  requireAuthorizedStaff,
  StaffAuthorizationError,
  type VerifyTokenFn,
} from "@/lib/auth/staff-authorization";
import { toSafeDatabaseError } from "@/lib/db/errors";
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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

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
  }) => Promise<GeminiExtractionOutcome>;
  readonly transcribeAudio?: (params: {
    audioBase64: string;
    mimeType: string;
  }) => Promise<GeminiTranscriptionOutcome>;
}

/**
 * POST /api/intakes
 * Public patient intake submission endpoint.
 * Persists the patient-confirmed intake first in Neon PostgreSQL, then runs
 * server-side Gemini extraction without ever blocking or losing the intake
 * if AI extraction fails.
 */
export async function handleCreatePatientIntakePost(
  request: Request,
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  assertServerRuntime();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(
      400,
      "INVALID_JSON_BODY",
      "Request body must be valid JSON.",
    );
  }

  const parsed = CreateIntakeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonError(
      400,
      "INVALID_INTAKE_PAYLOAD",
      firstIssue?.message ?? "Invalid patient intake payload.",
    );
  }

  const repository = deps.repository ?? createDrizzleStaffRepository();
  const extractBrief = deps.extractBrief ?? extractClinicalIntakeBrief;

  if (!repository.createPatientIntake) {
    return jsonError(
      503,
      "DATABASE_UNAVAILABLE",
      "Patient intake repository is unavailable.",
    );
  }

  try {
    const createdResult = await repository.createPatientIntake(parsed.data);
    if (!createdResult.ok) {
      return jsonError(
        createdResult.status,
        createdResult.code,
        createdResult.message,
      );
    }

    const created = createdResult.data;
    let finalAiStatus = created.aiStatus;

    if (
      (!created.deduplicated || created.aiStatus === "queued") &&
      repository.recordIntakeExtractionResult
    ) {
      try {
        const outcome = await extractBrief({
          confirmedNarrative: created.confirmedNarrative,
          inputMode: created.inputMode,
          age: created.age,
        });

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
        }
      } catch {
        // Never lose or fail the persisted patient intake if AI extraction fails
        try {
          const fallbackUpdated = await repository.recordIntakeExtractionResult({
            intakeId: created.id,
            facilityId: created.facilityId,
            aiStatus: "failed",
            aiModelId: "gemini-4-hydrogen",
            aiSchemaVersion: "1.0",
            aiBrief: null,
            aiErrorCode: "GEMINI_UNEXPECTED_ERROR",
          });
          if (fallbackUpdated) {
            finalAiStatus = fallbackUpdated.aiStatus;
          }
        } catch {
          finalAiStatus = created.aiStatus;
        }
      }
    }

    const payload = CreateIntakeResponseSchema.parse({
      intakeId: created.id,
      referenceCode: created.referenceCode,
      facilityPublicCode: created.facilityPublicCode,
      inputMode: created.inputMode,
      aiStatus: finalAiStatus,
      createdAt: created.createdAt,
      deduplicated: created.deduplicated,
    });

    return NextResponse.json(payload, {
      status: created.deduplicated ? 200 : 201,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const safeDb = toSafeDatabaseError(error);
    return jsonError(safeDb.statusCode, safeDb.errorCode, safeDb.message);
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(
      400,
      "INVALID_JSON_BODY",
      "Request body must be valid JSON.",
    );
  }

  const parsed = TranscribeAudioRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonError(
      400,
      "INVALID_TRANSCRIBE_PAYLOAD",
      firstIssue?.message ?? "Invalid audio transcription request.",
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
      headers: NO_STORE_HEADERS,
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
    return jsonError(status, "TRANSCRIPTION_FAILED", message);
  }
}

/**
 * POST /api/intakes/[intakeId]/extract
 * Authenticated clinical staff endpoint to trigger or retry server-side
 * Gemini structured extraction on an existing patient intake.
 */
export async function handleExtractIntakeBriefPost(
  request: Request,
  params: { intakeId: string },
  deps: IntakeApiHandlerDependencies = {},
): Promise<NextResponse> {
  assertServerRuntime();

  const parsedId = IntakeIdParamSchema.safeParse(params.intakeId);
  if (!parsedId.success) {
    return jsonError(
      400,
      "INVALID_INTAKE_ID",
      "Intake ID must be a valid UUID.",
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
      );
    }

    const intake = await repository.findIntakeForExtraction(
      parsedId.data,
      authSession.activeFacility.facilityId,
    );

    if (!intake) {
      return jsonError(
        404,
        "INTAKE_NOT_FOUND",
        "Requested patient intake was not found in this facility.",
      );
    }

    const outcome = await extractBrief({
      confirmedNarrative: intake.confirmedNarrative,
      inputMode: intake.inputMode,
      age: intake.age,
    });

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
      );
    }

    const payload = IntakeExtractionResponseSchema.parse({
      intakeId: updated.id,
      referenceCode: updated.referenceCode,
      aiStatus: updated.aiStatus,
      aiModelId: updated.aiModelId,
      aiBrief: updated.aiBrief,
      aiErrorCode: updated.aiErrorCode,
      updatedAt: updated.updatedAt,
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof StaffAuthorizationError) {
      return jsonError(error.statusCode, error.errorCode, error.message);
    }
    const safeDb = toSafeDatabaseError(error);
    return jsonError(safeDb.statusCode, safeDb.errorCode, safeDb.message);
  }
}
