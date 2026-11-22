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

  async function handleEnterDemo(persona: DemoPersona) {
    if (isBusy) return;
    setActionError(null);
    setSuccessMessage(null);

    const result = await enterDemoSession(persona);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    setSuccessMessage(
      `${PERSONA_LABELS[persona]} session ready. Opening clinical staff workspace...`,
    );
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    router.push("/staff/queue", { scroll: true });
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
      className="mb-10 grid gap-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <span className="mf-eyebrow">Hackathon evaluation access</span>
          <h2
            id="demo-access-heading"
            className="mf-t-page m-0 text-[var(--mf-text)]"
          >
            Explore MedFlow immediately by role
          </h2>
          <p className="mf-t-body-sm m-0 max-w-[66ch] text-[var(--mf-text-secondary)]">
            Choose an evaluation role to inspect the facility-scoped clinical
            workspace inside synthetic clinic{" "}
            <code className="mf-mono text-[13px] text-[var(--mf-text)]">
              {facilityPublicCode}
            </code>
            , or open the public patient intake flow without creating an
            account.
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
          <Badge tone="neutral">Synthetic data only</Badge>
        </div>
      </div>

      {actionError && (
        <Alert tone="danger" title="Unable to start demo session">
          {actionError}
        </Alert>
      )}

      {successMessage && !actionError && (
        <Alert tone="success" title="Demo session started">
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
          title={`Signed in as ${PERSONA_LABELS[demoPersona]}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Active server-verified demo session for{" "}
              <strong>{staffProfile.displayName}</strong> (
              <span className="capitalize">{activeFacility.role}</span>) in{" "}
              <strong>{activeFacility.facilityName}</strong> (
              <code className="mf-mono text-[13px]">
                {activeFacility.facilityPublicCode}
              </code>
              ).
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/staff/queue" variant="primary" size="sm">
                Open workspace
                <Icon name="arrow" size="sm" />
              </ButtonLink>
              <Button
                variant="secondary"
                size="sm"
                loading={isSigningOut}
                disabled={isBusy}
                onClick={() => void handleSignOut()}
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
          still explore the public patient intake route below or sign in with a
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
          signing configuration is missing. Demo access fails closed until the
          server configuration is completed.
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* 1. Primary Action: Demo Administrator */}
        <ClinicalPanel
          source="nurse"
          sourceLabel="Admin role"
          title="Demo Administrator"
          subtitle={`Role: admin · Facility: ${facilityPublicCode}`}
          action={
            isDemoAuthorized && demoPersona === "admin" ? (
              <Badge tone="success" icon="checkCircle">
                Active
              </Badge>
            ) : (
              <Badge tone="brand">Primary demo</Badge>
            )
          }
          className="flex flex-col"
          bodyClassName="!flex flex-1 flex-col justify-between gap-4"
        >
          <div className="grid gap-2">
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Enter the synthetic clinic with server-verified administrator
              access to inspect the read-only facility overview and clinical
              intake queue.
            </p>
            <p className="m-0 text-[12px] text-[var(--mf-text-secondary)]">
              Strictly isolated to{" "}
              <code className="mf-mono text-[12px]">demo-clinic-01</code>. Never
              grants access to real facilities.
            </p>
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={isDemoEntering && enteringDemoPersona === "admin"}
              disabled={!demoModeReady || isBusy}
              onClick={() => void handleEnterDemo("admin")}
            >
              {!(isDemoEntering && enteringDemoPersona === "admin") ? (
                <Icon name="shield" size="btn" />
              ) : null}
              {isDemoEntering && enteringDemoPersona === "admin"
                ? "Starting Demo Administrator..."
                : isDemoAuthorized && demoPersona === "admin"
                  ? "Continue as Demo Administrator"
                  : "Enter as Demo Administrator"}
            </Button>
          </div>
        </ClinicalPanel>

        {/* 2. Clinical Staff Action: Demo Clinical Staff */}
        <ClinicalPanel
          source="nurse"
          sourceLabel="Clinical staff"
          title="Demo Clinical Staff"
          subtitle={`Role: nurse · Facility: ${facilityPublicCode}`}
          action={
            isDemoAuthorized && demoPersona === "clinical_staff" ? (
              <Badge tone="success" icon="checkCircle">
                Active
              </Badge>
            ) : (
              <Badge tone="info">Staff workflow</Badge>
            )
          }
          className="flex flex-col"
          bodyClassName="!flex flex-1 flex-col justify-between gap-4"
        >
          <div className="grid gap-2">
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Enter as an authorised clinical staff member to review the
              facility-scoped intake queue with deterministic ordering and
              evidence-first layouts.
            </p>
            <p className="m-0 text-[12px] text-[var(--mf-text-secondary)]">
              Standard clinical role only — administrator-only endpoints remain
              enforced and blocked on the server.
            </p>
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
            >
              {!(isDemoEntering && enteringDemoPersona === "clinical_staff") ? (
                <Icon name="userCheck" size="btn" />
              ) : null}
              {isDemoEntering && enteringDemoPersona === "clinical_staff"
                ? "Starting Demo Clinical Staff..."
                : isDemoAuthorized && demoPersona === "clinical_staff"
                  ? "Continue as Demo Clinical Staff"
                  : "Enter as Demo Clinical Staff"}
            </Button>
          </div>
        </ClinicalPanel>

        {/* 3. Public Action: Start Patient Intake */}
        <ClinicalPanel
          source="patient"
          sourceLabel="No sign-in"
          title="Start Patient Intake"
          subtitle="Public mobile-first intake route · /intake"
          action={<Badge tone="neutral">Public</Badge>}
          className="flex flex-col"
          bodyClassName="!flex flex-1 flex-col justify-between gap-4"
        >
          <div className="grid gap-2">
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Explore the patient-facing clinical intake entry experience
              directly with 18px mobile-first readability and zero account
              requirements.
            </p>
            <p className="m-0 text-[12px] text-[var(--mf-text-secondary)]">
              Live patient intake submission and voice transcription activate in
              Milestone 2.
            </p>
          </div>

          <div className="pt-1">
            <ButtonLink href="/intake" variant="secondary" size="md" fullWidth>
              <Icon name="clipboard" size="btn" />
              Start Patient Intake
              <Icon name="arrow" size="btn" />
            </ButtonLink>
          </div>
        </ClinicalPanel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-4 py-3 text-[13px] text-[var(--mf-text-secondary)]">
        <span>
          <strong>Synthetic demo environment:</strong> Sessions use HTTP-only
          server-signed cookies scoped strictly to{" "}
          <code className="mf-mono text-[12px] text-[var(--mf-text)]">
            {facilityPublicCode}
          </code>{" "}
          and synthetic data only. Do not enter real patient information.
        </span>
        <ButtonLink href="/staff/login" variant="tertiary" size="sm">
          <Icon name="lock" size="sm" />
          Provisioned staff Google Sign-In
        </ButtonLink>
      </div>
    </section>
  );
}
