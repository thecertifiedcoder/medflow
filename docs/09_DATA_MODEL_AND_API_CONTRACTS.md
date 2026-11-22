# MedFlow — Data Model and API Contracts

## 1. Data principles

- One canonical intake document shape.
- Facility scoping on every record.
- Original patient narrative is never overwritten by AI output.
- AI extraction, patient-confirmed transcript, clinician priority and audit history are separate concepts.
- Do not persist raw voice audio.
- Avoid unnecessary personal data.

## 2. Authoritative Neon PostgreSQL relational model (`D-020`)

MedFlow's authoritative relational schema is defined in `src/db/schema.ts` and materialized via Drizzle Kit SQL migrations (`drizzle/0000_initial_medflow_schema.sql` and `drizzle/0001_immutability_triggers.sql`).

### 2.1 `facilities`

Canonical synthetic demo facility: `id = "demo-clinic-01"`, `public_code = "DEMO-CLINIC-01"`, `name = "MedFlow Synthetic Demo Clinic"`. (`demo-facility-001` and `DEMO-FACILITY` are retired.)

- `id` (`text`, PK)
- `public_code` (`text`, `UNIQUE NOT NULL`)
- `name` (`text`, `NOT NULL`)
- `timezone` (`text`, `NOT NULL`, default `'Africa/Lagos'`)
- `active` (`boolean`, `NOT NULL`, default `true`)
- `is_demo` (`boolean`, `NOT NULL`, default `true`)
- `created_at` (`timestamptz`, `NOT NULL`, default `now()`)
- `updated_at` (`timestamptz`, `NOT NULL`, default `now()`)

### 2.2 `staff_profiles` & `facility_memberships`

- `staff_profiles`: `uid` (`varchar(128)`, PK — Firebase Auth UID), `email` (`varchar(254)`, `UNIQUE NOT NULL`), `display_name` (`varchar(120)`, `NOT NULL`), `active` (`boolean`, `NOT NULL`), `created_at`, `updated_at`.
- `facility_memberships`: `id` (`uuid`, PK), `staff_uid` (`varchar(128)`, FK -> `staff_profiles.uid` `ON DELETE RESTRICT`), `facility_id` (`varchar(128)`, FK -> `facilities.id` `ON DELETE RESTRICT`), `role` (`staff_role`: `'nurse' | 'doctor' | 'admin'`), `active` (`boolean`, `NOT NULL`), `created_at`, `updated_at`, with `UNIQUE (staff_uid, facility_id)`.

Never let a public client assign itself a staff profile or facility membership. Provisioning occurs outside public routes (e.g., founder-run CLI `src/db/seed.ts` in Phase 1D-3).

### 2.3 `patient_intakes`

Core columns and invariants:
- Identity & source fields (protected as immutable post-insert by trigger `patient_intakes_immutability_trg`): `id` (`uuid`, PK), `facility_id` (`text`, FK -> `facilities.id`), `reference_code` (`text`), `patient_display_name` (`text?`), `age` (`integer?`, `0..130`), `input_mode` (`'typed' | 'voice'`), `transcript_raw` (`text?`), `confirmed_narrative` (`text`, `NOT NULL`), `confirmed_narrative_sha256` (`text?`), `transcript_confirmed_at` (`timestamptz?`), `transcription_status` (`'not_applicable' | 'succeeded' | 'failed'`), `transcription_model` (`text?`), `demo_record` (`boolean`), `idempotency_key` (`text`), `created_at` (`timestamptz`).
- Composite unique constraints:
  - `patient_intakes_id_facility_id_uq`: `UNIQUE (id, facility_id)` — referenced by composite foreign keys on `intake_evidence` and `audit_events`.
  - `patient_intakes_facility_ref_uq`: `UNIQUE (facility_id, reference_code)`.
  - `patient_intakes_facility_idempotency_uq`: `UNIQUE (facility_id, idempotency_key)`.
