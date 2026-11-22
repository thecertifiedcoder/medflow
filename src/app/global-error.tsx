"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6 font-sans text-[#0F172A]">
        <main className="w-full max-w-lg rounded-xl border border-[#CBD5E1] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#087E8B]">
            MedFlow · Safe Recovery Fallback
          </p>
          <h1 className="mt-2 text-xl font-bold text-[#0B1D2E]">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#334155]">
            A safe fallback has been shown without exposing internal details. If
            someone needs immediate medical help, alert hospital staff directly.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-[#0B1D2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132C44]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#0B1D2E] hover:bg-[#F8FAFC]"
            >
              Return to overview
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
