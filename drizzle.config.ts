import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for Neon PostgreSQL.
 * Uses DATABASE_URL_UNPOOLED (direct connection) for schema migrations,
 * falling back to DATABASE_URL only if an unpooled URL is not set.
 * Credentials are never committed and are only read when the founder runs migrations.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
