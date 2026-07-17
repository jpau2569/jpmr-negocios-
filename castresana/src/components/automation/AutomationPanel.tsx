import type { Lead } from '@/types';
import type { AutomationSnapshot } from '@/lib/services/automationService';
import { WorkflowStatusCard } from './WorkflowStatusCard';
import { TaskList } from './TaskList';
import styles from './AutomationPanel.module.css';

export interface AutomationPanelProps {
  snapshot: AutomationSnapshot;
  leads: Lead[];
  /** ISO estable de la petición (SSR-safe). */
  now: string;
}

/**
 * Bloque «Automatización» del dashboard: workflows disparados, tareas
 * vencidas, rendimiento por canal y leads sin tocar.
 */
export function AutomationPanel({ snapshot, leads, now }: AutomationPanelProps) {
  const nowMs = new Date(now).getTime();
  const executed = snapshot.runs.filter((r) => r.result === 'ok');
  const overdueTasks = snapshot.allTasks.filter(
    (t) => !t.done && new Date(t.dueAt).getTime() < nowMs,
  );
  const untouched = snapshot.untouchedLeadIds
    .map((id) => leads.find((l) => l.id === id))
    .filter((l): l is Lead => Boolean(l));

  return (
    <section className={styles.panel} aria-label="Automatización">
      <header className={styles.header}>
        <h2 className={styles.title}>Automatización</h2>
        <span className={styles.meta}>
          {executed.length} workflows disparados · {snapshot.runs.length - executed.length} omitidos (con motivo)
        </span>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Workflows disparados</h3>
          <div className={styles.runs}>
            {executed.slice(0, 4).map((run) => (
              <WorkflowStatusCard key={run.id} run={run} />
            ))}
            {executed.length === 0 && <p className={styles.empty}>Sin ejecuciones hoy.</p>}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            Tareas vencidas {overdueTasks.length > 0 && <em className={styles.alertCount}>{overdueTasks.length}</em>}
          </h3>
          <TaskList tasks={overdueTasks.slice(0, 5)} dense now={now} />

          <h3 className={styles.cardTitle}>Rendimiento por canal</h3>
          <ul className={styles.channels}>
            {snapshot.channelStats.map((stat) => (
              <li key={stat.channel} className={styles.channelRow}>
                <span className={styles.channelName}>{stat.channel}</span>
                <span className={styles.channelMeta}>
                  {stat.sent} enviados · {stat.delivered} entregados · {stat.read} leídos
                </span>
              </li>
            ))}
          </ul>

          {untouched.length > 0 && (
            <>
              <h3 className={styles.cardTitle}>Leads sin tocar</h3>
              <ul className={styles.untouched}>
                {untouched.map((lead) => (
                  <li key={lead.id} className={styles.untouchedRow}>
                    <span className={styles.untouchedName}>{lead.name}</span>
                    <span className={styles.untouchedMeta}>
                      {lead.zone} · vía {lead.channel}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
