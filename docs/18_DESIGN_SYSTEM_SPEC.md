# MedFlow — Design System Specification

**Document ID:** MED-DS-018  
**Version:** 0.1  
**Status:** Visual baseline created for hackathon implementation  
**Visual source of truth:** `design-system/medflow-design-system.html`  
**Companion tokens:** `design-system/design-tokens.css`

## 1. Purpose

This document defines how the HTML design-system reference must be used when implementing MedFlow. The HTML is a visual and interaction reference, not the production application. Its local preview interactions do not establish that authentication, recording, transcription, AI processing, persistence, real-time updates or audit logging have been implemented.

## 2. Design philosophy

MedFlow's interface should make patient communication easier and staff review clearer. Its visual identity is calm, restrained and operational rather than decorative or alarmist.

The system is governed by these principles:

1. **Patient words first:** the confirmed narrative remains the source record and is always distinguishable from AI output.
2. **Voice with an escape hatch:** voice and typed entry are equally visible. Typing remains available through microphone and transcription failure.
3. **Evidence before interpretation:** extracted facts are visibly linked to source phrases; missing/unclear information remains explicit.
4. **Human owns the workflow:** AI output is a draft. Authorised staff own review, workflow priority and status.
5. **Calm, not alarmist:** avoid pulsing/red AI warnings, diagnostic language and visual cues that imply an AI clinical decision.
6. **Density with legibility:** operational information may be dense, but never at the cost of readable text, clear hierarchy or accessible interaction.
7. **Honest states:** the UI accurately distinguishes live, reconnecting, stale, failed, empty, loading and simulated states.

## 3. Visual foundations

### 3.1 Palette

| Token | Value | Intended use |
|---|---|---|
| Deep ink | `#172C29` | Primary text and high-contrast surfaces |
| Ink secondary | `#344742` | Secondary headings and body emphasis |
| Muted | `#66756F` | Supporting text |
| Canvas | `#F3F5F1` | Main page background |
| Surface | `#FFFFFF` | Cards and inputs |
| Surface soft | `#F7F9F6` | Secondary panels and inset regions |
| Forest green | `#176D5C` | Primary action and product brand |
| Forest strong | `#105648` | Hover/pressed primary action |
| Soft mint | `#E3F0EB` | Selected states and quiet brand surfaces |
| Warm accent | `#C78B42` | Small editorial accents only |
| Success | `#26745A` | Confirmed/success states |
| Information | `#356C86` | Informational states |
| Warning | `#98621D` | Needs attention / uncertainty |
| Error | `#A34C42` | Failure and destructive states |

Semantic state meaning must also be communicated through text and/or icon. Never rely on colour alone.

### 3.2 Workflow priority colours

The reference uses subdued visual treatments for the three staff-assigned workflow labels:

- `Immediate review`
- `Priority review`
- `Routine review`
- `Unassigned`

These are queue-organisation labels, not a validated clinical triage scale, not an autonomous risk classification and not a treatment-time promise. Always display the phrase `Staff-assigned workflow priority` or an equivalent contextual label.

### 3.3 Typography

- Interface typography: Inter where available, falling back to the native system UI sans-serif stack.
- Display typography: Georgia or system serif for selected editorial headings only.
- Body text must remain comfortably readable on mobile and staff layouts.
- Use compact typography for metadata, not for patient narratives, evidence quotes or important instructions.

No remote font is required. The HTML must remain usable offline.

### 3.4 Spacing, shape and elevation

Use the token scale in `design-system/design-tokens.css`. Core spacing values: 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64px. Use small radii for controls, medium radii for cards, and larger radii only for major containers. Shadows should be restrained and must not replace borders as the primary grouping mechanism.

### 3.5 Iconography

Use simple outline icons with consistent stroke weight. The standalone HTML provides an inline SVG set. In the application, use a consistent icon library or equivalent SVG assets; do not mix emoji with outline icons in operational controls. Every icon-only control requires an accessible name; text labels are preferred for important patient and staff actions.

