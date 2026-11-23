# Decisions and Risks — MedFlow (Working Codename)

**Document ID:** MED-GOV-015  
**Version:** 0.4  
**Status:** Active decision log (includes Milestone 1D, Phase DA-1, UX-1, Milestone 2, and 2026-11-23 Judge Access updates)  
**Last updated:** 2026-11-23

## 1. Approved project constraints

| ID | Decision / constraint | Status | Rationale |
|---|---|---|---|
| D-001 | Build for TCC Hackathon 2026 first, while keeping a credible commercial product path. | Approved by founder | User explicitly confirmed commercial intent while prioritising the hackathon. |
| D-002 | Use documentation-first delivery: complete Markdown context, one standalone HTML design-system attachment, then one master Google AI Studio handoff prompt. | Approved by founder | Prevents fragmented context and makes implementation reproducible. |
| D-003 | Public GitHub repository and judge-facing documentation are first-class requirements. | Approved by founder | Judges may inspect source code; repository quality contributes to credibility and judging. |
| D-004 | All demo patients and clinical examples must be synthetic. | Proposed safety requirement | Avoids exposing real patient information in a public hackathon prototype. |
| D-005 | AI is an intake-structuring assistant, not a diagnosing or autonomous clinical decision-maker. | Proposed product boundary | Reduces clinical risk and keeps human clinical authority explicit. |

## 2. Proposed product decisions

| ID | Decision | Status | Rationale / consequence |
|---|---|---|---|
| P-001 | Define the product as a review-first clinical intake and patient-flow layer. | Proposed | Narrower and more defensible than a generic AI triage or hospital management system. |
| P-002 | Preserve the patient's original narrative separately from all AI-generated content. | Proposed | Maintains source fidelity and supports staff verification. |
| P-003 | Make every extracted fact traceable to the patient's original words where possible. | Proposed | Creates an evidence-linked clinical brief and makes errors easier to detect. |
| P-004 | Mark extracted information as explicit, ambiguous, or not provided. | Proposed | Prevents the model from treating missing information as a negative finding. |
| P-005 | New submissions default to `awaiting_staff_review`; AI does not assign final urgency. | Proposed | Prevents an AI-generated low-priority classification from delaying staff review. |
| P-006 | Authorised staff own urgency assignment, case status, and next action. | Proposed | Clinical judgement remains with the care team. |
| P-007 | Preserve a minimal audit trail for AI processing, staff review, edits, and queue changes. | Proposed | Supports accountability and public technical review. |
| P-008 | Save the intake record before attempting AI processing. AI failure must not block queue entry. | Proposed | Maintains a safe fallback and avoids losing patient submissions. |
| P-009 | Keep the hackathon MVP to one facility and one end-to-end intake workflow. | Proposed | Protects delivery time; facility-scoped schema can still support later expansion. |
| P-010 | Treat `MedFlow` as an internal codename until brand and trademark clearance. | Strong recommendation | Multiple existing healthcare products use the same name; one has an Africa/Nigeria-facing hospital platform. |
| P-011 | Do not implement SATS/TEWS scoring in the hackathon MVP. | Strong recommendation | SATS resources have a CC BY-NC-SA 3.0 licence and commercialisation is intended; protocol governance and permission must be resolved first. |
| P-012 | Voice input is a first-class P0 patient-intake pathway, using recorded audio, server-side transcription, editable transcript review and patient confirmation. Typed entry remains available as fallback. | Approved by founder | Founder explicitly requested voice input as part of the hackathon product. This is a core local-context and accessibility workflow, not a decorative P1 enhancement. |

