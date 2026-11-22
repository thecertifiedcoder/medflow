# MedFlow — Design System Specification

**Status:** Founder-approved visual source of truth, adopted 2026-11-22  
**Canonical reference:** `design-system/medflow-design-system.html`  
**Product CSS:** `design-system/design-tokens.css`  
**Implementation target:** Existing Next.js App Router application  
**Important:** This document governs visual implementation. Product behaviour, data permissions and clinical safety remain governed by the PRD, UX, data contract and safety specification.

## 1. Source of truth

The founder-approved uploaded file `medflow-design-system (1).html` replaces the previous MedFlow design-system reference in full.

The repository now stores that source at `design-system/medflow-design-system.html`. Its reusable product CSS sections 1–4 (tokens, base, components and layout) are extracted into `design-system/design-tokens.css`. The HTML's section 5 (`.ds-*` documentation-page styling) is not product CSS.

The previous visual system is superseded. Do not retain its former palette, typography, component styling or token names as the active design language. Migrate existing application components to the new system rather than layering both systems together.

## 2. Design philosophy

The product should feel like a dependable clinical instrument: calm under pressure, clear when it matters, structured, restrained and honest about what it knows and who produced each piece of information.

Three qualities must remain balanced:

- **Clinical authority:** precision, consistency, legibility and restrained use of semantic colour.
- **Human warmth:** plain language, approachable patient-facing controls and respectful handling of patient words.
- **Operational clarity:** obvious hierarchy, efficient scanning and visible system states.

The information path is patient words → AI-assisted structuring → deterministic evidence checks → human staff review. The interface must make each source distinguishable. It must never imply that AI or a deterministic software check has made a clinical decision.

## 3. Visual foundations

### 3.1 Typography

- Primary UI typeface: **IBM Plex Sans** (400, 500, 600, 700).
- Monospaced typeface: **IBM Plex Mono** (400, 500, 600), for identifiers, timestamps, technical metadata and numeric data where appropriate.
- Preserve the supplied system fallbacks so the application remains usable if Google Fonts cannot load.
- Use the reference's rem-based type scale, line-height and weight tokens. Do not invent one-off typography values.

### 3.2 Core colour palette

Use the exact tokens in the supplied CSS. The primary visual anchors include:

| Role | Token | Value |
|---|---|---|
| Primary | `--mf-primary` | `#087E8B` |
| Primary dark / text links | `--mf-primary-dark` | `#075E68` |
| Primary tint | `--mf-primary-tint` | `#E3F3F5` |
| Command navy | `--mf-navy-900` | `#0B1D2E` |
| Sidebar navy | `--mf-navy-800` | `#10283D` |
| Canvas | `--mf-canvas` | `#F4F7FA` |
| Surface | `--mf-surface` | `#FFFFFF` |
| Main text | `--mf-text` | `#142536` |
| Secondary text | `--mf-text-secondary` | `#536477` |
| Input boundary | `--mf-border-input` | `#6F8294` |

The CSS also defines semantic status colours and separate source/provenance colours. Use them only with text, iconography and accessible contrast; never communicate meaning through colour alone.

### 3.3 Information provenance

The reference establishes a separate visual axis for who produced information:

- Patient: `data-source="patient"`
- AI-generated draft: `data-source="ai"`
- Deterministic calculation/check: `data-source="calc"`
- Nurse/staff-entered or decided: `data-source="nurse"`

Use these distinctions consistently. For the MVP, `calc` may identify deterministic evidence-integrity checks and technical calculations only. It must not be used to imply an approved clinical score.

### 3.4 Layout and components

Rebuild the reusable `.mf-*` product language as accessible React components. Follow the HTML's sections 1–4 for:

- tokens, resets, typography, focus and reduced motion;
- buttons, fields, segmented controls, badges, chips, banners, cards/panels, evidence panels, tables, queue rows, timelines and dialogs;
- patient-facing layout and staff command layout;
- responsive behaviour, keyboard interaction and live-region patterns.

Use the reference's icon geometry and outlined icon treatment. Adapt the existing `Icon.tsx` abstraction rather than introducing a second icon system without a clear need. Preserve the priority glyphs only if they are used for already-approved non-clinical workflow labels; do not use them to imply SATS/TEWS classifications.

## 4. What to port and what not to port

### Port as visual design

