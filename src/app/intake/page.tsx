import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, Badge, ButtonLink, Card, CardBody, Icon } from "@/components/ui";
import { getPublicConfig } from "@/lib/env/public";

export default function PatientIntakePage() {
  const publicConfig = getPublicConfig();

  return (
    <PageContainer width="narrow">
      <div className="mb-5">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-[var(--mf-brand)] uppercase">
          <span
            className="h-px w-6 bg-[var(--mf-brand)]"
            aria-hidden="true"
          />
          Patient intake · {publicConfig.demoFacilityPublicCode}
        </div>
        <h1 className="mf-display mt-0 mb-2 text-[32px] leading-[1.1] font-normal tracking-[-0.03em] text-[var(--mf-ink)]">
          Tell us what you&apos;re experiencing.
        </h1>
        <p className="m-0 text-[14px] leading-relaxed text-[var(--mf-muted)]">
          Use your own words. You can type or speak; you do not need medical
          terms. Your confirmed statement will be shown to authorised staff for
          review.
        </p>
      </div>

      <DemoSafetyBanner className="mb-5" />

      <Card>
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-bold text-[var(--mf-ink)]">
              Milestone 1A route foundation
            </h2>
            <Badge tone="info">Backend not yet connected</Badge>
          </div>

          <Alert tone="info" title="Intake submission activates after Milestone 1B">
            This canonical patient route (<code>/intake</code>) is live on the
            Next.js App Router foundation. Typed entry, optional name/alias and
            optional age, browser voice recording, transcript review, and
            durable Firestore persistence will be enabled once Firebase and
            Gemini integration are approved. No simulated intake submissions are
            presented here.
          </Alert>

          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href="/" variant="secondary" size="md">
              <Icon name="arrow" size="sm" className="rotate-180" />
              Back to overview
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
