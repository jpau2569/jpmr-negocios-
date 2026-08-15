import Link from 'next/link';
import type { Property } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatArea, formatPrice } from '@/lib/utils/format';
import { MediaFrame } from '@/components/shared/MediaFrame';
import { Badge } from '@/components/shared';
import { BedIcon, MapPinIcon, PlayIcon } from '@/components/shared/Icons';
import styles from './PropertyFeaturedCard.module.css';

export interface PropertyFeaturedCardProps {
  property: Property;
  className?: string;
}

/**
 * Tarjeta destacada: media grande con la información superpuesta en la parte
 * baja sobre veladura. Para hero y piezas singulares.
 */
export function PropertyFeaturedCard({ property, className }: PropertyFeaturedCardProps) {
  const isRent = property.operation === 'alquiler';

  return (
    <Link href={`/properties/${property.id}`} className={cn(styles.card, className)}>
      <MediaFrame palette={property.palette} className={styles.media}>
        <span className={styles.topRow}>
          <Badge tone={property.status === 'reservado' ? 'warning' : 'accent'} dot>
            {property.status === 'reservado' ? 'Reservado' : 'Destacada'}
          </Badge>
          {property.hasVideo && (
            <span className={styles.playChip}>
              <PlayIcon size={12} /> Tour disponible
            </span>
          )}
        </span>

        <span className={styles.overlay}>
          <span className={styles.price}>
            {formatPrice(property.price)}
            {isRent && <em>/mes</em>}
          </span>
          <span className={styles.title}>{property.title}</span>
          <span className={styles.meta}>
            <MapPinIcon size={13} />
            {property.zone} · {property.city}
            <i className={styles.sep} />
            {formatArea(property.areaM2)}
            {property.bedrooms > 0 && (
              <>
                <i className={styles.sep} />
                <BedIcon size={14} /> {property.bedrooms} hab.
              </>
            )}
          </span>
          <span className={styles.tags}>
            {property.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </span>
        </span>
      </MediaFrame>
    </Link>
  );
}
