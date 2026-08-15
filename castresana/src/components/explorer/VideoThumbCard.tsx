import Link from 'next/link';
import type { PropertyVideo } from '@/types';
import { VIDEO_KIND_LABEL } from '@/data';
import { MediaFrame } from '@/components/shared/MediaFrame';
import { PlayIcon } from '@/components/shared/Icons';
import styles from './VideoThumbCard.module.css';

export interface VideoThumbCardProps {
  video: PropertyVideo;
}

/**
 * Miniatura audiovisual: thumbnail con play discreto, duración y titular.
 * Enlaza a la ficha del inmueble (el reproductor llegará en fases futuras).
 */
export function VideoThumbCard({ video }: VideoThumbCardProps) {
  return (
    <Link href={`/properties/${video.propertyId}`} className={styles.card}>
      <MediaFrame palette={video.palette} className={styles.media}>
        <span className={styles.playRing}>
          <PlayIcon size={16} />
        </span>
        <span className={styles.duration}>{video.duration}</span>
      </MediaFrame>

      <div className={styles.body}>
        <span className={styles.kind}>{VIDEO_KIND_LABEL[video.kind]}</span>
        <h3 className={styles.title}>{video.title}</h3>
        <span className={styles.subtitle}>{video.subtitle}</span>
      </div>
    </Link>
  );
}
