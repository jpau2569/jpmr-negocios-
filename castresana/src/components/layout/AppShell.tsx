import type { ReactNode } from 'react';
import { NavRail } from './NavRail';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell — armazón global de la aplicación.
 * Estructura en rejilla: [NavRail | área de trabajo]. El área de trabajo la
 * rellenan las páginas, normalmente con <Workspace> (layout de 3 paneles).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <NavRail />
      <div className={styles.workspace}>{children}</div>
    </div>
  );
}
