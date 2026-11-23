import {
  Badge,
  ButtonLink,
  Icon,
  SignalRule,
  SourceTag,
} from "@/components/ui";

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Patient shares their concern",
    description:
      "Patients type or speak naturally in their own words, then review and confirm their exact statement.",
    source: "patient" as const,
    sourceLabel: "Patient's words",
  },
  {
    number: "02",
    title: "MedFlow organises the information",
    description:
      "AI assists with structuring the patient's account and linking extracted details to supporting quotations.",
    source: "ai" as const,
    sourceLabel: "AI Draft",
  },
  {
    number: "03",
    title: "Clinical staff review",
    description:
      "A nurse or doctor reviews the original statement and AI-assisted summary, makes corrections where necessary and manages the workflow.",
    source: "nurse" as const,
    sourceLabel: "Staff Review",
  },
] as const;

export function LandingSections() {
  return (
    <>
      {/* Section 3: How MedFlow works */}
      <section
        aria-labelledby="how-medflow-works"
        className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="mb-8 max-w-[60ch]">
          <p className="mf-eyebrow m-0 text-[var(--mf-primary-dark)]">
            How MedFlow works
          </p>
          <h2
            id="how-medflow-works"
            className="mf-t-page mt-2 mb-0 text-[var(--mf-text)]"
          >
            From patient story to structured staff review.
          </h2>
        </div>

        <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <li
              key={step.number}
              className="mf-panel flex flex-col justify-between p-5 sm:p-6"
              data-source={step.source}
            >
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="mf-mono text-[14px] font-semibold text-[var(--mf-primary-dark)]">
                    {step.number}
                  </span>
                  <SourceTag source={step.source} label={step.sourceLabel} />
                </div>
                <h3 className="mf-t-card m-0 text-[1.0625rem] text-[var(--mf-text)]">
                  {step.title}
                </h3>
                <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section 4: Evidence Integrity Engine */}
      <section
        aria-labelledby="evidence-integrity-heading"
        className="border-y border-[var(--mf-border)] bg-[var(--mf-surface)]"
      >
        <div className="mx-auto grid max-w-[1160px] items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-10">
          <div className="grid gap-4 lg:col-span-5">
            <p className="mf-eyebrow m-0 text-[var(--mf-primary-dark)]">
              Evidence Integrity Engine
            </p>
            <h2
              id="evidence-integrity-heading"
              className="mf-t-page m-0 text-[var(--mf-text)]"
            >
              Every detail should have a source.
            </h2>
            <p className="mf-t-body m-0 text-[var(--mf-text-secondary)]">
              MedFlow connects extracted details back to exact quotations in the
              patient&apos;s confirmed statement so clinicians can verify where
              each item came from.
            </p>
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Unsupported claims are never presented as verified facts. Anything
              unclear or missing stays explicitly marked for human review.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-[10px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="mf-eyebrow">Source traceability example</span>
                <Badge tone="neutral">Illustrative</Badge>
              </div>

              <div className="grid gap-3.5">
                {/* Patient statement with highlighted exact quotation */}
                <div className="rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-[var(--mf-text-secondary)]">
                      Confirmed patient statement
                    </span>
                    <SourceTag source="patient" label="Patient's words" />
                  </div>
                  <p className="m-0 text-[16px] leading-[1.55] text-[var(--mf-text)]">
                    &ldquo;I have had a{" "}
                    <mark className="rounded-[3px] border border-[var(--mf-primary)]/40 bg-[var(--mf-primary-tint)] px-1.5 py-0.5 font-semibold text-[var(--mf-primary-dark)]">
                      headache since yesterday evening
                    </mark>
                    .&rdquo;
                  </p>
                </div>

                {/* Visual link */}
                <div className="flex items-center gap-3 px-2 text-[12.5px] font-medium text-[var(--mf-primary-dark)]">
                  <Icon name="quote" size="sm" />
                  <span>Exact substring quotation located in statement</span>
                  <SignalRule className="flex-1" />
                </div>

                {/* Extracted detail + explicit gap */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="mf-panel p-3.5" data-source="ai">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="mf-eyebrow">Extracted detail</span>
                      <Badge tone="success" icon="check">
                        Matched source
                      </Badge>
                    </div>
                    <p className="m-0 text-[14.5px] font-semibold text-[var(--mf-text)]">
                      Headache since yesterday evening.
                    </p>
                    <p className="m-0 mt-1.5 text-[12.5px] text-[var(--mf-text-secondary)]">
                      Quote: &ldquo;headache since yesterday evening&rdquo;
                    </p>
                  </div>

                  <div className="rounded-[6px] border border-dashed border-[var(--mf-caution)] bg-[var(--mf-caution-tint)] p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="mf-eyebrow !text-[var(--mf-caution)]">
                        Unstated details
                      </span>
                      <Badge tone="caution">Needs review</Badge>
                    </div>
                    <p className="m-0 text-[14px] font-semibold text-[var(--mf-text)]">
                      Severity &amp; medication history
                    </p>
                    <p className="m-0 mt-1.5 text-[12.5px] text-[var(--mf-text-secondary)]">
                      Kept explicitly missing rather than assumed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Human oversight */}
      <section
        aria-labelledby="human-oversight-heading"
        className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Staff control panel preview */}
          <div className="order-2 lg:order-1 lg:col-span-6">
            <div className="mf-panel overflow-hidden" data-source="nurse">
              <div className="mf-panel__head">
                <div className="grid gap-0.5">
                  <h3 className="mf-panel__title m-0">
                    Clinical Review &amp; Workflow Controls
                  </h3>
                  <p className="mf-panel__note m-0">
                    Every operational change records who acted and why
                  </p>
                </div>
                <SourceTag source="nurse" label="Staff Control" />
              </div>

              <div className="mf-panel__body !gap-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] p-3">
                    <div className="mf-eyebrow">1. Brief review</div>
                    <div className="mt-1 text-[13.5px] font-semibold text-[var(--mf-text)]">
                      Confirm or correct
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--mf-text-secondary)]">
                      Original narrative stays unchanged
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] p-3">
                    <div className="mf-eyebrow">2. Priority</div>
                    <div className="mt-1 text-[13.5px] font-semibold text-[var(--mf-text)]">
                      Staff-assigned
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--mf-text-secondary)]">
                      Requires recorded reason
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-canvas)] p-3">
                    <div className="mf-eyebrow">3. Workflow</div>
                    <div className="mt-1 text-[13.5px] font-semibold text-[var(--mf-text)]">
                      In review · Complete
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--mf-text-secondary)]">
                      Audited status history
                    </div>
                  </div>
                </div>

                {/* Audit log snippet */}
                <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] px-3.5 py-2.5">
                  <div className="mf-eyebrow mb-2">Audit trail</div>
                  <div className="grid gap-1.5 text-[12.5px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--mf-text)]">
                        Brief reviewed &amp; priority updated by Nurse
                      </span>
                      <span className="mf-mono text-[var(--mf-text-secondary)]">
                        Recorded
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--mf-text-secondary)]">
                      <span>AI draft generated from confirmed statement</span>
                      <span className="mf-mono">Linked</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 grid gap-4 lg:order-2 lg:col-span-6">
            <p className="mf-eyebrow m-0 text-[var(--mf-primary-dark)]">
              Human oversight
            </p>
            <h2
              id="human-oversight-heading"
              className="mf-t-page m-0 text-[var(--mf-text)]"
            >
              AI assists. People remain in control.
            </h2>
            <p className="mf-t-body m-0 text-[var(--mf-text-secondary)]">
              MedFlow is an intake-support and workflow prototype, not an AI
              doctor. It never diagnoses conditions, prescribes treatment or
              moves patients ahead in the queue automatically.
            </p>
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Clinical staff review each statement, confirm or edit summaries
              with a correction note, assign operational priority and update
              workflow status with an append-only audit trail.
            </p>
          </div>
        </div>
      </section>

      {/* Section 6: Final CTA */}
      <section
        aria-labelledby="final-cta-heading"
        className="border-t-[3px] border-[var(--mf-primary)] bg-[var(--mf-navy-900)] text-white"
      >
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid max-w-[54ch] gap-3">
            <h2
              id="final-cta-heading"
              className="mf-t-page m-0 text-white sm:text-[2rem]"
            >
              Start with the patient&apos;s story.
            </h2>
            <p className="m-0 text-[15.5px] leading-[1.55] text-[var(--mf-navy-text)]">
              Try the guided patient self-intake or open the demonstration
              workspaces to see the clinical review flow in action.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink
              href="/intake"
              variant="primary"
              size="lg"
              className="!min-h-[48px] !px-6"
            >
              Start Patient Intake
              <Icon name="arrow" size="btn" />
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="onDark"
              size="lg"
              className="!min-h-[48px] !border-[var(--mf-navy-text-muted)] !bg-transparent !px-6 !text-white hover:!bg-[var(--mf-navy-800)]"
            >
              Explore Demo
            </ButtonLink>
          </div>
        </div>

        {/* Compact synthetic demonstration notice */}
        <div className="border-t border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)]">
          <div
            data-testid="home-safety-notice"
            className="mx-auto flex max-w-[1160px] items-start gap-2.5 px-4 py-3 text-[12.5px] leading-[1.45] text-[var(--mf-navy-text)] sm:px-6"
          >
            <Icon
              name="shield"
              size="sm"
              className="mt-0.5 shrink-0 text-[var(--mf-primary-light)]"
            />
            <p className="m-0">
              <strong className="font-semibold text-white">
                Demonstration prototype only.
              </strong>{" "}
              Enter synthetic information only. MedFlow is not an emergency
              service, diagnostic engine or substitute for immediate human care.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
