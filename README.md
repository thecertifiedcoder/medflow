# MedFlow

**Working concept:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow.

**Competition:** TCC Hackathon 2026 · **Current status:** Milestones 1A (Next.js foundation), 1B (Firebase Auth + same-origin `/__/auth/*` proxy + server ID-token verification), 1C (UI design-system migration), **Milestone 1D (Phases 1D-1, 1D-2, and 1D-3 — live Neon PostgreSQL migrations, idempotent canonical seed, live PG-01..PG-06 constraint/trigger verification, server-side staff APIs, 5s visibility-aware UI polling, and Cloud Firestore decommissioning under ADR `D-020`)**, and **Phase DA-1 (Hackathon Demo Access under ADR `D-021`)** are implemented and verified. Milestone 2 (patient intake persistence, voice transcription, Gemini extraction, staff mutations) and Milestone 3 (Evidence Integrity Engine) are not yet implemented.

> **Safety notice:** This is a hackathon prototype, not a clinically validated medical device or emergency service. Do not use it for real patient care or enter real patient information or audio. All demonstrations and demo identities use synthetic data only. MedFlow must not diagnose, prescribe, autonomously assign clinical urgency, or tell a patient that it is safe to wait.

---

## Try the MedFlow Demo

When Hackathon Demo Mode is enabled on the deployment (`MEDFLOW_DEMO_MODE_ENABLED=true` with a server-only `MEDFLOW_DEMO_SESSION_SECRET`), judges and evaluators can test MedFlow immediately from the landing page (`/`) without Google Sign-In or manual account provisioning:

1. **Enter as Demo Administrator (`admin`)** — Opens `/staff/queue` as synthetic `demo-admin-01` inside canonical synthetic facility `demo-clinic-01` (`DEMO-CLINIC-01`). Includes both the live Neon PostgreSQL staff queue and the read-only **Facility administration overview** panel (`GET /api/staff/admin/facility`).
2. **Enter as Demo Clinical Staff (`nurse`)** — Opens `/staff/queue` as synthetic `demo-staff-01` inside `demo-clinic-01` (`DEMO-CLINIC-01`). Grants standard clinical staff queue access while strictly denying admin-only endpoints (`403 INSUFFICIENT_STAFF_ROLE` on `GET /api/staff/admin/facility`).
3. **Start Patient Intake (no account required)** — Opens `/intake` directly with the safety notice and patient intake interface scaffold.

**Switching roles & signing out:** You can switch directly between Demo Administrator and Demo Clinical Staff from `/` (the server automatically revokes the superseded session cookie) or select **Sign out** in the top header or staff workspace to revoke the active demo session immediately (`POST /api/demo/logout`).

**Synthetic-data-only notice & current limitations (as of Phase DA-1):**
- All demo identities (`demo-admin-01`, `demo-staff-01`) and facility records (`demo-clinic-01` / `DEMO-CLINIC-01`) are strictly synthetic. Never enter real patient information.
- **No fabricated patient queue records:** `patient_intakes` currently starts empty (`0` rows) in Neon PostgreSQL because patient intake submission (`POST /api/intakes`), server-side Gemini voice transcription/extraction, and audited staff workflow mutations are scheduled for **Milestone 2**, and the deterministic Evidence Integrity Engine is scheduled for **Milestone 3**.
- **Process-local revocation registry:** Demo session revocation on logout/switch is tracked in server memory until token expiry; in multi-instance serverless deployments, revocation is process-local (acceptable for bounded hackathon demo TTLs, and another reason Demo Mode is never for production clinical auth).

---

## Hackathon Demo Mode Architecture & Security (`D-021`)

Hackathon Demo Mode is a server-controlled evaluation layer designed so judges can evaluate MedFlow safely without weakening MedFlow's PostgreSQL authorization or Firebase Authentication architecture:

- **Fixed server-defined personas (zero client-controlled roles/tenants):**
  - `POST /api/demo/session/admin` → fixed `demo-admin-01`, role `admin`, facility `demo-clinic-01` (`is_demo = true`).
  - `POST /api/demo/session/staff` → fixed `demo-staff-01`, role `nurse`, facility `demo-clinic-01` (`is_demo = true`).
  - Any request body attempting to supply `role`, `facilityId`, or `uid` is rejected with `400 UNSUPPORTED_REQUEST_BODY`.
- **Signed, HTTP-only session cookies (`medflow_demo_session`):**
  - Signed server-side with `HMAC-SHA256` using server-only `MEDFLOW_DEMO_SESSION_SECRET` (verified with `crypto.timingSafeEqual`, strict Zod payload validation, expiration checks, and server-side revocation checks).
  - Never stored in `localStorage` or `sessionStorage`, never readable by browser JavaScript.
  - Emits `HttpOnly; Path=/; Max-Age=<ttl>; Secure; SameSite=None; Partitioned` in production/HTTPS environments (compatible with both standalone tabs and embedded preview frames) and `HttpOnly; Path=/; Max-Age=<ttl>; SameSite=Lax` on local non-HTTPS HTTP.
