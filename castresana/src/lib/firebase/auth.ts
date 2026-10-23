/* ============================================================================
   Firebase Auth — helpers finos sobre el SDK
   Email/password en esta fase. El estado de sesión vive en AuthProvider.
   ============================================================================ */

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { getFirebaseApp, isBrowser } from './client';

/** Auth del proyecto, o null si no hay configuración / estamos en servidor. */
export function getFirebaseAuth(): Auth | null {
  if (!isBrowser()) return null;
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase no está configurado en este entorno.');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

/**
 * Suscripción al estado de sesión. Si Firebase no está configurado, emite
 * null una vez (modo demo) y devuelve un unsubscribe vacío.
 */
export function onAuthChanged(callback: (user: User | null) => void): Unsubscribe {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

/** Traducción amable de errores de Auth para la pantalla de login. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión con el servidor. Revisa tu red.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}
