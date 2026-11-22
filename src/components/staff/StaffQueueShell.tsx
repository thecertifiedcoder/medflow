"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { PageContainer } from "@/components/layout/PageContainer";
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
  Card,
  CardBody,
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

  return (
    <PageContainer width="wide">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-[var(--mf-brand)] uppercase">
            <span
              className="h-px w-6 bg-[var(--mf-brand)]"
              aria-hidden="true"
            />
            Facility-scoped staff workspace
          </div>
          <h1 className="mf-display mt-0 mb-1.5 text-[34px] leading-[1.08] font-normal tracking-[-0.03em] text-[var(--mf-ink)]">
            Clinical intake queue.
          </h1>
          <p className="m-0 text-[14px] text-[var(--mf-muted)]">
            Signed in as <strong>{staffProfile.displayName}</strong> (
            <span className="capitalize">{staffProfile.role}</span>) · Facility{" "}
            <code className="mf-mono text-[12px] text-[var(--mf-ink)]">
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
          <Badge tone="success" dot>
            {listenerReady ? "Live facility listener" : "Connecting queue"}
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void signOutStaff()}
          >
            Sign out
          </Button>
        </div>
      </div>

      <Card>
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mf-line)] pb-3">
            <div>
              <h2 className="m-0 text-[15px] font-bold text-[var(--mf-ink)]">
                Active submissions ({rows.length})
              </h2>
              <p className="m-0 text-[12px] text-[var(--mf-muted)]">
                Ordered deterministically: unassigned intakes first, then
                staff-assigned workflow priority, oldest first.
              </p>
            </div>
            <Badge tone="brand">Staff-controlled priority</Badge>
          </div>

          {!listenerReady ? (
            <p className="m-0 py-6 text-center text-[13px] text-[var(--mf-muted)]">
              Connecting to facility-scoped Firestore queue...
            </p>
          ) : rows.length === 0 ? (
            <Alert tone="info" title="No intake records in this facility yet">
              Your authenticated facility-scoped Firestore query succeeded with
              zero records. Synthetic patient intake submission and staff-side
              AI extraction workflows are scheduled for Milestone 2 after
              Milestone 1B approval.
            </Alert>
          ) : (
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--mf-line)] bg-[var(--mf-surface-soft)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="mf-mono text-[13px] font-semibold text-[var(--mf-ink)]">
                      {row.referenceCode}
                    </span>
                    {row.patientDisplayName && (
                      <span className="text-[13px] text-[var(--mf-muted)]">
                        {row.patientDisplayName}
                      </span>
                    )}
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
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </PageContainer>
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
