# MedFlow Security & Database Invariant Specification

**Architecture Decisions Enforced:** `D-006`, `D-007`, `D-008`, `D-009`, `D-015` (Option 1B), `D-016` (Option 2B), `D-020` (Neon PostgreSQL replacing Cloud Firestore; Firebase Authentication retained for identity)  
**Canonical Synthetic Facility:** `demo-clinic-01` / `DEMO-CLINIC-01` (`MedFlow Synthetic Demo Clinic`) — `demo-facility-001` and `DEMO-FACILITY` are retired.

---

## Part A — Authoritative Neon PostgreSQL Security & Invariant Specification (`D-020`, Phase 1D-1+)

Defined in `src/db/schema.ts`, `src/db/invariants.ts`, `drizzle/0000_initial_medflow_schema.sql`, and `drizzle/0001_immutability_triggers.sql`.

### A.1 Server-Only Trust & Credential Boundaries

1. **Identity vs. Authorization Split (`src/lib/auth/staff-authorization.ts`):** Firebase Authentication (`daring-brace-jw1xt`, Google Sign-In via same-origin `/__/auth/*` proxy) proves user identity only. Protected Next.js Route Handlers call `resolveStaffSession()` / `requireAuthorizedStaff()`, which verify `Authorization: Bearer <idToken>` server-side via `verifyIdToken(token)`, require `email_verified === true`, and authorize every operation against PostgreSQL `staff_profiles`, `facility_memberships`, and active `facilities`. Client-supplied UIDs, roles, or unowned `facilityId` values are never trusted.
2. **Zero Browser Database Exposure & Safe Error Masking (`src/lib/db/errors.ts`, `src/lib/http/errors.ts`):** `src/db/index.ts` enforces `assertServerRuntime()` and connects strictly via server-only `DATABASE_URL` (pooled Neon runtime, TLS `rejectUnauthorized: true`). Direct schema migrations (`drizzle.config.ts`) and founder-run CLI seeding (`src/db/seed.ts`) use server-only `DATABASE_URL_UNPOOLED`. Neither variable is ever prefixed with `NEXT_PUBLIC_` or exposed to client bundles. Database unavailability (`503 DATABASE_UNAVAILABLE`) and query errors (`500 DATABASE_QUERY_FAILED`) return sanitized JSON with `Cache-Control: no-store` and never leak connection URIs, SQL statements, or `pg` driver internals.
3. **Cross-Facility Non-Disclosure & Minimal Queue Projection:** `GET /api/staff/intakes` returns only bounded queue summary fields (excluding full patient narratives and briefs) scoped strictly to the caller's verified `facilityId` (`403 FACILITY_ACCESS_DENIED` on explicit unauthorized facility requests). `GET /api/staff/intakes/[intakeId]` queries by `(id, verified_facility_id)` and returns an identical safe `404 INTAKE_NOT_FOUND` for both non-existent and cross-facility UUIDs to prevent cross-tenant existence oracles.
4. **No Client Self-Provisioning (Option 2B):** Ordinary clients have no API path to create or modify `facilities`, `staff_profiles`, or `facility_memberships`. Initial provisioning is performed exclusively through founder-run `src/db/seed.ts` (with optional validated `SEED_ADMIN_*` environment variables and zero hardcoded personal credentials).
5. **Deferred Provenance Signing Secret:** `EVIDENCE_HMAC_SECRET` is intentionally deferred until Milestone 3 (Evidence Integrity Engine implementation).

### A.2 Database-Enforced Clinical Safety Invariants (SQL Constraints & Triggers)

