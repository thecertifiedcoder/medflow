# MedFlow — Documentation Start Here

**Project codename:** MedFlow  
**Working positioning:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow  
**Competition:** TCC Hackathon 2026  
**Documentation status:** Milestones 1A, 1B, 1C, **Milestone 1D (Phases 1D-1, 1D-2, and 1D-3 — live Neon PostgreSQL migration, seeding, live constraint/trigger verification, server-side staff APIs, UI polling cutover, and Cloud Firestore decommissioning under ADR `D-020`)**, **Phase DA-1 (Hackathon Demo Access under ADR `D-021`)**, and **Phase UX-1 (Platform Experience, Information Architecture & Interface Rework under ADR `D-022` — 7 dedicated role-separated screens, context-aware top bars, `StaffWorkspaceLayout`, dedicated `/demo` judge hub, dedicated `/staff/admin` administrator workspace, focused `/staff/queue` clinical workspace, and calm `.mf-pt` patient self-intake experience at `/intake`)** are implemented and verified. Milestone 2 (patient intake persistence, server-side Gemini transcription/extraction, and staff review mutations) and Milestone 3 (cryptographic Evidence Integrity Engine / `EVIDENCE_HMAC_SECRET`) are pending separate founder approval.

## 1. What this project is

MedFlow helps a patient communicate a health concern through typed text or voice, converts that narrative into an editable transcript and an evidence-linked structured intake brief, and gives clinical staff a facility-scoped queue in which they review source information and assign/adjust workflow priority.

**Core product loop:** Patient speaks or types → transcript is reviewed → patient submits → AI extracts structured context → deterministic evidence checks trace claims to the original narrative → staff reviews/corrects → staff assigns workflow priority/status → actions are audited.

MedFlow is not an AI doctor. It does not diagnose, prescribe, independently clear a patient to wait, or autonomously determine clinical urgency. In the MVP, priority is explicitly staff-assigned. AI-extracted cues are prompts for human review, not clinical conclusions.

## 2. Hackathon objective

Build a complete, credible, working end-to-end prototype that demonstrates a specific local workflow advantage. Do not attempt to build a full hospital management system.

The strongest hackathon proposition is:

> MedFlow turns the way patients naturally speak about their symptoms into evidence-linked clinical intake briefs, with deterministic source-traceability checks that show staff where each extracted item came from.

Voice input is a first-class P0 feature, not a decorative extra. Typed entry remains available at every point.

## 3. Mandatory reading order for AI Studio and contributors

1. `01_HACKATHON_RULES_AND_SCORECARD.md`
2. `02_PRODUCT_DEFINITION.md`
3. `03_HACKATHON_WINNING_STRATEGY.md`
4. `13_PRODUCT_REQUIREMENTS.md`
5. `14_UX_AND_USER_FLOWS.md`
6. `04_MVP_SCOPE_AND_ACCEPTANCE.md`
7. `05_VOICE_INTAKE_SPEC.md`
8. `06_AI_EXTRACTION_SPEC.md`
9. `19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`
10. `07_CLINICAL_SAFETY_AND_PRIVACY.md`
11. `08_TECHNICAL_ARCHITECTURE.md`
12. `09_DATA_MODEL_AND_API_CONTRACTS.md`
13. `10_TESTING_AND_DEMO_PLAN.md`
14. `11_IMPLEMENTATION_RUNBOOK.md`
15. `12_REPOSITORY_AND_JUDGE_READINESS.md`
16. `15_DECISIONS_AND_RISKS.md`
17. `16_SOURCES_AND_ATTRIBUTIONS.md`
18. `17_SPRINT_LOG_AND_AI_DISCLOSURE.md`

The founder will attach one standalone HTML design-system file directly to the Google AI Studio conversation. That attachment is the sole visual source of truth. No separate design-tokens file, extracted CSS token sheet or design-system specification is required. The PRD, UX, data and safety documents continue to govern product behaviour.

## 4. Source-of-truth rules

- The hackathon guide is authoritative for dates, eligibility, submission format and scoring.
- The approved product documents are authoritative for scope and user behaviour.
- The clinical safety document overrides any implementation suggestion that would make AI act as a clinician.
- The PRD defines feature requirements and acceptance criteria.
- The UX specification defines screen behaviour, user flows, interaction states and approved UI copy.
- The data/API contract overrides ad hoc data structures in components.
- The attached HTML is authoritative for visual decisions only; it does not approve the TEWS/SATS algorithm or any other clinical behaviour shown in its demo.
- `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md` defines the approved deterministic algorithm direction.
- If two documents conflict, do not silently choose one. Record the conflict in `15_DECISIONS_AND_RISKS.md` and ask for resolution.
- Never invent completed features, test results, clinical validation, hospital partnerships, user numbers or performance claims.

## 5. Build constraints

- Code submitted for judging must be built during the official sprint, November 22–24, 2026.
- Planning and product documentation can be prepared before the sprint.
- Target: a demonstrable MVP by Sunday evening, November 22.
- Submission deadline: Tuesday, November 24, 2026, 11:59 PM WAT.
- The video must be public and 4:50–5:10 long.
- Public repository and README must identify sprint-built features and disclose AI tools used.
- Use synthetic patient data only in the hackathon demonstration. Do not enter real patient information or real patient audio.

## 6. Current MVP boundary

**P0:** typed intake, voice recording and transcription, transcript editing/confirmation, durable patient submission, staff-triggered server-side Gemini extraction, evidence-linked structured fields, deterministic evidence-integrity checks, real-time staff queue, nurse review/correction, staff-assigned workflow priority/status, audit events, failure-safe submission, synthetic demo data, public deployment and judge-ready documentation.

