# MedFlow — Product Requirements Document (PRD)

**Document ID:** MED-PRD-013  
**Version:** 0.1  
**Status:** Hackathon scope baseline — requires founder sign-off before implementation  
**Last updated:** 2026-11-21  
**Competition:** TCC Hackathon 2026  
**Product codename:** MedFlow (working name; not cleared for commercial brand use)

---

## 1. Executive summary

MedFlow is a voice-first, AI-assisted clinical intake and nurse-controlled patient-flow prototype. It lets a patient describe a health concern in their own words by typing or speaking. A spoken submission is transcribed into editable text and must be reviewed and confirmed by the patient before submission. After the intake is saved, Gemini extracts structured information from the confirmed narrative and produces an evidence-linked clinical intake brief. Authorised clinical staff review the original narrative alongside the AI-generated draft, make corrections where needed, and assign a staff-controlled workflow priority and status. Important staff actions are recorded in an audit trail.

The product is designed around one narrow workflow: **turn a patient's natural-language account into a traceable, reviewable intake record that is visible to staff in a live queue.**

MedFlow is not an AI doctor, a diagnosis tool, an emergency service, a validated triage protocol, or a complete hospital management system. The hackathon build uses synthetic data only and must not be used for live patient care.

## 2. Product definition

### 2.1 Product category

AI-assisted clinical intake and patient-flow software.

### 2.2 Positioning

A voice-first clinical intake layer that turns patient narratives into evidence-linked information for healthcare staff to review and manage within a live patient-flow queue.

### 2.3 Core value proposition

- **For patients:** describe a concern in ordinary language using voice or text, review the transcript and submit without navigating a long clinical form.
- **For nurses and clinical staff:** receive an organised draft that preserves the patient's original words, identifies explicit details and unknowns, and reduces the effort of converting a free-form account into a structured intake.
- **For hospital operators:** see incoming intake records and staff-owned workflow status in one facility-scoped queue, with a record of important changes.

### 2.4 Product loop

1. Patient opens the configured intake link.
2. Patient sees the demo/safety notice.
3. Patient chooses typed or voice input.
4. For voice, the browser captures a short recording and the server returns a verbatim transcript draft.
5. Patient reviews, edits and confirms the final narrative.
6. Server creates the intake record before AI extraction.
7. Gemini extracts structured context from the confirmed narrative.
8. The extraction is validated and attached to the intake, or marked unavailable/needs clarification.
9. The intake appears in the authenticated staff queue regardless of AI status.
10. Staff reviews the original narrative and AI draft, then confirms or corrects the structured brief.
11. Authorised staff assigns or changes workflow priority/status; important actions are audited.

## 3. Problem statement and assumptions

### 3.1 Problem hypothesis

During patient arrival and initial intake, patients may describe symptoms in everyday language rather than structured clinical terminology. Staff may need to clarify, interpret and manually organise that account while also managing incoming patients. Paper-based or disconnected intake steps can make the original patient account, structured information and queue state difficult to keep together.

### 3.2 Problem statement for the hackathon

**How might we help a patient communicate a health concern naturally, and help clinical staff turn that account into a traceable, reviewable intake record without handing clinical decisions to AI?**

### 3.3 What is known versus what remains a hypothesis

- The hackathon theme requires a locally grounded problem with relevance to Calabar, Cross River State or Nigeria.
- Nigerian healthcare and clinical workflow references can provide context, but the current research does not prove that every Nigerian hospital has the same intake bottleneck.
- Claims about waiting-room mortality, nurse workload, time savings, transcription accuracy, hospital adoption or clinical outcomes are not established by this prototype.
- We have not completed direct discovery interviews with local patients, nurses, triage staff or hospital administrators. These remain validation tasks.

Do not state unsupported prevalence, mortality, productivity or market-size figures in the UI, README, video or pitch.

## 4. Goals and non-goals

### 4.1 Hackathon goals

1. Demonstrate a complete patient-to-staff intake workflow.
2. Make voice and typed input equally valid entry paths.
3. Let the patient inspect and correct a transcript before submitting it.
4. Show how Gemini converts confirmed text into structured, source-linked information.
5. Keep original patient wording available beside AI output.
6. Ensure the AI cannot assign workflow priority, diagnose, prescribe or tell a patient to wait.
7. Ensure every intake remains visible to staff if transcription or AI extraction fails.
8. Provide a real-time, facility-scoped staff queue.
9. Allow authorised staff to review/correct the structured brief and assign workflow priority/status.
10. Record important review and workflow actions in an audit trail.
11. Produce a deployed, testable prototype and a public, judge-ready repository.

