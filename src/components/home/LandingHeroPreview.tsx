import { Badge, Icon, SignalRule, SourceTag } from "@/components/ui";

/**
 * Realistic product-interface preview built from MedFlow design-system primitives.
 * Uses synthetic illustrative content only; never invents clinical metrics or diagnoses.
 */
export function LandingHeroPreview() {
  return (
    <aside
      aria-label="Illustrative MedFlow workflow preview"
      className="rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-surface)] shadow-[0_1px_2px_rgba(11,29,46,0.08)] overflow-hidden"
    >
      {/* Window chrome / top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--mf-text)]">
          <Icon name="activity" size="sm" className="text-[var(--mf-primary-dark)]" />
          <span>Structured Intake Workflow</span>
        </div>
        <span className="mf-mono text-[11.5px] font-medium text-[var(--mf-text-secondary)]">
          Illustrative example · Synthetic
        </span>
      </div>

      <div className="grid gap-3.5 bg-[var(--mf-canvas)] p-4 sm:p-5">
        {/* 1. Patient Narrative Card */}
        <div className="mf-panel" data-source="patient">
          <div className="mf-panel__head !py-2.5">
            <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
              Original patient statement
            </span>
            <SourceTag source="patient" label="Patient's words" />
          </div>
          <div className="mf-panel__body !py-3">
            <p className="m-0 rounded-[4px] border-l-[3px] border-[var(--mf-src-patient)] bg-[var(--mf-src-patient-tint)] px-3.5 py-2.5 text-[14.5px] leading-[1.55] text-[var(--mf-text)]">
              &ldquo;I have had{" "}
              <mark className="rounded-[2px] bg-[var(--mf-primary-tint)] px-1 py-0.5 font-medium text-[var(--mf-primary-dark)]">
                tight pressure in my chest
              </mark>{" "}
              since{" "}
              <mark className="rounded-[2px] bg-[var(--mf-primary-tint)] px-1 py-0.5 font-medium text-[var(--mf-primary-dark)]">
                two hours ago
              </mark>
              , and I feel slightly dizzy.&rdquo;
            </p>
          </div>
        </div>

        <SignalRule className="px-1" />

        {/* 2. AI-Assisted Summary Card */}
        <div className="mf-panel" data-source="ai">
          <div className="mf-panel__head !py-2.5">
            <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
              AI-assisted brief
            </span>
            <SourceTag source="ai" label="AI Draft" />
          </div>
          <div className="mf-panel__body !gap-2.5 !py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] px-3 py-2">
              <div className="grid gap-0.5">
                <span className="mf-eyebrow">Chief concern</span>
                <span className="text-[14px] font-semibold text-[var(--mf-text)]">
                  Chest pressure &amp; dizziness
                </span>
              </div>
              <Badge tone="brand" icon="quote">
                Matched quote
              </Badge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-dashed border-[var(--mf-caution)] bg-[var(--mf-caution-tint)] px-3 py-2 text-[12.5px] font-medium text-[var(--mf-caution)]">
              <span>Current medications &amp; allergies: Not stated</span>
              <span>Needs review</span>
            </div>
          </div>
        </div>

        {/* 3. Human Clinical Oversight Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--mf-border)] border-t-[3px] border-t-[var(--mf-src-nurse)] bg-[var(--mf-surface)] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <SourceTag source="nurse" label="Staff Review" />
            <span className="text-[13px] font-semibold text-[var(--mf-text)]">
              Clinician confirms &amp; assigns priority
            </span>
          </div>
          <Badge tone="success" icon="checkCircle">
            Human controlled
          </Badge>
        </div>
      </div>
    </aside>
  );
}
