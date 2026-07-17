import type { Visit } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatDay, formatTime } from '@/lib/utils/format';
import { Badge } from '@/components/shared';
import { CalendarIcon } from '@/components/shared/Icons';
import styles from './VisitCard.module.css';

const STATUS = {
  propuesta: { label: 'Por confirmar', tone: 'warning' },
  confirmada: { label: 'Confirmada', tone: 'success' },
  realizada: { label: 'Realizada', tone: 'neutral' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
} as const;

export interface VisitCardProps {
  visit: Visit;
  leadName: string;
  propertyLabel: string;
  compact?: boolean;
}

/** Tarjeta de visita: quién, qué, cuándo y estado. */
export function VisitCard({ visit, leadName, propertyLabel, compact }: VisitCardProps) {
  const status = STATUS[visit.status];

  return (
    <article className={cn(styles.card, compact && styles.compact)}>
      <span className={styles.icon}>
        <CalendarIcon size={16} />
      </span>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.who}>{leadName}</span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        <span className={styles.what}>{propertyLabel}</span>
        <span className={styles.when}>
          {formatDay(visit.scheduledAt)} · {formatTime(visit.scheduledAt)}
        </span>
        {!compact && (visit.notes || visit.feedback) && (
          <p className={styles.notes}>{visit.feedback ?? visit.notes}</p>
        )}
      </div>
    </article>
  );
}