- AI draft fields (staff-triggered only, `D-015`): `ai_status` (`'queued' | 'processing' | 'succeeded' | 'failed' | 'needs_human_clarification'`), `ai_schema_version` (`text?`), `ai_model` (`text?`), `ai_brief` (`jsonb?`), `ai_brief_provenance` (`jsonb?`).
- Staff-review fields (separate from `ai_brief`): `staff_review_status` (`'not_reviewed' | 'confirmed' | 'corrected'`), `staff_reviewed_brief` (`jsonb?`), `staff_correction_note` (`text?`), `reviewed_by_uid` (`text?`, FK -> `staff_profiles.firebase_uid`), `reviewed_at` (`timestamptz?`).
- **Staff-review consistency CHECK (`patient_intakes_staff_review_consistency_chk`):**
  - `not_reviewed`: `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, and `staff_correction_note` must ALL be `NULL`.
  - `confirmed`: `reviewed_by_uid` and `reviewed_at` must be `NOT NULL`; `staff_correction_note` must be `NULL` (`staff_reviewed_brief` optional).
  - `corrected`: `staff_reviewed_brief`, `reviewed_by_uid`, `reviewed_at`, and `staff_correction_note` must ALL be `NOT NULL`, with `char_length(btrim(staff_correction_note)) BETWEEN 3 AND 500`.
- Staff workflow fields: `staff_assigned_priority` (`'unassigned' | 'immediate_review' | 'priority_review' | 'routine_review'`), `priority_reason` (`text?`), `workflow_status` (`'new' | 'in_review' | 'awaiting_clarification' | 'completed'`), `updated_at` (`timestamptz`).

The server always supplies `facility_id` (resolved from `facilityPublicCode`), `reference_code`, initial processing states, timestamps, and ID; never accept privileged fields from public clients.

### 2.4 `intake_evidence`

Stores deterministic server-derived field-level evidence verification rows (populated in Milestone 3):
- `id` (`uuid`, PK), `intake_id` (`uuid`, `NOT NULL`), `facility_id` (`text`, `NOT NULL`), `extraction_run_id` (`uuid`, `NOT NULL`), `field_category` (`evidence_field_category`), `field_path` (`text`), `claim_value` (`text`), `certainty` (`'explicit' | 'unclear'`), `source_quote` (`text?`), `verification_status` (`'exact_quote_match' | 'missing_quote' | 'quote_not_found' | 'ambiguous_quote'`), `span_start` (`integer?`), `span_end` (`integer?`), `engine_version` (`text`), `narrative_sha256` (`text`), `is_current` (`boolean`, default `true`), `created_at` (`timestamptz`).
- **Composite FK (`intake_evidence_intake_facility_fk`):** `FOREIGN KEY (intake_id, facility_id) REFERENCES patient_intakes (id, facility_id) ON DELETE RESTRICT` — guarantees every evidence row belongs to the same facility as its parent intake.
- **Span CHECK (`intake_evidence_status_span_chk`):** `exact_quote_match` requires non-null `source_quote`, `span_start >= 0`, and `span_end > span_start`; all other statuses require `span_start IS NULL AND span_end IS NULL` (`missing_quote` also requires `source_quote IS NULL`).
- **Active row uniqueness:** Partial unique index `intake_evidence_current_field_uq` on `(intake_id, field_path) WHERE is_current = true`.
- **Immutability trigger (`intake_evidence_immutability_trg`):** Blocks all `DELETE` operations and blocks every `UPDATE` except a strictly controlled one-way `is_current` transition from `true` to `false` with zero other column changes.

### 2.5 `audit_events`

Append-only audit trail (`D-007` + DB-level action-to-actor enforcement):
- `id` (`uuid`, PK), `facility_id` (`text`, `NOT NULL`), `intake_id` (`uuid`, `NOT NULL`), `actor_type` (`'patient' | 'staff' | 'system'`), `actor_uid` (`text?`, FK -> `staff_profiles.firebase_uid`), `actor_role` (`staff_role?`), `action` (`audit_action`), `from_value` (`text?`), `to_value` (`text?`), `reason` (`text?`), `created_at` (`timestamptz`).
- **Composite FK (`audit_events_intake_facility_fk`):** `FOREIGN KEY (intake_id, facility_id) REFERENCES patient_intakes (id, facility_id) ON DELETE RESTRICT`.
- **Append-only trigger (`audit_events_append_only_trg`):** Unconditionally rejects all `UPDATE` and `DELETE` operations.
- **Actor identity CHECK (`audit_events_actor_identity_chk`):** `staff` requires both `actor_uid` and `actor_role`; `patient` and `system` forbid both.
- **Mandatory reason CHECK (`audit_events_reason_required_chk`):** `priority_changed` and `brief_corrected` require non-null `reason` with `char_length(btrim(reason)) >= 3`.
- **Complete 10-action-to-actor mapping CHECK (`audit_events_action_actor_mapping_chk`):**

| Action | Required `actor_type` | `actor_uid` & `actor_role` | `reason` required? |
|---|---|---|---|
| `intake_created` | `patient` | Must be `NULL` | No |
| `transcript_confirmed` | `patient` | Must be `NULL` | No |
| `ai_completed` | `system` | Must be `NULL` | No |
| `ai_failed` | `system` | Must be `NULL` | No |
| `review_started` | `staff` | Must be `NOT NULL` | No |
| `priority_assigned` | `staff` | Must be `NOT NULL` | No |
| `priority_changed` | `staff` | Must be `NOT NULL` | Yes (≥ 3 trimmed chars) |
| `status_changed` | `staff` | Must be `NOT NULL` | No |
| `brief_confirmed` | `staff` | Must be `NOT NULL` | No |
| `brief_corrected` | `staff` | Must be `NOT NULL` | Yes (≥ 3 trimmed chars) |

Avoid storing full narrative content or raw audio in audit metadata.

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
  "facilityPublicCode": "DEMO-CLINIC-01",
  "patientDisplayName": "Demo Patient A",
  "age": 34,
  "inputMode": "voice",
  "transcriptRaw": "My head has been paining me since yesterday evening",
  "confirmedNarrative": "My head has been paining me since yesterday evening",
  "idempotencyKey": "client-generated-unique-key"
}
```

