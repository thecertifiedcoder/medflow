# Product Definition — MedFlow (Working Codename)

**Document ID:** MED-PRD-002  
**Version:** 0.2  
**Status:** Draft for founder approval  
**Last updated:** 2026-11-21  
**Competition:** TCC Hackathon 2026  

> This document defines the proposed product direction for the hackathon MVP and the longer-term commercial product. It does not establish clinical validation, regulatory approval, or permission to process real patient data.

## 1. Executive product definition

**MedFlow is a review-first clinical intake and patient-flow layer for hospitals.** It converts a patient's own description of their reason for visiting into a structured, source-linked clinical intake brief that nurses and other authorised staff can verify, correct, and use within a staff-controlled intake queue.

The product is not an AI doctor, autonomous triage decision-maker, diagnostic tool, prescription system, or full hospital management system.

### Core workflow

`Patient narrative → Structured draft → Evidence and uncertainty review → Staff confirmation → Staff-owned queue and next action`

AI helps organise information. Qualified healthcare staff remain responsible for clinical assessment, urgency decisions, and patient care.

## 2. Product identity

- **Working codename:** MedFlow
- **Existing tagline:** Context-Aware Clinical Intake Engine
- **Proposed positioning line:** From patient story to clinical clarity.
- **Brand status:** Not cleared for public/commercial use. Multiple healthcare products already use the MedFlow name, including products with an African/Nigerian hospital focus. Treat MedFlow as an internal codename until trademark, company-name, domain, and market clearance are completed.

## 3. Problem definition

### Problem hypothesis

At the point a patient arrives at a hospital, important information about their reason for visiting may be captured in free-form, fragmented, or inconsistent ways. Patients may describe symptoms in everyday language rather than clinical terminology. Staff must interpret, clarify, rewrite, and transfer that information while also managing a busy intake workflow.

This can create avoidable documentation friction, incomplete handovers, repeated questioning, and poor visibility into which cases are awaiting review or action.

### What is established versus what must be validated

- The NCDC's September 2023 *National Guidelines on Infection Prevention and Control for Viral Haemorrhagic Fevers* describes triage as rapid assessment on arrival and discusses emergency, priority, and non-urgent groups, trained staff, screening questionnaires, protocols, and algorithms. This is a VHF infection-prevention guideline, not a universal emergency-department triage standard.
- The extent of patient-to-nurse overload, documentation delays, language-related friction, and the frequency of missed or delayed priority cases at any target hospital remains a hypothesis until validated through interviews and workflow observation.
- Do not publish unsupported statistics or claims about mortality reduction, time saved, nurse-to-patient ratios, or hospital performance.

### Problem statement for the hackathon

**Hospital staff need a faster, clearer way to turn a patient's own account of their condition into a reviewable intake record and keep that case visible through the initial hospital workflow.**

## 4. Target users and buyer

### Primary user: triage nurse / intake nurse

Needs to quickly understand what the patient reported, see what is missing or ambiguous, verify the structured information, record relevant observations, and manage the patient's next step.

### Secondary user: receptionist / intake assistant

May help a patient submit or record the initial narrative, but should not make clinical decisions unless authorised and trained under the facility's workflow.

### Clinical user: doctor / authorised clinician

Needs a concise, accurate, reviewable summary with access to the patient's original account and a clear distinction between reported facts, uncertain details, and staff-confirmed information.

### Buyer / operational owner: hospital administrator or facility manager

Needs visibility into intake volume, queue states, ownership, waiting duration, and auditable actions without replacing the facility's entire hospital information system.

### Initial ideal customer profile hypothesis

A hospital or clinic with a defined reception/triage workflow, recurring patient intake volume, staff who need a shared view of incoming cases, and willingness to test a focused workflow tool. The initial pilot segment should be chosen through discovery, not assumed from this document.

## 5. Product proposition and differentiation hypothesis

### Core value proposition

MedFlow helps a care team move from an unstructured patient narrative to a verified, usable intake brief without hiding the original patient account or allowing AI to make the final clinical decision.

### Differentiation hypothesis: evidence-linked clinical intake

The proposed differentiating interaction is an **evidence-linked clinical brief**:

