'use client';

/**
 * AuthProvider — estado de sesión de la app.
 * Modos:
 *   · Firebase configurado  → sesión real (email/password) vía Auth.
 *   · Sin configurar (demo) → user=null, demoMode=true; el AuthGate deja
 *     pasar y la UI marca la sesión como «Demo».
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { onAuthChanged, signInWithEmail, signOutUser } from '@/lib/firebase/auth';
import { useFirebase } from './FirebaseProvider';

export interface AuthContextValue {
  user: User | null;
  /** true mientras se resuelve el estado inicial de sesión. */
  loading: boolean;
  /** true cuando no hay proyecto Firebase: la app corre con seeds locales. */
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { configured } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const unsubscribe = onAuthChanged((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, demoMode: !configured, signIn, signOut }),
    [user, loading, configured, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
