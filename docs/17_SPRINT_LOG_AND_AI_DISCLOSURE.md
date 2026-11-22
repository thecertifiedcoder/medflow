# MedFlow — Sprint Log and AI Disclosure

> Update this file during the official sprint. Do not backdate or invent implementation work. This file is a template until entries are recorded.

## Sprint log

| Date/time (WAT) | Milestone / change | Files or modules | Contributor / tool assistance | Tests run and observed result | Status / blockers |
|---|---|---|---|---|---|
| 2026-11-22 | Milestone 1D — Phase 1D-1 (Neon PostgreSQL offline foundation, ADR `D-020`) | `src/db/invariants.ts`, `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed.ts`, `src/db/schema.test.ts`, `drizzle.config.ts`, `drizzle/0000_initial_medflow_schema.sql`, `drizzle/0001_immutability_triggers.sql`, `drizzle/meta/*`, `.env.example`, `package.json`, `src/lib/env/*`, `src/lib/schemas/intake.test.ts`, `security_spec.md`, `docs/*`, `README.md`, `AGENTS.md`, `AI_STUDIO_MASTER_PROMPT.md` | Founder architecture approval (`D-020` + 8 requirements); Google AI Studio Build agent | `npm run typecheck` passed; `npm test` passed (34/34 tests); `compile_applet` & `lint_applet` passed; `bun audit` run (0 advisories in `pg`/`drizzle-orm`; CLI-only `drizzle-kit` transitive `esbuild` moderate dev-server note) | Offline foundation complete; live Neon execution intentionally deferred until founder provisions Neon & approves Phases 1D-2/1D-3. |
| 2026-11-22 | Milestone 1D — Phase 1D-2 (Server-side PostgreSQL staff APIs, RBAC boundary & staff UI polling cutover) | `src/lib/schemas/staff-api.ts`, `src/lib/db/errors.ts`, `src/lib/db/staff-repository.ts`, `src/lib/auth/staff-authorization.ts`, `src/lib/api/staff-handlers.ts`, `src/app/api/staff/session/route.ts`, `src/app/api/staff/intakes/route.ts`, `src/app/api/staff/intakes/[intakeId]/route.ts`, `src/lib/http/errors.ts`, `src/lib/staff/polling.ts`, `src/lib/staff/api-client.ts`, `src/lib/firebase/staff-auth.tsx`, `src/components/staff/*`, `src/lib/auth/staff-authorization.test.ts`, `src/lib/api/staff-handlers.test.ts`, `src/lib/staff/polling.test.ts`, `package.json`, `security_spec.md`, `docs/*`, `README.md` | Founder Phase 1D-2 authorization; Google AI Studio Build agent | `npm run typecheck` passed; `npm test` passed (56/56 unit/mocked-DB/security/polling tests); production build, lint, live HTTP route checks, and headless Chromium desktop/mobile verification passed | Implemented & locally verified with mocked DB; proceeded to Phase 1D-3 upon founder authorization. |
| 2026-11-22 | Milestone 1D — Phase 1D-3 (Live Neon migration, idempotent seeding, live PG-01..PG-06 verification & legacy Firestore decommissioning) | `src/db/migrate.ts`, `src/db/live-verification.test.ts`, `src/lib/firebase/client.ts`, `src/lib/firebase/config.ts`, `src/lib/firebase/auth-state.ts`, `src/lib/env/public.ts`, `src/lib/env/server.ts`, `src/lib/env/config.test.ts`, `src/app/page.tsx`, `src/app/intake/page.tsx`, `eslint.config.mjs`, `package.json`, `src/lib/auth/staff-authorization.test.ts`, `src/lib/staff/polling.test.ts`; deleted `firestore.rules`, `firebase-blueprint.json`, `src/lib/firebase/errors.ts`, `src/lib/firebase/security-rules.test.ts`, `src/components/shared/FirebaseErrorBoundary.tsx`, `src/lib/schemas/staff.ts`; updated `security_spec.md`, `docs/*`, `README.md` | Founder Phase 1D-3 authorization & Neon env config; Google AI Studio Build agent | Applied Drizzle migrations to live Neon PostgreSQL; ran idempotent `src/db/seed.ts` twice (`demo-clinic-01` / `DEMO-CLINIC-01`); `npm run typecheck` passed; full `npm test` passed live (55/55, 0 skipped, including live Neon tables/triggers/seed, PG-01..PG-06 checks rolled back, and live pooled `DATABASE_URL` Drizzle reads); `compile_applet`, `lint_applet`, live HTTP checks, and headless Chromium desktop/mobile verification passed (0 console errors/warnings) | Milestone 1D complete. Initial staff profile seeding requires founder-supplied `SEED_ADMIN_*` values per Option 2B (`D-016`). Ready for Milestone 2 approval. |
| 2026-11-23 |  |  |  |  |  |
| 2026-11-24 |  |  |  |  |  |

## Work completed before official sprint

List planning, research, documentation and review/preparation of the founder-provided HTML design reference completed before November 22. Do not describe these as sprint-built product features.

- Product strategy and planning documents.
- Research and requirements documents.
- Founder-provided standalone HTML design reference, with its actual creation/provision date recorded.

## AI tools disclosure

Complete with actual usage before submission.

| Tool | What it was used for | Human review / responsibility |
|---|---|---|
| Claude | Product brainstorming and documentation; confirm exact contributions | Product decisions and verification remain team responsibility |
| Google AI Studio / Gemini | Application generation, PostgreSQL/Drizzle schema & migration authoring, offline test authoring, debugging | Founder reviews, approves each milestone/phase, and verifies live deployments |
| Other tools | Add only if actually used | Describe accurately |

## Third-party services and dependencies

Record the exact services, SDKs, libraries, datasets and assets used, including licences and attribution where required.

- **Next.js (App Router) & React** — Application framework and UI runtime.
- **Firebase Authentication (`firebase`, `firebase-admin`)** — Staff Google Sign-In identity provider (same-origin `/__/auth/*` proxy) and server-side ID-token signature/claim verification (Cloud Firestore fully decommissioned in Phase 1D-3).
- **Neon PostgreSQL (`pg`, `drizzle-orm`, `drizzle-kit`, `@types/pg`)** — Live authoritative relational database driver, typed ORM, and SQL migration runner (Milestone 1D Phases 1D-1, 1D-2, and 1D-3 complete and live-verified).
- **Zod** — Runtime request, environment, and AI-extraction schema validation.
- **Lucide React & Motion** — UI iconography and accessible animations.
