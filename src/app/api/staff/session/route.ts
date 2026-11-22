import type { NextRequest } from "next/server";
import { handleStaffSessionGet } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff/session
 * Verifies the staff caller's Firebase ID token server-side and resolves
 * authoritative staff profile, clinical role, and active facility memberships
 * from Neon PostgreSQL (ADR D-020).
 */
export async function GET(request: NextRequest) {
  return handleStaffSessionGet({
    authorizationHeader: request.headers.get("authorization"),
    searchParams: request.nextUrl.searchParams,
  });
}
