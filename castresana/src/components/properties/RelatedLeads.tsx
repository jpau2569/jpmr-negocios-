import Link from 'next/link';
import type { LeadMatch } from '@/data';
import { STAGES } from '@/lib/constants/stages';
import { Avatar, Badge } from '@/components/shared';
import { SparkleIcon } from '@/components/shared/Icons';
import styles from './RelatedLeads.module.css';

export interface RelatedLeadsProps {
  matches: LeadMatch[];
}

/**
 * Leads del Inbox compatibles con este inmueble, con motivo y afinidad.
 * Hoy reglas mock; mañana el motor de matching (IA) rellenará score y reason.
 */
export function RelatedLeads({ matches }: RelatedLeadsProps) {
  if (matches.length === 0) return null;

  return (
    <section className={styles.block} aria-label="Leads compatibles">
      <h2 className={styles.heading}>
        <SparkleIcon size={15} />
        Leads compatibles
      </h2>
      <p className={styles.note}>Encaje calculado por presupuesto, zona e interés.</p>

      <ul className={styles.list}>
        {matches.map(({ lead, reason, score }) => (
          <li key={lead.id}>
            <Link href="/inbox" className={styles.item}>
              <Avatar name={lead.name} size="sm" />
              <span className={styles.body}>
                <span className={styles.name}>{lead.name}</span>
                <span className={styles.reason}>{reason}</span>
              </span>
              <span className={styles.side}>
                <span className={styles.score}>{score}%</span>
                <Badge stage={lead.stage}>{STAGES[lead.stage].label}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
