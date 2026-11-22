import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { assertServerRuntime, getDatabaseUrl } from "@/lib/env/server";
import * as schema from "@/db/schema";

export type MedFlowDatabase = NodePgDatabase<typeof schema>;

interface GlobalDbState {
  medflowPgPool?: Pool;
  medflowDb?: MedFlowDatabase;
}

const globalForDb = globalThis as unknown as GlobalDbState;

function buildPoolConfig(connectionString: string): PoolConfig {
  const isLocalhost =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1");

  return {
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    // Neon PostgreSQL requires TLS; keep certificate verification enabled for remote hosts.
    ssl: isLocalhost ? undefined : { rejectUnauthorized: true },
  };
}

/**
 * Lazily initializes and returns the server-only Drizzle + pg Pool instance
 * backed by DATABASE_URL (Neon pooled runtime connection).
 * Never establishes a network connection at module import time.
 */
export function getDb(): MedFlowDatabase {
  assertServerRuntime();

  if (!globalForDb.medflowDb) {
    const connectionString = getDatabaseUrl();
    const pool = new Pool(buildPoolConfig(connectionString));
    globalForDb.medflowPgPool = pool;
    globalForDb.medflowDb = drizzle(pool, { schema });
  }

  return globalForDb.medflowDb;
}

export async function closeDbPool(): Promise<void> {
  assertServerRuntime();
  if (globalForDb.medflowPgPool) {
    await globalForDb.medflowPgPool.end();
    globalForDb.medflowPgPool = undefined;
    globalForDb.medflowDb = undefined;
  }
}

export { schema };
