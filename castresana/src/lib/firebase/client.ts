/* ============================================================================
   Firebase — inicialización del cliente
   ----------------------------------------------------------------------------
   Toda la configuración sale de variables NEXT_PUBLIC_* (.env.local).
   Sin ellas, la app funciona en MODO DEMO: isFirebaseConfigured() === false
   y los repositorios sirven los datos seed locales. Nada se rompe.
   ============================================================================ */

import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** true si hay proyecto Firebase configurado (los mínimos imprescindibles). */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let app: FirebaseApp | null = null;

/** App de Firebase (singleton). Devuelve null si no hay configuración. */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

/** true solo en navegador (Auth y Messaging no existen en el servidor). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}
