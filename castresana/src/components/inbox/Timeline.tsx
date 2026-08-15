import type { TimelineEvent, TimelineKind } from '@/types';
import { formatDay } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EuroIcon,
  InboxIcon,
  NoteIcon,
  PhoneIcon,
  PlusIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './Timeline.module.css';

const KIND_ICONS: Record<TimelineKind, (p: IconProps) => React.ReactElement> = {
  creado: PlusIcon,
  mensaje: InboxIcon,
  llamada: PhoneIcon,
  visita: CalendarIcon,
  oferta: EuroIcon,
  nota: NoteIcon,
  tarea: ClockIcon,
};

interface Props {
  events: TimelineEvent[];
}

/** Timeline vertical resumido del lead (hitos + tareas). */
export function Timeline({ events }: Props) {
  if (events.length === 0) {
    return <p className={styles.empty}>Sin actividad registrada todavía.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {events.map((event) => {
        const Icon = event.kind === 'tarea' && event.done ? CheckIcon : KIND_ICONS[event.kind];
        const pendingTask = event.kind === 'tarea' && !event.done;

        return (
          <li key={event.id} className={styles.event}>
            <span className={cn(styles.marker, pendingTask && styles.markerPending)}>
              <Icon size={13} />
            </span>
            <div className={styles.content}>
              <span className={styles.title}>
                {event.title}
                {pendingTask && <span className={styles.pendingTag}>Pendiente</span>}
              </span>
              {event.detail && <span className={styles.detail}>{event.detail}</span>}
              <span className={styles.date}>{formatDay(event.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