- **CSRF protection:** `POST /api/demo/session/*` and `POST /api/demo/logout` require the non-simple custom header `X-MedFlow-Demo-Request: 1` and validate same-origin `Origin`/`Referer` host matching against `X-Forwarded-Host`/`Host`.
- **Unified PostgreSQL authorization boundary:** Every protected staff Route Handler (`/api/staff/session`, `/api/staff/intakes`, `/api/staff/intakes/[intakeId]`, `/api/staff/admin/facility`) uses the single server-side `resolveStaffSession` / `requireAuthorizedStaff` boundary (`src/lib/auth/staff-authorization.ts`). Demo sessions are still verified against active PostgreSQL `staff_profiles`, `facility_memberships`, and `facilities` (`is_demo = true`) on every request, cannot access any facility other than `demo-clinic-01` (`403 FACILITY_ACCESS_DENIED`), and obey exact RBAC role separation (`admin` vs `nurse`).
- **Firebase Authentication preserved intact:** Standard Google Sign-In on `/staff/login`, `/__/auth/*` same-origin proxy, and server-side Firebase Admin `verifyIdToken()` remain untouched. Reserved synthetic demo UIDs (`demo-admin-01`, `demo-staff-01`) are explicitly rejected on the Firebase Bearer path (`403 RESERVED_DEMO_UID`).

### Enabling, Disabling, and Configuring Demo Mode

Demo Mode is **disabled by default** and **fails closed** (`403 DEMO_MODE_DISABLED` when disabled; `503 DEMO_MODE_MISCONFIGURED` if enabled without a valid secret). Never prefix any of these variables with `NEXT_PUBLIC_`.

| Environment Variable | Scope | Default | Description |
|---|---|---|---|
| `MEDFLOW_DEMO_MODE_ENABLED` | Server-only | `false` | Set to `true` **only** in the intended hackathon evaluation deployment. Any other value disables Demo Mode. |
| `MEDFLOW_DEMO_SESSION_SECRET` | Server-only | *(unset)* | Required when Demo Mode is enabled. Must be at least 32 characters of high-entropy random text (e.g., `openssl rand -base64 48`). |
| `MEDFLOW_DEMO_SESSION_TTL_SECONDS` | Server-only | `7200` | Optional session lifetime in seconds (bounded between `300` and `28800`). |
| `DATABASE_URL` | Server-only | *(required)* | Pooled Neon PostgreSQL connection string used by Next.js Route Handlers at runtime. |
| `DATABASE_URL_UNPOOLED` | Server-only | *(required for CLI)* | Direct Neon PostgreSQL connection string used by `npm run db:migrate` and `npm run db:seed`. |
| `GEMINI_API_KEY` | Server-only | *(Milestone 2)* | Server-side Gemini API key (never exposed to browser). |
| `NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE` | Public | `DEMO-CLINIC-01` | Public intake code for the canonical synthetic demo facility. |

- **To enable Demo Mode:** Set `MEDFLOW_DEMO_MODE_ENABLED=true` and a ≥32-char random `MEDFLOW_DEMO_SESSION_SECRET` in your deployment host's server secrets (e.g., Google AI Studio Settings > Secrets or Cloud Run secrets), ensure `npm run db:seed` has been executed, and restart/redeploy.
- **To disable Demo Mode safely:** Remove `MEDFLOW_DEMO_MODE_ENABLED` or set `MEDFLOW_DEMO_MODE_ENABLED=false`. All `/api/demo/session/*` routes immediately return `403 DEMO_MODE_DISABLED` and any existing demo cookies are immediately rejected on every `/api/staff/*` route.

### Seeding, Resetting Demo Data, and Real Firebase Staff Provisioning

- **Seed / re-verify canonical demo facility and synthetic demo accounts (idempotent):**
  ```bash
  npm run db:migrate   # Applies Drizzle SQL migrations via DATABASE_URL_UNPOOLED
  npm run db:seed      # Upserts demo-clinic-01 + demo-admin-01 (admin) + demo-staff-01 (nurse)
  ```