## 3. Risks and mitigations

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-001 | AI omits, invents, or misstates a symptom. | Critical | Preserve raw narrative; require source-linked extraction; validate schema; expose uncertainty; staff must review. |
| R-002 | Missing information is interpreted as a negative finding. | Critical | Use explicit `not_provided` / `ambiguous` states; prohibit inferred negatives. |
| R-003 | AI classification delays a critical patient. | Critical | No AI final urgency, no auto-downgrade, new cases stay awaiting staff review; visible instruction to alert staff immediately. |
| R-004 | Unvalidated SATS/TEWS logic is used as clinical scoring. | High | Exclude from MVP; obtain appropriate clinical governance and commercial rights before future implementation. |
| R-005 | Real patient information is exposed in a public repository or demo. | Critical | Synthetic data only; no real PHI; environment secrets; scrub logs; review repository history before publication. |
| R-006 | Health data is processed without a documented lawful basis or appropriate safeguards. | Critical | Do not process real patient data; future deployment requires legal/privacy review, privacy notice, processor terms, safeguards, and DPIA assessment as applicable. |
| R-007 | Gemini/API processing creates cross-border data-transfer issues. | High | Use synthetic demo data; assess vendor processing, data location, transfer basis, and contractual safeguards before production. |
| R-008 | Product is within NAFDAC SaMD scope. | High | Define intended use accurately; obtain specialist regulatory advice and determine applicable category/registration pathway before commercial sale or clinical use. |
| R-009 | Similar products make broad AI intake proposition hard to differentiate. | High | Focus on evidence-linked intake, source fidelity, verified fields, staff ownership, and measurable workflow value; validate with interviews. |
| R-010 | `MedFlow` brand collides with existing health products. | High | Keep as codename; complete CAC/company-name, trademark, domain, and market clearance before public brand lock. |
| R-011 | Voice capture or transcription fails on some browsers, devices, noisy environments or accents. | High | Validate the target Android browser early; use MediaRecorder and server-side transcription; test Nigerian English and Pidgin sample utterances; keep transcript editable and typed fallback always available; report limitations honestly. |
| R-012 | MVP scope exceeds the available build window. | High | Protect the P0 vertical slice, including voice capture/transcription, typed fallback, evidence-linked extraction, live queue, staff priority and audit. Cut P1 items such as analytics, QR generation, print/export, extended language experiments and advanced reporting first. |
| R-013 | Database authorization or tenant-isolation controls fail to isolate staff/facility data. | Critical | Enforce server-side Firebase ID-token verification plus authoritative PostgreSQL facility membership/role checks, composite `(intake_id, facility_id)` foreign keys, DB immutability/append-only triggers, action-to-actor CHECK constraints, and automated security tests (retaining existing Firestore rules only until Phase 1D-3 decommissioning). |
| R-014 | Public source code exposes secrets or demo credentials. | Critical | `.env.example` only, secret scanning, no credentials in commits, remove test accounts and review history. |

## 4. Sources requiring special handling

- SATS / EMSSA: current public page identifies a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported licence. Do not copy or adapt SATS resources for a commercial product without appropriate permission/licensing.
- NAFDAC SaMD: determine the actual intended purpose and likely regulatory pathway with specialist advice. Product disclaimers alone do not determine status.
- Nigeria Data Protection Act: health status is sensitive personal data; provide required information, establish a lawful basis, apply safeguards, and assess automated decision-making and cross-border processing.

## 5. Decision protocol

- `Approved`: explicitly confirmed by the founder or a governing requirement.
- `Proposed`: recommended but not yet approved.
- `Strong recommendation`: should not be implemented without explicit reconsideration.
- `Open`: needs research, expert input, or founder decision.

Never silently change an approved decision. If implementation constraints require a change, record the reason, impact, and replacement decision before changing the implementation.


## 6. Phase 4 product and UX clarifications

| ID | Clarification | Status | Consequence |
|---|---|---|---|
| P-013 | Patient display name/alias and age are optional; a generated reference identifies an intake when omitted. | Proposed in PRD | Minimises data collection and keeps intake usable without unnecessary identifiers. |
| P-014 | Patient must explicitly review and confirm a voice transcript before submission. | Approved product requirement | Raw transcript draft and final confirmed narrative remain distinguishable. |
| P-015 | New/unassigned intakes are shown before staff-assigned priority groups; older records come first within each group. | Proposed UX rule | Makes unreviewed submissions visible; this is queue organisation, not clinical triage. |
| P-016 | Staff-confirmed/corrected brief is stored separately from the original AI brief. | Proposed product requirement | Preserves provenance and avoids overwriting model output. |
| P-017 | UI labels `Completed` as completion of the intake workflow only, not treatment or discharge. | Proposed UX rule | Prevents a workflow status being misunderstood as a clinical disposition. |

Founder approval is required for proposed decisions before they become locked product commitments. The clinical safety constraints and hackathon rules remain non-negotiable.

