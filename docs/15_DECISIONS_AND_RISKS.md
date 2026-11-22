# Decisions and Risks — MedFlow (Working Codename)

**Document ID:** MED-GOV-015  
**Version:** 0.2  
**Status:** Proposed decision log for founder approval  
**Last updated:** 2026-11-21

## 1. Approved project constraints

| ID | Decision / constraint | Status | Rationale |
|---|---|---|---|
| D-001 | Build for TCC Hackathon 2026 first, while keeping a credible commercial product path. | Approved by founder | User explicitly confirmed commercial intent while prioritising the hackathon. |
| D-002 | Use documentation-first delivery: complete Markdown context, HTML design system, then one master Google AI Studio handoff prompt. | Approved by founder | Prevents fragmented context and makes implementation reproducible. |
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
| R-013 | Firebase security rules fail to isolate staff/facility data. | Critical | Use authenticated staff roles, server-side validation where appropriate, facility-scoped rules, and security tests. |
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
| D-014 | Use the verified Google AI Studio Starter Tier-compatible architecture on provisioned project `daring-brace-jw1xt` (region `europe-west3`, named Firestore Enterprise Edition database `ai-studio-medflow-18474100-269d-4cc8-8c48-2c46f125468b`). Do not bypass IAM limitations or use service-account keys. | Approved by founder | Server-side `firebase-admin` is strictly limited to no-IAM `verifyIdToken(token)` verification. Firestore persistence, facility isolation, staff authorization, and append-only audit invariants are enforced by hardened `firestore.rules`. |
| D-015 | Adopt Option 1B for AI draft persistence: patient submission creates the intake and its initial `intake_created` audit event; AI extraction is triggered and persisted only through an authenticated, authorized staff session with server-side Gemini processing, provenance verification, and strict schema validation. | Approved by founder | Zero unauthenticated post-submission AI draft writes; original patient narrative stays immutable and durably saved before AI runs. |
| D-016 | Adopt Option 2B for initial facility and staff bootstrap: do not add an email-specific bootstrap exception to `firestore.rules`; keep `/facilities` and `/staff` non-writable by ordinary clients and provision the synthetic demo facility and initial administrator profile manually in the Firebase Console. | Approved by founder | Eliminates client-side privilege escalation paths; authentication alone grants zero clinical access. |




## 9. Founder decisions — new design system and algorithm direction (confirmed 2026-11-22)

| ID | Decision | Status | Consequence |
|---|---|---|---|
| D-017 | Replace the previous MedFlow visual system with the founder-supplied `medflow-design-system (1).html`. The uploaded reference is stored as `design-system/medflow-design-system.html`; reusable CSS sections 1–4 are extracted to `design-system/design-tokens.css`. | Approved by founder | New HTML/CSS is the sole visual source of truth. Existing React components must be migrated; do not keep the previous palette or typography active. Product behaviour and clinical safety documents continue to govern functionality. |
| D-018 | Adopt the deterministic **Evidence Integrity Engine** as MedFlow's algorithmic differentiator. It checks exact source-quote matches, derives source spans, records field-level evidence states and binds the validated draft to the immutable narrative through server-generated provenance. | Approved by founder; implementation pending | The engine proves source-location/provenance mechanics only, not clinical truth or semantic correctness. No aggregate trust score. Implement after patient intake and Gemini extraction are working. |
| D-019 | Do not implement the adult TEWS/SATS scoring function, clinical classifications, clinical time targets, vital-sign scoring, autonomous triage or AI red-flag prioritisation shown in the supplied HTML as active MVP functionality. | Approved by founder | Those elements remain reference-only and deferred pending a separate clinical governance decision, authoritative protocol review and local validation plan. Staff-assigned workflow labels remain operational queue organisation only. |
