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
 * Pure helper so header parsing can be strictly unit-tested without loading
 * Firebase Admin SDK or performing network calls.
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

export type VerifyTokenFn = (
  authorizationHeader: string | null | undefined,
) => Promise<VerifiedStaffToken>;