## 7. Milestone 1A founder decisions (confirmed 2026-11-21 / sprint start)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-006 | `docs/09_DATA_MODEL_AND_API_CONTRACTS.md` is authoritative for the structured extraction schema (`symptoms[].value`, `reportedDetailsToReview[].detail`). `docs/06_AI_EXTRACTION_SPEC.md` aligned accordingly. | Approved by founder | Single canonical Zod schema for extraction validation and UI rendering. |
| D-007 | `AuditEvent` uses explicit `actorType: "patient" \| "staff" \| "system"`, with optional `actorUid` and `actorRole` required only for `"staff"`. | Approved by founder | Prevents patient or automated system lifecycle actions from masquerading as nurses or doctors. |
| D-008 | Patient `age` remains optional in UX and API contracts; never required for submission. | Approved by founder | Preserves data minimisation (`FR-02`) while keeping optional context available. |
| D-009 | Staff authentication uses Google Sign-In, gated by a provisioned, active `staff/{uid}` profile with authorised facility membership and role. | Approved by founder | Authentication alone grants zero clinical privileges; facility/role authorization is mandatory. |
| D-010 | Ship strict P0 functionality only; no inert navigation items, fake metrics, notification controls, or unfinished P1 controls. | Approved by founder | All visible controls in the running application must correspond to real, honest functionality. |
| D-011 | `docs/14_UX_AND_USER_FLOWS.md` defines canonical user-facing routes (`/intake`, `/staff/login`, `/staff/queue`, `/staff/intakes/[intakeId]`); `docs/09` defines API boundaries (`/api/*`). | Approved by founder | Eliminates route ambiguity across App Router pages and Route Handlers. |
| D-012 | Retain `MedFlow_GitHub_Import_Pack.zip` untouched for now as a non-authoritative older reference snapshot. | Approved by founder | Avoids unnecessary workspace churn during early milestones. |
| D-013 | Target Gemini models for subsequent verified integration: `gemini-4-hydrogen` (structured extraction) and `gemini-3.5-transcribe` via `generateContent` with `VERBATIM` transcription; `docs/05` updated accordingly. | Approved by founder (pending live API test) | Keeps Gemini calls strictly server-side; live verification required before claiming integration complete. |

## 8. Milestone 1B founder decisions — Starter Tier Firebase Architecture (confirmed 2026-11-21)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-014 | ~~Use the verified Google AI Studio Starter Tier-compatible architecture on provisioned project `daring-brace-jw1xt` (region `europe-west3`, named Firestore Enterprise Edition database `ai-studio-medflow-18474100-269d-4cc8-8c48-2c46f125468b`).~~ **Superseded for application persistence by `D-020`.** | Superseded by D-020 (transitional Firestore kept active until Phase 1D-3) | Firebase Authentication on `daring-brace-jw1xt` remains the identity provider; Cloud Firestore is being replaced by Neon PostgreSQL across Milestone 1D (Phases 1D-1 to 1D-3). |
| D-015 | Adopt Option 1B for AI draft persistence: patient submission creates the intake and its initial `intake_created` audit event; AI extraction is triggered and persisted only through an authenticated, authorized staff session with server-side Gemini processing, provenance verification, and strict schema validation. | Approved by founder (updated by D-020 to persist via server-side PostgreSQL transactions) | Zero unauthenticated post-submission AI draft writes; original patient narrative stays immutable and durably saved before AI runs. |
| D-016 | Adopt Option 2B for initial facility and staff bootstrap: do not add an email-specific self-provisioning bootstrap exception for ordinary clients; provision the synthetic demo facility and initial administrator profile explicitly via controlled administrative provisioning (and idempotent founder-run CLI `src/db/seed.ts` under D-020). | Approved by founder (updated by D-020 for PostgreSQL CLI seeding) | Eliminates client-side privilege escalation paths; authentication alone grants zero clinical access. |




## 9. Founder-approved algorithm decisions (confirmed 2026-11-22)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-018 | Adopt the deterministic **Evidence Integrity Engine** as MedFlow's algorithmic differentiator. It checks exact source-quote matches, derives source spans, records field-level evidence states and binds the validated draft to the immutable narrative through server-generated provenance. | Approved by founder; partial runtime quote grounding implemented in Milestone 2; Milestone 3 persisted EIE & HMAC deferred | Exact-substring runtime quote grounding (`groundBriefQuotesAgainstNarrative`) is active in Milestone 2; persisted field-level `intake_evidence` rows, UTF-16 spans, and `EVIDENCE_HMAC_SECRET` HMAC envelopes remain deferred to Milestone 3. The engine proves source-location/provenance mechanics only, not clinical truth or semantic correctness. |
| D-019 | Do not implement the adult TEWS/SATS scoring function, clinical classifications, clinical time targets, vital-sign scoring, autonomous triage or AI red-flag prioritisation shown in the supplied HTML as active MVP functionality. | Approved by founder | Those elements remain reference-only and deferred pending a separate clinical governance decision, authoritative protocol review and local validation plan. Staff-assigned workflow labels remain operational queue organisation only. |

