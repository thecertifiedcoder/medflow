import type { NextRequest } from "next/server";
import { handleStaffIntakeDetailGet } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  readonly params: Promise<{ readonly intakeId: string }>;
}

/**
 * GET /api/staff/intakes/[intakeId]
 * Returns full facility-scoped intake details, immutable patient source,
 * separate AI draft & staff-reviewed copy, current evidence records, and
 * chronological audit timeline from Neon PostgreSQL.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const { intakeId } = await context.params;
  return handleStaffIntakeDetailGet({
    authorizationHeader: request.headers.get("authorization"),
    intakeId,
    searchParams: request.nextUrl.searchParams,
  });
}
