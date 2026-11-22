import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/PageContainer";
import { StaffAuthProvider } from "@/lib/firebase/staff-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedFlow — Clinical Intake & Nurse-Controlled Patient Flow",
  description:
    "Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow (TCC Hackathon 2026 prototype).",
  openGraph: {
    title: "MedFlow — Clinical Intake & Nurse-Controlled Patient Flow",
    description:
      "Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow (TCC Hackathon 2026 prototype).",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-[var(--mf-canvas)] text-[var(--mf-ink)]">
        <StaffAuthProvider>
          <AppHeader />
          <div className="flex-1">{children}</div>
          <AppFooter />
        </StaffAuthProvider>
      </body>
    </html>
  );
}
