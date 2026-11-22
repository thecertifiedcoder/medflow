import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../../next.config";
import {
  classifyRedirectResultError,
  classifySignInError,
  deriveProfileAuthorizationStatus,
  extractFirebaseAuthErrorCode,
  isEmbeddedInIframe,
  isMobileUserAgent,
  resolveEffectiveAuthDomain,
  sanitizeNonSecretAuthMessage,
  selectPreferredSignInMethod,
} from "./auth-state";

test("resolveEffectiveAuthDomain enables same-origin proxy on HTTPS AI Studio Preview hosts and keeps configured authDomain on localhost", () => {
  const configured = "daring-brace-jw1xt.firebaseapp.com";

  assert.deepEqual(
    resolveEffectiveAuthDomain({
      configuredAuthDomain: configured,
      currentHost:
        "ais-dev-gmahvotzwtenj4bz7g2nen-169572861177.europe-west3.run.app",
      currentProtocol: "https:",
    }),
    {
      authDomain:
        "ais-dev-gmahvotzwtenj4bz7g2nen-169572861177.europe-west3.run.app",
      usesSameOriginProxy: true,
    },
  );

  assert.deepEqual(
    resolveEffectiveAuthDomain({
      configuredAuthDomain: configured,
      currentHost:
        "ais-mob-gmahvotzwtenj4bz7g2nen-169572861177.europe-west3.run.app",
      currentProtocol: "https:",
    }),
    {
      authDomain:
        "ais-mob-gmahvotzwtenj4bz7g2nen-169572861177.europe-west3.run.app",
      usesSameOriginProxy: true,
    },
  );

  assert.deepEqual(
    resolveEffectiveAuthDomain({
      configuredAuthDomain: configured,
      currentHost: "localhost:3000",
      currentProtocol: "http:",
    }),
    {
      authDomain: configured,
      usesSameOriginProxy: false,
    },
  );

  assert.deepEqual(
    resolveEffectiveAuthDomain({
      configuredAuthDomain: configured,
      currentHost: "custom-unregistered.example.com",
      currentProtocol: "https:",
    }),
    {
      authDomain: configured,
      usesSameOriginProxy: false,
    },
  );

  assert.deepEqual(
    resolveEffectiveAuthDomain({
      configuredAuthDomain: configured,
      currentHost: "custom-registered.example.com",
      currentProtocol: "https:",
      forceSameOrigin: true,
    }),
    {
      authDomain: "custom-registered.example.com",
      usesSameOriginProxy: true,
    },
  );
});

test("selectPreferredSignInMethod chooses redirect on standalone mobile with same-origin proxy and popup on desktop or embedded iframe", () => {
  assert.equal(
    selectPreferredSignInMethod({
      isEmbeddedIframe: false,
      isMobileBrowser: true,
      usesSameOriginProxy: true,
    }),
    "redirect",
  );

  assert.equal(
    selectPreferredSignInMethod({
      isEmbeddedIframe: true,
      isMobileBrowser: true,
      usesSameOriginProxy: true,
    }),
    "popup",
  );

  assert.equal(
    selectPreferredSignInMethod({
      isEmbeddedIframe: false,
      isMobileBrowser: false,
      usesSameOriginProxy: true,
    }),
    "popup",
  );

  assert.equal(
    selectPreferredSignInMethod({
      isEmbeddedIframe: false,
      isMobileBrowser: true,
      usesSameOriginProxy: false,
    }),
    "popup",
  );
});

test("extractFirebaseAuthErrorCode extracts Firebase auth codes safely", () => {
  assert.equal(
    extractFirebaseAuthErrorCode({ code: "auth/popup-blocked" }),
    "auth/popup-blocked",
  );
  assert.equal(extractFirebaseAuthErrorCode(new Error("boom")), "auth/unknown");
  assert.equal(extractFirebaseAuthErrorCode(null), "auth/unknown");
});

test("sanitizeNonSecretAuthMessage strips URLs and token-like substrings", () => {
  const err = new Error(
    "Auth failed at https://accounts.google.com/?id_token=secret with eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue12345",
  );
  const sanitized = sanitizeNonSecretAuthMessage(err);
  assert.ok(sanitized);
  assert.doesNotMatch(sanitized, /accounts\.google\.com|eyJhbGci/);
  assert.match(sanitized, /\[url-redacted\]/);
  assert.match(sanitized, /\[token-redacted\]/);
});

test("classifySignInError does not misclassify embedded-iframe or mobile popup-closed-by-user as user cancellation", () => {
  const embeddedClosed = classifySignInError(
    { code: "auth/popup-closed-by-user" },
    { isEmbeddedIframe: true, isMobileBrowser: true },
  );
  assert.equal(embeddedClosed.code, "auth/popup-closed-by-user");
  assert.equal(embeddedClosed.isCancellation, false);
  assert.equal(embeddedClosed.nextStatus, "error");
  assert.equal(embeddedClosed.suggestOpenInStandaloneTab, true);
  assert.match(embeddedClosed.message, /auth\/popup-closed-by-user/);
  assert.match(embeddedClosed.message, /full browser tab/i);

  const mobileStandaloneClosed = classifySignInError(
    { code: "auth/popup-closed-by-user" },
    { isEmbeddedIframe: false, isMobileBrowser: true },
  );
  assert.equal(mobileStandaloneClosed.isCancellation, false);
  assert.equal(mobileStandaloneClosed.nextStatus, "error");
  assert.equal(mobileStandaloneClosed.canOfferRedirectFallback, true);
  assert.match(mobileStandaloneClosed.message, /auth\/popup-closed-by-user/);

  const desktopClosed = classifySignInError(
    { code: "auth/popup-closed-by-user" },
    { isEmbeddedIframe: false, isMobileBrowser: false },
  );
  assert.equal(desktopClosed.isCancellation, true);
  assert.equal(desktopClosed.nextStatus, "unauthenticated");
  assert.match(desktopClosed.message, /auth\/popup-closed-by-user/);

  const superseded = classifySignInError(
    { code: "auth/cancelled-popup-request" },
    { isEmbeddedIframe: true, isMobileBrowser: true },
  );
  assert.equal(superseded.isCancellation, true);
  assert.equal(superseded.nextStatus, "unauthenticated");
  assert.match(superseded.message, /auth\/cancelled-popup-request/);
});

