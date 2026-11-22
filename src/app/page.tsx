import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EvidenceCard,
  FormField,
  Icon,
  PriorityLabel,
  Textarea,
  TextInput,
  Timeline,
  type TimelineEntry,
} from "@/components/ui";

const DEMO_TIMELINE_ENTRIES: readonly TimelineEntry[] = [
  {
    id: "evt-demo-1",
    title: "Intake submitted",
    actorType: "patient",
    actorLabel: "Patient (confirmed narrative)",
    timestampLabel: "10:42 AM",
    isDemo: true,
  },
  {
    id: "evt-demo-2",
    title: "AI intake draft validated",
    actorType: "system",
    actorLabel: "Extraction pipeline",
    timestampLabel: "10:42 AM",
    isDemo: true,
  },
  {
    id: "evt-demo-3",
    title: "Workflow priority assigned",
    actorType: "staff",
    actorLabel: "Nurse A. Bello (nurse)",
    timestampLabel: "10:48 AM",
    transitionLabel: "Unassigned → Priority review",
    reason: "Reviewed confirmed narrative and queued for clinical assessment.",
    isDemo: true,
  },
];

export default function HomePage() {
  return (
    <PageContainer>
      {/* Hero section */}
      <section className="grid items-center gap-10 py-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:py-8">
        <div>
          <div className="inline-flex items-center gap-2.5 text-[11px] font-extrabold tracking-[0.14em] text-[var(--mf-brand)] uppercase">
            <span
              className="h-px w-7 bg-[var(--mf-brand)]"
              aria-hidden="true"
            />
            Context-aware clinical intake
          </div>

          <h1 className="mf-display mt-4 mb-5 max-w-[680px] text-[38px] leading-[1.06] font-normal tracking-[-0.04em] text-[var(--mf-ink)] sm:text-[52px]">
            From patient story to{" "}
            <em className="text-[var(--mf-brand)] italic">clinical clarity.</em>
          </h1>

          <p className="mb-6 max-w-[580px] text-[15px] leading-[1.7] text-[var(--mf-muted)]">
            MedFlow turns a patient&apos;s spoken or typed account into an
            editable transcript and an evidence-linked intake brief that
            authorised clinical staff can verify, correct, and manage within a
            live workflow queue.
          </p>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/intake" variant="primary" size="lg">
              Open patient intake
              <Icon name="arrow" size="sm" />
            </ButtonLink>
            <ButtonLink href="/staff/login" variant="secondary" size="lg">
              Staff sign in
            </ButtonLink>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--mf-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" size="sm" className="text-[var(--mf-brand)]" />
              Human-led decisions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="mic" size="sm" className="text-[var(--mf-brand)]" />
              Voice + typed fallback
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="file" size="sm" className="text-[var(--mf-brand)]" />
              Evidence-linked drafts
            </span>
          </div>
        </div>

        <aside
          aria-label="Illustrative evidence-linked intake concept"
          className="relative overflow-hidden rounded-[24px] bg-[#183a34] p-6 text-white shadow-[var(--mf-shadow-3)]"
        >
          <div className="mb-5 flex items-center justify-between text-[11px] tracking-[0.1em] text-white/75 uppercase">
            <span>MedFlow / Intake brief</span>
            <span>Synthetic specimen</span>
          </div>

          <div className="rounded-[15px] bg-[#f8faf7] p-5 text-[var(--mf-ink)] shadow-[0_16px_34px_rgba(0,0,0,0.17)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold tracking-[0.1em] text-[var(--mf-muted)] uppercase">
                Patient statement · Voice
              </span>
              <Badge tone="brand">Transcript confirmed</Badge>
            </div>

            <p className="m-0 text-[14px] leading-relaxed font-medium text-[var(--mf-ink)]">
              “My head has been paining me since yesterday evening. I started
              feeling dizzy this morning.”
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mf-line)] pt-3">
              <span className="text-[10px] font-extrabold tracking-[0.1em] text-[var(--mf-muted)] uppercase">
                Structured draft
              </span>
              <Badge tone="warning">Needs staff review</Badge>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge tone="neutral">Headache</Badge>
              <Badge tone="neutral">Dizziness</Badge>
              <Badge tone="brand">2 source quotes</Badge>
            </div>
          </div>

          <p className="m-0 mt-4 text-[12px] leading-relaxed text-white/75">
            Source stays visible. AI organises the narrative as a draft;
            qualified clinical staff own review, workflow priority, and patient
            care.
          </p>
        </aside>
      </section>

      <DemoSafetyBanner className="mt-4" />

      {/* Core Clinical Principles */}
      <section
        aria-labelledby="principles-heading"
        className="mt-12 border-t border-[var(--mf-line)] pt-10"
      >
        <div className="mb-6">
          <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-[var(--mf-brand)] uppercase">
            Core boundaries
          </p>
          <h2
            id="principles-heading"
            className="mf-display mt-2 mb-1 text-[28px] leading-tight font-normal tracking-[-0.03em] text-[var(--mf-ink)]"
          >
            Clarity is a clinical tool.
          </h2>
          <p className="m-0 max-w-[680px] text-[14px] text-[var(--mf-muted)]">
            Every surface preserves patient wording, makes missing information
            explicit, and keeps clinical decisions under human staff control.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padded>
            <div className="mf-display mb-3 text-[24px] text-[var(--mf-brand)]">
              01
            </div>
            <h3 className="m-0 mb-1.5 text-[14px] font-bold text-[var(--mf-ink)]">
              Patient words first
            </h3>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mf-muted)]">
              Preserve the confirmed narrative unchanged alongside AI drafts and
              staff corrections.
            </p>
          </Card>

          <Card padded>
            <div className="mf-display mb-3 text-[24px] text-[var(--mf-brand)]">
              02
            </div>
            <h3 className="m-0 mb-1.5 text-[14px] font-bold text-[var(--mf-ink)]">
              Voice with an escape hatch
            </h3>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mf-muted)]">
              Voice and typing are equally visible. Permission or transcription
              failure never blocks intake.
            </p>
          </Card>

          <Card padded>
            <div className="mf-display mb-3 text-[24px] text-[var(--mf-brand)]">
              03
            </div>
            <h3 className="m-0 mb-1.5 text-[14px] font-bold text-[var(--mf-ink)]">
              Evidence before interpretation
            </h3>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mf-muted)]">
              Extracted facts point back to source phrases; missing details stay
              explicitly unknown.
            </p>
          </Card>

          <Card padded>
            <div className="mf-display mb-3 text-[24px] text-[var(--mf-brand)]">
              04
            </div>
            <h3 className="m-0 mb-1.5 text-[14px] font-bold text-[var(--mf-ink)]">
              Human owns the workflow
            </h3>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mf-muted)]">
              AI drafts only. Provisioned staff review, assign workflow
              priority, and create auditable history.
            </p>
          </Card>
        </div>
      </section>

      {/* Reusable Design-System Foundation Primitives */}
      <section
        aria-labelledby="primitives-heading"
        className="mt-12 border-t border-[var(--mf-line)] pt-10"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] font-extrabold tracking-[0.13em] text-[var(--mf-brand)] uppercase">
              Design system foundation
            </p>
            <h2
              id="primitives-heading"
              className="mf-display mt-2 mb-1 text-[28px] leading-tight font-normal tracking-[-0.03em] text-[var(--mf-ink)]"
            >
              Verified reusable UI primitives.
            </h2>
            <p className="m-0 max-w-[680px] text-[14px] text-[var(--mf-muted)]">
              Ported directly from the MedFlow design tokens and visual
              reference. All sample content below is synthetic{" "}
              <strong className="font-semibold text-[var(--mf-ink-secondary)]">
                DEMO DATA
              </strong>{" "}
              for component verification only.
            </p>
          </div>
          <Badge tone="brand">Milestone 1A Foundation</Badge>
        </div>

        <div className="grid gap-5">
          {/* Buttons & Badges */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Navigation & action controls"
                subtitle="Active route links and disabled state — zero inert controls"
              />
              <CardBody>
                <div className="flex flex-wrap items-center gap-2.5">
                  <ButtonLink href="/intake" variant="primary" size="md">
                    Patient intake
                    <Icon name="arrow" size="sm" />
                  </ButtonLink>
                  <ButtonLink href="/staff/login" variant="secondary" size="md">
                    Staff sign in
                  </ButtonLink>
                  <ButtonLink href="/staff/queue" variant="quiet" size="md">
                    Staff queue gate
                  </ButtonLink>
                  <Button variant="primary" size="md" disabled>
                    Disabled action
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Semantic status badges"
                subtitle="Always paired with explicit text labels — never colour alone"
              />
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">New</Badge>
                  <Badge tone="brand">In review</Badge>
                  <Badge tone="success" dot>
                    Confirmed
                  </Badge>
                  <Badge tone="warning">Needs clarification</Badge>
                  <Badge tone="danger">AI unavailable</Badge>
                  <Badge tone="info">AI draft ready</Badge>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Form fields & validation */}
          <Card>
            <CardHeader
              title="Form fields & validation states"
              subtitle="Accessible labels, optional markers, hints, and inline errors (read-only specimens)"
            />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  id="specimen-alias"
                  label="Name or alias"
                  optional
                  hint="Optional; a generated reference identifies the record if left blank."
                >
                  <TextInput
                    id="specimen-alias"
                    value="T. Adebayo"
                    readOnly
                    aria-describedby="specimen-alias-hint"
                  />
                </FormField>

                <FormField
                  id="specimen-age"
                  label="Age"
                  optional
                  hint="Always optional — never required for intake submission."
                >
                  <TextInput
                    id="specimen-age"
                    type="number"
                    placeholder="Optional"
                    readOnly
                    aria-describedby="specimen-age-hint"
                  />
                </FormField>

                <FormField
                  id="specimen-narrative"
                  label="Confirmed statement"
                  required
                  error="Please enter what you are experiencing before continuing."
                >
                  <Textarea
                    id="specimen-narrative"
                    rows={2}
                    value=""
                    readOnly
                    hasError
                    placeholder="Describe what is happening in your own words"
                    aria-describedby="specimen-narrative-error"
                  />
                </FormField>
              </div>
            </CardBody>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader
              title="Clinical & operational notices"
              subtitle="Calm, non-alarmist messaging for AI drafts, unknowns, and failure fallbacks"
            />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <Alert tone="info" title="AI-generated intake draft">
                  Review this information against the patient&apos;s original
                  words. It is not a diagnosis or clinical urgency decision.
                </Alert>
                <Alert tone="warning" title="More information needed">
                  Some details were not stated or could not be extracted
                  clearly. Missing data remains unknown.
                </Alert>
                <Alert tone="danger" title="AI summary unavailable">
                  The original patient statement is preserved and remains
                  available for staff review.
                </Alert>
                <Alert tone="success" title="Intake received">
                  The intake record is saved before AI extraction begins.
                </Alert>
              </div>
            </CardBody>
          </Card>

          {/* Evidence Cards & Priority / Timeline */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Evidence-linked fact cards"
                subtitle="Synthetic DEMO DATA illustrating source quote traceability and explicit unknowns"
                action={<Badge tone="warning">DEMO DATA</Badge>}
              />
              <CardBody className="grid gap-3">
                <EvidenceCard
                  value="Headache"
                  certainty="explicit"
                  sourceQuote="My head has been paining me since yesterday evening."
                  duration="since yesterday evening"
                  severity={null}
                />
                <EvidenceCard
                  value="Severity"
                  certainty="unclear"
                  provenanceLabel="Explicitly marked unknown · Requires staff follow-up"
                />
              </CardBody>
            </Card>

            <div className="grid gap-5">
              <Card>
                <CardHeader
                  title="Staff-assigned workflow priority"
                  subtitle="Queue organisation labels only — never AI-assigned or a clinical triage scale"
                />
                <CardBody>
                  <div className="flex flex-wrap gap-2">
                    <PriorityLabel priority="unassigned" />
                    <PriorityLabel priority="immediate_review" />
                    <PriorityLabel priority="priority_review" />
                    <PriorityLabel priority="routine_review" />
                  </div>
                  <p className="m-0 mt-3 text-[12px] text-[var(--mf-muted)]">
                    Workflow labels are assigned by authorised staff for queue
                    organisation and are not a validated clinical triage scale
                    or treatment-time promise.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Append-only audit timeline"
                  subtitle="Distinguishes patient, system, and staff actors explicitly"
                  action={<Badge tone="warning">DEMO DATA</Badge>}
                />
                <CardBody>
                  <Timeline entries={DEMO_TIMELINE_ENTRIES} />
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
