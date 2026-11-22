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
    authMode,
    demoPersona,
    firebaseUser,
    staffProfile,
    activeFacility,
    activeFacilityId,
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

  const isAdminRole = activeFacility?.role === "admin";
  const primaryWorkspaceHref = isAdminRole ? "/staff/admin" : "/staff/queue";
  const primaryWorkspaceLabel = isAdminRole
    ? "Open Administrator Workspace"
    : "Open Clinical Staff Queue";

  return (
    <ClinicalPanel
      source="nurse"
      sourceLabel="Staff authentication"
      title="Google Sign-In for provisioned staff"
      subtitle="Server-side Firebase ID token verification · PostgreSQL facility RBAC"
      action={
        <Badge
          tone={status === "authorized" ? "success" : "brand"}
          icon={status === "authorized" ? "checkCircle" : "lock"}
        >
          {status === "authorized" ? "Authorized staff" : "Facility-scoped"}
        </Badge>
      }
    >
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
            Checking whether a clinical staff session or Google sign-in callback
            is active in this browser...
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
          Verifying your Firebase ID token on the server and resolving your
          provisioned staff profile and facility membership...
        </Alert>
      )}

      {status === "unauthenticated" && (
        <div className="grid gap-4">
          <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
            Sign in with your Google account. MedFlow verifies your Firebase ID
            token on the server and checks your active clinical role and
            facility membership in PostgreSQL before granting access to any
            workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              loading={isSigningIn}
              onClick={() => void signInWithGoogle()}
              disabled={isSigningIn}
              data-testid="google-signin-btn"
            >
              {!isSigningIn ? <Icon name="lock" size="btn" /> : null}
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
              Back to Home
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
            title="Authenticated, but not provisioned as facility staff"
          >
            Google Sign-In and server-side ID token verification succeeded, but
            no provisioned staff profile exists in MedFlow&apos;s PostgreSQL
            database for this account. Authentication alone never grants access
            to clinical records.
          </Alert>
          <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
            <p className="mf-t-label m-0 mb-2 font-semibold text-[var(--mf-text)]">
              Verified Google identity (for administrator CLI provisioning)
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
            <ButtonLink href="/demo" variant="secondary" size="md">
              Use Hackathon Demo Access
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

      {status === "inactive" && (
        <div className="grid gap-3">
          <Alert tone="danger" title="Staff profile is inactive">
            Your provisioned staff profile is marked inactive or has no active
            facility memberships.
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

      {status === "authorized" && staffProfile && activeFacility && (
        <div className="grid gap-4">
          <Alert
            tone="success"
            title={
              authMode === "demo"
                ? "Hackathon Demo session active"
                : "Staff session verified"
            }
          >
            Signed in as <strong>{staffProfile.displayName}</strong> (role:{" "}
            <strong className="uppercase">{activeFacility.role}</strong>) with{" "}
            {authMode === "demo"
              ? `server-signed HTTP-only demo session (${demoPersona === "admin" ? "Demo Administrator" : "Demo Clinical Staff"})`
              : "server-verified Firebase ID token"}{" "}
            and authorized access to{" "}
            <strong>{activeFacility.facilityName}</strong> (
            <code className="mf-mono text-[13px]">{activeFacilityId}</code>).
          </Alert>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={primaryWorkspaceHref} variant="primary" size="md">
              {primaryWorkspaceLabel}
              <Icon name="arrow" size="btn" />
            </ButtonLink>
            {isAdminRole && (
              <ButtonLink href="/staff/queue" variant="secondary" size="md">
                Open Clinical Queue
              </ButtonLink>
            )}
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
                {!isSigningIn ? <Icon name="lock" size="btn" /> : null}
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
