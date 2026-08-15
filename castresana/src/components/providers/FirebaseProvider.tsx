'use client';

/**
 * FirebaseProvider — expone si hay proyecto Firebase configurado e
 * inicializa la app una única vez en cliente. No conoce la sesión:
 * eso es responsabilidad de AuthProvider (anidado dentro).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getFirebaseApp, isFirebaseConfigured } from '@/lib/firebase/client';

interface FirebaseContextValue {
  /** true si existen las variables NEXT_PUBLIC_FIREBASE_*. */
  configured: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue>({ configured: false });

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const value = useMemo<FirebaseContextValue>(() => {
    const configured = isFirebaseConfigured();
    if (configured) getFirebaseApp(); // inicialización perezosa y única
    return { configured };
  }, []);

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  return useContext(FirebaseContext);
}
