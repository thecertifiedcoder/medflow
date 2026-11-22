import type { NextRequest } from "next/server";
import { handleDemoLogoutPost } from "@/lib/api/demo-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo/logout
 * Revokes the active Hackathon Demo Mode session server-side and clears
 * the HTTP-only session cookie.
 */
export async function POST(request: NextRequest) {
  return handleDemoLogoutPost({
    url: request.url,
    cookieHeader: request.headers.get("cookie"),
    csrfHeader: request.headers.get("x-medflow-demo-request"),
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
    hostHeader: request.headers.get("host"),
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
    forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
  });
}
