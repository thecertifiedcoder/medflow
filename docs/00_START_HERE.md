# MedFlow — Documentation Start Here

**Project codename:** MedFlow  
**Working positioning:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow  
**Competition:** TCC Hackathon 2026  
**Documentation status:** Milestone 1B implementation verified in AI Studio Preview; manual facility/staff seeding and interactive Google Sign-In verification remain founder actions. Milestone 2 is not implemented.

## 1. What this project is

MedFlow helps a patient communicate a health concern through typed text or voice, converts that narrative into an editable transcript and an evidence-linked structured intake brief, and gives clinical staff a facility-scoped queue in which they review source information and assign/adjust workflow priority.

**Core product loop:** Patient speaks or types → transcript is reviewed → patient submits → AI extracts structured context → deterministic evidence checks trace claims to the original narrative → staff reviews/corrects → staff assigns workflow priority/status → actions are audited.

MedFlow is not an AI doctor. It does not diagnose, prescribe, independently clear a patient to wait, or autonomously determine clinical urgency. In the MVP, priority is explicitly staff-assigned. AI-extracted cues are prompts for human review, not clinical conclusions.

## 2. Hackathon objective

Build a complete, credible, working end-to-end prototype that demonstrates a specific local workflow advantage. Do not attempt to build a full hospital management system.

The strongest hackathon proposition is:

> MedFlow turns the way patients naturally speak about their symptoms into evidence-linked clinical intake briefs, with deterministic source-traceability checks that show staff where each extracted item came from.

Voice input is a first-class P0 feature, not a decorative extra. Typed entry remains available at every point.

## 3. Mandatory reading order for AI Studio and contributors

1. `01_HACKATHON_RULES_AND_SCORECARD.md`
2. `02_PRODUCT_DEFINITION.md`
3. `03_HACKATHON_WINNING_STRATEGY.md`
4. `13_PRODUCT_REQUIREMENTS.md`
5. `14_UX_AND_USER_FLOWS.md`
6. `04_MVP_SCOPE_AND_ACCEPTANCE.md`
7. `05_VOICE_INTAKE_SPEC.md`
8. `06_AI_EXTRACTION_SPEC.md`
9. `19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`
10. `07_CLINICAL_SAFETY_AND_PRIVACY.md`
11. `08_TECHNICAL_ARCHITECTURE.md`
12. `09_DATA_MODEL_AND_API_CONTRACTS.md`
13. `10_TESTING_AND_DEMO_PLAN.md`
14. `11_IMPLEMENTATION_RUNBOOK.md`
15. `12_REPOSITORY_AND_JUDGE_READINESS.md`
16. `15_DECISIONS_AND_RISKS.md`
17. `16_SOURCES_AND_ATTRIBUTIONS.md`
18. `17_SPRINT_LOG_AND_AI_DISCLOSURE.md`
19. `18_DESIGN_SYSTEM_SPEC.md`

The founder-approved visual source is `design-system/medflow-design-system.html`, with reusable product CSS in `design-system/design-tokens.css`. The HTML is a visual/interaction reference, not a live implementation. The product PRD, UX, data and safety documents govern behaviour.

## 4. Source-of-truth rules

- The hackathon guide is authoritative for dates, eligibility, submission format and scoring.
- The approved product documents are authoritative for scope and user behaviour.
- The clinical safety document overrides any implementation suggestion that would make AI act as a clinician.
- The PRD defines feature requirements and acceptance criteria.
- The UX specification defines screen behaviour, user flows, interaction states and approved UI copy.
- The data/API contract overrides ad hoc data structures in components.
- The new HTML and CSS are authoritative for visual decisions only; they do not approve the TEWS/SATS algorithm or any other clinical behaviour embedded in the demo.
- `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md` defines the approved deterministic algorithm direction.
- If two documents conflict, do not silently choose one. Record the conflict in `15_DECISIONS_AND_RISKS.md` and ask for resolution.
- Never invent completed features, test results, clinical validation, hospital partnerships, user numbers or performance claims.

## 5. Build constraints

- Code submitted for judging must be built during the official sprint, November 22–24, 2026.
- Planning and product documentation can be prepared before the sprint.
- Target: a demonstrable MVP by Sunday evening, November 22.
- Submission deadline: Tuesday, November 24, 2026, 11:59 PM WAT.
- The video must be public and 4:50–5:10 long.
- Public repository and README must identify sprint-built features and disclose AI tools used.
- Use synthetic patient data only in the hackathon demonstration. Do not enter real patient information or real patient audio.

## 6. Current MVP boundary

**P0:** typed intake, voice recording and transcription, transcript editing/confirmation, durable patient submission, staff-triggered server-side Gemini extraction, evidence-linked structured fields, deterministic evidence-integrity checks, real-time staff queue, nurse review/correction, staff-assigned workflow priority/status, audit events, failure-safe submission, synthetic demo data, public deployment and judge-ready documentation.

**P1 only after P0 works:** QR entry, patient search/filter, staff assignment, basic queue metrics, print/share intake summary.

**Out of scope:** diagnosis, prescription, autonomous triage decisions, TEWS/SATS scoring, clinical time targets, full EHR, billing, payments, complex hospital administration, production multi-hospital onboarding, live clinical use and unvalidated clinical scoring protocols.

## 7. Delivery status convention

Every feature in the repository and README must be labelled accurately as one of:

- `Implemented and tested`
- `Implemented, not fully tested`
- `Prototype / simulated`
- `Planned`

Do not mark a feature complete because AI Studio generated code for it. It must work in the running application and pass its acceptance tests.

## 8. Current verified milestone state

Milestone 1A and Milestone 1B have been implemented and verified in the AI Studio Preview according to their stop reports. Firebase Starter Tier project `daring-brace-jw1xt` is connected, hardened Firestore rules are deployed, and unauthenticated security probes passed. Manual creation of the synthetic facility and administrator profile plus interactive Google Sign-In verification remain outstanding. Patient voice/text intake, transcription and Gemini extraction workflows are not yet implemented. Do not describe them as live.
