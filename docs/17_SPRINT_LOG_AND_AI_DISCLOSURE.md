# MedFlow — Sprint Log and AI Disclosure

> Update this file during the official sprint. Do not backdate or invent implementation work. This file is a template until entries are recorded.

## Sprint log

| Date/time (WAT) | Milestone / change | Files or modules | Contributor / tool assistance | Tests run and observed result | Status / blockers |
|---|---|---|---|---|---|
| 2026-11-22 | Milestone 1D — Phase 1D-1 (Neon PostgreSQL offline foundation, ADR `D-020`) | `src/db/invariants.ts`, `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed.ts`, `src/db/schema.test.ts`, `drizzle.config.ts`, `drizzle/0000_initial_medflow_schema.sql`, `drizzle/0001_immutability_triggers.sql`, `drizzle/meta/*`, `.env.example`, `package.json`, `src/lib/env/*`, `src/lib/schemas/intake.test.ts`, `security_spec.md`, `docs/*`, `README.md`, `AGENTS.md`, `AI_STUDIO_MASTER_PROMPT.md` | Founder architecture approval (`D-020` + 8 requirements); Google AI Studio Build agent | `npm run typecheck` passed; `npm test` passed (34/34 tests); `compile_applet` & `lint_applet` passed; `bun audit` run (0 advisories in `pg`/`drizzle-orm`; CLI-only `drizzle-kit` transitive `esbuild` moderate dev-server note) | Offline foundation complete; live Neon execution intentionally deferred until founder provisions Neon & approves Phases 1D-2/1D-3. |
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
- **Firebase Authentication (`firebase`, `firebase-admin`)** — Staff Google Sign-In identity provider and server-side ID-token signature/claim verification (legacy Firestore modules retained only until Phase 1D-3 cleanup).
- **Neon PostgreSQL (`pg`, `drizzle-orm`, `drizzle-kit`, `@types/pg`)** — Authoritative relational database driver, typed ORM, and SQL migration generator (Phase 1D-1 offline foundation complete; live DB cutover in Phases 1D-2/1D-3).
- **Zod** — Runtime request, environment, and AI-extraction schema validation.
- **Lucide React & Motion** — UI iconography and accessible animations.
