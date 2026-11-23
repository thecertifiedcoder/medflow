import { LandingHeroPreview } from "@/components/home/LandingHeroPreview";
import { LandingSections } from "@/components/home/LandingSections";
import { ButtonLink, Icon } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="bg-[var(--mf-canvas)]">
      {/* Section 2: Balanced Two-Part Hero */}
      <section className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)]">
        <div className="mx-auto grid max-w-[1160px] items-center gap-8 px-4 py-9 sm:px-6 sm:py-14 lg:grid-cols-12 lg:gap-10">
          {/* Left: Clear Product Messaging */}
          <div className="grid gap-5 lg:col-span-6">
            <div className="grid gap-3">
              <p className="mf-eyebrow m-0 text-[var(--mf-primary-dark)]">
                Clinical intake &amp; staff review
              </p>

              <h1 className="m-0 text-[2rem] font-semibold leading-[1.14] tracking-[-0.02em] text-[var(--mf-text)] sm:text-[2.625rem]">
                Patient intake, made clearer.
              </h1>

              <p className="m-0 max-w-[50ch] text-[1.0625rem] leading-[1.55] text-[var(--mf-text-secondary)]">
                MedFlow helps clinical teams capture what patients say, organise
                the important details and review AI-assisted summaries while
                keeping the patient&apos;s original words intact.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href="/intake"
                variant="primary"
                size="lg"
                className="!min-h-[48px] w-full justify-center !px-6 text-[15.5px] sm:w-auto"
                data-testid="home-cta-patient-intake"
              >
                Start Patient Intake
                <Icon name="arrow" size="btn" />
              </ButtonLink>

              <ButtonLink
                href="/demo"
                variant="secondary"
                size="lg"
                className="!min-h-[48px] w-full justify-center !px-6 text-[15.5px] sm:w-auto"
                data-testid="home-cta-demo-access"
              >
                Judge Access
              </ButtonLink>
            </div>
          </div>

          {/* Right: Structured MedFlow Product Composition */}
          <div className="min-w-0 lg:col-span-6">
            <LandingHeroPreview />
          </div>
        </div>
      </section>

      <LandingSections />
    </main>
  );
}
