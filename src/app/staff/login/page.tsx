import { PageContainer } from "@/components/layout/PageContainer";
import { StaffLoginPanel } from "@/components/staff/StaffLoginPanel";

export default function StaffLoginPage() {
  return (
    <PageContainer width="narrow">
      <div className="mb-5">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-[var(--mf-brand)] uppercase">
          <span
            className="h-px w-6 bg-[var(--mf-brand)]"
            aria-hidden="true"
          />
          Staff portal · Authentication
        </div>
        <h1 className="mf-display mt-0 mb-2 text-[32px] leading-[1.1] font-normal tracking-[-0.03em] text-[var(--mf-ink)]">
          A private entrance for clinical staff.
        </h1>
        <p className="m-0 text-[14px] leading-relaxed text-[var(--mf-muted)]">
          The staff workspace uses Google Sign-In and is restricted to
          provisioned, active staff accounts linked to an authorised facility
          and role. Sign-in alone does not grant access to intake records.
        </p>
      </div>

      <StaffLoginPanel />
    </PageContainer>
  );
}
