'use client';

import { usePathname } from 'next/navigation';
import { MAIN_NAV } from '@/lib/constants/nav';
import { Wordmark } from '@/components/branding/Wordmark';
import { IconButton } from '@/components/shared';
import { BellIcon } from '@/components/shared/Icons';
import { ThemeToggle } from './ThemeToggle';
import styles from './Topbar.module.css';

/** Topbar elegante: título de sección, notificaciones y toggle de tema. */
export function Topbar() {
  const pathname = usePathname();
  const current = MAIN_NAV.find((item) => pathname.startsWith(item.href));

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
        <IconButton label="Notificaciones">
          <BellIcon size={18} />
          <span className={styles.notifDot} aria-hidden="true" />
        </IconButton>
        <ThemeToggle />
      </div>
    </header>
  );
}
