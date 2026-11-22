# MedFlow — Hackathon Implementation Runbook

## 1. Operating rule

The sprint-built application code must be created during the official November 22–24 sprint. Product planning documents prepared earlier do not count as implemented product features. Record sprint work and AI contributions transparently.

## 2. Delivery target

Internal target: demoable, end-to-end MVP by Sunday evening, November 22. This is an aggressive target. If time slips, cut features in the order below rather than weakening core reliability or safety.

## 3. Implementation sequence

### Before sprint / planning only
- Confirm team registration before Sunday noon.
- Freeze P0 scope.
- Finalise project docs and prepare the single standalone HTML design-system attachment.
- Create/confirm Firebase and Google AI Studio project access.
- Confirm public GitHub repository ownership and access.
- Prepare synthetic narratives and test checklist.
- Do not prebuild the sprint functionality for judging.

### Sprint Day 1 — Sunday, November 22

**Milestone A: app skeleton and design system**
- Create the application in Google AI Studio Build Mode.
- Rebuild the application UI to match the single attached HTML design-system reference; do not create separate design tokens.
- Establish client/server separation and environment secrets.
- Connect Firebase Authentication and Firestore.
- Create facility-scoped data model and security rules.

**Milestone B: vertical slice**
- Build patient typed intake.
- Validate microphone permission, MediaRecorder capture and the transcription API on the target Android browser early; keep the typed path working.
- Persist the intake before AI processing.
- Build staff login and real-time queue.
- Prove a submission appears on another device without refresh.

**Milestone C: AI extraction**
- Integrate server-side Gemini extraction.
- Validate strict schema and source evidence.
- Add loading, success, needs-clarification and failure states.

**Milestone D: voice intake completion**
- Complete MediaRecorder capture and server-side transcription integration.
- Use VERBATIM transcription where the verified endpoint supports it.
- Add transcript edit/confirm and typed fallback.

**Internal gate Sunday evening:** one synthetic patient can complete either typed or voice flow, AI brief is available or safe failure shown, staff sees live item, and staff can review/correct the AI brief, assign workflow priority and see audit entries.

### Sprint Day 2 — Monday, November 23

- Finish nurse workflow, staff confirmation/correction of the AI brief, and audit timeline.
- Complete voice failure states and mobile browser testing.
- Add demo seeding/reset, facility scope and role checks.
- Run core functional/security tests.
- Fix bugs before adding P1 features.
- Deploy a test build.

### Sprint Day 3 — Tuesday, November 24

- Freeze feature scope early enough for regression testing.
- Fix P0 bugs and verify deployment.
- Complete README and source docs.
- Verify public repository and remove secrets.
- Record the 4:50–5:10 video.
- Publish public social post and test in incognito.
- Submit official form before 11:59 PM WAT.

## 4. Scope-cut order

If behind schedule, remove in this order:
1. Advanced analytics and charts.
2. Staff assignment.
3. QR generation (share URL manually).
4. Print/export.
5. Search/filter polish.
6. Additional languages beyond the tested primary path.

Do not cut:
- typed intake;
- patient voice capture and transcript review if the voice flow has been made a P0 commitment;
- server-side secret protection;
- AI schema validation;
- real-time queue;
- staff-controlled priority;
- audit event for priority changes;
- AI failure fallback;
- README, AI disclosure and test evidence.

Voice is an approved P0 requirement and must be tested early. If the Gemini transcription integration fails, troubleshoot the official API/SDK path or evaluate a genuinely functioning alternative transcription route. Never fake live transcription or present a manually entered transcript as if it came from the microphone. Keep typed intake usable while the voice issue is being fixed; disclose any unresolved voice limitation honestly.

## 5. Starting the new Google AI Studio session

The repository is a documentation baseline, not an existing application scaffold. Start a **new Build Mode session** and import the existing GitHub repository; do not create a replacement repository.

