"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
  testFirestoreConnection,
} from "@/lib/firebase/client";
import {
  handleFirestoreError,
  isOfflineError,
  isPermissionDeniedError,
  OperationType,
} from "@/lib/firebase/errors";
import {
  StaffProfileSchema,
  StaffSessionResponseSchema,
  type StaffProfile,
  type StaffSessionResponse,
} from "@/lib/schemas/staff";

export type StaffAuthStatus =
  | "loading"
  | "unauthenticated"
  | "verifying"
  | "unverified_email"
  | "unprovisioned"
  | "inactive"
  | "authorized"
  | "error";

export interface StaffAuthState {
  readonly status: StaffAuthStatus;
  readonly firebaseUser: {
    readonly uid: string;
    readonly email: string | null;
    readonly emailVerified: boolean;
    readonly displayName: string | null;
  } | null;
  readonly serverSession: StaffSessionResponse | null;
  readonly staffProfile: StaffProfile | null;
  readonly activeFacilityId: string | null;
  readonly connectionReachable: boolean | null;
  readonly errorMessage: string | null;
  readonly isSigningIn: boolean;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signOutStaff: () => Promise<void>;
  readonly refreshAuthorization: () => Promise<void>;
  readonly setActiveFacilityId: (facilityId: string) => void;
}

const StaffAuthContext = createContext<StaffAuthState | null>(null);

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StaffAuthStatus>("loading");
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [serverSession, setServerSession] =
    useState<StaffSessionResponse | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [activeFacilityId, setActiveFacilityIdState] = useState<string | null>(
    null,
  );
  const [connectionReachable, setConnectionReachable] = useState<
    boolean | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const verifyUserAndProfile = useCallback(async (user: User) => {
    setStatus("verifying");
    setErrorMessage(null);
    setServerSession(null);
    setStaffProfile(null);

    if (!user.emailVerified) {
      setStatus("unverified_email");
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/staff/session", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; code?: string };
        } | null;
        if (response.status === 403 && body?.error?.code === "EMAIL_NOT_VERIFIED") {
          setStatus("unverified_email");
          return;
        }
        setErrorMessage(
          body?.error?.message ??
            "Server-side Firebase ID token verification did not succeed.",
        );
        setStatus("error");
        return;
      }

      const parsedSession = StaffSessionResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsedSession.success || parsedSession.data.user.uid !== user.uid) {
        setErrorMessage("Unexpected server session verification response.");
        setStatus("error");
        return;
      }

      setServerSession(parsedSession.data);

      // Owner-only Firestore read of /staff/{uid} enforced by firestore.rules.
      const staffPath = `staff/${user.uid}`;
      let snapshot;
      try {
        snapshot = await getDoc(doc(db, "staff", user.uid));
      } catch (err) {
        if (isOfflineError(err)) {
          setConnectionReachable(false);
          setErrorMessage(
            "Unable to reach Firestore to verify staff provisioning.",
          );
          setStatus("error");
          return;
        }
        if (isPermissionDeniedError(err)) {
          // Owner-only get denied only if email is unverified or rules rejected UID.
          handleFirestoreError(err, OperationType.GET, staffPath, auth);
        }
        throw err;
      }

      if (!snapshot.exists()) {
        setStaffProfile(null);
        setActiveFacilityIdState(null);
        setStatus("unprovisioned");
        return;
      }

      const parsedProfile = StaffProfileSchema.safeParse(snapshot.data());
      if (!parsedProfile.success || parsedProfile.data.uid !== user.uid) {
        setErrorMessage(
          "Staff profile record exists but does not match the required MedFlow authorization schema.",
        );
        setStatus("error");
        return;
      }

      const profile = parsedProfile.data;
      setStaffProfile(profile);

      if (!profile.active || profile.facilityIds.length === 0) {
        setActiveFacilityIdState(null);
        setStatus("inactive");
        return;
      }

      setActiveFacilityIdState((prev) =>
        prev && profile.facilityIds.includes(prev)
          ? prev
          : profile.facilityIds[0] ?? null,
      );
      setStatus("authorized");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to verify staff authorization.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    testFirestoreConnection().then((result) => {
      if (active) {
        setConnectionReachable(result.reachable);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      setRawUser(user);
      if (!user) {
        setServerSession(null);
        setStaffProfile(null);
        setActiveFacilityIdState(null);
        setErrorMessage(null);
        setStatus("unauthenticated");
        return;
      }
      void verifyUserAndProfile(user);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [verifyUserAndProfile]);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";
      if (code === "auth/popup-closed-by-user") {
        setErrorMessage("Sign-in window was closed before completing Google Sign-In.");
      } else if (code === "auth/popup-blocked") {
        setErrorMessage(
          "Your browser blocked the Google Sign-In popup. Allow popups for this preview and try again.",
        );
      } else {
        setErrorMessage("Google Sign-In could not be completed. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOutStaff = useCallback(async () => {
    setErrorMessage(null);
    await signOut(auth);
  }, []);

  const refreshAuthorization = useCallback(async () => {
    if (!auth.currentUser) {
      setStatus("unauthenticated");
      return;
    }
    await verifyUserAndProfile(auth.currentUser);
  }, [verifyUserAndProfile]);

  const setActiveFacilityId = useCallback(
    (facilityId: string) => {
      if (staffProfile && staffProfile.facilityIds.includes(facilityId)) {
        setActiveFacilityIdState(facilityId);
      }
    },
    [staffProfile],
  );

  const firebaseUser = rawUser
    ? {
        uid: rawUser.uid,
        email: rawUser.email,
        emailVerified: rawUser.emailVerified,
        displayName: rawUser.displayName,
      }
    : null;

  return (
    <StaffAuthContext.Provider
      value={{
        status,
        firebaseUser,
        serverSession,
        staffProfile,
        activeFacilityId,
        connectionReachable,
        errorMessage,
        isSigningIn,
        signInWithGoogle,
        signOutStaff,
        refreshAuthorization,
        setActiveFacilityId,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth(): StaffAuthState {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) {
    throw new Error("useStaffAuth must be used within a StaffAuthProvider.");
  }
  return ctx;
}
