import crypto from "node:crypto";
import { z } from "zod";
import {
  CANONICAL_DEMO_FACILITY,
  getSyntheticDemoIdentity,
  type DemoPersonaKey,
  type SyntheticDemoIdentity,
} from "@/db/invariants";
import {
  assertServerRuntime,
  getDemoModeConfig,
  getDemoSessionSecret,
  MAX_DEMO_SESSION_TTL_SECONDS,
} from "@/lib/env/server";

export const DEMO_SESSION_COOKIE_NAME = "medflow_demo_session";
export const DEMO_CSRF_HEADER_NAME = "x-medflow-demo-request";
export const DEMO_CSRF_HEADER_VALUE = "1";
export const DEMO_SESSION_REUSE_THRESHOLD_SECONDS = 300; // Reuse active same-persona session if >= 5 min left

const DEMO_TOKEN_VERSION = 1;
const MAX_CLOCK_SKEW_SECONDS = 30;
const MAX_REVOKED_ENTRIES = 5_000;

export class DemoSessionError extends Error {
  readonly statusCode: 400 | 401 | 403 | 503;
  readonly errorCode: string;

  constructor(
    statusCode: 400 | 401 | 403 | 503,
    errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "DemoSessionError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const DemoSessionPayloadSchema = z
  .object({
    v: z.literal(DEMO_TOKEN_VERSION),
    sid: z
      .string()
      .min(32)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    persona: z.enum(["admin", "clinical_staff"]),
    uid: z.string().min(1).max(128),
    role: z.enum(["admin", "nurse"]),
    facilityId: z.literal(CANONICAL_DEMO_FACILITY.id),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .strict();

export type DemoSessionPayload = z.infer<typeof DemoSessionPayloadSchema>;

export interface VerifiedDemoSession {
  readonly sid: string;
  readonly persona: DemoPersonaKey;
  readonly identity: SyntheticDemoIdentity;
  readonly facilityId: typeof CANONICAL_DEMO_FACILITY.id;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface DemoSessionRevocationStore {
  revoke(sid: string, expiresAtSeconds: number, nowSeconds?: number): void;
  isRevoked(sid: string, nowSeconds?: number): boolean;
  size(): number;
  clear(): void;
}

/**
 * Process-local server-side revocation registry for Hackathon Demo Mode.
 * Tracks revoked session IDs until their natural expiration timestamp so
 * logged-out or superseded cookies cannot be replayed.
 */
export function createInMemoryRevocationStore(): DemoSessionRevocationStore {
  const revoked = new Map<string, number>();

  const prune = (nowSeconds: number): void => {
    for (const [sid, exp] of revoked.entries()) {
      if (exp <= nowSeconds) {
        revoked.delete(sid);
      }
    }
    if (revoked.size > MAX_REVOKED_ENTRIES) {
      // Evict oldest-expiring entries first while keeping memory bounded.
      const sorted = [...revoked.entries()].sort((a, b) => a[1] - b[1]);
      const excess = revoked.size - MAX_REVOKED_ENTRIES;
      for (let i = 0; i < excess; i += 1) {
        const entry = sorted[i];
        if (entry) revoked.delete(entry[0]);
      }
    }
  };

  return {
    revoke(sid: string, expiresAtSeconds: number, nowSeconds?: number): void {
      const now = nowSeconds ?? Math.floor(Date.now() / 1000);
      prune(now);
      if (expiresAtSeconds > now) {
        revoked.set(sid, expiresAtSeconds);
      }
    },
    isRevoked(sid: string, nowSeconds?: number): boolean {
      const now = nowSeconds ?? Math.floor(Date.now() / 1000);
      const exp = revoked.get(sid);
      if (exp === undefined) return false;
      if (exp <= now) {
        revoked.delete(sid);
        return false;
      }
      return true;
    },
    size(): number {
      return revoked.size;
    },
    clear(): void {
      revoked.clear();
    },
  };
}

declare global {
  var __medflowDemoRevocationStore: DemoSessionRevocationStore | undefined;
}

export function getGlobalDemoRevocationStore(): DemoSessionRevocationStore {
  assertServerRuntime();
  if (!globalThis.__medflowDemoRevocationStore) {
    globalThis.__medflowDemoRevocationStore = createInMemoryRevocationStore();
  }
  return globalThis.__medflowDemoRevocationStore;
}

function signEncodedPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`v${DEMO_TOKEN_VERSION}.${encodedPayload}`, "utf8")
    .digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface DemoSessionCryptoOptions {
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => Date;
  readonly revocationStore?: DemoSessionRevocationStore;
}

/**
 * Ensures Demo Mode is enabled and properly configured on the server.
 * Throws fail-closed 403 (disabled) or 503 (misconfigured) otherwise.
 */
export function assertDemoModeReady(
  env: Record<string, string | undefined> = process.env,
): { readonly secret: string; readonly ttlSeconds: number } {
  assertServerRuntime();
  const config = getDemoModeConfig(env);
  if (!config.enabled) {
    throw new DemoSessionError(
      403,
      "DEMO_MODE_DISABLED",
      "Hackathon Demo Mode is disabled on this server.",
    );
  }
  if (!config.configured) {
    throw new DemoSessionError(
      503,
      "DEMO_MODE_MISCONFIGURED",
      "Hackathon Demo Mode is enabled but required server session configuration is missing or invalid.",
    );
  }
  const secret = getDemoSessionSecret(env);
  return { secret, ttlSeconds: config.ttlSeconds };
}

/**
 * Mints a cryptographically signed, server-defined demo session token for a
 * fixed persona (`admin` or `clinical_staff`) scoped strictly to `demo-clinic-01`.
 */
export function mintDemoSessionToken(
  persona: DemoPersonaKey,
  options: DemoSessionCryptoOptions = {},
): {
  readonly token: string;
  readonly session: VerifiedDemoSession;
  readonly ttlSeconds: number;
} {
  assertServerRuntime();
  const { secret, ttlSeconds } = assertDemoModeReady(options.env);
  const identity = getSyntheticDemoIdentity(persona);
  const nowSeconds = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const sid = crypto.randomBytes(32).toString("base64url");

  const payload: DemoSessionPayload = {
    v: DEMO_TOKEN_VERSION,
    sid,
    persona: identity.persona,
    uid: identity.uid,
    role: identity.role,
    facilityId: CANONICAL_DEMO_FACILITY.id,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signEncodedPayload(encodedPayload, secret);
  const token = `v${DEMO_TOKEN_VERSION}.${encodedPayload}.${signature}`;

  return {
    token,
    ttlSeconds,
    session: {
      sid: payload.sid,
      persona: identity.persona,
      identity,
      facilityId: CANONICAL_DEMO_FACILITY.id,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    },
  };
}

/**
 * Verifies a signed demo session token strictly on the server:
 * - Demo Mode enabled & secret configured
 * - Exact token structure & HMAC-SHA256 constant-time verification
 * - Strict payload schema and fixed persona/uid/role/facility invariants
 * - Expiration & clock skew checks
 * - Server-side revocation registry check
 */
export function verifyDemoSessionToken(
  rawToken: string,
  options: DemoSessionCryptoOptions = {},
): VerifiedDemoSession {
  assertServerRuntime();
  const { secret } = assertDemoModeReady(options.env);
  const nowSeconds = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const revocationStore =
    options.revocationStore ?? getGlobalDemoRevocationStore();

  const token = rawToken.trim();
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== `v${DEMO_TOKEN_VERSION}`) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session is invalid. Start a new demo session from the overview page.",
    );
  }

  const encodedPayload = parts[1] ?? "";
  const providedSig = parts[2] ?? "";
  if (
    encodedPayload.length === 0 ||
    providedSig.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    !/^[A-Za-z0-9_-]+$/.test(providedSig)
  ) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session is malformed. Start a new demo session from the overview page.",
    );
  }

