"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
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
  EvidenceCard,
  Icon,
  PriorityLabel,
  SourceTag,
  Timeline,
  type BadgeTone,
  type TimelineEntry,
} from "@/components/ui";
import {
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
          <div className="mf-eyebrow">Reported symptoms ({brief.symptoms.length})</div>
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
            Reported details for staff review ({brief.reportedDetailsToReview.length})
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
          <span className="mf-eyebrow">Clinician summary (draft)</span>
          <SourceTag source="ai" label="Unverified draft text" />
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

function AuthorizedIntakeDetail({
  intakeId,
  staffProfile,
  activeFacility,
  activeFacilityId,
  getIdToken,
  handleSessionExpired,
}: AuthorizedIntakeDetailProps) {
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
  }, [activeFacilityId, getIdToken, handleSessionExpired, intakeId, refreshNonce]);

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
    <PageContainer width="standard">
      <nav aria-label="Breadcrumb" className="mf-crumbs mb-4">
        <Link href="/staff/queue">Patient queue</Link>
        <Icon
          name="chevron"
          size="sm"
          className="text-[var(--mf-text-secondary)]"
        />
        <span aria-current="page" className="mf-mono">
          {intake?.referenceCode ?? intakeId}
        </span>
      </nav>

      <div className="mf-detail-head mb-6 justify-between">
        <div>
          <span className="mf-eyebrow">Facility-scoped intake record</span>
          <h1 className="mf-detail-head__id m-0 mt-1 text-[var(--mf-text)]">
            {intake?.referenceCode ?? intakeId}
          </h1>
          <p className="mf-t-body-sm m-0 mt-1 text-[var(--mf-text-secondary)]">
            Facility <strong>{activeFacility.facilityName}</strong> (
            <code className="mf-mono text-[13px] text-[var(--mf-text)]">
              {activeFacilityId}
            </code>
            ) · Reviewing staff: {staffProfile.displayName} (
            <span className="capitalize">{activeFacility.role}</span>)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {intake?.demoRecord ? <Badge tone="neutral">DEMO DATA</Badge> : null}
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
        </div>
      </div>

      {lookupState === "loading" && (
        <ClinicalPanel
          source="nurse"
          sourceLabel="Staff detail view"
          title="Loading intake record"
          subtitle="Resolving facility-scoped record from PostgreSQL"
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
              evidence provenance, and audit timeline...
            </p>
          </div>
        </ClinicalPanel>
      )}

      {lookupState === "not_found" && (
        <ClinicalPanel
          source="nurse"
          sourceLabel="Staff detail view"
          title="Intake record unavailable"
        >
          <Alert tone="info" title="Intake record not found">
            {errorMessage ??
              "No intake record with this identifier was found in your authorized facility."}
          </Alert>
          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href="/staff/queue" variant="secondary" size="md">
              <Icon name="arrowLeft" size="btn" />
              Back to staff queue
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
              Back to staff queue
            </ButtonLink>
          </div>
        </ClinicalPanel>
      )}

      {lookupState === "found" && intake && (
        <div className="grid gap-5">
          {/* 1. Immutable Patient Source Narrative */}
          <ClinicalPanel
            source="patient"
            sourceLabel="Immutable patient source"
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

            <blockquote className="mf-quote m-0">
              {intake.patientSource.confirmedNarrative}
            </blockquote>

            {intake.patientSource.transcriptRaw &&
              intake.patientSource.transcriptRaw !==
                intake.patientSource.confirmedNarrative && (
                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3">
                  <div className="mf-eyebrow mb-1">
                    Original raw voice transcript (before patient edits)
                  </div>
                  <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                    {intake.patientSource.transcriptRaw}
                  </p>
                </div>
              )}
          </ClinicalPanel>

          {/* 2. Non-Authoritative AI Draft */}
          <ClinicalPanel
            source="ai"
            sourceLabel="AI draft — requires staff review"
            title="Structured AI extraction draft"
            subtitle="Advisory intake organization only. AI never diagnoses, prescribes, or sets clinical urgency."
            action={
              <Badge
                tone={
                  intake.aiDraft.status === "succeeded"
                    ? "info"
                    : intake.aiDraft.status === "failed"
                      ? "warning"
                      : "neutral"
                }
              >
                {intake.aiDraft.status.replaceAll("_", " ")}
              </Badge>
            }
          >
            {intake.aiDraft.brief ? (
              renderStructuredBriefSections(intake.aiDraft.brief, "AI Draft")
            ) : (
              <Alert
                tone={intake.aiDraft.status === "failed" ? "warning" : "info"}
                title={
                  intake.aiDraft.status === "failed"
                    ? "AI extraction unavailable"
                    : "No AI extraction draft attached yet"
                }
              >
                {intake.aiDraft.status === "failed"
                  ? "Automated intake structuring did not complete for this record. Review the patient's verbatim confirmed narrative above directly."
                  : "This intake is preserved in the queue. Staff-triggered server-side Gemini extraction activates in Milestone 2."}
              </Alert>
            )}
          </ClinicalPanel>

          {/* 3. Evidence Integrity Verification Rows & Provenance */}
          <ClinicalPanel
            source="calc"
            sourceLabel="Evidence provenance"
            title={`Evidence Integrity records (${evidence.length})`}
            subtitle="Deterministic source-quote location checks prove quotation location only — not clinical truth or semantic accuracy."
          >
            {intake.aiDraft.provenance ? (
              <dl className="mf-dl m-0">
                <dt>Model / Schema</dt>
                <dd className="mf-mono text-[13px]">
                  {intake.aiDraft.provenance.modelId} · v
                  {intake.aiDraft.provenance.extractionSchemaVersion}
                </dd>
                <dt>Evidence Engine</dt>
                <dd className="mf-mono text-[13px]">
                  {intake.aiDraft.provenance.evidenceEngineVersion}
                </dd>
                <dt>Draft &amp; Evidence SHA-256</dt>
                <dd className="mf-mono break-all text-[12px]">
                  {intake.aiDraft.provenance.draftAndEvidenceSha256}
                </dd>
              </dl>
            ) : null}

            {evidence.length === 0 ? (
              <Alert tone="info" title="No evidence verification rows yet">
                Field-level quote spans and provenance envelopes are generated
                by the deterministic Evidence Integrity Engine in Milestone 3.
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
                          <Badge tone="neutral">
                            v{item.engineVersion}
                          </Badge>
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

          {/* 4. Separate Staff-Reviewed Copy & Workflow Controls */}
          <ClinicalPanel
            source="nurse"
            sourceLabel="Staff review & priority"
            title="Staff-reviewed intake copy"
            subtitle="Stored separately from the original patient narrative and original AI draft."
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
            <dl className="mf-dl m-0">
              <dt>Staff-assigned priority</dt>
              <dd>
                <PriorityLabel
                  priority={intake.workflow.staffAssignedPriority}
                />
              </dd>
              {intake.workflow.priorityReason ? (
                <>
                  <dt>Priority rationale</dt>
                  <dd>{intake.workflow.priorityReason}</dd>
                </>
              ) : null}
              <dt>Workflow status</dt>
              <dd>{WORKFLOW_STATUS_LABELS[intake.workflow.workflowStatus]}</dd>
              {intake.staffReview.reviewedAt ? (
                <>
                  <dt>Last reviewed</dt>
                  <dd className="mf-mono text-[13px]">
                    {formatTimestamp(intake.staffReview.reviewedAt)}
                  </dd>
                </>
              ) : null}
            </dl>

            {intake.staffReview.correctionNote ? (
              <Alert tone="info" title="Staff correction note">
                {intake.staffReview.correctionNote}
              </Alert>
            ) : null}

            {intake.staffReview.reviewedBrief ? (
              renderStructuredBriefSections(
                intake.staffReview.reviewedBrief,
                "Staff-reviewed copy",
              )
            ) : (
              <Alert tone="info" title="Read-only PostgreSQL detail view">
                Staff brief confirmation/correction and workflow priority
                mutation endpoints activate in Milestone 2 after approval.
              </Alert>
            )}
          </ClinicalPanel>

          {/* 5. Append-Only Audit Timeline */}
          <ClinicalPanel
            source="nurse"
            sourceLabel="Append-only audit trail"
            title={`Audit timeline (${auditEntries.length})`}
            subtitle="Chronological patient, system, and staff lifecycle events enforced as append-only in PostgreSQL."
          >
            {auditEntries.length === 0 ? (
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                No audit events recorded for this intake yet.
              </p>
            ) : (
              <Timeline entries={auditEntries} />
            )}
          </ClinicalPanel>

          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href="/staff/queue" variant="secondary" size="md">
              <Icon name="arrowLeft" size="btn" />
              Back to staff queue
            </ButtonLink>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export function StaffIntakeDetailShell({ intakeId }: { intakeId: string }) {
  return (
    <StaffAccessGate
      surfaceTitle="Staff authentication required"
      surfaceSubtitle="Intake detail & evidence review"
    >
      {(context) => (
        <AuthorizedIntakeDetail {...context} intakeId={intakeId} />
      )}
    </StaffAccessGate>
  );
}
