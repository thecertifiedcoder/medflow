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
  SourceTag,
  Timeline,
  type BadgeTone,
  type TimelineEntry,
} from "@/components/ui";
import {
  WORKFLOW_PRIORITY_LABELS,
  WORKFLOW_STATUS_LABELS,
  type AuditAction,
  type ClinicalIntakeBrief,
} from "@/lib/schemas/intake";
import type {
  EvidenceVerificationStatus,
  StaffIntakeDetailResponse,
} from "@/lib/schemas/staff-api";
import {
  fetchStaffIntakeDetail,
  StaffApiClientError,
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
  ]);

  const intake = detail?.intake ?? null;
  const evidence = detail?.evidence ?? [];
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
                    ? "Automated intake structuring did not complete for this record. Review the patient's verbatim confirmed narrative above directly."
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
              {evidence.length === 0 ? (
                <Alert
                  tone="info"
                  title="No evidence rows recorded for this intake"
                >
                  Deterministic Evidence Integrity Engine rows appear here once
                  evidence extraction runs.
                </Alert>
              ) : (
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
              ) : (
                <Alert tone="info" title="Awaiting clinical staff review">
                  No separate staff-reviewed copy has been saved for this
                  intake. Interactive staff review and correction mutations
                  activate in Milestone 2.
                </Alert>
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