## 10. Milestone 1D founder decision — Neon PostgreSQL replacing Cloud Firestore (confirmed 2026-11-22)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-020 | Replace Cloud Firestore with **Neon PostgreSQL** (`pg` + Drizzle ORM + Drizzle Kit) as MedFlow's authoritative application database while keeping **Firebase Authentication** (Google Sign-In + same-origin `/__/auth/*` proxy + server-side `verifyIdToken`) as the identity provider. Execute in three separately approved phases: **Phase 1D-1** (offline schema, SQL migrations, triggers, seed script, env/docs), **Phase 1D-2** (PostgreSQL data-access layer, server-authoritative Next.js Route Handlers, visibility-aware queue polling), and **Phase 1D-3** (live Neon migration/seeding, end-to-end verification, legacy Firestore decommissioning). | Approved by founder (Phases 1D-1, 1D-2 & 1D-3 complete and live-verified against Neon PostgreSQL) | Supersedes `D-014` for persistence and updates `D-015`/`D-016` to server-side PostgreSQL transactions. Enforces all 8 mandatory founder requirements live in Neon PostgreSQL: (1) composite `(intake_id, facility_id)` FKs on `intake_evidence` and `audit_events` to guarantee facility match with `patient_intakes`; (2) `intake_evidence` DB immutability trigger permitting only one-way `is_current: true -> false` and forbidding DELETE; (3) DB-level `CHECK` constraint enforcing the complete 10-action-to-actor mapping on `audit_events` (`patient`: `intake_created`, `transcript_confirmed`; `system`: `ai_completed`, `ai_failed`; `staff`: `review_started`, `priority_assigned`, `priority_changed`, `status_changed`, `brief_confirmed`, `brief_corrected`); (4) DB-level `CHECK` constraint ensuring `staff_review_status`, `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, and `staff_correction_note` remain internally consistent; (5) `demo-clinic-01` and `DEMO-CLINIC-01` (`MedFlow Synthetic Demo Clinic`) as the sole canonical synthetic facility identifiers (retiring `demo-facility-001` and `DEMO-FACILITY`); (6) strictly server-only `DATABASE_URL` (pooled runtime) and `DATABASE_URL_UNPOOLED` (direct schema migrations); (7) defer `EVIDENCE_HMAC_SECRET` until Milestone 3; (8) legacy Cloud Firestore artifacts and dependencies fully removed in Phase 1D-3 while Firebase Authentication remains intact. |

## 11. Phase DA-1 founder decision — Hackathon Demo Access Mode (confirmed 2026-11-22)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-021 | Introduce a server-controlled **Hackathon Demo Mode** (`MEDFLOW_DEMO_MODE_ENABLED`, disabled by default; requires server-only `MEDFLOW_DEMO_SESSION_SECRET` ≥ 32 chars) providing one-click **Demo Administrator** (`demo-admin-01` → `admin`) and **Demo Clinical Staff** (`demo-staff-01` → `nurse`) sessions scoped strictly to canonical synthetic facility `demo-clinic-01` (`DEMO-CLINIC-01`, `is_demo = true`), alongside public **Start Patient Intake** (`/intake`), while keeping **Firebase Authentication** and **Neon PostgreSQL** RBAC completely intact. | Approved by founder (Phase DA-1 implemented and verified) | Eliminates Google Sign-In / manual provisioning friction for hackathon judges without weakening security boundaries: (1) zero Neon schema changes; (2) fixed server personas only—clients cannot supply `role`, `facilityId`, or `uid`; (3) HMAC-SHA256 signed HTTP-only cookies (`medflow_demo_session`) with `Secure; SameSite=None; Partitioned` in HTTPS/production and `SameSite=Lax` on local HTTP, CSRF custom header + Origin/Host enforcement, and server-side revocation on logout/persona switch; (4) unified `resolveStaffSession`/`requireAuthorizedStaff` server boundary verifies PostgreSQL `staff_profiles` + `facility_memberships` + `is_demo = true` on every request and rejects reserved demo UIDs on the Firebase Bearer path; (5) concrete role separation via read-only `GET /api/staff/admin/facility` (`admin` 200 vs `nurse` 403); (6) fails closed when disabled (`403`) or misconfigured (`503`). Strictly for hackathon evaluation—never for production clinical authentication. |