Server must resolve facility code (`DEMO-CLINIC-01` → `demo-clinic-01`), validate content, and create the `patient_intakes` record plus `intake_created` (and `transcript_confirmed` if voice) `audit_events` row in one PostgreSQL transaction. Never accept arbitrary `facilityId`, priority, staff role, AI status or workflow status from the public client.

### `POST /api/intakes/transcribe`

- Auth: public intake session / rate-limited temporary session, no access to existing intakes.
- Body: audio bytes/form-data, validated media MIME type and duration.
- Server: enforce size and duration limits; call Gemini transcription model; return transcript draft and model ID.
- Response must not include provider API key or internal errors.
- Do not persist audio.

### `POST /api/intakes/{id}/extract`

Trigger extraction only through an authenticated, active, facility-authorised staff session (`D-015`). The Gemini call, strict Zod validation, deterministic evidence verification (Milestone 3), and atomic PostgreSQL persistence (`ai_brief`, `ai_brief_provenance`, `intake_evidence`, and `system` `audit_events`) all execute server-side. Retries are staff-authorised, rate-limited, and bounded.

### `GET /api/staff/session` *(Implemented — Phase 1D-2)*

- **Auth:** `Authorization: Bearer <Firebase ID token>` verified server-side (`verifyIdToken` + `email_verified === true`).
- **Query params:** optional `facilityId` (`^[a-zA-Z0-9_-]+$`); invalid format returns `400 INVALID_FACILITY_ID`.
- **Behavior:** Resolves `staff_profiles` and active `facility_memberships` joined to active `facilities` strictly from Neon PostgreSQL. Returns `Cache-Control: no-store` with `authorizationModel: "neon_postgres_server_rbac"` and discriminated `authorizationStatus: "authorized" | "unprovisioned" | "inactive"`. Returns `503 DATABASE_UNAVAILABLE` if PostgreSQL is unreachable/unconfigured without exposing credentials or SQL.

### `GET /api/staff/intakes` *(Implemented — Phase 1D-2)*

- **Auth & RBAC:** Requires verified Firebase ID token, active PostgreSQL `staff_profiles`, active `facility_memberships` for the target facility, and an authorized clinical role (`nurse`, `doctor`, or `admin`). Cross-facility `facilityId` requests fail with `403 FACILITY_ACCESS_DENIED`.
- **Query params (strictly validated; unknown keys rejected with `400 INVALID_QUERY_PARAMS`):** `facilityId` (optional; defaults to primary authorized membership), `workflowStatus` (`new | in_review | awaiting_clarification | completed`), `priority` (`unassigned | immediate_review | priority_review | routine_review`), `includeCompleted` (`"true" | "false"`, default `false`), `limit` (`1..100`, default `50`), `offset` (`0..10000`, default `0`).
- **Ordering & projection:** Deterministic SQL order (`unassigned` → `immediate_review` → `priority_review` → `routine_review`, then `created_at ASC`, then `id ASC`). Returns bounded queue summaries (`items`, `pagination`, `counts`, `fetchedAt`) with `Cache-Control: no-store` and intentionally excludes `confirmedNarrative`, `transcriptRaw`, `aiBrief`, and `staffReviewedBrief`. Polled by the staff UI every 5 seconds while the browser tab is visible (`document.visibilityState !== "hidden"`).

### `GET /api/staff/intakes/{id}` *(Implemented — Phase 1D-2)*

