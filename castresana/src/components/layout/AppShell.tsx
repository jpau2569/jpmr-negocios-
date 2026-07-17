import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import styles from './AppShell.module.css';

/**
 * AppShell — armazón global.
 *   Desktop:  [ Sidebar | Topbar / main ]
 *   Móvil:    [ Topbar / main / MobileNav ]
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <Topbar />
      <main className={styles.main}>{children}</main>
      <MobileNav />
    </div>
  );
}
