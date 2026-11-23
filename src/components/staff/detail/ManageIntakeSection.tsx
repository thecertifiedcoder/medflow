"use client";

import { Badge, Button, Icon, Select } from "@/components/ui";
import {
  getAllowedStatusTransitions,
  WORKFLOW_PRIORITY_LABELS,
  WORKFLOW_STATUS_LABELS,
  type StaffAssignedPriority,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  AssignableStaffPriority,
  StaffIntakeDetailRecord,
} from "@/lib/schemas/staff-api";
import {
  getAssignedPriorityBadge,
  getQueueWorkflowBadge,
} from "@/lib/staff/queue-helpers";

interface ManageIntakeSectionProps {
  readonly intake: StaffIntakeDetailRecord;
  readonly isClinicalReviewer: boolean;
  readonly isMutatingWorkflow: boolean;
  readonly selectedPriority: StaffAssignedPriority;
  readonly selectedStatus: WorkflowStatus;
  readonly noteInput: string;
  readonly onChangePriority: (value: StaffAssignedPriority) => void;
  readonly onChangeStatus: (value: WorkflowStatus) => void;
  readonly onChangeNote: (value: string) => void;
  readonly onSaveChanges: () => void;
}

export function ManageIntakeSection({
  intake,
  isClinicalReviewer,
  isMutatingWorkflow,
  selectedPriority,
  selectedStatus,
  noteInput,
  onChangePriority,
  onChangeStatus,
  onChangeNote,
  onSaveChanges,
}: ManageIntakeSectionProps) {
  const currentPriority = intake.workflow.staffAssignedPriority;
  const currentStatus = intake.workflow.workflowStatus;
  const allowedNextStatuses = getAllowedStatusTransitions(currentStatus);

  const priorityChanged =
    selectedPriority !== currentPriority && selectedPriority !== "unassigned";
  const statusChanged = selectedStatus !== currentStatus;
  const hasPendingChange = priorityChanged || statusChanged;

  const isChangingExistingPriority =
    priorityChanged && currentPriority !== "unassigned";

  const currentWorkflowBadge = getQueueWorkflowBadge(currentStatus);
  const currentPriorityBadge = getAssignedPriorityBadge(currentPriority);

  const statusOptions: WorkflowStatus[] = [
    currentStatus,
    ...allowedNextStatuses,
  ];

  const canAssignPriority = (val: StaffAssignedPriority): val is AssignableStaffPriority =>
    val !== "unassigned";

  return (
    <section
      aria-labelledby="manage-intake-heading"
      className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5"
      data-testid="manage-intake-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mf-border)] pb-3">
        <div className="grid gap-0.5">
          <h2
            id="manage-intake-heading"
            className="mf-t-card m-0 text-[var(--mf-text)]"
          >
            Manage Intake
          </h2>
          <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
            Operational priority and follow-up status are always decided by
            clinical staff, never by AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={currentWorkflowBadge.tone}>
            {currentWorkflowBadge.label}
          </Badge>
          {currentPriorityBadge ? (
            <Badge tone={currentPriorityBadge.tone}>
              {currentPriorityBadge.label}
            </Badge>
          ) : (
            <Badge tone="neutral">Priority not assigned</Badge>
          )}
        </div>
      </div>

      {intake.workflow.priorityReason && (
        <div className="rounded-[4px] bg-[var(--mf-surface-subtle)] px-3.5 py-2.5 text-[13px] text-[var(--mf-text)]">
          <span className="font-semibold">Recorded reason: </span>
          {intake.workflow.priorityReason}
        </div>
      )}

      {isClinicalReviewer ? (
        <div className="grid gap-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="mf-field">
              <label htmlFor="priority-select" className="mf-label">
                <span>Operational priority</span>
              </label>
              <Select
                id="priority-select"
                value={selectedPriority}
                onChange={(e) =>
                  onChangePriority(e.target.value as StaffAssignedPriority)
                }
                data-testid="priority-select"
              >
                {currentPriority === "unassigned" && (
                  <option value="unassigned">Select priority...</option>
                )}
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

            <div className="mf-field">
              <label htmlFor="workflow-status-select" className="mf-label">
                <span>Workflow status</span>
              </label>
              <Select
                id="workflow-status-select"
                value={selectedStatus}
                disabled={allowedNextStatuses.length === 0}
                onChange={(e) =>
                  onChangeStatus(e.target.value as WorkflowStatus)
                }
                data-testid="workflow-status-select"
              >
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {WORKFLOW_STATUS_LABELS[st]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mf-field">
            <label htmlFor="manage-intake-note" className="mf-label">
              <span>Reason or note</span>
              <span className="mf-label__req">
                {isChangingExistingPriority
                  ? "Required when changing priority (min 3 chars)"
                  : "Optional"}
              </span>
            </label>
            <input
              id="manage-intake-note"
              type="text"
              className="mf-input"
              maxLength={500}
              placeholder={
                isChangingExistingPriority
                  ? "Explain why the operational priority is changing..."
                  : "Add a brief clinical or operational note (optional)"
              }
              value={noteInput}
              onChange={(e) => onChangeNote(e.target.value)}
              data-testid="manage-intake-note-input"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isMutatingWorkflow}
              disabled={
                isMutatingWorkflow ||
                (!hasPendingChange && !canAssignPriority(selectedPriority))
              }
              onClick={onSaveChanges}
              data-testid="save-workflow-btn"
            >
              <Icon name="check" size="sm" />
              Save Changes
            </Button>

            {!hasPendingChange && (
              <span className="text-[12.5px] text-[var(--mf-text-secondary)]">
                Select a new priority or workflow status to save an update.
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
          Priority and workflow status changes are restricted to clinical staff
          (nurses and doctors).
        </p>
      )}
    </section>
  );
}
