"use client";

import { Badge, Button, Icon } from "@/components/ui";
import type { StaffIntakeDetailRecord } from "@/lib/schemas/staff-api";
import { formatDetailedTimestamp } from "@/lib/staff/queue-helpers";

interface ClinicalReviewSectionProps {
  readonly intake: StaffIntakeDetailRecord;
  readonly isClinicalReviewer: boolean;
  readonly isMutatingBrief: boolean;
  readonly isEditingBrief: boolean;
  readonly editChiefConcern: string;
  readonly editClinicianSummary: string;
  readonly editMissingUnclear: string;
  readonly editCorrectionNote: string;
  readonly onChangeChiefConcern: (value: string) => void;
  readonly onChangeClinicianSummary: (value: string) => void;
  readonly onChangeMissingUnclear: (value: string) => void;
  readonly onChangeCorrectionNote: (value: string) => void;
  readonly onToggleEditing: () => void;
  readonly onConfirmSummary: () => void;
  readonly onSaveEditedSummary: () => void;
}

export function ClinicalReviewSection({
  intake,
  isClinicalReviewer,
  isMutatingBrief,
  isEditingBrief,
  editChiefConcern,
  editClinicianSummary,
  editMissingUnclear,
  editCorrectionNote,
  onChangeChiefConcern,
  onChangeClinicianSummary,
  onChangeMissingUnclear,
  onChangeCorrectionNote,
  onToggleEditing,
  onConfirmSummary,
  onSaveEditedSummary,
}: ClinicalReviewSectionProps) {
  const { staffReview, aiDraft } = intake;
  const hasAiBrief = Boolean(aiDraft.brief) && aiDraft.status !== "failed";

  const reviewBadge =
    staffReview.status === "confirmed"
      ? { label: "Summary confirmed", tone: "success" as const }
      : staffReview.status === "corrected"
        ? { label: "Edited by staff", tone: "brand" as const }
        : { label: "Not yet reviewed", tone: "neutral" as const };

  return (
    <section
      aria-labelledby="clinical-review-heading"
      className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5"
      data-testid="clinical-review-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mf-border)] pb-3">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="clinical-review-heading"
              className="mf-t-card m-0 text-[var(--mf-text)]"
            >
              Clinical Review
            </h2>
            <Badge tone={reviewBadge.tone}>{reviewBadge.label}</Badge>
          </div>
          <p className="m-0 text-[13px] text-[var(--mf-text-secondary)]">
            {staffReview.reviewedAt
              ? `Last reviewed ${formatDetailedTimestamp(staffReview.reviewedAt)}.`
              : "Confirm the AI summary or save a separate staff-reviewed summary."}
          </p>
        </div>
      </div>

      {/* Staff-reviewed separate copy (never overwrites original patient statement or AI draft) */}
      {staffReview.reviewedBrief && (
        <div
          className="grid gap-2.5 rounded-[5px] border border-[var(--mf-primary)]/35 bg-[var(--mf-primary-tint)]/45 p-4"
          data-testid="staff-reviewed-copy-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-[var(--mf-primary-dark)]">
              Staff-reviewed summary (saved separately from AI draft)
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-[12px] font-medium text-[var(--mf-text-secondary)]">
              Chief concern
            </span>
            <p className="m-0 text-[14.5px] font-semibold text-[var(--mf-text)]">
              {staffReview.reviewedBrief.chiefConcern.value}
            </p>
          </div>
          <div className="grid gap-1">
            <span className="text-[12px] font-medium text-[var(--mf-text-secondary)]">
              Clinical summary
            </span>
            <p className="m-0 text-[14px] leading-[1.5] text-[var(--mf-text)]">
              {staffReview.reviewedBrief.clinicianSummary}
            </p>
          </div>
          {staffReview.reviewedBrief.missingOrUnclear.length > 0 && (
            <div className="grid gap-1">
              <span className="text-[12px] font-medium text-[var(--mf-text-secondary)]">
                Remaining items to clarify
              </span>
              <ul className="m-0 list-disc pl-4 text-[13.5px] text-[var(--mf-text)]">
                {staffReview.reviewedBrief.missingOrUnclear.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {staffReview.correctionNote && (
            <div className="border-t border-[var(--mf-border)] pt-2 text-[13px] text-[var(--mf-text-secondary)]">
              <strong className="text-[var(--mf-text)]">Review note:</strong>{" "}
              {staffReview.correctionNote}
            </div>
          )}
        </div>
      )}

      {/* Review Actions */}
      {isClinicalReviewer ? (
        <div className="grid gap-3">
          {!hasAiBrief && !staffReview.reviewedBrief && (
            <p className="m-0 text-[13.5px] text-[var(--mf-text-secondary)]">
              Because no AI summary is available, you cannot confirm an AI
              draft. You can retry the AI summary above or write a separate
              staff summary below.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {hasAiBrief && (
              <Button
                type="button"
                variant={
                  staffReview.status === "confirmed" ? "secondary" : "primary"
                }
                size="sm"
                loading={isMutatingBrief}
                disabled={isMutatingBrief}
                onClick={onConfirmSummary}
                data-testid="confirm-ai-brief-btn"
              >
                <Icon name="check" size="sm" />
                {staffReview.status === "confirmed"
                  ? "Summary Confirmed"
                  : "Confirm Summary"}
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutatingBrief}
              onClick={onToggleEditing}
              data-testid="toggle-edit-brief-btn"
            >
              <Icon name="edit" size="sm" />
              {isEditingBrief
                ? "Close Editor"
                : hasAiBrief
                  ? "Edit Summary"
                  : "Write Staff Summary"}
            </Button>
          </div>

          {isEditingBrief && (
            <div
              className="grid gap-3.5 rounded-[5px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] p-4"
              data-testid="staff-brief-editor"
            >
              <div className="grid gap-0.5">
                <div className="text-[14px] font-semibold text-[var(--mf-text)]">
                  Edit Staff-Reviewed Summary
                </div>
                <p className="m-0 text-[12.5px] text-[var(--mf-text-secondary)]">
                  Saved as a separate staff-reviewed copy. The patient&apos;s
                  original statement and AI draft stay unchanged.
                </p>
              </div>

              <div className="mf-field">
                <label htmlFor="edit-chief-concern" className="mf-label">
                  <span>Chief concern</span>
                  <span className="mf-label__req">Required</span>
                </label>
                <input
                  id="edit-chief-concern"
                  type="text"
                  className="mf-input"
                  maxLength={300}
                  value={editChiefConcern}
                  onChange={(e) => onChangeChiefConcern(e.target.value)}
                  data-testid="edit-chief-concern-input"
                />
              </div>

              <div className="mf-field">
                <label htmlFor="edit-clinician-summary" className="mf-label">
                  <span>Clinical summary</span>
                  <span className="mf-label__req">Required</span>
                </label>
                <textarea
                  id="edit-clinician-summary"
                  className="mf-textarea"
                  rows={3}
                  maxLength={1200}
                  value={editClinicianSummary}
                  onChange={(e) => onChangeClinicianSummary(e.target.value)}
                  data-testid="edit-clinician-summary-textarea"
                />
              </div>

              <div className="mf-field">
                <label htmlFor="edit-missing-unclear" className="mf-label">
                  <span>Items still needing clarification (one per line)</span>
                  <span className="mf-label__req">Optional</span>
                </label>
                <textarea
                  id="edit-missing-unclear"
                  className="mf-textarea"
                  rows={2}
                  value={editMissingUnclear}
                  onChange={(e) => onChangeMissingUnclear(e.target.value)}
                  data-testid="edit-missing-unclear-textarea"
                />
              </div>

              <div className="mf-field">
                <label htmlFor="edit-correction-note" className="mf-label">
                  <span>Correction note</span>
                  <span className="mf-label__req">Required (min 3 chars)</span>
                </label>
                <input
                  id="edit-correction-note"
                  type="text"
                  className="mf-input"
                  maxLength={500}
                  placeholder="e.g., Clarified symptom onset and current medications during check-in."
                  value={editCorrectionNote}
                  onChange={(e) => onChangeCorrectionNote(e.target.value)}
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
                  onClick={onSaveEditedSummary}
                  data-testid="save-corrected-brief-btn"
                >
                  <Icon name="check" size="sm" />
                  Save Staff Summary
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  disabled={isMutatingBrief}
                  onClick={onToggleEditing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p
          className="m-0 rounded-[4px] bg-[var(--mf-surface-subtle)] px-3.5 py-2.5 text-[13px] text-[var(--mf-text-secondary)]"
          data-testid="admin-readonly-mutation-notice"
        >
          Viewing in read-only administrator mode. Confirming or editing
          clinical summaries is restricted to nurses and doctors.
        </p>
      )}
    </section>
  );
}
