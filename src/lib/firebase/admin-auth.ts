import type { App } from "firebase-admin/app";
import type { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAppletConfig } from "@/lib/firebase/config";
import {
  extractBearerToken,
  TokenVerificationError,
  type VerifiedStaffToken,
} from "@/lib/firebase/token-types";

export {
  extractBearerToken,
  TokenVerificationError,
  type VerifiedStaffToken,
};

/**
 * Verifies a Firebase ID token signature and claims server-side using Google's
 * public signing certificates (checkRevoked = false; requires no IAM).
 * Loads firebase-admin lazily so routes that never verify Firebase ID tokens
 * (or serve Hackathon Demo Mode cookies) never fail on firebase-admin module init.
 */
export async function verifyStaffBearerToken(
  authorizationHeader: string | null | undefined,
): Promise<VerifiedStaffToken> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    throw new TokenVerificationError(
      401,
      "MISSING_OR_INVALID_AUTH_HEADER",
      "A valid Authorization Bearer token is required.",
    );
  }

  let decoded: DecodedIdToken;
  try {
    const [{ getApp, getApps, initializeApp }, { getAuth }] =
      await Promise.all([
        import("firebase-admin/app"),
        import("firebase-admin/auth"),
      ]);

    const adminApp: App =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            // Starter Tier compatible: initialize with projectId ONLY.
            // No service-account credentials and no IAM-dependent Admin Firestore calls.
            projectId: firebaseAppletConfig.projectId,
          });

    decoded = await getAuth(adminApp).verifyIdToken(token, false);
  } catch (err) {
    const errorName = err instanceof Error ? err.name : typeof err;
    const rawCode = (err as { code?: unknown } | null)?.code;
    const errorCode = typeof rawCode === "string" ? rawCode : null;
    console.warn(
      JSON.stringify({
        scope: "medflow.auth.firebase",
        event: "verify_id_token_failed",
        errorName,
        errorCode,
      }),
    );
    throw new TokenVerificationError(
      401,
      "INVALID_ID_TOKEN",
      "Firebase ID token verification failed or the session has expired.",
    );
  }

  if (decoded.email_verified !== true) {
    throw new TokenVerificationError(
      403,
      "EMAIL_NOT_VERIFIED",
      "A verified email address is required for clinical staff access.",
    );
  }

  return {
    uid: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email : null,
    emailVerified: true,
    displayName: typeof decoded.name === "string" ? decoded.name : null,
    authTime: decoded.auth_time,
    expiresAt: decoded.exp,
    projectId: firebaseAppletConfig.projectId,
  };
}
