"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function AppHeader() {
  const pathname = usePathname();
  const { status } = useStaffAuth();

  const navItems = [
    { href: "/", label: "Overview" },
    { href: "/intake", label: "Patient intake" },
    status === "authorized"
      ? { href: "/staff/queue", label: "Staff queue" }
      : { href: "/staff/login", label: "Staff sign in" },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--mf-line)] bg-[rgba(255,255,255,0.93)] backdrop-blur-md">
      <div className="mx-auto flex min-h-[64px] max-w-[1220px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-7">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-[9px] text-[var(--mf-ink)] no-underline mf-focus-ring"
          aria-label="MedFlow home"
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[var(--mf-brand)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Icon name="pulse" size="md" />
          </span>
          <span className="leading-tight">
            <span className="block text-[16px] font-bold tracking-[-0.04em]">
              MedFlow
            </span>
            <span className="block text-[10px] font-semibold tracking-[0.1em] text-[var(--mf-muted)] uppercase">
              Clinical intake
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1"
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/staff/queue"
                  ? pathname.startsWith("/staff/queue") ||
                    pathname.startsWith("/staff/intakes")
                  : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-[9px] px-3 py-2 text-[13px] font-semibold transition duration-150 mf-focus-ring ${
                  isActive
                    ? "bg-[var(--mf-brand-soft)] text-[var(--mf-brand-strong)]"
                    : "text-[var(--mf-muted)] hover:bg-[var(--mf-brand-soft)] hover:text-[var(--mf-brand-strong)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7d5b5] bg-[#fbf4e7] px-2.5 py-1.5 text-[10px] font-extrabold tracking-[0.07em] text-[#76541f] uppercase whitespace-nowrap">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--mf-accent)]"
            aria-hidden="true"
          />
          Synthetic demo only
        </span>
      </div>
    </header>
  );
}
