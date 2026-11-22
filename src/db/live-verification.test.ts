import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import { closeDbPool } from "@/db";
import { createDrizzleStaffRepository } from "@/lib/db/staff-repository";
import { getDatabaseUrl, getMigrationDatabaseUrl } from "@/lib/env/server";

const HAS_LIVE_DB = Boolean(
  process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim(),
);

function buildDirectPool(): Pool {
  const connectionString = getMigrationDatabaseUrl();
  const isLocalhost =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1");
  return new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15_000,
    ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
  });
}

async function expectPgError(
  client: PoolClient,
  savepoint: string,
  fn: () => Promise<unknown>,
  expectedCode: string,
  label: string,
): Promise<void> {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await fn();
    assert.fail(`Expected PostgreSQL error ${expectedCode} for: ${label}`);
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    assert.equal(
      pgCode,
      expectedCode,
      `Expected PG error code ${expectedCode} for "${label}", got ${String(pgCode)}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

test(
  "Live Neon PostgreSQL: schema tables, immutability triggers, and canonical demo-clinic-01 seed exist",
  { skip: !HAS_LIVE_DB },
  async () => {
    const pool = buildDirectPool();
    try {
      const tablesRes = await pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
         ORDER BY table_name ASC`,
      );
      const tableNames = tablesRes.rows.map((r) => r.table_name);
      for (const expected of [
        "audit_events",
        "facilities",
        "facility_memberships",
        "intake_evidence",
        "patient_intakes",
        "staff_profiles",
      ]) {
        assert.ok(
          tableNames.includes(expected),
          `Expected table "${expected}" in public schema; found: ${tableNames.join(", ")}`,
        );
      }

      const triggersRes = await pool.query<{ trigger_name: string }>(
        `SELECT trigger_name
         FROM information_schema.triggers
         WHERE trigger_schema = 'public'`,
      );
      const triggerNames = triggersRes.rows.map((r) => r.trigger_name);
      for (const expectedTrigger of [
        "patient_intakes_immutability_trg",
        "intake_evidence_immutability_trg",
        "audit_events_append_only_trg",
      ]) {
        assert.ok(
          triggerNames.includes(expectedTrigger),
          `Expected trigger "${expectedTrigger}" in public schema; found: ${triggerNames.join(", ")}`,
        );
      }

      const facilityRes = await pool.query<{
        id: string;
        name: string;
        public_code: string;
        active: boolean;
        is_demo: boolean;
      }>(
        `SELECT id, name, public_code, active, is_demo
         FROM facilities
         WHERE id = $1`,
        [CANONICAL_DEMO_FACILITY.id],
      );
      assert.equal(facilityRes.rows.length, 1);
      const row = facilityRes.rows[0];
      assert.ok(row);
      assert.equal(row.id, "demo-clinic-01");
      assert.equal(row.public_code, "DEMO-CLINIC-01");
      assert.equal(row.name, "MedFlow Synthetic Demo Clinic");
      assert.equal(row.active, true);
      assert.equal(row.is_demo, true);
    } finally {
      await pool.end();
    }
  },
);

