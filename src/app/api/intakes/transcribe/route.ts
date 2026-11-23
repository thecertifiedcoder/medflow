import { handleTranscribePatientAudioPost } from "../../../../lib/api/intake-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleTranscribePatientAudioPost(request);
}
