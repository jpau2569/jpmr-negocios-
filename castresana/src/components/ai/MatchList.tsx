import Link from 'next/link';
import type { PropertyMatch } from '@/types/ai';
import { formatPrice } from '@/lib/utils/format';
import { BuildingIcon, ChevronRightIcon, SparkleIcon } from '@/components/shared/Icons';
import styles from './MatchList.module.css';

export interface MatchListProps {
  matches: PropertyMatch[];
  title?: string;
}

/** Top propiedades que encajan con el lead, con score y motivo. */
export function MatchList({ matches, title = 'Encaje con el stock' }: MatchListProps) {
  if (matches.length === 0) return null;

  return (
    <section className={styles.block} aria-label={title}>
      <h3 className={styles.heading}>
        <SparkleIcon size={14} />
        {title}
      </h3>
      <ul className={styles.list}>
        {matches.map((match) => (
          <li key={match.propertyId}>
            <Link href={`/properties/${match.propertyId}`} className={styles.item}>
              <span className={styles.thumb}>
                <BuildingIcon size={16} />
              </span>
              <span className={styles.body}>
                <span className={styles.top}>
                  <span className={styles.ref}>{match.reference}</span>
                  <span className={styles.price}>
                    {formatPrice(match.price)}
                    {match.operation === 'alquiler' && '/mes'}
                  </span>
                </span>
                <span className={styles.title}>{match.title}</span>
                <span className={styles.scoreRow}>
                  <span className={styles.track}>
                    <span className={styles.bar} style={{ width: `${match.score}%` }} />
                  </span>
                  <span className={styles.score}>{match.score}%</span>
                </span>
                <span className={styles.reasons}>{match.reasons.join(' · ')}</span>
              </span>
              <ChevronRightIcon size={14} className={styles.chevron} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
