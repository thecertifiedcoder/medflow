import Link from "next/link";
import { ButtonLink, Icon } from "@/components/ui";

export default function HomePage() {
  const steps = [
    {
      number: "1",
      title: "Patient shares their concern.",
      description: "They can type or speak in their own words.",
    },
    {
      number: "2",
      title: "Information is organized.",
      description: "AI prepares an evidence-linked draft for review.",
    },
    {
      number: "3",
      title: "Clinical staff review.",
      description:
        "Nurses and doctors retain control over the clinical workflow.",
    },
  ] as const;

  return (
    <main className="bg-[var(--mf-canvas)]">
      {/* Focused Hero */}
      <section className="border-b border-[var(--mf-border)] bg-[var(--mf-surface)]">
        <div className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 sm:py-14">
          <div className="max-w-[640px]">
            <p className="m-0 text-[13px] font-semibold tracking-[0.02em] text-[var(--mf-primary-dark)]">
              Clinical intake, made clearer.
            </p>

            <h1 className="mt-2.5 mb-0 text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--mf-text)] sm:text-[2.375rem] sm:leading-[1.14]">
              Tell your story. Let your care team take it from there.
            </h1>

            <p className="mt-3.5 mb-0 max-w-[54ch] text-[1rem] leading-[1.55] text-[var(--mf-text-secondary)] sm:text-[1.0625rem]">
              MedFlow helps capture what patients report, organize the
              information and prepare it for clinical staff to review.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href="/intake"
                variant="primary"
                size="md"
                className="min-h-[48px] w-full justify-center px-5 text-[15px] sm:w-auto"
                data-testid="home-cta-patient-intake"
              >
                Start Patient Intake
                <Icon name="arrow" size="btn" />
              </ButtonLink>

              <ButtonLink
                href="/demo"
                variant="secondary"
                size="md"
                className="min-h-[48px] w-full justify-center px-5 text-[15px] sm:w-auto"
                data-testid="home-cta-demo-access"
              >
                Explore the Demo
              </ButtonLink>
            </div>

            <p className="mt-4 mb-0 text-[13.5px] text-[var(--mf-text-secondary)]">
              Clinic personnel?{" "}
              <Link
                href="/staff/login"
                data-testid="home-cta-staff-login"
                className="font-semibold text-[var(--mf-primary-dark)] underline underline-offset-2 hover:text-[var(--mf-text)]"
              >
                Staff Sign-In
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Simple 3-step explanation + Compact Safety Notice */}
      <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-7 sm:gap-8 sm:px-6 sm:py-10">
        <section aria-labelledby="how-medflow-works" className="grid gap-3">
          <h2
            id="how-medflow-works"
            className="m-0 text-[14px] font-semibold text-[var(--mf-text-secondary)]"
          >
            How MedFlow works
          </h2>

          <ol className="m-0 grid list-none divide-y divide-[var(--mf-border)] rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface)] p-0 md:grid-cols-3 md:divide-x md:divide-y-0">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex items-start gap-3 p-4 sm:p-5"
              >
                <span className="mf-mono mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--mf-primary-tint)] text-[12px] font-semibold text-[var(--mf-primary-dark)]">
                  {step.number}
                </span>
                <div className="min-w-0 grid gap-1">
                  <div className="text-[15px] font-semibold leading-[1.3] text-[var(--mf-text)]">
                    {step.title}
                  </div>
                  <p className="m-0 text-[14px] leading-[1.45] text-[var(--mf-text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside
          aria-label="Demonstration notice"
          data-testid="home-safety-notice"
          className="flex items-start gap-3 rounded-[6px] border border-[var(--mf-warning)] border-l-4 bg-[var(--mf-warning-tint)] px-4 py-3 text-[13.5px] leading-[1.45] text-[var(--mf-text)]"
        >
          <Icon
            name="shield"
            size="sm"
            className="mt-0.5 shrink-0 text-[var(--mf-warning)]"
          />
          <p className="m-0">
            <strong className="font-semibold text-[var(--mf-warning)]">
              Demonstration only.
            </strong>{" "}
            Use synthetic information only. MedFlow is not an emergency service
            or diagnostic tool.
          </p>
        </aside>
      </div>
    </main>
  );
}
