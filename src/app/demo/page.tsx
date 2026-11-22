import { DemoAccessLauncher } from "@/components/demo/DemoAccessLauncher";
import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { getPublicConfig } from "@/lib/env/public";
import { getDemoModeConfig } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default function HackathonDemoPage() {
  const publicConfig = getPublicConfig();
  const demoConfig = getDemoModeConfig();

  return (
    <PageContainer width="standard">
      <div className="mb-6 grid gap-2">
        <span className="mf-eyebrow">
          Hackathon Evaluation Hub · One-Click Role Access
        </span>
        <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
          Hackathon Demo Access
        </h1>
        <p className="mf-t-body-sm m-0 max-w-[68ch] text-[var(--mf-text-secondary)]">
          Inspect MedFlow&apos;s server-authorized workspaces immediately
          without Google Sign-In or manual account provisioning. Each demo role
          creates a real HTTP-only server-signed session scoped strictly to
          synthetic facility{" "}
          <code className="mf-mono text-[13px] text-[var(--mf-text)]">
            {publicConfig.demoFacilityPublicCode}
          </code>{" "}
          (<code className="mf-mono text-[13px]">demo-clinic-01</code>).
        </p>
      </div>

      <DemoSafetyBanner compact className="mb-6" />

      <DemoAccessLauncher
        demoModeEnabled={demoConfig.enabled}
        demoModeReady={demoConfig.enabled && demoConfig.configured}
        facilityPublicCode={publicConfig.demoFacilityPublicCode}
      />
    </PageContainer>
  );
}
