# Agent Instructions for MedFlow

These rules apply to every AI coding agent, including Google AI Studio Build agents. They supplement the product documents; they do not replace them.

## Read before acting

- Start with `docs/00_START_HERE.md` and follow its mandatory reading order.
- Read the entire `docs/13_PRODUCT_REQUIREMENTS.md`, `docs/14_UX_AND_USER_FLOWS.md`, `docs/18_DESIGN_SYSTEM_SPEC.md`, and the complete `design-system/` directory before UI implementation.
- Read the architecture, data/API, AI extraction, voice, clinical safety, security/privacy, testing, implementation, repository-readiness, decisions and source documents before selecting technical behaviour.
- Read `AI_STUDIO_MASTER_PROMPT.md` for the staged implementation process.

## Source-of-truth precedence

1. Hackathon guide and `docs/01_HACKATHON_RULES_AND_SCORECARD.md` for event rules and submission constraints.
2. Clinical safety/privacy constraints in `docs/07_CLINICAL_SAFETY_AND_PRIVACY.md` for safety boundaries.
3. Product requirements and acceptance criteria in `docs/13_PRODUCT_REQUIREMENTS.md`.
4. UX behaviours and copy in `docs/14_UX_AND_USER_FLOWS.md`.
5. Data/API contracts in `docs/09_DATA_MODEL_AND_API_CONTRACTS.md`.
6. Architecture and AI/voice specifications in their corresponding documents.
7. Visual system in `design-system/` plus `docs/18_DESIGN_SYSTEM_SPEC.md`.

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

## Design system discipline

- Rebuild the design reference as accessible, reusable application components. Do not embed the HTML as an iframe or use screenshots as the app UI.
- Preserve the established tokens, typography, icon language, component states and responsive behaviour. Do not introduce a new visual direction or decorative patterns without approval.
- Production controls must work. The reference's simulated controls are not evidence of integrations.
- Preserve mobile-first patient intake and staff-facing desktop/tablet usability.

## Change and documentation discipline

- Work in approved milestones. Before each milestone, state scope, impacted files, assumptions and risks.
- After each milestone, run relevant tests, inspect the result and report actual outcomes and remaining gaps.
- Update the README, sprint log, architecture notes, feature status and AI disclosure only with verified facts.
- Keep the repository organised; do not add generated build output, dependency directories, local secrets, audio recordings or raw patient data.
