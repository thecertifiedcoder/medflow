import type { NextRequest } from "next/server";
import { handleStaffAdminFacilityGet } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff/admin/facility
 * Read-only administrator facility overview strictly gated by `admin` role in
 * PostgreSQL (rejects `nurse` / `doctor` roles with 403 INSUFFICIENT_STAFF_ROLE).
 */
export async function GET(request: NextRequest) {
  return handleStaffAdminFacilityGet({
    authorizationHeader: request.headers.get("authorization"),
    cookieHeader: request.headers.get("cookie"),
    searchParams: request.nextUrl.searchParams,
  });
}