| # | Invariant | Database Mechanism | Guarantee |
|---|---|---|---|
| **PG-01** | **Cross-Facility Child Isolation (Composite FKs)** | `patient_intakes_id_facility_id_uq` (`UNIQUE (id, facility_id)`) referenced by `intake_evidence_intake_facility_fk` and `audit_events_intake_facility_fk` (`ON DELETE RESTRICT`) | Every `intake_evidence` and `audit_events` row is guaranteed at the database layer to have the exact same `facility_id` as its parent `patient_intakes` row. |
| **PG-02** | **Immutable Patient Source Narrative** | `BEFORE UPDATE` trigger `patient_intakes_immutability_trg` | Blocks any `UPDATE` modifying `id`, `facility_id`, `reference_code`, `idempotency_key`, `demo_record`, `patient_display_name`, `age`, `input_mode`, `transcription_status`, `transcription_model`, `transcript_raw`, `confirmed_narrative`, `confirmed_narrative_sha256`, `transcript_confirmed_at`, or `created_at`. |
| **PG-03** | **Immutable `intake_evidence` with One-Way `is_current` Archival** | `BEFORE UPDATE OR DELETE` trigger `intake_evidence_immutability_trg` + partial unique index `intake_evidence_current_field_uq` (`WHERE is_current = true`) + `intake_evidence_status_span_chk` | Blocks all `DELETE` operations and blocks every `UPDATE` except a strictly controlled one-way transition `is_current: true -> false` with zero changes to any other column (`id`, `intake_id`, `facility_id`, `extraction_run_id`, `field_category`, `field_path`, `claim_value`, `certainty`, `source_quote`, `verification_status`, `span_start`, `span_end`, `engine_version`, `narrative_sha256`, `created_at`). Re-activating (`false -> true`) is rejected. |
| **PG-04** | **Append-Only Audit Trail** | `BEFORE UPDATE OR DELETE` trigger `audit_events_append_only_trg` | Unconditionally raises an exception on any `UPDATE` or `DELETE` against `audit_events`. |
| **PG-05** | **3-Actor Identity & Complete 10-Action-to-Actor Mapping (`D-007`)** | `audit_events_actor_identity_chk`, `audit_events_action_actor_mapping_chk`, `audit_events_reason_required_chk` | Enforces exact actor-to-action pairing in PostgreSQL: `patient` → `{intake_created, transcript_confirmed}` (`actor_uid`/`actor_role` `NULL`); `system` → `{ai_completed, ai_failed}` (`actor_uid`/`actor_role` `NULL`); `staff` → `{review_started, priority_assigned, priority_changed, status_changed, brief_confirmed, brief_corrected}` (`actor_uid`/`actor_role` `NOT NULL`). `priority_changed` and `brief_corrected` require trimmed `reason` ≥ 3 chars. |
| **PG-06** | **Internal Staff-Review Consistency** | `patient_intakes_staff_review_consistency_chk` | `not_reviewed` requires `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, `staff_correction_note` ALL `NULL`; `confirmed` requires `reviewed_by_uid` & `reviewed_at` `NOT NULL` and `staff_correction_note` `NULL`; `corrected` requires `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, and `staff_correction_note` (3–500 trimmed chars) ALL `NOT NULL`. |
| **PG-07** | **Staff-Only AI Extraction Persistence (Option 1B)** | Server-side Route Handler authorization + atomic PostgreSQL transaction | Unauthenticated clients can only submit new intakes (`workflow_status = 'new'`, `staff_assigned_priority = 'unassigned'`, `ai_status = 'queued'`, `staff_review_status = 'not_reviewed'`). Only authenticated, active, facility-authorized staff can trigger extraction and persist `ai_brief`, `ai_brief_provenance`, `intake_evidence`, and `system` `audit_events`. |

### A.3 PostgreSQL Mapping of the "Dirty Dozen" Adversarial Controls

| # | Attack Class | PostgreSQL + Route Handler Gate That Rejects It |
|---|---|---|
| **DD-01** | Self-provision staff profile / membership | No public write route to `staff_profiles`/`facility_memberships`; CLI-only seeding (`src/db/seed.ts`). |
| **DD-02** | Staff PII enumeration | `/api/staff/session` returns only the authenticated caller's own profile & active memberships; no staff-list route. |
| **DD-03** | Unauthenticated queue / record read | Staff Route Handlers require verified Firebase Bearer token + active PostgreSQL `staff_profiles` & `facility_memberships`. |
| **DD-04** | Cross-facility read or child attachment | Queries filter strictly by verified `facility_memberships.facility_id`; composite FKs `intake_evidence_intake_facility_fk` & `audit_events_intake_facility_fk` block mismatched child rows at the DB layer. |
| **DD-05** | Shadow field / AI triage injection on create | Strict Zod `.strict()` schemas reject unknown/forbidden keys; server hardcodes initial `workflow_status`, `staff_assigned_priority`, `ai_status`, and `staff_review_status`. |
| **DD-06** | Orphan intake without patient audit event | `POST /api/intakes` wraps `patient_intakes` insert and `audit_events` (`patient` / `intake_created`) insert in a single PostgreSQL transaction. |
| **DD-07** | Unauthenticated post-submit AI draft write | `POST /api/intakes/[intakeId]/extract` requires verified active facility staff (`D-015`). |
| **DD-08** | Overwriting immutable original narrative | Trigger `patient_intakes_immutability_trg` rejects any `UPDATE` altering `confirmed_narrative` or source identity columns. |
| **DD-09** | Priority change or brief correction without reason / inconsistent review state | `audit_events_reason_required_chk` and `patient_intakes_staff_review_consistency_chk` reject missing/short reasons or inconsistent staff-review columns at the DB layer. |
| **DD-10** | Audit tampering or `intake_evidence` tampering/deletion | `audit_events_append_only_trg` blocks all `UPDATE`/`DELETE` on `audit_events`; `intake_evidence_immutability_trg` blocks `DELETE` and any `UPDATE` other than one-way `is_current: true -> false`. |
| **DD-11** | Audit actor/action spoofing (`D-007`) | `audit_events_actor_identity_chk` and `audit_events_action_actor_mapping_chk` reject mismatched actor/action pairs (e.g., `staff` logging `ai_completed`, or `system` logging `priority_changed`) at the DB layer. |
| **DD-12** | Unverified email / invalid workflow transition / oversized IDs | Server enforces `decodedToken.email_verified === true`, explicit Zod UUID/bounds validation, and `isValidWorkflowTransition(...)`. |

---

## Part B — Legacy Firestore Decommissioning Record (Completed in Phase 1D-3)

