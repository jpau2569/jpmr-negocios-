import Link from 'next/link';
import type { SmartAlert } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import { ChevronRightIcon } from '@/components/shared/Icons';
import styles from './AlertList.module.css';

export interface AlertListProps {
  alerts: SmartAlert[];
}

/** Alertas inteligentes con severidad y enlace directo a la acción. */
export function AlertList({ alerts }: AlertListProps) {
  if (alerts.length === 0) {
    return <p className={styles.empty}>Sin alertas activas. Todo bajo control.</p>;
  }

  return (
    <ul className={styles.list}>
      {alerts.map((alert) => (
        <li key={alert.id}>
          <Link href={alert.link} className={styles.item}>
            <span className={cn(styles.severity, styles[alert.severity])} />
            <span className={styles.body}>
              <span className={styles.title}>{alert.title}</span>
              <span className={styles.detail}>{alert.detail}</span>
            </span>
            <ChevronRightIcon size={14} className={styles.chevron} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
