"use client";

import Link from "next/link";
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
  EvidenceCard,
  Icon,
  PriorityLabel,
  Select,
  SourceTag,
  Timeline,
  type BadgeTone,
  type TimelineEntry,
} from "@/components/ui";
import {
  getAllowedStatusTransitions,
  WORKFLOW_PRIORITY_LABELS,
  WORKFLOW_STATUS_LABELS,
  type AuditAction,
  type ClinicalIntakeBrief,
  type WorkflowStatus,
} from "@/lib/schemas/intake";
import type {
  AssignableStaffPriority,
  EvidenceVerificationStatus,
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

interface AuthorizedIntakeDetailProps extends AuthorizedStaffContext {
  readonly intakeId: string;
}

const EVIDENCE_STATUS_META: Record<
  EvidenceVerificationStatus,
  { readonly label: string; readonly tone: BadgeTone }
> = {
  exact_quote_match: { label: "Exact quote match", tone: "success" },
  missing_quote: { label: "Source not provided", tone: "warning" },
  quote_not_found: { label: "Source match not found", tone: "danger" },
  ambiguous_quote: { label: "Source location ambiguous", tone: "caution" },
};

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  intake_created: "Patient intake submitted",
  transcript_confirmed: "Voice transcript confirmed by patient",
  ai_completed: "AI extraction draft generated",
  ai_failed: "AI extraction unavailable",
  review_started: "Staff review started",
  priority_assigned: "Staff workflow priority assigned",
  priority_changed: "Staff workflow priority updated",
  status_changed: "Workflow status updated",
  brief_confirmed: "AI intake brief confirmed by staff",
  brief_corrected: "Staff-reviewed brief correction saved",
};

interface DerivedBriefEvidenceQuote {
  readonly id: string;
  readonly fieldPath: string;
  readonly claimValue: string;
  readonly sourceQuote: string;
  readonly exactMatch: boolean;
  readonly spanStart: number | null;
  readonly spanEnd: number | null;
}

