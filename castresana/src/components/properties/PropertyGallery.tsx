import type { Property } from '@/types';
import { MediaFrame } from '@/components/shared/MediaFrame';
import { CameraIcon, PlayIcon } from '@/components/shared/Icons';
import styles from './PropertyGallery.module.css';

export interface PropertyGalleryProps {
  property: Property;
}

/**
 * Galería principal de la ficha: pieza grande + tira de miniaturas.
 * Con fotos reales, MediaFrame pasará a renderizar imágenes; el layout
 * y las acciones no cambiarán.
 */
export function PropertyGallery({ property }: PropertyGalleryProps) {
  return (
    <section className={styles.gallery} aria-label="Galería de fotos">
      <MediaFrame palette={property.palette} className={styles.main}>
        <span className={styles.count}>
          <CameraIcon size={13} /> {property.photos} fotos
        </span>
        {property.hasVideo && (
          <span className={styles.play}>
            <PlayIcon size={15} /> Ver tour
          </span>
        )}
      </MediaFrame>

      <div className={styles.thumbs}>
        {[0, 1, 2, 3].map((i) => (
          <MediaFrame key={i} palette={property.palette} className={styles.thumb} />
        ))}
      </div>
    </section>
  );
}
