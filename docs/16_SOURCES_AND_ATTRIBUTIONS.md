# Sources and Attributions — MedFlow (Working Codename)

**Document ID:** MED-RES-016  
**Version:** 0.2  
**Status:** Research register  
**Last updated:** 2026-11-21

This register separates official guidance, legislation, and publicly described competitor capabilities. Competitor pages are vendor statements and are not independent validation of performance, adoption, or clinical effectiveness.

## 1. Official Nigerian clinical and regulatory sources

### 1.1 NCDC — National Guidelines on Infection Prevention and Control for Viral Haemorrhagic Fevers (September 2023)

URL: https://ncdc.gov.ng/themes/common/docs/protocols/341_1707300274.pdf

Relevant section: Chapter Three, Hospital Screening for Viral Haemorrhagic Fevers, section titled “Triaging”.

Research note: The guideline describes triage as rapid assessment of sick people on arrival and distinguishes cases with priority signs, emergency signs, and neither priority nor emergency signs. It also calls for trained staff, screening questionnaires, protocols, and algorithms. Scope warning: this document is specifically a VHF infection-prevention guideline. It must not be represented as a universal Nigerian emergency triage protocol.

### 1.2 NAFDAC — Guidelines for Registration of Software as a Medical Device (SaMD) in Nigeria

URL: https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Guidelines/DR_And_R_Guidelines/Guidelines-for-Registration-of-Software-as-a-Medical-Device-SaMD-in-Nigeria.pdf

Document reference: DR&R-GDL-036-00. Effective date: 1 July 2024. Review date: 30 June 2029.

Research note: The guideline defines SaMD by intended medical purpose and says intended use is reflected in the manufacturer's specifications, instructions, and product information. Its categorisation approach considers the significance of information provided to healthcare decisions and the healthcare situation/condition. Do not infer a category for MedFlow without a formal intended-purpose statement and specialist regulatory review.

### 1.3 Nigeria Data Protection Act 2023

Official Gazette PDF hosted by the Nigeria Data Protection Commission:
https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf

Relevant provisions include sections 25–30 (lawful basis, consent, information to data subjects, data protection impact assessment, controller/processor obligations, sensitive personal data), section 37 (automated decision-making), section 39 (security), and sections 41–43 (cross-border transfers).

Research note: The Act's definition of sensitive personal data includes health status. Section 27 includes information about processing purposes, recipients, retention, and automated decision-making. Section 37 provides protections and safeguards for certain solely automated decisions with significant effects. Section 39 requires appropriate technical and organisational security measures. Legal application to a hospital/customer/vendor deployment should be reviewed by qualified counsel and privacy professionals.

## 2. Clinical protocol licensing

### 2.1 Emergency Medicine Society of South Africa — South African Triage Scale (SATS)

URL: https://emssa.org.za/special-interest-groups/the-south-african-triage-scale-sats/

Research note: The EMSSA page describes SATS as a physiology- and symptom-based triage scale and states that SATS materials are licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported. Commercial use or adaptation should not proceed without appropriate permission or a suitable commercial licence. The hackathon MVP should not copy SATS scoring charts or imply that it implements validated SATS.

## 3. Public competitor references

### 3.1 Helium Health / HeliumOS

Product: https://heliumhealth.com/helium-os/

FAQ: https://heliumhealth.com/faqs/

Research note: Public product materials describe appointments, outpatient workflows, nursing notes and vitals, patient triage management, staff access controls, and audit trails. This is a broad hospital platform; use these pages to understand adjacent capabilities, not to claim a feature gap without further validation.

### 3.2 DHS Africa — AI-supported healthcare workflows

URL: https://dhs.africa/solutions/ai-supported-healthcare-workflows/

Research note: Public page explicitly describes structuring intake, drafting summaries, surfacing triage signals, proposing routing, language detection, symptom/duration extraction, clinician review, override, and audit logging. This is a close conceptual competitor. Do not claim that AI-assisted intake or human review is a novel idea on its own.

### 3.3 ClinicOS

Product: https://clinicos.ng/

Hospital solution: https://clinicos.ng/solutions/hospitals

Research note: Public materials describe a Nigerian hospital platform including clinical documentation, patient records, appointments, billing, team workflows, queues, patient communication, and voice/USSD complaint logging. Verify actual availability and feature maturity directly before relying on claims.

### 3.4 ClinicFlowAI

URL: https://clinicflowai.africa/