  const expectedSig = signEncodedPayload(encodedPayload, secret);
  if (!constantTimeEquals(providedSig, expectedSig)) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session signature could not be verified. Please start a new demo session.",
    );
  }

  let parsedJson: unknown;
  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    parsedJson = JSON.parse(decoded);
  } catch {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session payload is corrupted. Please start a new demo session.",
    );
  }

  const parsedPayload = DemoSessionPayloadSchema.safeParse(parsedJson);
  if (!parsedPayload.success) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session payload failed validation. Please start a new demo session.",
    );
  }

  const payload = parsedPayload.data;
  const expectedIdentity = getSyntheticDemoIdentity(payload.persona);

  // Enforce fixed server-defined persona-to-UID-to-role-to-facility binding.
  if (
    payload.uid !== expectedIdentity.uid ||
    payload.role !== expectedIdentity.role ||
    payload.facilityId !== CANONICAL_DEMO_FACILITY.id
  ) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session identity binding is invalid. Please start a new demo session.",
    );
  }

  if (
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > MAX_DEMO_SESSION_TTL_SECONDS ||
    payload.iat > nowSeconds + MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_INVALID",
      "Your demo session timestamps are invalid. Please start a new demo session.",
    );
  }

  if (payload.exp <= nowSeconds) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_EXPIRED",
      "Your demo session has expired. Select a demo role to start a fresh session.",
    );
  }

  if (revocationStore.isRevoked(payload.sid, nowSeconds)) {
    throw new DemoSessionError(
      401,
      "DEMO_SESSION_REVOKED",
      "This demo session was signed out or replaced. Select a demo role to continue.",
    );
  }

  return {
    sid: payload.sid,
    persona: payload.persona,
    identity: expectedIdentity,
    facilityId: CANONICAL_DEMO_FACILITY.id,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

/**
 * Parses a raw HTTP `Cookie` header safely and returns the demo session cookie value if present.
 */
export function extractDemoSessionCookie(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader || cookieHeader.trim().length === 0) return null;

  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const eqIndex = segment.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = segment.slice(0, eqIndex).trim();
    if (name !== DEMO_SESSION_COOKIE_NAME) continue;
    const value = segment.slice(eqIndex + 1).trim();
    if (value.length === 0) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export interface DemoCookieSecurityContext {
  readonly isProduction: boolean;
  readonly isHttpsRequest: boolean;
}

function isLocalLoopbackHost(rawHost: string | null | undefined): boolean {
  const normalized = normalizeHost(rawHost);
  if (!normalized) return false;
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "[::1]" ||
    normalized.startsWith("[::1]:") ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("0.0.0.0:")
  );
}

