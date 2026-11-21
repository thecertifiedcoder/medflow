# MedFlow

**Working concept:** Voice-first, AI-assisted clinical intake with evidence-linked staff review and nurse-controlled patient flow.

**Competition:** TCC Hackathon 2026  
**Repository status:** Documentation and design-system baseline. The application implementation has not yet been added.

> **Safety notice:** This is a hackathon prototype concept, not a clinically validated medical device or emergency service. Do not use it for real patient care or enter real patient information or audio. Demonstrations must use synthetic data. MedFlow must not diagnose, prescribe, autonomously assign clinical urgency, or tell a patient that it is safe to wait.

## Start here

1. Read [`docs/00_START_HERE.md`](docs/00_START_HERE.md) for the project definition, document precedence and complete reading order.
2. Read [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) before asking Google AI Studio to implement the application.
3. Read [`AGENTS.md`](AGENTS.md) for repository-wide rules for AI coding agents and contributors.
4. Review [`design-system/`](design-system/) and [`docs/18_DESIGN_SYSTEM_SPEC.md`](docs/18_DESIGN_SYSTEM_SPEC.md) before implementing UI.

## Product thesis

MedFlow turns a patient's spoken or typed account into an editable transcript and an evidence-linked clinical intake brief. Clinical staff review the original narrative and extracted context, correct it where necessary, and independently assign workflow priority and status. The original patient account remains accessible, uncertainty and missing information remain visible, and meaningful staff actions are auditable.

**Core loop:** Patient speaks or types → transcript is reviewed and confirmed → intake is saved → AI extracts structured context with source evidence → staff reviews/corrects → staff assigns workflow priority/status → actions are audited.

The intended differentiator is not voice capture or a queue by itself. It is the traceable connection between what a patient actually said and the structured information presented to the clinical team.

## Repository map

- [`docs/`](docs/) — hackathon brief, product strategy, requirements, UX, safety, architecture, data contracts, tests, implementation runbook, decisions and references.
- [`design-system/`](design-system/) — standalone HTML design-system reference, companion CSS tokens and visual previews.
- [`AI_STUDIO_MASTER_PROMPT.md`](AI_STUDIO_MASTER_PROMPT.md) — implementation handoff prompt for Google AI Studio.
- [`AGENTS.md`](AGENTS.md) — durable rules for AI agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and documentation conventions.
- [`SECURITY.md`](SECURITY.md) — prototype security and privacy policy.

## Current status

This repository begins with specifications and the visual system. It is **not yet the running MedFlow application**. The HTML design-system page is an interactive local reference only; its recording, transcription, login, queue, review, priority and audit demonstrations are simulations and do not connect to microphone hardware, Gemini, Firebase or a backend.

No feature should be described as implemented until it exists in the running application and passes its acceptance tests. Use the status labels defined in `docs/00_START_HERE.md`.

## Google AI Studio

The repository is currently private. The GitHub account used by Google AI Studio must be authorised and the AI Studio GitHub App must be granted access to this repository. If the repository does not appear in the import picker, check the app's repository permissions rather than making the repository public by default.

After importing, open `AI_STUDIO_MASTER_PROMPT.md` and provide its full contents to the Build agent. The prompt requires the agent to inspect the documents first, report its implementation plan and blockers, and wait for approval before coding.

## Hackathon constraints

The event requirements and scoring are documented in [`docs/01_HACKATHON_RULES_AND_SCORECARD.md`](docs/01_HACKATHON_RULES_AND_SCORECARD.md). Planning and product documentation may predate the official sprint, while submitted implementation work must comply with event rules. Keep a contemporaneous sprint log and disclose AI assistance.

## Commercialisation boundary

The architecture should remain sensible for a future commercial product, but the hackathon MVP is not a production clinical system. Real deployment would require clinical governance, validation against an appropriately selected and licensed protocol, privacy/security assessment, operational controls and applicable Nigerian regulatory review.
