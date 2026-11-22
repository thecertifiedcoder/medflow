import rawFirebaseConfig from "../../../firebase-applet-config.json";

export interface FirebaseAppletConfig {
  readonly projectId: string;
  readonly appId: string;
  readonly apiKey: string;
  readonly authDomain: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly firestoreDatabaseId?: string;
  readonly measurementId?: string;
  readonly oAuthClientId?: string;
  readonly recaptchaSiteKey?: string;
}

const REMIX_PLACEHOLDERS = new Set(["remixed-project-id"]);

function validateFirebaseAuthConfig(
  config: FirebaseAppletConfig,
): FirebaseAppletConfig {
  if (
    !config.projectId ||
    !config.apiKey ||
    !config.authDomain ||
    !config.appId ||
    REMIX_PLACEHOLDERS.has(config.projectId)
  ) {
    throw new Error(
      "Firebase Authentication configuration is missing or still contains placeholder values.",
    );
  }
  return config;
}

export const firebaseAppletConfig: FirebaseAppletConfig =
  validateFirebaseAuthConfig(rawFirebaseConfig as FirebaseAppletConfig);
