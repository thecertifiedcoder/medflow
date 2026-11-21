# Contributing to MedFlow

This repository is documentation-first until the implementation is created during the official hackathon sprint. Contributors should preserve the approved product and safety boundaries.

## Before making changes

1. Read `docs/00_START_HERE.md` and `AGENTS.md`.
2. Read the documents directly relevant to your change, including their linked dependencies.
3. Check `docs/15_DECISIONS_AND_RISKS.md` for open decisions and constraints.
4. Confirm whether the change is within MVP scope in `docs/04_MVP_SCOPE_AND_ACCEPTANCE.md`.

## Working conventions

- Keep changes focused and easy to review.
- Use descriptive file names and update relative links when files move.
- Do not silently change approved requirements, clinical safety constraints or visual tokens. Record proposed changes and obtain founder approval.
- Do not commit secrets, real patient data/audio, local environment files or generated dependency/build folders.
- Use synthetic data in fixtures, tests, screenshots and demonstrations.
- Add tests for changed behaviour and update the implementation status only after verification.
- Distinguish implementation facts from plans, simulations and assumptions.

## Documentation changes

When updating a requirement, include its rationale, acceptance criteria, dependencies and safety impact. When changing a decision, update the decision log. When adding an external source, include its title, publisher, URL, retrieval date and the specific claim it supports in `docs/16_SOURCES_AND_ATTRIBUTIONS.md`.

## Pull request checklist

- [ ] Relevant product, UX, architecture or safety docs are updated.
- [ ] No clinical authority has been delegated to AI.
- [ ] Original patient narrative and evidence traceability are preserved.
- [ ] Tenant/facility access is enforced outside the UI.
- [ ] Tests and manual verification are recorded accurately.
- [ ] No secrets, real patient data or recordings are included.
- [ ] README, sprint log and AI disclosure reflect verified changes only.
