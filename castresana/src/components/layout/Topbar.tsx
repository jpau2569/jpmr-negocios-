'use client';

import { usePathname } from 'next/navigation';
import { MAIN_NAV } from '@/lib/constants/nav';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Wordmark } from '@/components/branding/Wordmark';
import { IconButton } from '@/components/shared';
import { BellIcon } from '@/components/shared/Icons';
import { ThemeToggle } from './ThemeToggle';
import { SessionBadge } from './SessionBadge';
import styles from './Topbar.module.css';

/** Topbar: título de sección, sesión, notificaciones (push) y tema. */
export function Topbar() {
  const pathname = usePathname();
  const current = MAIN_NAV.find((item) => pathname.startsWith(item.href));
  const push = usePushNotifications();

  const bellLabel = !push.supported
    ? 'Notificaciones (push no disponible en este entorno)'
    : push.permission === 'granted'
      ? 'Notificaciones push activas'
      : 'Activar notificaciones push';

  return (
    <header className={styles.topbar}>
      {/* En móvil (sin sidebar) la marca vive aquí */}
      <div className={styles.mobileBrand}>
        <Wordmark />
      </div>

      <div className={styles.section}>
        <h1 className={styles.title}>{current?.label ?? 'Castresana'}</h1>
        <span className={styles.date}>
          {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>

      <div className={styles.actions}>
        <SessionBadge />
        <IconButton
          label={bellLabel}
          onClick={push.supported ? push.enable : undefined}
          disabled={push.enabling}
        >
          <BellIcon size={18} />
          {push.permission !== 'granted' && <span className={styles.notifDot} aria-hidden="true" />}
        </IconButton>
        <ThemeToggle />
      </div>
    </header>
  );
}
