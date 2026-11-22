# MedFlow

**Working concept:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow.

**Competition:** TCC Hackathon 2026 · **Current status:** Milestones 1A (Next.js foundation), 1B (Firebase Auth + same-origin `/__/auth/*` proxy + server ID-token verification), 1C (UI design-system migration), and **Milestone 1D (Phases 1D-1, 1D-2, and 1D-3 — live Neon PostgreSQL migrations, idempotent canonical seed, live PG-01..PG-06 constraint/trigger verification, server-side staff APIs, 5s visibility-aware UI polling, and Cloud Firestore decommissioning under ADR `D-020`)** are implemented and verified. Milestone 2 (patient intake, voice transcription, Gemini extraction, staff mutations) and Milestone 3 (Evidence Integrity Engine) are not yet implemented.

> **Safety notice:** This is a hackathon prototype, not a clinically validated medical device or emergency service. Do not use it for real patient care or enter real patient information or audio. Demonstrations must use synthetic data. MedFlow must not diagnose, prescribe, autonomously assign clinical urgency, or tell a patient that it is safe to wait.

## Start here

1. Read [`docs/00_START_HERE.md`](docs/00_START_HERE.md) for the project definition, document precedence and current milestone state.
2. Read [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) before asking Google AI Studio to implement an approved milestone.
3. Read [`AGENTS.md`](AGENTS.md) for repository-wide rules for AI coding agents and contributors.
4. Attach the founder-provided standalone HTML design-system file directly to the Google AI Studio conversation. It is the sole visual source of truth; no separate token file or design-system specification is used.
5. Read [`docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`](docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md) for the approved algorithm direction.

## Product thesis

MedFlow turns a patient's spoken or typed account into an editable transcript and an evidence-linked clinical intake brief. A deterministic Evidence Integrity Engine checks whether extracted claims can be traced to exact quotations in the original patient-confirmed narrative. Clinical staff review the original narrative and extracted context, correct it where necessary, and independently assign workflow priority/status.

**Core loop:** Patient speaks or types → transcript is reviewed and confirmed → intake is saved → staff triggers server-side AI extraction → deterministic source-evidence checks run → staff reviews/corrects → staff assigns workflow priority/status → actions are audited.

The differentiator is not voice capture or a queue by itself. It is the traceable connection between what a patient actually said and the structured information presented to the clinical team. Evidence checks establish source-location integrity only; they do not prove clinical truth or correctness.

## Repository map

- [`docs/`](docs/) — hackathon brief, product strategy, requirements, UX, safety, architecture, data contracts, tests, implementation runbook, decisions and references.
- [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) — implementation handoff prompt for Google AI Studio.
- [`AGENTS.md`](AGENTS.md) — durable rules for AI agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and documentation conventions.
- [`SECURITY.md`](SECURITY.md) — prototype security and privacy policy.

## Current implementation status

- **Milestone 1A (`Implemented and tested`):** Next.js App Router + TypeScript foundation, strict Zod extraction/intake schemas, server/public environment boundaries, and Preview build.
- **Milestone 1B (`Implemented and tested`):** Firebase Authentication (Google Sign-In with same-origin `/__/auth/*` proxy) and server-side `verifyIdToken(token)` verification. *(Transitional Cloud Firestore artifacts were decommissioned in Phase 1D-3.)*
- **Milestone 1C (`Implemented and tested`):** React UI rebuilt to match the single founder-attached HTML design system without TEWS/SATS clinical scoring (`D-019`).
- **Milestone 1D — Phase 1D-1 (`Implemented and tested`):** Per ADR `D-020`, Neon PostgreSQL (`pg` + Drizzle ORM + Drizzle Kit) replaces Cloud Firestore as MedFlow's authoritative database while Firebase Auth remains the identity provider. Delivered the 6-table Drizzle schema (`facilities`, `staff_profiles`, `facility_memberships`, `patient_intakes`, `intake_evidence`, `audit_events`), composite tenant foreign keys, `intake_evidence` one-way `is_current` immutability trigger, DB-level 10-action-to-actor audit validation, staff-review consistency checks, canonical `demo-clinic-01`/`DEMO-CLINIC-01` facility identifiers, server-only `DATABASE_URL`/`DATABASE_URL_UNPOOLED` configuration, SQL migrations (`drizzle/0000_initial_medflow_schema.sql` and `drizzle/0001_immutability_triggers.sql`), and idempotent CLI seed script (`src/db/seed.ts`).
- **Milestone 1D — Phase 1D-2 (`Implemented and tested`):** Delivered the reusable server-side Firebase ID-token + PostgreSQL RBAC/facility-membership authorization boundary (`src/lib/auth/staff-authorization.ts`), server-only Drizzle staff repository (`src/lib/db/staff-repository.ts`, `src/lib/db/errors.ts`), authenticated Route Handlers (`GET /api/staff/session`, `GET /api/staff/intakes`, `GET /api/staff/intakes/[intakeId]`), 5-second visibility-aware polling (`src/lib/staff/polling.ts`), and cutover of all active staff UI views (`StaffAuthProvider`, `StaffAccessGate`, `StaffLoginPanel`, `StaffQueueShell`, `StaffIntakeDetailShell`) to same-origin PostgreSQL APIs.
- **Milestone 1D — Phase 1D-3 (`Implemented and tested`):** Applied Drizzle SQL migrations to live Neon PostgreSQL (`npm run db:migrate`), executed idempotent `src/db/seed.ts` (`npm run db:seed`) twice for canonical `demo-clinic-01`/`DEMO-CLINIC-01`, verified all 6 tables, all 3 immutability triggers, live PG-01..PG-06 constraint/trigger enforcement, and live pooled `DATABASE_URL` Drizzle reads (`src/db/live-verification.test.ts`), and removed all legacy Cloud Firestore files and dependencies while keeping Firebase Authentication intact. *(Initial staff profile provisioning remains gated on founder-supplied `SEED_ADMIN_*` environment variables per Option 2B.)*