1. Open Google AI Studio and enter **Build** mode.
2. Open the Build **Settings** panel and select **Next.js** as the framework. Next.js is supported in AI Studio; it may not be the default. Do this before asking the agent to initialise the application.
3. From the prompt input's **Add files (+)** menu, choose **Import from GitHub**.
4. Select `thecertifiedcoder/medflow`, branch `main`. The repository is private, so ensure the GitHub connection/GitHub App has access to it. Do not make it public just to import it.
5. Wait for the import to complete and confirm the project documents are visible. The founder will attach the standalone HTML design-system file directly to the AI Studio conversation; it does not need to live in the repository.
6. Open `AI_STUDIO_MASTER_PROMPT.md` in the imported repository and provide its complete contents to the Build agent. The agent must read the whole documentation pack and return the implementation-readiness report described in section 13 of that prompt.
7. Review its report. In particular, check that it selected Next.js, understands that the repo has no application scaffold yet, preserves the project documentation, recognises the attached HTML as the sole visual source, and has not edited application code.
8. Confirm the planned Firebase/Auth/Firestore approach, server-side secrets, Gemini integration and first implementation milestone before authorising code changes.

Google's official announcement confirms that Build Mode supports Next.js and that the framework is selected from Settings: https://blog.google/innovation-and-ai/technology/developers-tools/full-stack-vibe-coding-google-ai-studio/

**Sprint rule:** Product planning and the AI Studio import/readiness review can happen before the sprint. The implementation code must be created during the official sprint, November 22–24, 2026. On November 21, stop after the readiness review; do not begin application implementation early.

## 6. Working with Google AI Studio

- Give AI Studio the complete documentation pack and attach the single standalone HTML design-system file to the conversation.
- Instruct it to read all documents before editing code.
- Ask for a project map and implementation plan before the first build action.
- Work in milestones; inspect the changed files and run the app after every milestone.
- Ask it to report changed files, assumptions, commands/tests run, failures and next milestone.
- Do not accept “complete” without a working browser test.
- Keep the source repository synchronised and inspect actual Git diffs.
- Update documentation when a technical choice changes; record the reason in the decision log.

## 7. Daily close-out checklist

- [ ] Latest build runs.
- [ ] P0 acceptance tests status recorded.
- [ ] No exposed keys or accidental data.
- [ ] Public repo commits are coherent.
- [ ] Sprint log updated with date and feature status.
- [ ] Known blockers have an owner and workaround.
- [ ] Demo path remains repeatable.


## 8. Updated milestone sequence (founder-approved 2026-11-22)

Milestone 1A (Next.js App Router scaffold), Milestone 1B (Firebase Auth + same-origin `/__/auth/*` proxy + server-side `verifyIdToken` + transitional Firestore setup), and Milestone 1C (UI migration to the founder-attached HTML design system) are implemented and verified.

Per ADR `D-020`, **Neon PostgreSQL** (`pg` + Drizzle ORM + Drizzle Kit) replaces Cloud Firestore as MedFlow's authoritative database while **Firebase Authentication** remains the identity provider.

### Milestone 1D — Neon PostgreSQL Migration (3 separately approved phases)

