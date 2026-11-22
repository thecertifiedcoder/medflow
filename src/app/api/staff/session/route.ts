import { NextRequest, NextResponse } from "next/server";
import {
  TokenVerificationError,
  verifyStaffBearerToken,
} from "@/lib/firebase/admin-auth";
import { jsonError } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies a staff caller's Firebase ID token signature and email verification
 * claim on the server (no IAM required on Starter Tier).
 * Facility membership and active clinical role are enforced by hardened
 * Firestore Security Rules against /staff/{uid}.
 */
export async function GET(request: NextRequest) {
  try {
    const verified = await verifyStaffBearerToken(
      request.headers.get("authorization"),
    );

    return NextResponse.json(
      {
        authenticated: true,
        verifiedByServer: true,
        projectId: verified.projectId,
        authorizationModel: "starter_tier_firestore_rules",
        user: {
          uid: verified.uid,
          email: verified.email,
          emailVerified: verified.emailVerified,
          displayName: verified.displayName,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      return jsonError(error.statusCode, error.errorCode, error.message);
    }

    return jsonError(
      500,
      "SESSION_VERIFICATION_UNAVAILABLE",
      "Unable to verify staff authentication session.",
    );
  }
}
