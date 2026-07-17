import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Page.module.css';

export interface PageProps {
  children: ReactNode;
  /** Ancho máximo del contenido. */
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
}

/** Contenedor scrollable de una columna, con padding y ancho máximo. */
export function Page({ children, width = 'default', className }: PageProps) {
  return (
    <div className={styles.scroll}>
      <div className={cn(styles.inner, styles[width], className)}>{children}</div>
    </div>
  );
}
