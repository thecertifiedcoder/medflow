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

## 5. Working with Google AI Studio

- Give AI Studio the complete documentation pack and HTML design-system files.
- Instruct it to read all documents before editing code.
- Ask for a project map and implementation plan before the first build action.
- Work in milestones; inspect the changed files and run the app after every milestone.
- Ask it to report changed files, assumptions, commands/tests run, failures and next milestone.
- Do not accept “complete” without a working browser test.
- Keep the source repository synchronised and inspect actual Git diffs.
- Update documentation when a technical choice changes; record the reason in the decision log.

## 6. Daily close-out checklist

- [ ] Latest build runs.
- [ ] P0 acceptance tests status recorded.
- [ ] No exposed keys or accidental data.
- [ ] Public repo commits are coherent.
- [ ] Sprint log updated with date and feature status.
- [ ] Known blockers have an owner and workaround.
- [ ] Demo path remains repeatable.