test(
  "Live Neon PostgreSQL: database constraints and triggers enforce PG-01 through PG-06 (rolled back cleanly)",
  { skip: !HAS_LIVE_DB },
  async () => {
    const pool = buildDirectPool();
    const client = await pool.connect();

    const suffix = crypto.randomUUID().slice(0, 8);
    const otherFacilityId = `test-clinic-${suffix}`;
    const staffUid = `test-staff-${suffix}`;
    const intakeId = crypto.randomUUID();
    const extractionRunId = crypto.randomUUID();
    const narrative = "Synthetic live constraint test narrative for MedFlow.";
    const narrativeSha256 = crypto
      .createHash("sha256")
      .update(narrative)
      .digest("hex");

    try {
      await client.query("BEGIN");

      // Setup synthetic rows strictly inside rolled-back transaction.
      await client.query(
        `INSERT INTO facilities (id, name, public_code, timezone, is_demo, active)
         VALUES ($1, 'Synthetic Other Clinic', $2, 'Africa/Lagos', true, true)`,
        [otherFacilityId, `TEST-CLINIC-${suffix.toUpperCase()}`],
      );
      await client.query(
        `INSERT INTO staff_profiles (uid, email, display_name, active)
         VALUES ($1, $2, 'Synthetic Test Nurse', true)`,
        [staffUid, `test.nurse.${suffix}@medflow.synthetic`],
      );
      await client.query(
        `INSERT INTO facility_memberships (staff_uid, facility_id, role, active)
         VALUES ($1, 'demo-clinic-01', 'nurse', true)`,
        [staffUid],
      );
      await client.query(
        `INSERT INTO patient_intakes (
           id, facility_id, reference_code, idempotency_key,
           input_mode, transcription_status, confirmed_narrative, confirmed_narrative_sha256
         )
         VALUES ($1, 'demo-clinic-01', $2, $3, 'typed', 'not_applicable', $4, $5)`,
        [
          intakeId,
          `MF-TEST-${suffix.toUpperCase()}`,
          `idem-test-${suffix}`,
          narrative,
          narrativeSha256,
        ],
      );

      // PG-01: Composite FK blocks cross-facility intake_evidence and audit_events.
      await expectPgError(
        client,
        "sp_pg01_evidence",
        () =>
          client.query(
            `INSERT INTO intake_evidence (
               intake_id, facility_id, extraction_run_id, field_category, field_path,
               claim_value, certainty, source_quote, verification_status,
               span_start, span_end, engine_version, narrative_sha256
             ) VALUES (
               $1, $2, $3, 'chief_concern', 'chiefConcern',
               'Test claim', 'explicit', 'Synthetic live', 'exact_quote_match',
               0, 14, 'eie-1.0.0', $4
             )`,
            [intakeId, otherFacilityId, extractionRunId, narrativeSha256],
          ),
        "23503",
        "PG-01 cross-facility intake_evidence composite FK",
      );

      await expectPgError(
        client,
        "sp_pg01_audit",
        () =>
          client.query(
            `INSERT INTO audit_events (
               facility_id, intake_id, actor_type, action, to_value
             ) VALUES ($1, $2, 'patient', 'intake_created', 'new')`,
            [otherFacilityId, intakeId],
          ),
        "23503",
        "PG-01 cross-facility audit_events composite FK",
      );

      // PG-02: Immutable patient source narrative trigger blocks confirmed_narrative mutation.
      await expectPgError(
        client,
        "sp_pg02_narrative",
        () =>
          client.query(
            `UPDATE patient_intakes
             SET confirmed_narrative = 'Tampered narrative'
             WHERE id = $1`,
            [intakeId],
          ),
        "P0001",
        "PG-02 immutable confirmed_narrative update",
      );

      // PG-03: intake_evidence allows one-way is_current true -> false, blocks reactivation, field edits, and DELETE.
      const evInsert = await client.query<{ id: string }>(
        `INSERT INTO intake_evidence (
           intake_id, facility_id, extraction_run_id, field_category, field_path,
           claim_value, certainty, source_quote, verification_status,
           span_start, span_end, engine_version, narrative_sha256
         ) VALUES (
           $1, 'demo-clinic-01', $2, 'chief_concern', 'chiefConcern',
           'Test claim', 'explicit', 'Synthetic live', 'exact_quote_match',
           0, 14, 'eie-1.0.0', $3
         ) RETURNING id`,
        [intakeId, extractionRunId, narrativeSha256],
      );
      const evidenceId = evInsert.rows[0]?.id;
      assert.ok(evidenceId);

      // Field edit must fail.
      await expectPgError(
        client,
        "sp_pg03_edit_claim",
        () =>
          client.query(
            `UPDATE intake_evidence SET claim_value = 'Altered claim' WHERE id = $1`,
            [evidenceId],
          ),
        "P0001",
        "PG-03 intake_evidence claim_value update",
      );

      // DELETE must fail.
      await expectPgError(
        client,
        "sp_pg03_delete",
        () =>
          client.query(`DELETE FROM intake_evidence WHERE id = $1`, [
            evidenceId,
          ]),
        "P0001",
        "PG-03 intake_evidence DELETE",
      );

      // One-way is_current true -> false MUST succeed.
      await client.query(
        `UPDATE intake_evidence SET is_current = false WHERE id = $1`,
        [evidenceId],
      );

      // Re-activating is_current false -> true MUST fail.
      await expectPgError(
        client,
        "sp_pg03_reactivate",
        () =>
          client.query(
            `UPDATE intake_evidence SET is_current = true WHERE id = $1`,
            [evidenceId],
          ),
        "P0001",
        "PG-03 intake_evidence is_current reactivation",
      );

      // PG-04 & PG-05: audit_events append-only trigger + 10-action-to-actor CHECK + mandatory reason CHECK.
      const auditInsert = await client.query<{ id: string }>(
        `INSERT INTO audit_events (
           facility_id, intake_id, actor_type, action, to_value
         ) VALUES ('demo-clinic-01', $1, 'patient', 'intake_created', 'new')
         RETURNING id`,
        [intakeId],
      );
      const auditId = auditInsert.rows[0]?.id;
      assert.ok(auditId);

      await expectPgError(
        client,
        "sp_pg04_update",
        () =>
          client.query(
            `UPDATE audit_events SET to_value = 'tampered' WHERE id = $1`,
            [auditId],
          ),
        "P0001",
        "PG-04 audit_events UPDATE",
      );

      await expectPgError(
        client,
        "sp_pg04_delete",
        () => client.query(`DELETE FROM audit_events WHERE id = $1`, [auditId]),
        "P0001",
        "PG-04 audit_events DELETE",
      );

      // Mismatched actor-to-action pairs must fail CHECK 23514.
      await expectPgError(
        client,
        "sp_pg05_staff_ai",
        () =>
          client.query(
            `INSERT INTO audit_events (
               facility_id, intake_id, actor_type, actor_uid, actor_role, action
             ) VALUES ('demo-clinic-01', $1, 'staff', $2, 'nurse', 'ai_completed')`,
            [intakeId, staffUid],
          ),
        "23514",
        "PG-05 staff logging system-only ai_completed",
      );

      await expectPgError(
        client,
        "sp_pg05_system_priority",
        () =>
          client.query(
            `INSERT INTO audit_events (
               facility_id, intake_id, actor_type, action, reason
             ) VALUES ('demo-clinic-01', $1, 'system', 'priority_changed', 'Invalid system override')`,
            [intakeId],
          ),
        "23514",
        "PG-05 system logging staff-only priority_changed",
      );

      await expectPgError(
        client,
        "sp_pg05_missing_reason",
        () =>
          client.query(
            `INSERT INTO audit_events (
               facility_id, intake_id, actor_type, actor_uid, actor_role, action, reason
             ) VALUES ('demo-clinic-01', $1, 'staff', $2, 'nurse', 'priority_changed', '  ')`,
            [intakeId, staffUid],
          ),
        "23514",
        "PG-05 priority_changed with blank reason",
      );

      // Valid system & staff audit rows MUST succeed.
      await client.query(
        `INSERT INTO audit_events (
           facility_id, intake_id, actor_type, action, to_value
         ) VALUES ('demo-clinic-01', $1, 'system', 'ai_completed', 'succeeded')`,
        [intakeId],
      );
      await client.query(
        `INSERT INTO audit_events (
           facility_id, intake_id, actor_type, actor_uid, actor_role, action, from_value, to_value, reason
         ) VALUES ('demo-clinic-01', $1, 'staff', $2, 'nurse', 'priority_changed', 'unassigned', 'immediate_review', 'Verified bedside reassessment')`,
        [intakeId, staffUid],
      );

      // PG-06: Staff-review consistency CHECK.
      await expectPgError(
        client,
        "sp_pg06_corrected_missing_note",
        () =>
          client.query(
            `UPDATE patient_intakes
             SET staff_review_status = 'corrected',
                 staff_reviewed_brief = '{}'::jsonb,
                 reviewed_by_uid = $2,
                 reviewed_at = now(),
                 staff_correction_note = NULL
             WHERE id = $1`,
            [intakeId, staffUid],
          ),
        "23514",
        "PG-06 corrected review missing correction note",
      );

      await expectPgError(
        client,
        "sp_pg06_not_reviewed_with_uid",
        () =>
          client.query(
            `UPDATE patient_intakes
             SET staff_review_status = 'not_reviewed',
                 reviewed_by_uid = $2
             WHERE id = $1`,
            [intakeId, staffUid],
          ),
        "23514",
        "PG-06 not_reviewed with non-null reviewed_by_uid",
      );

      // Valid confirmed & corrected transitions MUST succeed.
      await client.query(
        `UPDATE patient_intakes
         SET staff_review_status = 'confirmed',
             reviewed_by_uid = $2,
             reviewed_at = now(),
             staff_correction_note = NULL
         WHERE id = $1`,
        [intakeId, staffUid],
      );
      await client.query(
        `UPDATE patient_intakes
         SET staff_review_status = 'corrected',
             staff_reviewed_brief = '{"schemaVersion":"1.0"}'::jsonb,
             reviewed_by_uid = $2,
             reviewed_at = now(),
             staff_correction_note = 'Clarified timeline with patient.'
         WHERE id = $1`,
        [intakeId, staffUid],
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);

test(
  "Live Neon PostgreSQL: pooled runtime DATABASE_URL executes Drizzle StaffRepository reads cleanly",
  { skip: !HAS_LIVE_DB },
  async () => {
    // Confirm pooled runtime DATABASE_URL is valid before invoking Drizzle StaffRepository.
    assert.ok(getDatabaseUrl().startsWith("postgres"));

    const repo = createDrizzleStaffRepository();
    try {
      const unprovisioned = await repo.findStaffAuthorizationByUid(
        "non-existent-live-check-uid",
      );
      assert.equal(unprovisioned, null);

      const queue = await repo.listFacilityIntakes({
        facilityId: CANONICAL_DEMO_FACILITY.id,
        includeCompleted: false,
        limit: 25,
        offset: 0,
      });
      assert.ok(Array.isArray(queue.items));
      assert.ok(queue.total >= 0);
      assert.ok(queue.unassignedCount >= 0);
      assert.ok(queue.aiUnavailableCount >= 0);

      const missingDetail = await repo.findFacilityIntakeDetail(
        CANONICAL_DEMO_FACILITY.id,
        "00000000-0000-4000-8000-000000000001",
      );
      assert.equal(missingDetail, null);
    } finally {
      await closeDbPool();
    }
  },
);
