"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, ButtonLink, Icon } from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import type { DemoPersona } from "@/lib/schemas/staff-api";
import { DemoWorkspaceCard } from "./DemoWorkspaceCard";

export interface DemoAccessLauncherProps {
  readonly demoModeEnabled: boolean;
  readonly demoModeReady: boolean;
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
}: DemoAccessLauncherProps) {
  const router = useRouter();
  const {
    status,
    authMode,
    demoPersona,
    activeFacility,
    isDemoEntering,
    enteringDemoPersona,
    authNotice,
    enterDemoSession,
    signOutStaff,
  } = useStaffAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isDemoAuthorized =
    status === "authorized" &&
    authMode === "demo" &&
    demoPersona !== null &&
    activeFacility !== null;
  const isBusy = isDemoEntering || isSigningOut;

  const activeWorkspaceHref =
    activeFacility?.role === "admin" ? "/staff/admin" : "/staff/queue";
  const otherPersona: DemoPersona =
    demoPersona === "admin" ? "clinical_staff" : "admin";

  async function handleEnterDemo(persona: DemoPersona) {
    if (isBusy) return;
    setActionError(null);

    const result = await enterDemoSession(persona);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    const targetHref = PERSONA_DESTINATIONS[persona];
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    router.push(targetHref, { scroll: true });
  }

  async function handleSignOut() {
    if (isBusy) return;
    setActionError(null);
    setIsSigningOut(true);
    try {
      await signOutStaff();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <section
      aria-label="Workspace selection"
      className="grid gap-6"
      data-testid="demo-access-launcher"
    >
      {actionError ? (
        <Alert tone="danger" title="Unable to open workspace">
          {actionError}
        </Alert>
      ) : null}

      {authNotice && !actionError ? (
        <Alert tone="info" title="Session update">
          {authNotice}
        </Alert>
      ) : null}

      {!demoModeEnabled ? (
        <Alert tone="info" title="Demo workspaces are currently unavailable">
          One-click demo workspaces are turned off in this environment. You can
          still try Patient Intake or sign in with a clinic staff account.
        </Alert>
      ) : null}

      {demoModeEnabled && !demoModeReady ? (
        <Alert tone="warning" title="Demo setup incomplete">
          This server is missing required demo configuration. Please contact the
          demonstration host.
        </Alert>
      ) : null}

      {/* Intelligent Active Session Panel OR Two-Card Workspace Chooser */}
      {isDemoAuthorized && demoPersona ? (
        <div
          className="grid gap-5 rounded-[10px] border border-[var(--mf-primary)]/40 border-t-[4px] border-t-[var(--mf-primary)] bg-[var(--mf-surface)] p-6 sm:p-8"
          data-testid="demo-active-session-panel"
        >
          <div className="grid gap-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-[4px] bg-[var(--mf-success-tint)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--mf-success-dark)]">
              <Icon name="checkCircle" size="sm" />
              <span>Active demo session</span>
            </div>

            <h2 className="m-0 text-[1.375rem] font-semibold leading-[1.25] text-[var(--mf-text)]">
              You&apos;re currently exploring as {PERSONA_LABELS[demoPersona]}.
            </h2>

            <p className="m-0 max-w-[52ch] text-[14.5px] leading-[1.5] text-[var(--mf-text-secondary)]">
              Continue straight into your workspace, or switch roles at any time.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink
              href={activeWorkspaceHref}
              variant="primary"
              size="lg"
              data-testid="demo-open-active-workspace"
            >
              {demoPersona === "admin"
                ? "Open Administrator Workspace"
                : "Open Clinical Workspace"}
              <Icon name="arrow" size="btn" />
            </ButtonLink>

            <Button
              variant="secondary"
              size="lg"
              loading={isDemoEntering && enteringDemoPersona === otherPersona}
              disabled={!demoModeReady || isBusy}
              onClick={() => void handleEnterDemo(otherPersona)}
              data-testid={
                otherPersona === "admin"
                  ? "enter-demo-admin-btn"
                  : "enter-demo-staff-btn"
              }
            >
              {otherPersona === "admin"
                ? "Switch to Administrator"
                : "Switch to Clinical Staff"}
            </Button>

            <Button
              variant="tertiary"
              size="md"
              loading={isSigningOut}
              disabled={isBusy}
              onClick={() => void handleSignOut()}
              data-testid="demo-sign-out-btn"
              className="sm:ml-auto"
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <DemoWorkspaceCard
            title="Clinical Staff"
            description="Review patient intakes, examine AI-assisted summaries and manage the clinical workflow."
            actionLabel="Enter Clinical Workspace"
            loadingLabel="Opening Clinical Workspace..."
            icon="userCheck"
            emphasized
            loading={isDemoEntering && enteringDemoPersona === "clinical_staff"}
            disabled={!demoModeReady || isBusy}
            testId="enter-demo-staff-btn"
            onEnter={() => void handleEnterDemo("clinical_staff")}
          />

          <DemoWorkspaceCard
            title="Administrator"
            description="Explore the demonstration facility overview and administrative workspace."
            actionLabel="Enter Admin Workspace"
            loadingLabel="Opening Admin Workspace..."
            icon="shieldCheck"
            loading={isDemoEntering && enteringDemoPersona === "admin"}
            disabled={!demoModeReady || isBusy}
            testId="enter-demo-admin-btn"
            onEnter={() => void handleEnterDemo("admin")}
          />
        </div>
      )}

      {/* Restrained Secondary Navigation */}
      <nav
        aria-label="Other destinations"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--mf-border)] pt-5 text-[13.5px]"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/intake"
            className="font-semibold text-[var(--mf-primary-dark)] no-underline hover:underline"
          >
            Patient Intake
          </Link>
          <Link
            href="/staff/login"
            className="font-medium text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-text)] hover:underline"
          >
            Staff Sign-In
          </Link>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1 font-medium text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-text)] hover:underline"
        >
          <Icon name="arrowLeft" size="sm" />
          <span>Return Home</span>
        </Link>
      </nav>
    </section>
  );
}
