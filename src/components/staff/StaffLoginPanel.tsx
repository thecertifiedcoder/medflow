"use client";

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
    isSigningIn,
    signInWithGoogle,
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

      {(status === "loading" || status === "verifying") && (
        <Alert tone="info" icon="loader" title="Verifying session">
          {status === "loading"
            ? "Checking existing authentication state..."
            : "Verifying Firebase ID token signature on the server and reading your provisioned staff profile..."}
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
              {isSigningIn ? "Opening Google Sign-In..." : "Sign in with Google"}
            </Button>
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
          <Button
            variant="primary"
            size="md"
            onClick={() => void refreshAuthorization()}
          >
            Retry verification
          </Button>
          {firebaseUser ? (
            <Button
              variant="secondary"
              size="md"
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              loading={isSigningIn}
              onClick={() => void signInWithGoogle()}
              disabled={isSigningIn}
            >
              Try Google Sign-In again
            </Button>
          )}
        </div>
      )}
    </ClinicalPanel>
  );
}
