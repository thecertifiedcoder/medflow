"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  StaffAccessGate,
  type AuthorizedStaffContext,
} from "@/components/staff/StaffAccessGate";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  ConnectionChip,
  Icon,
  PriorityLabel,
  Select,
  type ConnectionState,
} from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import {
  WORKFLOW_PRIORITY_LABELS,
  WORKFLOW_STATUS_LABELS,
  type AiStatus,
  type StaffAssignedPriority,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  StaffAdminFacilityOverviewResponse,
  StaffQueueItem,
  StaffQueueResponse,
} from "@/lib/schemas/staff-api";
import {
  fetchStaffAdminFacilityOverview,
  fetchStaffQueue,
  StaffApiClientError,
} from "@/lib/staff/api-client";
import {
  createVisibilityAwarePoller,
  QUEUE_POLL_INTERVAL_MS,
  type VisibilityPollerController,
} from "@/lib/staff/polling";

const PAGE_SIZE = 25;

const AI_STATUS_BADGE: Record<
  AiStatus,
  { readonly label: string; readonly tone: "neutral" | "info" | "success" | "warning" | "caution" }
> = {
  queued: { label: "AI queued", tone: "neutral" },
  processing: { label: "AI processing", tone: "info" },
  succeeded: { label: "AI draft ready", tone: "info" },
  failed: { label: "AI unavailable", tone: "warning" },
  needs_human_clarification: { label: "Needs clarification", tone: "caution" },
};

