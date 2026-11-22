import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Badge,
  BrandMark,
  ButtonLink,
  ClinicalPanel,
  Icon,
  SignalRule,
  SourceTag,
} from "@/components/ui";
import { getPublicConfig } from "@/lib/env/public";
import { getDemoModeConfig } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const publicConfig = getPublicConfig();
  const demoConfig = getDemoModeConfig();
  const demoReady = demoConfig.enabled && demoConfig.configured;

  return (
    <div>
      {/* Focused Navy Entry Masthead */}
      <section className="mf-on-dark border-b-4 border-[var(--mf-primary)] bg-[var(--mf-navy-900)] text-white">
        <div className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark
                  onDark
                  subtitle="Context-Aware Clinical Intake & Workflow"
                />
              </div>

              <h1 className="mf-t-display m-0 max-w-[22ch] text-white">
                Structured clinical intake — with qualified staff in control.
              </h1>

              <p className="mf-t-body m-0 max-w-[60ch] text-[var(--mf-navy-text)]">
                MedFlow captures a patient&apos;s exact words, organizes an
                evidence-linked intake draft for clinicians, and keeps every
                workflow priority decision under human clinical authority.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="mf-chip mf-chip--on-dark">
                  <Icon name="user" size="sm" />
                  Patients: No account required
                </span>
                <span className="mf-chip mf-chip--on-dark">
                  <Icon name="userCheck" size="sm" />
                  Clinicians &amp; Admins: Server-verified RBAC
                </span>
                <span className="mf-chip mf-chip--on-dark">
                  <Icon name="shield" size="sm" />
                  Facility:{" "}
                  <strong className="mf-mono">
                    {publicConfig.demoFacilityPublicCode}
                  </strong>
                </span>
              </div>
            </div>

            {/* Concise 4-Source Provenance Summary Box */}
            <div className="rounded-[6px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)] p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold tracking-[0.08em] text-[var(--mf-primary-light)] uppercase">
                  How MedFlow separates clinical signal
                </span>
                <span className="mf-mono text-[12px] text-[var(--mf-navy-text-muted)]">
                  Provenance Axis
                </span>
              </div>

              <ol className="m-0 grid list-none gap-2.5 p-0">
                <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-900)] p-2.5">
                  <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#3c4f63] text-[11px] font-semibold text-white">
                    01
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">
                      Patient Narrative (Immutable)
                    </div>
                    <div className="text-[12px] text-[var(--mf-navy-text-muted)]">
                      Captured in the patient&apos;s own words and never
                      overwritten.
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-[4px] border border-dashed border-[#8d74d1] bg-[var(--mf-navy-900)] p-2.5">
                  <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#5b3fa6] text-[11px] font-semibold text-white">
                    02
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">
                      AI-Assisted Draft (Advisory Only)
                    </div>
                    <div className="text-[12px] text-[var(--mf-navy-text-muted)]">
                      Unverified structured summary — never diagnoses or assigns
                      urgency.
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-900)] p-2.5">
                  <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-primary)] text-[11px] font-semibold text-white">
                    03
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">
                      Deterministic Evidence Check
                    </div>
                    <div className="text-[12px] text-[var(--mf-navy-text-muted)]">
                      Verifies exact quote provenance against the patient
                      statement.
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-primary-light)] bg-[var(--mf-navy-900)] p-2.5">
                  <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#075e68] text-[11px] font-semibold text-white">
                    04
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">
                      Staff-Controlled Workflow
                    </div>
                    <div className="text-[12px] text-[var(--mf-navy-text-muted)]">
                      Nurses and doctors review facts and assign queue priority
                      with audit reasons.
                    </div>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <PageContainer width="standard">
        <DemoSafetyBanner compact className="mb-8" />

        {/* Primary Entry-Point Selection Section */}
        <section
          aria-labelledby="entry-points-heading"
          className="mb-10 grid gap-5"
          data-testid="home-entry-paths"
        >
          <div className="grid gap-1.5">
            <span className="mf-eyebrow">Choose your entry path</span>
            <h2
              id="entry-points-heading"
              className="mf-t-page m-0 text-[var(--mf-text)]"
            >
              Where would you like to begin?
            </h2>
            <p className="mf-t-body-sm m-0 max-w-[66ch] text-[var(--mf-text-secondary)]">
              MedFlow provides dedicated experiences for patients submitting an
              intake, clinical and administrative staff managing facility
              operations, and hackathon judges evaluating the system.
            </p>
            <SignalRule className="mt-1.5" />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Path 1: Patient Intake */}
            <ClinicalPanel
              source="patient"
              sourceLabel="For Patients"
              title="1. Patient Intake"
              subtitle="Public self-intake · No account required"
              action={<Badge tone="neutral">Mobile-first</Badge>}
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between gap-5"
            >
              <div className="grid gap-3">
                <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                  Arriving at the clinic? Describe what brings you in today in
                  your own words using large, accessible typed or voice-first
                  controls.
                </p>
                <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] text-[var(--mf-text-secondary)]">
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Dedicated calm patient layout</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Review &amp; confirm before sending</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Immediate human help notice</span>
                  </li>
                </ul>
              </div>

              <div className="pt-1">
                <ButtonLink
                  href="/intake"
                  variant="primary"
                  size="md"
                  fullWidth
                  data-testid="home-cta-patient-intake"
                >
                  <Icon name="clipboard" size="btn" />
                  Start Patient Intake
                  <Icon name="arrow" size="btn" />
                </ButtonLink>
              </div>
            </ClinicalPanel>

            {/* Path 2: Authorised Staff Sign-In */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="For Clinic Personnel"
              title="2. Staff Sign-In"
              subtitle="Nurses, doctors & facility administrators"
              action={
                <Badge tone="brand" icon="lock">
                  Google Auth + RBAC
                </Badge>
              }
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between gap-5"
            >
              <div className="grid gap-3">
                <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                  Sign in with your provisioned Google staff account. MedFlow
                  verifies your Firebase ID token on the server and checks
                  PostgreSQL facility authorization.
                </p>
                <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] text-[var(--mf-text-secondary)]">
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Clinicians open the facility queue</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Administrators open facility governance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Strict tenant isolation in PostgreSQL</span>
                  </li>
                </ul>
              </div>

              <div className="pt-1">
                <ButtonLink
                  href="/staff/login"
                  variant="secondary"
                  size="md"
                  fullWidth
                  data-testid="home-cta-staff-login"
                >
                  <Icon name="lock" size="btn" />
                  Staff Sign-In
                  <Icon name="arrow" size="btn" />
                </ButtonLink>
              </div>
            </ClinicalPanel>

            {/* Path 3: Hackathon Demo Access */}
            <ClinicalPanel
              source="nurse"
              sourceLabel="For Judges & Evaluators"
              title="3. Hackathon Demo Access"
              subtitle={`One-click evaluation · ${publicConfig.demoFacilityPublicCode}`}
              action={
                <Badge
                  tone={demoReady ? "success" : "warning"}
                  icon="shield"
                >
                  {demoReady ? "Demo Ready" : "Check Config"}
                </Badge>
              }
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between gap-5"
            >
              <div className="grid gap-3">
                <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                  Evaluate MedFlow immediately without Google OAuth setup. Enter
                  with one click as either a{" "}
                  <strong>Demo Administrator</strong> or{" "}
                  <strong>Demo Clinical Staff</strong> member.
                </p>
                <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] text-[var(--mf-text-secondary)]">
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>HTTP-only server-signed demo session</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>Compare Admin vs Clinical Staff workspaces</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon
                      name="check"
                      size="sm"
                      className="text-[var(--mf-primary)]"
                    />
                    <span>100% synthetic clinic data</span>
                  </li>
                </ul>
              </div>

              <div className="pt-1">
                <ButtonLink
                  href="/demo"
                  variant="primary"
                  size="md"
                  fullWidth
                  data-testid="home-cta-demo-access"
                >
                  <Icon name="shield" size="btn" />
                  Open Hackathon Demo
                  <Icon name="arrow" size="btn" />
                </ButtonLink>
              </div>
            </ClinicalPanel>
          </div>
        </section>

        {/* Compact Clinical Safety & Role Architecture Summary */}
        <section
          aria-labelledby="safety-architecture-heading"
          className="grid gap-4 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <span className="mf-eyebrow">Clinical safety &amp; governance</span>
              <h2
                id="safety-architecture-heading"
                className="mf-t-section m-0 text-[var(--mf-text)]"
              >
                Designed for intake clarity — never autonomous diagnosis
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SourceTag source="patient" label="Patient Source" />
              <SourceTag source="ai" label="AI Draft" />
              <SourceTag source="calc" label="Evidence Check" />
              <SourceTag source="nurse" label="Staff Authority" />
            </div>
          </div>

          <div className="grid gap-4 border-t border-[var(--mf-border)] pt-4 text-[13.5px] text-[var(--mf-text-secondary)] md:grid-cols-3">
            <div>
              <strong className="block text-[var(--mf-text)]">
                1. Non-diagnostic boundary
              </strong>
              <span>
                MedFlow never diagnoses conditions, prescribes treatment, clears
                a patient to wait, or assigns autonomous triage scores.
              </span>
            </div>
            <div>
              <strong className="block text-[var(--mf-text)]">
                2. Verbatim narrative preservation
              </strong>
              <span>
                The patient&apos;s confirmed statement is stored immutably. AI
                drafts and staff-reviewed copies are maintained as separate
                records.
              </span>
            </div>
            <div>
              <strong className="block text-[var(--mf-text)]">
                3. Enforced role separation
              </strong>
              <span>
                Patients, clinical staff (`nurse` / `doctor`), and facility
                administrators (`admin`) operate in distinct, server-authorized
                routes.
              </span>
            </div>
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