test("classifySignInError auto-falls back to redirect outside iframes when popup is blocked", () => {
  const standaloneBlocked = classifySignInError(
    { code: "auth/popup-blocked" },
    { isEmbeddedIframe: false },
  );
  assert.equal(standaloneBlocked.shouldAutoFallbackToRedirect, true);
  assert.equal(standaloneBlocked.canOfferRedirectFallback, true);
  assert.equal(standaloneBlocked.nextStatus, "authenticating");

  const embeddedBlocked = classifySignInError(
    { code: "auth/popup-blocked" },
    { isEmbeddedIframe: true },
  );
  assert.equal(embeddedBlocked.shouldAutoFallbackToRedirect, false);
  assert.equal(embeddedBlocked.suggestOpenInStandaloneTab, true);
  assert.equal(embeddedBlocked.nextStatus, "error");
  assert.match(embeddedBlocked.message, /full browser tab/i);
});

test("classifyRedirectResultError handles redirect cancellation and domain/storage errors", () => {
  const cancelled = classifyRedirectResultError({
    code: "auth/redirect-cancelled-by-user",
  });
  assert.equal(cancelled.isCancellation, true);
  assert.match(cancelled.message, /auth\/redirect-cancelled-by-user/);

  const domainErr = classifyRedirectResultError({
    code: "auth/unauthorized-domain",
  });
  assert.equal(domainErr.isCancellation, false);
  assert.match(domainErr.message, /auth\/unauthorized-domain/);

  const storageErr = classifyRedirectResultError({
    code: "auth/web-storage-unsupported",
  });
  assert.equal(storageErr.isCancellation, false);
  assert.match(storageErr.message, /full browser tab/i);
});

test("isEmbeddedInIframe and isMobileUserAgent detect frame and mobile contexts accurately", () => {
  const sameWindow = {};
  assert.equal(
    isEmbeddedInIframe({ self: sameWindow, top: sameWindow }),
    false,
  );
  assert.equal(isEmbeddedInIframe({ self: {}, top: {} }), true);

  const crossOriginWindow = {
    self: {},
    get top() {
      throw new Error("SecurityError: Blocked a frame with origin");
    },
  };
  assert.equal(isEmbeddedInIframe(crossOriginWindow), true);

  assert.equal(
    isMobileUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
  assert.equal(
    isMobileUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    ),
    false,
  );
});

test("deriveProfileAuthorizationStatus distinguishes authorized, inactive, and UID mismatch", () => {
  const activeProfile = {
    uid: "staff-uid-01",
    email: "nurse@example.com",
    displayName: "Nurse Synthetic",
    role: "nurse" as const,
    facilityIds: ["demo-clinic-01", "demo-clinic-02"],
    active: true,
  };

  assert.deepEqual(
    deriveProfileAuthorizationStatus(activeProfile, "staff-uid-01", null),
    {
      status: "authorized",
      activeFacilityId: "demo-clinic-01",
      errorMessage: null,
    },
  );

  assert.deepEqual(
    deriveProfileAuthorizationStatus(
      activeProfile,
      "staff-uid-01",
      "demo-clinic-02",
    ),
    {
      status: "authorized",
      activeFacilityId: "demo-clinic-02",
      errorMessage: null,
    },
  );

  const inactive = deriveProfileAuthorizationStatus(
    { ...activeProfile, active: false },
    "staff-uid-01",
    null,
  );
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.activeFacilityId, null);

  const mismatched = deriveProfileAuthorizationStatus(
    activeProfile,
    "other-uid",
    null,
  );
  assert.equal(mismatched.status, "error");
});

test("next.config.ts configures **.run.app allowedDevOrigins, /__/auth/* proxy rewrites, and COOP header", async () => {
  assert.ok(Array.isArray(nextConfig.allowedDevOrigins));
  assert.ok(nextConfig.allowedDevOrigins.includes("**.run.app"));

  assert.equal(typeof nextConfig.rewrites, "function");
  const rewrites = await nextConfig.rewrites!();
  assert.ok(Array.isArray(rewrites));
  const authRewrite = rewrites.find((r) => r.source === "/__/auth/:path*");
  assert.ok(authRewrite, "Expected /__/auth/:path* rewrite");
  assert.match(
    authRewrite.destination,
    /^https:\/\/daring-brace-jw1xt\.firebaseapp\.com\/__\/auth\/:path\*$/,
  );

  assert.equal(typeof nextConfig.headers, "function");
  const headerRules = await nextConfig.headers!();
  const staffRule = headerRules.find((r) => r.source === "/staff/:path*");
  assert.ok(staffRule, "Expected header rule for /staff/:path*");
  const coopHeader = staffRule.headers.find(
    (h) => h.key === "Cross-Origin-Opener-Policy",
  );
  assert.equal(coopHeader?.value, "same-origin-allow-popups");
});
