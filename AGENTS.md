# Agent Instructions for MedFlow

These rules apply to every AI coding agent, including Google AI Studio Build agents. They supplement the product documents; they do not replace them.

## Read before acting

- Start with `docs/00_START_HERE.md` and follow its mandatory reading order.
- Read the entire `docs/13_PRODUCT_REQUIREMENTS.md` and `docs/14_UX_AND_USER_FLOWS.md` before UI implementation. Also inspect the single design-system HTML file attached to the active Google AI Studio conversation; if it is not attached, stop and request it.
- Read the architecture, data/API, AI extraction, voice, clinical safety, security/privacy, testing, implementation, repository-readiness, decisions and source documents before selecting technical behaviour.
- Read `AI_STUDIO_MASTER_PROMPT.md` for the staged implementation process.

## Source-of-truth precedence

1. Hackathon guide and `docs/01_HACKATHON_RULES_AND_SCORECARD.md` for event rules and submission constraints.
2. Clinical safety/privacy constraints in `docs/07_CLINICAL_SAFETY_AND_PRIVACY.md` for safety boundaries.
3. Product requirements and acceptance criteria in `docs/13_PRODUCT_REQUIREMENTS.md`.
4. UX behaviours and copy in `docs/14_UX_AND_USER_FLOWS.md`.
5. Data/API contracts in `docs/09_DATA_MODEL_AND_API_CONTRACTS.md`.
6. Architecture and AI/voice specifications in their corresponding documents.
7. The single HTML design-system file attached to the active conversation governs visual implementation. It is the only visual source of truth; do not create or depend on separate token files or design-system specification documents.

If documents conflict, stop and report the conflict. Do not silently invent a resolution. Record the decision after founder approval.

## Product and clinical boundaries

- MedFlow is an intake-support and staff workflow prototype, not an AI doctor.
- Never make AI diagnose, prescribe, assign clinical urgency or workflow priority, determine treatment, clear a patient to wait, or autonomously alter queue priority.
- Workflow priority and patient handling remain under qualified staff control. Staff overrides and priority changes require reasons and auditable events as specified.
- Preserve the original patient narrative. Structured AI facts must point back to source evidence; uncertainty, missing information and conflicting statements must remain explicit.
- An AI failure must not lose, hide, silently downgrade or remove an intake from the queue.
- A patient who may need immediate help must not be forced to complete an online form before reaching a human.
- Use synthetic patient identities, narratives, transcripts and audio only. Never commit real patient information, credentials, tokens, API keys or secrets.
- Do not present the prototype as clinically validated, certified, hospital-ready or authorised for real patient care.

## Implementation discipline

- The approved application framework is **Next.js App Router with TypeScript**. Use Next.js Route Handlers for backend endpoints; do not substitute Vite/plain React, Express or another framework without explicit founder approval.
- Inspect the existing repository and runtime before changing anything. Prove that the intended environment supports the Next.js App Router, Route Handlers, production build and server-side secrets. If it does not, report the blocker and wait for a decision; do not silently change the stack.
- Verify current Google AI Studio Build capabilities and official API documentation against the fixed Next.js architecture before implementation. A React preview is not proof of Next.js support. Do not rely on stale assumptions in drafts or guess Gemini model IDs.
- Keep secrets server-side. Validate all model output against a strict schema before persistence or display. Treat model output as untrusted and non-authoritative.
- Enforce facility/tenant and staff access in backend/database security controls, not merely by hiding UI elements.
- Persist the intake before AI extraction; preserve a usable staff path when AI, transcription, network or storage-dependent services fail.
- Keep code modular, typed, readable, testable and documented. Prefer small components and explicit service boundaries. Avoid unnecessary dependencies and overengineering.
- Do not create fake metrics, synthetic partner logos, fabricated clinical claims, fake test evidence or invented user feedback.
- Do not mark work complete until it runs and passes the relevant documented tests.

## Design-system discipline

- The one HTML file attached to the active Google AI Studio conversation is the complete and sole design-system source of truth.
- Replace the application's existing visual system with the attached HTML's design language. Rebuild every relevant React component to match its layout, typography, colours, spacing, icons, controls, surfaces and states.
- Do not create a separate design-tokens file, extracted CSS token sheet, design-system specification, duplicate HTML reference or parallel visual guide. Keep the implementation styling needed by the app, but derive it directly from the attached HTML.
- Do not iframe the HTML or use screenshots as the app UI. Its demo JavaScript and simulated controls are not production integrations.
- Preserve the product behaviour, accessibility requirements, patient-first mobile experience and staff desktop/tablet usability.

## Change and documentation discipline

- Work in approved milestones. Before each milestone, state scope, impacted files, assumptions and risks.
- After each milestone, run relevant tests, inspect the result and report actual outcomes and remaining gaps.
- Update the README, sprint log, architecture notes, feature status and AI disclosure only with verified facts.
- Keep the repository organised; do not add generated build output, dependency directories, local secrets, audio recordings or raw patient data.


## Founder-approved algorithm update (2026-11-22)

- The attached HTML file is the sole visual source of truth and replaces the previous MedFlow design system. The founder will attach it directly to the Google AI Studio conversation. If it is missing, stop and request the attachment rather than guessing.
- Remove obsolete design-system files and references from the repository. Do not create separate design tokens, extracted CSS token sheets or a new design-system specification.
- The HTML's JavaScript is demo-only. Do not port it into the application.
- Adult TEWS/SATS scoring, clinical classes/time targets, vital-sign scoring and AI red-flag prioritisation shown in the reference are not approved MVP features. Do not implement them.
- The approved algorithm direction is the deterministic Evidence Integrity Engine in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`. It verifies exact source-quote location and provenance, not clinical truth.
- Exact quote match is not semantic validation. No aggregate trust score, diagnosis, urgency score or autonomous priority.
- Preserve the original narrative, AI draft and staff-reviewed copy as separate records. Staff retains all clinical and workflow authority.
- **Database architecture (ADR `D-020`):** Neon PostgreSQL (`pg` + Drizzle ORM + Drizzle Kit) replaces Cloud Firestore as the authoritative application database while Firebase Authentication remains the identity provider. Keep `DATABASE_URL` (runtime) and `DATABASE_URL_UNPOOLED` (migrations) strictly server-only; use `demo-clinic-01`/`DEMO-CLINIC-01` as the sole canonical synthetic facility identifiers; preserve all PostgreSQL composite FKs, immutability triggers, action-to-actor CHECKs, and staff-review consistency constraints; defer `EVIDENCE_HMAC_SECRET` until Milestone 3.
- Milestone 1D phases (1D-1, 1D-2, 1D-3), Milestone 2 (intake/Gemini), and Milestone 3 (Evidence Integrity Engine) each require explicit founder approval before implementation.
