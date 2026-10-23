import type { WorkflowRun } from '@/types/automation';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime } from '@/lib/utils/format';
import { SparkleIcon } from '@/components/shared/Icons';
import styles from './WorkflowStatusCard.module.css';

export interface WorkflowStatusCardProps {
  run: WorkflowRun;
}

/** Ejecución de workflow: regla, disparador, acciones y resultado. */
export function WorkflowStatusCard({ run }: WorkflowStatusCardProps) {
  return (
    <article className={cn(styles.card, run.result === 'omitido' && styles.skipped)}>
      <span className={styles.icon}>
        <SparkleIcon size={14} />
      </span>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.name}>{run.ruleName}</span>
          <span className={cn(styles.result, styles[run.result])}>
            {run.result === 'ok' ? 'Ejecutado' : run.result === 'parcial' ? 'Parcial' : 'Omitido'}
          </span>
        </div>
        <span className={styles.detail}>{run.detail}</span>
        {run.actionsExecuted.length > 0 && (
          <ul className={styles.actions}>
            {run.actionsExecuted.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        )}
        <span className={styles.time}>{formatRelativeTime(run.firedAt)}</span>
      </div>
    </article>
  );
}
