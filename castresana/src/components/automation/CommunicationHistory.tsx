import type { ActivityEvent, ActivityKind } from '@/types/automation';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  CalendarIcon,
  CheckIcon,
  FileIcon,
  InboxIcon,
  MailIcon,
  SparkleIcon,
  TagIcon,
  WhatsappIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './CommunicationHistory.module.css';

const KIND_META: Record<ActivityKind, { Icon: (p: IconProps) => React.ReactElement; label: string }> = {
  mensaje: { Icon: InboxIcon, label: 'Mensaje' },
  whatsapp: { Icon: WhatsappIcon, label: 'WhatsApp' },
  email: { Icon: MailIcon, label: 'Email' },
  estado: { Icon: TagIcon, label: 'Estado' },
  tarea: { Icon: CheckIcon, label: 'Tarea' },
  visita: { Icon: CalendarIcon, label: 'Visita' },
  ia: { Icon: SparkleIcon, label: 'IA' },
  workflow: { Icon: SparkleIcon, label: 'Automatización' },
  documento: { Icon: FileIcon, label: 'Documento' },
};

export interface CommunicationHistoryProps {
  events: ActivityEvent[];
  /** Máximo de eventos a mostrar (0 = todos). */
  limit?: number;
}

/** Timeline comercial unificado (activity center) de un lead. */
export function CommunicationHistory({ events, limit = 0 }: CommunicationHistoryProps) {
  const visible = limit > 0 ? events.slice(0, limit) : events;

  if (visible.length === 0) {
    return <p className={styles.empty}>Sin actividad registrada.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {visible.map((event) => {
        const meta = KIND_META[event.kind];
        return (
          <li key={event.id} className={styles.event}>
            <span className={styles.marker} data-kind={event.kind}>
              <meta.Icon size={12} />
            </span>
            <div className={styles.content}>
              <span className={styles.title}>{event.title}</span>
              {event.detail && <span className={styles.detail}>{event.detail}</span>}
              <span className={styles.time}>{formatRelativeTime(event.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
