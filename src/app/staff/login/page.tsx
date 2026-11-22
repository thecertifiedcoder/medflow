import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { StaffLoginPanel } from "@/components/staff/StaffLoginPanel";
import { ButtonLink, Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <PageContainer width="narrow">
      <div className="mb-6 grid gap-2">
        <span className="mf-eyebrow">
          Facility Staff Portal · Google Authentication
        </span>
        <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
          Authorised clinical &amp; administrative staff sign in
        </h1>
        <p className="mf-t-body-sm m-0 max-w-[64ch] text-[var(--mf-text-secondary)]">
          Sign in with your provisioned Google account. MedFlow verifies your
          Firebase ID token on the server and resolves your active role (
          <code className="mf-mono text-[12px]">nurse</code>,{" "}
          <code className="mf-mono text-[12px]">doctor</code>, or{" "}
          <code className="mf-mono text-[12px]">admin</code>) and facility
          membership from Neon PostgreSQL.
        </p>
      </div>

      <DemoSafetyBanner compact className="mb-6" />

      <StaffLoginPanel />

      {/* Quiet, clearly separated callout for Hackathon Judges */}
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4"
        data-testid="judge-demo-callout"
      >
        <div className="grid gap-0.5">
          <div className="text-[13.5px] font-semibold text-[var(--mf-text)]">
            Evaluating MedFlow as a hackathon judge?
          </div>
          <p className="m-0 text-[12.5px] text-[var(--mf-text-secondary)]">
            Use the dedicated Hackathon Demo Access hub to enter immediately as
            a Demo Administrator or Demo Clinical Staff member without Google
            Sign-In.
          </p>
        </div>

        <ButtonLink href="/demo" variant="secondary" size="sm">
          <Icon name="shield" size="sm" />
          Open Hackathon Demo (/demo)
          <Icon name="arrow" size="sm" />
        </ButtonLink>
      </div>
    </PageContainer>
  );
}
