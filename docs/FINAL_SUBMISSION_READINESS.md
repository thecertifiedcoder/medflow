# MedFlow — Final Submission Readiness Checklist

**Last reviewed:** 23 November 2026  
**Competition:** TCC Hackathon 2026  
**Authority:** `docs/01_HACKATHON_RULES_AND_SCORECARD.md` and the participant guide it references.

This checklist separates confirmed repository facts from actions that still require the team.

## Current repository and deployment facts

- [x] Latest audited GitHub commit reported prior to this workspace audit: `369048fe61ee1f02f97cc37c6f80ed579aaa877f` (note: `.git` is not mounted inside the AI Studio container workspace, so commit history must be verified on GitHub / local clone).
- [x] Judge-facing page entry is labelled **Judge Access** (`/demo`) and enters the Clinical Staff workspace (`/staff/queue`).
- [x] `/staff/login` redirects (`307`) to `/demo`; `/staff/admin` redirects (`307`) to `/staff/queue` (verified live on deployed URL and locally).
- [x] Server-side demo-session and staff API authorization code remain intact in the repository.
- [x] `OPENROUTER_API_KEY` is documented in `.env.example` as an optional server-side variable.
- [x] `package.json` declares `"packageManager": "bun@1.4.4"` matching `bun.lock` and uses `"build": "NODE_ENV=production next build --webpack"`.
- [x] `MedFlow_GitHub_Import_Pack.zip` was inspected (`unzip -l`): 705 KB, 33 pre-sprint Nov 21 planning/design-system files, **zero** `.env` or secret files.
- [x] Secret-pattern scan of repository source/docs found **zero** committed private keys, `.env` files, or DB credentials (`firebase-applet-config.json` contains public Firebase Web SDK identifiers only; test files use clearly synthetic placeholder strings).
- [x] Latest local verification checks passed: `bun run typecheck`, `bun run test` (`97` passed, `0` failed, `3` live-Neon DB tests skipped when `DATABASE_URL` is unset in shell), `bun run lint`, and `bun run build` (`next build --webpack`).
- [ ] Local workspace fixes (Vercel HTTP 500 fix via lazy `firebase-admin` loading + `next build --webpack`, plus this packaging/documentation update) must be pushed to GitHub `main` and redeployed to Vercel.
- [ ] Runtime end-to-end behaviour (`POST /api/intakes`, `GET /api/staff/session`, AI extraction) on the redeployed Vercel URL has not yet been re-verified post-fix.
- [ ] Repository is currently private. TCC judges must be able to access the source repository publicly.

## Release blockers

- [ ] Export/push the latest workspace changes (including the `POST /api/intakes` & `GET /api/staff/session` Vercel HTTP 500 fix and documentation updates) to GitHub `main`, redeploy on Vercel, and verify a real synthetic submission + Judge Access session against `https://medflow-seven-tau.vercel.app`.
- [ ] Verify Vercel Production variables: `DATABASE_URL`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (if enabled), `MEDFLOW_DEMO_MODE_ENABLED=true`, `MEDFLOW_DEMO_SESSION_SECRET`, and `NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE=DEMO-CLINIC-01`.
- [ ] Verify patient submission, Neon persistence, AI extraction/fallback, queue visibility, staff actions and audit history on the redeployed Vercel environment.
- [ ] Check Git history on the GitHub clone before switching repository visibility to public (confirm no historical `.env` commits or private exports exist in commit history).
- [ ] Decide whether to delete `MedFlow_GitHub_Import_Pack.zip` (non-secret Nov 21 snapshot containing obsolete `design-system/` files) and `public/assets/aistudio/Paste_*` conversation artifacts before making the repository public.
- [ ] Review Firebase API-key HTTP referrer restrictions and authorised domains for `firebase-applet-config.json` before public release.
- [ ] Capture actual screenshots from the deployed application (`public/` currently has zero runtime app screenshots) and add them to the README.
- [ ] Review the sprint log with the team so contributor names, dates, AI tools and sprint/pre-sprint distinctions match Git history accurately.
- [ ] Decide whether to add a software `LICENSE` file. No `LICENSE` file is currently present; public visibility alone does not grant reuse rights.

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
