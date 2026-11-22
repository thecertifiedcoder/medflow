# MedFlow Firestore Security Specification (Phase 0 TDD)

**Project:** `daring-brace-jw1xt` (Starter Tier, `europe-west3`)  
**Database:** `ai-studio-medflow-18474100-269d-4cc8-8c48-2c46f125468b`  
**Decisions Enforced:** `D-006`, `D-007`, `D-008`, `D-009`, `D-014`, `D-015` (Option 1B), `D-016` (Option 2B)

---

## 1. Non-Negotiable Data Invariants

1. **Zero-Trust Default Deny:** Any unmatched collection or operation is explicitly denied (`match /{document=**} { allow read, write: if false; }`).
2. **No Client Facility or Staff Self-Provisioning (Option 2B):** `/facilities/{facilityId}` and `/staff/{uid}` deny all client `create`, `update`, and `delete` operations with **no** email-based bootstrap bypass. Authentication alone never grants staff privileges.
3. **Staff PII Isolation:** `/staff/{uid}` allows `get` only when `request.auth != null && request.auth.token.email_verified == true && request.auth.uid == uid`. `list` is always denied to prevent enumerating staff profiles or emails.
4. **Patient Privacy & Facility Isolation:** Unauthenticated visitors have zero `get` or `list` access to `/intakes/{intakeId}` or `/intakes/{intakeId}/auditEvents/{eventId}`. Staff reads and list queries strictly enforce `resource.data.facilityId in staff.facilityIds` with `staff.active == true` and `email_verified == true`.
5. **Write-Only Public Intake Creation with Atomic Audit:** Public intake `create` requires an existing active `/facilities/{facilityId}`, exact allowlisted keys, optional `age`/`patientDisplayName`, locked initial states (`workflowStatus == "new"`, `staffAssignedPriority == "unassigned"`, `aiStatus == "queued"`, `staffReviewStatus == "not_reviewed"`), `request.time` timestamps, and an atomic `existsAfter(...)` patient `intake_created` audit event.
6. **Immutable Original Patient Narrative:** After creation, `confirmedNarrative`, `transcriptRaw`, `facilityId`, `referenceCode`, `inputMode`, `transcriptionStatus`, `idempotencyKey`, `initialAuditEventId`, `patientDisplayName`, `age`, and `createdAt` can **never** be modified by any client (including admins).
7. **Staff-Only AI Draft Persistence (Option 1B):** Unauthenticated post-submission writes to `/intakes/{intakeId}` are strictly forbidden. Attaching `aiBrief` / `aiBriefProvenance` is an explicit staff-only update action that cannot touch `confirmedNarrative`, `staffAssignedPriority`, `workflowStatus`, or `staffBrief`.
8. **Append-Only 3-Actor Audit Trail (`D-007`):** `/intakes/{intakeId}/auditEvents/{eventId}` forbids all `update` and `delete`. `patient` events are allowed only atomically on initial intake creation (`!exists(parent) && existsAfter(parent)` with no `actorUid`/`actorRole`). `staff` events require active facility staff with `actorUid == request.auth.uid`, `actorRole == staff.role`, and mandatory `reason` on `priority_changed`. `system` events require active facility staff (Option 1B) with no `actorUid`/`actorRole`.
9. **Terminal Workflow Locking:** Once `workflowStatus == "completed"`, non-admin staff cannot mutate the intake.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

