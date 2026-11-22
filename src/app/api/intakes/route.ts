import { handleCreatePatientIntakePost } from "../../../lib/api/intake-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleCreatePatientIntakePost(request);
}
