"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  StaffAccessGate,
  type AuthorizedStaffContext,
} from "@/components/staff/StaffAccessGate";
import { StaffWorkspaceLayout } from "@/components/staff/StaffWorkspaceLayout";
import { ActivityHistoryDisclosure } from "@/components/staff/detail/ActivityHistoryDisclosure";
import { AiSummarySection } from "@/components/staff/detail/AiSummarySection";
import { ClinicalReviewSection } from "@/components/staff/detail/ClinicalReviewSection";
import { ManageIntakeSection } from "@/components/staff/detail/ManageIntakeSection";
import { PatientStatementSection } from "@/components/staff/detail/PatientStatementSection";
import { Alert, Badge, Button, ButtonLink, Icon } from "@/components/ui";
import type {
  ClinicalIntakeBrief,
  StaffAssignedPriority,
  WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  AssignableStaffPriority,
  StaffIntakeDetailResponse,
} from "@/lib/schemas/staff-api";
import {
  fetchStaffIntakeDetail,
  StaffApiClientError,
  startStaffIntakeReviewRequest,
  submitStaffBriefReviewRequest,
  triggerIntakeExtraction,
  updateStaffPriorityRequest,
  updateStaffWorkflowStatusRequest,
} from "@/lib/staff/api-client";
import {
  AI_UNAVAILABLE_STAFF_COPY,
  formatClinicalTimestamp,
  getAssignedPriorityBadge,
  getPatientDisplayTitle,
  getQueueWorkflowBadge,
} from "@/lib/staff/queue-helpers";

interface AuthorizedIntakeDetailProps extends AuthorizedStaffContext {
  readonly intakeId: string;
}

