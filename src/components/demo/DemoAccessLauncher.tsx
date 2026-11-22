"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
} from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import type { DemoPersona } from "@/lib/schemas/staff-api";

export interface DemoAccessLauncherProps {
  readonly demoModeEnabled: boolean;
  readonly demoModeReady: boolean;
  readonly facilityPublicCode: string;
}

const PERSONA_LABELS: Record<DemoPersona, string> = {
  admin: "Demo Administrator",
  clinical_staff: "Demo Clinical Staff",
};

const PERSONA_DESTINATIONS: Record<DemoPersona, string> = {
  admin: "/staff/admin",
  clinical_staff: "/staff/queue",
};

export function DemoAccessLauncher({
  demoModeEnabled,
  demoModeReady,
  facilityPublicCode,
}: DemoAccessLauncherProps) {
  const router = useRouter();
  const {
    status,
    authMode,
    demoPersona,
    activeFacility,
    staffProfile,
    isDemoEntering,
    enteringDemoPersona,
    authNotice,
    enterDemoSession,
    signOutStaff,
  } = useStaffAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isDemoAuthorized =
    status === "authorized" && authMode === "demo" && demoPersona !== null;
  const isBusy = isDemoEntering || isSigningOut;

  const activeWorkspaceHref =
    activeFacility?.role === "admin" ? "/staff/admin" : "/staff/queue";

  async function handleEnterDemo(persona: DemoPersona) {
    if (isBusy) return;
    setActionError(null);
    setSuccessMessage(null);

    const result = await enterDemoSession(persona);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    const targetHref = PERSONA_DESTINATIONS[persona];
    setSuccessMessage(
      `${PERSONA_LABELS[persona]} session verified. Redirecting to ${targetHref}...`,
    );
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    router.push(targetHref, { scroll: true });
  }

  async function handleSignOut() {
    if (isBusy) return;
    setActionError(null);
    setSuccessMessage(null);
    setIsSigningOut(true);
    try {
      await signOutStaff();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <section
      aria-labelledby="demo-access-heading"
      className="grid gap-6"
      data-testid="demo-access-launcher"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-4 py-3">
        <div className="grid gap-0.5">
          <h2
            id="demo-access-heading"
            className="mf-t-section m-0 text-[var(--mf-text)]"
          >
            Select a synthetic evaluation role
          </h2>
          <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
            Both demo personas authenticate through server-signed cookies and
            resolve real PostgreSQL facility memberships in{" "}
            <code className="mf-mono text-[12px] text-[var(--mf-text)]">
              {facilityPublicCode}
            </code>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={demoModeReady ? "success" : "warning"} icon="shield">
            {demoModeReady
              ? "Demo Mode Active"
              : demoModeEnabled
                ? "Demo Setup Required"
                : "Demo Mode Off"}
          </Badge>
          <Badge tone="neutral">Synthetic clinic only</Badge>
        </div>
      </div>

      {actionError && (
        <Alert tone="danger" title="Unable to start demo session">
          {actionError}
        </Alert>
      )}

      {successMessage && !actionError && (
        <Alert tone="success" title="Demo session ready">
          {successMessage}
        </Alert>
      )}

      {authNotice && !actionError && !successMessage && (
        <Alert tone="info" title="Session status">
          {authNotice}
        </Alert>
      )}

      {isDemoAuthorized && staffProfile && activeFacility && (
        <Alert
          tone="success"
          title={`Active session: ${PERSONA_LABELS[demoPersona]}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Signed in as <strong>{staffProfile.displayName}</strong> (role:{" "}
              <code className="mf-mono text-[12px]">{activeFacility.role}</code>
              ) in <strong>{activeFacility.facilityName}</strong> (
              <code className="mf-mono text-[12px]">
                {activeFacility.facilityPublicCode}
              </code>
              ).
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink
                href={activeWorkspaceHref}
                variant="primary"
                size="sm"
                data-testid="demo-open-active-workspace"
              >
                {activeFacility.role === "admin"
                  ? "Open Administrator Workspace"
                  : "Open Clinical Staff Queue"}
                <Icon name="arrow" size="sm" />
              </ButtonLink>
              <Button
                variant="secondary"
                size="sm"
                loading={isSigningOut}
                disabled={isBusy}
                onClick={() => void handleSignOut()}
                data-testid="demo-sign-out-btn"
              >
                Sign out
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {!demoModeEnabled && (
        <Alert tone="info" title="Hackathon Demo Mode is currently disabled">
          One-click demo sessions are disabled by server configuration. You can
          still explore the public patient intake experience at{" "}
          <code className="mf-mono text-[13px]">/intake</code> or sign in with a
          provisioned Google staff account on{" "}
          <code className="mf-mono text-[13px]">/staff/login</code>.
        </Alert>
      )}

      {demoModeEnabled && !demoModeReady && (
        <Alert
          tone="warning"
          title="Demo Mode configuration incomplete on server"
        >
          Hackathon Demo Mode is enabled, but the required server-only session
          signing secret is missing. Demo access fails closed until server
          configuration is completed.
        </Alert>
      )}

      {/* Primary Two-Card Judge Role Selection */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* 1. Enter as Demo Administrator */}
        <ClinicalPanel
          source="nurse"
          sourceLabel="Administrator Role · /staff/admin"
          title="Enter as Demo Administrator"
          subtitle={`Identity: demo-admin-01 · Role: admin · Facility: ${facilityPublicCode}`}
          action={
            isDemoAuthorized && demoPersona === "admin" ? (
              <Badge tone="success" icon="checkCircle">
                Active Session
              </Badge>
            ) : (
              <Badge tone="brand">Facility Governance</Badge>
            )
          }
          className="flex flex-col"
          bodyClassName="!flex flex-1 flex-col justify-between gap-5"
        >
          <div className="grid gap-3">
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Launch the dedicated <strong>Administrator Workspace</strong> (
              <code className="mf-mono text-[12px]">/staff/admin</code>) to
              inspect facility configuration, live PostgreSQL staff and intake
              metrics, and role-separation boundaries.
            </p>
            <dl className="mf-dl m-0">
              <dt>Primary destination</dt>
              <dd className="mf-mono text-[12px]">/staff/admin</dd>
              <dt>Authorized endpoints</dt>
              <dd className="mf-mono text-[12px]">
                GET /api/staff/admin/facility &amp; GET /api/staff/intakes
              </dd>
              <dt>Tenant scope</dt>
              <dd className="mf-mono text-[12px]">
                demo-clinic-01 ({facilityPublicCode})
              </dd>
            </dl>
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={isDemoEntering && enteringDemoPersona === "admin"}
              disabled={!demoModeReady || isBusy}
              onClick={() => void handleEnterDemo("admin")}
              data-testid="enter-demo-admin-btn"
            >
              {!(isDemoEntering && enteringDemoPersona === "admin") ? (
                <Icon name="shield" size="btn" />
              ) : null}
              {isDemoEntering && enteringDemoPersona === "admin"
                ? "Starting Demo Administrator..."
                : isDemoAuthorized && demoPersona === "admin"
                  ? "Continue to Administrator Workspace"
                  : "Enter as Demo Administrator"}
            </Button>
          </div>
        </ClinicalPanel>

        {/* 2. Enter as Demo Clinical Staff */}
        <ClinicalPanel
          source="nurse"
          sourceLabel="Clinical Staff Role · /staff/queue"
          title="Enter as Demo Clinical Staff"
          subtitle={`Identity: demo-staff-01 · Role: nurse · Facility: ${facilityPublicCode}`}
          action={
            isDemoAuthorized && demoPersona === "clinical_staff" ? (
              <Badge tone="success" icon="checkCircle">
                Active Session
              </Badge>
            ) : (
              <Badge tone="info">Clinical Queue</Badge>
            )
          }
          className="flex flex-col"
          bodyClassName="!flex flex-1 flex-col justify-between gap-5"
        >
          <div className="grid gap-3">
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Launch the dedicated <strong>Clinical Staff Workspace</strong> (
              <code className="mf-mono text-[12px]">/staff/queue</code>) to
              inspect the facility intake queue, deterministic priority ordering,
              and provenance-tagged intake detail view.
            </p>
            <dl className="mf-dl m-0">
              <dt>Primary destination</dt>
              <dd className="mf-mono text-[12px]">/staff/queue</dd>
              <dt>Authorized endpoints</dt>
              <dd className="mf-mono text-[12px]">
                GET /api/staff/intakes &amp; GET /api/staff/intakes/[id]
              </dd>
              <dt>Role boundary</dt>
              <dd className="text-[12px]">
                Admin endpoint <code className="mf-mono">/api/staff/admin/facility</code>{" "}
                returns HTTP 403
              </dd>
            </dl>
          </div>

          <div className="pt-1">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              loading={
                isDemoEntering && enteringDemoPersona === "clinical_staff"
              }
              disabled={!demoModeReady || isBusy}
              onClick={() => void handleEnterDemo("clinical_staff")}
              data-testid="enter-demo-staff-btn"
            >
              {!(isDemoEntering && enteringDemoPersona === "clinical_staff") ? (
                <Icon name="userCheck" size="btn" />
              ) : null}
              {isDemoEntering && enteringDemoPersona === "clinical_staff"
                ? "Starting Demo Clinical Staff..."
                : isDemoAuthorized && demoPersona === "clinical_staff"
                  ? "Continue to Clinical Staff Queue"
                  : "Enter as Demo Clinical Staff"}
            </Button>
          </div>
        </ClinicalPanel>
      </div>

      {/* Additional Platform Journeys for Judges */}
      <div className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-[var(--mf-text)]">
              Want to inspect the public Patient Intake journey?
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
              Patients use a dedicated, mobile-first self-intake screen without
              staff navigation or login walls.
            </p>
          </div>
          <div>
            <ButtonLink href="/intake" variant="secondary" size="sm">
              <Icon name="clipboard" size="sm" />
              Open Patient Intake (/intake)
            </ButtonLink>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-[var(--mf-text)]">
              Testing normal Firebase Google Sign-In?
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
              Provisioned clinic personnel authenticate via Google Sign-In and
              server-side Firebase ID token verification.
            </p>
          </div>
          <div>
            <ButtonLink href="/staff/login" variant="secondary" size="sm">
              <Icon name="lock" size="sm" />
              Open Staff Sign-In (/staff/login)
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
