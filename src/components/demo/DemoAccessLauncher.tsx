"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, ButtonLink, Icon } from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import { DemoWorkspaceCard } from "./DemoWorkspaceCard";

export interface DemoAccessLauncherProps {
  readonly demoModeEnabled: boolean;
  readonly demoModeReady: boolean;
}

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

  const hasActiveClinicalDemoSession =
    status === "authorized" &&
    authMode === "demo" &&
    demoPersona === "clinical_staff" &&
    activeFacility !== null;
  const isBusy = isDemoEntering || isSigningOut;

  async function handleEnterClinicalWorkspace() {
    if (isBusy) return;
    setActionError(null);

    // Uses the existing server-signed Demo Clinical Staff session flow.
    // If an admin demo session was previously active, this safely switches
    // the visitor to the Clinical Staff persona via the server session route.
    const result = await enterDemoSession("clinical_staff");
    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    router.push("/staff/queue", { scroll: true });
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
      aria-label="Judge access"
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
        <Alert tone="info" title="Demonstration workspace is currently unavailable">
          One-click clinical workspace access is turned off in this environment.
          You can still try Patient Intake below.
        </Alert>
      ) : null}

      {demoModeEnabled && !demoModeReady ? (
        <Alert tone="warning" title="Demonstration setup incomplete">
          This environment is missing required session configuration. Please
          contact the demonstration host.
        </Alert>
      ) : null}

      {hasActiveClinicalDemoSession ? (
        <div
          className="grid gap-5 rounded-[10px] border border-[var(--mf-primary)]/40 border-t-[4px] border-t-[var(--mf-primary)] bg-[var(--mf-surface)] p-6 sm:p-8"
          data-testid="demo-active-session-panel"
        >
          <div className="grid gap-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-[4px] bg-[var(--mf-success-tint)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--mf-success-dark)]">
              <Icon name="checkCircle" size="sm" />
              <span>Session ready</span>
            </div>

            <h2 className="m-0 text-[1.375rem] font-semibold leading-[1.25] text-[var(--mf-text)]">
              You&apos;re ready to explore MedFlow.
            </h2>

            <p className="m-0 max-w-[52ch] text-[14.5px] leading-[1.55] text-[var(--mf-text-secondary)]">
              Continue directly into the Clinical Staff Workspace to review
              incoming patient intakes and supporting evidence.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink
              href="/staff/queue"
              variant="primary"
              size="lg"
              data-testid="demo-open-active-workspace"
            >
              Open Clinical Workspace
              <Icon name="arrow" size="btn" />
            </ButtonLink>

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
        <DemoWorkspaceCard
          title="Clinical Staff Workspace"
          description="Explore the patient queue, review AI-assisted summaries, inspect supporting evidence and manage the clinical workflow."
          actionLabel="Enter Clinical Workspace"
          loadingLabel="Opening Clinical Workspace..."
          icon="userCheck"
          emphasized
          loading={isDemoEntering && enteringDemoPersona === "clinical_staff"}
          disabled={!demoModeReady || isBusy}
          testId="enter-demo-staff-btn"
          onEnter={() => void handleEnterClinicalWorkspace()}
        />
      )}

      {/* Restrained Secondary Navigation */}
      <nav
        aria-label="Other destinations"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--mf-border)] pt-5 text-[13.5px]"
      >
        <Link
          href="/intake"
          className="font-semibold text-[var(--mf-primary-dark)] no-underline hover:underline"
        >
          Patient Intake
        </Link>

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