### 4.2 Not goals for the hackathon MVP

- AI diagnosis, treatment, prescription or prognosis.
- Autonomous clinical triage, clinical risk scoring or a `safe to wait` decision.
- SATS, TEWS or another protocol implemented from memory or without appropriate clinical governance and commercial rights.
- Real patient care, clinical efficacy evaluation or a live hospital pilot.
- Full EHR/EMR, billing, pharmacy, laboratory, insurance, appointments or payments.
- Production-grade multi-hospital onboarding or a complete hospital administration console.
- Offline-first synchronization.
- Persistent storage of raw voice recordings.
- AI-generated medical recommendations or treatment instructions.

## 5. Target users and roles

### 5.1 Patient / intake submitter

- May be unfamiliar with clinical terminology.
- May be using a mobile device.
- May prefer speaking to typing.
- Needs a short, clear form and visible confirmation.
- Must be able to correct speech transcription before submission.

### 5.2 Nurse / clinical intake staff

- Needs a current queue of incoming intake records.
- Needs to compare original patient wording with AI-extracted information.
- Needs to correct inaccurate or unsupported extraction.
- Owns workflow priority and intake workflow status.

### 5.3 Doctor / authorised clinical reviewer

- Needs to review the same source and structured brief.
- May confirm/correct the intake information and update permitted workflow fields.
- Does not receive an AI diagnosis or AI-assigned urgency.

### 5.4 Demo administrator

- Configures/provisions the single demo facility and staff accounts outside the public patient flow.
- May reset clearly labelled synthetic demo data where the implementation supports a protected reset action.
- Full staff management, billing and facility onboarding are out of scope.

### 5.5 Hackathon build assumptions

- The MVP demonstrates one preconfigured facility.
- Staff users are provisioned through the chosen Firebase setup; public users cannot self-assign staff roles.
- Patient intake can be opened without staff authentication, but public users cannot list, read or modify existing intakes.
- Demo records and test identities are fictional.

## 6. Product principles

1. **Patient words first:** preserve the confirmed narrative as the source record; AI must not silently rewrite it.
2. **Voice with an escape hatch:** typing is always available; microphone denial or transcription failure must not block intake.
3. **Evidence before interpretation:** each extracted fact should link to a phrase in the confirmed narrative or be marked unclear.
4. **Unknown means unknown:** missing information is never silently converted into a negative finding.
5. **Human owns workflow decisions:** AI does not set priority, status or clinical disposition.
6. **Fail visible, fail safe:** failure states are explicit; saved intake remains visible.
7. **Minimum data:** collect only the information required for this workflow and synthetic demonstration.
8. **No fake credibility:** no invented metrics, hospital logos, partnerships, certifications, clinical validation or testimonials.
9. **Demonstrable quality:** each feature has acceptance criteria and must work in the running application before being marked complete.

## 7. Hackathon MVP scope

### 7.1 P0 — required for the end-to-end demonstration

| ID | Capability | Requirement summary |
|---|---|---|
| P0-01 | Patient entry | Public intake route for one configured demo facility, with clear prototype notice. |
| P0-02 | Minimal patient context | Optional display name/alias and optional age; no unnecessary identity or demographic fields. |
| P0-03 | Typed narrative | Patient can enter a concern manually. |
| P0-04 | Voice recording | Patient can request microphone permission, record up to 90 seconds, stop/cancel and upload for transcription. |
| P0-05 | Transcript review | Patient can edit, re-record or retry; only confirmed text is submitted. |
| P0-06 | Intake persistence | Server validates and creates the intake before AI extraction. |
| P0-07 | AI extraction | Gemini returns a validated structured intake brief grounded in the confirmed narrative. |
| P0-08 | Failure-safe extraction | Intake remains queued if AI fails, returns invalid output or times out. |
| P0-09 | Staff authentication | Dashboard requires authenticated, provisioned staff access. |
| P0-10 | Live queue | New submissions appear without a manual page refresh. |
| P0-11 | Intake detail | Staff can see original narrative, AI brief, extraction state and timestamps. |
| P0-12 | Staff review/correction | Staff can confirm the extraction or save a corrected staff-reviewed copy without overwriting the original AI output. |
| P0-13 | Workflow priority | Staff can assign/change workflow priority; AI cannot. |
| P0-14 | Workflow status | Staff can update the intake workflow through allowed transitions. |
| P0-15 | Audit | Important actions record actor, timestamp, action, old/new value and reason where required. |
| P0-16 | Synthetic demo data | Clearly fictional records and a protected predictable demo reset if feasible. |
| P0-17 | Resilience and security | Typed fallback, error handling, secret protection, facility scoping and access controls. |
| P0-18 | Judge readiness | Public repository, honest README, documented setup, test evidence, sprint log, AI disclosure and deployed demo. |