**Status:** Cloud Firestore is fully decommissioned as of Phase 1D-3 under ADR `D-020`. All legacy Firestore artifacts (`firestore.rules`, `firebase-blueprint.json`, `src/lib/firebase/errors.ts`, `src/lib/firebase/security-rules.test.ts`, `src/components/shared/FirebaseErrorBoundary.tsx`, `src/lib/schemas/staff.ts`), Firestore client initialization (`getFirestore`/`db`/`testFirestoreConnection`), and `@firebase/eslint-plugin-security-rules` have been removed. Firebase Authentication (`daring-brace-jw1xt`, Google Sign-In + `/__/auth/*` same-origin proxy + server-side `verifyIdToken`) remains intact as the identity provider only, and live Neon PostgreSQL enforces invariants PG-01 through PG-06 at the database layer.

---

## Part C — Hackathon Demo Mode Security Specification (`D-021`, Phase DA-1)

Defined in `src/db/invariants.ts`, `src/lib/env/server.ts`, `src/lib/auth/demo-session.ts`, `src/lib/auth/staff-authorization.ts`, and `src/lib/api/demo-handlers.ts`.

### C.1 Fail-Closed Server Controls & Fixed Identities

1. **Disabled by Default & Fail-Closed Secret Enforcement:** `MEDFLOW_DEMO_MODE_ENABLED` defaults to `false`. Only the exact server-side string `"true"` enables Demo Mode. When enabled, `MEDFLOW_DEMO_SESSION_SECRET` (minimum 32 characters, strictly server-only, never `NEXT_PUBLIC_*`) and a valid bounded `MEDFLOW_DEMO_SESSION_TTL_SECONDS` (`300..28800`, default `7200`) are mandatory. Missing or weak configuration fails closed with `503 DEMO_MODE_MISCONFIGURED`; disabled deployments return `403 DEMO_MODE_DISABLED`.
2. **Fixed Predefined Synthetic Personas Only:** Only two server-defined personas exist—`demo-admin-01` (`admin`) and `demo-staff-01` (`nurse`)—both bound exclusively to canonical synthetic facility `demo-clinic-01` (`DEMO-CLINIC-01`, `is_demo = true`). `POST /api/demo/session/admin` and `POST /api/demo/session/staff` reject any non-empty request body attempting to inject `role`, `facilityId`, or `uid` (`400 UNSUPPORTED_REQUEST_BODY`).
3. **Reserved Demo UID Separation:** The Firebase Bearer token verification path in `resolveStaffSession()` explicitly rejects reserved synthetic demo UIDs (`403 RESERVED_DEMO_UID`) so real Firebase tokens cannot collide with synthetic demo identities.

### C.2 Cookie Cryptographic Integrity, CSRF & Revocation

1. **Signed HTTP-Only Cookie (`medflow_demo_session`):** Tokens use versioned base64url payloads signed with `HMAC-SHA256` and verified in constant time via `crypto.timingSafeEqual`. Strict Zod schema validation, exact persona/UID/role/facility binding checks, timestamp/TTL bounds, and expiration checks run on every request. Cookies are never exposed to `document.cookie`, `localStorage`, or `sessionStorage`.
2. **Cookie Attributes:** Always sets `HttpOnly; Path=/; Max-Age=<ttl>`. In production or HTTPS requests (`NODE_ENV === "production"` or `https`), sets `Secure; SameSite=None; Partitioned` to protect transport confidentiality while remaining usable in both standalone tabs and embedded preview iframes. Local non-HTTPS development uses `SameSite=Lax`.
3. **CSRF Protection:** Cookie-issuing (`POST /api/demo/session/admin`, `POST /api/demo/session/staff`) and cookie-revoking (`POST /api/demo/logout`) routes require both the non-simple custom header `X-MedFlow-Demo-Request: 1` and a same-origin `Origin`/`Referer` host match against `X-Forwarded-Host`/`Host`.
4. **Revocation & Idempotent Switching:** `POST /api/demo/logout` revokes the active session ID (`sid`) server-side and clears the cookie (`Max-Age=0`). Switching personas automatically revokes the superseded session ID. Rapid duplicate clicks on the same persona reuse the active valid session when at least 5 minutes remain. *(Limitation documented honestly: the revocation registry is process-local in-memory, bounded by `MAX_REVOKED_ENTRIES` and natural token expiry; Demo Mode is strictly for hackathon evaluation and not production clinical auth.)*

### C.3 Unified RBAC & Tenant Isolation

- Demo cookies flow through the exact same `resolveStaffSession` / `requireAuthorizedStaff` server boundary used for Firebase Bearer tokens—no parallel authorization bypass exists.
- Every request re-verifies the active PostgreSQL `staff_profiles` row, active `facility_memberships` row, exact persona role match, and `facilities.is_demo === true` on `demo-clinic-01`.
- Any request supplying another `facilityId` fails with `403 FACILITY_ACCESS_DENIED`.
- Read-only `GET /api/staff/admin/facility` enforces `allowedRoles: ["admin"]`, allowing `demo-admin-01` (`200`) while denying `demo-staff-01` (`403 INSUFFICIENT_STAFF_ROLE`).