- Core palette, typography, spacing, sizing, borders, radii, focus, shadows and responsive rules.
- Patient intake and staff command-centre layout patterns, adjusted to the canonical routes in `docs/14_UX_AND_USER_FLOWS.md`.
- Patient-source, AI-draft and staff-source presentation.
- Evidence cards, original narrative panels, AI draft panels, missing/unclear states, audit presentation, forms, dialogs and queue components.
- Clear connection, loading, empty, error and unavailable states.
- Accessibility behaviours: visible focus, semantic HTML, keyboard operation, live regions, reduced motion, non-colour status cues and narrow-screen reflow.

### Do not port as active product behaviour

The HTML contains a complete illustrative adult TEWS/SATS experience and JavaScript reference function. Those are not approved MedFlow MVP requirements.

Do not implement or expose:

- TEWS calculation, SATS classification or any derived red/orange/yellow/green clinical class;
- clinical time targets such as immediate, under 10 minutes, under 60 minutes or under 240 minutes;
- vital-sign capture/scoring, triage overrides, clinical queue ordering or any automatic clinical urgency classification;
- AI red-flag scoring, AI-generated emergency classifications or AI-driven queue reordering;
- pediatric scoring or inferred demographic/clinical fields;
- any design-preview simulation as if it were a live application feature.

The supplied scoring function, threshold table, classification badges and time targets remain quarantined as reference material pending separate clinical governance and validation. See Decision D-019 and `docs/07_CLINICAL_SAFETY_AND_PRIVACY.md`.

## 5. Product behaviour remains governed elsewhere

The design reference does not override:

1. `docs/07_CLINICAL_SAFETY_AND_PRIVACY.md` for clinical safety and privacy;
2. `docs/13_PRODUCT_REQUIREMENTS.md` and `docs/04_MVP_SCOPE_AND_ACCEPTANCE.md` for product scope and acceptance;
3. `docs/14_UX_AND_USER_FLOWS.md` for routes, user journeys, states and copy;
4. `docs/09_DATA_MODEL_AND_API_CONTRACTS.md` for persistence and API contracts;
5. `docs/08_TECHNICAL_ARCHITECTURE.md` for the Starter Tier architecture and server/client boundaries.

In particular, workflow priority remains a staff-assigned operational queue label: `unassigned`, `immediate_review`, `priority_review` or `routine_review`. It is not a clinical triage category, validated severity score or treatment-time promise.

The original confirmed patient narrative must remain immutable and visible. AI content is a draft. Staff review/correction is distinct and auditable.

## 6. Implementation rules

- Rebuild the reference in React; do not iframe the HTML or use screenshots as application UI.
- Do not copy the HTML's `<script>` demo logic into the application. It simulates recording, authentication, queue data, scoring and staff actions.
- Do not copy `.ds-*` documentation-page styles into the product stylesheet.
- Use the extracted product CSS as the baseline, then split/organise it into application styles only where that preserves exact token values and behaviour.
- Keep the existing working Next.js routes, Firebase integration and security boundaries. Design migration must not rewrite or bypass authentication, Firestore rules or data contracts.
- Replace old styling and primitives cleanly; do not run two competing token systems.
- Every visible control must perform a real approved action or be visibly non-interactive. No inert controls, fabricated metrics, fake patient records or simulated submissions in the running app.
- Use synthetic patient content only.
- Record any design-to-product conflict before implementation; do not silently implement a clinical feature because it appears in the HTML.

## 7. Migration acceptance criteria

The design migration is complete only when:

- [ ] The old visual tokens and styles are no longer active in application routes.
- [ ] Application routes use the new palette, IBM Plex typography, spacing, component and icon language.
- [ ] Patient intake remains clear and usable on narrow mobile screens.
- [ ] Staff views remain usable at tablet and desktop widths.
- [ ] Patient narrative, AI draft, deterministic evidence check and staff-authored content are visually distinguishable.
- [ ] Loading, empty, error, unavailable, focus and reduced-motion states are implemented.
- [ ] Existing authentication, facility-scoped access and Firestore security behaviour remain intact.
- [ ] No TEWS/SATS calculation, classification, time target, vital-sign scoring or autonomous urgency behaviour is active.
- [ ] Typecheck, lint, production build and responsive/browser checks pass.
- [ ] A screenshot set shows the actual running application, not the HTML demo.

## 8. Next implementation boundary

Milestone 1C is a design-system migration only. It must not start voice intake, patient persistence or Gemini extraction. Those remain in Milestone 2 and later milestones, each requiring separate approval as recorded in the implementation runbook.