### 7.2 P1 — only after all P0 acceptance tests pass

- QR code for the public intake URL.
- Search and simple queue filters.
- Assign a staff owner to a case.
- Print/export the intake brief.
- Basic live queue counts derived from current records.
- Queue-age indicator showing elapsed time only, without a clinical response-time promise.
- Improved language-selection controls if the speech pipeline supports them reliably.

### 7.3 P2 — future roadmap, not hackathon scope

- Multi-facility commercial onboarding.
- Integration with existing hospital information systems and EMRs.
- Offline-first capture and synchronization.
- Additional language and voice support with measured evaluation.
- Clinician-approved configurable protocols and formal clinical governance.
- Advanced analytics, operational reporting and role administration.
- Formal privacy, security, regulatory and clinical validation for deployment.

## 8. Functional requirements and acceptance criteria

### FR-01 — Prototype notice and patient entry

**Requirement:** The patient intake page explains that the hackathon build is a synthetic-data demonstration, not an emergency service or diagnostic tool. It instructs a person needing urgent help to alert hospital staff directly and not wait for the form or AI response.

**Acceptance criteria:**
- Notice is visible before the patient submits information.
- The patient is not asked to enter real patient information.
- There is no AI-generated reassurance or instruction to wait.
- The notice does not invent a local emergency phone number.

### FR-02 — Minimal patient context

**Requirement:** Patient may provide a display name/alias and age if useful to the demonstration. These are optional. A generated reference code identifies the intake if the user leaves them blank.

**Acceptance criteria:**
- No national identity number, address, insurance number, next-of-kin or unrelated medical history is requested.
- Optional fields can be left blank.
- The staff queue remains usable with a generated reference only.

### FR-03 — Typed intake

**Requirement:** Patient can enter the concern in a text field using ordinary language.

**Acceptance criteria:**
- Empty narrative cannot be submitted.
- Length limits are clear and validated client-side and server-side.
- Switching between typed and voice modes does not silently discard existing text.
- Text is preserved on recoverable errors where possible.

### FR-04 — Voice recording

**Requirement:** Patient can record a short spoken narrative using browser audio capture.

**Acceptance criteria:**
- Microphone permission is requested only after an explicit user action.
- UI clearly displays idle, permission request, recording, stopped, uploading/transcribing and failure states.
- Recording has visible elapsed time and a 90-second maximum.
- Patient can stop or cancel.
- Unsupported browser, denied permission and recorder errors expose typed fallback.
- Audio upload is size- and type-validated on the server.
- Raw audio is not persisted after transcription and is not written to logs.

### FR-05 — Transcript review and confirmation

**Requirement:** A returned transcript is displayed as editable text. Patient can edit, re-record or retry. The patient explicitly confirms the final narrative before submission.

**Acceptance criteria:**
- Transcript is not submitted automatically after generation.
- A clear confirmation action is required.
- The final narrative and input mode are persisted separately from the raw transcript draft where applicable.
- If the transcript is blank or clearly unusable, the patient is asked to re-record or type.
- The patient can abandon the recording and type instead.

### FR-06 — Create intake before AI processing

**Requirement:** The confirmed patient narrative is persisted before Gemini extraction begins.

**Acceptance criteria:**
- A successful patient submission receives a unique intake reference.
- The server, not the public client, supplies trusted ID, timestamps, facility scope and processing states.
- Duplicate submissions caused by a retry are controlled using an idempotency mechanism.
- AI failure does not roll back or hide the intake.

### FR-07 — Structured AI extraction

**Requirement:** Gemini extracts a concise chief concern, explicitly reported symptoms, onset/duration, stated severity, explicitly reported context, unclear/missing information, relevant quoted details for staff review, language when supported, and a clinician-facing summary.

**Acceptance criteria:**
- Response validates against the versioned schema.
- Every quoted source phrase is present in the confirmed narrative or is marked unclear without a fabricated quote.
- AI output contains no diagnosis, prescription, treatment, prognosis, priority, triage colour, urgency score or safe-to-wait property.
- Missing information remains missing.
- The original narrative remains visible and unchanged.
- AI output is labelled as an unconfirmed draft until staff review.

