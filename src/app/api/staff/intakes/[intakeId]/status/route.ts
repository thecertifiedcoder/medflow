import type { NextRequest } from "next/server";
import { handleStaffStatusPost } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  readonly params: Promise<{ readonly intakeId: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { intakeId } = await context.params;
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  return handleStaffStatusPost({
    authorizationHeader: request.headers.get("authorization"),
    cookieHeader: request.headers.get("cookie"),
    intakeId,
    body,
  });
}
