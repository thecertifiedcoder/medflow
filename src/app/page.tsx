import { DemoAccessLauncher } from "@/components/demo/DemoAccessLauncher";
import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Alert,
  Badge,
  BrandMark,
  ButtonLink,
  ClinicalPanel,
  EvidenceCard,
  Icon,
  PriorityLabel,
  SignalRule,
  SourceTag,
  Timeline,
  type TimelineEntry,
} from "@/components/ui";
import { getPublicConfig } from "@/lib/env/public";
import { getDemoModeConfig } from "@/lib/env/server";

export const dynamic = "force-dynamic";

const DEMO_TIMELINE: readonly TimelineEntry[] = [
  {
    id: "evt-1",
    timestamp: "09:12:04",
    actorType: "patient",
    actorDisplayName: "Synthetic Patient (DEMO)",
    actionLabel: "Confirmed and submitted original intake narrative",
  },
  {
    id: "evt-2",
    timestamp: "09:12:09",
    actorType: "system",
    actorDisplayName: "MedFlow Pipeline",
    actionLabel: "Structured AI draft generated and schema-validated",
  },
  {
    id: "evt-3",
    timestamp: "09:14:22",
    actorType: "staff",
    actorDisplayName: "Nurse A. Mensah (Synthetic)",
    actorRole: "nurse",
    actionLabel: "Assigned operational review priority",
    fromValue: "Unassigned",
    toValue: "Priority review",
    reason:
      "Patient reports progressive chest tightness over two hours; queued for early clinical review.",
    isOverride: true,
  },
];

