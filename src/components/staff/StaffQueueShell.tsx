"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { FirebaseErrorBoundary } from "@/components/shared/FirebaseErrorBoundary";
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
} from "@/components/ui";
import { auth, db } from "@/lib/firebase/client";
import { handleFirestoreError, OperationType } from "@/lib/firebase/errors";
import { useStaffAuth } from "@/lib/firebase/staff-auth";
import {
  sortIntakesDeterministically,
  WORKFLOW_STATUS_LABELS,
  type StaffAssignedPriority,
  type WorkflowStatus,
} from "@/lib/schemas/intake";

interface QueueRowSummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly patientDisplayName?: string;
  readonly staffAssignedPriority: StaffAssignedPriority;
  readonly workflowStatus: WorkflowStatus;
  readonly createdAtMs: number;
}

function AuthorizedStaffQueue({
  staffProfile,
  activeFacilityId,
}: AuthorizedStaffContext) {
  const { setActiveFacilityId, signOutStaff } = useStaffAuth();
  const [rows, setRows] = useState<QueueRowSummary[]>([]);
  const [listenerReady, setListenerReady] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const queuePath = `intakes?facilityId=${activeFacilityId}`;
    const q = query(
      collection(db, "intakes"),
      where("facilityId", "==", activeFacilityId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: QueueRowSummary[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt as { toMillis?: () => number } | null;
          const createdAtMs =
            createdAt && typeof createdAt.toMillis === "function"
              ? createdAt.toMillis()
              : 0;
          return {
            id: docSnap.id,
            referenceCode:
              typeof data.referenceCode === "string"
                ? data.referenceCode
                : docSnap.id,
            patientDisplayName:
              typeof data.patientDisplayName === "string"
                ? data.patientDisplayName
                : undefined,
            staffAssignedPriority:
              data.staffAssignedPriority === "immediate_review" ||
              data.staffAssignedPriority === "priority_review" ||
              data.staffAssignedPriority === "routine_review"
                ? data.staffAssignedPriority
                : "unassigned",
            workflowStatus:
              data.workflowStatus === "in_review" ||
              data.workflowStatus === "awaiting_clarification" ||
              data.workflowStatus === "completed"
                ? data.workflowStatus
                : "new",
            createdAtMs,
          };
        });
        setRows(sortIntakesDeterministically(items));
        setListenerReady(true);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, queuePath, auth);
        } catch (wrapped) {
          setFatalError(
            wrapped instanceof Error ? wrapped : new Error(String(wrapped)),
          );
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeFacilityId]);

  const unassignedCount = rows.filter(
    (r) => r.staffAssignedPriority === "unassigned",
  ).length;

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
            <span className="mf-nav__count">{rows.length}</span>
          </Link>
          <Link href="/" className="mf-nav__item">
            <Icon name="clipboard" size="md" />
            <span>Overview</span>
          </Link>

          <div className="mf-nav__foot grid gap-1.5">
            <div className="font-semibold text-white">
              {staffProfile.displayName}
            </div>
            <div className="capitalize">{staffProfile.role}</div>
            <div className="mf-mono text-[11px]">{activeFacilityId}</div>
          </div>
        </aside>

        <main className="mf-dash__detail">
          <div className="mf-detail-head justify-between">
            <div className="grid gap-1">
              <span className="mf-eyebrow">Facility-scoped staff workspace</span>
              <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
                Clinical intake queue
              </h1>
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Signed in as <strong>{staffProfile.displayName}</strong> (
                <span className="capitalize">{staffProfile.role}</span>) ·
                Facility{" "}
                <code className="mf-mono text-[13px] text-[var(--mf-text)]">
                  {activeFacilityId}
                </code>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {staffProfile.facilityIds.length > 1 && (
                <div className="w-[220px]">
                  <Select
                    aria-label="Active facility"
                    value={activeFacilityId}
                    onChange={(e) => setActiveFacilityId(e.target.value)}
                  >
                    {staffProfile.facilityIds.map((fid) => (
                      <option key={fid} value={fid}>
                        {fid}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <ConnectionChip
                state={listenerReady ? "connected" : "updating"}
                label={listenerReady ? "Live facility listener" : "Connecting queue"}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void signOutStaff()}
              >
                Sign out
              </Button>
            </div>
          </div>

          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff-controlled priority"
            title={`Active submissions (${rows.length})`}
            subtitle="Ordered deterministically: unassigned intakes first, then staff-assigned workflow priority, oldest first."
            action={
              unassignedCount > 0 ? (
                <Badge tone="warning" icon="clock">
                  {unassignedCount} unassigned
                </Badge>
              ) : null
            }
          >
            {!listenerReady ? (
              <div className="grid gap-2 py-2" aria-busy="true">
                <span className="mf-skel h-12 w-full" />
                <span className="mf-skel h-12 w-full" />
              </div>
            ) : rows.length === 0 ? (
              <div className="grid gap-3">
                <div className="mf-empty">
                  <Icon
                    name="inbox"
                    size="xl"
                    className="text-[var(--mf-text-secondary)]"
                  />
                  <div className="mf-empty__title">
                    No intake records in this facility yet
                  </div>
                  <p className="mf-t-body-sm m-0 max-w-[46ch]">
                    Your authenticated facility-scoped Firestore query succeeded
                    with zero records.
                  </p>
                </div>
                <Alert tone="info" title="Milestone 2 intake pipeline pending">
                  Synthetic patient intake submission and staff-side AI
                  extraction workflows activate in Milestone 2 after approval.
                  Workflow priority remains exclusively staff-controlled.
                </Alert>
              </div>
            ) : (
              <div className="-mx-4 -mb-4">
                <div className="mf-queue__band">
                  <span>Facility queue · {activeFacilityId}</span>
                  <span className="mf-mono">{rows.length} records</span>
                </div>
                <ul className="mf-queue m-0 list-none p-0">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="mf-qitem"
                      data-priority={row.staffAssignedPriority}
                    >
                      <div className="mf-qitem__link">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="mf-t-data text-[var(--mf-text)]">
                            {row.referenceCode}
                          </span>
                          {row.patientDisplayName ? (
                            <span className="font-medium text-[var(--mf-text-secondary)]">
                              {row.patientDisplayName}
                            </span>
                          ) : null}
                          <PriorityLabel priority={row.staffAssignedPriority} />
                          <Badge tone="neutral">
                            {WORKFLOW_STATUS_LABELS[row.workflowStatus]}
                          </Badge>
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
                  ))}
                </ul>
              </div>
            )}
          </ClinicalPanel>
        </main>
      </div>
    </div>
  );
}

export function StaffQueueShell() {
  return (
    <FirebaseErrorBoundary title="Facility queue authorization error">
      <StaffAccessGate
        surfaceTitle="Staff authentication required"
        surfaceSubtitle="Facility-scoped clinical intake queue"
      >
        {(context) => <AuthorizedStaffQueue {...context} />}
      </StaffAccessGate>
    </FirebaseErrorBoundary>
  );
}
