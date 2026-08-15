import type { Property } from '@/types';
import { PropertyFeaturedCard } from './PropertyFeaturedCard';
import { PropertyCard } from './PropertyCard';
import styles from './ExplorerHero.module.css';

export interface ExplorerHeroProps {
  hero: Property;
  side: Property[];
}

/**
 * Bloque de apertura del Explorer: titular editorial + pieza destacada
 * grande y dos apoyos compactos en columna (grid en desktop, rail natural
 * en móvil).
 */
export function ExplorerHero({ hero, side }: ExplorerHeroProps) {
  return (
    <section className={styles.hero}>
      <header className={styles.heading}>
        <span className="eyebrow">Explorer</span>
        <h1 className={styles.title}>Descubre la cartera</h1>
        <p className={styles.lede}>
          Captaciones recientes, piezas singulares y oportunidades listas para enseñar.
        </p>
      </header>

      <div className={styles.grid}>
        <PropertyFeaturedCard property={hero} className={styles.main} />
        <div className={styles.side}>
          {side.slice(0, 2).map((property) => (
            <PropertyCard key={property.id} property={property} variant="compact" className={styles.sideCard} />
          ))}
        </div>
      </div>
    </section>
  );
}
