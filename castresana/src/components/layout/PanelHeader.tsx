import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './PanelHeader.module.css';

export interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Contenido extra bajo el título (barra de búsqueda, filtros…). */
  children?: ReactNode;
  className?: string;
}

/** Cabecera sticky para el interior de un panel del Workspace. */
export function PanelHeader({ title, subtitle, actions, children, className }: PanelHeaderProps) {
  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.row}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children && <div className={styles.extra}>{children}</div>}
    </header>
  );
}
