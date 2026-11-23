# MedFlow — Clinical Safety, Human Oversight and Privacy Rules

> **Current hackathon access note (2026-11-23):** Judges use the server-signed Demo Clinical Staff session from `/demo`. The public judge flow does not require Google Sign-In. This does not make the workspace public: the session and server-side facility/role authorization checks remain required for protected staff APIs.


## 1. Prototype status

MedFlow is a hackathon prototype. It is not clinically validated, not a substitute for a triage protocol and not approved for live patient care. All demo scenarios must be synthetic.

## 2. Human authority

- A qualified healthcare professional owns clinical decisions.
- AI extraction is advisory administrative support only.
- AI never assigns workflow priority.
- Only authorised staff can assign/change priority or clinical workflow status.
- The interface labels priority as “Staff-assigned priority”.
- Staff can see the original narrative and correct AI extraction.
- A low/no AI flag must never be displayed as proof that a patient is low-risk.

## 3. Patient-facing safety copy

Display a concise notice:

> MedFlow is a demonstration prototype, not an emergency service or a diagnostic tool. Do not use this demo for real medical emergencies or enter real patient information. If someone needs urgent help, contact local emergency services or alert hospital staff directly. Do not wait for a digital form or AI response.

The wording and local emergency contact details must be reviewed before any real deployment. Do not invent a national emergency number.

## 4. Safe workflow defaults

- Every intake enters the staff queue regardless of AI status.
- Missing data stays missing; it is not treated as normal/negative.
- AI timeout/failure leaves the raw confirmed narrative visible.
- AI output never blocks a patient submission.
- Staff can mark intake as needing clarification.
- Priority changes require a reason and generate an audit event.
- The queue cannot hide unreviewed submissions because extraction failed.

## 5. Clinical rules and protocols

Do not implement SATS, TEWS or another protocol from memory or an informal secondary table. The earlier planning draft contained a simplified adult TEWS score; it must not be treated as an approved complete protocol. Any future protocol implementation requires:

- selection of a clinically appropriate protocol by qualified clinical advisors;
- confirmation of intended patient population and setting;
- primary-source documentation and exact version;
- rights/licensing review for commercial use;
- test cases reviewed by qualified clinicians;
- change control and clinical governance;
- regulatory assessment of intended use.

For hackathon scope, use human-assigned workflow priority only.

## 6. Synthetic data

- Use fictional names, ages and scenarios.
- Add a persistent `DEMO DATA` label to seeded examples.
- Do not use real patient records, identifiable stories, screenshots or audio.
- Do not imply synthetic examples represent real hospital outcomes.

## 7. Data minimisation and retention

For MVP, collect only what is needed to demonstrate intake and staff review. Avoid full address, identity numbers, insurance details, next-of-kin, or unrelated medical history.

- Do not persist raw audio.
- Do not log transcript/narrative content, database URLs, or secrets.
- Do not store API keys or secrets in frontend code or the PostgreSQL database.
- Provide a demo-data reset for authorised staff.
- Use short-lived, purpose-limited processing for audio.

## 8. Access control

- Patient intake may be publicly accessible only for creating a new intake under the configured canonical demo facility (`DEMO-CLINIC-01` → `demo-clinic-01`); it must not expose existing records.
- Staff dashboard requires Firebase Authentication (Google Sign-In) plus an active, server-verified PostgreSQL `staff_profiles` and `facility_memberships` record.
- Every record, query, and composite child foreign key (`intake_evidence`, `audit_events`) must be scoped to `facility_id`.
- Staff role and facility membership are verified server-side from authoritative PostgreSQL records; never trust a role or `facilityId` supplied by the client.
- Patients must not access other patient records by changing an ID in the URL.
- Audit events are strictly append-only in PostgreSQL (`audit_events_append_only_trg`) with DB-enforced action-to-actor validation and cannot be modified or deleted by clients or application users.

## 9. Privacy and external AI processing

Voice audio and health narrative are sensitive. The hackathon app must clearly state that it is synthetic/demo-only. Google API terms and data-use settings differ by service and tier; current Gemini API pricing material indicates free-tier content may be used to improve products while paid-tier handling differs. Verify the exact terms for the selected API and account before sending any sensitive data. Never send real patient health information through this hackathon build.

Before commercial deployment, obtain qualified Nigerian data-protection and health-regulatory advice covering lawful basis, privacy notices, controller/processor responsibilities, data processing agreements, international transfers, retention, security controls, data subject rights and any required impact assessment.

## 10. Relevant Nigerian regulatory context

The Nigeria Data Protection Act 2023 treats health information as sensitive personal data and includes safeguards related to automated decision-making and security. NAFDAC has published Software as a Medical Device guidance. Whether MedFlow falls within SaMD regulation depends on its intended purpose and functionality and must be assessed professionally before commercial use. This document is not legal advice.

## 11. Safety release gate

Do not deploy the hackathon demo until:
- prototype disclaimer appears;
- app uses synthetic data only;
- patient submissions are never blocked by AI failure;
- AI cannot set priority or clinical status;
- staff-only actions are access controlled;
- no secret is bundled into the browser;
- no raw audio or narrative content is written to logs;
- unauthorised cross-facility and cross-patient reads are tested.


## 12. Evidence Integrity Engine and scoring exclusion (2026-11-22)

The approved Evidence Integrity Engine checks whether extracted quotations can be located in the exact patient-confirmed narrative and records source spans and provenance. This is a data-integrity/provenance check, not a clinical validation mechanism.

- An exact quotation match does not prove that the AI interpretation is semantically supported, that the patient's statement is true, or that a clinical conclusion is accurate.
- Do not label an extracted item “clinically verified”, “true”, “safe” or “accurate” solely because its quote matched.
- Staff review remains mandatory; the original narrative and original AI draft remain preserved.
- Do not display a single trust/confidence score that could be mistaken for clinical certainty.
- The adult TEWS/SATS scoring UI and code embedded in the new design reference are excluded from MVP functionality. No clinical classes, vital-sign scores, time targets or autonomous urgency logic may be activated.

See `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md` and decisions D-018/D-019.
