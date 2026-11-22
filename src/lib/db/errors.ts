import { assertServerRuntime } from "@/lib/env/server";

/**
 * Safe server-only error class for database configuration or connectivity
 * issues. Its message is safe for API responses and never exposes connection
 * strings, SQL statements, hostnames, or pg driver internals.
 */
export class DatabaseUnavailableError extends Error {
  readonly statusCode = 503 as const;
  readonly errorCode = "DATABASE_UNAVAILABLE" as const;

  constructor(
    message = "The clinical database service is currently unavailable. Please retry shortly.",
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

const PG_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "53300", // too_many_connections
]);

/**
 * Classifies unknown database errors without ever surfacing raw pg error text,
 * SQL text, or connection URIs.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  assertServerRuntime();

  if (error instanceof DatabaseUnavailableError) {
    return true;
  }

  if (error instanceof Error) {
    if (
      error.message.includes("DATABASE_URL is not configured") ||
      error.message.includes("DATABASE_URL must be a valid PostgreSQL")
    ) {
      return true;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && PG_UNAVAILABLE_CODES.has(code)) {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const causeCode = (cause as { code?: unknown }).code;
      if (typeof causeCode === "string" && PG_UNAVAILABLE_CODES.has(causeCode)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Converts an unknown database failure into a safe, non-leaking HTTP error tuple.
 */
export function toSafeDatabaseError(error: unknown): {
  readonly statusCode: 503 | 500;
  readonly errorCode: "DATABASE_UNAVAILABLE" | "DATABASE_QUERY_FAILED";
  readonly message: string;
} {
  assertServerRuntime();

  if (isDatabaseUnavailableError(error)) {
    return {
      statusCode: 503,
      errorCode: "DATABASE_UNAVAILABLE",
      message:
        "The clinical database service is currently unavailable. Please retry shortly.",
    };
  }

  return {
    statusCode: 500,
    errorCode: "DATABASE_QUERY_FAILED",
    message: "Unable to complete the clinical data request right now.",
  };
}