function deriveBriefEvidenceQuotes(
  brief: ClinicalIntakeBrief | null,
  confirmedNarrative: string,
): DerivedBriefEvidenceQuote[] {
  if (!brief) return [];
  const results: DerivedBriefEvidenceQuote[] = [];

  const checkQuote = (
    id: string,
    fieldPath: string,
    claimValue: string,
    quote: string | undefined,
  ) => {
    if (!quote || quote.trim().length === 0) return;
    const trimmed = quote.trim();
    const index = confirmedNarrative.indexOf(trimmed);
    const exactMatch = index !== -1;
    results.push({
      id,
      fieldPath,
      claimValue,
      sourceQuote: trimmed,
      exactMatch,
      spanStart: exactMatch ? index : null,
      spanEnd: exactMatch ? index + trimmed.length : null,
    });
  };

  checkQuote(
    "chiefConcern",
    "chiefConcern.sourceQuote",
    brief.chiefConcern.value,
    brief.chiefConcern.sourceQuote,
  );

  brief.symptoms.forEach((symptom, idx) => {
    checkQuote(
      `symptom-${idx}`,
      `symptoms[${idx}].sourceQuote`,
      symptom.value,
      symptom.sourceQuote,
    );
  });

  brief.relevantContext.forEach((ctx, idx) => {
    checkQuote(
      `context-${idx}`,
      `relevantContext[${idx}].sourceQuote`,
      ctx.value,
      ctx.sourceQuote,
    );
  });

  brief.reportedDetailsToReview.forEach((item, idx) => {
    checkQuote(
      `detail-${idx}`,
      `reportedDetailsToReview[${idx}].sourceQuote`,
      item.detail,
      item.sourceQuote,
    );
  });

  return results;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderStructuredBriefSections(
  brief: ClinicalIntakeBrief,
  headingPrefix: string,
  sourceType: "ai" | "nurse" = "ai",
) {
  return (
    <div className="grid gap-4">
      <EvidenceCard
        label={`${headingPrefix} · Chief concern`}
        value={brief.chiefConcern.value}
        sourceQuote={brief.chiefConcern.sourceQuote}
        certainty={brief.chiefConcern.certainty}
      />

      {brief.symptoms.length > 0 && (
        <div className="grid gap-3">
          <div className="mf-eyebrow">
            Reported symptoms ({brief.symptoms.length})
          </div>
          {brief.symptoms.map((symptom, idx) => (
            <EvidenceCard
              key={`${symptom.value}-${idx}`}
              label={`Symptom ${idx + 1}`}
              value={symptom.value}
              sourceQuote={symptom.sourceQuote}
              certainty={symptom.certainty}
              duration={symptom.duration}
              severity={symptom.severity}
            />
          ))}
        </div>
      )}

      {brief.relevantContext.length > 0 && (
        <div className="grid gap-3">
          <div className="mf-eyebrow">
            Relevant context ({brief.relevantContext.length})
          </div>
          {brief.relevantContext.map((item, idx) => (
            <EvidenceCard
              key={`${item.value}-${idx}`}
              label={`Context ${idx + 1}`}
              value={item.value}
              sourceQuote={item.sourceQuote}
              certainty={item.certainty}
            />
          ))}
        </div>
      )}

      {brief.reportedDetailsToReview.length > 0 && (
        <div className="grid gap-2">
          <div className="mf-eyebrow">
            Reported details for staff review (
            {brief.reportedDetailsToReview.length})
          </div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {brief.reportedDetailsToReview.map((item, idx) => (
              <li
                key={`${item.detail}-${idx}`}
                className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3"
              >
                <p className="mf-t-body-sm m-0 font-semibold text-[var(--mf-text)]">
                  {item.detail}
                </p>
                <p className="mf-t-body-sm m-0 mt-1 text-[var(--mf-text-secondary)]">
                  {item.context}
                </p>
                <blockquote className="mf-quote mt-2 !text-[13px]">
                  &ldquo;{item.sourceQuote}&rdquo;
                </blockquote>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.missingOrUnclear.length > 0 && (
        <Alert tone="caution" title="Missing or unclear information">
          <ul className="m-0 grid list-disc gap-1 pl-4">
            {brief.missingOrUnclear.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="rounded-[4px] border border-dashed border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="mf-eyebrow">
            {sourceType === "nurse"
              ? "Clinician summary (staff-reviewed)"
              : "Clinician summary (AI draft)"}
          </span>
          <SourceTag
            source={sourceType}
            label={
              sourceType === "nurse"
                ? "Reviewed by clinical staff"
                : "Unverified AI draft text"
            }
          />
        </div>
        <p className="mf-t-body-sm m-0 text-[var(--mf-text)]">
          {brief.clinicianSummary}
        </p>
      </div>

      {brief.limitations.length > 0 && (
        <div className="text-[13px] text-[var(--mf-text-secondary)]">
          <span className="font-semibold text-[var(--mf-text)]">
            Stated limitations:{" "}
          </span>
          {brief.limitations.join(" · ")}
        </div>
      )}
    </div>
  );
}

function AuthorizedIntakeDetail(props: AuthorizedIntakeDetailProps) {
  const {
    intakeId,
    staffProfile,
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

  // Interactive clinical mutation states
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMutatingBrief, setIsMutatingBrief] = useState(false);
  const [isMutatingWorkflow, setIsMutatingWorkflow] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<{
    readonly tone: "success" | "danger";
    readonly message: string;
  } | null>(null);

  // Staff Brief Editor State
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [editChiefConcern, setEditChiefConcern] = useState("");
  const [editClinicianSummary, setEditClinicianSummary] = useState("");
  const [editMissingUnclear, setEditMissingUnclear] = useState("");
  const [editCorrectionNote, setEditCorrectionNote] = useState("");

  // Priority & Status State
  const [selectedPriority, setSelectedPriority] =
    useState<AssignableStaffPriority>("priority_review");
  const [priorityReasonInput, setPriorityReasonInput] = useState("");
  const [statusReasonInput, setStatusReasonInput] = useState("");

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

      const currentPrio = loaded.intake.workflow.staffAssignedPriority;
      if (currentPrio !== "unassigned") {
        setSelectedPriority(currentPrio);
      } else {
        setSelectedPriority("priority_review");
      }
      setPriorityReasonInput(loaded.intake.workflow.priorityReason ?? "");
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
          "Unable to load this intake record from the server right now.",
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

  const handleRunOrRetryExtraction = async () => {
    if (!isClinicalReviewer || isExtracting) return;
    setIsExtracting(true);
    setMutationFeedback(null);
    try {
      await triggerIntakeExtraction({
        getIdToken,
        intakeId,
        facilityId: activeFacilityId,
      });
      const updated = await fetchStaffIntakeDetail({
        getIdToken,
        facilityId: activeFacilityId,
        intakeId,
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setMutationFeedback({
        tone: "success",
        message: `Server-side Gemini extraction completed (${updated.intake.aiDraft.status.replaceAll("_", " ")}).`,
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to run Gemini extraction.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmBrief = async () => {
    if (!isClinicalReviewer || isMutatingBrief) return;
    setIsMutatingBrief(true);
    setMutationFeedback(null);
    try {
      const updated = await submitStaffBriefReviewRequest({
        getIdToken,
        intakeId,
        payload: {
          action: "confirm",
          facilityId: activeFacilityId,
        },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setIsEditingBrief(false);
      setMutationFeedback({
        tone: "success",
        message:
          "AI intake brief confirmed by clinical staff and recorded in the append-only audit trail.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to confirm AI brief.",
      });
    } finally {
      setIsMutatingBrief(false);
    }
  };

  const handleSaveCorrectedBrief = async () => {
    if (!isClinicalReviewer || !detail || isMutatingBrief) return;

    const trimmedConcern = editChiefConcern.trim();
    const trimmedSummary = editClinicianSummary.trim();
    const trimmedNote = editCorrectionNote.trim();

    if (trimmedConcern.length < 3) {
      setMutationFeedback({
        tone: "danger",
        message: "Chief concern summary must be at least 3 characters.",
      });
      return;
    }
    if (trimmedSummary.length < 5) {
      setMutationFeedback({
        tone: "danger",
        message: "Clinician summary must be at least 5 characters.",
      });
      return;
    }
    if (trimmedNote.length < 3) {
      setMutationFeedback({
        tone: "danger",
        message:
          "A correction note of at least 3 characters is required when saving a staff-reviewed copy.",
      });
      return;
    }

    const baseBrief: ClinicalIntakeBrief = detail.intake.staffReview
      .reviewedBrief ??
      detail.intake.aiDraft.brief ?? {
        schemaVersion: "1.0",
        chiefConcern: {
          value: trimmedConcern,
          certainty: "explicit",
        },
        symptoms: [],
        relevantContext: [],
        reportedDetailsToReview: [],
        missingOrUnclear: [],
        clinicianSummary: trimmedSummary,
        limitations: [
          "Staff-reviewed intake brief created directly by clinical reviewer.",
        ],
      };

    const missingList = editMissingUnclear
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const updatedBrief: ClinicalIntakeBrief = {
      ...baseBrief,
      schemaVersion: "1.0",
      chiefConcern: {
        ...baseBrief.chiefConcern,
        value: trimmedConcern,
      },
      missingOrUnclear: missingList,
      clinicianSummary: trimmedSummary,
      limitations:
        baseBrief.limitations.length > 0
          ? baseBrief.limitations
          : ["Reviewed and updated by qualified clinical staff."],
    };

    setIsMutatingBrief(true);
    setMutationFeedback(null);
    try {
      const updated = await submitStaffBriefReviewRequest({
        getIdToken,
        intakeId,
        payload: {
          action: "correct",
          facilityId: activeFacilityId,
          reviewedBrief: updatedBrief,
          correctionNote: trimmedNote,
        },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setIsEditingBrief(false);
      setMutationFeedback({
        tone: "success",
        message:
          "Separate staff-reviewed brief saved in PostgreSQL while preserving the original AI draft and patient narrative.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to save staff-reviewed brief.",
      });
    } finally {
      setIsMutatingBrief(false);
    }
  };

  const handleStartReview = async () => {
    if (!isClinicalReviewer || isMutatingWorkflow) return;
    setIsMutatingWorkflow(true);
    setMutationFeedback(null);
    try {
      const updated = await startStaffIntakeReviewRequest({
        getIdToken,
        intakeId,
        facilityId: activeFacilityId,
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setMutationFeedback({
        tone: "success",
        message: "Clinical review started and logged in the audit trail.",
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to start review.",
      });
    } finally {
      setIsMutatingWorkflow(false);
    }
  };

  const handleSavePriority = async () => {
    if (!isClinicalReviewer || !detail || isMutatingWorkflow) return;
    const isPriorityChange =
      detail.intake.workflow.staffAssignedPriority !== "unassigned";
    const trimmedReason = priorityReasonInput.trim();

    if (isPriorityChange && trimmedReason.length < 3) {
      setMutationFeedback({
        tone: "danger",
        message:
          "A reason of at least 3 characters is required when changing an already-assigned operational priority.",
      });
      return;
    }

    setIsMutatingWorkflow(true);
    setMutationFeedback(null);
    try {
      const updated = await updateStaffPriorityRequest({
        getIdToken,
        intakeId,
        payload: {
          facilityId: activeFacilityId,
          priority: selectedPriority,
          ...(trimmedReason.length > 0 ? { reason: trimmedReason } : {}),
        },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setMutationFeedback({
        tone: "success",
        message: `Operational priority updated to "${WORKFLOW_PRIORITY_LABELS[selectedPriority]}" and recorded in the audit trail.`,
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to update operational priority.",
      });
    } finally {
      setIsMutatingWorkflow(false);
    }
  };

  const handleTransitionStatus = async (nextStatus: WorkflowStatus) => {
    if (!isClinicalReviewer || isMutatingWorkflow) return;
    setIsMutatingWorkflow(true);
    setMutationFeedback(null);
    try {
      const trimmedReason = statusReasonInput.trim();
      const updated = await updateStaffWorkflowStatusRequest({
        getIdToken,
        intakeId,
        payload: {
          facilityId: activeFacilityId,
          workflowStatus: nextStatus,
          ...(trimmedReason.length > 0 ? { reason: trimmedReason } : {}),
        },
      });
      setDetail(updated);
      syncFormStateFromDetail(updated);
      setStatusReasonInput("");
      setMutationFeedback({
        tone: "success",
        message: `Workflow status transitioned to "${WORKFLOW_STATUS_LABELS[nextStatus]}".`,
      });
    } catch (err) {
      if (err instanceof StaffApiClientError && err.isAuthExpired) {
        handleSessionExpired(err.message);
        return;
      }
      setMutationFeedback({
        tone: "danger",
        message:
          err instanceof StaffApiClientError
            ? err.message
            : "Failed to update workflow status.",
      });
    } finally {
      setIsMutatingWorkflow(false);
    }
  };

  const intake = detail?.intake ?? null;
  const evidence = detail?.evidence ?? [];
  const derivedBriefQuotes = intake
    ? deriveBriefEvidenceQuotes(
        intake.aiDraft.brief,
        intake.patientSource.confirmedNarrative,
      )
    : [];
  const allowedNextStatuses = intake
    ? getAllowedStatusTransitions(intake.workflow.workflowStatus)
    : [];

  const auditEntries: TimelineEntry[] = (detail?.auditEvents ?? []).map(
    (evt) => ({
      id: evt.id,
      timestamp: formatTimestamp(evt.createdAt),
      actorType: evt.actorType,
      actorDisplayName: evt.actorDisplayName ?? undefined,
      actorRole: evt.actorRole ?? undefined,
      actionLabel: AUDIT_ACTION_LABELS[evt.action],
      fromValue: evt.fromValue ?? undefined,
      toValue: evt.toValue ?? undefined,
      reason: evt.reason ?? undefined,
      isOverride:
        evt.action === "priority_changed" || evt.action === "brief_corrected",
    }),
  );

  return (
    <StaffWorkspaceLayout context={props} activeSection="detail">
      <div className="grid gap-5" data-testid="staff-intake-detail-workspace">
        <nav aria-label="Breadcrumb" className="mf-crumbs">
          <Link href="/staff/queue">Clinical intake queue</Link>
          <Icon
            name="chevron"
            size="sm"
            className="text-[var(--mf-text-secondary)]"
          />
          <span aria-current="page" className="mf-mono">
            {intake?.referenceCode ?? intakeId}
          </span>
        </nav>

        <div className="mf-detail-head justify-between">
          <div className="grid gap-1">
            <span className="mf-eyebrow">
              Facility-Scoped Intake Record Review
            </span>
            <h1 className="mf-detail-head__id m-0 text-[var(--mf-text)]">
              {intake?.referenceCode ?? intakeId}
            </h1>
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Facility <strong>{activeFacility.facilityName}</strong> (
              <code className="mf-mono text-[13px] text-[var(--mf-text)]">
                {activeFacility.facilityPublicCode}
              </code>
              ) · Reviewing staff: <strong>{staffProfile.displayName}</strong> (
              <span className="uppercase">{activeFacility.role}</span>)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {intake?.demoRecord ? (
              <Badge tone="neutral">DEMO DATA</Badge>
            ) : null}
            {intake ? (
              <>
                <PriorityLabel
                  priority={intake.workflow.staffAssignedPriority}
                />
                <Badge tone="neutral">
                  {WORKFLOW_STATUS_LABELS[intake.workflow.workflowStatus]}
                </Badge>
              </>
            ) : (
              <Badge tone="brand" icon="lock">
                Facility-scoped
              </Badge>
            )}
            <ButtonLink href="/staff/queue" variant="secondary" size="sm">
              <Icon name="arrowLeft" size="sm" />
              Back to Queue
            </ButtonLink>
          </div>
        </div>

        {mutationFeedback && (
          <Alert
            tone={mutationFeedback.tone}
            title={
              mutationFeedback.tone === "success"
                ? "Clinical workflow updated"
                : "Action could not be completed"
            }
          >
            {mutationFeedback.message}
          </Alert>
        )}

        {lookupState === "loading" && (
          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff detail view"
            title="Loading intake record"
            subtitle="Resolving facility-scoped record from Neon PostgreSQL"
          >
            <div className="flex items-center gap-3 py-2" aria-busy="true">
              <Icon
                name="loader"
                size="md"
                spin
                className="text-[var(--mf-primary-dark)]"
              />
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Verifying facility authorization and loading patient narrative,
                AI intake draft, evidence provenance, and audit timeline...
              </p>
            </div>
          </ClinicalPanel>
        )}

        {lookupState === "not_found" && (
          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff detail view"
            title="Intake record unavailable"
            subtitle="Safe tenant-scoped lookup (HTTP 404 / 400)"
          >
            <Alert tone="info" title="Intake record not found">
              {errorMessage ??
                "No intake record with this identifier was found in your authorized facility."}
            </Alert>
            <div className="flex flex-wrap gap-3 pt-1">
              <ButtonLink href="/staff/queue" variant="primary" size="md">
                <Icon name="arrowLeft" size="btn" />
                Back to Clinical Intake Queue
              </ButtonLink>
            </div>
          </ClinicalPanel>
        )}

        {lookupState === "error" && (
          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff detail view"
            title="Unable to load intake record"
          >
            <Alert tone="danger" title="Server request failed">
              {errorMessage ??
                "Unable to retrieve this intake record right now."}
            </Alert>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={() => void loadDetail()}
              >
                <Icon name="refresh" size="btn" />
                Retry
              </Button>
              <ButtonLink href="/staff/queue" variant="secondary" size="md">
                <Icon name="arrowLeft" size="btn" />
                Back to Clinical Intake Queue
              </ButtonLink>
            </div>
          </ClinicalPanel>
        )}

        {lookupState === "found" && intake && (
          <div className="grid gap-5">
            {/* 1. Patient-Confirmed Source Information */}
            <ClinicalPanel
              source="patient"
              sourceLabel="1 · Immutable patient source"
              title="Patient-confirmed narrative"
              subtitle="Original patient words are preserved verbatim and are never overwritten by AI extraction or staff edits."
              action={
                <SourceTag
                  source="patient"
                  label={
                    intake.patientSource.inputMode === "voice"
                      ? "Voice · Confirmed"
                      : "Typed narrative"
                  }
                />
              }
            >
              <dl className="mf-dl m-0">
                <dt>Patient reference</dt>
                <dd className="mf-mono text-[13px]">{intake.referenceCode}</dd>
                {intake.patientDisplayName ? (
                  <>
                    <dt>Display name / alias</dt>
                    <dd>{intake.patientDisplayName}</dd>
                  </>
                ) : null}
                {intake.age !== null ? (
                  <>
                    <dt>Reported age</dt>
                    <dd>{intake.age}</dd>
                  </>
                ) : null}
                <dt>Submitted</dt>
                <dd className="mf-mono text-[13px]">
                  {formatTimestamp(intake.createdAt)}
                </dd>
                <dt>Narrative SHA-256</dt>
                <dd className="mf-mono break-all text-[12px]">
                  {intake.patientSource.confirmedNarrativeSha256}
                </dd>
              </dl>

              <blockquote
                className="mf-quote m-0"
                data-testid="detail-confirmed-narrative"
              >
                {intake.patientSource.confirmedNarrative}
              </blockquote>

              {intake.patientSource.transcriptRaw && (
                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
                  <div className="mf-eyebrow mb-1">
                    Original raw voice transcript{" "}
                    {intake.patientSource.transcriptionModel
                      ? `(${intake.patientSource.transcriptionModel})`
                      : ""}
                  </div>
                  <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                    {intake.patientSource.transcriptRaw}
                  </p>
                </div>
              )}
            </ClinicalPanel>

            {/* 2. AI-Generated Structured Draft */}
            <ClinicalPanel
              source="ai"
              sourceLabel="2 · AI draft — requires staff review"
              title="Structured AI extraction draft"
              subtitle="Advisory intake organization only. AI never diagnoses, prescribes, or assigns clinical urgency."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {intake.aiDraft.modelId ? (
                    <Badge tone="neutral">{intake.aiDraft.modelId}</Badge>
                  ) : null}
                  <Badge
                    tone={
                      intake.aiDraft.status === "succeeded"
                        ? "info"
                        : intake.aiDraft.status === "failed" ||
                            intake.aiDraft.status ===
                              "needs_human_clarification"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {intake.aiDraft.status.replaceAll("_", " ")}
                  </Badge>
                  {isClinicalReviewer && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={isExtracting}
                      disabled={isExtracting}
                      onClick={() => void handleRunOrRetryExtraction()}
                      data-testid="trigger-ai-extraction-btn"
                    >
                      <Icon name="refresh" size="sm" spin={isExtracting} />
                      {intake.aiDraft.brief
                        ? "Re-run Gemini Extraction"
                        : "Run Gemini Extraction"}
                    </Button>
                  )}
                </div>
              }
            >
              {intake.aiDraft.brief ? (
                renderStructuredBriefSections(
                  intake.aiDraft.brief,
                  "AI Draft",
                  "ai",
                )
              ) : (
                <Alert
                  tone={intake.aiDraft.status === "failed" ? "warning" : "info"}
                  title={
                    intake.aiDraft.status === "failed"
                      ? "AI extraction unavailable"
                      : "AI extraction pending"
                  }
                >
                  {intake.aiDraft.status === "failed"
                    ? "Automated intake structuring did not complete for this record. Review the patient's verbatim confirmed narrative above directly or use Run Gemini Extraction to retry."
                    : "No AI brief has been generated for this intake record yet."}
                </Alert>
              )}
            </ClinicalPanel>

            {/* 3. Supporting Evidence & Quote Provenance */}
            <ClinicalPanel
              source="calc"
              sourceLabel="3 · Supporting evidence"
              title="Evidence quote provenance"
              subtitle="Deterministic verification checks exact quote location inside the confirmed narrative — never clinical truth."
            >
              {evidence.length > 0 ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {evidence.map((item) => {
                    const statusMeta =
                      EVIDENCE_STATUS_META[item.verificationStatus];
                    return (
                      <li
                        key={item.id}
                        className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3"
                      >
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <span className="mf-mono text-[12px] font-semibold text-[var(--mf-text)]">
                            {item.fieldPath}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={statusMeta.tone}>
                              {statusMeta.label}
                            </Badge>
                            <Badge tone="neutral">v{item.engineVersion}</Badge>
                          </div>
                        </div>
                        <p className="mf-t-body-sm m-0 text-[var(--mf-text)]">
                          {item.claimValue}
                        </p>
                        {item.sourceQuote ? (
                          <blockquote className="mf-quote mt-2 !text-[13px]">
                            &ldquo;{item.sourceQuote}&rdquo;
                          </blockquote>
                        ) : null}
                        {item.spanStart !== null && item.spanEnd !== null ? (
                          <div className="mf-mono mt-1.5 text-[12px] text-[var(--mf-text-secondary)]">
                            UTF-16 span: [{item.spanStart}, {item.spanEnd})
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : derivedBriefQuotes.length > 0 ? (
                <ul
                  className="m-0 grid list-none gap-3 p-0"
                  data-testid="derived-evidence-quote-list"
                >
                  {derivedBriefQuotes.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3"
                    >
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="mf-mono text-[12px] font-semibold text-[var(--mf-text)]">
                          {item.fieldPath}
                        </span>
                        <Badge tone={item.exactMatch ? "success" : "warning"}>
                          {item.exactMatch
                            ? "Exact verbatim quote match"
                            : "Unverified quote"}
                        </Badge>
                      </div>
                      <p className="mf-t-body-sm m-0 font-medium text-[var(--mf-text)]">
                        {item.claimValue}
                      </p>
                      <blockquote className="mf-quote mt-2 !text-[13px]">
                        &ldquo;{item.sourceQuote}&rdquo;
                      </blockquote>
                      {item.spanStart !== null && item.spanEnd !== null ? (
                        <div className="mf-mono mt-1.5 text-[12px] text-[var(--mf-text-secondary)]">
                          Narrative character span: [{item.spanStart},{" "}
                          {item.spanEnd})
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Alert
                  tone="info"
                  title="No grounded source quotes extracted yet"
                >
                  Run Gemini extraction or inspect the patient-confirmed
                  narrative directly above.
                </Alert>
              )}
            </ClinicalPanel>

            {/* 4. Staff-Reviewed Information */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="4 · Clinical staff review"
              title="Staff-reviewed intake copy"
              subtitle="Stored as a separate record in PostgreSQL. Staff edits never overwrite the patient's confirmed narrative or the original AI draft."
              action={
                <Badge
                  tone={
                    intake.staffReview.status === "not_reviewed"
                      ? "warning"
                      : "success"
                  }
                >
                  {intake.staffReview.status.replaceAll("_", " ")}
                </Badge>
              }
            >
              {intake.staffReview.reviewedAt ? (
                <dl className="mf-dl m-0">
                  <dt>Review status</dt>
                  <dd className="capitalize">
                    {intake.staffReview.status.replaceAll("_", " ")}
                  </dd>
                  <dt>Reviewed by</dt>
                  <dd className="mf-mono text-[13px]">
                    {intake.staffReview.reviewedByUid}
                  </dd>
                  <dt>Last reviewed</dt>
                  <dd className="mf-mono text-[13px]">
                    {formatTimestamp(intake.staffReview.reviewedAt)}
                  </dd>
                </dl>
              ) : null}

              {intake.staffReview.correctionNote ? (
                <Alert tone="info" title="Staff correction note">
                  {intake.staffReview.correctionNote}
                </Alert>
              ) : null}

              {intake.staffReview.reviewedBrief ? (
                renderStructuredBriefSections(
                  intake.staffReview.reviewedBrief,
                  "Staff-reviewed copy",
                  "nurse",
                )
              ) : intake.staffReview.status === "confirmed" &&
                intake.aiDraft.brief ? (
                <Alert
                  tone="success"
                  title="AI draft confirmed by clinical staff"
                >
                  Clinical staff confirmed the structured AI brief above without
                  modifications.
                </Alert>
              ) : (
                <Alert tone="info" title="Awaiting clinical staff review">
                  Confirm the AI draft as accurate or edit and save a separate
                  staff-reviewed copy below.
                </Alert>
              )}

              {isClinicalReviewer ? (
                <div className="grid gap-4 border-t border-[var(--mf-border)] pt-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {intake.aiDraft.brief && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={isMutatingBrief}
                        disabled={isMutatingBrief}
                        onClick={() => void handleConfirmBrief()}
                        data-testid="confirm-brief-btn"
                      >
                        <Icon name="check" size="sm" />
                        Confirm AI Brief as Accurate
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isMutatingBrief}
                      onClick={() => setIsEditingBrief((prev) => !prev)}
                      data-testid="open-edit-brief-btn"
                    >
                      <Icon name="clipboard" size="sm" />
                      {isEditingBrief
                        ? "Close Brief Editor"
                        : "Edit & Save Staff-Reviewed Copy"}
                    </Button>
                  </div>

                  {isEditingBrief && (
                    <div
                      className="grid gap-3.5 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4"
                      data-testid="staff-brief-editor"
                    >
                      <div className="text-[14px] font-semibold text-[var(--mf-text)]">
                        Create / Update Separate Staff-Reviewed Brief
                      </div>

                      <div className="mf-field">
                        <label
                          htmlFor="edit-chief-concern"
                          className="mf-label"
                        >
                          <span>Staff-reviewed chief concern</span>
                          <span className="mf-label__req">Required</span>
                        </label>
                        <input
                          id="edit-chief-concern"
                          type="text"
                          className="mf-input"
                          maxLength={300}
                          value={editChiefConcern}
                          onChange={(e) => setEditChiefConcern(e.target.value)}
                          data-testid="edit-chief-concern-input"
                        />
                      </div>

                      <div className="mf-field">
                        <label
                          htmlFor="edit-clinician-summary"
                          className="mf-label"
                        >
                          <span>Staff-reviewed clinician summary</span>
                          <span className="mf-label__req">Required</span>
                        </label>
                        <textarea
                          id="edit-clinician-summary"
                          className="mf-textarea"
                          rows={3}
                          maxLength={1200}
                          value={editClinicianSummary}
                          onChange={(e) =>
                            setEditClinicianSummary(e.target.value)
                          }
                          data-testid="edit-clinician-summary-textarea"
                        />
                      </div>

                      <div className="mf-field">
                        <label
                          htmlFor="edit-missing-unclear"
                          className="mf-label"
                        >
                          <span>
                            Remaining missing or unclear items (one per line)
                          </span>
                          <span className="mf-label__req">Optional</span>
                        </label>
                        <textarea
                          id="edit-missing-unclear"
                          className="mf-textarea"
                          rows={2}
                          value={editMissingUnclear}
                          onChange={(e) =>
                            setEditMissingUnclear(e.target.value)
                          }
                          data-testid="edit-missing-unclear-textarea"
                        />
                      </div>

                      <div className="mf-field">
                        <label
                          htmlFor="edit-correction-note"
                          className="mf-label"
                        >
                          <span>
                            Mandatory audit reason / correction note (min 3
                            chars)
                          </span>
                          <span className="mf-label__req">Required</span>
                        </label>
                        <input
                          id="edit-correction-note"
                          type="text"
                          className="mf-input"
                          maxLength={500}
                          placeholder="e.g., Clarified symptom onset and medication dose during nurse check-in."
                          value={editCorrectionNote}
                          onChange={(e) =>
                            setEditCorrectionNote(e.target.value)
                          }
                          data-testid="edit-correction-note-input"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          loading={isMutatingBrief}
                          disabled={isMutatingBrief}
                          onClick={() => void handleSaveCorrectedBrief()}
                          data-testid="save-corrected-brief-btn"
                        >
                          <Icon name="check" size="sm" />
                          Save Staff-Reviewed Copy
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          size="sm"
                          disabled={isMutatingBrief}
                          onClick={() => setIsEditingBrief(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3 text-[13px] text-[var(--mf-text-secondary)]"
                  data-testid="admin-readonly-mutation-notice"
                >
                  <strong>Read-only Administrator Inspection:</strong> Signed in
                  with role <code className="mf-mono">admin</code>. Clinical
                  brief confirmation, corrections, and priority mutations are
                  restricted to <code className="mf-mono">nurse</code> and{" "}
                  <code className="mf-mono">doctor</code> roles.
                </div>
              )}
            </ClinicalPanel>

            {/* 5. Operational Status & Staff-Assigned Priority */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="5 · Operational workflow"
              title="Staff-controlled priority and workflow state"
              subtitle="Operational priority is assigned solely by qualified clinical staff — never by AI."
            >
              <dl className="mf-dl m-0">
                <dt>Operational priority</dt>
                <dd>
                  <PriorityLabel
                    priority={intake.workflow.staffAssignedPriority}
                  />{" "}
                  <span className="ml-2 text-[13px] text-[var(--mf-text-secondary)]">
                    (
                    {
                      WORKFLOW_PRIORITY_LABELS[
                        intake.workflow.staffAssignedPriority
                      ]
                    }
                    )
                  </span>
                </dd>
                <dt>Workflow status</dt>
                <dd>
                  <Badge tone="neutral">
                    {WORKFLOW_STATUS_LABELS[intake.workflow.workflowStatus]}
                  </Badge>
                </dd>
                {intake.workflow.priorityReason ? (
                  <>
                    <dt>Recorded priority reason</dt>
                    <dd>{intake.workflow.priorityReason}</dd>
                  </>
                ) : null}
              </dl>

              {isClinicalReviewer && (
                <div className="grid gap-4 border-t border-[var(--mf-border)] pt-4">
                  {/* Start Review Action */}
                  {intake.workflow.workflowStatus === "new" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
                      <span className="text-[13.5px] text-[var(--mf-text)]">
                        Ready to begin reviewing this newly submitted intake?
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={isMutatingWorkflow}
                        disabled={isMutatingWorkflow}
                        onClick={() => void handleStartReview()}
                        data-testid="start-review-btn"
                      >
                        <Icon name="userCheck" size="sm" />
                        Start Clinical Review
                      </Button>
                    </div>
                  )}

                  {/* Priority Assignment / Update Form */}
                  <div className="grid gap-3 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
                    <div className="text-[14px] font-semibold text-[var(--mf-text)]">
                      {intake.workflow.staffAssignedPriority === "unassigned"
                        ? "Assign Operational Priority"
                        : "Update Operational Priority (Reason Required)"}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="mf-field">
                        <label htmlFor="priority-select" className="mf-label">
                          <span>Operational review priority</span>
                        </label>
                        <Select
                          id="priority-select"
                          value={selectedPriority}
                          onChange={(e) =>
                            setSelectedPriority(
                              e.target.value as AssignableStaffPriority,
                            )
                          }
                          data-testid="priority-select"
                        >
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
                        <label
                          htmlFor="priority-reason-input"
                          className="mf-label"
                        >
                          <span>Clinical / operational reason</span>
                          <span className="mf-label__req">
                            {intake.workflow.staffAssignedPriority ===
                            "unassigned"
                              ? "Recommended"
                              : "Required (min 3 chars)"}
                          </span>
                        </label>
                        <input
                          id="priority-reason-input"
                          type="text"
                          className="mf-input"
                          maxLength={500}
                          placeholder="e.g., Exertional chest tightness requires prompt nurse evaluation"
                          value={priorityReasonInput}
                          onChange={(e) =>
                            setPriorityReasonInput(e.target.value)
                          }
                          data-testid="priority-reason-input"
                        />
                      </div>
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={isMutatingWorkflow}
                        disabled={isMutatingWorkflow}
                        onClick={() => void handleSavePriority()}
                        data-testid="save-priority-btn"
                      >
                        <Icon name="check" size="sm" />
                        {intake.workflow.staffAssignedPriority === "unassigned"
                          ? "Assign Priority"
                          : "Update Priority"}
                      </Button>
                    </div>
                  </div>

                  {/* Workflow Status Transitions */}
                  {allowedNextStatuses.length > 0 && (
                    <div className="grid gap-3 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
                      <div className="text-[14px] font-semibold text-[var(--mf-text)]">
                        Transition Workflow Status
                      </div>

                      <div className="mf-field">
                        <label
                          htmlFor="status-reason-input"
                          className="mf-label"
                        >
                          <span>Status transition note</span>
                          <span className="mf-label__req">Optional</span>
                        </label>
                        <input
                          id="status-reason-input"
                          type="text"
                          className="mf-input"
                          maxLength={500}
                          placeholder="e.g., Completed intake check-in and handed off to outpatient queue"
                          value={statusReasonInput}
                          onChange={(e) => setStatusReasonInput(e.target.value)}
                          data-testid="status-reason-input"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {allowedNextStatuses.map((nextStatus) => (
                          <Button
                            key={nextStatus}
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={isMutatingWorkflow}
                            disabled={isMutatingWorkflow}
                            onClick={() =>
                              void handleTransitionStatus(nextStatus)
                            }
                            data-testid={`transition-status-${nextStatus}`}
                          >
                            <Icon name="arrow" size="sm" />
                            Move to {WORKFLOW_STATUS_LABELS[nextStatus]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ClinicalPanel>

            {/* 6. Append-Only Audit History */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="6 · Append-only audit"
              title={`Audit event timeline (${auditEntries.length})`}
              subtitle="Database-enforced append-only log with action-to-actor validation."
            >
              {auditEntries.length === 0 ? (
                <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                  No audit events found for this intake.
                </p>
              ) : (
                <Timeline entries={auditEntries} />
              )}
            </ClinicalPanel>
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
      surfaceTitle="Intake Record Review"
      surfaceSubtitle="Facility-scoped patient narrative, AI draft, evidence provenance, and audit history"
    >
      {(context) => <AuthorizedIntakeDetail {...context} intakeId={intakeId} />}
    </StaffAccessGate>
  );
}