1. Every extracted field is labelled as explicitly reported, ambiguous, or not provided.
2. Extracted facts retain a link or quotation showing where the information came from in the patient's original account.
3. The original patient narrative is retained separately and is never silently overwritten by AI-generated text.
4. AI output remains a draft until an authorised staff member reviews and confirms or edits it.
5. Staff, not the model, assign clinical urgency and own the queue's next action.
6. The system records the AI run, reviewer, corrections, priority changes, and timestamps in an audit trail.

This is a product hypothesis, not a proven unique market advantage. Public competitor research shows that several products already describe AI-assisted intake, triage signals, queue management, clinical review, and auditability. MedFlow must win through a clearly executed workflow, evidence traceability, local-language quality testing, usability, and integration fit—not by claiming that AI intake or a queue is unprecedented.

## 6. Competitive context

The following are observations from public product pages, not independent verification of product performance or customer adoption.

| Product | Publicly described capabilities | Implication for MedFlow |
|---|---|---|
| Helium Health / HeliumOS | Hospital management and EMR workflows, appointments, outpatient care, nursing notes and vitals, patient triage management, role controls, and audit trails. | Do not position MedFlow as another complete HMS/EMR or claim that a digital queue is unique. Explore an intake-focused complement to existing systems. |
| DHS Africa | Multi-channel patient access, language detection, structured symptom extraction, summaries, triage signals, routing suggestions, clinician review, and AI audit trails. | Very close conceptual overlap. The MVP must demonstrate a more specific workflow and not claim the broad idea is novel. |
| ClinicOS | Nigerian hospital platform with records, queues, clinical documentation, patient communication, and voice/USSD complaint logging described in its public materials. | Local voice/USSD intake is not automatically a unique differentiator. Validate the specific patient and nurse problem. |
| ClinicFlowAI | Hospital workflow intelligence, operational alerts, workflow visibility, and integration with existing EMRs described publicly. | A future integration-layer position may be more credible than replacing an existing hospital system. |

### Competitive conclusion

The broad category is already active. MedFlow should initially focus on one narrow, demonstrable wedge: **high-fidelity, evidence-linked intake briefs that a nurse can verify and move through a controlled queue**. Validate this wedge with real workflow interviews before treating it as a durable competitive moat.

## 7. Experience principles

1. **Patient words are source data.** Preserve the original statement and do not silently rewrite it.
2. **AI drafts; staff confirm.** Nothing AI-generated becomes a confirmed clinical record until reviewed by an authorised person.
3. **Unknown is not normal.** Missing information must be shown as missing, not interpreted as a negative finding.
4. **No automated down-prioritisation.** AI must never move a patient into a lower-urgency queue category or tell a patient they are safe to wait.
5. **No hidden inference.** Distinguish patient-reported facts, model-generated interpretation, staff-entered observations, and staff-confirmed details.
6. **Graceful degradation.** An AI failure must not block intake or remove the case from the staff queue.
7. **Fast and accessible.** Patient intake must work on mobile and be usable with staff assistance; typed input is the dependable baseline.
8. **Clinician workflow first.** The dashboard should reduce context-switching and make the next staff action obvious.
9. **Auditability by design.** Important changes must show who did what and when.
10. **Honest capability claims.** Demonstrations, README, and presentation must distinguish implemented features from planned capabilities and unvalidated clinical assumptions.

## 8. Proposed end-to-end workflow

### Patient / assisted-intake journey

1. Patient scans a facility QR code or opens a short intake link, or a staff member opens the assisted-intake flow.
2. The patient sees a plain-language notice explaining why information is collected, who can review it, and that the form is not for emergencies.
3. Patient provides only the information required for the current intake workflow and describes their concern in their own words.
4. Patient chooses voice or typing. Voice is a first-class P0 pathway using browser recording and server-side transcription; typed entry remains available whenever microphone access or transcription fails.
5. The application saves the intake record before attempting AI processing.
6. The patient sees a clear confirmation and is told to alert hospital staff immediately if they feel seriously unwell or their condition worsens. The form must never delay immediate help.

### AI processing journey

1. The original patient narrative is saved immutably as the source statement.
2. Gemini is asked to extract structured information using a strict schema.
3. The output identifies explicit reports, ambiguous details, missing information, source quotations, and optional clarification questions.
4. The server validates the response against the schema and rejects invalid or unsupported output.
5. AI processing status, model identifier, timestamp, and outcome are recorded.
6. If AI fails or times out, the saved intake remains visible in the queue as awaiting staff review.

### Nurse / clinical staff journey

