# MedFlow Design System

**Artifact:** `medflow-design-system.html`  
**Version:** 0.1  
**Status:** First visual design-system draft for the TCC Hackathon 2026 prototype  
**Source of truth:** `docs/13_PRODUCT_REQUIREMENTS.md` and `docs/14_UX_AND_USER_FLOWS.md`

## Contents

- `medflow-design-system.html` — standalone, responsive visual design reference with inline CSS, inline SVG icons and local JavaScript interactions.
- `design-tokens.css` — companion token file for implementation handoff. The HTML has the same tokens inline and does not require this CSS file to render.
- `README.md` — this guide.

## Design philosophy

MedFlow uses a calm, review-first clinical interface system:

1. Patient words remain the source of truth.
2. Voice and typed input are equally visible.
3. AI output is always presented as a draft with source evidence.
4. Unknown or missing information remains explicit.
5. Workflow priority is staff-assigned and is never presented as an AI clinical decision.
6. Patient-facing screens are mobile-first; staff screens are desktop-first and remain usable at tablet widths.
7. Status meaning is conveyed with text and labels, not colour alone.

## Visual foundations

- **UI typography:** system sans-serif stack (`Inter` where available, then native system UI fonts).
- **Display typography:** Georgia/system serif for selected editorial headings.
- **Primary brand colour:** forest green `#176D5C`.
- **Primary ink:** deep green-black `#172C29`.
- **Canvas:** soft neutral `#F3F5F1`.
- **Surface:** white `#FFFFFF`.
- **Semantic colours:** restrained success, information, warning and error tones.
- **Iconography:** inline SVG outline icons. No external icon package is required.

## Preview interactions

The HTML includes design-preview interactions for:

- responsive section navigation;
- patient voice/type mode switching;
- simulated record/stop/transcribe states;
- editable transcript review;
- simulated confirmation flow;
- staff queue search and status filtering;
- switching between synthetic intake examples;
- selecting a staff workflow priority;
- opening a reason dialog and audit timeline.

**Important:** These interactions are local design demonstrations only. They do not capture microphone audio, call Gemini, authenticate staff, persist records, connect to Firebase, enforce clinical workflows or save audit events. They must not be represented as implemented product functionality.

## Clinical and demo safety

- Every example is fictional and is marked as synthetic/demo content.
- The patient notice warns against entering real patient information and directs people who need immediate help to alert hospital staff directly.
- AI information is described as an intake draft, not diagnosis or urgency assessment.
- Priority controls are labelled `Staff-assigned workflow priority`; these labels are not a validated clinical triage scale or treatment-time promise.
- The design system is not for live clinical use.

## Implementation handoff rules

Google AI Studio should:

1. Read `docs/00_START_HERE.md`, `docs/13_PRODUCT_REQUIREMENTS.md` and `docs/14_UX_AND_USER_FLOWS.md` before implementing UI.
2. Treat this HTML as the visual reference, and the Markdown documents as the source of behaviour and acceptance criteria.
3. Reuse token values and component patterns rather than screenshot-copying the page as a single image.
4. Rebuild the UI as accessible, reusable application components.
5. Keep all actions functional in the actual app; do not leave inert buttons from the design reference.
6. Preserve the patient-to-staff flow, failure states, source evidence and human-authority boundaries.
7. Never copy synthetic example records into a live environment as real patient records.
8. Update this documentation if an approved implementation constraint requires a visual-system change.

## Standalone use

Open `medflow-design-system.html` directly in a modern browser. It has no build step and does not require a network connection.

## Visual previews

- `assets/desktop-overview.png` — desktop visual overview.
- `assets/patient-flow-mobile.png` — mobile patient intake reference.
- `assets/staff-console-desktop.png` — desktop staff command-centre reference.

These are screenshots of this design reference, not screenshots of a deployed or integrated MedFlow application.
