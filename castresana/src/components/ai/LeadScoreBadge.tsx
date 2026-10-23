import type { LeadScore } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import styles from './LeadScoreBadge.module.css';

const LABELS = { caliente: 'Caliente', templado: 'Templado', frio: 'Frío' } as const;

export interface LeadScoreBadgeProps {
  score: LeadScore;
  /** compact: solo punto + número (para listas densas). */
  compact?: boolean;
  className?: string;
}

/** Score del lead con su etiqueta térmica. El title muestra la explicación. */
export function LeadScoreBadge({ score, compact, className }: LeadScoreBadgeProps) {
  return (
    <span
      className={cn(styles.badge, styles[score.label], compact && styles.compact, className)}
      title={`Score ${score.score}: ${score.explanation}`}
    >
      <span className={styles.dot} />
      <span className={styles.value}>{score.score}</span>
      {!compact && <span className={styles.label}>{LABELS[score.label]}</span>}
    </span>
  );
}
