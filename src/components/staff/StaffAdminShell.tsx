"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StaffAccessGate,
  type AuthorizedStaffContext,
} from "@/components/staff/StaffAccessGate";
import { StaffWorkspaceLayout } from "@/components/staff/StaffWorkspaceLayout";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
  Select,
} from "@/components/ui";
import { SYNTHETIC_DEMO_IDENTITIES } from "@/db/invariants";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import type { StaffAdminFacilityOverviewResponse } from "@/lib/schemas/staff-api";
import {
  fetchStaffAdminFacilityOverview,
  StaffApiClientError,
} from "@/lib/staff/api-client";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AuthorizedStaffAdmin(context: AuthorizedStaffContext) {
  const {
    staffProfile,
    serverSession,
    activeFacility,
    activeFacilityId,
    getIdToken,
    handleSessionExpired,
  } = context;
  const { setActiveFacilityId } = useStaffAuth();

  const [overview, setOverview] =
    useState<StaffAdminFacilityOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    activeFacility.role === "admin",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  const isAdminRole = activeFacility.role === "admin";
  const isDemoSession = serverSession.authMode === "demo";

  const triggerReload = useCallback(() => {
    if (!isAdminRole) return;
    setIsLoading(true);
    setErrorMessage(null);
    setRefreshNonce((prev) => prev + 1);
  }, [isAdminRole]);

  useEffect(() => {
    if (!isAdminRole) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetchStaffAdminFacilityOverview({
          getIdToken,
          facilityId: activeFacilityId,
          signal: controller.signal,
        });
        if (cancelled) return;
        setOverview(result);
        setErrorMessage(null);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (err instanceof StaffApiClientError && err.isAuthExpired) {
          handleSessionExpired(err.message);
          return;
        }
        setErrorMessage(
          err instanceof StaffApiClientError
            ? err.message
            : "Unable to load the facility administration overview from Neon PostgreSQL.",
        );
        setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    activeFacilityId,
    getIdToken,
    handleSessionExpired,
    isAdminRole,
    refreshNonce,
  ]);

  // Role-Separation Enforcement: Clinical Staff (nurse/doctor) cannot access /staff/admin
  if (!isAdminRole) {
    return (
      <StaffWorkspaceLayout context={context} activeSection="admin">
        <div
          className="grid gap-5"
          data-testid="admin-role-restricted-panel"
        >
          <div className="mf-detail-head justify-between">
            <div className="grid gap-1">
              <span className="mf-eyebrow">
                Role-based access boundary · HTTP 403
              </span>
              <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
                Restricted to Facility Administrators
              </h1>
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Signed in as <strong>{staffProfile.displayName}</strong> (role:{" "}
                <strong className="uppercase">{activeFacility.role}</strong>) in{" "}
                <strong>{activeFacility.facilityName}</strong> (
                <code className="mf-mono text-[13px]">{activeFacilityId}</code>)
              </p>
            </div>
            <Badge tone="danger" icon="lock">
              Admin role required
            </Badge>
          </div>

          <ClinicalPanel
            source="nurse"
            sourceLabel="Role enforcement"
            title="Clinical staff accounts cannot access facility administration"
            subtitle="Server endpoint GET /api/staff/admin/facility strictly requires the 'admin' role in PostgreSQL."
          >
            <Alert
              tone="warning"
              title="Insufficient facility role (INSUFFICIENT_STAFF_ROLE)"
            >
              Your active session is authorized as{" "}
              <strong className="uppercase">{activeFacility.role}</strong> for
              clinical queue operations. Facility administration and governance
              metrics are restricted exclusively to users with the{" "}
              <code className="mf-mono">admin</code> role.
            </Alert>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink
                href="/staff/queue"
                variant="primary"
                size="md"
                data-testid="return-to-queue-from-admin-btn"
              >
                <Icon name="list" size="btn" />
                Return to Clinical Intake Queue
                <Icon name="arrow" size="btn" />
              </ButtonLink>
              <ButtonLink href="/demo" variant="secondary" size="md">
                <Icon name="shield" size="btn" />
                Switch Role in Hackathon Demo Hub
              </ButtonLink>
            </div>
          </ClinicalPanel>
        </div>
      </StaffWorkspaceLayout>
    );
  }

  return (
    <StaffWorkspaceLayout
      context={context}
      queueTotalCount={overview?.metrics.totalIntakesCount}
      activeSection="admin"
    >
      <div className="grid gap-5" data-testid="staff-admin-workspace">
        <div className="mf-detail-head justify-between">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mf-eyebrow">
                Facility Governance &amp; Administration
              </span>
              <Badge tone="brand" icon="shield">
                {isDemoSession
                  ? "Hackathon Demo · Administrator"
                  : "Authorized Administrator"}
              </Badge>
            </div>
            <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
              Facility Administration Workspace
            </h1>
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Signed in as <strong>{staffProfile.displayName}</strong> (
              <span className="uppercase">{activeFacility.role}</span>) ·{" "}
              <strong>{activeFacility.facilityName}</strong> (
              <code className="mf-mono text-[13px] text-[var(--mf-text)]">
                {activeFacility.facilityPublicCode}
              </code>
              )
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {staffProfile.memberships.length > 1 && (
              <div className="w-[220px]">
                <Select
                  aria-label="Active facility"
                  value={activeFacilityId}
                  onChange={(e) => {
                    setIsLoading(true);
                    setErrorMessage(null);
                    setActiveFacilityId(e.target.value);
                  }}
                >
                  {staffProfile.memberships.map((m) => (
                    <option key={m.facilityId} value={m.facilityId}>
                      {m.facilityName} ({m.facilityId})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={triggerReload}
              disabled={isLoading}
              data-testid="admin-refresh-btn"
            >
              <Icon name="refresh" size="sm" spin={isLoading} />
              Refresh metrics
            </Button>

            <ButtonLink
              href="/staff/queue"
              variant="primary"
              size="sm"
              data-testid="admin-open-queue-btn"
            >
              <Icon name="list" size="sm" />
              Inspect Clinical Queue
              <Icon name="arrow" size="sm" />
            </ButtonLink>
          </div>
        </div>

        {errorMessage && (
          <Alert tone="danger" title="Facility overview unavailable">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{errorMessage}</span>
              <Button variant="secondary" size="sm" onClick={triggerReload}>
                <Icon name="refresh" size="sm" />
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {isLoading && !overview ? (
          <ClinicalPanel
            source="nurse"
            sourceLabel="Administrator view"
            title="Loading facility governance overview"
            subtitle="Querying GET /api/staff/admin/facility from Neon PostgreSQL"
          >
            <div className="grid gap-2 py-2" aria-busy="true">
              <span className="mf-skel h-12 w-full" />
              <span className="mf-skel h-12 w-full" />
            </div>
          </ClinicalPanel>
        ) : overview ? (
          <>
            {/* 1. Live PostgreSQL Facility Metrics Summary Cards */}
            <div
              className="grid gap-4 sm:grid-cols-3"
              data-testid="admin-facility-metrics"
            >
              <div className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4">
                <div className="mf-eyebrow">Active Staff Memberships</div>
                <div
                  className="mf-mono mt-1.5 text-[28px] font-bold text-[var(--mf-text)]"
                  data-testid="metric-active-staff"
                >
                  {overview.metrics.activeStaffCount}
                </div>
                <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
                  Provisioned &amp; active staff profiles scoped to{" "}
                  <code className="mf-mono text-[12px]">
                    {overview.facility.facilityPublicCode}
                  </code>
                </p>
              </div>

              <div className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4">
                <div className="mf-eyebrow">Stored Patient Intakes</div>
                <div
                  className="mf-mono mt-1.5 text-[28px] font-bold text-[var(--mf-text)]"
                  data-testid="metric-total-intakes"
                >
                  {overview.metrics.totalIntakesCount}
                </div>
                <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
                  Total intake records stored in Neon PostgreSQL for this
                  facility
                </p>
              </div>

              <div className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4">
                <div className="mf-eyebrow">Unassigned Priority Intakes</div>
                <div
                  className="mf-mono mt-1.5 text-[28px] font-bold text-[var(--mf-text)]"
                  data-testid="metric-unassigned-intakes"
                >
                  {overview.metrics.unassignedIntakesCount}
                </div>
                <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
                  Intakes awaiting initial operational review priority assignment
                </p>
              </div>
            </div>

            {/* 2. Facility Configuration & Tenant Scope */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ClinicalPanel
                source="nurse"
                sourceLabel="Facility Registry · PostgreSQL"
                title="Canonical facility profile"
                subtitle={`Last synced: ${formatTimestamp(overview.fetchedAt)}`}
                action={
                  <Badge tone={overview.facility.active ? "success" : "danger"}>
                    {overview.facility.active ? "Active Facility" : "Inactive"}
                  </Badge>
                }
              >
                <dl className="mf-dl m-0">
                  <dt>Facility name</dt>
                  <dd className="font-semibold text-[var(--mf-text)]">
                    {overview.facility.facilityName}
                  </dd>
                  <dt>Facility ID (Primary Key)</dt>
                  <dd className="mf-mono text-[13px]">
                    {overview.facility.facilityId}
                  </dd>
                  <dt>Public check-in code</dt>
                  <dd className="mf-mono text-[13px]">
                    {overview.facility.facilityPublicCode}
                  </dd>
                  <dt>Operational timezone</dt>
                  <dd className="mf-mono text-[13px]">
                    {overview.facility.timezone}
                  </dd>
                  <dt>Data environment</dt>
                  <dd>
                    {overview.facility.isDemo
                      ? "Synthetic demonstration clinic (DEMO DATA ONLY)"
                      : "Standard facility"}
                  </dd>
                </dl>
              </ClinicalPanel>

              <ClinicalPanel
                source="nurse"
                sourceLabel="Role & Access Control"
                title="Provisioned synthetic staff identities"
                subtitle="Seeded deterministically via src/db/seed.ts in Neon PostgreSQL"
                action={<Badge tone="brand">RBAC Enforced</Badge>}
              >
                <div className="grid gap-3">
                  <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
                        {SYNTHETIC_DEMO_IDENTITIES.admin.displayName}
                      </span>
                      <Badge tone="brand">Role: admin</Badge>
                    </div>
                    <div className="mf-mono mt-1 text-[12px] text-[var(--mf-text-secondary)]">
                      UID: {SYNTHETIC_DEMO_IDENTITIES.admin.uid} ·{" "}
                      {SYNTHETIC_DEMO_IDENTITIES.admin.email}
                    </div>
                    <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
                      Authorized for facility administration overview (
                      <code className="mf-mono">/staff/admin</code>) and read
                      inspection of the facility queue (
                      <code className="mf-mono">/staff/queue</code>).
                    </p>
                  </div>

                  <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
                        {SYNTHETIC_DEMO_IDENTITIES.clinical_staff.displayName}
                      </span>
                      <Badge tone="info">Role: nurse</Badge>
                    </div>
                    <div className="mf-mono mt-1 text-[12px] text-[var(--mf-text-secondary)]">
                      UID: {SYNTHETIC_DEMO_IDENTITIES.clinical_staff.uid} ·{" "}
                      {SYNTHETIC_DEMO_IDENTITIES.clinical_staff.email}
                    </div>
                    <p className="m-0 mt-1 text-[12.5px] text-[var(--mf-text-secondary)]">
                      Authorized for clinical queue operations (
                      <code className="mf-mono">/staff/queue</code>). Blocked
                      from <code className="mf-mono">/staff/admin</code> and{" "}
                      <code className="mf-mono">
                        GET /api/staff/admin/facility
                      </code>{" "}
                      with HTTP 403.
                    </p>
                  </div>
                </div>
              </ClinicalPanel>
            </div>

            {/* 3. Governance & Phase Boundaries */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="Governance boundaries"
              title="Administrative scope & clinical safety rules"
              subtitle="Verified server-side role boundaries for the active facility"
            >
              <div className="grid gap-3 text-[13.5px] text-[var(--mf-text-secondary)] md:grid-cols-2">
                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3.5">
                  <strong className="block text-[var(--mf-text)]">
                    Staff provisioning boundary
                  </strong>
                  <span className="mt-1 block">
                    Staff profiles and facility memberships are provisioned via
                    controlled CLI seeding (<code className="mf-mono">npm run db:seed</code>)
                    or database migrations. Self-service privilege escalation is
                    impossible from the browser.
                  </span>
                </div>

                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3.5">
                  <strong className="block text-[var(--mf-text)]">
                    Clinical workflow authority
                  </strong>
                  <span className="mt-1 block">
                    Operational intake priority and clinical brief review remain
                    under qualified clinical staff control. Administrators can
                    inspect the facility queue to monitor operational readiness.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mf-border)] pt-3">
                <span className="text-[13px] text-[var(--mf-text-secondary)]">
                  Want to inspect the clinical intake queue for{" "}
                  <strong>{overview.facility.facilityName}</strong>?
                </span>
                <ButtonLink href="/staff/queue" variant="primary" size="sm">
                  <Icon name="list" size="sm" />
                  Open Clinical Intake Queue (/staff/queue)
                  <Icon name="arrow" size="sm" />
                </ButtonLink>
              </div>
            </ClinicalPanel>
          </>
        ) : null}
      </div>
    </StaffWorkspaceLayout>
  );
}

export function StaffAdminShell() {
  return (
    <StaffAccessGate
      surfaceTitle="Facility Administration Workspace"
      surfaceSubtitle="Administrator-only facility governance and PostgreSQL readiness overview"
    >
      {(context) => <AuthorizedStaffAdmin {...context} />}
    </StaffAccessGate>
  );
}
