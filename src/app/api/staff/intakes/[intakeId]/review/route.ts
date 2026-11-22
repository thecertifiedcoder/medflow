import type { NextRequest } from "next/server";
import { handleStaffStartReviewPost } from "@/lib/api/staff-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  readonly params: Promise<{ readonly intakeId: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  const { intakeId } = await context.params;
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch {
    body = null;
  }

  return handleStaffStartReviewPost({
    authorizationHeader: request.headers.get("authorization"),
    cookieHeader: request.headers.get("cookie"),
    intakeId,
    body,
  });
}