1. Staff member signs in through an authenticated account.
2. Staff sees the live intake queue for their facility.
3. Newly submitted cases default to **Awaiting staff review**, never to a low-risk or routine category.
4. Staff opens a case and sees the original statement beside the AI-generated draft.
5. Staff confirms, edits, or rejects extracted fields; corrections are attributed to the staff member.
6. Authorised clinical staff record observations or vitals as appropriate to their workflow.
7. An authorised clinician assigns the case's urgency/next action using the facility's approved protocol and professional judgement.
8. Queue state changes are recorded in the audit history.
9. Staff can mark the case as in assessment, in care, transferred, or completed as supported by the approved workflow.

## 9. Hackathon MVP scope

The MVP is a single-facility demonstration with a deployable architecture that does not prevent later multi-facility support. All patient examples and records used for the public demo must be synthetic.

### P0 — Must work end to end

1. **Patient intake:** responsive mobile form with minimal demographics and typed or voice chief concern.
2. **Voice capture:** short recording, server-side transcription, transcript review/edit, and patient confirmation.
3. **Typed fallback:** patient can always type or continue if voice is unavailable.
4. **Consent / privacy notice:** clear prototype notice; synthetic data only.
5. **Durable intake creation:** save the confirmed narrative and intake record before AI processing.
6. **Gemini extraction:** produce structured context, not diagnosis or final triage priority.
7. **Evidence-linked fields:** show source quotations and explicit/ambiguous/not-provided states.
8. **Real-time staff dashboard:** new cases appear without manual refresh; queue states are visible.
9. **Staff review:** authorised staff can confirm, edit, or reject AI-generated fields.
10. **Staff-assigned queue state:** workflow priority/next action is entered by authorised staff, not generated or silently changed by AI.
11. **Audit trail:** record transcription/extraction status, staff review, corrections, and priority/status changes.
12. **Failure handling:** intake remains visible if transcription, model or network call fails; clear fallback is available.
13. **Synthetic demo dataset:** realistic but fictional cases that demonstrate the whole workflow.
14. **Public repository quality:** working setup instructions, environment template, tests, architecture explanation, clinical limitations, sprint log, and AI disclosure.

### P1 — Only after P0 is stable

- QR-code generation for the demo facility.
- Queue filters, search, elapsed-time display, and staff assignment.
- Printable or exportable intake summary.
- Additional voice-language experiments and a documented Nigerian English / Pidgin evaluation set beyond the minimum demo sample.
- More complete staff activity history.

### P2 — Future commercial roadmap

- Multi-facility tenancy and configurable facility workflows.
- Integration with existing HMIS/EMR platforms and interoperability standards.
- Offline-first capture and reliable synchronisation.
- WhatsApp, USSD, SMS, and assisted phone intake.
- Clinician-approved configurable clinical protocols.
- Adult and paediatric workflow configuration.
- Clinical validation, prospective evaluation, risk management, and regulatory pathway.
- Enterprise audit, retention, access governance, and customer-managed policies.
- Analytics based on verified operational data.

## 10. Explicit non-goals

The hackathon MVP will not:

- Diagnose a condition or recommend treatment or medication.
- Tell a patient they are safe to wait.
- Independently assign final clinical urgency or calculate an unvalidated acuity score.
- Automatically downgrade a patient's priority.
- Implement SATS/TEWS or copy its scoring tables without resolving commercial licensing and clinical governance.
- Claim clinical validation, regulatory approval, hospital partnership, or measured clinical outcomes.
- Replace an EMR, EHR, hospital information system, or clinician.
- Store a longitudinal medical record, handle billing, or process payments.
- Process real patient data during the hackathon demonstration.

## 11. AI output contract — conceptual

The final JSON Schema will be defined in the AI specification. The minimum conceptual fields are:

- `chief_concern`: concise normalised restatement of the patient's stated concern.
- `symptoms`: list of symptom statements, each with the original phrase and explicit/ambiguous status.
- `timeline`: onset and duration only when stated; otherwise mark not provided.
- `relevant_context`: only information explicitly reported by the patient.
- `potentially_relevant_phrases`: verbatim phrases for staff attention, without an AI urgency score.
- `missing_or_ambiguous_information`: details requiring clarification.
- `clarifying_questions`: optional questions for the nurse to ask.
- `summary`: concise draft for staff review.
- `limitations`: any extraction uncertainty or processing limitation.

