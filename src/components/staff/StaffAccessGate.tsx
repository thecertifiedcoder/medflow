"use client";

import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
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
import type { StaffProfile, StaffSessionResponse } from "@/lib/schemas/staff";

export interface AuthorizedStaffContext {
  readonly staffProfile: StaffProfile;
  readonly serverSession: StaffSessionResponse;
  readonly activeFacilityId: string;
}

interface StaffAccessGateProps {
  readonly surfaceTitle: string;
  readonly surfaceSubtitle: string;
  readonly children: (context: AuthorizedStaffContext) => ReactNode;
}

export function StaffAccessGate({
  surfaceTitle,
  surfaceSubtitle,
  children,
}: StaffAccessGateProps) {
  const {
    status,
    firebaseUser,
    serverSession,
    staffProfile,
    activeFacilityId,
    errorMessage,
    signOutStaff,
    refreshAuthorization,
  } = useStaffAuth();

  if (status === "loading" || status === "verifying") {
    return (
      <PageContainer width="narrow">
        <Card>
          <CardBody className="grid gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--mf-brand-soft)] text-[var(--mf-brand)]">
                <Icon name="shield" size="md" />
              </span>
              <div>
                <h1 className="m-0 text-[18px] font-bold text-[var(--mf-ink)]">
                  {status === "loading"
                    ? "Checking staff session"
                    : "Verifying clinical authorization"}
                </h1>
                <p className="m-0 text-[12px] text-[var(--mf-muted)]">
                  {surfaceSubtitle}
                </p>
              </div>
            </div>
            <p className="m-0 text-[13px] text-[var(--mf-muted)]">
              Validating Firebase ID token signature on the server and checking
              provisioned facility membership in Firestore.
            </p>
          </CardBody>
        </Card>
      </PageContainer>
    );
  }

  if (status === "authorized" && staffProfile && serverSession && activeFacilityId) {
    return (
      <>
        {children({
          staffProfile,
          serverSession,
          activeFacilityId,
        })}
      </>
    );
  }

  return (
    <PageContainer width="narrow">
      <Card>
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--mf-danger-soft)] text-[var(--mf-danger)]">
                <Icon name="lock" size="md" />
              </span>
              <div>
                <h1 className="m-0 text-[18px] font-bold text-[var(--mf-ink)]">
                  {surfaceTitle}
                </h1>
                <p className="m-0 text-[12px] text-[var(--mf-muted)]">
                  {surfaceSubtitle}
                </p>
              </div>
            </div>
            {status === "unprovisioned" ? (
              <Badge tone="warning">Not provisioned</Badge>
            ) : status === "inactive" ? (
              <Badge tone="danger">Account inactive</Badge>
            ) : (
              <Badge tone="danger">Restricted</Badge>
            )}
          </div>

          {status === "unauthenticated" && (
            <Alert tone="danger" title="Staff authentication required">
              Unauthenticated users cannot view clinical intake records or the
              facility queue. Sign in with a provisioned Google staff account to
              continue.
            </Alert>
          )}

          {status === "unverified_email" && (
            <Alert tone="danger" title="Verified email required">
              Your Google account email is not marked verified. Clinical staff
              authorization requires a verified email address.
            </Alert>
          )}

          {status === "unprovisioned" && firebaseUser && (
            <div className="grid gap-3">
              <Alert tone="warning" title="Sign-in succeeded, but staff access is not provisioned">
                Google Sign-In and server ID token verification succeeded, but
                no provisioned profile exists at{" "}
                <code className="mf-mono text-[12px]">
                  staff/{firebaseUser.uid}
                </code>
                . Authentication alone never grants clinical access.
              </Alert>
              <div className="rounded-[12px] border border-[var(--mf-line)] bg-[var(--mf-surface-soft)] p-3.5 text-[12px] text-[var(--mf-muted)]">
                <p className="m-0 mb-1.5 font-semibold text-[var(--mf-ink)]">
                  Signed-in identity (for administrator provisioning)
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
            </div>
          )}

          {status === "inactive" && (
            <Alert tone="danger" title="Staff profile inactive">
              Your staff record is currently inactive or has no assigned
              facilities. Contact a facility administrator to restore access.
            </Alert>
          )}

          {status === "error" && (
            <Alert tone="danger" title="Authorization verification failed">
              {errorMessage ??
                "Unable to verify your clinical staff session right now."}
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            {status === "unauthenticated" ? (
              <ButtonLink href="/staff/login" variant="primary" size="md">
                Go to staff sign in
                <Icon name="arrow" size="sm" />
              </ButtonLink>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void refreshAuthorization()}
                >
                  Re-check authorization
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void signOutStaff()}
                >
                  Sign out
                </Button>
              </>
            )}
            <ButtonLink href="/" variant="secondary" size="md">
              Back to overview
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