Research note: Public materials describe hospital operational visibility, workflow alerts, patient-flow intelligence, and integration alongside existing EMRs. Treat claims as vendor statements.

## 4. MedFlow naming collision research

The name “MedFlow” is used publicly by multiple healthcare software products, including:

- https://www.uboramedflow.care/ — public materials describe an Africa-ready hospital EMR/ERP and clinical intelligence platform, including Nigeria-facing claims.
- https://medflow.care/ — public materials describe a care-technology platform for clinics.
- https://medflow.cloud/ — a healthcare-related platform login and privacy/terms pages.

Research conclusion: This is a brand collision warning, not a legal trademark opinion. Treat MedFlow as an internal codename until proper trademark, corporate-name, domain, and market clearance is completed.

## 5. Research limitations

- Website feature descriptions are vendor-published claims and do not establish product quality, actual deployment, market share, or clinical outcomes.
- Public web research does not replace direct interviews with Nigerian nurses, clinicians, reception staff, hospital administrators, or patients.
- The NCDC document cited above has VHF infection-prevention scope and is not a general emergency triage protocol.
- The NAFDAC SaMD guidance requires a product-specific intended-purpose and regulatory assessment; this register does not determine the product's classification.
- The NDPA requires fact-specific analysis of data-controller/processor roles, lawful basis, cross-border transfers, retention, and safeguards.


## 6. Voice input and AI Studio implementation references

### 6.1 Google — Gemini 3.5 Transcribe announcement (26 August 2026)

URL: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5-transcribe/

Research note: Google describes Gemini 3.5 Transcribe for prerecorded audio and a separate Live model for streaming. The announcement describes automatic language detection across 85+ languages and access through Gemini API/Google AI Studio. Product-level claims do not establish its accuracy for Nigerian Pidgin. Verify current API availability, SDK support, quotas and request format at implementation time.

### 6.2 Google Cloud — Gemini 3.5 Transcribe model documentation

URL: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-transcribe

Research note: The documentation describes synchronous prerecorded-audio transcription and live streaming modes. It documents `VERBATIM` and `SMART` modes. MedFlow specifies `VERBATIM` for patient narratives to avoid automatic rewriting of a patient's meaning. Confirm endpoint applicability to the selected AI Studio/Gemini API project before implementation.

### 6.3 Google AI Studio — Build apps

URL: https://ai.google.dev/gemini-api/docs/aistudio-build-mode

Research note: Google describes Build Mode as supporting full-stack web apps with a client-side frontend and Node.js server runtime, and GitHub import. Confirm current capabilities and project-generated conventions in the actual Build environment before writing implementation prompts.

### 6.4 MDN — Web Speech API / SpeechRecognition

URL: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

Research note: MDN marks SpeechRecognition as limited availability and notes that some browsers use a server-based recognition service. MedFlow therefore specifies `MediaRecorder` plus server-side transcription as the primary path, with typed input as fallback.

### 6.5 Rufai et al. — Towards End-to-End Training of Automatic Speech Recognition for Nigerian Pidgin (PMLR, 2026)

URL: https://proceedings.mlr.press/v302/rufai26a.html

Research note: The paper reports a 73.7% word-error rate for its off-the-shelf English ASR baseline on its Nigerian Pidgin evaluation set, compared with 29.6% for a fine-tuned model. These results are not tests of Gemini 3.5 Transcribe. They support the requirement to test Nigerian Pidgin explicitly and avoid unsupported accuracy claims.

### 6.6 Gemini API pricing and data use

URL: https://ai.google.dev/gemini-api/docs/pricing

Research note: The current page distinguishes free and paid tiers and indicates different data-use terms (including use to improve products on the free tier). Review the exact terms applicable to the account and endpoint before any sensitive data processing. MedFlow's hackathon prototype uses synthetic data only.


### 6.7 Google AI Studio support — Firebase Preview guidance (November 2026)

URL: https://discuss.ai.google.dev/t/ai-studio-keeps-saying-the-service-is-temporarily-unavailable-please-try-again-and-there-was-an-issue-while-sharing-your-applet/187622?page=2

Research note: A Google AI Studio support response states that Firebase Admin SDK Firestore calls are not supported in AI Studio Preview and recommends the Firebase Web SDK with Firestore Security Rules. This is a support-forum statement about Preview, not a permanent product guarantee. Verify behaviour in the actual project and do not expose privileged credentials as a workaround.
