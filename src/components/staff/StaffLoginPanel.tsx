"use client";

import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
} from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function StaffLoginPanel() {
  const {
    status,
    firebaseUser,
    staffProfile,
    activeFacilityId,
    connectionReachable,
    errorMessage,
    authNotice,
    authDiagnostics,
    preferredSignInMethod,
    canUseRedirectFallback,
    suggestOpenInStandaloneTab,
    isSigningIn,
    signInWithGoogle,
    signInWithGooglePopup,
    signInWithGoogleRedirect,
    cancelSignInAttempt,
    signOutStaff,
    refreshAuthorization,
  } = useStaffAuth();

  return (
    <ClinicalPanel
      source="nurse"
      sourceLabel="Staff portal"
      title="Staff sign in"
      subtitle="Google Sign-In · Server ID token verification · Provisioned facility membership"
      action={
        <Badge
          tone={status === "authorized" ? "success" : "brand"}
          icon={status === "authorized" ? "checkCircle" : "lock"}
        >
          {status === "authorized" ? "Authorized staff" : "Facility-scoped"}
        </Badge>
      }
    >
      {connectionReachable === false && (
        <Alert tone="danger" title="Firestore connection unavailable">
          The client could not reach Firestore. Check your network connection or
          Firebase configuration before signing in.
        </Alert>
      )}

      {errorMessage && (
        <Alert tone="danger" title="Authentication notice">
          {errorMessage}
        </Alert>
      )}

      {authNotice && !errorMessage && (
        <Alert tone="info" title="Sign-in status">
          {authNotice}
        </Alert>
      )}

      {authDiagnostics.lastErrorCode &&
        (status === "error" || status === "unauthenticated") && (
          <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
            <p className="mf-t-label m-0 mb-2 font-semibold text-[var(--mf-text)]">
              Authentication diagnostic details (non-secret)
            </p>
            <dl className="mf-dl m-0">
              <dt>Firebase error code</dt>
              <dd className="mf-mono text-[13px]">
                {authDiagnostics.lastErrorCode}
              </dd>
              <dt>Browser context</dt>
              <dd className="mf-mono text-[13px]">
                {authDiagnostics.isEmbeddedIframe
                  ? "Embedded iframe"
                  : "Standalone tab"}{" "}
                · {authDiagnostics.isMobileBrowser ? "Mobile" : "Desktop"} ·{" "}
                {preferredSignInMethod === "redirect"
                  ? "Redirect flow"
                  : "Popup flow"}
              </dd>
              <dt>Redirect result</dt>
              <dd className="mf-mono text-[13px]">
                {authDiagnostics.redirectResultState}
              </dd>
              <dt>Origin / Auth domain</dt>
              <dd className="mf-mono break-all text-[13px]">
                {authDiagnostics.currentHost ?? "Unavailable"} →{" "}
                {authDiagnostics.authDomain}
                {authDiagnostics.usesSameOriginProxy
                  ? " (same-origin proxy)"
                  : ""}
              </dd>
            </dl>
          </div>
        )}

      {status === "initializing" && (
        <div className="grid gap-3">
          <Alert
            tone="info"
            icon="loader"
            iconSpin
            title="Checking authentication state"
          >
            Checking whether a Firebase clinical staff session or Google
            sign-in callback is active in this browser...
          </Alert>
        </div>
      )}

      {status === "authenticating" && (
        <div className="grid gap-4">
          <Alert
            tone="info"
            icon="loader"
            iconSpin
            title="Signing in with Google"
          >
            {preferredSignInMethod === "redirect"
              ? "Continuing to Google Sign-In. You will return here automatically once Google authentication completes."
              : "Complete Google authentication in the sign-in window. If your browser blocked or closed the window without returning a session, cancel and retry or use redirect sign-in."}
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md" loading disabled>
              {preferredSignInMethod === "redirect"
                ? "Redirecting to Google..."
                : "Waiting for Google Sign-In..."}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={cancelSignInAttempt}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === "verifying" && (
        <Alert tone="info" icon="loader" iconSpin title="Verifying session">
          Verifying your Firebase ID token signature on the server and reading
          your provisioned staff profile...
        </Alert>
      )}

      {status === "unauthenticated" && (
        <div className="grid gap-4">
          <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
            Sign in with your Google account. MedFlow verifies your Firebase ID
            token on the server and checks for an active provisioned record in{" "}
            <code className="mf-mono text-[13px] text-[var(--mf-text)]">
              staff/&#123;uid&#125;
            </code>{" "}
            before granting access to any facility queue.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              loading={isSigningIn}
              onClick={() => void signInWithGoogle()}
              disabled={isSigningIn}
            >
              {!isSigningIn ? <Icon name="shield" size="btn" /> : null}
              {isSigningIn
                ? preferredSignInMethod === "redirect"
                  ? "Redirecting to Google..."
                  : "Opening Google Sign-In..."
                : "Sign in with Google"}
            </Button>
            {canUseRedirectFallback && preferredSignInMethod !== "redirect" && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => void signInWithGoogleRedirect()}
                disabled={isSigningIn}
              >
                Use redirect sign-in
              </Button>
            )}
            <ButtonLink href="/" variant="secondary" size="md">
              <Icon name="arrowLeft" size="btn" />
              Back to overview
            </ButtonLink>
          </div>
        </div>
      )}

      {status === "unverified_email" && (
        <div className="grid gap-3">
          <Alert tone="danger" title="Verified email address required">
            Your Google account email is not verified. Only verified emails can
            access clinical staff surfaces.
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}

      {status === "unprovisioned" && firebaseUser && (
        <div className="grid gap-3">
          <Alert
            tone="warning"
            title="Authenticated, but not provisioned as clinical staff"
          >
            Google Sign-In and server-side ID token verification succeeded, but
            no provisioned document exists at{" "}
            <code className="mf-mono text-[13px]">
              staff/{firebaseUser.uid}
            </code>
            . No queue or patient records are accessible until an administrator
            provisions your profile in the Firebase Console.
          </Alert>
          <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
            <p className="mf-t-label m-0 mb-2 font-semibold text-[var(--mf-text)]">
              Verified Google identity
            </p>
            <dl className="mf-dl m-0">
              <dt>UID</dt>
              <dd className="mf-mono break-all text-[13px]">
                {firebaseUser.uid}
              </dd>
              <dt>Email</dt>
              <dd className="mf-mono text-[13px]">
                {firebaseUser.email ?? "Unavailable"}
              </dd>
            </dl>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => void refreshAuthorization()}
            >
              Re-check staff provisioning
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}

      {status === "inactive" && (
        <div className="grid gap-3">
          <Alert tone="danger" title="Staff profile is inactive">
            Your provisioned staff profile is marked inactive or has no
            authorised facility assignments.
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}

      {status === "authorized" && staffProfile && (
        <div className="grid gap-3">
          <Alert tone="success" title="Staff session verified">
            Signed in as <strong>{staffProfile.displayName}</strong> (
            <span className="capitalize">{staffProfile.role}</span>) with
            server-verified ID token and authorised access to facility{" "}
            <code className="mf-mono text-[13px]">{activeFacilityId}</code>.
          </Alert>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/staff/queue" variant="primary" size="md">
              Open staff queue
              <Icon name="arrow" size="btn" />
            </ButtonLink>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-wrap gap-3">
          {firebaseUser ? (
            <>
              <Button
                variant="primary"
                size="md"
                onClick={() => void refreshAuthorization()}
              >
                <Icon name="refresh" size="btn" />
                Retry verification
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void signOutStaff()}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              {suggestOpenInStandaloneTab && (
                <Link
                  href="/staff/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mf-btn mf-btn--primary mf-btn--md"
                >
                  <Icon name="arrow" size="btn" />
                  Open sign-in in full browser tab
                </Link>
              )}
              <Button
                variant={suggestOpenInStandaloneTab ? "secondary" : "primary"}
                size="md"
                loading={isSigningIn}
                onClick={() => void signInWithGoogle()}
                disabled={isSigningIn}
              >
                {!isSigningIn ? <Icon name="shield" size="btn" /> : null}
                Sign in with Google
              </Button>
              {preferredSignInMethod === "redirect" ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void signInWithGooglePopup()}
                  disabled={isSigningIn}
                >
                  Try popup sign-in
                </Button>
              ) : (
                canUseRedirectFallback && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void signInWithGoogleRedirect()}
                    disabled={isSigningIn}
                  >
                    Use redirect sign-in
                  </Button>
                )
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={() => void refreshAuthorization()}
              >
                <Icon name="refresh" size="btn" />
                Retry session check
              </Button>
            </>
          )}
        </div>
      )}
    </ClinicalPanel>
  );
}