**P1 only after P0 works:** QR entry, patient search/filter, staff assignment, basic queue metrics, print/share intake summary.

**Out of scope:** diagnosis, prescription, autonomous triage decisions, TEWS/SATS scoring, clinical time targets, full EHR, billing, payments, complex hospital administration, production multi-hospital onboarding, live clinical use and unvalidated clinical scoring protocols.

## 7. Delivery status convention

Every feature in the repository and README must be labelled accurately as one of:

- `Implemented and tested`
- `Implemented, not fully tested`
- `Prototype / simulated`
- `Planned`

Do not mark a feature complete because AI Studio generated code for it. It must work in the running application and pass its acceptance tests.

## 8. Current verified milestone state

- **Milestone 1A (Implemented and verified):** Next.js App Router + TypeScript foundation, strict Zod schemas, environment boundaries, and Preview build.
- **Milestone 1B (Implemented and verified):** Firebase Authentication (Google Sign-In + same-origin `/__/auth/*` proxy), server-side `verifyIdToken(token)` session verification, and transitional Firestore rules/setup (kept active only until Phase 1D-3 decommissioning).
- **Milestone 1C (Implemented and verified):** Full React UI migration to match the single founder-attached HTML design system, preserving clinical safety exclusions (`D-019`).
- **Milestone 1D — Phase 1D-1 (Implemented and verified):** Per ADR `D-020`, Neon PostgreSQL (`pg` + Drizzle ORM + Drizzle Kit) replaces Cloud Firestore as MedFlow's authoritative database while Firebase Auth remains the identity provider. Delivered `src/db/schema.ts`, `src/db/invariants.ts`, `src/db/index.ts`, `src/db/seed.ts`, `drizzle.config.ts`, SQL migrations (`drizzle/0000_initial_medflow_schema.sql`, `drizzle/0001_immutability_triggers.sql`), canonical `demo-clinic-01`/`DEMO-CLINIC-01` facility identifiers, and invariant tests.
- **Milestone 1D — Phase 1D-2 (Implemented and verified):** Delivered the reusable server-side Firebase ID-token + PostgreSQL RBAC/facility-membership authorization boundary (`src/lib/auth/staff-authorization.ts`), server-only Drizzle staff repository (`src/lib/db/staff-repository.ts`, `src/lib/db/errors.ts`), authenticated Route Handlers (`GET /api/staff/session`, `GET /api/staff/intakes`, `GET /api/staff/intakes/[intakeId]`), 5-second visibility-aware polling (`src/lib/staff/polling.ts`), and full cutover of active staff UI components to same-origin PostgreSQL APIs.
- **Milestone 1D — Phase 1D-3 (Implemented and live-verified):** Applied Drizzle SQL migrations to live Neon PostgreSQL via `DATABASE_URL_UNPOOLED`, ran idempotent `src/db/seed.ts` twice to verify canonical `demo-clinic-01`/`DEMO-CLINIC-01`, verified all 6 tables, all 3 immutability triggers, live PG-01..PG-06 constraint/trigger enforcement, and live pooled `DATABASE_URL` Drizzle reads (`src/db/live-verification.test.ts`), and decommissioned all legacy Cloud Firestore files/dependencies while preserving Firebase Authentication and the `/__/auth/*` proxy intact. (Initial staff profile provisioning remains controlled via founder-supplied `SEED_ADMIN_*` variables per Option 2B.)
- **Phase DA-1 — Hackathon Demo Access (Implemented and verified under ADR `D-021`):** Added server-controlled Hackathon Demo Mode (`MEDFLOW_DEMO_MODE_ENABLED` disabled by default; `MEDFLOW_DEMO_SESSION_SECRET` ≥ 32 chars required fail-closed), seeded canonical synthetic demo personas (`demo-admin-01` → `admin`, `demo-staff-01` → `nurse`) inside `demo-clinic-01` with zero schema changes, implemented HMAC-SHA256 signed HTTP-only cookie sessions with CSRF protection and server-side revocation, read-only admin-only role separation (`GET /api/staff/admin/facility`), and one-click Demo Administrator / Demo Clinical Staff / Start Patient Intake entry while preserving Firebase Google Sign-In intact.
- **Phase UX-1 — Platform Experience, Information Architecture & Interface Rework (Implemented and verified under ADR `D-022`):** Reworked MedFlow's route structure and navigation into 7 focused screens (`/`, `/intake`, `/demo`, `/staff/login`, `/staff/queue`, `/staff/admin`, `/staff/intakes/[intakeId]`), context-aware top bars (`PublicTopBar`, `PatientTopBar`, `WorkspaceTopBar`), role-aware `StaffWorkspaceLayout`, dedicated `/demo` judge evaluation hub, dedicated `/staff/admin` facility administration workspace with strict non-admin HTTP 403 / UI restriction, focused `/staff/queue` clinical workspace with intentional empty state (`0` rows), and calm `.mf-pt` patient self-intake experience at `/intake`.
- **Pending separate founder approval:** Milestone 2 (patient intake POST persistence, server-side Gemini transcription & structured extraction, and staff review/priority/status mutations — next phase after UX-1 review) and Milestone 3 (deterministic Evidence Integrity Engine persistence in `intake_evidence` & `EVIDENCE_HMAC_SECRET` signing/verification). Do not describe Milestone 2 or Milestone 3 as live.