export default function HomePage() {
  const publicConfig = getPublicConfig();
  const demoConfig = getDemoModeConfig();

  return (
    <div>
      {/* Full-width Navy Masthead derived directly from the attached HTML */}
      <section className="mf-on-dark border-b-4 border-[var(--mf-primary)] bg-[var(--mf-navy-900)] text-white">
        <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <BrandMark
                onDark
                subtitle="Context-Aware Clinical Intake Engine"
              />
            </div>

            <h1 className="mf-t-display m-0 max-w-[20ch] text-white">
              Structured intake clarity — with staff in control.
            </h1>

            <p className="mf-t-body m-0 max-w-[58ch] text-[var(--mf-navy-text)]">
              MedFlow preserves every patient&apos;s exact words, drafts a
              structured intake summary marked clearly as unverified AI output,
              checks source-quote provenance deterministically, and keeps all
              workflow priority decisions under qualified clinical staff.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink href="#demo-access-heading" variant="primary" size="md">
                <Icon name="shield" size="btn" />
                Try Hackathon Demo
                <Icon name="arrow" size="btn" />
              </ButtonLink>
              <ButtonLink href="/intake" variant="secondary" size="md">
                <Icon name="clipboard" size="btn" />
                Start Patient Intake
              </ButtonLink>
              <ButtonLink href="/staff/login" variant="secondary" size="md">
                <Icon name="lock" size="btn" />
                Staff Google Sign-In
              </ButtonLink>
            </div>
          </div>

          {/* 4-stage Clinical Signal Flow diagram (approved MedFlow pipeline — no TEWS/SATS) */}
          <div className="rounded-[6px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)] p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold tracking-[0.08em] text-[var(--mf-primary-light)] uppercase">
                Approved intake signal pipeline
              </span>
              <span className="mf-mono text-[12px] text-[var(--mf-navy-text-muted)]">
                {publicConfig.demoFacilityPublicCode}
              </span>
            </div>

            <ol className="m-0 grid list-none gap-3 p-0">
              <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-900)] p-3">
                <span className="mf-mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#3c4f63] text-[12px] font-semibold text-white">
                  01
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">
                    Patient narrative
                  </div>
                  <div className="text-[13px] text-[var(--mf-navy-text-muted)]">
                    Original statement captured verbatim and stored immutably.
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3 rounded-[4px] border border-dashed border-[#8d74d1] bg-[var(--mf-navy-900)] p-3">
                <span className="mf-mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#5b3fa6] text-[12px] font-semibold text-white">
                  02
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">
                    AI-assisted intake draft
                  </div>
                  <div className="text-[13px] text-[var(--mf-navy-text-muted)]">
                    Unverified structured brief with explicit uncertainty —
                    never diagnoses or scores urgency.
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-900)] p-3">
                <span className="mf-mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--mf-primary)] text-[12px] font-semibold text-white">
                  03
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">
                    Evidence Integrity check
                  </div>
                  <div className="text-[13px] text-[var(--mf-navy-text-muted)]">
                    Deterministic source-quote verification against the original
                    narrative.
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3 rounded-[4px] border border-[var(--mf-primary-light)] bg-[var(--mf-navy-900)] p-3">
                <span className="mf-mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#075e68] text-[12px] font-semibold text-white">
                  04
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">
                    Staff-controlled workflow
                  </div>
                  <div className="text-[13px] text-[var(--mf-navy-text-muted)]">
                    Authorised clinicians assign review priority with auditable
                    reasons.
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <PageContainer width="standard">
        <DemoSafetyBanner className="mb-8" />

        <DemoAccessLauncher
          demoModeEnabled={demoConfig.enabled}
          demoModeReady={demoConfig.enabled && demoConfig.configured}
          facilityPublicCode={publicConfig.demoFacilityPublicCode}
        />

        {/* Section 1: Four-source provenance architecture */}
        <section className="mb-10 grid gap-5" aria-labelledby="provenance-heading">
          <div className="grid gap-2">
            <span className="mf-eyebrow">Clinical signal provenance</span>
            <h2
              id="provenance-heading"
              className="mf-t-page m-0 text-[var(--mf-text)]"
            >
              Every fact is visibly tagged by who produced it
            </h2>
            <p className="mf-t-body-sm m-0 max-w-[68ch] text-[var(--mf-text-secondary)]">
              MedFlow separates patient words, unverified AI drafts,
              deterministic integrity checks, and staff decisions onto a
              dedicated provenance axis so clinicians never mistake machine
              assistance for verified clinical authority.
            </p>
            <SignalRule className="mt-2" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ClinicalPanel
              source="patient"
              sourceLabel="Patient · Immutable"
              title="Original patient narrative"
              subtitle="Synthetic demo statement · Stored verbatim"
              note="The patient's original confirmed statement is never overwritten by AI extraction or staff notes."
            >
              <blockquote className="mf-quote">
                &ldquo;My chest has felt tight since about 7 a.m. when I walked
                up the stairs, and I feel a little short of breath if I move
                around too quickly.&rdquo;
              </blockquote>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">DEMO DATA</Badge>
                <Badge tone="brand">Age optional (D-008)</Badge>
              </div>
            </ClinicalPanel>

            <ClinicalPanel
              source="calc"
              sourceLabel="Deterministic check"
              title="Evidence Integrity verification"
              subtitle="Approved Milestone 3 algorithm scope (D-018)"
              note="Verifies exact source-quote location and provenance only — never clinical truth, never an aggregate trust score or diagnosis."
            >
              <Alert tone="info" title="Deterministic provenance boundary">
                Each extracted quote is matched deterministically against the
                original patient statement so staff can inspect verbatim
                evidence or spot unquoted gaps immediately.
              </Alert>
              <dl className="mf-dl m-0">
                <dt>Original narrative</dt>
                <dd>Preserved separately</dd>
                <dt>AI draft</dt>
                <dd>Marked dashed purple until staff review</dd>
                <dt>Staff-reviewed copy</dt>
                <dd>Maintained separately with audit trail</dd>
              </dl>
            </ClinicalPanel>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <EvidenceCard
              label="Synthetic AI-extracted symptom (DEMO)"
              value="Chest tightness with exertional shortness of breath"
              sourceQuote="My chest has felt tight since about 7 a.m. when I walked up the stairs, and I feel a little short of breath"
              certainty="explicit"
              duration="Since ~7 a.m. (~2 hours)"
              severity="Not numerically rated"
            />

            <EvidenceCard
              label="Missing or unclear detail (DEMO)"
              value="Current medications and known drug allergies not stated"
              certainty="unclear"
            />
          </div>
        </section>

        {/* Section 2: Operational staff workflow & append-only audit */}
        <section className="mb-10 grid gap-5" aria-labelledby="workflow-heading">
          <div className="grid gap-2">
            <span className="mf-eyebrow">Human clinical authority</span>
            <h2
              id="workflow-heading"
              className="mf-t-page m-0 text-[var(--mf-text)]"
            >
              Staff-controlled workflow priority and append-only audit trail
            </h2>
            <p className="mf-t-body-sm m-0 max-w-[68ch] text-[var(--mf-text-secondary)]">
              AI never diagnoses, prescribes, scores clinical urgency, or
              reorders the queue. Operational review labels are assigned solely
              by authorised facility staff with recorded reasons.
            </p>
            <SignalRule className="mt-2" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <ClinicalPanel
              source="nurse"
              sourceLabel="Staff-owned"
              title="Operational workflow labels"
              subtitle="Organisation only — not a clinical triage score"
              note="Queue ordering is deterministic: unassigned submissions first, then staff-assigned operational review level, oldest first."
            >
              <div className="grid gap-1.5">
                <span className="mf-eyebrow">Operational priority axis</span>
                <div className="flex flex-wrap gap-2">
                  <PriorityLabel priority="unassigned" />
                  <PriorityLabel priority="immediate_review" />
                  <PriorityLabel priority="priority_review" />
                  <PriorityLabel priority="routine_review" />
                </div>
              </div>

              <div className="grid gap-1.5 pt-1">
                <span className="mf-eyebrow">Signal provenance axis</span>
                <div className="flex flex-wrap gap-2">
                  <SourceTag source="patient" label="Patient" />
                  <SourceTag source="ai" label="AI Draft" />
                  <SourceTag source="calc" label="Deterministic" />
                  <SourceTag source="nurse" label="Staff" />
                </div>
              </div>

              <Alert tone="ai" title="AI boundary enforced in schemas and database constraints">
                Extraction schemas and PostgreSQL constraints strictly reject
                diagnosis, urgency score, treatment, or priority fields. If AI
                fails, the patient&apos;s submission still stays visible in the
                facility queue.
              </Alert>
            </ClinicalPanel>

            <ClinicalPanel
              source="nurse"
              sourceLabel="Append-only audit"
              title="Synthetic audit trail example (DEMO)"
              subtitle="Explicitly distinguishes patient, system, and staff actors (D-007)"
            >
              <Timeline entries={DEMO_TIMELINE} />
            </ClinicalPanel>
          </div>
        </section>

        {/* Section 3: Active routes in this foundation */}
        <section className="grid gap-4" aria-labelledby="routes-heading">
          <div className="grid gap-1">
            <span className="mf-eyebrow">Live workspace routes</span>
            <h2
              id="routes-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Verified foundation boundaries
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <ClinicalPanel
              source="patient"
              sourceLabel="Public route"
              title="Patient intake"
              subtitle="/intake"
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between"
            >
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Single-column mobile-first intake route designed with 18px body
                text and 56px targets. Live intake submission activates in
                Milestone 2.
              </p>
              <div className="pt-2">
                <ButtonLink href="/intake" variant="primary" size="sm">
                  Open /intake
                  <Icon name="arrow" size="sm" />
                </ButtonLink>
              </div>
            </ClinicalPanel>

            <ClinicalPanel
              source="nurse"
              sourceLabel="Auth gate"
              title="Staff sign in"
              subtitle="/staff/login"
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between"
            >
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Google Sign-In paired with server-side Firebase ID token
                verification and PostgreSQL facility membership enforcement.
              </p>
              <div className="pt-2">
                <ButtonLink href="/staff/login" variant="secondary" size="sm">
                  Open /staff/login
                  <Icon name="arrow" size="sm" />
                </ButtonLink>
              </div>
            </ClinicalPanel>

            <ClinicalPanel
              source="nurse"
              sourceLabel="Protected"
              title="Facility staff queue"
              subtitle="/staff/queue"
              className="flex flex-col"
              bodyClassName="!flex flex-1 flex-col justify-between"
            >
              <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
                Protected facility-scoped intake queue with deterministic
                ordering and server-authorized PostgreSQL isolation.
              </p>
              <div className="pt-2">
                <ButtonLink href="/staff/queue" variant="secondary" size="sm">
                  Open /staff/queue
                  <Icon name="arrow" size="sm" />
                </ButtonLink>
              </div>
            </ClinicalPanel>
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
