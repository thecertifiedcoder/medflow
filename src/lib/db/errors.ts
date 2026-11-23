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
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "57014", // query_canceled / statement_timeout
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "08P01", // protocol_violation
  "28000", // invalid_authorization_specification
  "28P01", // invalid_password
  "53300", // too_many_connections
]);

const DB_UNAVAILABLE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /DATABASE_URL is not configured/i,
  /DATABASE_URL must be a valid PostgreSQL/i,
  /connection terminated unexpectedly/i,
  /timeout exceeded when trying to connect/i,
  /connection timed out/i,
  /socket hang up/i,
  /getaddrinfo/i,
  /endpoint is disabled/i,
  /the server does not support ssl connections/i,
  /self[- ]signed certificate/i,
  /unable to verify the first certificate/i,
  /password authentication failed/i,
];

export interface PgErrorMetadata {
  readonly errorName: string;
  readonly pgCode: string | null;
  readonly constraint: string | null;
}

/**
 * Extracts strictly non-sensitive exception metadata (error class, SQLSTATE /
 * Node network code, and PostgreSQL constraint name). Never returns raw error
 * messages, SQL statements, connection URIs, or user/patient payloads.
 */
export function extractPgErrorMetadata(error: unknown): PgErrorMetadata {
  if (!(error instanceof Error)) {
    return { errorName: typeof error, pgCode: null, constraint: null };
  }

  const direct = error as {
    code?: unknown;
    constraint?: unknown;
    cause?: unknown;
  };
  const cause =
    direct.cause && typeof direct.cause === "object"
      ? (direct.cause as { code?: unknown; constraint?: unknown })
      : null;

  const pgCode =
    typeof direct.code === "string"
      ? direct.code
      : typeof cause?.code === "string"
        ? cause.code
        : null;

  const constraint =
    typeof direct.constraint === "string"
      ? direct.constraint
      : typeof cause?.constraint === "string"
        ? cause.constraint
        : null;

  return {
    errorName: error.name || "Error",
    pgCode,
    constraint,
  };
}

/**
 * Classifies unknown database errors without ever surfacing raw pg error text,
 * SQL text, or connection URIs.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  assertServerRuntime();

  if (error instanceof DatabaseUnavailableError) {
    return true;
  }

  const meta = extractPgErrorMetadata(error);
  if (meta.pgCode && PG_UNAVAILABLE_CODES.has(meta.pgCode)) {
    return true;
  }

  if (error instanceof Error) {
    const messagesToCheck: string[] = [error.message];
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      messagesToCheck.push(cause.message);
    }

    for (const msg of messagesToCheck) {
      if (DB_UNAVAILABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(msg))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns a sanitized server-side diagnostic summary suitable for structured
 * production logs. Guaranteed free of PHI, credentials, and raw SQL.
 */
export function describeSafeServerError(error: unknown): {
  readonly errorName: string;
  readonly pgCode: string | null;
  readonly constraint: string | null;
  readonly category:
    | "database_unavailable"
    | "unique_violation"
    | "constraint_violation"
    | "validation_error"
    | "unexpected_server_error";
} {
  const meta = extractPgErrorMetadata(error);

  if (isDatabaseUnavailableError(error)) {
    return { ...meta, category: "database_unavailable" };
  }
  if (meta.pgCode === "23505") {
    return { ...meta, category: "unique_violation" };
  }
  if (meta.pgCode && meta.pgCode.startsWith("23")) {
    return { ...meta, category: "constraint_violation" };
  }
  if (meta.errorName === "ZodError") {
    return { ...meta, category: "validation_error" };
  }
  return { ...meta, category: "unexpected_server_error" };
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
