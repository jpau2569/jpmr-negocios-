import type { ReactNode } from 'react';
import type { LeadStage } from '@/types';
import { cn } from '@/lib/utils/cn';
import styles from './Badge.module.css';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: Tone;
  /** Badge de etapa del embudo: usa los tokens --stage-* automáticamente. */
  stage?: LeadStage;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', stage, dot, children, className }: BadgeProps) {
  if (stage) {
    return (
      <span
        className={cn(styles.badge, styles.stage, className)}
        style={{
          color: `var(--stage-${stage})`,
          backgroundColor: `var(--stage-${stage}-soft)`,
        }}
      >
        {dot !== false && <span className={styles.dot} />}
        {children}
      </span>
    );
  }

  return (
    <span className={cn(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
