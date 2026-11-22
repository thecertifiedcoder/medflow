import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertServerRuntime, getMigrationDatabaseUrl } from "@/lib/env/server";

/**
 * Idempotent server-only Drizzle SQL migration runner for Neon PostgreSQL.
 * Uses DATABASE_URL_UNPOOLED (direct connection, TLS verified) to apply
 * checked-in SQL migrations from ./drizzle without exposing credentials.
 */
export async function runMigrations(): Promise<void> {
  assertServerRuntime();
  const connectionString = getMigrationDatabaseUrl();

  const isLocalhost =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1");

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15_000,
    ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
  });

  const db = drizzle(pool);
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  try {
    await migrate(db, { migrationsFolder });
    console.info("Applied Neon PostgreSQL Drizzle migrations successfully.");
  } finally {
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith("migrate.ts");

if (isDirectExecution) {
  void runMigrations().catch((error: unknown) => {
    console.error(
      "MedFlow migration failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
