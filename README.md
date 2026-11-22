# MedFlow

**Working concept:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow.

**Competition:** TCC Hackathon 2026 · **Current status:** Milestone 1A and 1B application foundation, Firebase integration, Firestore rules and staff authorization are implemented and verified in AI Studio Preview. Manual facility/staff seeding and interactive Google Sign-In verification remain outstanding. Patient intake, voice transcription and Gemini extraction are not yet implemented.

> **Safety notice:** This is a hackathon prototype, not a clinically validated medical device or emergency service. Do not use it for real patient care or enter real patient information or audio. Demonstrations must use synthetic data. MedFlow must not diagnose, prescribe, autonomously assign clinical urgency, or tell a patient that it is safe to wait.

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
- [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) — implementation handoff prompt for Google AI Studio.
- [`AGENTS.md`](AGENTS.md) — durable rules for AI agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and documentation conventions.
- [`SECURITY.md`](SECURITY.md) — prototype security and privacy policy.

## Current implementation status

Milestone 1A established the Next.js App Router application, design primitives, strict schemas, environment boundaries and verified Preview build.

Milestone 1B connected the Google AI Studio Starter Tier Firebase project, deployed hardened Firestore rules, implemented Google Sign-In UI and server-side Firebase ID token signature/claim verification, and added staff authorization gates. Preview verification included typecheck, lint, production build, unit/security tests, HTTP checks and unauthenticated Firestore negative probes. Manual creation of the synthetic facility and first staff profile plus interactive Google Sign-In verification remain outstanding.

Still outstanding:
- Manual creation of the synthetic demo facility and first staff profile in Firebase Console.
- Interactive Google Sign-In and authorized staff queue verification with those records.
- Milestone 1C migration of the running React UI to match the attached HTML design system.
- Milestone 2 patient typed/voice intake, transcription and staff-triggered Gemini extraction.
- Milestone 3 Evidence Integrity Engine implementation and verification.

No feature should be described as implemented until it exists in the running application and passes its acceptance tests.

## Approved application stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** React components rebuilt to match the single founder-provided HTML design-system attachment
- **Backend:** Next.js Route Handlers
- **Authentication:** Firebase Authentication (Google Sign-In)
- **Database/realtime:** Cloud Firestore on Google AI Studio Starter Tier, using the explicitly provisioned database ID and hardened Firestore Security Rules
- **Server identity verification:** Firebase Admin Auth `verifyIdToken(token)` with revocation check disabled, because Starter Tier IAM does not permit the required revocation lookup
- **AI:** Server-side Google Gemini API; live model calls are pending API key configuration and smoke tests
- **Deployment target:** A verified Node.js host, with Google Cloud Run as the current candidate

**Starter Tier constraint:** Do not use Firebase Admin Firestore reads/writes, service-account JSON keys or IAM workarounds. Patient intake writes and staff-authorised operations must follow the verified Firestore Web SDK + hardened Security Rules architecture documented in `docs/08_TECHNICAL_ARCHITECTURE.md`.

## Design and algorithm boundaries

The single HTML file attached directly to the Google AI Studio conversation replaces the previous visual system and is the only design reference. Do not create a separate token file or design-system specification. Ignore the HTML's demo JavaScript and do not implement its adult TEWS/SATS scoring UI or other autonomous clinical scoring. The approved algorithm direction is the deterministic Evidence Integrity Engine in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`; it checks exact source quotations and provenance, not clinical truth or urgency.

## Google AI Studio

Use the private GitHub repository `thecertifiedcoder/medflow` and keep GitHub App access scoped to the repository. Follow `docs/11_IMPLEMENTATION_RUNBOOK.md` for the current Build session and milestone instructions. Do not make the repository public merely to import it.

## Hackathon constraints

The hackathon rules and scoring requirements are documented in [`docs/01_HACKATHON_RULES_AND_SCORECARD.md`](docs/01_HACKATHON_RULES_AND_SCORECARD.md). Keep a contemporaneous sprint log and disclose AI assistance. Do not fabricate metrics, clinical validation, partners or user outcomes.

## Commercialisation boundary

The architecture should be sensible for a future commercial product, but the hackathon MVP is not a production clinical system. Real deployment would require clinical governance, validation against an appropriately selected and licensed protocol, privacy/security assessment, operational controls, and applicable Nigerian regulatory review.