## 12. Phase UX-1 founder decision — Platform Experience, Information Architecture & Interface Rework (confirmed 2026-11-22)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-022 | Execute **Phase UX-1 (Information Architecture, User Journeys and Complete Interface Rework)** before starting Milestone 2: restructure MedFlow into 7 focused routes (`/`, `/intake`, `/demo`, `/staff/login`, `/staff/queue`, `/staff/admin`, `/staff/intakes/[intakeId]`), implement context-aware top bars (`PublicTopBar`, `PatientTopBar`, `WorkspaceTopBar`) and role-aware `StaffWorkspaceLayout`, separate the judge evaluation hub (`/demo`) and administrator workspace (`/staff/admin`) from the clinical queue (`/staff/queue`), and isolate the patient self-intake experience (`/intake`) in the `.mf-pt` warm clinical patient theme with zero staff/admin/demo navigation clutter. | Approved by founder (historical pre-Milestone-2 checkpoint; superseded on 2026-11-23 by Milestone 2 and Judge Access simplification) | Defined the pre-Milestone-2 route split. Subsequently updated on 2026-11-23 by Milestone 2 implementation (real persistence, Gemini transcription/extraction, 5 seeded synthetic rows `MF-DEMO-0101`..`MF-DEMO-0105`, staff review mutations) and final Judge Access simplification (Section 13). |

## 13. Post-UX-1 Milestone 2, AI Fallback, Judge Access & Packaging Updates (2026-11-23)

| Item | Change recorded from implemented codebase | Status | Consequence |
|---|---|---|---|
| **Milestone 2** | Implemented live typed/voice patient intake (`POST /api/intakes`, `POST /api/intakes/transcribe`), staff-triggered extraction (`POST /api/intakes/[intakeId]/extract`), runtime exact-substring quote grounding (`groundBriefQuotesAgainstNarrative`), 5 canonical synthetic seed intakes (`MF-DEMO-0101`..`MF-DEMO-0105`), and staff review/brief-correction/priority/status mutations (`review`, `brief-review`, `priority`, `status`). | Implemented and previously reported verified | Original confirmed narrative, raw voice transcript, AI draft, and staff-reviewed copy remain strictly separated in Neon PostgreSQL; Milestone 3 persisted `intake_evidence` writes and `EVIDENCE_HMAC_SECRET` remain deferred. |
| **AI Fallback** | Added Gemini fallback model (`gemini-3.1-flash-lite`) after primary `gemini-4-hydrogen`, plus optional text-only OpenRouter `openrouter/free` fallback (`src/lib/ai/openrouter.ts`) entering the same Zod + quote-grounding pipeline. Voice transcription remains Gemini-only. | Implemented | Improves hackathon demo resilience for text extraction when primary Gemini quota or availability is constrained; synthetic demonstration content only. |
| **Judge Access Simplification** | Simplified public hackathon navigation so `/demo` is labelled **Judge Access** and opens **Enter Clinical Workspace** directly into `/staff/queue`. `/staff/login` redirects to `/demo`, `/staff/admin` redirects to `/staff/queue`, and administrator/staff-login cards are hidden from public UI. | Implemented (committed up to `369048f` on GitHub `main`) | Simplifies judge onboarding without weakening backend API authorization, PostgreSQL RBAC checks, or fail-closed Demo Mode cookie controls. |
| **Vercel Serverless Packaging Fix** | Decoupled `intake-public-handlers.ts` from `firebase-admin`, switched `admin-auth.ts` and `staff-authorization.ts` to lazy `firebase-admin` imports, and configured `next build --webpack` in `package.json` (`NODE_ENV=production next build --webpack`) to eliminate Turbopack `.next/node_modules/firebase-admin-<hash>` symlink crashes on Vercel HTTP 500s (`POST /api/intakes`, `GET /api/staff/session`). | Implemented and verified locally; pending push to `main` & Vercel redeploy | Must be exported/pushed to GitHub `main` and redeployed to Vercel before final external judge testing. |
