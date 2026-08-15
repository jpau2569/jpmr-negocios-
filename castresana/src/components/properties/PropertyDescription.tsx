import type { Property } from '@/types';
import styles from './PropertyDescription.module.css';

export interface PropertyDescriptionProps {
  property: Property;
}

/** Descripción comercial del inmueble. */
export function PropertyDescription({ property }: PropertyDescriptionProps) {
  return (
    <section className={styles.block}>
      <h2 className={styles.heading}>Descripción</h2>
      <p className={styles.text}>{property.description}</p>
    </section>
  );
}
