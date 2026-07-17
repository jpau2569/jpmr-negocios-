import Link from 'next/link';
import type { CommercialPulse } from '@/types/ai';
import { formatPrice } from '@/lib/utils/format';
import { SparkleIcon, UsersIcon } from '@/components/shared/Icons';
import { AlertList } from './AlertList';
import styles from './AIInsightsPanel.module.css';

const SCORE_COLOR = { caliente: 'var(--danger)', templado: 'var(--warning)', frio: 'var(--info)' } as const;

export interface AIInsightsPanelProps {
  pulse: CommercialPulse;
}

/** Bloque «IA comercial» del dashboard: prioridades, alertas y oportunidades. */
export function AIInsightsPanel({ pulse }: AIInsightsPanelProps) {
  return (
    <section className={styles.panel} aria-label="IA comercial">
      <header className={styles.header}>
        <h2 className={styles.title}>
          <SparkleIcon size={17} />
          IA comercial
        </h2>
        <span className={styles.engine}>Motor heurístico v1 · razones visibles</span>
      </header>

      {/* Recomendaciones del día */}
      <ul className={styles.tips}>
        {pulse.dailyTips.map((tip) => (
          <li key={tip} className={styles.tip}>
            {tip}
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        {/* Leads prioritarios */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Leads prioritarios hoy</h3>
          <ul className={styles.leadList}>
            {pulse.priorityLeads.map((lead) => (
              <li key={lead.leadId}>
                <Link href={`/leads/${lead.leadId}`} className={styles.leadRow}>
                  <span
                    className={styles.leadScore}
                    style={{ color: SCORE_COLOR[lead.label] }}
                    title={`Score ${lead.score}`}
                  >
                    {lead.score}
                  </span>
                  <span className={styles.leadBody}>
                    <span className={styles.leadName}>
                      {lead.name}
                      {lead.unread > 0 && <em className={styles.unread}>{lead.unread}</em>}
                    </span>
                    <span className={styles.leadAction}>
                      {lead.action.label} · {lead.action.urgency === 'hoy' ? 'hoy' : lead.action.urgency === 'esta-semana' ? 'esta semana' : 'sin prisa'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Alertas */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Alertas</h3>
          <AlertList alerts={pulse.alerts} />
        </div>

        {/* Oportunidades + demanda + carga */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Mejores oportunidades</h3>
          <ul className={styles.oppList}>
            {pulse.opportunities.map((opp) => (
              <li key={opp.leadId}>
                <Link href={`/properties/${opp.match.propertyId}`} className={styles.oppRow}>
                  <span className={styles.oppScore}>{opp.match.score}%</span>
                  <span className={styles.oppBody}>
                    <span className={styles.oppNames}>
                      {opp.leadName.split(' ').slice(0, 2).join(' ')} ↔ {opp.match.reference}
                    </span>
                    <span className={styles.oppMeta}>
                      {formatPrice(opp.match.price)}
                      {opp.match.operation === 'alquiler' && '/mes'} · {opp.match.reasons[0] ?? ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {pulse.propertyDemand.length > 0 && (
            <>
              <h3 className={styles.cardTitle}>Inmuebles con más matches</h3>
              <ul className={styles.demandList}>
                {pulse.propertyDemand.map((d) => (
                  <li key={d.propertyId} className={styles.demandRow}>
                    <Link href={`/properties/${d.propertyId}`} className={styles.demandRef}>
                      {d.reference}
                    </Link>
                    <span className={styles.demandCount}>
                      {d.matchCount} {d.matchCount === 1 ? 'lead' : 'leads'} · mejor {d.topScore}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className={styles.cardTitle}>Carga por agente</h3>
          <ul className={styles.loadList}>
            {pulse.agentLoad.map((agent) => (
              <li key={agent.agentId} className={styles.loadRow}>
                <span className={styles.loadName}>
                  <UsersIcon size={13} /> {agent.name.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className={styles.loadMeta}>
                  {agent.openTasks} tareas · {agent.upcomingVisits} visitas
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
