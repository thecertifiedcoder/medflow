"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
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
    <header className="mf-dash__top sticky top-0 z-30 w-full">
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="rounded-[4px] no-underline"
          aria-label="MedFlow home"
        >
          <BrandMark size="sm" onDark />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1"
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
                className="mf-nav__item mf-nav__item--top"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#f5d76e] bg-[var(--mf-navy-800)] px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] text-[#f5d76e] whitespace-nowrap">
          <Icon name="shield" size="sm" />
          <span>Synthetic demo only</span>
        </span>
      </div>
    </header>
  );
}
