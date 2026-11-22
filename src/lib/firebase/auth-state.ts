import type { StaffProfile } from "@/lib/schemas/staff";

export type StaffAuthStatus =
  | "initializing"
  | "unauthenticated"
  | "authenticating"
  | "verifying"
  | "unverified_email"
  | "unprovisioned"
  | "inactive"
  | "authorized"
  | "error";

export type RedirectResultState =
  | "pending"
  | "none"
  | "user"
  | "null_after_pending"
  | "error";

export interface AuthDiagnostics {
  readonly lastErrorCode: string | null;
  readonly lastErrorSummary: string | null;
  readonly redirectResultState: RedirectResultState;
  readonly authStateResolved: boolean;
  readonly isEmbeddedIframe: boolean;
  readonly isMobileBrowser: boolean;
  readonly currentHost: string | null;
  readonly authDomain: string;
}

export const AUTH_INIT_TIMEOUT_MS = 8_000;
export const SESSION_VERIFY_TIMEOUT_MS = 12_000;
export const REDIRECT_PENDING_STORAGE_KEY = "medflow_google_redirect_pending";

export interface SignInErrorClassification {
  readonly code: string;
  readonly nextStatus: "unauthenticated" | "authenticating" | "error";
  readonly message: string;
  readonly isCancellation: boolean;
  readonly shouldAutoFallbackToRedirect: boolean;
  readonly canOfferRedirectFallback: boolean;
  readonly suggestOpenInStandaloneTab: boolean;
}

export interface ProfileAuthorizationResult {
  readonly status: "authorized" | "inactive" | "error";
  readonly activeFacilityId: string | null;
  readonly errorMessage: string | null;
}

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export function extractFirebaseAuthErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const raw = (error as { code?: unknown }).code;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return "auth/unknown";
}

/**
 * Produces a strictly non-secret diagnostic summary from a Firebase Auth error.
 * Strips URLs/query params and JWT-like segments so tokens or credentials can
 * never appear in UI diagnostics or console logs.
 */
export function sanitizeNonSecretAuthMessage(error: unknown): string | null {
  if (!(error instanceof Error) || !error.message) return null;
  const cleaned = error.message
    .replace(/https?:\/\/\S+/gi, "[url-redacted]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token-redacted]")
    .replace(/\b(?:ya29|eyJ)[A-Za-z0-9._-]+\b/g, "[token-redacted]")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

export function isEmbeddedInIframe(
  win: { self?: unknown; top?: unknown } | undefined =
    typeof window !== "undefined" ? window : undefined,
): boolean {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    // Accessing window.top throws SecurityError inside cross-origin iframes.
    return true;
  }
}

export function isMobileUserAgent(
  userAgent: string | undefined =
    typeof navigator !== "undefined" ? navigator.userAgent : undefined,
): boolean {
  if (!userAgent) return false;
  return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(userAgent);
}

