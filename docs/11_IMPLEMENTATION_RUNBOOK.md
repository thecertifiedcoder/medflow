# MedFlow — Hackathon Implementation Runbook

## 1. Operating rule

The sprint-built application code must be created during the official November 22–24 sprint. Product planning documents prepared earlier do not count as implemented product features. Record sprint work and AI contributions transparently.

## 2. Delivery target

Internal target: demoable, end-to-end MVP by Sunday evening, November 22. This is an aggressive target. If time slips, cut features in the order below rather than weakening core reliability or safety.

## 3. Implementation sequence

### Before sprint / planning only
- Confirm team registration before Sunday noon.
- Freeze P0 scope.
- Finalise design-system specification and project docs.
- Create/confirm Firebase and Google AI Studio project access.
- Confirm public GitHub repository ownership and access.
- Prepare synthetic narratives and test checklist.
- Do not prebuild the sprint functionality for judging.

### Sprint Day 1 — Sunday, November 22

**Milestone A: app skeleton and design system**
- Create the application in Google AI Studio Build Mode.
- Apply approved HTML design-system reference and tokens.
- Establish client/server separation and environment secrets.
- Connect Firebase Authentication and Firestore.
- Create facility-scoped data model and security rules.

**Milestone B: vertical slice**
- Build patient typed intake.
- Validate microphone permission, MediaRecorder capture and the transcription API on the target Android browser early; keep the typed path working.
- Persist the intake before AI processing.
- Build staff login and real-time queue.
- Prove a submission appears on another device without refresh.

**Milestone C: AI extraction**
- Integrate server-side Gemini extraction.
- Validate strict schema and source evidence.
- Add loading, success, needs-clarification and failure states.

**Milestone D: voice intake completion**
- Complete MediaRecorder capture and server-side transcription integration.
- Use VERBATIM transcription where the verified endpoint supports it.
- Add transcript edit/confirm and typed fallback.

**Internal gate Sunday evening:** one synthetic patient can complete either typed or voice flow, AI brief is available or safe failure shown, staff sees live item, and staff can review/correct the AI brief, assign workflow priority and see audit entries.

### Sprint Day 2 — Monday, November 23

- Finish nurse workflow, staff confirmation/correction of the AI brief, and audit timeline.
- Complete voice failure states and mobile browser testing.
- Add demo seeding/reset, facility scope and role checks.
- Run core functional/security tests.
- Fix bugs before adding P1 features.
- Deploy a test build.

### Sprint Day 3 — Tuesday, November 24

- Freeze feature scope early enough for regression testing.
- Fix P0 bugs and verify deployment.
- Complete README and source docs.
- Verify public repository and remove secrets.
- Record the 4:50–5:10 video.
- Publish public social post and test in incognito.
- Submit official form before 11:59 PM WAT.

## 4. Scope-cut order

If behind schedule, remove in this order:
1. Advanced analytics and charts.
2. Staff assignment.
3. QR generation (share URL manually).
4. Print/export.
5. Search/filter polish.
6. Additional languages beyond the tested primary path.

Do not cut:
- typed intake;
- patient voice capture and transcript review if the voice flow has been made a P0 commitment;
- server-side secret protection;
- AI schema validation;
- real-time queue;
- staff-controlled priority;
- audit event for priority changes;
- AI failure fallback;
- README, AI disclosure and test evidence.

Voice is an approved P0 requirement and must be tested early. If the Gemini transcription integration fails, troubleshoot the official API/SDK path or evaluate a genuinely functioning alternative transcription route. Never fake live transcription or present a manually entered transcript as if it came from the microphone. Keep typed intake usable while the voice issue is being fixed; disclose any unresolved voice limitation honestly.

## 5. Starting the new Google AI Studio session

The repository is a documentation/design-system baseline, not an existing application scaffold. Start a **new Build Mode session** and import the existing GitHub repository; do not create a replacement repository.

