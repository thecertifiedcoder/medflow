"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/Icon";
import { useStaffAuth } from "@/lib/firebase/staff-auth";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, authMode, demoPersona, signOutStaff } = useStaffAuth();

  const navItems = [
    { href: "/", label: "Overview" },
    { href: "/intake", label: "Patient intake" },
    status === "authorized"
      ? { href: "/staff/queue", label: "Staff queue" }
      : { href: "/staff/login", label: "Staff sign in" },
  ] as const;

  const isDemoAuthorized =
    status === "authorized" && authMode === "demo" && demoPersona !== null;
  const demoRoleLabel =
    demoPersona === "admin" ? "Demo Admin" : "Demo Clinical Staff";

  async function handleHeaderSignOut() {
    await signOutStaff();
    if (pathname.startsWith("/staff/")) {
      router.push("/");
    }
  }

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

        <div className="flex flex-wrap items-center gap-2">
          {isDemoAuthorized && (
            <>
              <span
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--mf-primary-light)] bg-[var(--mf-navy-800)] px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] text-white whitespace-nowrap"
                data-testid="active-demo-role-badge"
              >
                <Icon
                  name={demoPersona === "admin" ? "shield" : "userCheck"}
                  size="sm"
                />
                <span>{demoRoleLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleHeaderSignOut()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border border-[var(--mf-navy-700)] bg-[var(--mf-navy-800)] px-2.5 py-1 text-[12px] font-semibold text-[var(--mf-navy-text)] transition-colors hover:border-white hover:text-white whitespace-nowrap"
              >
                Sign out
              </button>
            </>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#f5d76e] bg-[var(--mf-navy-800)] px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] text-[#f5d76e] whitespace-nowrap">
            <Icon name="shield" size="sm" />
            <span>Synthetic demo only</span>
          </span>
        </div>
      </div>
    </header>
  );
}
