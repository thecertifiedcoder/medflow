import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractBearerToken } from "./admin-auth";
import { FacilityRecordSchema, StaffProfileSchema } from "../schemas/staff";

const REPO_ROOT = process.cwd();
const RULES_TEXT = fs.readFileSync(
  path.join(REPO_ROOT, "firestore.rules"),
  "utf8",
);
const BLUEPRINT = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "firebase-blueprint.json"), "utf8"),
) as {
  entities: Record<string, unknown>;
  firestore: Record<string, unknown>;
};

test("extractBearerToken rejects missing, malformed, or non-JWT headers", () => {
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(""), null);
  assert.equal(extractBearerToken("Basic abcdef1234567890"), null);
  assert.equal(extractBearerToken("Bearer short"), null);
  assert.equal(extractBearerToken("Bearer not.a.jwt.with.four"), null);
  assert.equal(extractBearerToken("Bearer header.payload"), null);
});

test("extractBearerToken accepts a structurally valid compact JWT", () => {
  const syntheticJwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlX3ZhbHVl";
  assert.equal(extractBearerToken(`Bearer ${syntheticJwt}`), syntheticJwt);
  assert.equal(extractBearerToken(`bearer   ${syntheticJwt}`), syntheticJwt);
});

test("StaffProfileSchema validates provisioned profiles and rejects shadow fields or empty facilities", () => {
  const valid = StaffProfileSchema.safeParse({
    uid: "staff_uid_synthetic_01",
    email: "nurse.synthetic@example.org",
    displayName: "Nurse A. Bello (Synthetic)",
    role: "nurse",
    facilityIds: ["demo-clinic-01"],
    active: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal(valid.success, true);

  const emptyFacilities = StaffProfileSchema.safeParse({
    uid: "staff_uid_synthetic_01",
    email: "nurse.synthetic@example.org",
    displayName: "Nurse A. Bello",
    role: "nurse",
    facilityIds: [],
    active: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal(emptyFacilities.success, false);

  const shadowField = StaffProfileSchema.safeParse({
    uid: "staff_uid_synthetic_01",
    email: "nurse.synthetic@example.org",
    displayName: "Nurse A. Bello",
    role: "nurse",
    facilityIds: ["demo-clinic-01"],
    active: true,
    isSuperAdmin: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal(shadowField.success, false);
});

test("FacilityRecordSchema validates active synthetic facility records strictly", () => {
  const valid = FacilityRecordSchema.safeParse({
    id: "demo-clinic-01",
    name: "MedFlow Synthetic Demo Clinic",
    publicCode: "DEMO-CLINIC-01",
    active: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal(valid.success, true);

  const badId = FacilityRecordSchema.safeParse({
    id: "bad/id with spaces",
    name: "Invalid",
    publicCode: "BAD",
    active: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal(badId.success, false);
});

test("firestore.rules enforces Option 2B: zero email-bootstrap bypass and zero client writes to /facilities and /staff", () => {
  // No hardcoded email allowlist anywhere in rules
  assert.equal(RULES_TEXT.includes("request.auth.token.email =="), false);
  assert.equal(RULES_TEXT.includes("@gmail.com"), false);
  // Global default-deny catch-all present
  assert.match(
    RULES_TEXT,
    /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/,
  );
  // Facilities & staff deny list/create/update/delete
  assert.match(
    RULES_TEXT,
    /match \/facilities\/\{facilityId\}[\s\S]*?allow list: if false;[\s\S]*?allow create, update, delete: if false;/,
  );
  assert.match(
    RULES_TEXT,
    /match \/staff\/\{uid\}[\s\S]*?allow list: if false;[\s\S]*?allow create, update, delete: if false;/,
  );
});

test("firestore.rules enforces Option 1B, immutable patient narrative, and 3-actor append-only audit trail", () => {
  // No unauthenticated update on intakes
  assert.match(
    RULES_TEXT,
    /allow update: if isVerifiedEmail\(\)[\s\S]*?isActiveStaffForFacility\(existing\(\)\.facilityId\)/,
  );
  // Immutable patient narrative enforced explicitly
  assert.match(
    RULES_TEXT,
    /incoming\(\)\.confirmedNarrative == existing\(\)\.confirmedNarrative/,
  );
  // Brand-new atomic audit event required on every intake create and update
  assert.match(
    RULES_TEXT,
    /!exists\(\/databases\/\$\(database\)\/documents\/intakes\/\$\(intakeId\)\/auditEvents\/\$\(incoming\(\)\.lastAuditEventId\)\)/,
  );
  // Audit events are strictly append-only (no update or delete)
  assert.match(
    RULES_TEXT,
    /match \/auditEvents\/\{eventId\}[\s\S]*?allow update, delete: if false;/,
  );
  // System audit events require active staff session (Option 1B) and forbid actorUid/actorRole (D-007)
  assert.match(
    RULES_TEXT,
    /data\.actorType in \['patient', 'system'\]\s*&& !\('actorUid' in data\)\s*&& !\('actorRole' in data\)/,
  );
  // Blueprint covers every collection matched in rules
  assert.deepEqual(Object.keys(BLUEPRINT.firestore).sort(), [
    "/facilities/{facilityId}",
    "/intakes/{intakeId}",
    "/intakes/{intakeId}/auditEvents/{eventId}",
    "/staff/{uid}",
  ]);
});
