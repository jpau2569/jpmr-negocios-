import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Stat.module.css';

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Variación respecto al periodo anterior (p.ej. "+12%"). */
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: ReactNode;
  className?: string;
}

export function Stat({ label, value, delta, trend = 'flat', icon, className }: StatProps) {
  return (
    <div className={cn(styles.stat, className)}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      {delta && (
        <span className={cn(styles.delta, styles[`trend-${trend}`])}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'} {delta}
        </span>
      )}
    </div>
  );
}
