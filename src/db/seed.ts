import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import {
  CANONICAL_DEMO_FACILITY,
  SYNTHETIC_DEMO_IDENTITIES,
} from "@/db/invariants";
import {
  facilities,
  facilityMemberships,
  staffProfiles,
} from "@/db/schema";
import { getMigrationDatabaseUrl } from "@/lib/env/server";
import { StaffRoleSchema } from "@/lib/schemas/intake";

const SeedAdminInputSchema = z
  .object({
    uid: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().trim().email().max(254),
    displayName: z.string().trim().min(1).max(120),
    role: StaffRoleSchema.default("admin"),
  })
  .strict();

export type SeedAdminInput = z.infer<typeof SeedAdminInputSchema>;

/**
 * Parses optional founder-supplied environment variables for seeding an initial
 * staff administrator alongside the synthetic demo facility.
 * Returns null if none of the SEED_ADMIN_* variables are set.
 * Throws if only a partial set is supplied so misconfigurations fail safely.
 */
export function parseOptionalSeedAdminEnv(
  env: Record<string, string | undefined> = process.env,
): SeedAdminInput | null {
  const uid = env.SEED_ADMIN_UID?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const displayName = env.SEED_ADMIN_DISPLAY_NAME?.trim();
  const role = env.SEED_ADMIN_ROLE?.trim() || undefined;

  if (!uid && !email && !displayName) {
    return null;
  }

  return SeedAdminInputSchema.parse({
    uid,
    email,
    displayName,
    role,
  });
}

/**
 * Idempotent founder-run CLI seed script for Neon PostgreSQL.
 *
 * Usage (ONLY after Neon database is provisioned and migrations have run):
 *   1. Facility only:
 *      DATABASE_URL_UNPOOLED="..." npx tsx src/db/seed.ts
 *   2. Facility + initial staff admin (using real verified Firebase Auth UID):
 *      DATABASE_URL_UNPOOLED="..." \
 *      SEED_ADMIN_UID="<verified-firebase-uid>" \
 *      SEED_ADMIN_EMAIL="<verified-email>" \
 *      SEED_ADMIN_DISPLAY_NAME="Dr. Synthetic Admin" \
 *      npx tsx src/db/seed.ts
 *
 * Never executed automatically during builds or client requests.
 */
export async function runSeed(): Promise<void> {
  const connectionString = getMigrationDatabaseUrl();
  const adminInput = parseOptionalSeedAdminEnv();

  const isLocalhost =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1");

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
  });

  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(facilities)
        .values({
          id: CANONICAL_DEMO_FACILITY.id,
          name: CANONICAL_DEMO_FACILITY.name,
          publicCode: CANONICAL_DEMO_FACILITY.publicCode,
          timezone: CANONICAL_DEMO_FACILITY.timezone,
          isDemo: CANONICAL_DEMO_FACILITY.isDemo,
          active: CANONICAL_DEMO_FACILITY.active,
        })
        .onConflictDoUpdate({
          target: facilities.id,
          set: {
            name: CANONICAL_DEMO_FACILITY.name,
            publicCode: CANONICAL_DEMO_FACILITY.publicCode,
            timezone: CANONICAL_DEMO_FACILITY.timezone,
            isDemo: CANONICAL_DEMO_FACILITY.isDemo,
            active: CANONICAL_DEMO_FACILITY.active,
            updatedAt: new Date(),
          },
        });

      // Seed the two fixed synthetic Hackathon Demo Mode staff identities strictly
      // inside the canonical synthetic facility `demo-clinic-01` (DA-1).
      // These accounts are only usable when MEDFLOW_DEMO_MODE_ENABLED=true and are
      // explicitly blocked from Firebase Bearer authentication.
      for (const demoIdentity of Object.values(SYNTHETIC_DEMO_IDENTITIES)) {
        await tx
          .insert(staffProfiles)
          .values({
            uid: demoIdentity.uid,
            email: demoIdentity.email,
            displayName: demoIdentity.displayName,
            active: true,
          })
          .onConflictDoUpdate({
            target: staffProfiles.uid,
            set: {
              email: demoIdentity.email,
              displayName: demoIdentity.displayName,
              active: true,
              updatedAt: new Date(),
            },
          });

        await tx
          .insert(facilityMemberships)
          .values({
            staffUid: demoIdentity.uid,
            facilityId: CANONICAL_DEMO_FACILITY.id,
            role: demoIdentity.role,
            active: true,
          })
          .onConflictDoUpdate({
            target: [
              facilityMemberships.staffUid,
              facilityMemberships.facilityId,
            ],
            set: {
              role: demoIdentity.role,
              active: true,
              updatedAt: new Date(),
            },
          });
      }

      if (adminInput) {
        await tx
          .insert(staffProfiles)
          .values({
            uid: adminInput.uid,
            email: adminInput.email,
            displayName: adminInput.displayName,
            active: true,
          })
          .onConflictDoUpdate({
            target: staffProfiles.uid,
            set: {
              email: adminInput.email,
              displayName: adminInput.displayName,
              active: true,
              updatedAt: new Date(),
            },
          });

        await tx
          .insert(facilityMemberships)
          .values({
            staffUid: adminInput.uid,
            facilityId: CANONICAL_DEMO_FACILITY.id,
            role: adminInput.role,
            active: true,
          })
          .onConflictDoUpdate({
            target: [
              facilityMemberships.staffUid,
              facilityMemberships.facilityId,
            ],
            set: {
              role: adminInput.role,
              active: true,
              updatedAt: new Date(),
            },
          });
      }
    });

    console.info(
      `Seeded canonical synthetic facility ${CANONICAL_DEMO_FACILITY.id} (${CANONICAL_DEMO_FACILITY.publicCode}) and synthetic demo staff identities (demo-admin-01, demo-staff-01).`,
    );
    if (adminInput) {
      console.info(
        `Seeded active ${adminInput.role} staff profile and membership for facility ${CANONICAL_DEMO_FACILITY.id}.`,
      );
    } else {
      console.info(
        "No SEED_ADMIN_* variables supplied; skipped initial Firebase staff profile seeding.",
      );
    }
  } finally {
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith("seed.ts");

if (isDirectExecution) {
  void runSeed().catch((error: unknown) => {
    console.error(
      "MedFlow seed failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
