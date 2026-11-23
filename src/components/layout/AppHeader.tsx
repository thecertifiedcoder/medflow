"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark, Button, ButtonLink, Icon } from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    status,
    authMode,
    activeFacility,
    staffProfile,
    signOutStaff,
  } = useStaffAuth();

  const isPatientIntakeRoute =
    pathname === "/intake" || pathname.startsWith("/intake/");
  const isStaffWorkspaceRoute =
    pathname === "/staff/queue" ||
    pathname.startsWith("/staff/queue/") ||
    pathname === "/staff/admin" ||
    pathname.startsWith("/staff/admin/") ||
    pathname.startsWith("/staff/intakes/");

  const isAuthorized = status === "authorized" && activeFacility !== null;

  // 1. Focused Mobile-First Patient Header (/intake)
  // Calm, minimal, free of staff controls or backend/developer identifiers.
  if (isPatientIntakeRoute) {
    return (
      <header
        className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)]"
        data-testid="patient-top-bar"
      >
        <div className="mx-auto flex h-14 max-w-[540px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="shrink-0 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus)]"
          >
            <BrandMark size="sm" />
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[6px] px-2.5 text-[13.5px] font-semibold text-[var(--mf-text-secondary)] no-underline transition-colors hover:bg-[var(--mf-surface-subtle)] hover:text-[var(--mf-text)]"
          >
            <Icon name="arrowLeft" size="sm" />
            Exit
          </Link>
        </div>
      </header>
    );
  }

  // 2. Compact Clinical Staff Header (/staff/queue, /staff/intakes/*)
  if (isStaffWorkspaceRoute) {
    const roleLabel =
      activeFacility?.role === "doctor" ? "Doctor" : "Nurse";

    return (
      <header
        className="mf-dash__top h-14 justify-between gap-2 px-4 sm:px-6"
        data-testid="workspace-top-bar"
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link
            href="/staff/queue"
            className="shrink-0 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus-on-dark)]"
          >
            <BrandMark onDark size="sm" />
          </Link>

          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-[var(--mf-navy-700)] sm:inline-block"
          />

          <span className="hidden truncate text-[13.5px] font-medium text-[var(--mf-navy-text)] sm:inline">
            Clinical Workspace
          </span>

          {isAuthorized && authMode === "demo" && (
            <span
              className="inline-flex shrink-0 items-center rounded-[4px] border border-[var(--mf-primary-light)]/40 bg-[var(--mf-navy-800)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--mf-primary-light)] uppercase"
              data-testid="workspace-demo-indicator"
            >
              Demo
            </span>
          )}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {isAuthorized && staffProfile && activeFacility ? (
            <>
              <span
                className="hidden max-w-[240px] truncate text-[13px] text-[var(--mf-navy-text)] md:inline"
                data-testid="active-session-chip"
              >
                {authMode === "demo"
                  ? "Clinical Staff"
                  : staffProfile.displayName}{" "}
                <span className="text-[var(--mf-navy-text-muted)]">
                  · {roleLabel}
                </span>
              </span>

              <Button
                variant="onDark"
                size="sm"
                onClick={() => void signOutStaff()}
                data-testid="workspace-sign-out-btn"
              >
                Sign out
              </Button>
            </>
          ) : (
            <ButtonLink href="/demo" variant="onDark" size="sm">
              Judge Access
            </ButtonLink>
          )}
        </div>
      </header>
    );
  }

  // 3. Public & Entry Navigation (/, /demo)
  const isDemoRoute = pathname === "/demo" || pathname.startsWith("/demo/");

  return (
    <header
      className="sticky top-0 z-30 bg-[var(--mf-navy-900)] text-[var(--mf-navy-text)] border-b-[3px] border-[var(--mf-primary)]"
      data-testid="public-top-bar"
    >
      <div className="mx-auto flex h-14 max-w-[1160px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="shrink-0 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus-on-dark)]"
        >
          <BrandMark onDark size="sm" />
        </Link>

        {/* Desktop navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1.5 sm:flex"
        >
          <Link
            href="/intake"
            className="inline-flex min-h-[38px] items-center whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13.5px] font-medium text-[var(--mf-navy-text)] no-underline transition-colors hover:bg-[var(--mf-navy-800)] hover:text-white"
          >
            Patient Intake
          </Link>

          <Link
            href="/demo"
            aria-current={isDemoRoute ? "page" : undefined}
            className={`ml-1 inline-flex min-h-[38px] items-center whitespace-nowrap rounded-[4px] border px-3.5 py-1.5 text-[13.5px] font-semibold no-underline transition-colors ${
              isDemoRoute
                ? "border-[var(--mf-primary)] bg-[var(--mf-primary)] text-white"
                : "border-[var(--mf-primary-light)]/50 bg-[var(--mf-navy-800)] text-white hover:border-[var(--mf-primary-light)] hover:bg-[var(--mf-navy-700)]"
            }`}
          >
            Judge Access
          </Link>
        </nav>

        {/* Compact single-row mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link
            href="/demo"
            aria-current={isDemoRoute ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`inline-flex min-h-[36px] items-center whitespace-nowrap rounded-[4px] border px-3 text-[13px] font-semibold no-underline transition-colors ${
              isDemoRoute
                ? "border-[var(--mf-primary)] bg-[var(--mf-primary)] text-white"
                : "border-[var(--mf-primary-light)]/45 bg-[var(--mf-navy-800)] text-white"
            }`}
          >
            Judge Access
          </Link>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-public-nav"
            aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)] px-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--mf-navy-700)]"
          >
            <Icon name={mobileMenuOpen ? "x" : "menu"} size="sm" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      {/* Compact mobile drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-public-nav"
          aria-label="Mobile navigation"
          className="border-t border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)] px-4 py-3 sm:hidden"
        >
          <div className="grid gap-1.5">
            <Link
              href="/intake"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center justify-between rounded-[4px] px-3 text-[14px] font-semibold text-white no-underline hover:bg-[var(--mf-navy-700)]"
            >
              <span>Patient Intake</span>
              <Icon name="arrow" size="sm" />
            </Link>
            <Link
              href="/demo"
              aria-current={isDemoRoute ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-[44px] items-center justify-between rounded-[4px] px-3 text-[14px] font-medium no-underline hover:bg-[var(--mf-navy-700)] ${
                isDemoRoute
                  ? "bg-[var(--mf-primary)] text-white font-semibold"
                  : "text-[var(--mf-navy-text)]"
              }`}
            >
              <span>Judge Access</span>
              <Icon name="shieldCheck" size="sm" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
