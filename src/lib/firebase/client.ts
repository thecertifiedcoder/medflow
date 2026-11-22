"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  type Auth,
} from "firebase/auth";
import { resolveEffectiveAuthDomain } from "@/lib/firebase/auth-state";
import { firebaseAppletConfig } from "@/lib/firebase/config";

const authDomainResolution = resolveEffectiveAuthDomain({
  configuredAuthDomain: firebaseAppletConfig.authDomain,
  currentHost: typeof window !== "undefined" ? window.location.host : null,
  currentProtocol:
    typeof window !== "undefined" ? window.location.protocol : null,
  forceSameOrigin:
    process.env.NEXT_PUBLIC_FIREBASE_SAME_ORIGIN_AUTH_DOMAIN === "true",
});

export const effectiveAuthDomain: string = authDomainResolution.authDomain;
export const usesSameOriginAuthProxy: boolean =
  authDomainResolution.usesSameOriginProxy;

const clientFirebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: effectiveAuthDomain,
  projectId: firebaseAppletConfig.projectId,
  appId: firebaseAppletConfig.appId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
};

const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(clientFirebaseConfig);

function createClientAuth(firebaseApp: FirebaseApp): Auth {
  if (typeof window === "undefined") {
    return getAuth(firebaseApp);
  }
  try {
    // Cascade through browser storage backends and end with inMemoryPersistence
    // so mobile browsers or cross-origin Preview iframes with blocked/partitioned
    // IndexedDB/localStorage do not stall Auth initialization.
    return initializeAuth(firebaseApp, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized (e.g., module re-evaluation during dev navigation).
    return getAuth(firebaseApp);
  }
}

/**
 * Firebase Authentication client instance (identity provider only under ADR D-020).
 * All application persistence and staff authorization run server-side on Neon PostgreSQL.
 */
export const auth: Auth = createClientAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});
