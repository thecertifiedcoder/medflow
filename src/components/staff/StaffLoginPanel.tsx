"use client";

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
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
    <Card>
      <CardBody className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--mf-brand)] text-white">
              <Icon name="lock" size="sm" />
            </span>
            <div>
              <h2 className="m-0 text-[14px] font-bold text-[var(--mf-ink)]">
                Staff sign in
              </h2>
              <p className="m-0 text-[12px] text-[var(--mf-muted)]">
                Google Sign-In + server token verification + provisioned
                facility membership
              </p>
            </div>
          </div>
          <Badge tone={status === "authorized" ? "success" : "brand"}>
            {status === "authorized" ? "Authorized staff" : "Facility-scoped"}
          </Badge>
        </div>

        {connectionReachable === false && (
          <Alert tone="danger" title="Firestore connection unavailable">
            The client could not reach Firestore. Check your network connection
            or Firebase configuration before signing in.
          </Alert>
        )}

        {errorMessage && (
          <Alert tone="danger" title="Authentication notice">
            {errorMessage}
          </Alert>
        )}

        {(status === "loading" || status === "verifying") && (
          <Alert tone="info" title="Verifying session">
            {status === "loading"
              ? "Checking existing authentication state..."
              : "Verifying Firebase ID token signature on the server and reading your provisioned staff profile..."}
          </Alert>
        )}

        {status === "unauthenticated" && (
          <div className="grid gap-3">
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mf-muted)]">
              Sign in with your Google account. MedFlow verifies your Firebase
              ID token on the server and checks for an active provisioned record
              in{" "}
              <code className="mf-mono text-[12px]">staff/&#123;uid&#125;</code>{" "}
              before granting access to any facility queue.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={() => void signInWithGoogle()}
                disabled={isSigningIn}
              >
                <Icon name="shield" size="sm" />
                {isSigningIn ? "Opening Google Sign-In..." : "Sign in with Google"}
              </Button>
              <ButtonLink href="/" variant="secondary" size="md">
                <Icon name="arrow" size="sm" className="rotate-180" />
                Back to overview
              </ButtonLink>
            </div>
          </div>
        )}

        {status === "unverified_email" && (
          <div className="grid gap-3">
            <Alert tone="danger" title="Verified email address required">
              Your Google account email is not verified. Only verified emails
              can access clinical staff surfaces.
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
              Google Sign-In and server-side ID token verification succeeded,
              but no provisioned document exists at{" "}
              <code className="mf-mono text-[12px]">
                staff/{firebaseUser.uid}
              </code>
              . No queue or patient records are accessible until an
              administrator provisions your profile in the Firebase Console.
            </Alert>
            <div className="rounded-[12px] border border-[var(--mf-line)] bg-[var(--mf-surface-soft)] p-3.5 text-[12px] text-[var(--mf-muted)]">
              <p className="m-0 mb-1.5 font-semibold text-[var(--mf-ink)]">
                Verified Google identity
              </p>
              <div className="grid gap-1">
                <div>
                  <span className="font-semibold">UID:</span>{" "}
                  <code className="mf-mono break-all text-[var(--mf-ink)]">
                    {firebaseUser.uid}
                  </code>
                </div>
                <div>
                  <span className="font-semibold">Email:</span>{" "}
                  <code className="mf-mono text-[var(--mf-ink)]">
                    {firebaseUser.email ?? "Unavailable"}
                  </code>
                </div>
              </div>
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
              <code className="mf-mono text-[12px]">{activeFacilityId}</code>.
            </Alert>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/staff/queue" variant="primary" size="md">
                Open staff queue
                <Icon name="arrow" size="sm" />
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
                onClick={() => void signInWithGoogle()}
                disabled={isSigningIn}
              >
                Try Google Sign-In again
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
