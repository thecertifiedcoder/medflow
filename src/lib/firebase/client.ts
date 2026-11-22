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
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { firebaseAppletConfig } from "@/lib/firebase/config";
import { isOfflineError } from "@/lib/firebase/errors";

const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseAppletConfig);

/**
 * CRITICAL: Pass firebaseAppletConfig.firestoreDatabaseId explicitly to connect
 * to the provisioned named Enterprise Edition Firestore database.
 */
export const db: Firestore = getFirestore(
  app,
  firebaseAppletConfig.firestoreDatabaseId,
);

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

export const auth: Auth = createClientAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export interface ConnectionCheckResult {
  readonly reachable: boolean;
  readonly offlineMessage?: string;
}

let connectionCheckPromise: Promise<ConnectionCheckResult> | null = null;

/**
 * Startup connectivity check per Firebase integration guidelines.
 * A permission-denied response from /test/connection confirms live Firestore
 * reachability; an offline error indicates configuration or network failure.
 */
export function testFirestoreConnection(): Promise<ConnectionCheckResult> {
  if (!connectionCheckPromise) {
    connectionCheckPromise = (async () => {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
        return { reachable: true };
      } catch (error) {
        if (isOfflineError(error)) {
          console.error(
            "Please check your Firebase configuration: Firestore client is offline.",
          );
          return {
            reachable: false,
            offlineMessage:
              "Unable to reach Firestore. Check your network connection or Firebase configuration.",
          };
        }
        // Expected permission-denied on /test/connection confirms server connectivity.
        return { reachable: true };
      }
    })();
  }
  return connectionCheckPromise;
}