Still outstanding (each requires separate founder approval):
- **Milestone 2 (`Planned`):** Patient typed/voice intake, server-side Gemini transcription, durable PostgreSQL intake persistence, staff-triggered server-side Gemini extraction, and audited staff workflow mutations.
- **Milestone 3 (`Planned`):** Deterministic Evidence Integrity Engine, server-only `EVIDENCE_HMAC_SECRET` signing/verification, and staff evidence-review UI.

No feature should be described as implemented until it exists in the running application and passes its acceptance tests.

## Approved application stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** React components rebuilt to match the single founder-provided HTML design-system attachment
- **Backend:** Next.js Route Handlers
- **Authentication (identity only):** Firebase Authentication (Google Sign-In + same-origin `/__/auth/*` proxy) with server-side `firebase-admin` `verifyIdToken(token)` signature/claim verification
- **Database (authoritative under `D-020`):** Neon PostgreSQL via `pg` + Drizzle ORM + Drizzle Kit (`DATABASE_URL` for runtime, `DATABASE_URL_UNPOOLED` for direct migrations/seeding; strictly server-only; Cloud Firestore fully decommissioned in Phase 1D-3).
- **AI:** Server-side Google Gemini API; live model calls are pending Milestone 2
- **Deployment target:** A verified Node.js host, with Google Cloud Run as the current candidate

**Security boundary:** Never expose `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, or `GEMINI_API_KEY` to browser bundles. Authentication alone grants zero clinical privileges; all staff access, facility scoping, and audited mutations are authorized server-side against PostgreSQL (`staff_profiles` + `facility_memberships`).

## Design and algorithm boundaries

The single HTML file attached directly to the Google AI Studio conversation replaces the previous visual system and is the only design reference. Do not create a separate token file or design-system specification. Ignore the HTML's demo JavaScript and do not implement its adult TEWS/SATS scoring UI or other autonomous clinical scoring. The approved algorithm direction is the deterministic Evidence Integrity Engine in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`; it checks exact source quotations and provenance, not clinical truth or urgency.

## Google AI Studio

Use the private GitHub repository `thecertifiedcoder/medflow` and keep GitHub App access scoped to the repository. Follow `docs/11_IMPLEMENTATION_RUNBOOK.md` for the current Build session and milestone instructions. Do not make the repository public merely to import it.

## Hackathon constraints

The hackathon rules and scoring requirements are documented in [`docs/01_HACKATHON_RULES_AND_SCORECARD.md`](docs/01_HACKATHON_RULES_AND_SCORECARD.md). Keep a contemporaneous sprint log and disclose AI assistance. Do not fabricate metrics, clinical validation, partners or user outcomes.

## Commercialisation boundary

The architecture should be sensible for a future commercial product, but the hackathon MVP is not a production clinical system. Real deployment would require clinical governance, validation against an appropriately selected and licensed protocol, privacy/security assessment, operational controls, and applicable Nigerian regulatory review.