- **Auth & RBAC:** Requires verified Firebase ID token, active PostgreSQL staff membership for the verified facility, and valid UUID path parameter (`400 INVALID_INTAKE_ID` on malformed IDs before DB access).
- **Cross-facility non-disclosure:** Queries `patient_intakes`, current `intake_evidence` (`is_current = true`), and chronological `audit_events` filtered strictly by `(intake_id, verified_facility_id)`. Missing records and records belonging to other facilities return an identical safe `404 INTAKE_NOT_FOUND` with no existence oracle.
- **Response (`Cache-Control: no-store`):** Separates `patientSource` (immutable `confirmedNarrative`, `transcriptRaw`, `confirmedNarrativeSha256`), `aiDraft` (non-authoritative `aiBrief`, provenance, status), `evidence` (`intake_evidence` spans/statuses), `staffReview` (separate `staffReviewedBrief`, correction note, reviewer metadata), `workflow`, and append-only `auditEvents`.

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

## 6. PostgreSQL indexes and queries

Defined in `src/db/schema.ts` and `drizzle/0000_initial_medflow_schema.sql`:
- `patient_intakes_facility_queue_idx` on `(facility_id, workflow_status, staff_assigned_priority, created_at)` for bounded, facility-scoped active queue reads.
- `patient_intakes_facility_created_idx` on `(facility_id, created_at)`.
- `intake_evidence_intake_current_idx` on `(intake_id, is_current)` plus partial unique index `intake_evidence_current_field_uq` on `(intake_id, field_path) WHERE is_current = true`.
- `audit_events_intake_created_idx` on `(intake_id, created_at)` and `audit_events_facility_created_idx` on `(facility_id, created_at)`.
- `facility_memberships_staff_active_idx` and `facility_memberships_facility_idx` for fast server-side RBAC resolution.

Avoid unbounded table scans; paginate historical/completed records and always filter by verified `facility_id`.

## 7. Validation and security requirements

- Use runtime schema validation on every server endpoint.
- Strip/ignore unknown client-supplied privileged fields.
- Enforce text and audio length limits.
- Prevent cross-facility reads/updates.
- Ensure public intake cannot query other intakes.
- Ensure a patient cannot set staff-assigned priority.
- Ensure audit records cannot be edited/deleted by ordinary users.
- Do not return database internals or provider stack traces.


## 8. Evidence Integrity metadata contract (approved direction; implementation pending)

The Evidence Integrity Engine is defined in `docs/19_EVIDENCE_INTEGRITY_ENGINE_SPEC.md`. The current Gemini candidate schema remains strict and versioned. Evidence-verification metadata is added by trusted server code after the candidate passes Zod validation; it is never accepted from Gemini or a browser client.

### Evidence verification result

```ts
type EvidenceVerification = {
  status:
    | "exact_quote_match"
    | "missing_quote"
    | "quote_not_found"
    | "ambiguous_quote";
  sourceSpan?: {
    start: number; // UTF-16 code units, inclusive
    end: number;   // UTF-16 code units, exclusive
  };
  engineVersion: string;
};

type VerifiedEvidenceItem = EvidenceItem & {
  evidenceVerification: EvidenceVerification;
};
```

Rules:

- Explicit claims require a source quotation.
- The server searches the exact, immutable `confirmedNarrative`; no fuzzy matching or silent quote repair.
- The server derives offsets. A stored span is valid only when `confirmedNarrative.slice(start, end) === sourceQuote`.
- One exact occurrence is `exact_quote_match`; zero is `quote_not_found`; multiple occurrences are `ambiguous_quote`; absent quotation is `missing_quote`.
- The status means only that a quotation can (or cannot) be located. It is not a claim of clinical truth or semantic correctness.
- Do not calculate or display a single evidence confidence score.

### AI draft provenance envelope

The server-generated `aiBriefProvenance` envelope must bind the draft to the source narrative and include:

- `intakeId`;
- SHA-256 hash of the exact confirmed narrative;
- SHA-256 hash of the canonical validated draft plus evidence metadata;
- model ID, extraction schema version and evidence engine version;
- creation timestamp;
- HMAC-SHA-256 signature generated with a server-only secret.

The HMAC secret (`EVIDENCE_HMAC_SECRET`, intentionally deferred until Milestone 3) is strictly server-only — never stored in the database, exposed to the browser, or committed. Signature verification proves envelope integrity and origin under the server key, not clinical correctness. Under `D-015` and `D-020`, extraction is triggered only by an authenticated, active, facility-authorised staff session; the Next.js Route Handler writes `ai_brief`, `ai_brief_provenance`, `intake_evidence` rows (protected by composite `(intake_id, facility_id)` FK and one-way `is_current` immutability trigger), and the append-only `system` audit event inside a single PostgreSQL transaction.

### Summary boundary

The free-text `clinicianSummary` is an AI draft, not a field-level verified fact. Show it as a draft beside the original narrative and verified source quotations. Do not claim that every sentence has been mechanically verified. Sentence-level traceability requires a future versioned summary-segment schema.
