import type { Property } from '@/types';
import { CheckIcon } from '@/components/shared/Icons';
import styles from './PropertySpecs.module.css';

export interface PropertySpecsProps {
  property: Property;
}

/** Características del inmueble en rejilla de dos columnas. */
export function PropertySpecs({ property }: PropertySpecsProps) {
  return (
    <section className={styles.block}>
      <h2 className={styles.heading}>Características</h2>
      <ul className={styles.grid}>
        {property.features.map((feature) => (
          <li key={feature} className={styles.item}>
            <CheckIcon size={14} />
            {feature}
          </li>
        ))}
      </ul>
    </section>
  );
}
