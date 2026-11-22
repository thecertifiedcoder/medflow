import type { NextRequest } from "next/server";
import { handleDemoStatusGet } from "@/lib/api/demo-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/demo/status
 * Reports non-secret server-evaluated Hackathon Demo Mode availability
 * and whether the caller holds an active verified demo session cookie.
 */
export function GET(request: NextRequest) {
  return handleDemoStatusGet(
    {},
    { cookieHeader: request.headers.get("cookie") },
  );
}
