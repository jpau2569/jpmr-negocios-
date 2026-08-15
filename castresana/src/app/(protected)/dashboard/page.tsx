import type { Metadata } from 'next';
import Link from 'next/link';
import { dashboardRepository, leadsRepository, propertiesRepository } from '@/lib/repositories';
import { getCommercialPulse } from '@/lib/services/aiDashboardService';
import { getAutomationSnapshot } from '@/lib/services/automationService';
import { AIInsightsPanel } from '@/components/ai';
import { AutomationPanel, VisitScheduler } from '@/components/automation';
import { STAGES, STAGE_KEYS } from '@/lib/constants/stages';
import { formatDay, formatTime } from '@/lib/utils/format';
import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InboxIcon,
  UsersIcon,
} from '@/components/shared/Icons';
import styles from './dashboard.module.css';

export const metadata: Metadata = {
  title: 'Panel',
};

/**
 * Panel comercial — visión del día: KPIs, embudo, visitas y tareas.
 * Todos los datos entran por dashboardRepository (Firestore o seeds).
 */
export default async function DashboardPage() {
  const nowIso = new Date().toISOString();
  const [summary, tasks, leads, properties, pulse, automation] = await Promise.all([
    dashboardRepository.getDashboardSummary(),
    dashboardRepository.getPendingTasks(),
    leadsRepository.getLeads(),
    propertiesRepository.getProperties(),
    getCommercialPulse(),
    getAutomationSnapshot(),
  ]);

  const maxStage = Math.max(...STAGE_KEYS.map((s) => summary.byStage[s]), 1);

  const kpis = [
    { label: 'Leads activos', value: summary.activeLeads, Icon: UsersIcon },
    { label: 'Sin responder', value: summary.unreadConversations, Icon: InboxIcon },
    { label: 'Visitas próximas', value: summary.upcomingVisits, Icon: CalendarIcon },
    { label: 'Tareas pendientes', value: summary.pendingTasks, Icon: ClockIcon },
    { label: 'Inmuebles disponibles', value: summary.availableProperties, Icon: BuildingIcon },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.heading}>
          <span className="eyebrow">Panel comercial</span>
          <h1 className={styles.title}>El día de un vistazo</h1>
        </header>

        <AIInsightsPanel pulse={pulse} />

        <section className={styles.kpis} aria-label="Indicadores">
          {kpis.map(({ label, value, Icon }) => (
            <article key={label} className={styles.kpi}>
              <span className={styles.kpiIcon}>
                <Icon size={17} />
              </span>
              <span className={styles.kpiValue}>{value}</span>
              <span className={styles.kpiLabel}>{label}</span>
            </article>
          ))}
        </section>

        <div className={styles.grid}>
          <section className={styles.card} aria-label="Embudo por etapa">
            <h2 className={styles.cardTitle}>Embudo</h2>
            <ul className={styles.funnel}>
              {STAGE_KEYS.map((stage) => (
                <li key={stage} className={styles.funnelRow}>
                  <span className={styles.funnelLabel}>{STAGES[stage].label}</span>
                  <span className={styles.funnelTrack}>
                    <span
                      className={styles.funnelBar}
                      style={{
                        width: `${(summary.byStage[stage] / maxStage) * 100}%`,
                        background: `var(--stage-${stage})`,
                      }}
                    />
                  </span>
                  <span className={styles.funnelCount}>{summary.byStage[stage]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card} aria-label="Agenda de visitas">
            <h2 className={styles.cardTitle}>Agenda de visitas</h2>
            <VisitScheduler
              visits={automation.allVisits}
              leads={leads}
              properties={properties}
              now={nowIso}
            />
          </section>

          <section className={styles.card} aria-label="Tareas pendientes">
            <h2 className={styles.cardTitle}>Tareas</h2>
            <ul className={styles.list}>
              {tasks.length === 0 && <li className={styles.emptyRow}>Todo al día. 🎉</li>}
              {tasks.map((task) => (
                <li key={task.id} className={styles.row}>
                  <span className={styles.rowIcon}>
                    <CheckIcon size={15} />
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{task.title}</span>
                    <span className={styles.rowMeta}>
                      Vence {formatDay(task.dueAt)} · {formatTime(task.dueAt)}
                    </span>
                  </span>
                  {task.leadId && (
                    <Link href="/inbox" className={styles.rowLink}>
                      Inbox
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <AutomationPanel snapshot={automation} leads={leads} now={nowIso} />
      </div>
    </div>
  );
}
