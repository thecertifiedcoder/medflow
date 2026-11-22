import type { ReactNode } from "react";

export type ContainerWidth = "narrow" | "standard" | "wide";

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  narrow: "max-w-[680px]",
  standard: "max-w-[1160px]",
  wide: "max-w-[1360px]",
};

export interface PageContainerProps {
  width?: ContainerWidth;
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  width = "standard",
  children,
  className = "",
}: PageContainerProps) {
  return (
    <main
      className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 ${WIDTH_CLASSES[width]} ${className}`.trim()}
    >
      {children}
    </main>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--mf-border)] bg-[var(--mf-surface)]">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-4 py-5 text-[13px] text-[var(--mf-text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <strong className="font-semibold text-[var(--mf-text)]">
            MedFlow
          </strong>{" "}
          · Context-Aware Clinical Intake Engine · TCC Hackathon 2026
        </div>
        <div>
          Synthetic data only · Not clinically validated or authorised for live
          patient care
        </div>
      </div>
    </footer>
  );
}
