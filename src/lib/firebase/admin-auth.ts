import { getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { firebaseAppletConfig } from "@/lib/firebase/config";

export interface VerifiedStaffToken {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
  readonly authTime: number;
  readonly expiresAt: number;
  readonly projectId: string;
}

export class TokenVerificationError extends Error {
  readonly statusCode: 401 | 403;
  readonly errorCode: string;

  constructor(statusCode: 401 | 403, errorCode: string, message: string) {
    super(message);
    this.name = "TokenVerificationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Extracts a raw JWT from an HTTP Authorization Bearer header.
 * Pure helper so header parsing can be strictly unit-tested without network calls.
 */
export function extractBearerToken(
  authorizationHeader: string | null | undefined,
): string | null {
  if (!authorizationHeader) return null;
  const trimmed = authorizationHeader.trim();
  const match = /^Bearer\s+([^\s]+)$/i.exec(trimmed);
  if (!match) return null;
  const token = match[1]?.trim() ?? "";
  // Firebase ID tokens are compact JWS strings with three dot-separated segments.
  if (token.length < 20 || token.length > 8192 || token.split(".").length !== 3) {
    return null;
  }
  return token;
}

function getAdminAuthApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  // Starter Tier compatible: initialize with projectId ONLY.
  // No service-account credentials and no IAM-dependent Admin Firestore calls.
  return initializeApp({
    projectId: firebaseAppletConfig.projectId,
  });
}

/**
 * Verifies a Firebase ID token signature and claims server-side using Google's
 * public signing certificates (checkRevoked = false; requires no IAM).
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
    const adminApp = getAdminAuthApp();
    decoded = await getAuth(adminApp).verifyIdToken(token, false);
  } catch {
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
