'use client';

/**
 * AuthGate — guardia de las rutas privadas.
 *   · Modo demo (sin Firebase): deja pasar; la UI marca la sesión como Demo.
 *   · Con Firebase: espera la resolución de sesión; sin usuario → /login.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/branding/Logo';
import styles from './AuthGate.module.css';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, demoMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!demoMode && !loading && !user) {
      router.replace('/login');
    }
  }, [demoMode, loading, user, router]);

  if (demoMode) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className={styles.splash} role="status" aria-label="Comprobando sesión">
        <Logo size={40} />
        <span className={styles.text}>Comprobando sesión…</span>
      </div>
    );
  }

  return <>{children}</>;
}
