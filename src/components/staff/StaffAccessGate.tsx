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
import type {
  AuthorizedFacilityMembership,
  PostgresStaffSessionResponse,
  ResolvedStaffProfile,
} from "@/lib/schemas/staff-api";

export interface AuthorizedStaffContext {
  readonly staffProfile: ResolvedStaffProfile;
  readonly serverSession: PostgresStaffSessionResponse;
  readonly activeFacility: AuthorizedFacilityMembership;
  readonly activeFacilityId: string;
  readonly getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  readonly handleSessionExpired: (message?: string) => void;
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
    activeFacility,
    activeFacilityId,
    errorMessage,
    getIdToken,
    handleSessionExpired,
    signOutStaff,
    refreshAuthorization,
  } = useStaffAuth();

  if (
    status === "initializing" ||
    status === "authenticating" ||
    status === "verifying"
  ) {
    return (
      <PageContainer width="narrow">
        <div className="mb-6 grid gap-1.5">
          <span className="mf-eyebrow">Protected facility workspace</span>
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
            status === "initializing"
              ? "Checking staff session"
              : status === "authenticating"
                ? "Completing Google Sign-In"
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
              {status === "initializing"
                ? "Checking whether an active clinical workspace session is available..."
                : status === "authenticating"
                  ? "Completing sign-in before verifying clinical staff authorization..."
                  : "Verifying clinical workspace authorization..."}
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
    activeFacility &&
    activeFacilityId
  ) {
    return (
      <>
        {children({
          staffProfile,
          serverSession,
          activeFacility,
          activeFacilityId,
          getIdToken,
          handleSessionExpired,
        })}
      </>
    );
  }

  return (
    <PageContainer width="narrow">
      <div className="mb-6 grid gap-1.5">
        <span className="mf-eyebrow">Protected facility workspace</span>
        <h1 className="mf-t-page m-0 text-[var(--mf-text)]">{surfaceTitle}</h1>
        <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
          {surfaceSubtitle}
        </p>
      </div>

      <ClinicalPanel
        source="nurse"
        sourceLabel="Restricted surface"
        title="Staff authentication required"
        subtitle="Server-verified identity and active PostgreSQL facility membership required"
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
          <Alert tone="danger" title="Clinical workspace access required">
            {errorMessage ??
              "Please open Judge Access to start a verified clinical staff session before viewing the patient queue."}
          </Alert>
        )}

        {status === "unverified_email" && (
          <Alert tone="danger" title="Verified email required">
            Your account email is not marked verified. Clinical staff
            authorization requires a verified email address.
          </Alert>
        )}

        {status === "unprovisioned" && firebaseUser && (
          <Alert
            tone="warning"
            title="Staff access is not provisioned for this account"
          >
            Use Judge Access to explore the clinical workspace with the
            demonstration clinical staff session.
          </Alert>
        )}

        {status === "inactive" && (
          <Alert tone="danger" title="Staff profile inactive">
            This staff profile is currently inactive. Use Judge Access to enter
            the demonstration clinical workspace.
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
            <ButtonLink href="/demo" variant="primary" size="md">
              <Icon name="shieldCheck" size="btn" />
              Judge Access
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
              <ButtonLink href="/demo" variant="secondary" size="md">
                Judge Access
              </ButtonLink>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void signOutStaff()}
              >
                Sign out
              </Button>
            </>
          )}
          <ButtonLink href="/" variant="tertiary" size="md">
            Return to Home
          </ButtonLink>
        </div>
      </ClinicalPanel>
    </PageContainer>
  );
}
