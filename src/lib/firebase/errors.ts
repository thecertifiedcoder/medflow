import type { Auth } from "firebase/auth";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("the client is offline") || msg.includes("unavailable");
}

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    code === "permission-denied" ||
    msg.includes("missing or insufficient permissions") ||
    msg.includes("permission_denied")
  );
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("quota exceeded");
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authInstance?: Auth | null,
): never {
  const currentUser = authInstance?.currentUser ?? null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error("Firestore Error:", serialized);
  throw new Error(serialized);
}