function AuthorizedIntakeDetail(props: AuthorizedIntakeDetailProps) {
  const {
    intakeId,
    activeFacility,
    activeFacilityId,
    getIdToken,
    handleSessionExpired,
  } = props;

  const [lookupState, setLookupState] = useState<
    "loading" | "not_found" | "error" | "found"
  >("loading");
  const [detail, setDetail] = useState<StaffIntakeDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [isMutatingBrief, setIsMutatingBrief] = useState(false);
  const [isMutatingWorkflow, setIsMutatingWorkflow] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    readonly tone: "success" | "danger";
    readonly message: string;
  } | null>(null);

  // Separate staff-reviewed summary editor state
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [editChiefConcern, setEditChiefConcern] = useState("");
  const [editClinicianSummary, setEditClinicianSummary] = useState("");
  const [editMissingUnclear, setEditMissingUnclear] = useState("");
  const [editCorrectionNote, setEditCorrectionNote] = useState("");

  // Consolidated Manage Intake state
  const [selectedPriority, setSelectedPriority] =
    useState<StaffAssignedPriority>("unassigned");
  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus>("new");
  const [workflowNoteInput, setWorkflowNoteInput] = useState("");

  const isClinicalReviewer =
    activeFacility.role === "nurse" || activeFacility.role === "doctor";

  const syncFormStateFromDetail = useCallback(
    (loaded: StaffIntakeDetailResponse) => {
      const currentBrief =
        loaded.intake.staffReview.reviewedBrief ?? loaded.intake.aiDraft.brief;
      if (currentBrief) {
        setEditChiefConcern(currentBrief.chiefConcern.value);
        setEditClinicianSummary(currentBrief.clinicianSummary);
        setEditMissingUnclear(currentBrief.missingOrUnclear.join("\n"));
      } else {
        setEditChiefConcern(
          loaded.intake.patientSource.confirmedNarrative.slice(0, 140),
        );
        setEditClinicianSummary(loaded.intake.patientSource.confirmedNarrative);
        setEditMissingUnclear("");
      }
      setEditCorrectionNote(loaded.intake.staffReview.correctionNote ?? "");

      setSelectedPriority(loaded.intake.workflow.staffAssignedPriority);
      setSelectedStatus(loaded.intake.workflow.workflowStatus);
      setWorkflowNoteInput("");
    },
    [],
  );

  const loadDetail = useCallback(() => {
    setLookupState("loading");
    setErrorMessage(null);
    setRefreshNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetchStaffIntakeDetail({
          getIdToken,
          facilityId: activeFacilityId,
          intakeId,
          signal: controller.signal,
        });
        if (cancelled) return;
        setDetail(response);
        syncFormStateFromDetail(response);
        setErrorMessage(null);
        setLookupState("found");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (err instanceof StaffApiClientError) {
          if (err.isAuthExpired) {
            handleSessionExpired(err.message);
            return;
          }
          if (err.status === 404 || err.status === 400) {
            setDetail(null);
            setLookupState("not_found");
            setErrorMessage(err.message);
            return;
          }
          setErrorMessage(err.message);
          setLookupState("error");
          return;
        }
        setErrorMessage(
          "Unable to load this patient record right now. Please try again.",
        );
        setLookupState("error");
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
    intakeId,
    refreshNonce,
    syncFormStateFromDetail,
  ]);

  const handleRetryExtraction = async () => {
    if (!isClinicalReviewer || isExtracting) return;
    setIsExtracting(true);
    setExtractionError(null);
    setFeedbackBanner(null);

    try {
      const result = await triggerIntakeExtraction({
        getIdToken,
        intakeId,
        facilityId: activeFacilityId,
      });

      const refreshed = await fetchStaffIntakeDetail({
        getIdToken,
        facilityId: activeFacilityId,
        intakeId,
      });
      setDetail(refreshed);
      syncFormStateFromDetail(refreshed);

      if (result.aiStatus === "failed") {
        setExtractionError(AI_UNAVAILABLE_STAFF_COPY.retryFailedMessage);
      } else {
        setFeedbackBanner({
          tone: "success",
          message:
            result.aiStatus === "needs_human_clarification"
              ? "AI summary updated. Some details still need clarification with the patient."
              : "AI summary generated from the patient's statement.",
        });
      }
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setExtractionError(AI_UNAVAILABLE_STAFF_COPY.retryFailedMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmSummary = async () => {
    if (!isClinicalReviewer || isMutatingBrief) return;
    setIsMutatingBrief(true);
    setFeedbackBanner(null);

    try {
      const updated = await submitStaffBriefReviewRequest({
        getIdToken,
        intakeId,
        payload: { action: "confirm", facilityId: activeFacilityId },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setIsEditingBrief(false);
      setFeedbackBanner({
        tone: "success",
        message: "AI summary confirmed and recorded in activity history.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setFeedbackBanner({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Unable to confirm the summary right now.",
      });
    } finally {
      setIsMutatingBrief(false);
    }
  };

  const handleSaveEditedSummary = async () => {
    if (!isClinicalReviewer || isMutatingBrief || !detail) return;
    const trimmedChief = editChiefConcern.trim();
    const trimmedSummary = editClinicianSummary.trim();
    const trimmedNote = editCorrectionNote.trim();

    if (trimmedChief.length < 1) {
      setFeedbackBanner({
        tone: "danger",
        message: "Please enter a chief concern before saving.",
      });
      return;
    }
    if (trimmedSummary.length < 1) {
      setFeedbackBanner({
        tone: "danger",
        message: "Please enter a clinical summary before saving.",
      });
      return;
    }
    if (trimmedNote.length < 3) {
      setFeedbackBanner({
        tone: "danger",
        message:
          "Please add a correction note of at least 3 characters explaining your changes.",
      });
      return;
    }

    const baseBrief =
      detail.intake.staffReview.reviewedBrief ?? detail.intake.aiDraft.brief;
    const missingItems = editMissingUnclear
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const reviewedBrief: ClinicalIntakeBrief = {
      schemaVersion: "1.0",
      ...(baseBrief?.languageDetected
        ? { languageDetected: baseBrief.languageDetected }
        : {}),
      chiefConcern: {
        value: trimmedChief,
        ...(baseBrief?.chiefConcern.sourceQuote
          ? { sourceQuote: baseBrief.chiefConcern.sourceQuote }
          : {}),
        certainty: baseBrief?.chiefConcern.certainty ?? "explicit",
      },
      symptoms: baseBrief?.symptoms ?? [],
      relevantContext: baseBrief?.relevantContext ?? [],
      reportedDetailsToReview: baseBrief?.reportedDetailsToReview ?? [],
      missingOrUnclear: missingItems,
      clinicianSummary: trimmedSummary,
      limitations:
        baseBrief && baseBrief.limitations.length > 0
          ? baseBrief.limitations
          : ["Staff-reviewed intake summary prepared by clinical personnel."],
    };

    setIsMutatingBrief(true);
    setFeedbackBanner(null);

    try {
      const updated = await submitStaffBriefReviewRequest({
        getIdToken,
        intakeId,
        payload: {
          action: "correct",
          facilityId: activeFacilityId,
          reviewedBrief,
          correctionNote: trimmedNote,
        },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setIsEditingBrief(false);
      setFeedbackBanner({
        tone: "success",
        message:
          "Staff-reviewed summary saved. The original patient statement and AI draft remain unchanged.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setFeedbackBanner({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Unable to save the staff-reviewed summary right now.",
      });
    } finally {
      setIsMutatingBrief(false);
    }
  };

  const handleSaveWorkflowChanges = async () => {
    if (!isClinicalReviewer || isMutatingWorkflow || !detail) return;

    const currentPriority = detail.intake.workflow.staffAssignedPriority;
    const currentStatus = detail.intake.workflow.workflowStatus;
    const trimmedNote = workflowNoteInput.trim();

    const priorityChanged =
      selectedPriority !== currentPriority && selectedPriority !== "unassigned";
    const statusChanged = selectedStatus !== currentStatus;

    if (!priorityChanged && !statusChanged) {
      return;
    }

    if (
      priorityChanged &&
      currentPriority !== "unassigned" &&
      trimmedNote.length < 3
    ) {
      setFeedbackBanner({
        tone: "danger",
        message:
          "Please provide a reason (at least 3 characters) when changing an already-assigned operational priority.",
      });
      return;
    }

    setIsMutatingWorkflow(true);
    setFeedbackBanner(null);

    try {
      let latestDetail = detail;

      if (priorityChanged) {
        latestDetail = await updateStaffPriorityRequest({
          getIdToken,
          intakeId,
          payload: {
            facilityId: activeFacilityId,
            priority: selectedPriority as AssignableStaffPriority,
            ...(trimmedNote.length > 0 ? { reason: trimmedNote } : {}),
          },
        });
      }

      if (
        statusChanged &&
        latestDetail.intake.workflow.workflowStatus !== selectedStatus
      ) {
        if (
          latestDetail.intake.workflow.workflowStatus === "new" &&
          selectedStatus === "in_review" &&
          trimmedNote.length === 0
        ) {
          latestDetail = await startStaffIntakeReviewRequest({
            getIdToken,
            intakeId,
            facilityId: activeFacilityId,
          });
        } else {
          latestDetail = await updateStaffWorkflowStatusRequest({
            getIdToken,
            intakeId,
            payload: {
              facilityId: activeFacilityId,
              workflowStatus: selectedStatus,
              ...(trimmedNote.length > 0 ? { reason: trimmedNote } : {}),
            },
          });
        }
      }

      setDetail(latestDetail);
      syncFormStateFromDetail(latestDetail);
      setFeedbackBanner({
        tone: "success",
        message: "Intake updates saved and logged in activity history.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setFeedbackBanner({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Unable to save intake updates right now.",
      });
    } finally {
      setIsMutatingWorkflow(false);
    }
  };

  const intake = detail?.intake ?? null;
  const auditEvents = detail?.auditEvents ?? [];

  const workflowBadge = intake
    ? getQueueWorkflowBadge(intake.workflow.workflowStatus)
    : null;
  const priorityBadge = intake
    ? getAssignedPriorityBadge(intake.workflow.staffAssignedPriority)
    : null;

  return (
    <StaffWorkspaceLayout context={props} activeSection="detail">
      <div
        className="mx-auto grid w-full max-w-[880px] gap-5"
        data-testid="staff-intake-detail-workspace"
      >
        {/* Top Back Navigation */}
        <div>
          <Link
            href="/staff/queue"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--mf-primary-dark)] no-underline hover:underline"
            data-testid="back-to-queue-link"
          >
            <Icon name="arrowLeft" size="sm" />
            Back to Queue
          </Link>
        </div>

        {/* Loading State */}
        {lookupState === "loading" && (
          <div className="grid gap-4" aria-busy="true">
            <span className="mf-skel h-20 w-full rounded-[6px]" />
            <span className="mf-skel h-40 w-full rounded-[6px]" />
            <span className="mf-skel h-40 w-full rounded-[6px]" />
          </div>
        )}

        {/* Not Found State */}
        {lookupState === "not_found" && (
          <div className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-6">
            <Alert tone="warning" title="Intake record not found">
              {errorMessage ??
                "This intake record could not be found in your clinic queue."}
            </Alert>
            <div>
              <ButtonLink href="/staff/queue" variant="secondary" size="sm">
                <Icon name="arrowLeft" size="sm" />
                Return to Patient Queue
              </ButtonLink>
            </div>
          </div>
        )}

        {/* Error State */}
        {lookupState === "error" && (
          <div className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-6">
            <Alert tone="danger" title="Unable to load patient record">
              {errorMessage ??
                "Unable to load this patient record right now."}
            </Alert>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary" size="sm" onClick={loadDetail}>
                <Icon name="refresh" size="sm" />
                Retry
              </Button>
              <ButtonLink href="/staff/queue" variant="secondary" size="sm">
                Back to Queue
              </ButtonLink>
            </div>
          </div>
        )}

        {/* Found: 6-Section Simplified Clinical Detail View */}
        {lookupState === "found" && intake && (
          <div className="grid gap-5">
            {/* Section 1: Patient Identity & Status */}
            <header
              className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--mf-border)] pb-4"
              data-testid="intake-patient-header"
            >
              <div className="grid gap-1">
                <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
                  {getPatientDisplayTitle(intake.patientDisplayName)}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13.5px] text-[var(--mf-text-secondary)]">
                  {intake.age !== null && <span>{intake.age} years</span>}
                  {intake.age !== null && <span aria-hidden="true">·</span>}
                  <span>
                    Submitted {formatClinicalTimestamp(intake.createdAt)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="mf-mono text-[12.5px]">
                    {intake.referenceCode}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {workflowBadge && (
                  <Badge tone={workflowBadge.tone}>{workflowBadge.label}</Badge>
                )}
                {priorityBadge && (
                  <Badge tone={priorityBadge.tone}>{priorityBadge.label}</Badge>
                )}
              </div>
            </header>

            {feedbackBanner && (
              <Alert
                tone={feedbackBanner.tone}
                title={
                  feedbackBanner.tone === "success"
                    ? "Saved"
                    : "Could not save change"
                }
              >
                {feedbackBanner.message}
              </Alert>
            )}

            {/* Section 2: What the patient said */}
            <PatientStatementSection intake={intake} />

            {/* Section 3: AI Summary (with inline verbatim supporting statements or concise unavailable panel) */}
            <AiSummarySection
              intake={intake}
              isClinicalReviewer={isClinicalReviewer}
              isExtracting={isExtracting}
              extractionError={extractionError}
              onRetryExtraction={() => void handleRetryExtraction()}
            />

            {/* Section 4: Clinical Review */}
            <ClinicalReviewSection
              intake={intake}
              isClinicalReviewer={isClinicalReviewer}
              isMutatingBrief={isMutatingBrief}
              isEditingBrief={isEditingBrief}
              editChiefConcern={editChiefConcern}
              editClinicianSummary={editClinicianSummary}
              editMissingUnclear={editMissingUnclear}
              editCorrectionNote={editCorrectionNote}
              onChangeChiefConcern={setEditChiefConcern}
              onChangeClinicianSummary={setEditClinicianSummary}
              onChangeMissingUnclear={setEditMissingUnclear}
              onChangeCorrectionNote={setEditCorrectionNote}
              onToggleEditing={() => setIsEditingBrief((prev) => !prev)}
              onConfirmSummary={() => void handleConfirmSummary()}
              onSaveEditedSummary={() => void handleSaveEditedSummary()}
            />

            {/* Section 5: Manage Intake */}
            <ManageIntakeSection
              intake={intake}
              isClinicalReviewer={isClinicalReviewer}
              isMutatingWorkflow={isMutatingWorkflow}
              selectedPriority={selectedPriority}
              selectedStatus={selectedStatus}
              noteInput={workflowNoteInput}
              onChangePriority={setSelectedPriority}
              onChangeStatus={setSelectedStatus}
              onChangeNote={setWorkflowNoteInput}
              onSaveChanges={() => void handleSaveWorkflowChanges()}
            />

            {/* Section 6: Activity History (Collapsed by default) */}
            <ActivityHistoryDisclosure auditEvents={auditEvents} />
          </div>
        )}
      </div>
    </StaffWorkspaceLayout>
  );
}

export function StaffIntakeDetailShell({
  intakeId,
}: {
  readonly intakeId: string;
}) {
  return (
    <StaffAccessGate
      surfaceTitle="Patient Intake Review"
      surfaceSubtitle="Sign in to view this patient intake record"
    >
      {(context) => <AuthorizedIntakeDetail {...context} intakeId={intakeId} />}
    </StaffAccessGate>
  );
}