### FR-08 — AI extraction failure handling

**Requirement:** The patient submission remains available if extraction fails.

**Acceptance criteria:**
- `aiStatus` clearly indicates queued, processing, succeeded, failed or needs-human-clarification.
- The case appears in the queue in all states.
- Staff can read the original confirmed narrative when the AI brief is unavailable.
- Error shown to users is safe and understandable; provider stack traces are not exposed.
- Retries are bounded and do not create duplicate intake records.

### FR-09 — Staff authentication and facility scope

**Requirement:** Staff dashboard is available only to authenticated, provisioned staff accounts and all intake queries are scoped to the staff member's permitted facility.

**Acceptance criteria:**
- Unauthenticated users cannot access queue or intake detail routes.
- Public patient routes can create an intake only for the configured public facility; they cannot query prior submissions.
- Public clients cannot set their own role, facility assignment, workflow priority, AI status or audit records.
- Cross-facility and cross-intake access is denied by rules/server authorisation, not merely hidden in UI.

### FR-10 — Real-time staff queue

**Requirement:** Staff see new intake records and workflow changes without manually refreshing the page.

**Acceptance criteria:**
- On a stable test network, a newly submitted intake appears in a second signed-in browser within five seconds in the demo environment.
- Queue displays reference, submission time, input mode, extraction state, staff-assigned priority and workflow status.
- The default new intake is visibly unassigned and awaiting staff review.
- Unreviewed records are not hidden or moved below routine items because AI is missing or failed.
- Queue can be used at common desktop widths and remains usable on a tablet-sized viewport.

### FR-11 — Queue ordering

**Requirement:** Queue order is deterministic and transparent.

**Default ordering:**
1. Unassigned / awaiting staff review.
2. Staff-assigned `Immediate review`.
3. Staff-assigned `Priority review`.
4. Staff-assigned `Routine review`.
5. Within each group, oldest submission first.

This is a product workflow ordering rule only. It is not a clinical triage protocol, a treatment-time guarantee or a statement that a patient is safe to wait. Staff may inspect the full queue at all times.

### FR-12 — Intake detail and evidence view

**Requirement:** Staff can inspect the confirmed source narrative and AI-generated brief together.

**Acceptance criteria:**
- Original confirmed narrative is prominent and cannot be overwritten by AI output.
- Extracted facts display certainty and source quotes where available.
- Missing/unclear information is visibly distinct from explicit information.
- AI-generated content has a persistent `AI draft — requires staff review` label until reviewed.
- AI processing failure does not remove the original narrative.

### FR-13 — Staff review and correction

**Requirement:** Authorised staff can confirm the AI brief as acceptable for the intake workflow or save corrections as a separate staff-reviewed copy.

**Acceptance criteria:**
- Original `aiBrief` remains preserved.
- Corrected/confirmed content is stored separately as `staffReviewedBrief` or an equivalent versioned review object.
- A correction requires a short reason/note.
- UI distinguishes AI-generated content from staff-reviewed content.
- Audit event records reviewer, timestamp and whether the brief was confirmed or corrected.
- Staff corrections do not create an AI diagnosis or clinical recommendation.

### FR-14 — Staff-assigned workflow priority

**Requirement:** Authorised staff may assign one of the workflow labels `Immediate review`, `Priority review` or `Routine review`; default is `Unassigned`.

**Acceptance criteria:**
- Interface says `Staff-assigned workflow priority`.
- Priority is never represented as AI-determined.
- A reason is required when changing an existing assignment.
- Actor, timestamp, previous value, new value and reason are audited.
- UI makes clear these are prototype workflow labels, not validated clinical categories or treatment-time promises.

### FR-15 — Workflow status

**Requirement:** Staff may move the intake workflow through the allowed states `New`, `In review`, `Awaiting clarification` and `Completed`.

**Allowed transitions:**
- `New` → `In review`
- `New` → `Awaiting clarification`
- `In review` → `Awaiting clarification`
- `In review` → `Completed`
- `Awaiting clarification` → `In review`
- `Awaiting clarification` → `Completed`

`Completed` means the intake workflow record is complete; it does not mean the patient was treated, discharged or medically cleared.

**Acceptance criteria:**
- Invalid transitions are rejected by the trusted data layer.
- Important status changes are audited.
- Completed items remain available in the appropriate history view or demo query; they are not silently deleted.

### FR-16 — Audit history

**Requirement:** The intake detail view exposes a chronological timeline of important events.

