import type { Lead, Property, Visit } from '@/types';
import { VisitCard } from './VisitCard';
import styles from './VisitScheduler.module.css';

export interface VisitSchedulerProps {
  visits: Visit[];
  leads: Lead[];
  properties: Property[];
  /** ISO de referencia para agrupar (estable en SSR). */
  now: string;
}

const DAY = 86_400_000;

/**
 * Agenda de visitas agrupada: hoy · por confirmar · próximas · completadas.
 * La creación/reprogramación real llegará con Firestore; la estructura de
 * grupos y tarjetas ya es la definitiva.
 */
export function VisitScheduler({ visits, leads, properties, now }: VisitSchedulerProps) {
  const nowMs = new Date(now).getTime();
  const leadName = (id: string) => leads.find((l) => l.id === id)?.name ?? id;
  const propertyLabel = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p ? `${p.reference} — ${p.title}` : id;
  };

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const n = new Date(now);
    return d.toDateString() === n.toDateString();
  };

  const groups: Array<{ title: string; items: Visit[] }> = [
    {
      title: 'Hoy',
      items: visits.filter((v) => isToday(v.scheduledAt) && v.status !== 'cancelada' && v.status !== 'realizada'),
    },
    {
      title: 'Pendientes de confirmar',
      items: visits.filter((v) => v.status === 'propuesta' && !isToday(v.scheduledAt)),
    },
    {
      title: 'Próximas',
      items: visits.filter(
        (v) =>
          v.status === 'confirmada' &&
          !isToday(v.scheduledAt) &&
          new Date(v.scheduledAt).getTime() > nowMs,
      ),
    },
    {
      title: 'Completadas',
      items: visits
        .filter((v) => v.status === 'realizada')
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        .slice(0, 3),
    },
  ];

  return (
    <div className={styles.scheduler}>
      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {group.title}
                <span className={styles.count}>{group.items.length}</span>
              </h3>
              <div className={styles.items}>
                {group.items
                  .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                  .map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      leadName={leadName(visit.leadId)}
                      propertyLabel={propertyLabel(visit.propertyId)}
                      compact={group.title === 'Completadas'}
                    />
                  ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
