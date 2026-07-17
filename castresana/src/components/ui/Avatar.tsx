import { cn } from '@/lib/cn';
import styles from './Avatar.module.css';

type Size = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  initials: string;
  size?: Size;
  /** Indicador de estado (p.ej. lead caliente). */
  status?: 'success' | 'warning' | 'danger';
  className?: string;
}

export function Avatar({ initials, size = 'md', status, className }: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size], className)} aria-hidden="true">
      <span className={styles.initials}>{initials}</span>
      {status && <span className={cn(styles.status, styles[`status-${status}`])} />}
    </span>
  );
}