**Acceptance criteria:**
- Events include intake creation, AI completion/failure, staff review, brief correction, priority assignment/change and status change.
- Each staff event contains actor ID/display name where available, timestamp, action, and relevant old/new values.
- A reason is recorded for priority changes and brief corrections.
- Ordinary staff clients cannot edit/delete prior audit events.
- Audit metadata does not duplicate entire patient narratives or raw audio.

### FR-17 — Empty, loading and failure states

**Requirement:** Every major flow communicates current state and next available action.

**Acceptance criteria:**
- Patient intake shows saving, submitted and failure states distinctly.
- Voice states are defined in `14_UX_AND_USER_FLOWS.md`.
- Staff queue has loading, empty, populated, reconnecting and error states.
- A stale/failed real-time connection is not presented as a live queue.
- All actionable error states provide a safe retry or typed/manual fallback where possible.

### FR-18 — Demo data and demo reset

**Requirement:** The demo uses fictional data and clearly labels it.

**Acceptance criteria:**
- Every seeded example is marked `DEMO DATA` in staff UI.
- Synthetic data is not represented as an actual patient or outcome.
- A reset action, if included, is staff-protected and cannot delete arbitrary records.
- Demo reset behaviour is documented and tested.

### FR-19 — Deployment and repository readiness

**Requirement:** The project is deployable and independently understandable by judges.

**Acceptance criteria:**
- Public repository contains complete README and setup instructions.
- `.env.example` uses placeholders only; no secret is committed.
- Architecture and data flow are documented.
- Tests and actual results are documented.
- Sprint-built features are distinguished from planning assets and pre-existing files.
- AI tools and their actual use are disclosed.
- Public demo URL and video URL are verified in an incognito/private browser before submission.

## 9. Core data concepts

The implementation must follow `09_DATA_MODEL_AND_API_CONTRACTS.md`. The following concepts are separate and must not be collapsed into one field:

- `transcriptRaw`: transcript returned by the speech service, if voice was used.
- `confirmedNarrative`: final patient-confirmed or patient-typed source narrative.
- `aiBrief`: original validated AI extraction draft.
- `staffReviewedBrief`: optional staff-confirmed or staff-corrected copy.
- `aiStatus`: extraction processing state.
- `staffAssignedPriority`: staff-owned workflow ordering value.
- `workflowStatus`: staff-owned intake workflow state.
- `auditEvents`: append-only history of important operations.

Never overwrite source narrative with AI or staff edits. Never put a clinical decision in the AI extraction field.

## 10. Non-functional requirements

### 10.1 Reliability

- Submission must persist before AI extraction.
- Retry operations must not create duplicate records.
- Real-time listener failures must be visible.
- AI failure cannot remove or hide a patient submission.

### 10.2 Performance

- Patient pages should load quickly on a typical modern mobile browser.
- Voice upload must show progress and avoid duplicate requests.
- Queue should update within the five-second demo acceptance target on a stable test network.
- Avoid unnecessary polling where a supported real-time listener is available.
- Do not claim a universal latency SLA based on one demo test.

### 10.3 Security and privacy

- Use synthetic data only in hackathon testing and public demos.
- Do not collect unnecessary personal identifiers.
- Keep Gemini credentials server-side.
- Enforce authentication, role and facility scope in trusted rules/server logic.
- Do not persist raw audio or log sensitive narrative/audio content.
- Public intake must not expose other patient records.
- Review repository history for secrets before making it public.

### 10.4 Accessibility and usability

- Controls have visible labels and clear focus states.
- Recording state is communicated in text and visual form; do not rely on colour or animation alone.
- Touch targets are comfortably usable on mobile.
- Form errors identify the field and corrective action.
- The workflow supports keyboard navigation on staff screens.
- Respect reduced-motion settings.

### 10.5 Maintainability

- Keep UI, AI service, validation, persistence and access-control concerns separated.
- Use typed interfaces and runtime validation at trust boundaries.
- Keep schema versions explicit.
- Document environment variables and setup.
- Avoid decorative dependencies and dead code.

## 11. Analytics and success measures

The hackathon MVP should measure only product-operation facts that can be computed accurately from synthetic demo data. Do not invent impact metrics.

Acceptable prototype measures:
- Number of synthetic intakes created during a demo session.
- Voice versus typed input count within the demo dataset.
- AI extraction success/failure count in the demo test run.
- Staff-reviewed versus awaiting-review demo records.
- Observed queue update time during the documented test environment.

Do not infer clinical improvement, saved lives, reduced mortality, faster treatment, nurse productivity gains or diagnostic accuracy from these measures.