Do not use uncalibrated numerical confidence scores. Do not infer that a symptom is absent because it was not mentioned. Do not invent vitals, diagnoses, medical history, or negations.

## 12. Hackathon success criteria

| Hackathon criterion | What the product must demonstrate |
|---|---|
| Working product & technical execution (25) | Complete patient-to-dashboard workflow, reliable saving, AI extraction, staff verification, and queue updates. |
| Architecture & code quality (20) | Clear module boundaries, server-side secrets, strict schemas, access controls, error handling, tests, and readable source. |
| Scalability & production readiness (15) | Facility-scoped data model, deployable application, documented environment, migration path, and explicit limitations. |
| Innovation & local relevance (15) | Realistic Nigerian patient-language examples, narrative fidelity, source-linked extraction, and a specific local workflow problem. |
| Demo quality & communication (10) | A concise five-minute walkthrough of a working end-to-end case, not slides or mockups. |
| Social engagement (15) | One public submitted demo post, official tags, legitimate engagement, and no deleting/re-uploading. |

## 13. Demo narrative

The five-minute demo should tell one coherent story:

1. **Problem (about 30 seconds):** Show how a patient's real-world description can be difficult to translate into a structured intake record while staff are managing a queue.
2. **Patient intake (about 50 seconds):** Submit a synthetic patient narrative using everyday Nigerian English or a tested Pidgin example.
3. **AI transformation (about 65 seconds):** Show the structured draft, exact source phrases, ambiguous/missing details, and preserved original statement.
4. **Nurse review (about 80 seconds):** Confirm or correct fields, record relevant observations, and assign the next action/priority as staff.
5. **Live queue and audit (about 45 seconds):** Show the updated queue, staff ownership/status, and audit history.
6. **Architecture and next steps (about 30 seconds):** Explain the technology, safety boundaries, and what would be required for clinical deployment.

**Target duration: 5:00 exactly (300 seconds), with rehearsal adjustments to remain within 4:50–5:10.**

The final video must remain within 4:50–5:10 per the participant guide. The precise timings above are a working storyboard, not a substitute for the official range.

## 14. Commercialisation principles

1. Build as a focused intake/workflow layer that can complement an existing HMIS/EMR, rather than assuming hospitals will replace their core system.
2. Keep patient/facility data ownership and role-scoped access explicit in the architecture.
3. Do not use real patient information until lawful basis, consent/notice, processor terms, data protection assessment, security, retention, and cross-border processing questions have been reviewed by qualified professionals.
4. Establish whether the actual product's intended purpose brings it within NAFDAC's SaMD framework. A disclaimer alone does not determine regulatory status.
5. Do not commercialise SATS-derived material under its current NonCommercial-ShareAlike licence without permission or an appropriate commercial licence.
6. Validate the workflow with nurses, clinicians, hospital administrators, and patients before claiming measurable benefits.
7. Maintain evidence for all public claims, customer logos, results, and clinical capabilities.

## 15. Product success measures to evaluate in a pilot

Do not report these as achieved outcomes until measured. Candidate measures:

- Time from intake submission to staff review.
- Percentage of AI-generated fields accepted, edited, or rejected by staff.
- Frequency and types of missing or ambiguous information.
- Time required for staff to convert a narrative into a usable intake brief.
- Number of cases with complete review and ownership history.
- Intake completion rate and assisted-intake rate.
- Staff usability and trust feedback.
- AI extraction error rates on a clinically reviewed evaluation set.

Clinical safety outcomes require an appropriately designed and governed evaluation; hackathon testing is not clinical validation.

## 16. Open decisions

- Final commercial brand name and domain clearance.
- Initial facility segment and workflow (emergency intake, urgent outpatient, or general front-desk intake).
- Clinical governance partner and approved local protocol for any future urgency logic.
- Whether Gemini 3.5 Transcribe performs adequately on the target Nigerian English and Pidgin sample utterances; voice remains a P0 requirement, but actual quality and browser compatibility must be tested and limitations disclosed.
- Exact personal data fields required and approved lawful basis for any future deployment.
- Whether to keep the MVP strictly single-facility or demonstrate a second facility only after core tenancy controls are tested.
- Exact Google AI Studio stack, Firebase configuration, and deployment model after technical validation.

## 17. Source register

See `16_SOURCES_AND_ATTRIBUTIONS.md` for the source register and research notes.