function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuthorizedStaffQueue({
  staffProfile,
  serverSession,
  activeFacility,
  activeFacilityId,
  getIdToken,
  handleSessionExpired,
}: AuthorizedStaffContext) {
  const { setActiveFacilityId, signOutStaff } = useStaffAuth();
  const [queueData, setQueueData] = useState<StaffQueueResponse | null>(null);
  const [adminOverview, setAdminOverview] =
    useState<StaffAdminFacilityOverviewResponse | null>(null);
  const [adminOverviewError, setAdminOverviewError] = useState<string | null>(
    null,
  );
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPausedHidden, setIsPausedHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<
    StaffAssignedPriority | ""
  >("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [offset, setOffset] = useState(0);

  const isAdminRole = activeFacility.role === "admin";
  const isDemoSession = serverSession.authMode === "demo";

  const queryKey = `${activeFacilityId}|${workflowFilter}|${priorityFilter}|${includeCompleted}|${offset}`;
  const isInitialLoading = loadedQueryKey !== queryKey && errorMessage === null;

  const pollerRef = useRef<VisibilityPollerController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchSequenceRef = useRef(0);

  const loadQueue = useCallback(async () => {
    const seq = ++fetchSequenceRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Defer refreshing indicator to an async microtask so poller.start() inside
    // useEffect never triggers a synchronous setState during React commit.
    await Promise.resolve();
    if (seq !== fetchSequenceRef.current || controller.signal.aborted) return;
    setIsRefreshing(true);

    try {
      const response = await fetchStaffQueue({
        getIdToken,
        facilityId: activeFacilityId,
        workflowStatus: workflowFilter,
        priority: priorityFilter,
        includeCompleted,
        limit: PAGE_SIZE,
        offset,
        signal: controller.signal,
      });

      if (seq !== fetchSequenceRef.current) return;

      setQueueData(response);
      setLoadedQueryKey(queryKey);
      setErrorMessage(null);
    } catch (err) {
      if (seq !== fetchSequenceRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }

      setLoadedQueryKey(queryKey);
      setErrorMessage(
        err instanceof StaffApiClientError
          ? err.message
          : "Unable to refresh the facility queue from the server. Retry shortly.",
      );
    } finally {
      if (seq === fetchSequenceRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [
    activeFacilityId,
    getIdToken,
    handleSessionExpired,
    includeCompleted,
    offset,
    priorityFilter,
    queryKey,
    workflowFilter,
  ]);

  useEffect(() => {
    const poller = createVisibilityAwarePoller({
      intervalMs: QUEUE_POLL_INTERVAL_MS,
      task: loadQueue,
      onVisibilityPauseChange: setIsPausedHidden,
    });

    pollerRef.current = poller;
    poller.start();

    return () => {
      poller.stop();
      pollerRef.current = null;
      abortControllerRef.current?.abort();
    };
  }, [loadQueue]);

  useEffect(() => {
    if (!isAdminRole) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadAdminOverview = async () => {
      try {
        const overview = await fetchStaffAdminFacilityOverview({
          getIdToken,
          facilityId: activeFacilityId,
          signal: controller.signal,
        });
        if (cancelled) return;
        setAdminOverview(overview);
        setAdminOverviewError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof StaffApiClientError && err.isAuthExpired) {
          handleSessionExpired(err.message);
          return;
        }
        setAdminOverviewError(
          err instanceof StaffApiClientError
            ? err.message
            : "Unable to load facility administration overview.",
        );
      }
    };

    void loadAdminOverview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeFacilityId, getIdToken, handleSessionExpired, isAdminRole]);

  const visibleAdminOverview =
    isAdminRole && adminOverview?.facility.facilityId === activeFacilityId
      ? adminOverview
      : null;
  const visibleAdminOverviewError = isAdminRole ? adminOverviewError : null;

  const rows: readonly StaffQueueItem[] = queueData?.items ?? [];
  const totalCount = queueData?.pagination.total ?? 0;
  const unassignedCount = queueData?.counts.unassigned ?? 0;
  const aiUnavailableCount = queueData?.counts.aiUnavailable ?? 0;
  const hasMore = queueData?.pagination.hasMore ?? false;
  const pageStart = totalCount === 0 ? 0 : offset + 1;
  const pageEnd = offset + rows.length;

  let connectionState: ConnectionState = "connected";
  let connectionLabel = "Live · 5s sync";

  if (errorMessage) {
    connectionState = "unavailable";
    connectionLabel = "Queue sync error";
  } else if (isPausedHidden) {
    connectionState = "updating";
    connectionLabel = "Paused · tab hidden";
  } else if (isInitialLoading || isRefreshing) {
    connectionState = "updating";
    connectionLabel = isInitialLoading ? "Loading queue" : "Syncing queue";
  }

  return (
    <div className="mf-dash-wrap">
      <div className="mf-dash">
        <aside className="mf-dash__nav" aria-label="Staff workspace navigation">
          <div className="mf-nav__label">Workspace</div>
          <Link
            href="/staff/queue"
            aria-current="page"
            className="mf-nav__item"
          >
            <Icon name="list" size="md" />
            <span>Patient queue</span>
            <span className="mf-nav__count">{totalCount}</span>
          </Link>
          <Link href="/" className="mf-nav__item">
            <Icon name="clipboard" size="md" />
            <span>Overview</span>
          </Link>

          <div className="mf-nav__foot grid gap-1.5">
            <div className="font-semibold text-white">
              {staffProfile.displayName}
            </div>
            <div className="capitalize">
              {isDemoSession
                ? serverSession.demoPersona === "admin"
                  ? "Demo Administrator (admin)"
                  : "Demo Clinical Staff (nurse)"
                : activeFacility.role}
            </div>
            <div className="mf-mono text-[11px]">{activeFacilityId}</div>
          </div>
        </aside>

        <main className="mf-dash__detail">
          <div className="mf-detail-head justify-between">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mf-eyebrow">
                  Facility-scoped staff workspace
                </span>
                {isDemoSession && (
                  <Badge tone="brand" icon="shield">
                    {serverSession.demoPersona === "admin"
                      ? "Hackathon Demo · Administrator"
                      : "Hackathon Demo · Clinical Staff"}
                  </Badge>
                )}
              </div>
              <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
                Clinical intake queue
              </h1>
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Signed in as <strong>{staffProfile.displayName}</strong> (
                <span className="capitalize">{activeFacility.role}</span>) ·{" "}
                <strong>{activeFacility.facilityName}</strong> (
                <code className="mf-mono text-[13px] text-[var(--mf-text)]">
                  {activeFacilityId}
                </code>
                )
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {staffProfile.memberships.length > 1 && (
                <div className="w-[220px]">
                  <Select
                    aria-label="Active facility"
                    value={activeFacilityId}
                    onChange={(e) => {
                      setOffset(0);
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
              <ConnectionChip state={connectionState} label={connectionLabel} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void pollerRef.current?.triggerNow()}
                disabled={isRefreshing}
              >
                <Icon name="refresh" size="sm" spin={isRefreshing} />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void signOutStaff()}
              >
                Sign out
              </Button>
            </div>
          </div>

          {isAdminRole && (
            <ClinicalPanel
              source="nurse"
              sourceLabel="Administrator view"
              title="Facility administration overview"
              subtitle="Read-only PostgreSQL summary restricted strictly to the administrator role."
              action={<Badge tone="brand">Role: admin</Badge>}
              className="mb-5"
            >
              {visibleAdminOverviewError ? (
                <Alert tone="warning" title="Facility overview unavailable">
                  {visibleAdminOverviewError}
                </Alert>
              ) : visibleAdminOverview ? (
                <div className="grid gap-3">
                  <dl className="mf-dl m-0">
                    <dt>Facility ID / Public code</dt>
                    <dd className="mf-mono text-[13px]">
                      {visibleAdminOverview.facility.facilityId} ·{" "}
                      {visibleAdminOverview.facility.facilityPublicCode}
                    </dd>
                    <dt>Facility type &amp; timezone</dt>
                    <dd>
                      {visibleAdminOverview.facility.isDemo
                        ? "Synthetic demo clinic"
                        : "Facility"}{" "}
                      · {visibleAdminOverview.facility.timezone}
                    </dd>
                    <dt>Active staff memberships</dt>
                    <dd className="mf-mono text-[13px]">
                      {visibleAdminOverview.metrics.activeStaffCount}
                    </dd>
                    <dt>Stored intake records</dt>
                    <dd className="mf-mono text-[13px]">
                      {visibleAdminOverview.metrics.totalIntakesCount} total (
                      {visibleAdminOverview.metrics.unassignedIntakesCount}{" "}
                      unassigned)
                    </dd>
                  </dl>
                  <p className="m-0 text-[12px] text-[var(--mf-text-secondary)]">
                    Current scope (DA-1): read-only facility governance summary.
                    Staff account provisioning remains controlled via CLI
                    seeding, and intake mutations activate in Milestone 2.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[13px] text-[var(--mf-text-secondary)]">
                  <Icon name="loader" size="sm" spin />
                  <span>Loading administrator facility overview...</span>
                </div>
              )}
            </ClinicalPanel>
          )}

          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff-controlled priority"
            title={`Active submissions (${totalCount})`}
            subtitle="Ordered deterministically: unassigned intakes first, then staff-assigned workflow priority, oldest first. Auto-refreshes every 5 seconds while tab is visible."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {unassignedCount > 0 ? (
                  <Badge tone="warning" icon="clock">
                    {unassignedCount} unassigned
                  </Badge>
                ) : null}
                {aiUnavailableCount > 0 ? (
                  <Badge tone="caution" icon="alert">
                    {aiUnavailableCount} AI unavailable
                  </Badge>
                ) : null}
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="queue-status-filter"
                  className="mf-t-label mb-1 block text-[var(--mf-text-secondary)]"
                >
                  Workflow status
                </label>
                <Select
                  id="queue-status-filter"
                  value={workflowFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setWorkflowFilter(e.target.value as WorkflowStatus | "");
                  }}
                >
                  <option value="">All active statuses</option>
                  <option value="new">{WORKFLOW_STATUS_LABELS.new}</option>
                  <option value="in_review">
                    {WORKFLOW_STATUS_LABELS.in_review}
                  </option>
                  <option value="awaiting_clarification">
                    {WORKFLOW_STATUS_LABELS.awaiting_clarification}
                  </option>
                  <option value="completed">
                    {WORKFLOW_STATUS_LABELS.completed}
                  </option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="queue-priority-filter"
                  className="mf-t-label mb-1 block text-[var(--mf-text-secondary)]"
                >
                  Staff-assigned priority
                </label>
                <Select
                  id="queue-priority-filter"
                  value={priorityFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setPriorityFilter(
                      e.target.value as StaffAssignedPriority | "",
                    );
                  }}
                >
                  <option value="">All priorities</option>
                  <option value="unassigned">
                    {WORKFLOW_PRIORITY_LABELS.unassigned}
                  </option>
                  <option value="immediate_review">
                    {WORKFLOW_PRIORITY_LABELS.immediate_review}
                  </option>
                  <option value="priority_review">
                    {WORKFLOW_PRIORITY_LABELS.priority_review}
                  </option>
                  <option value="routine_review">
                    {WORKFLOW_PRIORITY_LABELS.routine_review}
                  </option>
                </Select>
              </div>

              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-[14px] text-[var(--mf-text)]">
                  <input
                    type="checkbox"
                    checked={includeCompleted}
                    disabled={workflowFilter === "completed"}
                    onChange={(e) => {
                      setOffset(0);
                      setIncludeCompleted(e.target.checked);
                    }}
                  />
                  <span>Include completed intake records</span>
                </label>
              </div>
            </div>

            {errorMessage && (
              <Alert tone="danger" title="Queue refresh unavailable">
                <div className="grid gap-2">
                  <span>{errorMessage}</span>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void pollerRef.current?.triggerNow()}
                    >
                      <Icon name="refresh" size="sm" />
                      Retry queue sync
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {isInitialLoading ? (
              <div className="grid gap-2 py-2" aria-busy="true">
                <span className="mf-skel h-12 w-full" />
                <span className="mf-skel h-12 w-full" />
              </div>
            ) : rows.length === 0 && !errorMessage ? (
              <div className="grid gap-3">
                <div className="mf-empty">
                  <Icon
                    name="inbox"
                    size="xl"
                    className="text-[var(--mf-text-secondary)]"
                  />
                  <div className="mf-empty__title">
                    No intake records match this facility view
                  </div>
                  <p className="mf-t-body-sm m-0 max-w-[46ch]">
                    Your server-authorized PostgreSQL facility query succeeded
                    with zero matching records.
                  </p>
                </div>
                <Alert tone="info" title="Milestone 2 intake pipeline pending">
                  Synthetic patient intake submission and staff-side AI
                  extraction workflows activate in Milestone 2 after approval.
                  Workflow priority remains exclusively staff-controlled.
                </Alert>
              </div>
            ) : rows.length > 0 ? (
              <div className="-mx-4 -mb-4">
                <div className="mf-queue__band">
                  <span>
                    Facility queue · {activeFacility.facilityPublicCode}
                  </span>
                  <span className="mf-mono">
                    Showing {pageStart}–{pageEnd} of {totalCount}
                  </span>
                </div>
                <ul className="mf-queue m-0 list-none p-0">
                  {rows.map((row) => {
                    const aiBadge = AI_STATUS_BADGE[row.aiStatus];
                    return (
                      <li
                        key={row.id}
                        className="mf-qitem"
                        data-priority={row.staffAssignedPriority}
                      >
                        <div className="mf-qitem__link">
                          <div className="grid gap-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="mf-t-data text-[var(--mf-text)]">
                                {row.referenceCode}
                              </span>
                              {row.patientDisplayName ? (
                                <span className="font-medium text-[var(--mf-text-secondary)]">
                                  {row.patientDisplayName}
                                </span>
                              ) : null}
                              {row.age !== null ? (
                                <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                                  {row.age}y
                                </span>
                              ) : null}
                              {row.demoRecord ? (
                                <Badge tone="neutral">DEMO DATA</Badge>
                              ) : null}
                              <PriorityLabel
                                priority={row.staffAssignedPriority}
                              />
                              <Badge tone="neutral">
                                {WORKFLOW_STATUS_LABELS[row.workflowStatus]}
                              </Badge>
                              <Badge tone={aiBadge.tone}>{aiBadge.label}</Badge>
                            </div>
                            <div className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                              Submitted {formatShortTimestamp(row.createdAt)} ·{" "}
                              {row.inputMode === "voice"
                                ? "Voice intake"
                                : "Typed intake"}{" "}
                              · Review:{" "}
                              {row.staffReviewStatus.replaceAll("_", " ")}
                            </div>
                          </div>

                          <ButtonLink
                            href={`/staff/intakes/${encodeURIComponent(row.id)}`}
                            variant="secondary"
                            size="sm"
                          >
                            Inspect record
                            <Icon name="arrow" size="sm" />
                          </ButtonLink>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {(offset > 0 || hasMore) && (
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--mf-border)] px-4 py-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={offset === 0 || isRefreshing}
                      onClick={() =>
                        setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
                      }
                    >
                      <Icon name="arrowLeft" size="sm" />
                      Previous
                    </Button>
                    <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                      {pageStart}–{pageEnd} of {totalCount}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!hasMore || isRefreshing}
                      onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                    >
                      Next
                      <Icon name="arrow" size="sm" />
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </ClinicalPanel>
        </main>
      </div>
    </div>
  );
}

export function StaffQueueShell() {
  return (
    <StaffAccessGate
      surfaceTitle="Staff authentication required"
      surfaceSubtitle="Facility-scoped clinical intake queue"
    >
      {(context) => <AuthorizedStaffQueue {...context} />}
    </StaffAccessGate>
  );
}