## 12. Release gates

### Gate A — patient intake

- Typed path works.
- Voice path records/transcribes on the selected demo device/browser.
- Transcript is editable and confirmed before submission.
- Typed fallback works when voice is unavailable.

### Gate B — AI processing

- Valid structured output passes schema validation.
- Quotes are grounded in confirmed narrative.
- AI output cannot assign priority/status or provide diagnosis/treatment.
- AI failure leaves the intake visible.

### Gate C — staff workflow

- Staff authentication works.
- Facility scope is enforced.
- Real-time queue updates.
- Staff can review/correct brief, assign priority and update status.
- Audit history is visible and protected.

### Gate D — judge readiness

- Public repository is safe to inspect.
- README setup is reproducible.
- Sprint log and AI disclosure are truthful.
- Demo uses synthetic data.
- Deployed app and video post links work in an incognito/private browser.
- Video is 4:50–5:10 and publicly accessible.

## 13. Open questions / approval items

These issues must be resolved during technical and design planning without blocking the MVP unnecessarily:

1. Exact final product name and trademark/domain clearance — MedFlow remains a codename.
2. Final Gemini audio endpoint/model, SDK, quotas and account access — verify in the actual project before coding voice integration.
3. Final Firebase client/server division and Firestore rules — verify in AI Studio Build/Preview.
4. Whether the staff-reviewed brief is implemented as a full editable structured copy or a smaller correction form — default recommendation: editable brief copy with original AI output preserved.
5. Target demo device/browser for voice testing — select one and validate early.
6. Exact permitted staff role actions — keep P0 simple: provisioned nurse/doctor accounts can review, correct, assign workflow priority and status.

## 14. Traceability

| Requirement area | Primary source document |
|---|---|
| Competition rules and scorecard | `01_HACKATHON_RULES_AND_SCORECARD.md` |
| Product identity and strategy | `02_PRODUCT_DEFINITION.md` |
| MVP scope and P0/P1 boundaries | `04_MVP_SCOPE_AND_ACCEPTANCE.md` |
| Voice capture and transcript states | `05_VOICE_INTAKE_SPEC.md` |
| AI extraction schema and boundaries | `06_AI_EXTRACTION_SPEC.md` |
| Clinical safety and privacy | `07_CLINICAL_SAFETY_AND_PRIVACY.md` |
| System architecture | `08_TECHNICAL_ARCHITECTURE.md` |
| Data fields and API contracts | `09_DATA_MODEL_AND_API_CONTRACTS.md` |
| QA and demo tests | `10_TESTING_AND_DEMO_PLAN.md` |
| Build sequence | `11_IMPLEMENTATION_RUNBOOK.md` |
| Repository/readme/judges | `12_REPOSITORY_AND_JUDGE_READINESS.md` |
| Screen behaviour and interaction states | `14_UX_AND_USER_FLOWS.md` |


---

## 15. Founder-approved product amendment — Evidence Integrity Engine (2026-11-22)

The product's core differentiator is strengthened from source-quoted AI extraction to **deterministic evidence provenance checks**.

### 15.1 Product requirement

MedFlow must not merely display an AI-generated summary. For each evidence-bearing extracted item, the application must show the source quotation and the result of a deterministic check against the immutable patient-confirmed narrative. The check is performed by trusted server code after Gemini output passes strict schema validation.

### 15.2 Required behaviour

- The server, not Gemini, determines whether a quote is present, absent, unmatched or ambiguous.
- Exact unique matches receive server-derived source spans.
- Missing, unmatched and ambiguous evidence remains visibly unresolved for staff review.
- Provenance is bound to the exact narrative and validated draft using server-generated hashes and an HMAC-SHA-256 signature.
- Staff must review the original narrative and AI draft and may confirm or correct the draft. The original narrative and original AI output remain preserved.
- No aggregate confidence score or single trust score is displayed.

### 15.3 Explicit limitation

The engine verifies quote location and provenance mechanics only. It does not establish that a quotation semantically supports the AI's interpretation, that the patient's statement is true, or that any clinical conclusion is accurate. It is not a clinical decision-support score.

### 15.4 Milestone allocation

- Milestone 2: patient typed/voice intake, durable persistence and staff-triggered server-side Gemini extraction.
- Milestone 3: deterministic Evidence Integrity Engine, provenance signing/verification and staff evidence-review UI.

The full specification and algorithm acceptance tests are in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md` and `docs/10_TESTING_AND_DEMO_PLAN.md`.
