import type { NextRequest } from "next/server";
import { handleDemoSessionCreatePost } from "@/lib/api/demo-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo/session/admin
 * Establishes a server-signed HTTP-only session for the fixed synthetic
 * Demo Administrator identity scoped exclusively to `demo-clinic-01`.
 */
export async function POST(request: NextRequest) {
  const rawBodyText = await request.text();
  return handleDemoSessionCreatePost("admin", {
    url: request.url,
    cookieHeader: request.headers.get("cookie"),
    csrfHeader: request.headers.get("x-medflow-demo-request"),
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
    hostHeader: request.headers.get("host"),
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
    forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
    forwardedHeader: request.headers.get("forwarded"),
    rawBodyText,
  });
}
