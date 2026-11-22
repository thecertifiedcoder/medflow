"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  AUTH_INIT_TIMEOUT_MS,
  classifyRedirectResultError,
  classifySignInError,
  deriveProfileAuthorizationStatus,
  extractFirebaseAuthErrorCode,
  isEmbeddedInIframe,
  isMobileUserAgent,
  REDIRECT_PENDING_STORAGE_KEY,
  sanitizeNonSecretAuthMessage,
  selectPreferredSignInMethod,
  SESSION_VERIFY_TIMEOUT_MS,
  type AuthDiagnostics,
  type GoogleSignInMethod,
  type StaffAuthStatus,
} from "@/lib/firebase/auth-state";
import {
  auth,
  db,
  effectiveAuthDomain,
  googleProvider,
  testFirestoreConnection,
  usesSameOriginAuthProxy,
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

export type {
  AuthDiagnostics,
  GoogleSignInMethod,
  RedirectResultState,
  StaffAuthStatus,
} from "@/lib/firebase/auth-state";

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
  readonly authNotice: string | null;
  readonly authDiagnostics: AuthDiagnostics;
  readonly preferredSignInMethod: GoogleSignInMethod;
  readonly canUseRedirectFallback: boolean;
  readonly suggestOpenInStandaloneTab: boolean;
  readonly isSigningIn: boolean;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signInWithGooglePopup: () => Promise<void>;
  readonly signInWithGoogleRedirect: () => Promise<void>;
  readonly cancelSignInAttempt: () => void;
  readonly signOutStaff: () => Promise<void>;
  readonly refreshAuthorization: () => Promise<void>;
  readonly setActiveFacilityId: (facilityId: string) => void;
}

const StaffAuthContext = createContext<StaffAuthState | null>(null);

function readRedirectPendingFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(REDIRECT_PENDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRedirectPendingFlag(pending: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (pending) {
      window.sessionStorage.setItem(REDIRECT_PENDING_STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(REDIRECT_PENDING_STORAGE_KEY);
    }
  } catch {
    // Restricted storage inside embedded frames is safe to ignore.
  }
}

function buildInitialDiagnostics(): AuthDiagnostics {
  return {
    lastErrorCode: null,
    lastErrorSummary: null,
    redirectResultState: "pending",
    authStateResolved: false,
    isEmbeddedIframe: false,
    isMobileBrowser: false,
    currentHost: null,
    authDomain: effectiveAuthDomain,
    usesSameOriginProxy: usesSameOriginAuthProxy,
  };
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StaffAuthStatus>("initializing");
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
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [canUseRedirectFallback, setCanUseRedirectFallback] = useState(false);
  const [suggestOpenInStandaloneTab, setSuggestOpenInStandaloneTab] =
    useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics>(
    buildInitialDiagnostics,
  );

  const verificationRunIdRef = useRef(0);
  const verifyingUidRef = useRef<string | null>(null);
  const activeUserUidRef = useRef<string | null>(null);
  const authAttemptInFlightRef = useRef(false);
  const authResolvedRef = useRef(false);
  const statusRef = useRef<StaffAuthStatus>(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const verifyUserAndProfile = useCallback(async (user: User, force = false) => {
    // Deduplicate concurrent verification triggers from signInWithPopup / getRedirectResult / onAuthStateChanged.
    if (!force && verifyingUidRef.current === user.uid) {
      return;
    }

    const runId = ++verificationRunIdRef.current;
    verifyingUidRef.current = user.uid;
    activeUserUidRef.current = user.uid;
    authAttemptInFlightRef.current = false;
    setRawUser(user);
    setStatus("verifying");
    setErrorMessage(null);
    setAuthNotice(null);
    setCanUseRedirectFallback(false);
    setSuggestOpenInStandaloneTab(false);
    setServerSession(null);
    setStaffProfile(null);
    setAuthDiagnostics((prev) => ({
      ...prev,
      lastErrorCode: null,
      lastErrorSummary: null,
      authStateResolved: true,
    }));

    if (!user.emailVerified) {
      if (runId !== verificationRunIdRef.current) return;
      verifyingUidRef.current = null;
      setStatus("unverified_email");
      return;
    }

    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(
      () => controller.abort(),
      SESSION_VERIFY_TIMEOUT_MS,
    );

    try {
      const idToken = await user.getIdToken();
      if (runId !== verificationRunIdRef.current) return;

      const response = await fetch("/api/staff/session", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (runId !== verificationRunIdRef.current) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; code?: string };
        } | null;
        if (
          response.status === 403 &&
          body?.error?.code === "EMAIL_NOT_VERIFIED"
        ) {
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
      if (runId !== verificationRunIdRef.current) return;

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
        if (runId !== verificationRunIdRef.current) return;
        if (isOfflineError(err)) {
          setConnectionReachable(false);
          setErrorMessage(
            "Unable to reach Firestore to verify staff provisioning. Check your connection and retry.",
          );
          setStatus("error");
          return;
        }
        if (isPermissionDeniedError(err)) {
          try {
            handleFirestoreError(err, OperationType.GET, staffPath, auth);
          } catch {
            // Structured diagnostic logged by handleFirestoreError; surface a clean UI message.
          }
          setErrorMessage(
            "Firestore denied reading your staff profile record. Confirm your Google email is verified and retry.",
          );
          setStatus("error");
          return;
        }
        throw err;
      }

      if (runId !== verificationRunIdRef.current) return;

      if (!snapshot.exists()) {
        setStaffProfile(null);
        setActiveFacilityIdState(null);
        setStatus("unprovisioned");
        return;
      }

      const parsedProfile = StaffProfileSchema.safeParse(snapshot.data());
      if (!parsedProfile.success) {
        setErrorMessage(
          "Staff profile record exists but does not match the required MedFlow authorization schema.",
        );
        setStatus("error");
        return;
      }

      const profile = parsedProfile.data;
      setStaffProfile(profile);

      let nextFacilityId: string | null = null;
      setActiveFacilityIdState((prev) => {
        const result = deriveProfileAuthorizationStatus(profile, user.uid, prev);
        nextFacilityId = result.activeFacilityId;
        return nextFacilityId;
      });

      const decision = deriveProfileAuthorizationStatus(
        profile,
        user.uid,
        nextFacilityId,
      );
      if (decision.status === "error") {
        setErrorMessage(decision.errorMessage);
        setStatus("error");
        return;
      }
      if (decision.status === "inactive") {
        setStatus("inactive");
        return;
      }

      setStatus("authorized");
    } catch (err) {
      if (runId !== verificationRunIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage(
          "Session verification timed out before the server responded. Please retry.",
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Unable to verify staff authorization.",
        );
      }
      setStatus("error");
    } finally {
      window.clearTimeout(timeoutHandle);
      if (runId === verificationRunIdRef.current) {
        verifyingUidRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    authResolvedRef.current = false;

    const embedded = isEmbeddedInIframe();
    const mobile = isMobileUserAgent();
    const host =
      typeof window !== "undefined" ? window.location.host : null;
    const redirectWasPending = readRedirectPendingFlag();
    let redirectSettled = !redirectWasPending;

    // Background connectivity probe; never blocks auth initialization.
    void testFirestoreConnection().then((result) => {
      if (active) {
        setConnectionReachable(result.reachable);
      }
    });

    // Bounded initialization watchdog so the UI can never stay stuck indefinitely.
    const initTimeoutId = window.setTimeout(() => {
      if (!active || authResolvedRef.current) return;
      writeRedirectPendingFlag(false);
      authAttemptInFlightRef.current = false;
      setIsSigningIn(false);
      setAuthDiagnostics((prev) => ({
        ...prev,
        isEmbeddedIframe: embedded,
        isMobileBrowser: mobile,
        currentHost: host,
        authDomain: effectiveAuthDomain,
        usesSameOriginProxy: usesSameOriginAuthProxy,
        lastErrorCode: "auth/init-timeout",
        lastErrorSummary:
          "Firebase onAuthStateChanged did not emit within the initialization window.",
      }));
      setErrorMessage(
        "Authentication state took too long to initialize in this browser (auth/init-timeout). Retry session check or start Google Sign-In directly.",
      );
      setCanUseRedirectFallback(!embedded);
      setSuggestOpenInStandaloneTab(embedded);
      setStatus("error");
    }, AUTH_INIT_TIMEOUT_MS);

    // Resolve any pending Google redirect result without blocking onAuthStateChanged.
    let redirectErrored = false;
    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        redirectSettled = true;
        writeRedirectPendingFlag(false);

        if (result?.user) {
          authResolvedRef.current = true;
          window.clearTimeout(initTimeoutId);
          authAttemptInFlightRef.current = false;
          setIsSigningIn(false);
          setAuthDiagnostics((prev) => ({
            ...prev,
            isEmbeddedIframe: embedded,
            isMobileBrowser: mobile,
            currentHost: host,
            authDomain: effectiveAuthDomain,
            usesSameOriginProxy: usesSameOriginAuthProxy,
            redirectResultState: "user",
            authStateResolved: true,
          }));
          void verifyUserAndProfile(result.user);
        } else if (redirectWasPending && !auth.currentUser) {
          authResolvedRef.current = true;
          window.clearTimeout(initTimeoutId);
          authAttemptInFlightRef.current = false;
          setIsSigningIn(false);
          setAuthDiagnostics((prev) => ({
            ...prev,
            isEmbeddedIframe: embedded,
            isMobileBrowser: mobile,
            currentHost: host,
            authDomain: effectiveAuthDomain,
            usesSameOriginProxy: usesSameOriginAuthProxy,
            redirectResultState: "null_after_pending",
            authStateResolved: true,
            lastErrorCode: "auth/redirect-result-empty",
            lastErrorSummary:
              "getRedirectResult(auth) returned null after returning from Google Sign-In.",
          }));
          console.warn(
            "[MedFlow Auth] getRedirectResult returned null after pending redirect",
            {
              embedded,
              mobile,
              host,
              authDomain: effectiveAuthDomain,
              usesSameOriginProxy: usesSameOriginAuthProxy,
            },
          );
          setErrorMessage(
            usesSameOriginAuthProxy
              ? "Returned from Google Sign-In without an active session (getRedirectResult returned null). If you went back before completing Google Sign-In, try again below."
              : `Google redirect returned without a Firebase session (getRedirectResult returned null) across ${host ?? "this host"} → ${effectiveAuthDomain}. Open /staff/login in a standalone browser tab and retry.`,
          );
          setSuggestOpenInStandaloneTab(embedded);
          setCanUseRedirectFallback(!embedded);
          setStatus("error");
        } else {
          setAuthDiagnostics((prev) => ({
            ...prev,
            isEmbeddedIframe: embedded,
            isMobileBrowser: mobile,
            currentHost: host,
            authDomain: effectiveAuthDomain,
            usesSameOriginProxy: usesSameOriginAuthProxy,
            redirectResultState: "none",
          }));
        }
      })
      .catch((err) => {
        if (!active) return;
        redirectSettled = true;
        redirectErrored = true;
        authResolvedRef.current = true;
        window.clearTimeout(initTimeoutId);
        writeRedirectPendingFlag(false);
        authAttemptInFlightRef.current = false;
        setIsSigningIn(false);
        const classified = classifyRedirectResultError(err);
        const summary = sanitizeNonSecretAuthMessage(err);
        console.warn("[MedFlow Auth] getRedirectResult failed", {
          code: classified.code,
          embedded,
          mobile,
          host,
          authDomain: effectiveAuthDomain,
        });
        setAuthDiagnostics((prev) => ({
          ...prev,
          isEmbeddedIframe: embedded,
          isMobileBrowser: mobile,
          currentHost: host,
          authDomain: effectiveAuthDomain,
          usesSameOriginProxy: usesSameOriginAuthProxy,
          redirectResultState: "error",
          authStateResolved: true,
          lastErrorCode: classified.code,
          lastErrorSummary: summary,
        }));
        if (classified.isCancellation) {
          setErrorMessage(null);
          setAuthNotice(classified.message);
          setStatus("unauthenticated");
        } else {
          setErrorMessage(classified.message);
          setCanUseRedirectFallback(false);
          setSuggestOpenInStandaloneTab(embedded);
          setStatus("error");
        }
      });

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!active) return;
        if (!user && !redirectSettled) {
          // Wait briefly for pending redirect credential exchange to settle.
          return;
        }
        authResolvedRef.current = true;
        window.clearTimeout(initTimeoutId);

        setAuthDiagnostics((prev) => ({
          ...prev,
          isEmbeddedIframe: embedded,
          isMobileBrowser: mobile,
          currentHost: host,
          authDomain: effectiveAuthDomain,
          usesSameOriginProxy: usesSameOriginAuthProxy,
          authStateResolved: true,
        }));

        if (!user) {
          activeUserUidRef.current = null;
          verifyingUidRef.current = null;
          verificationRunIdRef.current += 1;
          authAttemptInFlightRef.current = false;
          setRawUser(null);
          setServerSession(null);
          setStaffProfile(null);
          setActiveFacilityIdState(null);
          setIsSigningIn(false);
          if (!redirectErrored && statusRef.current !== "error") {
            setStatus("unauthenticated");
          }
          return;
        }

        writeRedirectPendingFlag(false);
        authAttemptInFlightRef.current = false;
        setIsSigningIn(false);
        void verifyUserAndProfile(user);
      },
      (authError) => {
        if (!active) return;
        authResolvedRef.current = true;
        window.clearTimeout(initTimeoutId);
        writeRedirectPendingFlag(false);
        authAttemptInFlightRef.current = false;
        setIsSigningIn(false);
        const code = extractFirebaseAuthErrorCode(authError);
        const summary = sanitizeNonSecretAuthMessage(authError);
        console.warn("[MedFlow Auth] onAuthStateChanged error", {
          code,
          embedded,
          mobile,
          host,
        });
        setAuthDiagnostics((prev) => ({
          ...prev,
          isEmbeddedIframe: embedded,
          isMobileBrowser: mobile,
          currentHost: host,
          authDomain: effectiveAuthDomain,
          usesSameOriginProxy: usesSameOriginAuthProxy,
          authStateResolved: true,
          lastErrorCode: code,
          lastErrorSummary: summary,
        }));
        setErrorMessage(
          `Firebase Authentication failed to initialize (${code}). Retry or open /staff/login in a full browser tab.`,
        );
        setSuggestOpenInStandaloneTab(embedded);
        setStatus("error");
      },
    );

    return () => {
      active = false;
      window.clearTimeout(initTimeoutId);
      unsubscribe();
    };
  }, [verifyUserAndProfile]);

  const startRedirectSignIn = useCallback(async () => {
    const embedded = isEmbeddedInIframe();
    const mobile = isMobileUserAgent();
    const host =
      typeof window !== "undefined" ? window.location.host : null;

    authAttemptInFlightRef.current = true;
    setIsSigningIn(true);
    setErrorMessage(null);
    setAuthNotice("Redirecting to Google Sign-In...");
    setCanUseRedirectFallback(false);
    setSuggestOpenInStandaloneTab(false);
    setStatus("authenticating");
    writeRedirectPendingFlag(true);

    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      authAttemptInFlightRef.current = false;
      writeRedirectPendingFlag(false);
      setIsSigningIn(false);
      setAuthNotice(null);
      const classified = classifyRedirectResultError(err);
      const summary = sanitizeNonSecretAuthMessage(err);
      console.warn("[MedFlow Auth] signInWithRedirect failed", {
        code: classified.code,
        embedded,
        mobile,
        host,
        authDomain: effectiveAuthDomain,
      });
      setAuthDiagnostics((prev) => ({
        ...prev,
        isEmbeddedIframe: embedded,
        isMobileBrowser: mobile,
        currentHost: host,
        authDomain: effectiveAuthDomain,
        usesSameOriginProxy: usesSameOriginAuthProxy,
        lastErrorCode: classified.code,
        lastErrorSummary: summary,
      }));
      setErrorMessage(classified.message);
      setSuggestOpenInStandaloneTab(embedded);
      setStatus("error");
    }
  }, []);

  const signInWithGoogleRedirect = useCallback(async () => {
    if (authAttemptInFlightRef.current) return;
    await startRedirectSignIn();
  }, [startRedirectSignIn]);

  const signInWithGooglePopup = useCallback(async () => {
    if (authAttemptInFlightRef.current) return;

    const embedded = isEmbeddedInIframe();
    const mobile = isMobileUserAgent();
    const host =
      typeof window !== "undefined" ? window.location.host : null;

    authAttemptInFlightRef.current = true;
    setIsSigningIn(true);
    setErrorMessage(null);
    setAuthNotice(null);
    setCanUseRedirectFallback(false);
    setSuggestOpenInStandaloneTab(false);
    setStatus("authenticating");

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      authAttemptInFlightRef.current = false;
      setIsSigningIn(false);
      if (credential?.user) {
        void verifyUserAndProfile(credential.user);
      }
    } catch (err) {
      // Guard against race conditions where Firebase Auth already established
      // a valid user session while the popup handle closed or was superseded.
      if (auth.currentUser) {
        authAttemptInFlightRef.current = false;
        setIsSigningIn(false);
        void verifyUserAndProfile(auth.currentUser);
        return;
      }

      const classified = classifySignInError(err, {
        isEmbeddedIframe: embedded,
        isMobileBrowser: mobile,
      });
      const summary = sanitizeNonSecretAuthMessage(err);

      // Non-secret diagnostic log (never logs tokens or credentials).
      console.warn("[MedFlow Auth] signInWithPopup failed", {
        code: classified.code,
        embedded,
        mobile,
        host,
        authDomain: effectiveAuthDomain,
        usesSameOriginProxy: usesSameOriginAuthProxy,
      });

      setAuthDiagnostics((prev) => ({
        ...prev,
        isEmbeddedIframe: embedded,
        isMobileBrowser: mobile,
        currentHost: host,
        authDomain: effectiveAuthDomain,
        usesSameOriginProxy: usesSameOriginAuthProxy,
        lastErrorCode: classified.code,
        lastErrorSummary: summary,
      }));

      if (classified.shouldAutoFallbackToRedirect) {
        setAuthNotice(classified.message);
        await startRedirectSignIn();
        return;
      }

      authAttemptInFlightRef.current = false;
      setIsSigningIn(false);
      setCanUseRedirectFallback(classified.canOfferRedirectFallback);
      setSuggestOpenInStandaloneTab(classified.suggestOpenInStandaloneTab);

      if (activeUserUidRef.current) {
        return;
      }

      if (classified.isCancellation) {
        setErrorMessage(null);
        setAuthNotice(classified.message);
        setStatus("unauthenticated");
      } else {
        setAuthNotice(null);
        setErrorMessage(classified.message);
        setStatus("error");
      }
    }
  }, [startRedirectSignIn, verifyUserAndProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (authAttemptInFlightRef.current) return;
    const embedded = isEmbeddedInIframe();
    const mobile = isMobileUserAgent();
    const preferredMethod = selectPreferredSignInMethod({
      isEmbeddedIframe: embedded,
      isMobileBrowser: mobile,
      usesSameOriginProxy: usesSameOriginAuthProxy,
    });

    if (preferredMethod === "redirect") {
      await startRedirectSignIn();
      return;
    }

    await signInWithGooglePopup();
  }, [signInWithGooglePopup, startRedirectSignIn]);

  const cancelSignInAttempt = useCallback(() => {
    authAttemptInFlightRef.current = false;
    writeRedirectPendingFlag(false);
    setIsSigningIn(false);
    setErrorMessage(null);
    setAuthNotice(
      "Sign-in attempt cancelled. Select Sign in with Google whenever you are ready to try again.",
    );
    if (auth.currentUser) {
      void verifyUserAndProfile(auth.currentUser);
    } else {
      setStatus("unauthenticated");
    }
  }, [verifyUserAndProfile]);

  const signOutStaff = useCallback(async () => {
    verificationRunIdRef.current += 1;
    verifyingUidRef.current = null;
    activeUserUidRef.current = null;
    authAttemptInFlightRef.current = false;
    writeRedirectPendingFlag(false);
    setErrorMessage(null);
    setAuthNotice(null);
    setCanUseRedirectFallback(false);
    setSuggestOpenInStandaloneTab(false);
    setIsSigningIn(false);
    try {
      await signOut(auth);
      setRawUser(null);
      setServerSession(null);
      setStaffProfile(null);
      setActiveFacilityIdState(null);
      setStatus("unauthenticated");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to sign out cleanly. Please try again.",
      );
      setStatus("error");
    }
  }, []);

  const refreshAuthorization = useCallback(async () => {
    setErrorMessage(null);
    setAuthNotice(null);
    setCanUseRedirectFallback(false);
    setSuggestOpenInStandaloneTab(false);

    if (auth.currentUser) {
      await verifyUserAndProfile(auth.currentUser, true);
      return;
    }

    setStatus("initializing");
    try {
      await Promise.race([
        auth.authStateReady(),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("AUTH_INIT_TIMEOUT")),
            AUTH_INIT_TIMEOUT_MS,
          ),
        ),
      ]);
      authResolvedRef.current = true;
      if (auth.currentUser) {
        await verifyUserAndProfile(auth.currentUser, true);
      } else {
        setRawUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      const embedded = isEmbeddedInIframe();
      setErrorMessage(
        "Unable to confirm an existing authentication session. Start Google Sign-In directly below or open /staff/login in a full browser tab.",
      );
      setCanUseRedirectFallback(!embedded);
      setSuggestOpenInStandaloneTab(embedded);
      setStatus("error");
    }
  }, [verifyUserAndProfile]);

  const setActiveFacilityId = useCallback(
    (facilityId: string) => {
      if (staffProfile && staffProfile.facilityIds.includes(facilityId)) {
        setActiveFacilityIdState(facilityId);
      }
    },
    [staffProfile],
  );

  const preferredSignInMethod = selectPreferredSignInMethod({
    isEmbeddedIframe: authDiagnostics.isEmbeddedIframe,
    isMobileBrowser: authDiagnostics.isMobileBrowser,
    usesSameOriginProxy: authDiagnostics.usesSameOriginProxy,
  });

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
        authNotice,
        authDiagnostics,
        preferredSignInMethod,
        canUseRedirectFallback,
        suggestOpenInStandaloneTab,
        isSigningIn,
        signInWithGoogle,
        signInWithGooglePopup,
        signInWithGoogleRedirect,
        cancelSignInAttempt,
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
