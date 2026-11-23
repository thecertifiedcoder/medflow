import { handleCreatePatientIntakePost } from "../../../lib/api/intake-public-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleCreatePatientIntakePost(request);
}
