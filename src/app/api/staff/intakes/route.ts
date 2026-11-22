import type { NextRequest } from "next/server";
import { handleStaffQueueGet } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff/intakes
 * Returns the bounded, deterministically ordered intake queue strictly scoped
 * to the authenticated staff member's authorized PostgreSQL facility.
 */
export async function GET(request: NextRequest) {
  return handleStaffQueueGet({
    authorizationHeader: request.headers.get("authorization"),
    cookieHeader: request.headers.get("cookie"),
    searchParams: request.nextUrl.searchParams,
  });
}