| # | Attack Class | Target Path & Operation | Malicious Synthetic Payload / Context | Rule Gate That Rejects It |
|---|---|---|---|---|
| **DD-01** | **Privilege Escalation (Self-Provision Staff)** | `CREATE /staff/attacker-uid` (signed-in Google user) | `{ uid: "attacker-uid", email: "attacker@example.com", displayName: "Fake Nurse", role: "admin", facilityIds: ["demo-clinic-01"], active: true, createdAt: SERVER_TIME }` | `/staff/{uid}` `allow create: if false;` (Option 2B). |
| **DD-02** | **Staff PII Enumeration** | `LIST /staff` or `GET /staff/other-nurse-uid` (signed-in active nurse) | Query all docs in `/staff` or read another nurse's profile | `allow list: if false;` and `allow get` requires `request.auth.uid == uid`. |
| **DD-03** | **Unauthenticated Queue / Record Read** | `GET /intakes/intake-001` or `LIST /intakes` (unauthenticated) | Patient attempts to read back own or another patient's intake | `allow get, list` requires `isActiveStaffForFacility(...)`. |
| **DD-04** | **Cross-Facility Data Leak** | `GET /intakes/facility-b-intake` (active nurse in `demo-clinic-01` only) | Nurse reads or queries `facilityId == "clinic-b"` | `existing().facilityId in getStaffProfile().data.facilityIds` fails. |
| **DD-05** | **Shadow Field / AI Triage Injection on Create** | `CREATE /intakes/intake-shadow` (unauthenticated) | Valid create payload + `diagnosis: "migraine"`, `staffAssignedPriority: "immediate_review"`, or `aiBrief: {...}` | `isValidIntakeCreate` enforces `keys().hasOnly(...)` and `staffAssignedPriority == "unassigned"`, `aiStatus == "queued"`. |
| **DD-06** | **Orphan Intake Without Atomic Patient Audit** | `CREATE /intakes/intake-no-audit` (unauthenticated, single write without batch) | Valid intake payload without committing `/intakes/intake-no-audit/auditEvents/{initialAuditEventId}` in same batch | `existsAfter(.../auditEvents/$(incoming().initialAuditEventId))` fails. |
| **DD-07** | **Unauthenticated Post-Submit AI Draft Tampering (Option 1B)** | `UPDATE /intakes/intake-001` (unauthenticated) | `{ aiStatus: "succeeded", aiBrief: { ... }, updatedAt: SERVER_TIME }` | `allow update` requires `isSignedIn() && isVerifiedEmail() && isActiveStaffForFacility(...)`. |
| **DD-08** | **Overwriting Immutable Original Patient Narrative** | `UPDATE /intakes/intake-001` (active nurse in same facility) | `{ confirmedNarrative: "Edited patient statement", updatedAt: SERVER_TIME, lastAuditEventId: "evt-2" }` | `affectedKeys().hasOnly(...)` action allowlists exclude `confirmedNarrative` + explicit `incoming().confirmedNarrative == existing().confirmedNarrative`. |
| **DD-09** | **Priority Change Without Reason or Atomic Audit** | `UPDATE /intakes/intake-001` (active nurse changing `priority_review -> routine_review`) | `{ staffAssignedPriority: "routine_review", updatedAt: SERVER_TIME, lastAuditEventId: "evt-missing" }` (missing `priorityReason` or missing batch audit doc) | Priority action enforces non-empty `priorityReason` on reassignment and `existsAfter(.../auditEvents/$(incoming().lastAuditEventId))`. |
| **DD-10** | **Audit Tampering / Deletion** | `UPDATE` or `DELETE /intakes/intake-001/auditEvents/evt-1` (active admin) | Modify `reason` or delete audit history | `allow update, delete: if false;` on `auditEvents`. |
| **DD-11** | **Audit Actor Spoofing (`D-007`)** | `CREATE /intakes/intake-001/auditEvents/evt-spoof` (active nurse) | `{ actorType: "staff", actorUid: "other-doctor-uid", actorRole: "doctor", action: "priority_assigned", ... }` or `actorType: "system"` with `actorRole: "nurse"` | `actorUid == request.auth.uid && actorRole == getStaffProfile().data.role`; non-staff events forbid `actorUid` & `actorRole`. |
| **DD-12** | **ID Poisoning / Unverified Email / Invalid Status Jump** | `CREATE /intakes/<200-char-id>` OR `UPDATE` by unverified email OR jumping `new -> completed` | Oversized ID / `email_verified: false` / skipping `in_review` to `completed` | `isValidId(intakeId)` (`<= 128` + regex), `isVerifiedEmail()`, and `isValidWorkflowTransition(...)` reject all three. |