function hasHttpsForwardedHeader(rawForwarded: string | null | undefined): boolean {
  if (!rawForwarded) return false;
  return /\bproto\s*=\s*"?https"?\b/i.test(rawForwarded);
}

export function resolveDemoCookieSecurityContext(request: {
  readonly url?: string | null;
  readonly forwardedProto?: string | null;
  readonly forwardedHeader?: string | null;
  readonly originHeader?: string | null;
  readonly refererHeader?: string | null;
  readonly hostHeader?: string | null;
  readonly forwardedHostHeader?: string | null;
  readonly nodeEnv?: string | undefined;
}): DemoCookieSecurityContext {
  const isProduction = (request.nodeEnv ?? process.env.NODE_ENV) === "production";
  const forwardedProto = request.forwardedProto
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const isHttpsUrl = Boolean(
    request.url?.trim().toLowerCase().startsWith("https://"),
  );
  const isHttpsOrigin = Boolean(
    request.originHeader?.trim().toLowerCase().startsWith("https://"),
  );
  const isHttpsReferer = Boolean(
    request.refererHeader?.trim().toLowerCase().startsWith("https://"),
  );
  const effectiveHost =
    normalizeHost(request.forwardedHostHeader) ?? normalizeHost(request.hostHeader);
  const isHostedRemoteOrigin =
    Boolean(effectiveHost) && !isLocalLoopbackHost(effectiveHost);

  const isHttpsRequest =
    forwardedProto === "https" ||
    hasHttpsForwardedHeader(request.forwardedHeader) ||
    isHttpsUrl ||
    isHttpsOrigin ||
    isHttpsReferer ||
    isHostedRemoteOrigin;
  return { isProduction, isHttpsRequest };
}