- **Reset synthetic demo data:** Because `patient_intakes`, `intake_evidence`, and `audit_events` enforce append-only/immutability triggers at the PostgreSQL layer, resetting synthetic demo data should be performed only on a non-production hackathon database branch (e.g., Neon branch reset followed by `npm run db:migrate && npm run db:seed`).
- **Provision a real Firebase Google Sign-In staff account (Option 2B / `D-016`):** Supply `SEED_ADMIN_UID`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_DISPLAY_NAME` (and optional `SEED_ADMIN_ROLE=admin|nurse|doctor`) in the shell environment when running `npm run db:seed`, then sign in via Google Sign-In at `/staff/login`.

### Why Demo Mode Is Not Production Hospital Authentication

Demo Mode intentionally issues shared, passwordless synthetic sessions to public hackathon judges for a single synthetic clinic (`demo-clinic-01`) with process-local revocation. Production clinical deployments must keep `MEDFLOW_DEMO_MODE_ENABLED=false` and enforce verified per-clinician identity (e.g., SSO/OIDC/Firebase Auth with MFA), strict tenant RBAC, centralized session revocation, audit attribution to individual licensed staff, and formal clinical/regulatory governance.

---

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
- [`security_spec.md`](security_spec.md) — Neon PostgreSQL invariants, "Dirty Dozen" controls, and Demo Mode security specification.
- [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) — implementation handoff prompt for Google AI Studio.
- [`AGENTS.md`](AGENTS.md) — durable rules for AI agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and documentation conventions.
- [`SECURITY.md`](SECURITY.md) — prototype security and privacy policy.

## Current implementation status

- **Milestone 1A (`Implemented and tested`):** Next.js App Router + TypeScript foundation, strict Zod extraction/intake schemas, server/public environment boundaries, and Preview build.
- **Milestone 1B (`Implemented and tested`):** Firebase Authentication (Google Sign-In with same-origin `/__/auth/*` proxy) and server-side `verifyIdToken(token)` verification. *(Transitional Cloud Firestore artifacts were decommissioned in Phase 1D-3.)*
- **Milestone 1C (`Implemented and tested`):** React UI rebuilt to match the single founder-attached HTML design system without TEWS/SATS clinical scoring (`D-019`).
- **Milestone 1D — Phases 1D-1, 1D-2, and 1D-3 (`Implemented and live-verified`):** Per ADR `D-020`, Neon PostgreSQL (`pg` + Drizzle ORM + Drizzle Kit) replaced Cloud Firestore as MedFlow's authoritative database while Firebase Auth remains the identity provider. Delivered the 6-table schema, composite tenant foreign keys, immutability/append-only triggers, 10-action-to-actor DB checks, staff-review consistency checks, server-side staff APIs, 5s visibility-aware polling, live Neon migrations & canonical seed, live PG-01..PG-06 verification, and full Cloud Firestore decommissioning.
- **Phase DA-1 — Hackathon Demo Access (`Implemented and verified`):** Per ADR `D-021`, delivered server-controlled Hackathon Demo Mode (`MEDFLOW_DEMO_MODE_ENABLED`, `MEDFLOW_DEMO_SESSION_SECRET`), signed HTTP-only cookie sessions, CSRF protection, server-side session revocation, seeded synthetic personas (`demo-admin-01` → `admin`, `demo-staff-01` → `nurse`) scoped strictly to `demo-clinic-01`, read-only admin-only role separation (`GET /api/staff/admin/facility`), and one-click Demo Administrator / Demo Clinical Staff / Start Patient Intake entry on `/`.

Still outstanding (each requires separate founder approval):
- **Milestone 2 (`Planned`):** Patient typed/voice intake, server-side Gemini transcription, durable PostgreSQL intake persistence, staff-triggered server-side Gemini extraction, and audited staff workflow mutations.
- **Milestone 3 (`Planned`):** Deterministic Evidence Integrity Engine, server-only `EVIDENCE_HMAC_SECRET` signing/verification, and staff evidence-review UI.

No feature should be described as implemented until it exists in the running application and passes its acceptance tests.

## Approved application stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** React components rebuilt to match the single founder-provided HTML design-system attachment
- **Backend:** Next.js Route Handlers
- **Authentication:** Firebase Authentication (Google Sign-In + same-origin `/__/auth/*` proxy + server-side `verifyIdToken`) for real accounts, plus optional server-controlled Hackathon Demo Mode (signed HTTP-only cookies, disabled by default, scoped strictly to `demo-clinic-01`)
- **Database (authoritative under `D-020`):** Neon PostgreSQL via `pg` + Drizzle ORM + Drizzle Kit (`DATABASE_URL` for runtime, `DATABASE_URL_UNPOOLED` for direct migrations/seeding; strictly server-only; Cloud Firestore fully decommissioned in Phase 1D-3).
- **AI:** Server-side Google Gemini API; live model calls are pending Milestone 2
- **Deployment target:** A verified Node.js host, with Google Cloud Run as the current candidate

## Design and algorithm boundaries

The single HTML file attached directly to the Google AI Studio conversation replaces the previous visual system and is the only design reference. Do not create a separate token file or design-system specification. Ignore the HTML's demo JavaScript and do not implement its adult TEWS/SATS scoring UI or other autonomous clinical scoring. The approved algorithm direction is the deterministic Evidence Integrity Engine in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`; it checks exact source quotations and provenance, not clinical truth or urgency.

## Hackathon constraints & commercialisation boundary

The hackathon rules and scoring requirements are documented in [`docs/01_HACKATHON_RULES_AND_SCORECARD.md`](docs/01_HACKATHON_RULES_AND_SCORECARD.md). Keep a contemporaneous sprint log and disclose AI assistance. Do not fabricate metrics, clinical validation, partners or user outcomes. Real clinical deployment would require clinical governance, validation against an appropriately selected and licensed protocol, privacy/security assessment, operational controls, and applicable Nigerian regulatory review.
