"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Icon,
  Select,
} from "@/components/ui";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import {
  WORKFLOW_PRIORITY_LABELS,
  WORKFLOW_STATUS_LABELS,
  type StaffAssignedPriority,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  StaffQueueItem,
  StaffQueueResponse,
} from "@/lib/schemas/staff-api";
import {
  fetchStaffQueue,
  StaffApiClientError,
} from "@/lib/staff/api-client";
import {
  createVisibilityAwarePoller,
  QUEUE_POLL_INTERVAL_MS,
  type VisibilityPollerController,
} from "@/lib/staff/polling";
import {
  buildQueueSummaryText,
  filterQueueItemsByPrimaryTab,
  formatClinicalTimestamp,
  getAssignedPriorityBadge,
  getPatientDisplayTitle,
  getQueueAiStateBadge,
  getQueueWorkflowBadge,
  type QueuePrimaryTab,
} from "@/lib/staff/queue-helpers";

const PAGE_SIZE = 25;

const PRIMARY_TABS: ReadonlyArray<{
  readonly id: QueuePrimaryTab;
  readonly label: string;
}> = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "in_progress", label: "In Progress" },
];

function AuthorizedStaffQueue(context: AuthorizedStaffContext) {
  const {
    staffProfile,
    activeFacilityId,
    getIdToken,
    handleSessionExpired,
  } = context;
  const { setActiveFacilityId } = useStaffAuth();

  const [queueData, setQueueData] = useState<StaffQueueResponse | null>(null);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPausedHidden, setIsPausedHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [primaryTab, setPrimaryTab] = useState<QueuePrimaryTab>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<
    StaffAssignedPriority | ""
  >("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [offset, setOffset] = useState(0);

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
          : "Unable to refresh the queue right now. Please try again.",
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

  const rawRows: readonly StaffQueueItem[] = useMemo(
    () => queueData?.items ?? [],
    [queueData],
  );
  const visibleRows = useMemo(
    () =>
      workflowFilter !== ""
        ? rawRows
        : filterQueueItemsByPrimaryTab(rawRows, primaryTab),
    [rawRows, primaryTab, workflowFilter],
  );

  const totalCount = queueData?.pagination.total ?? 0;
  const unassignedCount = queueData?.counts.unassigned ?? 0;
  const aiUnavailableCount = queueData?.counts.aiUnavailable ?? 0;
  const needsAttentionCount = Math.max(unassignedCount, aiUnavailableCount);
  const hasMore = queueData?.pagination.hasMore ?? false;
  const pageStart = totalCount === 0 ? 0 : offset + 1;
  const pageEnd = offset + rawRows.length;

  const activeAdvancedFilterCount =
    (workflowFilter !== "" ? 1 : 0) +
    (priorityFilter !== "" ? 1 : 0) +
    (includeCompleted ? 1 : 0);
  const hasAnyActiveFilter =
    activeAdvancedFilterCount > 0 || primaryTab !== "all";

  const summaryText = buildQueueSummaryText({
    total: totalCount,
    needsAttentionCount,
    hasActiveFilter: activeAdvancedFilterCount > 0,
  });

  let syncDotColor = "bg-[var(--mf-success)]";
  let syncLabel = "Live";
  if (errorMessage) {
    syncDotColor = "bg-[var(--mf-danger)]";
    syncLabel = "Offline";
  } else if (isPausedHidden) {
    syncDotColor = "bg-[var(--mf-text-secondary)]";
    syncLabel = "Paused";
  } else if (isInitialLoading || isRefreshing) {
    syncDotColor = "bg-[var(--mf-info)]";
    syncLabel = "Updating";
  }

  const handleResetFilters = () => {
    setOffset(0);
    setPrimaryTab("all");
    setWorkflowFilter("");
    setPriorityFilter("");
    setIncludeCompleted(false);
  };

  return (
    <StaffWorkspaceLayout
      context={context}
      queueTotalCount={totalCount}
      activeSection="queue"
    >
      <div
        className="mx-auto grid w-full max-w-[960px] gap-5"
        data-testid="staff-queue-workspace"
      >
        {/* Page Heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
              Patient Queue
            </h1>
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Review incoming patient information and manage follow-up.
            </p>
            {!isInitialLoading && !errorMessage && (
              <p
                className="m-0 pt-0.5 text-[13px] font-medium text-[var(--mf-text-secondary)]"
                data-testid="queue-summary-strip"
              >
                {summaryText}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {staffProfile.memberships.length > 1 && (
              <div className="w-[210px]">
                <Select
                  aria-label="Active clinic"
                  value={activeFacilityId}
                  onChange={(e) => {
                    setOffset(0);
                    setActiveFacilityId(e.target.value);
                  }}
                >
                  {staffProfile.memberships.map((m) => (
                    <option key={m.facilityId} value={m.facilityId}>
                      {m.facilityName}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <span
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--mf-text-secondary)]"
              aria-live="polite"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${syncDotColor}`}
                aria-hidden="true"
              />
              {syncLabel}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void pollerRef.current?.triggerNow()}
              disabled={isRefreshing}
              data-testid="queue-refresh-btn"
            >
              <Icon name="refresh" size="sm" spin={isRefreshing} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Clean Filter Bar */}
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              role="group"
              aria-label="Queue view filter"
              className="inline-flex flex-wrap items-center gap-1 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-1"
            >
              {PRIMARY_TABS.map((tab) => {
                const isActive =
                  workflowFilter === "" && primaryTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setPrimaryTab(tab.id);
                      if (workflowFilter !== "") {
                        setOffset(0);
                        setWorkflowFilter("");
                      }
                    }}
                    data-testid={`queue-tab-${tab.id}`}
                    className={`min-h-[34px] cursor-pointer rounded-[4px] border-0 px-3 py-1 text-[13px] font-semibold transition-colors ${
                      isActive
                        ? "bg-[var(--mf-primary)] text-white"
                        : "bg-transparent text-[var(--mf-text-secondary)] hover:bg-[var(--mf-surface-subtle)] hover:text-[var(--mf-text)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {hasAnyActiveFilter && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={handleResetFilters}
                  data-testid="queue-reset-filters-btn"
                >
                  Clear filters
                </Button>
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-expanded={filtersOpen}
                aria-controls="queue-advanced-filters"
                onClick={() => setFiltersOpen((prev) => !prev)}
                data-testid="queue-filters-toggle-btn"
              >
                <Icon name="list" size="sm" />
                <span>
                  Filters
                  {activeAdvancedFilterCount > 0
                    ? ` (${activeAdvancedFilterCount})`
                    : ""}
                </span>
                <Icon
                  name="chevronDown"
                  size="sm"
                  className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </div>
          </div>

          {filtersOpen && (
            <div
              id="queue-advanced-filters"
              className="grid gap-3 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4 sm:grid-cols-3"
              data-testid="queue-advanced-filters-panel"
            >
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
                    setPrimaryTab("all");
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
                  <option value="unassigned">Not yet assigned</option>
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
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[13.5px] text-[var(--mf-text)]">
                  <input
                    type="checkbox"
                    checked={includeCompleted}
                    disabled={workflowFilter === "completed"}
                    onChange={(e) => {
                      setOffset(0);
                      setIncludeCompleted(e.target.checked);
                    }}
                  />
                  <span>Include completed records</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <Alert tone="danger" title="Unable to load patient queue">
            <div className="grid gap-2">
              <span>{errorMessage}</span>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void pollerRef.current?.triggerNow()}
                >
                  <Icon name="refresh" size="sm" />
                  Try again
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Queue Content */}
        {isInitialLoading ? (
          <div className="grid gap-3" aria-busy="true">
            <div className="mf-skel h-24 w-full rounded-[6px]" />
            <div className="mf-skel h-24 w-full rounded-[6px]" />
            <div className="mf-skel h-24 w-full rounded-[6px]" />
          </div>
        ) : visibleRows.length === 0 && !errorMessage ? (
          <div
            className="mf-empty rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-6 py-10"
            data-testid="staff-queue-empty-state"
          >
            <Icon
              name="inbox"
              size="xl"
              className="text-[var(--mf-text-secondary)]"
            />
            <div className="mf-empty__title">
              {hasAnyActiveFilter
                ? "No patients match the current filter"
                : "No patient intakes yet"}
            </div>
            <p className="mf-t-body-sm m-0 max-w-[44ch]">
              {hasAnyActiveFilter
                ? "Try switching tabs or clearing your filters to see all active patient intakes."
                : "New patient intakes submitted at check-in will appear here automatically."}
            </p>
            {hasAnyActiveFilter && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Show all active intakes
                </Button>
              </div>
            )}
          </div>
        ) : visibleRows.length > 0 ? (
          <div className="grid gap-3">
            <ul
              className="m-0 grid list-none gap-2.5 p-0"
              data-testid="staff-queue-list"
            >
              {visibleRows.map((row) => {
                const patientName = getPatientDisplayTitle(
                  row.patientDisplayName,
                );
                const workflowBadge = getQueueWorkflowBadge(row.workflowStatus);
                const aiBadge = getQueueAiStateBadge(row.aiStatus);
                const priorityBadge = getAssignedPriorityBadge(
                  row.staffAssignedPriority,
                );

                return (
                  <li
                    key={row.id}
                    className="mf-qitem overflow-hidden rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] transition-colors hover:border-[var(--mf-border-input)]"
                    data-priority={row.staffAssignedPriority}
                    data-testid={`queue-row-${row.referenceCode}`}
                  >
                    <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        {/* Identity & timestamp */}
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                          <span className="text-[16px] font-semibold text-[var(--mf-text)]">
                            {patientName}
                          </span>
                          <span className="text-[13px] text-[var(--mf-text-secondary)]">
                            {row.age !== null ? `${row.age} yrs · ` : ""}
                            Submitted {formatClinicalTimestamp(row.createdAt)}
                          </span>
                          <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                            {row.referenceCode}
                          </span>
                        </div>

                        {/* Brief patient concern preview */}
                        {row.narrativePreview ? (
                          <p className="m-0 line-clamp-2 text-[14px] leading-[1.45] text-[var(--mf-text)]">
                            &ldquo;{row.narrativePreview}&rdquo;
                          </p>
                        ) : null}

                        {/* Restrained status hierarchy: 1 workflow + 1 AI state + staff priority only when assigned */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <Badge tone={workflowBadge.tone}>
                            {workflowBadge.label}
                          </Badge>

                          {priorityBadge && (
                            <Badge tone={priorityBadge.tone}>
                              {priorityBadge.label}
                            </Badge>
                          )}

                          <Badge tone={aiBadge.tone}>{aiBadge.label}</Badge>
                        </div>
                      </div>

                      <div className="shrink-0 sm:self-center">
                        <ButtonLink
                          href={`/staff/intakes/${encodeURIComponent(row.id)}`}
                          variant="primary"
                          size="sm"
                          className="w-full sm:w-auto"
                          data-testid={`review-intake-${row.referenceCode}`}
                        >
                          Review
                          <Icon name="arrow" size="sm" />
                        </ButtonLink>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {(offset > 0 || hasMore) && (
              <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-4 py-2.5">
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
      </div>
    </StaffWorkspaceLayout>
  );
}

export function StaffQueueShell() {
  return (
    <StaffAccessGate
      surfaceTitle="Patient Queue"
      surfaceSubtitle="Sign in to review incoming patient intakes"
    >
      {(context) => <AuthorizedStaffQueue {...context} />}
    </StaffAccessGate>
  );
}