export function classifySignInError(
  error: unknown,
  options: { isEmbeddedIframe: boolean; isMobileBrowser?: boolean },
): SignInErrorClassification {
  const code = extractFirebaseAuthErrorCode(error);
  const isMobile = options.isMobileBrowser ?? false;

  if (code === "auth/cancelled-popup-request") {
    return {
      code,
      nextStatus: "unauthenticated",
      message:
        "A previous Google Sign-In request was replaced by a newer attempt (auth/cancelled-popup-request). Select Sign in with Google once and wait for the window to complete.",
      isCancellation: true,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: false,
      suggestOpenInStandaloneTab: false,
    };
  }

  if (code === "auth/popup-closed-by-user") {
    // In embedded Preview iframes and modern mobile browsers, Firebase Auth's
    // popup frequently closes after Google OAuth finishes without being able to
    // relay the authEvent back across partitioned third-party storage or a
    // COOP-severed window.opener, causing Firebase SDK to emit
    // auth/popup-closed-by-user even when the user completed sign-in.
    if (options.isEmbeddedIframe) {
      return {
        code,
        nextStatus: "error",
        message:
          "Google Sign-In returned auth/popup-closed-by-user before MedFlow received your session. In an embedded Preview frame, browser storage partitioning and popup isolation often prevent the completed Google popup from returning credentials to the iframe. Open /staff/login in a full browser tab and sign in there.",
        isCancellation: false,
        shouldAutoFallbackToRedirect: false,
        canOfferRedirectFallback: false,
        suggestOpenInStandaloneTab: true,
      };
    }

    if (isMobile) {
      return {
        code,
        nextStatus: "error",
        message:
          "The Google Sign-In window closed before returning a session to MedFlow (auth/popup-closed-by-user). On mobile browsers, cross-origin popup isolation or third-party storage partitioning can drop the completed sign-in event. Retry sign-in, or open this URL directly in Chrome/Safari outside any in-app frame.",
        isCancellation: false,
        shouldAutoFallbackToRedirect: false,
        canOfferRedirectFallback: true,
        suggestOpenInStandaloneTab: false,
      };
    }

    return {
      code,
      nextStatus: "unauthenticated",
      message:
        "The Google Sign-In popup closed before authentication completed (auth/popup-closed-by-user). If you closed the window, select Sign in with Google to try again; if you finished signing in, check whether browser third-party cookie/popup settings blocked the callback.",
      isCancellation: true,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: true,
      suggestOpenInStandaloneTab: false,
    };
  }

  if (POPUP_FALLBACK_CODES.has(code)) {
    if (!options.isEmbeddedIframe) {
      return {
        code,
        nextStatus: "authenticating",
        message: `Your browser blocked or could not complete the Google Sign-In popup (${code}). Switching to page redirect sign-in...`,
        isCancellation: false,
        shouldAutoFallbackToRedirect: true,
        canOfferRedirectFallback: true,
        suggestOpenInStandaloneTab: false,
      };
    }

    return {
      code,
      nextStatus: "error",
      message: `Your browser blocked the Google Sign-In popup inside the Preview frame (${code}). Allow popups or open /staff/login directly in a full browser tab.`,
      isCancellation: false,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: false,
      suggestOpenInStandaloneTab: true,
    };
  }

  if (code === "auth/unauthorized-domain") {
    return {
      code,
      nextStatus: "error",
      message:
        "This Preview domain is not authorized in Firebase Authentication (auth/unauthorized-domain). Verify Firebase Authorized Domains for this URL before signing in.",
      isCancellation: false,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: false,
      suggestOpenInStandaloneTab: false,
    };
  }

  if (code === "auth/network-request-failed") {
    return {
      code,
      nextStatus: "error",
      message:
        "Network connection failed while contacting Google Sign-In (auth/network-request-failed). Check your connection and try again.",
      isCancellation: false,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: false,
      suggestOpenInStandaloneTab: false,
    };
  }

  if (code === "auth/internal-error") {
    return {
      code,
      nextStatus: "error",
      message:
        "Google Sign-In encountered a browser authentication error (auth/internal-error). Open /staff/login in a full browser tab or retry sign-in.",
      isCancellation: false,
      shouldAutoFallbackToRedirect: false,
      canOfferRedirectFallback: !options.isEmbeddedIframe,
      suggestOpenInStandaloneTab: options.isEmbeddedIframe,
    };
  }

  return {
    code,
    nextStatus: "error",
    message: `Google Sign-In could not be completed (${code}). Retry sign-in, or open /staff/login directly in a full browser tab.`,
    isCancellation: false,
    shouldAutoFallbackToRedirect: false,
    canOfferRedirectFallback: !options.isEmbeddedIframe,
    suggestOpenInStandaloneTab: options.isEmbeddedIframe,
  };
}

export function classifyRedirectResultError(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  const code = extractFirebaseAuthErrorCode(error);

  if (code === "auth/unauthorized-domain") {
    return {
      code,
      message:
        "Redirect sign-in could not complete because this domain is not authorized in Firebase Authentication (auth/unauthorized-domain).",
    };
  }

  if (code === "auth/network-request-failed") {
    return {
      code,
      message:
        "Network connection failed while finishing Google redirect sign-in (auth/network-request-failed). Please retry.",
    };
  }

  if (code === "auth/web-storage-unsupported") {
    return {
      code,
      message:
        "This browser blocks storage required for redirect sign-in inside embedded frames (auth/web-storage-unsupported). Open /staff/login in a full browser tab and try again.",
    };
  }

  return {
    code,
    message: `Unable to complete Google redirect sign-in (${code}). Please retry sign-in below or open /staff/login in a full browser tab.`,
  };
}

export function deriveProfileAuthorizationStatus(
  profile: StaffProfile,
  expectedUid: string,
  previousFacilityId: string | null,
): ProfileAuthorizationResult {
  if (profile.uid !== expectedUid) {
    return {
      status: "error",
      activeFacilityId: null,
      errorMessage:
        "Staff profile record UID does not match the authenticated Firebase user.",
    };
  }

  if (!profile.active || profile.facilityIds.length === 0) {
    return {
      status: "inactive",
      activeFacilityId: null,
      errorMessage: null,
    };
  }

  const resolvedFacilityId =
    previousFacilityId && profile.facilityIds.includes(previousFacilityId)
      ? previousFacilityId
      : profile.facilityIds[0] ?? null;

  return {
    status: "authorized",
    activeFacilityId: resolvedFacilityId,
    errorMessage: null,
  };
}