## 4. Required application surfaces

The design system demonstrates the visual language for:

### Patient
- Intake start / demo and safety notice.
- Describe concern with equal voice and typing options.
- Recording state and explicit start/stop/cancel controls.
- Transcript review, edit and confirmation.
- Submission progress and confirmation/reference.
- Microphone permission, unsupported browser, transcription failure and typed fallback states.

### Staff
- Staff login visual reference.
- Clinical command queue.
- Queue rows and extraction/workflow status labels.
- Intake detail with confirmed source narrative beside AI draft.
- Evidence-linked facts and missing/unclear items.
- Staff review and correction.
- Staff-assigned workflow priority and status actions.
- Audit timeline.
- Loading, empty, reconnecting, offline, error and unauthorised states.

## 5. Interaction and component rules

- All primary actions in the actual app must work; never ship inert controls.
- Use persistent, visible focus states and semantic form labels.
- Preserve patient-entered text through retryable failures.
- Ask for microphone permission only after an explicit user action.
- Show a visible recording state, elapsed time and stop/cancel controls.
- Patient must inspect and confirm the final transcript/narrative before submission.
- Do not block patient confirmation on downstream AI extraction.
- Original narrative, raw transcript, AI draft and staff-reviewed copy are distinct data concepts.
- Staff priority changes and review corrections must go through authorised data operations and create audit events.
- In a stale or disconnected state, never display `Live`.
- Respect `prefers-reduced-motion`; do not use flashing or pulsing AI-generated warning effects.

## 6. Responsive rules

- Patient UI is mobile-first and single-column.
- Primary touch controls must be easy to use on a narrow Android device.
- Voice controls and primary actions must not require horizontal scrolling.
- The staff dashboard is desktop-first, with a split queue/detail layout where space permits.
- On tablet or narrow layouts, staff queue and detail may become sequential views or a drawer.
- Do not preserve dashboard density by shrinking text below comfortable readability.

## 7. Accessibility baseline

- Semantic headings, buttons, labels, inputs and status announcements.
- Programmatically associated labels and inline errors.
- Visible keyboard focus.
- Textual recording state (not colour or animation alone).
- Adequate contrast for text and status treatments.
- Reduced-motion support.
- No autoplay audio.
- No important information available only on hover.

## 8. Design preview limitation

The HTML includes simulated patient and staff interactions to communicate visual state transitions. Specifically:

- voice recording is simulated; no microphone is accessed;
- transcription is simulated using fixed synthetic sample text;
- intake confirmation is simulated; no database write occurs;
- staff authentication is a visual reference only;
- queue search and record selection are local browser interactions;
- priority selection/reason confirmation is a local preview and does not persist;
- audit reveal displays illustrative synthetic events only;
- no Gemini API or Firebase connection exists in the design artifact.

The implementation and README must not claim any of these as implemented product functionality until separately built and tested.

## 9. Source-of-truth precedence

- `13_PRODUCT_REQUIREMENTS.md` defines feature requirements and acceptance criteria.
- `14_UX_AND_USER_FLOWS.md` defines screen behaviour, content, states and user journeys.
- `07_CLINICAL_SAFETY_AND_PRIVACY.md` overrides any design that could imply autonomous clinical decision-making or unsafe patient behaviour.
- `09_DATA_MODEL_AND_API_CONTRACTS.md` defines source/AI/staff-reviewed data separation.
- `medflow-design-system.html` defines the visual treatment and reusable component patterns.
- `design-tokens.css` provides a companion copy of the visual tokens for application implementation.

If a visual pattern conflicts with the PRD, UX, data contract or safety document, the product requirements govern. Record and resolve the conflict rather than silently changing product behaviour.

## 10. Approval note

This is design-system version 0.1. It is a first visual baseline created for the TCC Hackathon 2026 prototype. Final implementation may refine spacing or component details after validation on the target phone and staff viewport, but must preserve the product and safety principles above.
