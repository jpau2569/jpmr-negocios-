import Link from 'next/link';
import type { Property } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatArea, formatPrice } from '@/lib/utils/format';
import { MediaFrame } from '@/components/shared/MediaFrame';
import { Badge } from '@/components/shared';
import {
  BedIcon,
  CameraIcon,
  HeartIcon,
  MapPinIcon,
  PlayIcon,
  SparkleIcon,
} from '@/components/shared/Icons';
import styles from './PropertyCard.module.css';

export interface PropertyCardProps {
  property: Property;
  /** rail: tarjeta estándar de carrusel · compact: densa, para grids/laterales */
  variant?: 'rail' | 'compact';
  /** Motivo de recomendación (línea con chispa, futuro matching IA). */
  hint?: string;
  className?: string;
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

/** Tarjeta de inmueble para rails y grids. */
export function PropertyCard({ property, variant = 'rail', hint, className }: PropertyCardProps) {
  const isRent = property.operation === 'alquiler';

  return (
    <Link
      href={`/properties/${property.id}`}
      className={cn(styles.card, styles[variant], className)}
    >
      <MediaFrame palette={property.palette} className={styles.media}>
        <span className={styles.statusBadge}>
          <Badge tone={STATUS_TONE[property.status]} dot>
            {STATUS_LABEL[property.status]}
          </Badge>
        </span>

        <span className={styles.mediaMeta}>
          {property.hasVideo && (
            <span className={styles.mediaChip}>
              <PlayIcon size={11} /> Tour
            </span>
          )}
          <span className={styles.mediaChip}>
            <CameraIcon size={11} /> {property.photos}
          </span>
        </span>

        {/* Acción decorativa por ahora: al llegar Firebase será un botón real
            (fuera del Link para no anidar interactivos). */}
        <span className={styles.fav} title="Guardar en favoritos">
          <HeartIcon size={15} />
        </span>
      </MediaFrame>

      <div className={styles.body}>
        <div className={styles.priceRow}>
          <span className={styles.price}>
            {formatPrice(property.price)}
            {isRent && <span className={styles.priceSuffix}>/mes</span>}
          </span>
          <span className={styles.operation}>{isRent ? 'Alquiler' : 'Venta'}</span>
        </div>

        <h3 className={styles.title}>{property.title}</h3>

        <span className={styles.zone}>
          <MapPinIcon size={12} />
          {property.zone} · {property.city}
        </span>

        <span className={styles.specs}>
          {formatArea(property.areaM2)}
          {property.bedrooms > 0 && (
            <>
              <i className={styles.sep} />
              <BedIcon size={13} /> {property.bedrooms} hab.
            </>
          )}
          {property.yieldPct && (
            <>
              <i className={styles.sep} />
              {property.yieldPct.toLocaleString('es-ES')}% rent.
            </>
          )}
        </span>

        {hint && (
          <span className={styles.hint}>
            <SparkleIcon size={12} />
            {hint}
          </span>
        )}
      </div>
    </Link>
  );
}
