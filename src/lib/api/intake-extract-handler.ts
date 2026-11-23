import { NextResponse } from "next/server";
import { z } from "zod";
import {
  describeSafeServerError,
  toSafeDatabaseError,
} from "@/lib/db/errors";
import { createDrizzleStaffRepository } from "@/lib/db/staff-repository";
import { assertServerRuntime } from "@/lib/env/server";
import {
  extractClinicalIntakeBrief,
  type GeminiExtractionOutcome,
} from "@/lib/gemini/service";
import { jsonError } from "@/lib/http/errors";
import type { StaffRole } from "@/lib/schemas/intake";
import { IntakeExtractionResponseSchema } from "@/lib/schemas/staff-api";
import {
  buildIntakeResponseHeaders,
  logIntakeDiagnostic,
  resolveIntakeRequestId,
  type IntakeApiHandlerDependencies,
} from "./intake-public-handlers";

const IntakeIdParamSchema = z.string().uuid("Intake ID must be a valid UUID.");

const ExtractIntakeRequestBodySchema = z
  .object({
    facilityId: z.string().trim().min(1).max(128).optional(),
  })
  .optional();

const CLINICAL_EXTRACTION_ROLES: readonly StaffRole[] = ["nurse", "doctor"];

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
  const startedAt = Date.now();
  const requestId = resolveIntakeRequestId(request);
  let currentStage = "assert_runtime";

  try {
    assertServerRuntime();
    currentStage = "validate_params";

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

    currentStage = "authorize_staff";
    const { requireAuthorizedStaff, StaffAuthorizationError } = await import(
      "@/lib/auth/staff-authorization"
    );

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
        headers: buildIntakeResponseHeaders(requestId),
      });
    } catch (innerError) {
      if (innerError instanceof StaffAuthorizationError) {
        return jsonError(
          innerError.statusCode,
          innerError.errorCode,
          innerError.message,
          { requestId },
        );
      }
      throw innerError;
    }
  } catch (error) {
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
