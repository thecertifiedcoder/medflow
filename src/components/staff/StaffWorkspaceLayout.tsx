"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AuthorizedStaffContext } from "@/components/staff/StaffAccessGate";
import { Button, Icon } from "@/components/ui";
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
  const { staffProfile, serverSession, activeFacility } = context;

  const isDemoSession = serverSession.authMode === "demo";

  const roleLabel =
    activeFacility.role === "doctor" ? "Doctor" : "Nurse";

  return (
    <div className="mf-dash-wrap">
      {/* Compact Navigation Bar for Mobile & Tablet (< 1100px) */}
      <div
        className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)] px-4 py-2 lg:hidden"
        data-testid="workspace-mobile-nav"
      >
        <div className="flex items-center justify-between gap-2">
          <nav
            aria-label="Clinical workspace navigation"
            className="flex items-center gap-1.5"
          >
            <Link
              href="/staff/queue"
              aria-current={
                activeSection === "queue" || activeSection === "detail"
                  ? "page"
                  : undefined
              }
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors ${
                activeSection === "queue" || activeSection === "detail"
                  ? "bg-[var(--mf-primary)] text-white"
                  : "border border-[var(--mf-border)] bg-[var(--mf-surface)] text-[var(--mf-text)]"
              }`}
            >
              <Icon name="list" size="sm" />
              <span>Patient Queue</span>
              {typeof queueTotalCount === "number" ? (
                <span className="mf-mono rounded-[3px] bg-black/15 px-1.5 py-0.5 text-[11px]">
                  {queueTotalCount}
                </span>
              ) : null}
            </Link>
          </nav>

          {isDemoSession && (
            <Link
              href="/demo"
              className="inline-flex min-h-[36px] shrink-0 items-center rounded-[5px] px-2.5 text-[12.5px] font-medium text-[var(--mf-text-secondary)] no-underline hover:bg-[var(--mf-surface-subtle)] hover:text-[var(--mf-text)]"
            >
              Judge Access
            </Link>
          )}
        </div>
      </div>

      <div className="mf-dash !min-h-[calc(100vh-56px)]">
        {/* Compact Desktop Sidebar (>= 1100px) */}
        <aside
          className="mf-dash__nav"
          aria-label="Clinical workspace navigation"
          data-testid="workspace-sidebar"
        >
          <div className="mf-nav__label">Workspace</div>

          <Link
            href="/staff/queue"
            aria-current={
              pathname === "/staff/queue" ||
              activeSection === "queue" ||
              activeSection === "detail"
                ? "page"
                : undefined
            }
            className="mf-nav__item"
            data-testid="nav-clinical-queue"
          >
            <Icon name="list" size="md" />
            <span>Patient Queue</span>
            {typeof queueTotalCount === "number" ? (
              <span className="mf-nav__count">{queueTotalCount}</span>
            ) : null}
          </Link>

          {isDemoSession && (
            <Link
              href="/demo"
              className="mf-nav__item mt-2"
              data-testid="nav-demo-hub"
            >
              <Icon name="shieldCheck" size="md" />
              <span>Judge Access</span>
            </Link>
          )}

          <div className="mf-nav__foot grid gap-2.5">
            <div className="grid gap-0.5">
              <div className="text-[12.5px] font-semibold text-white">
                {staffProfile.displayName}
              </div>
              <div className="text-[11.5px] text-[var(--mf-navy-text-muted)]">
                {roleLabel} · {activeFacility.facilityName}
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
