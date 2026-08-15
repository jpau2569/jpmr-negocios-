import type { IntentClassification, LeadSummary } from '@/types/ai';
import { Badge } from '@/components/shared';
import { SparkleIcon } from '@/components/shared/Icons';
import styles from './LeadSummaryCard.module.css';

export interface LeadSummaryCardProps {
  summary: LeadSummary;
  intent: IntentClassification;
}

/** Briefing del lead para el panel lateral: todo verificable, nada inventado. */
export function LeadSummaryCard({ summary, intent }: LeadSummaryCardProps) {
  return (
    <section className={styles.card} aria-label="Resumen IA del lead">
      <header className={styles.header}>
        <h3 className={styles.title}>
          <SparkleIcon size={14} />
          Resumen comercial
        </h3>
        <Badge tone="accent" dot>
          {intent.label}
        </Badge>
      </header>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Busca</dt>
          <dd>{summary.seeks}</dd>
        </div>
        <div className={styles.row}>
          <dt>Presupuesto</dt>
          <dd>{summary.budget}</dd>
        </div>
        <div className={styles.row}>
          <dt>Estado</dt>
          <dd>{summary.status}</dd>
        </div>
        <div className={styles.row}>
          <dt>Último contacto</dt>
          <dd>{summary.lastContact}</dd>
        </div>
        <div className={styles.row}>
          <dt>Interés</dt>
          <dd>{summary.interestTone}</dd>
        </div>
        {summary.objections.length > 0 && (
          <div className={styles.row}>
            <dt>Objeciones</dt>
            <dd>
              <span className={styles.objections}>
                {summary.objections.map((o) => (
                  <span key={o} className={styles.objection}>
                    {o}
                  </span>
                ))}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <p className={styles.confidence}>
        Clasificación: confianza {intent.confidence} · {intent.reasons.join(' · ')}
      </p>
    </section>
  );
}
