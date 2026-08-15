import type { Property } from '@/types';
import { formatArea, formatPrice } from '@/lib/utils/format';
import { Badge } from '@/components/shared';
import { AreaIcon, BathIcon, BedIcon, MapPinIcon } from '@/components/shared/Icons';
import styles from './PropertySummary.module.css';

export interface PropertySummaryProps {
  property: Property;
}

const STATUS_LABEL: Record<Property['status'], string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
};

const STATUS_TONE = {
  disponible: 'success',
  reservado: 'warning',
  vendido: 'neutral',
} as const;

/** Bloque resumen: referencia, título, ubicación, precio grande y specs clave. */
export function PropertySummary({ property }: PropertySummaryProps) {
  const isRent = property.operation === 'alquiler';

  return (
    <section className={styles.summary}>
      <div className={styles.headRow}>
        <span className={styles.reference}>{property.reference}</span>
        <Badge tone={STATUS_TONE[property.status]} dot>
          {STATUS_LABEL[property.status]}
        </Badge>
        <Badge tone="neutral">{isRent ? 'Alquiler' : 'Venta'}</Badge>
      </div>

      <h1 className={styles.title}>{property.title}</h1>

      <span className={styles.location}>
        <MapPinIcon size={14} />
        {property.zone} · {property.city}, Asturias
      </span>

      <div className={styles.priceRow}>
        <span className={styles.price}>
          {formatPrice(property.price)}
          {isRent && <em>/mes</em>}
        </span>
        {!isRent && (
          <span className={styles.pricePerM2}>
            {formatPrice(Math.round(property.price / property.areaM2))}/m²
          </span>
        )}
        {property.yieldPct && (
          <Badge tone="accent">{property.yieldPct.toLocaleString('es-ES')}% rentabilidad</Badge>
        )}
      </div>

      <dl className={styles.specs}>
        <div className={styles.spec}>
          <dt>
            <AreaIcon size={16} />
          </dt>
          <dd>
            {formatArea(property.areaM2)}
            <span>construidos</span>
          </dd>
        </div>
        {property.bedrooms > 0 && (
          <div className={styles.spec}>
            <dt>
              <BedIcon size={16} />
            </dt>
            <dd>
              {property.bedrooms}
              <span>{property.bedrooms === 1 ? 'dormitorio' : 'dormitorios'}</span>
            </dd>
          </div>
        )}
        <div className={styles.spec}>
          <dt>
            <BathIcon size={16} />
          </dt>
          <dd>
            {property.bathrooms}
            <span>{property.bathrooms === 1 ? 'baño' : 'baños'}</span>
          </dd>
        </div>
        {property.floor && (
          <div className={styles.spec}>
            <dd>
              {property.floor}
              <span>planta</span>
            </dd>
          </div>
        )}
        {property.yearBuilt && (
          <div className={styles.spec}>
            <dd>
              {property.yearBuilt}
              <span>construcción</span>
            </dd>
          </div>
        )}
      </dl>

      <div className={styles.tags}>
        {property.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>
    </section>
  );
}
