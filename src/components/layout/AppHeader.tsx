"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, BrandMark, Button, ButtonLink, Icon } from "@/components/ui";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function AppHeader() {
  const pathname = usePathname() ?? "/";
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
  const defaultWorkspaceHref = isAdmin ? "/staff/admin" : "/staff/queue";

  // 1. Dedicated Patient Experience Header (/intake)
  // Completely isolated from staff navigation, admin controls, and demo role switchers.
  if (isPatientIntakeRoute) {
    return (
      <header
        className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)]"
        data-testid="patient-top-bar"
      >
        <div className="mx-auto flex max-w-[680px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus)]"
            >
              <BrandMark subtitle="Patient Self-Intake" />
            </Link>
            <Badge tone="neutral" className="mf-mono">
              {CANONICAL_DEMO_FACILITY.publicCode}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden text-[12px] font-medium text-[var(--mf-text-secondary)] sm:inline">
              Synthetic clinic demo · No account needed
            </span>
            <ButtonLink href="/" variant="secondary" size="sm">
              <Icon name="arrowLeft" size="sm" />
              Exit to Home
            </ButtonLink>
          </div>
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

  // 3. Public & Entry Surfaces Header (/, /demo, /staff/login)
  const navItems = [
    { href: "/", label: "Home", match: pathname === "/" },
    {
      href: "/intake",
      label: "Patient Intake",
      match: pathname.startsWith("/intake"),
    },
    {
      href: "/staff/login",
      label: "Staff Sign-In",
      match: pathname.startsWith("/staff/login"),
    },
    {
      href: "/demo",
      label: "Hackathon Demo",
      match: pathname === "/demo" || pathname.startsWith("/demo/"),
    },
  ];

  return (
    <header
      className="mf-dash__top flex-wrap justify-between gap-3 px-4 py-2.5 sm:px-6"
      data-testid="public-top-bar"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-primary-light)]"
        >
          <BrandMark onDark subtitle="Clinical Intake & Workflow" />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1.5"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.match ? "page" : undefined}
              className={`inline-flex min-h-[36px] items-center rounded-[4px] px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors ${
                item.match
                  ? "bg-[var(--mf-primary)] text-white"
                  : "text-[var(--mf-navy-text)] hover:bg-[var(--mf-navy-800)] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mf-chip mf-chip--on-dark hidden md:inline-flex">
          <Icon name="shield" size="sm" />
          Synthetic demo only
        </span>

        {isAuthorized && activeFacility ? (
          <>
            <span className="mf-chip mf-chip--on-dark">
              <Icon
                name={authMode === "demo" ? "shield" : "userCheck"}
                size="sm"
              />
              {authMode === "demo"
                ? demoPersona === "admin"
                  ? "Demo Admin"
                  : "Demo Staff"
                : `Role: ${activeFacility.role}`}
            </span>
            <ButtonLink href={defaultWorkspaceHref} variant="primary" size="sm">
              Open Workspace
              <Icon name="arrow" size="sm" />
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/demo" variant="onDark" size="sm">
            <Icon name="shield" size="sm" />
            Judge Demo Access
          </ButtonLink>
        )}
      </div>
    </header>
  );
}
