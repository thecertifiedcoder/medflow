# Security and Privacy Policy

## Project status

MedFlow is an implemented hackathon demonstration prototype. It is not approved for real patient data or clinical use. This document is a minimum project handling policy, not a complete production security programme.

## Data permitted in this repository and demo

- Use synthetic patient names, identifiers, narratives, transcripts, audio, timestamps and clinical examples only.
- Do not commit real patient or health data, real audio, photographs, contact details, access tokens, API keys, passwords, private keys or production database exports.
- Do not place sensitive values in screenshots, issue reports, logs, analytics or test fixtures.

## Application security requirements

- Keep Gemini, OpenRouter and other service credentials in server-side secrets or environment configuration. The OpenRouter fallback is intended only for synthetic hackathon demonstration content. Never expose secrets in browser bundles or source control.
- Authenticate staff and enforce facility-scoped authorisation on every protected read and write. UI-level restrictions are not security controls.
- Apply least privilege, input validation, output schema validation, safe error handling, rate limiting and secure transport where supported.
- Treat patient narrative and model output as untrusted input. Avoid logging raw narratives, transcripts, prompts containing sensitive data or credentials.
- Preserve an append-only audit trail for security-relevant staff actions as specified in the data contract.
- Store only data needed for the prototype. Raw audio should not be retained unless a formally approved requirement and safe retention design are established; the current demo plan uses transcript-only persistence.
- Use synthetic test fixtures and keep local environment files out of version control.

## Reporting

Do not publish vulnerabilities containing secrets or patient information. Remove exposed credentials immediately, rotate them, and report the incident privately to the project owner. If real patient data is accidentally committed, treat it as a privacy incident; deleting the file in a later commit is not sufficient because Git history may retain it.

## Before any real-world pilot

A real deployment requires a separate security and privacy review, data-protection impact assessment where appropriate, clinical governance, access and retention policies, incident response, vendor/data-processing review, clinical validation and applicable Nigerian regulatory assessment. This prototype policy does not establish compliance with any law or standard. An exact source-quote match is not clinical validation or proof that the AI interpretation is correct.
