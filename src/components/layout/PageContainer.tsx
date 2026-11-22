import Link from "next/link";
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
    <footer className="mt-8 border-t border-[var(--mf-border)] bg-[var(--mf-surface)]">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-3 px-4 py-5 text-[13px] text-[var(--mf-text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <strong className="font-semibold text-[var(--mf-text)]">
            MedFlow
          </strong>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            <Link
              href="/intake"
              className="text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-primary-dark)] hover:underline"
            >
              Patient Intake
            </Link>
            <Link
              href="/staff/login"
              className="text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-primary-dark)] hover:underline"
            >
              Staff Sign-In
            </Link>
            <Link
              href="/demo"
              className="text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-primary-dark)] hover:underline"
            >
              Hackathon Demo
            </Link>
          </nav>
        </div>
        <div className="text-[12.5px]">
          Synthetic demonstration only · Not for real patient care
        </div>
      </div>
    </footer>
  );
}