/**
 * Builds the `Set-Cookie` header for establishing a Demo Mode session.
 *
 * - Always `HttpOnly` and `Path=/`.
 * - In production or HTTPS environments (including Cloud Run & AI Studio Preview),
 *   sets `Secure; SameSite=None; Partitioned` so sessions remain HTTP-only,
 *   transport-protected, and compatible with top-level tabs and partitioned frames.
 * - On local non-HTTPS HTTP (`localhost`), uses `SameSite=Lax` without `Secure`
 *   so local browsers accept the cookie while keeping `HttpOnly`.
 */
export function buildDemoSessionSetCookieHeader(
  token: string,
  ttlSeconds: number,
  context: DemoCookieSecurityContext,
): string {
  const useSecureContext = context.isProduction || context.isHttpsRequest;
  const attributes = [
    `${DEMO_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(ttlSeconds))}`,
    "HttpOnly",
  ];

  if (useSecureContext) {
    attributes.push("Secure", "SameSite=None", "Partitioned");
  } else {
    attributes.push("SameSite=Lax");
  }

  return attributes.join("; ");
}

/**
 * Builds the `Set-Cookie` header that clears the Demo Mode cookie immediately.
 */
export function buildDemoSessionClearCookieHeader(
  context: DemoCookieSecurityContext,
): string {
  const useSecureContext = context.isProduction || context.isHttpsRequest;
  const attributes = [
    `${DEMO_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
  ];

  if (useSecureContext) {
    attributes.push("Secure", "SameSite=None", "Partitioned");
  } else {
    attributes.push("SameSite=Lax");
  }

  return attributes.join("; ");
}

function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const first = rawHost.split(",")[0]?.trim().toLowerCase();
  return first && first.length > 0 ? first : null;
}

function extractOriginHost(rawOriginOrReferer: string | null | undefined): string | null {
  if (!rawOriginOrReferer) return null;
  try {
    return new URL(rawOriginOrReferer).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Protects cookie-issuing and cookie-revoking POST routes against cross-site
 * request forgery (CSRF):
 * 1. Requires the explicit non-simple custom header `X-MedFlow-Demo-Request: 1`.
 * 2. When `Origin` (or `Referer`) is present, requires its host to match the
 *    request's `X-Forwarded-Host` or `Host` header.
 */
export function validateDemoCsrfRequest(request: {
  readonly csrfHeader: string | null | undefined;
  readonly originHeader: string | null | undefined;
  readonly refererHeader?: string | null | undefined;
  readonly hostHeader: string | null | undefined;
  readonly forwardedHostHeader?: string | null | undefined;
}): void {
  if (request.csrfHeader?.trim() !== DEMO_CSRF_HEADER_VALUE) {
    throw new DemoSessionError(
      403,
      "CSRF_HEADER_REQUIRED",
      "Missing required same-origin demo request header.",
    );
  }

  const expectedHost =
    normalizeHost(request.forwardedHostHeader) ?? normalizeHost(request.hostHeader);

  if (request.originHeader && request.originHeader.trim().length > 0) {
    const originHost = extractOriginHost(request.originHeader);
    if (!originHost || !expectedHost || originHost !== expectedHost) {
      throw new DemoSessionError(
        403,
        "CSRF_ORIGIN_MISMATCH",
        "Cross-origin demo session requests are not permitted.",
      );
    }
    return;
  }

  if (request.refererHeader && request.refererHeader.trim().length > 0) {
    const refererHost = extractOriginHost(request.refererHeader);
    if (!refererHost || !expectedHost || refererHost !== expectedHost) {
      throw new DemoSessionError(
        403,
        "CSRF_ORIGIN_MISMATCH",
        "Cross-origin demo session requests are not permitted.",
      );
    }
  }
}

/**
 * Rejects any client-supplied body parameters (e.g., `role`, `facilityId`, `uid`)
 * on fixed persona entry routes. Only an empty body or `{}` is accepted.
 */
export function assertEmptyDemoRequestBody(rawBodyText: string | null | undefined): void {
  const trimmed = rawBodyText?.trim() ?? "";
  if (trimmed.length === 0) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new DemoSessionError(
      400,
      "INVALID_REQUEST_BODY",
      "Demo session endpoints do not accept custom request payloads.",
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length > 0
  ) {
    throw new DemoSessionError(
      400,
      "UNSUPPORTED_REQUEST_BODY",
      "Demo roles and facilities are fixed on the server and cannot be specified by the browser.",
    );
  }
}
