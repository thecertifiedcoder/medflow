import { handleExtractIntakeBriefPost } from "../../../../../lib/api/intake-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ intakeId: string }> },
) {
  const { intakeId } = await context.params;
  return handleExtractIntakeBriefPost(request, { intakeId });
}
