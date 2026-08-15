'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import styles from './SessionBadge.module.css';

/**
 * Estado de sesión en la topbar:
 *   · Demo  → chip neutro «Demo» (sin Firebase configurado).
 *   · Auth  → email del usuario + botón de salir.
 */
export function SessionBadge() {
  const { user, demoMode, signOut } = useAuth();
  const router = useRouter();

  if (demoMode) {
    return (
      <span className={cn(styles.badge, styles.demo)} title="Sin Firebase: datos de ejemplo locales">
        <span className={styles.dot} />
        Demo
      </span>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <span className={styles.session}>
      <span className={cn(styles.badge, styles.authed)} title={user.email ?? ''}>
        <span className={styles.dot} />
        {user.email ?? 'Sesión activa'}
      </span>
      <button type="button" className={styles.signOut} onClick={handleSignOut}>
        Salir
      </button>
    </span>
  );
}
