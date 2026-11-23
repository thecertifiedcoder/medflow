# MedFlow — Final Submission Readiness Checklist

**Last reviewed:** 23 November 2026  
**Competition:** TCC Hackathon 2026  
**Authority:** `docs/01_HACKATHON_RULES_AND_SCORECARD.md` and the participant guide it references.

This checklist separates confirmed repository facts from actions that still require the team.

## Current repository and deployment facts

- [x] Latest source is on the `main` branch.
- [x] Latest audited application commit: `369048fe61ee1f02f97cc37c6f80ed579aaa877f`.
- [x] Judge-facing page entry is labelled **Judge Access**.
- [x] Judge flow enters the Clinical Staff workspace.
- [x] `/staff/login` redirects to `/demo`.
- [x] `/staff/admin` redirects to `/staff/queue`.
- [x] Server-side demo-session and staff API authorization code remain in the repository.
- [x] `OPENROUTER_API_KEY` is documented in `.env.example` as an optional server-side variable.
- [x] GitHub reports a successful Vercel status for the latest application commit.
- [ ] Runtime behaviour on the deployed Vercel URL has not been independently verified in this review.
- [ ] Repository is currently private. TCC judges must be able to access the source repository publicly.

## Release blockers

- [ ] Resolve the previously reported production `POST /api/intakes` HTTP 500 and verify a real synthetic submission against the deployed URL.
- [ ] Verify Vercel Production variables: `DATABASE_URL`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (if enabled), `MEDFLOW_DEMO_MODE_ENABLED=true`, `MEDFLOW_DEMO_SESSION_SECRET`, and `NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE`.
- [ ] Verify patient submission, Neon persistence, AI extraction/fallback, queue visibility, staff actions and audit history on the deployed environment.
- [ ] Check the current repository and Git history for credentials, private patient content, production exports and unsafe artifacts before changing visibility.
- [ ] Inspect or remove `MedFlow_GitHub_Import_Pack.zip` before public release; its contents were not inspected in this audit.
- [ ] Review Firebase API-key restrictions and authorised domains for the tracked browser configuration before public release.
- [ ] Capture actual screenshots from the deployed application and add them to the README or a dedicated documentation folder.
- [ ] Review the sprint log with the team so contributor names, dates, AI tools and sprint/pre-sprint distinctions are accurate.
- [ ] Decide whether to add a software licence. No `LICENSE` file is currently present; public visibility alone does not grant reuse rights.

## Required TCC submission items

- [ ] Public GitHub repository URL.
- [ ] Public demo video between **4:50 and 5:10**.
- [ ] Video shows the real working application, not slides or mockups alone.
- [ ] Public video post tags Tech Conference Calabar.
- [ ] Public video post includes `#CTCHackathon2026` and `#TechConferenceCalabar`.
- [ ] Video post is tested in an incognito/private browser window.
- [ ] Official submission form URL obtained from the organisers' WhatsApp group.
- [ ] Team lead submits exactly one final form and verifies every submitted link.
- [ ] Team confirms the required event-day attendance.

## Final product test sequence

1. Open `/intake` on a mobile device and submit one synthetic typed intake.
2. Submit a second synthetic intake using voice, edit the transcript and confirm it.
3. Verify the generated reference codes and patient confirmation screens.
4. Confirm both submissions appear in `/staff/queue`.
5. Open each record and inspect original narrative, AI summary, supporting quotations and missing/unclear information.
6. Test staff brief confirmation/correction, priority and workflow changes.
7. Expand activity history and verify the corresponding audit events.
8. Observe or simulate AI provider failure and confirm the intake remains saved and can be retried.
9. Verify Judge Access creates the Clinical Staff session and that refresh/re-entry works.
10. Confirm no administrator or normal staff-login entry is visible in the judge experience.

## Important implementation boundary

Basic exact-substring quote grounding is implemented in the text-extraction service. Advanced Milestone 3 evidence persistence and HMAC provenance are not complete. Do not claim the full advanced EIE specification is implemented.

MedFlow remains a synthetic hackathon prototype, not a clinically validated or real-patient-care system.