1. Open Google AI Studio and enter **Build** mode.
2. Open the Build **Settings** panel and select **Next.js** as the framework. Next.js is supported in AI Studio; it may not be the default. Do this before asking the agent to initialise the application.
3. From the prompt input's **Add files (+)** menu, choose **Import from GitHub**.
4. Select `thecertifiedcoder/medflow`, branch `main`. The repository is private, so ensure the GitHub connection/GitHub App has access to it. Do not make it public just to import it.
5. Wait for the import to complete. Confirm the project documents and the complete `design-system/` directory are visible. Do not accept a partial import.
6. Open `AI_STUDIO_MASTER_PROMPT.md` in the imported repository and provide its complete contents to the Build agent. The agent must read the whole documentation pack and return the implementation-readiness report described in section 13 of that prompt.
7. Review its report. In particular, check that it selected Next.js, understands that the repo has no application scaffold yet, preserves all existing docs/design files, and has not edited application code.
8. Confirm the planned Firebase/Auth/Firestore approach, server-side secrets, Gemini integration and first implementation milestone before authorising code changes.

Google's official announcement confirms that Build Mode supports Next.js and that the framework is selected from Settings: https://blog.google/innovation-and-ai/technology/developers-tools/full-stack-vibe-coding-google-ai-studio/

**Sprint rule:** Product planning and the AI Studio import/readiness review can happen before the sprint. The implementation code must be created during the official sprint, November 22–24, 2026. On November 21, stop after the readiness review; do not begin application implementation early.

## 6. Working with Google AI Studio

- Give AI Studio the complete documentation pack and HTML design-system files.
- Instruct it to read all documents before editing code.
- Ask for a project map and implementation plan before the first build action.
- Work in milestones; inspect the changed files and run the app after every milestone.
- Ask it to report changed files, assumptions, commands/tests run, failures and next milestone.
- Do not accept “complete” without a working browser test.
- Keep the source repository synchronised and inspect actual Git diffs.
- Update documentation when a technical choice changes; record the reason in the decision log.

## 7. Daily close-out checklist

- [ ] Latest build runs.
- [ ] P0 acceptance tests status recorded.
- [ ] No exposed keys or accidental data.
- [ ] Public repo commits are coherent.
- [ ] Sprint log updated with date and feature status.
- [ ] Known blockers have an owner and workaround.
- [ ] Demo path remains repeatable.


## 8. Updated milestone sequence after Milestone 1B (founder-approved 2026-11-22)

Milestone 1A and Milestone 1B are implemented and verified in AI Studio Preview according to their stop reports. The founder still needs to manually create the synthetic facility and staff profile in Firebase Console and complete the interactive Google Sign-In/authorized queue check. Do not claim those founder-only checks are complete until observed.

### Milestone 1C — New design-system migration (requires separate approval)

- Read `docs/18_DESIGN_SYSTEM_SPEC.md` and the full new `design-system/medflow-design-system.html` plus `design-system/design-tokens.css`.
- Replace the old visual tokens, typography, components and styling with the founder-approved IBM Plex / teal / navy system.
- Preserve the existing Next.js routes, Firebase setup, deployed Firestore rules and staff authorization behaviour.
- Rebuild the reference as accessible React components; do not iframe it or copy its JavaScript demonstrations.
- Do not implement the reference's adult TEWS/SATS score, clinical colour classifications, time targets, vital-sign scoring or AI red-flag prioritisation. Those elements are excluded by D-019.
- Run typecheck, lint, production build and desktop/mobile browser verification. Stop and provide a changed-file report and screenshots of the actual app.
- Do not start Milestone 2 in the same authorization.

### Milestone 2 — Patient intake and server-side Gemini extraction (requires separate approval)

- Implement typed intake and real voice recording/transcription, transcript edit/confirmation and durable intake persistence.
- Follow Starter Tier Option 1B: AI extraction is triggered and persisted only through an authenticated, active, facility-authorised staff session.
- Gemini remains server-side; preserve the strict schema and source-quote requirements.
- Keep original narrative, AI draft and staff-reviewed copy separate.
- Stop before implementing the full Evidence Integrity Engine; report the extraction workflow and test results.

### Milestone 3 — Evidence Integrity Engine (requires separate approval)

- Implement the deterministic algorithm in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`.
- Add exact quote matching, server-derived UTF-16 source spans, field-level evidence states, narrative/draft hashes, HMAC provenance signing and verification.
- Add staff UI for inspecting source matches and resolving unsupported/ambiguous evidence.
- Run the complete synthetic EIE test matrix and stop with a verified report.

No milestone may be silently combined with the next. Each requires its own explicit founder approval and stop report.
