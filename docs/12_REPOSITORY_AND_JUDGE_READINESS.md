# MedFlow — Public Repository and Judge Readiness Standard

## 1. Repository principle

The repository is part of the judged product. A judge or engineer should understand the purpose, architecture, setup, safety boundaries and sprint contribution without asking the team to explain basic details.

## 2. Recommended top-level layout

```text
medflow/
  README.md
  AGENTS.md
  LICENSE
  SECURITY.md
  CONTRIBUTING.md
  .env.example
  docs/
    00_START_HERE.md
    01_HACKATHON_RULES_AND_SCORECARD.md
    02_PRODUCT_DEFINITION.md
    03_HACKATHON_WINNING_STRATEGY.md
    04_MVP_SCOPE_AND_ACCEPTANCE.md
    05_VOICE_INTAKE_SPEC.md
    06_AI_EXTRACTION_SPEC.md
    07_CLINICAL_SAFETY_AND_PRIVACY.md
    08_TECHNICAL_ARCHITECTURE.md
    09_DATA_MODEL_AND_API_CONTRACTS.md
    10_TESTING_AND_DEMO_PLAN.md
    11_IMPLEMENTATION_RUNBOOK.md
    12_REPOSITORY_AND_JUDGE_READINESS.md
    15_DECISIONS_AND_RISKS.md
    16_SOURCES_AND_ATTRIBUTIONS.md
    17_SPRINT_LOG_AND_AI_DISCLOSURE.md
  src/ or generated app structure
  server/ (if generated separately)
  tests/
  public/
```

Adapt to the actual generated app while preserving clear separation of concerns.

## 3. README requirements

README must include:
1. Product name/tagline and concise one-paragraph explanation.
2. Problem and intended users.
3. How MedFlow works (workflow diagram).
4. Differentiation (voice-first capture, editable transcript, evidence-linked brief, nurse-controlled queue).
5. Feature status table: implemented/tested, prototype, planned.
6. Screenshots/GIF of actual app.
7. Live demo link and demo video link.
8. Tech stack and architecture diagram.
9. Local setup and exact commands.
10. Environment variable names and how to configure them (never values/secrets).
11. Test commands and truthful test coverage summary.
12. Security/privacy notes and synthetic-data-only warning.
13. Clinical limitations and statement that it is not for live clinical decision-making.
14. What was built during Nov 22–24 sprint.
15. AI tools used and exactly what each helped with.
16. Contributors/team information.
17. Sources and third-party attributions.
18. Future roadmap.

## 4. Engineering quality gates

- Use descriptive names and small, cohesive modules.
- Keep AI calls and secrets server-side.
- Validate all network input at runtime.
- Keep business logic outside presentation components.
- Avoid duplicate data models and duplicated priority constants.
- Include meaningful loading, empty, error and success states.
- Add accessible labels, keyboard behaviour and visible focus.
- Avoid colour-only status communication.
- Use deterministic sorting and explicit state transitions.
- Add tests for data validation, extraction validation, facility access and priority/audit actions.
- Remove dead code, debug output, fake analytics and placeholder buttons.
- No button may appear functional if it does nothing.
- No mock feature may be described as implemented.

## 5. Security hygiene

Before public release:
- scan for API keys and credentials;
- ensure `.env` and service account files are gitignored;
- confirm `.env.example` contains placeholders only;
- review Firestore rules;
- verify public routes cannot read patient records;
- verify staff endpoints check identity, role and facility;
- verify no raw audio/narrative content is logged;
- use synthetic demo records only;
- document any remaining known security limitation.

## 6. AI disclosure

Disclose tools actually used. Example format (edit to match reality):

| Tool | Use |
|---|---|
| Claude | Product brainstorming, documentation, architecture review and review of the founder-provided HTML design reference |
| Google AI Studio / Gemini | Application code generation, debugging and Gemini API integration |
| Other tools | List only if actually used and explain the contribution |

Do not list a tool that was not used. Do not claim AI generated or tested something it did not.

## 7. Sprint log

Maintain `17_SPRINT_LOG_AND_AI_DISCLOSURE.md` during November 22–24. For each milestone record:
- date/time;
- feature or change;
- files/modules affected;
- contributor/tool assistance;
- tests run and observed outcome;
- unresolved issue.

This log must distinguish planning assets created before the sprint from product functionality built during the sprint.
