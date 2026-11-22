"use client";

import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
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
        <div className="mb-6 grid gap-1.5">
          <span className="mf-eyebrow">Protected clinical surface</span>
          <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
            {surfaceTitle}
          </h1>
          <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
            {surfaceSubtitle}
          </p>
        </div>

        <ClinicalPanel
          source="nurse"
          sourceLabel="Session check"
          title={
            status === "loading"
              ? "Checking staff session"
              : "Verifying clinical authorization"
          }
        >
          <div className="flex items-start gap-3">
            <Icon
              name="loader"
              size="md"
              spin
              className="mt-0.5 text-[var(--mf-primary-dark)]"
            />
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Validating Firebase ID token signature on the server and checking
              provisioned facility membership in Firestore.
            </p>
          </div>
        </ClinicalPanel>
      </PageContainer>
    );
  }

  if (
    status === "authorized" &&
    staffProfile &&
    serverSession &&
    activeFacilityId
  ) {
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
      <div className="mb-6 grid gap-1.5">
        <span className="mf-eyebrow">Protected clinical surface</span>
        <h1 className="mf-t-page m-0 text-[var(--mf-text)]">{surfaceTitle}</h1>
        <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
          {surfaceSubtitle}
        </p>
      </div>

      <ClinicalPanel
        source="nurse"
        sourceLabel="Restricted surface"
        title="Access verification status"
        subtitle="Server-verified ID token and provisioned facility membership required"
        action={
          status === "unprovisioned" ? (
            <Badge tone="warning" icon="shield">
              Not provisioned
            </Badge>
          ) : status === "inactive" ? (
            <Badge tone="danger" icon="lock">
              Account inactive
            </Badge>
          ) : (
            <Badge tone="danger" icon="lock">
              Restricted
            </Badge>
          )
        }
      >
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
            <Alert
              tone="warning"
              title="Sign-in succeeded, but staff access is not provisioned"
            >
              Google Sign-In and server ID token verification succeeded, but no
              provisioned profile exists at{" "}
              <code className="mf-mono text-[13px]">
                staff/{firebaseUser.uid}
              </code>
              . Authentication alone never grants clinical access.
            </Alert>
            <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
              <p className="mf-t-label m-0 mb-2 font-semibold text-[var(--mf-text)]">
                Signed-in identity (for administrator provisioning)
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

        <div className="flex flex-wrap gap-3 pt-1">
          {status === "unauthenticated" ? (
            <ButtonLink href="/staff/login" variant="primary" size="md">
              Go to staff sign in
              <Icon name="arrow" size="btn" />
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
      </ClinicalPanel>
    </PageContainer>
  );
}
