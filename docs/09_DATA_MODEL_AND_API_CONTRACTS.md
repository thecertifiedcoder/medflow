# MedFlow — Data Model and API Contracts

## 1. Data principles

- One canonical intake document shape.
- Facility scoping on every record.
- Original patient narrative is never overwritten by AI output.
- AI extraction, patient-confirmed transcript, clinician priority and audit history are separate concepts.
- Do not persist raw voice audio.
- Avoid unnecessary personal data.

## 2. Firestore collections

### `facilities/{facilityId}`

Minimal configured demo facility:
- `name`
- `timezone`
- `createdAt`
- `isDemo`

### `intakes/{intakeId}`

Suggested fields:

```ts
type Intake = {
  id: string;
  facilityId: string;
  referenceCode: string;
  patientDisplayName?: string; // synthetic/alias in hackathon demo
  age?: number;
  inputMode: "typed" | "voice";
  transcriptRaw?: string;
  confirmedNarrative: string;
  transcriptConfirmedAt?: Timestamp;
  transcriptionStatus: "not_applicable" | "succeeded" | "failed";
  transcriptionModel?: string;
  aiStatus: "queued" | "processing" | "succeeded" | "failed" | "needs_human_clarification";
  aiSchemaVersion?: string;
  aiBrief?: ClinicalIntakeBrief; // original validated AI draft; preserve after staff review
  staffReview?: {
    status: "not_reviewed" | "confirmed" | "corrected";
    staffReviewedBrief?: ClinicalIntakeBrief; // separate human-reviewed copy
    correctionNote?: string;
    reviewedBy?: string;
    reviewedAt?: Timestamp;
  };
  staffAssignedPriority: "unassigned" | "immediate_review" | "priority_review" | "routine_review";
  workflowStatus: "new" | "in_review" | "awaiting_clarification" | "completed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  demoRecord: boolean;
  idempotencyKey: string;
};
```

Use server timestamps. Validate all client fields. The server supplies `facilityId`, `referenceCode`, processing states, timestamps, and ID; never accept these as trusted client values.

### `auditEvents/{eventId}`

```ts
type AuditEvent = {
  id: string;
  facilityId: string;
  intakeId: string;
  actorType: "patient" | "staff" | "system";
  actorUid?: string; // required when actorType === "staff"; omitted for patient/system
  actorRole?: "nurse" | "doctor" | "admin"; // required when actorType === "staff"; forbidden for patient/system
  action: "intake_created" | "transcript_confirmed" | "ai_completed" | "ai_failed" | "review_started" | "priority_assigned" | "priority_changed" | "status_changed" | "brief_confirmed" | "brief_corrected";
  fromValue?: string;
  toValue?: string;
  reason?: string;
  createdAt: Timestamp;
};
```

Audit events are append-only. Never represent patient or automated system actions as nurses, doctors, or admins. Avoid storing full narrative content in audit metadata.

### `staff/{uid}`

Minimum staff profile:
- `facilityIds: string[]`
- `role: nurse | doctor | admin`
- `displayName`
- `active`

For MVP, staff records may be provisioned manually in Firebase Console, but explain the process. Never let a public client assign itself a staff role.

## 3. Structured extraction type

```ts
type EvidenceItem = {
  value: string;
  sourceQuote?: string;
  certainty: "explicit" | "unclear";
};

type SymptomItem = EvidenceItem & {
  duration?: string | null;
  severity?: string | null;
};

type ClinicalIntakeBrief = {
  schemaVersion: "1.0";
  languageDetected?: string;
  chiefConcern: EvidenceItem;
  symptoms: SymptomItem[];
  relevantContext: EvidenceItem[];
  reportedDetailsToReview: Array<{
    detail: string;
    sourceQuote: string;
    context: string;
  }>;
  missingOrUnclear: string[];
  clinicianSummary: string;
  limitations: string[];
};
```

