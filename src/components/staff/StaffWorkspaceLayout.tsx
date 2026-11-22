"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AuthorizedStaffContext } from "@/components/staff/StaffAccessGate";
import { Badge, Button, Icon } from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export interface StaffWorkspaceLayoutProps {
  readonly context: AuthorizedStaffContext;
  readonly queueTotalCount?: number;
  readonly activeSection: "queue" | "admin" | "detail";
  readonly children: ReactNode;
}

export function StaffWorkspaceLayout({
  context,
  queueTotalCount,
  activeSection,
  children,
}: StaffWorkspaceLayoutProps) {
  const pathname = usePathname() ?? "";
  const { signOutStaff } = useStaffAuth();
  const { staffProfile, serverSession, activeFacility, activeFacilityId } =
    context;

  const isAdmin = activeFacility.role === "admin";
  const isDemoSession = serverSession.authMode === "demo";

  const roleDisplayLabel = isDemoSession
    ? serverSession.demoPersona === "admin"
      ? "Demo Administrator (admin)"
      : "Demo Clinical Staff (nurse)"
    : `${staffProfile.displayName} (${activeFacility.role})`;

  return (
    <div className="mf-dash-wrap">
      {/* Responsive Workspace Navigation Bar for Tablet & Mobile (< 1100px) */}
      <div
        className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)] px-4 py-2.5 lg:hidden"
        data-testid="workspace-mobile-nav"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="Workspace mobile navigation"
            className="flex flex-wrap items-center gap-1.5"
          >
            {isAdmin && (
              <Link
                href="/staff/admin"
                aria-current={activeSection === "admin" ? "page" : undefined}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[13px] font-semibold no-underline ${
                  activeSection === "admin"
                    ? "bg-[var(--mf-primary)] text-white"
                    : "border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] text-[var(--mf-text)]"
                }`}
              >
                <Icon name="shield" size="sm" />
                Facility Admin
              </Link>
            )}

            <Link
              href="/staff/queue"
              aria-current={
                activeSection === "queue" || activeSection === "detail"
                  ? "page"
                  : undefined
              }
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[13px] font-semibold no-underline ${
                activeSection === "queue" || activeSection === "detail"
                  ? "bg-[var(--mf-primary)] text-white"
                  : "border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] text-[var(--mf-text)]"
              }`}
            >
              <Icon name="list" size="sm" />
              Clinical Queue
              {typeof queueTotalCount === "number" ? (
                <span className="mf-mono ml-1 rounded-[3px] bg-black/15 px-1.5 py-0.5 text-[11px]">
                  {queueTotalCount}
                </span>
              ) : null}
            </Link>

            <Link
              href="/demo"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-3 py-1.5 text-[13px] font-semibold text-[var(--mf-text-secondary)] no-underline"
            >
              Switch Role
            </Link>
          </nav>

          <Badge tone="neutral" className="mf-mono">
            {activeFacility.facilityPublicCode}
          </Badge>
        </div>
      </div>

      <div className="mf-dash">
        {/* Desktop Role-Aware Workspace Sidebar (>= 1100px) */}
        <aside
          className="mf-dash__nav"
          aria-label="Staff workspace navigation"
          data-testid="workspace-sidebar"
        >
          <div className="mf-nav__label">
            {isAdmin ? "Admin & Clinical" : "Clinical Workspace"}
          </div>

          {isAdmin && (
            <Link
              href="/staff/admin"
              aria-current={
                pathname === "/staff/admin" || activeSection === "admin"
                  ? "page"
                  : undefined
              }
              className="mf-nav__item"
              data-testid="nav-facility-admin"
            >
              <Icon name="shield" size="md" />
              <span>Facility administration</span>
            </Link>
          )}

          <Link
            href="/staff/queue"
            aria-current={
              pathname === "/staff/queue" || activeSection === "queue"
                ? "page"
                : undefined
            }
            className="mf-nav__item"
            data-testid="nav-clinical-queue"
          >
            <Icon name="list" size="md" />
            <span>Clinical intake queue</span>
            {typeof queueTotalCount === "number" ? (
              <span className="mf-nav__count">{queueTotalCount}</span>
            ) : null}
          </Link>

          <div className="mf-nav__label mt-3">Platform paths</div>

          <Link href="/demo" className="mf-nav__item" data-testid="nav-demo-hub">
            <Icon name="users" size="md" />
            <span>Hackathon Demo Hub</span>
          </Link>

          <Link href="/" className="mf-nav__item" data-testid="nav-public-home">
            <Icon name="arrowLeft" size="md" />
            <span>Public Home</span>
          </Link>

          <div className="mf-nav__foot grid gap-2">
            <div className="grid gap-0.5">
              <div className="text-[12px] font-semibold text-white">
                {staffProfile.displayName}
              </div>
              <div className="text-[11px] text-[var(--mf-navy-text-muted)]">
                {roleDisplayLabel}
              </div>
              <div className="mf-mono text-[11px] text-[var(--mf-primary-light)]">
                {activeFacility.facilityPublicCode} · {activeFacilityId}
              </div>
            </div>

            <Button
              variant="onDark"
              size="sm"
              fullWidth
              onClick={() => void signOutStaff()}
            >
              Sign out
            </Button>
          </div>
        </aside>

        <main className="mf-dash__detail">{children}</main>
      </div>
    </div>
  );
}
