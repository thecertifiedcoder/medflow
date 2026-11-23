"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui";

export function AppFooter() {
  const pathname = usePathname() ?? "/";
  const isPatientIntake =
    pathname === "/intake" || pathname.startsWith("/intake/");
  const isStaffWorkspace =
    pathname === "/staff/queue" ||
    pathname.startsWith("/staff/queue/") ||
    pathname === "/staff/admin" ||
    pathname.startsWith("/staff/admin/") ||
    pathname.startsWith("/staff/intakes/");

  // Focused patient intake and authenticated clinical staff routes never render the public marketing footer.
  if (isPatientIntake || isStaffWorkspace) {
    return null;
  }

  return (
    <footer className="border-t border-[var(--mf-border)] bg-[var(--mf-surface)]">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4 px-4 py-6 text-[13px] text-[var(--mf-text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/"
            className="no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus)]"
          >
            <BrandMark size="sm" />
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
          >
            <Link
              href="/intake"
              className="font-medium text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-primary-dark)] hover:underline"
            >
              Patient Intake
            </Link>
            <Link
              href="/demo"
              className="font-medium text-[var(--mf-text-secondary)] no-underline hover:text-[var(--mf-primary-dark)] hover:underline"
            >
              Judge Access
            </Link>
          </nav>
        </div>

        <p className="m-0 text-[12.5px] leading-[1.4]">
          Synthetic demonstration prototype only · Not for emergency use or real
          patient care
        </p>
      </div>
    </footer>
  );
}
