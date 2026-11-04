import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

export function getEnv(key: string): string | undefined {
  if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
    const val = Netlify.env.get(key);
    if (val !== undefined && val !== "") return val;
  }
  return process.env[key];
}

let cachedApp: App | null = null;

export function getFirebaseAdmin(): { app: App; adminAuth: Auth; adminDb: Firestore } {
  if (!cachedApp) {
    const existing = getApps();
    if (existing.length > 0) {
      cachedApp = existing[0];
    } else {
      const projectId = getEnv("FIREBASE_PROJECT_ID");
      const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");
      const rawPrivateKey = getEnv("FIREBASE_PRIVATE_KEY");

      if (!projectId || !clientEmail || !rawPrivateKey) {
        throw new Error(
          "Firebase Admin 환경변수(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)가 설정되지 않았습니다."
        );
      }

      const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
      cachedApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  }

  return {
    app: cachedApp,
    adminAuth: getAuth(cachedApp),
    adminDb: getFirestore(cachedApp),
  };
}

export const JSON_SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