This output contains no diagnosis, prescription, triage color, urgency score or `safeToWait` property.

## 4. API routes

Use the generated server route convention but preserve these boundaries.

### `POST /api/intakes`

Creates an intake from a typed or patient-confirmed narrative.

Request:
```json
{
  "facilityPublicCode": "DEMO-FACILITY",
  "patientDisplayName": "Demo Patient A",
  "age": 34,
  "inputMode": "voice",
  "transcriptRaw": "My head has been paining me since yesterday evening",
  "confirmedNarrative": "My head has been paining me since yesterday evening",
  "idempotencyKey": "client-generated-unique-key"
}
```

Server must resolve facility code, validate content and create the record. Never accept arbitrary `facilityId`, priority, staff role, AI status or workflow status from the public client.

### `POST /api/intakes/transcribe`

- Auth: public intake session / rate-limited temporary session, no access to existing intakes.
- Body: audio bytes/form-data, validated media MIME type and duration.
- Server: enforce size and duration limits; call Gemini transcription model; return transcript draft and model ID.
- Response must not include provider API key or internal errors.
- Do not persist audio.

### `POST /api/intakes/{id}/extract`

Trigger extraction after intake creation. The Gemini call must run server-side. If the validated result is persisted from the client because of AI Studio Preview constraints, treat it as an untrusted AI draft until a staff member reviews/confirms it; document the exact trust boundary. Any retry action must be staff-authorised, rate-limited and bounded.

### `GET /api/staff/intakes`

- Staff authentication required.
- Facility scope derived from authenticated staff profile/claims, not query-supplied facility ID alone.
- Return paginated active queue.

### `POST /api/staff/intakes/{id}/review`

Mark item as `in_review` or `awaiting_clarification`; create audit event.

### `POST /api/staff/intakes/{id}/brief-review`

Request (confirmation):
```json
{
  "action": "confirm",
  "correctionNote": null
}
```

Request (correction):
```json
{
  "action": "correct",
  "staffReviewedBrief": { "...": "validated ClinicalIntakeBrief" },
  "correctionNote": "Corrected wording after reviewing the source statement"
}
```

Rules:
- Staff authentication and facility access are required.
- Validate the reviewed brief against the same versioned schema.
- Preserve the original `aiBrief`; save the staff-reviewed copy separately.
- Require a non-empty correction note for `correct`.
- Append `brief_confirmed` or `brief_corrected` audit event with actor and timestamp.
- Do not permit client users to change the original AI output or write audit events directly.

### `POST /api/staff/intakes/{id}/priority`

Request:
```json
{
  "priority": "priority_review",
  "reason": "Staff review after examining the patient narrative"
}
```

Require staff authentication, permission, reason on changes and facility check. Create audit event in the same trusted operation/transaction where practical; prevent post-creation changes to audit events through rules.

### `POST /api/staff/intakes/{id}/status`

Validate allowed state transitions and create audit event.

## 5. Allowed state transitions

Workflow:
- `new` → `in_review`
- `new` → `awaiting_clarification`
- `in_review` → `awaiting_clarification`
- `in_review` → `completed`
- `awaiting_clarification` → `in_review`
- `awaiting_clarification` → `completed`

Priority is an independent staff-controlled field. Any priority change requires an audit record. Do not allow direct transition to `completed` from a public patient request.

## 6. Firestore indexes and queries

Document the indexes actually required by the implementation. Avoid unbounded collection reads. Paginate historical records. The active queue should be facility-scoped and limited to recent/open items.

## 7. Validation and security requirements

- Use runtime schema validation on every server endpoint.
- Strip/ignore unknown client-supplied privileged fields.
- Enforce text and audio length limits.
- Prevent cross-facility reads/updates.
- Ensure public intake cannot query other intakes.
- Ensure a patient cannot set staff-assigned priority.
- Ensure audit records cannot be edited/deleted by ordinary users.
- Do not return database internals or provider stack traces.
