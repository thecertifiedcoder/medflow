import { DemoAccessLauncher } from "@/components/demo/DemoAccessLauncher";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge, Icon } from "@/components/ui";
import { getDemoModeConfig } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default function HackathonDemoPage() {
  const demoConfig = getDemoModeConfig();

  return (
    <PageContainer width="standard" className="max-w-[680px] py-8 sm:py-14">
      <div className="mb-7 grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="brand" icon="shieldCheck">
            Hackathon demonstration · Synthetic data only
          </Badge>
        </div>

        <h1 className="m-0 text-[1.875rem] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--mf-text)] sm:text-[2.25rem]">
          Welcome to MedFlow.
        </h1>

        <p className="m-0 max-w-[54ch] text-[1.0625rem] leading-[1.55] text-[var(--mf-text-secondary)]">
          Explore how MedFlow turns patient statements into structured,
          evidence-linked information for clinical staff to review.
        </p>

        <p className="m-0 flex items-center gap-2 text-[13px] text-[var(--mf-text-secondary)]">
          <Icon
            name="info"
            size="sm"
            className="shrink-0 text-[var(--mf-primary-dark)]"
          />
          <span>
            Demonstration prototype only. Use synthetic data and do not enter
            real patient details.
          </span>
        </p>
      </div>

      <DemoAccessLauncher
        demoModeEnabled={demoConfig.enabled}
        demoModeReady={demoConfig.enabled && demoConfig.configured}
      />
    </PageContainer>
  );
}
