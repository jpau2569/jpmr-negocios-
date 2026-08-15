import type { PropertyActivity } from '@/data';
import { formatDay } from '@/lib/utils/format';
import {
  CalendarIcon,
  CameraIcon,
  EuroIcon,
  HeartIcon,
  TagIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './PropertyTimeline.module.css';

const KIND_ICONS: Record<PropertyActivity['kind'], (p: IconProps) => React.ReactElement> = {
  captacion: TagIcon,
  media: CameraIcon,
  visita: CalendarIcon,
  interes: HeartIcon,
  oferta: EuroIcon,
};

export interface PropertyTimelineProps {
  activity: PropertyActivity[];
}

/** Actividad comercial del inmueble (captación, medios, interés, visitas…). */
export function PropertyTimeline({ activity }: PropertyTimelineProps) {
  return (
    <section className={styles.block} aria-label="Actividad del inmueble">
      <h2 className={styles.heading}>Actividad</h2>
      <ol className={styles.timeline}>
        {activity.map((event) => {
          const Icon = KIND_ICONS[event.kind];
          return (
            <li key={event.id} className={styles.event}>
              <span className={styles.marker}>
                <Icon size={13} />
              </span>
              <div className={styles.content}>
                <span className={styles.title}>{event.title}</span>
                {event.detail && <span className={styles.detail}>{event.detail}</span>}
                <span className={styles.date}>{formatDay(event.at)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
