import rawFirebaseConfig from "../../../firebase-applet-config.json";

export interface FirebaseAppletConfig {
  readonly projectId: string;
  readonly appId: string;
  readonly apiKey: string;
  readonly authDomain: string;
  readonly firestoreDatabaseId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly measurementId?: string;
  readonly oAuthClientId?: string;
  readonly recaptchaSiteKey?: string;
}

const REMIX_PLACEHOLDERS = new Set([
  "remixed-project-id",
  "remixed-firestore-database-id",
]);

function validateFirebaseConfig(config: FirebaseAppletConfig): FirebaseAppletConfig {
  if (
    !config.projectId ||
    !config.firestoreDatabaseId ||
    REMIX_PLACEHOLDERS.has(config.projectId) ||
    REMIX_PLACEHOLDERS.has(config.firestoreDatabaseId)
  ) {
    throw new Error(
      "Firebase applet configuration is missing or still contains placeholder values.",
    );
  }
  return config;
}

export const firebaseAppletConfig: FirebaseAppletConfig =
  validateFirebaseConfig(rawFirebaseConfig as FirebaseAppletConfig);
