import type { NextAction } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EuroIcon,
  FileIcon,
  InboxIcon,
  PhoneIcon,
  SendIcon,
  UsersIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './NextActionCard.module.css';

const ICONS: Record<NextAction['kind'], (p: IconProps) => React.ReactElement> = {
  'responder-ahora': InboxIcon,
  'llamar-hoy': PhoneIcon,
  'proponer-visita': CalendarIcon,
  'confirmar-visita': CalendarIcon,
  'enviar-inmuebles': SendIcon,
  'pedir-financiacion': EuroIcon,
  'solicitar-documentacion': FileIcon,
  'recontactar-48h': ClockIcon,
  'derivar-agente': UsersIcon,
  'archivar-temporal': CheckIcon,
};

const URGENCY = {
  hoy: { label: 'Hoy', className: 'urgent' },
  'esta-semana': { label: 'Esta semana', className: 'soon' },
  'sin-prisa': { label: 'Sin prisa', className: 'later' },
} as const;

export interface NextActionCardProps {
  action: NextAction;
  className?: string;
}

/** Siguiente mejor acción con razonamiento visible. */
export function NextActionCard({ action, className }: NextActionCardProps) {
  const Icon = ICONS[action.kind];
  const urgency = URGENCY[action.urgency];

  return (
    <section className={cn(styles.card, className)} aria-label="Siguiente acción sugerida">
      <span className={styles.icon}>
        <Icon size={17} />
      </span>
      <div className={styles.body}>
        <span className={styles.head}>
          <span className={styles.label}>
            {action.label}
            <ArrowRightIcon size={13} />
          </span>
          <span className={cn(styles.urgency, styles[urgency.className])}>{urgency.label}</span>
        </span>
        <p className={styles.reason}>{action.reason}</p>
      </div>
    </section>
  );
}
