import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import {
  Alert,
  Badge,
  ButtonLink,
  ClinicalPanel,
  Icon,
} from "@/components/ui";
import { getPublicConfig } from "@/lib/env/public";

export default function PatientIntakePage() {
  const publicConfig = getPublicConfig();

  return (
    <main className="mf-pt">
      <div className="mf-pt__bar">
        <span className="mf-eyebrow">Patient intake node</span>
        <Badge tone="brand">
          <span className="mf-mono text-[12px]">
            {publicConfig.demoFacilityPublicCode}
          </span>
        </Badge>
      </div>

      <header>
        <h1 className="mf-pt__title m-0">
          Tell us what you&apos;re experiencing
        </h1>
        <p className="mf-pt__lead m-0">
          Use your own words. You do not need medical terms. Your confirmed
          statement will be shared with authorised facility staff for review.
        </p>
      </header>

      <DemoSafetyBanner compact />

      <ClinicalPanel
        source="patient"
        sourceLabel="Patient intake"
        title="Intake form activates in Milestone 2"
        subtitle="Canonical route /intake · Design system ready"
        action={<Badge tone="info">Pending Milestone 2</Badge>}
      >
        <Alert tone="info" title="No simulated submissions are shown here">
          This mobile-first patient intake route is styled with 18px body text
          and 56px touch targets. Typed entry, optional name or alias, optional
          age, browser voice recording, transcript review, and durable Firestore
          submission will be enabled once Milestone 2 is authorised.
        </Alert>

        <dl className="mf-dl m-0">
          <dt>Name / alias</dt>
          <dd>Optional</dd>
          <dt>Age</dt>
          <dd>Optional (never required)</dd>
          <dt>Input mode</dt>
          <dd>Typed or voice with transcript confirmation</dd>
        </dl>
      </ClinicalPanel>

      <div>
        <ButtonLink href="/" variant="secondary" size="lg" fullWidth>
          <Icon name="arrowLeft" size="md" />
          Back to overview
        </ButtonLink>
      </div>
    </main>
  );
}
