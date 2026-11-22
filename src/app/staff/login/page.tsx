import { DemoSafetyBanner } from "@/components/layout/DemoSafetyBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { StaffLoginPanel } from "@/components/staff/StaffLoginPanel";

export default function StaffLoginPage() {
  return (
    <PageContainer width="narrow">
      <div className="mb-6 grid gap-2">
        <span className="mf-eyebrow">Staff portal · Authentication</span>
        <h1 className="mf-t-page m-0 text-[var(--mf-text)]">
          Authorised clinical staff sign in
        </h1>
        <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
          The staff workspace uses Google Sign-In and is restricted to
          provisioned, active staff accounts linked to an authorised facility
          and role. Sign-in alone does not grant access to intake records.
        </p>
      </div>

      <DemoSafetyBanner compact className="mb-6" />

      <StaffLoginPanel />
    </PageContainer>
  );
}
