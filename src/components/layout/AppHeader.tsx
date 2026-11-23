"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark, Button, ButtonLink, Icon } from "@/components/ui";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    status,
    authMode,
    demoPersona,
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
  const isAdmin = activeFacility?.role === "admin";

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

  // 2. Authenticated Clinical Staff & Administrator Command Header (/staff/queue, /staff/admin, /staff/intakes/*)
  if (isStaffWorkspaceRoute) {
    return (
      <header
        className="mf-dash__top flex-wrap justify-between gap-2.5 px-4 py-2.5 sm:px-6"
        data-testid="workspace-top-bar"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/"
            className="no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-primary-light)]"
          >
            <BrandMark
              onDark
              subtitle={
                isAdmin
                  ? "Facility Administration & Clinical Workspace"
                  : "Clinical Staff Workspace"
              }
            />
          </Link>

          <span className="mf-chip mf-chip--on-dark hidden sm:inline-flex">
            <Icon name="clipboard" size="sm" />
            Facility:{" "}
            <strong className="mf-mono">
              {activeFacility?.facilityPublicCode ??
                CANONICAL_DEMO_FACILITY.publicCode}
            </strong>
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isAuthorized && staffProfile && activeFacility ? (
            <>
              <span
                className="mf-chip mf-chip--on-dark max-w-full truncate"
                data-testid="active-session-chip"
              >
                <Icon
                  name={authMode === "demo" ? "shield" : "userCheck"}
                  size="sm"
                />
                <span className="truncate">
                  {authMode === "demo"
                    ? demoPersona === "admin"
                      ? "Demo Admin"
                      : "Demo Staff"
                    : staffProfile.displayName}{" "}
                  · <span className="uppercase">{activeFacility.role}</span>
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
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/demo" variant="onDark" size="sm">
                <Icon name="shield" size="sm" />
                Hackathon Demo
              </ButtonLink>
              <ButtonLink href="/staff/login" variant="onDark" size="sm">
                <Icon name="lock" size="sm" />
                Staff Sign-In
              </ButtonLink>
            </div>
          )}
        </div>
      </header>
    );
  }

  // 3. Public & Entry Navigation (/, /demo, /staff/login)
  const isStaffLogin = pathname.startsWith("/staff/login");
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
            href="/staff/login"
            aria-current={isStaffLogin ? "page" : undefined}
            className={`inline-flex min-h-[38px] items-center whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13.5px] font-medium no-underline transition-colors ${
              isStaffLogin
                ? "bg-[var(--mf-navy-700)] text-white font-semibold"
                : "text-[var(--mf-navy-text)] hover:bg-[var(--mf-navy-800)] hover:text-white"
            }`}
          >
            Staff Sign-In
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
            Demo
          </Link>
        </nav>

        {/* Compact single-row mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link
            href="/demo"
            aria-current={isDemoRoute ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`inline-flex min-h-[36px] items-center rounded-[4px] border px-3 text-[13px] font-semibold no-underline transition-colors ${
              isDemoRoute
                ? "border-[var(--mf-primary)] bg-[var(--mf-primary)] text-white"
                : "border-[var(--mf-primary-light)]/45 bg-[var(--mf-navy-800)] text-white"
            }`}
          >
            Demo
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
              href="/staff/login"
              aria-current={isStaffLogin ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-[44px] items-center justify-between rounded-[4px] px-3 text-[14px] font-medium no-underline hover:bg-[var(--mf-navy-700)] ${
                isStaffLogin
                  ? "bg-[var(--mf-navy-700)] text-white font-semibold"
                  : "text-[var(--mf-navy-text)]"
              }`}
            >
              <span>Staff Sign-In</span>
              <Icon name="lock" size="sm" />
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
              <span>Explore Demo</span>
              <Icon name="shieldCheck" size="sm" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