#### Phase 1D-1 — PostgreSQL Foundation (offline; implemented and verified)
- Install `pg`, `drizzle-orm`, `@types/pg`, and `drizzle-kit`.
- Author Drizzle schema (`src/db/schema.ts`), invariants (`src/db/invariants.ts`), server-only runtime connector (`src/db/index.ts` using `DATABASE_URL`), Drizzle Kit config (`drizzle.config.ts` using `DATABASE_URL_UNPOOLED`), and idempotent founder-run CLI seed (`src/db/seed.ts`).
- Generate and verify offline SQL migrations (`drizzle/0000_initial_medflow_schema.sql`, `drizzle/0001_immutability_triggers.sql`) enforcing all 8 founder requirements:
  1. Composite `(intake_id, facility_id)` FKs on `intake_evidence` and `audit_events`.
  2. `intake_evidence` immutability trigger permitting only one-way `is_current: true -> false` and forbidding `DELETE`.
  3. Complete 10-action-to-actor DB-level `CHECK` mapping on `audit_events` + mandatory `reason` on `priority_changed` and `brief_corrected`.
  4. DB-level `CHECK` constraint enforcing internal consistency across `staff_review_status`, `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, and `staff_correction_note`.
  5. Canonical synthetic facility `demo-clinic-01` / `DEMO-CLINIC-01` (`MedFlow Synthetic Demo Clinic`); retire `demo-facility-001` and `DEMO-FACILITY`.
  6. Strictly server-only `DATABASE_URL` (runtime) and `DATABASE_URL_UNPOOLED` (direct migrations).
  7. Defer `EVIDENCE_HMAC_SECRET` until Milestone 3.
  8. No live Neon database operations in Phase 1D-1; keep existing Firebase Auth and legacy Firestore files untouched until Phases 1D-2/1D-3.

#### Phase 1D-2 — Server-Side PostgreSQL Staff APIs & Staff UI Cutover (implemented & verified)
- Implemented server-only PostgreSQL staff repository (`src/lib/db/staff-repository.ts`, `src/lib/db/errors.ts`), reusable Firebase ID-token + PostgreSQL RBAC/facility-membership authorization boundary (`src/lib/auth/staff-authorization.ts`), and strict staff API contracts (`src/lib/schemas/staff-api.ts`).
- Migrated `GET /api/staff/session` and implemented `GET /api/staff/intakes` and `GET /api/staff/intakes/[intakeId]` via `src/lib/api/staff-handlers.ts`.
- Cut over active staff UI components (`StaffAuthProvider`, `StaffAccessGate`, `StaffLoginPanel`, `StaffQueueShell`, `StaffIntakeDetailShell`) from Firestore reads to authenticated same-origin APIs with 5-second visibility-aware polling (`src/lib/staff/polling.ts`, `src/lib/staff/api-client.ts`).

#### Phase 1D-3 — Live Neon Migration, Seeding, Verification & Legacy Firestore Cleanup (implemented & live-verified)
- Added `src/db/migrate.ts` (`npm run db:migrate`) and `src/db/live-verification.test.ts`; applied `drizzle/0000_initial_medflow_schema.sql` and `drizzle/0001_immutability_triggers.sql` against live Neon PostgreSQL via `DATABASE_URL_UNPOOLED`.
- Executed idempotent `src/db/seed.ts` (`npm run db:seed`) twice against live Neon PostgreSQL, seeding canonical `demo-clinic-01` / `DEMO-CLINIC-01` (`MedFlow Synthetic Demo Clinic`). (Initial staff admin seeding remains gated on founder-supplied `SEED_ADMIN_*` environment variables per Option 2B.)
- Executed live PostgreSQL schema, trigger, and negative constraint verification (PG-01 through PG-06 inside a rolled-back transaction) plus live pooled `DATABASE_URL` Drizzle reads via `createDrizzleStaffRepository()`.
- Removed all legacy Firestore artifacts (`firestore.rules`, `firebase-blueprint.json`, `src/lib/firebase/errors.ts`, `src/lib/firebase/security-rules.test.ts`, `src/components/shared/FirebaseErrorBoundary.tsx`, `src/lib/schemas/staff.ts`), removed `@firebase/eslint-plugin-security-rules`, and refactored `src/lib/firebase/client.ts` & `config.ts` to Firebase Authentication only while keeping Google Sign-In and the same-origin `/__/auth/*` proxy intact.

### Phase DA-1 — Hackathon Demo Access (implemented & verified under ADR `D-021`)

- Added server-controlled Hackathon Demo Mode (`MEDFLOW_DEMO_MODE_ENABLED` disabled by default; `MEDFLOW_DEMO_SESSION_SECRET` ≥ 32 chars required fail-closed; optional `MEDFLOW_DEMO_SESSION_TTL_SECONDS`).
- Extended idempotent `src/db/seed.ts` to seed canonical synthetic demo accounts `demo-admin-01` (`admin`) and `demo-staff-01` (`nurse`) strictly inside `demo-clinic-01` (`DEMO-CLINIC-01`) with zero Neon schema changes.
- Implemented HMAC-SHA256 signed HTTP-only cookie sessions (`src/lib/auth/demo-session.ts`), CSRF protection, server-side revocation (`POST /api/demo/logout`), persona endpoints (`POST /api/demo/session/admin`, `POST /api/demo/session/staff`, `GET /api/demo/status`), unified `resolveStaffSession`/`requireAuthorizedStaff` enforcement, and read-only admin-only `GET /api/staff/admin/facility`.
- Updated `/` with the prominent **Try the MedFlow Demo** launcher (**Demo Administrator**, **Demo Clinical Staff**, **Start Patient Intake**), added active demo role badge & **Sign out** in header/workspace, and preserved Firebase Google Sign-In (`/staff/login`) completely intact.

### Phase UX-1 — Platform Experience, Information Architecture & Interface Rework (implemented & verified under ADR `D-022`)

- Reworked MedFlow's route structure and navigation into 7 focused screens with strict role and context separation:
  - `/` — Public Home entry-point selector (**Patient Intake `/intake`**, **Staff Sign-In `/staff/login`**, **Hackathon Demo Access `/demo`**).
  - `/intake` — Dedicated `.mf-pt` patient self-intake experience with `PatientTopBar` (zero staff/admin/demo links), emergency safety banner, 3-step journey, interactive typed/voice mode preview, synthetic presets, confirmation checkbox, and honest Milestone 2 readiness boundary.
  - `/demo` — Dedicated Hackathon Demo Access evaluation hub routing **Enter as Demo Administrator** → `/staff/admin` and **Enter as Demo Clinical Staff** → `/staff/queue`.
  - `/staff/login` — Dedicated Staff Google Sign-In screen with role-aware destination (`admin` → `/staff/admin`, `nurse`/`doctor` → `/staff/queue`) and quiet judge link to `/demo`.
  - `/staff/queue` — Focused Clinical Staff Workspace inside `StaffAccessGate` + `StaffWorkspaceLayout`, with real PostgreSQL queue polling, workflow/priority filters, and an intentional empty state (`0` rows).
  - `/staff/admin` — Dedicated Administrator Workspace inside `StaffAccessGate` + `StaffWorkspaceLayout`, backed by `GET /api/staff/admin/facility` and enforcing HTTP 403 / restricted UI (`data-testid="admin-role-restricted-panel"`) for non-admin roles.
  - `/staff/intakes/[intakeId]` — Dedicated 6-section provenance-separated intake review workspace inside `StaffAccessGate` + `StaffWorkspaceLayout`.
- Verified across all 5 user journeys and 3 viewports (`1440×900`, `768×1024`, `390×844`) with zero Milestone 2 scope leakage.

### Milestone 2 — Patient intake and server-side Gemini extraction (requires separate approval after UX-1 review)

- Implement typed intake and real voice recording/transcription, transcript edit/confirmation and durable PostgreSQL intake persistence (`POST /api/intakes` atomic transaction with `intake_created` / `transcript_confirmed` audit events).
- Follow `D-015` (Option 1B): AI extraction is triggered and persisted only through an authenticated, active, facility-authorised staff session via server-side PostgreSQL transactions.
- Gemini remains server-side; preserve the strict schema and source-quote requirements.
- Keep original narrative, AI draft and staff-reviewed copy separate.
- Stop before implementing the full Evidence Integrity Engine; report the extraction workflow and test results.

### Milestone 3 — Evidence Integrity Engine (requires separate approval)

- Configure server-only `EVIDENCE_HMAC_SECRET` and implement the deterministic algorithm in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`.
- Add exact quote matching, server-derived UTF-16 source spans, field-level evidence states persisted to `intake_evidence`, narrative/draft hashes, HMAC provenance signing and verification.
- Add staff UI for inspecting source matches and resolving unsupported/ambiguous evidence.
- Run the complete synthetic EIE test matrix and stop with a verified report.

No milestone or phase may be silently combined with the next. Each requires its own explicit founder approval and stop report.

