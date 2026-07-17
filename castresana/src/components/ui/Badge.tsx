import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Badge.module.css';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  tone?: Tone;
  /** Muestra un punto de color a la izquierda. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
