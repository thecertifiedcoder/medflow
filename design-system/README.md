# MedFlow Design System

This directory contains the founder-approved visual design reference for MedFlow.

## Canonical files

- `medflow-design-system.html` — complete standalone HTML reference supplied by the founder. It contains tokens, reusable product CSS, component specimens, patient/staff layout specimens and documentation.
- `design-tokens.css` — extracted reusable product CSS sections 1–4 from the HTML (tokens, base, components and layout). The documentation-only `.ds-*` styles from section 5 are intentionally excluded.

## Authority

The new HTML and extracted CSS replace the previous MedFlow visual system. Read `../docs/18_DESIGN_SYSTEM_SPEC.md` before implementing the reference in React.

The HTML's embedded JavaScript is a local design demonstration. It simulates recording, transcription, patient records, queue updates, TEWS scoring, staff actions and audit events. It is not application code and must not be copied into the Next.js product.

## Clinical algorithm boundary

The reference includes adult TEWS/SATS tables, scoring logic, colour classifications, clinical time targets and override demonstrations. Those elements are not approved MedFlow MVP functionality. Do not implement them as active product behaviour. The approved algorithm direction is the deterministic Evidence Integrity Engine in `../docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`.

The existing product PRD, UX, data contract and clinical safety specification remain authoritative for behaviour and permissions. The design system is authoritative for visual decisions only.

All demonstration data is fictional. Never use real patient information or audio.
