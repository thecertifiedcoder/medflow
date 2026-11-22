import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/PageContainer";
import { StaffAuthProvider } from "@/lib/firebase/staff-auth";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedFlow — Context-Aware Clinical Intake Engine",
  description:
    "Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow (TCC Hackathon 2026 prototype).",
  openGraph: {
    title: "MedFlow — Context-Aware Clinical Intake Engine",
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
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-[var(--mf-canvas)] text-[var(--mf-text)]">
        <a className="mf-skip" href="#main-content">
          Skip to content
        </a>
        <StaffAuthProvider>
          <AppHeader />
          <div id="main-content" className="flex-1">
            {children}
          </div>
          <AppFooter />
        </StaffAuthProvider>
      </body>
    </html>
  );
}
