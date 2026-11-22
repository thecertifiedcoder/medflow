import type { ReactNode } from "react";

export type ContainerWidth = "narrow" | "standard" | "wide";

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  narrow: "max-w-[640px]",
  standard: "max-w-[1220px]",
  wide: "max-w-[1440px]",
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
      className={`mx-auto w-full px-4 py-8 sm:px-7 sm:py-10 ${WIDTH_CLASSES[width]} ${className}`.trim()}
    >
      {children}
    </main>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--mf-line)] bg-[var(--mf-canvas)]">
      <div className="mx-auto flex max-w-[1220px] flex-col gap-2 px-4 py-6 text-[12px] text-[var(--mf-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <strong className="font-semibold text-[var(--mf-ink-secondary)]">
            MedFlow
          </strong>{" "}
          · Voice-first, AI-assisted clinical intake prototype · TCC Hackathon
          2026
        </div>
        <div>
          Synthetic data only · Not clinically validated or for live patient
          care
        </div>
      </div>
    </footer>
  );
}
