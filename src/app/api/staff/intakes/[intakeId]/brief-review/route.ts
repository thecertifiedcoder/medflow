import type { NextRequest } from "next/server";
import { handleStaffBriefReviewPost } from "@/lib/api/staff-handlers";

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

  return handleStaffBriefReviewPost({
    authorizationHeader: request.headers.get("authorization"),
    cookieHeader: request.headers.get("cookie"),
    intakeId,
    body,
  });
}
