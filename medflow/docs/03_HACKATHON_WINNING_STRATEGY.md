# MedFlow — Hackathon Strategy and Differentiation

## 1. Strategic objective

Maximise performance against the actual TCC Hackathon 2026 scorecard by presenting a working, locally relevant and technically credible product. No strategy can guarantee a win. The aim is to eliminate avoidable score losses and give judges direct evidence for every criterion.

## 2. The problem we choose to solve

**Hackathon problem statement:** At hospital arrival, patients may describe symptoms in everyday, fragmented or distressed language, while staff need concise, structured information to begin an assessment and manage incoming patients. MedFlow tests whether voice-first intake and evidence-linked AI extraction can reduce the information-friction between a patient's account and a nurse's review workflow.

This is a problem hypothesis to demonstrate and validate, not a claim that all Nigerian hospitals have the same workflow or that MedFlow has already reduced mortality, waiting time or staff workload.

## 3. Positioning

**MedFlow is a voice-first, AI-assisted clinical intake and patient-flow tool.** It turns a patient's typed or spoken account into a reviewable clinical intake brief, preserving the original narrative and showing the evidence behind extracted information. Nurses review, correct and assign workflow priority in a live queue.

### Differentiation hypothesis

Do not pitch “AI triage chatbot”. Pitch the full connected workflow:

1. **Voice-first capture:** Patients can explain their concern naturally instead of navigating a long medical form.
2. **Transcript control:** The patient sees and edits the transcript before submitting it.
3. **Evidence-linked extraction:** AI extracts structured fields and attaches supporting source phrases; unknown details remain unknown.
4. **Nurse command queue:** Staff receive new submissions in real time, inspect the original narrative and structured brief, and assign priority themselves.
5. **Accountable workflow:** Staff review, priority changes and overrides are recorded as audit events.

The product must make each of these observable during the demo.

## 4. What not to claim

Never claim that MedFlow:
- diagnoses patients;
- decides autonomously who is safe to wait;
- replaces nurses or doctors;
- implements a fully validated SATS/TEWS protocol;
- is clinically validated or approved for real patient use;
- reduces mortality, waiting time or workload by a quantified amount without an actual study;
- has production hospital integrations or partnerships that do not exist.

## 5. Feature-to-score strategy

| Judge criterion | Strategy | Proof the judge should see |
|---|---|---|
| Working Product (25) | Make one end-to-end path reliable before adding breadth | Record voice → edit transcript → submit → AI brief → real-time queue → nurse review → assign priority → audit |
| Architecture & Code (20) | Make code quality visible in repository, not just verbally claimed | Folder structure, server-only AI secrets, validation, Firestore security rules, deterministic queue logic, tests, clear commits |
| Scalability (15) | Build a credible foundation without premature microservices | Facility-scoped data model, role-aware access, deployable app, server-side AI calls, documented integration boundaries |
| Innovation & Local Relevance (15) | Make voice and local language context meaningful, not decorative | Demonstrate Nigerian English; test Pidgin samples; disclose transcription limitations; preserve patient language and source phrases |
| Demo (10) | Tell one clear patient story and show a real workflow | A synthetic patient's voice intake appears on the nurse dashboard and gets reviewed live |
| Social (15) | Coordinate legitimate engagement around one submitted post | Public video post with official tag and hashtags; supporters engage with that exact URL |

## 6. Recommended competitive features

### P0 — Core differentiators

1. **Voice + typed intake:** Equal first-class input modes. Voice must be tested on the actual target phone/browser.
2. **Transcript review/edit:** No voice transcript is submitted as confirmed patient narrative until the patient can review or staff can confirm it.
3. **Evidence-linked clinical brief:** Every extracted field carries a source quote or is explicitly marked not stated/uncertain.
4. **Real-time nurse queue:** A new submission appears without page refresh.
5. **Human-assigned workflow priority:** Nurse assigns or changes priority; the queue sorts by staff decision, then submission time.
6. **Audit trail:** Record which staff member changed a priority/status, when, from what to what, and the reason.
7. **Failure-safe behaviour:** If transcription or AI extraction fails, preserve the patient's submission and show the original narrative to staff.
8. **Synthetic demo mode/data:** One-click reset/seed for a controlled presentation using fictional people and fictional health narratives.

### P1 — Only after all P0 acceptance tests pass

- QR code entry to the patient intake page.
- Queue filters (new, in review, priority, completed).
- Basic patient lookup by demo reference ID.
- Assign a patient to a staff member.
- Queue ageing indicator based on elapsed time (not a clinical waiting-time guarantee).
- Print a concise intake summary.

### P2 — Explicitly not part of hackathon MVP

- Autonomous AI urgency scoring.
- Clinical scoring protocol implementation.
- Full EMR/EHR, billing or pharmacy.
- Multi-hospital onboarding and complex tenant administration.
- WhatsApp/USSD production channels.
- Production audio archive and analytics.
- Real patient pilots or clinical outcomes claims.

## 7. The single best demo moment

The hero moment is not a flashy animation. It is a real two-device workflow:

1. On a phone, a synthetic patient describes symptoms by voice.
2. MedFlow transcribes the recording.
3. The patient corrects one word and confirms the transcript.
4. Gemini extracts symptoms, duration and unknowns, each linked to source evidence.
5. The intake appears on the nurse's dashboard without refresh.
6. The nurse reviews the brief, assigns a staff-controlled priority and records a reason.
7. The audit timeline shows the change.

This one sequence demonstrates AI, voice, local relevance, UX, real-time data, human oversight and engineering execution.

## 8. Local relevance without unsupported claims

- Frame the problem around the specific patient-intake workflow being demonstrated in a Nigerian hospital context.
- Support everyday Nigerian English and test a small number of Pidgin utterances.
- Do not advertise “Pidgin support” as reliable until it passes a documented test set.
- Let the user choose voice or text. Do not assume every patient can or wants to speak.
- Make text readable and touch targets large on mobile.
- Explain that a person unable to use a phone can be assisted by staff; that assisted path can be represented in the workflow even if it is not automated in the MVP.

## 9. Social engagement strategy

- Publish one excellent public demo post as early as practical after the submission asset is ready.
- Tag Tech Conference Calabar and add both official hashtags.
- Send supporters the exact submitted post URL; do not split engagement across duplicate posts.
- Ask for genuine reactions, substantive comments and shares.
- Do not buy engagement, use bots, spam or manipulate counts.
- Do not delete, privatise or re-upload the post.
- Monitor the social score threshold: 50+ engagement points corresponds to all 15 social points under the guide.

## 10. Definition of success

MedFlow is ready for judging when:
- a judge can complete the patient journey without assistance;
- typed intake works even when microphone access fails;
- voice capture produces a transcript that the user can review;
- AI output is structured and evidence-linked;
- a new intake appears on the nurse dashboard live;
- a nurse can review and manually assign/update priority;
- all meaningful changes appear in the audit log;
- AI failure does not lose or hide the patient submission;
- public code and README let a reviewer understand and run the application;
- demo video satisfies the exact time and public-link rules.
