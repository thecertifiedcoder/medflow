import { handleTranscribePatientAudioPost } from "../../../../lib/api/intake-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleTranscribePatientAudioPost(request);
}
