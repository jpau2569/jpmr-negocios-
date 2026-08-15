import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { leadsRepository, propertiesRepository } from '@/lib/repositories';
import { seedLeads } from '@/data/seed';
import { getAutomationSnapshot, runsForLead } from '@/lib/services/automationService';
import { getLeadActivity } from '@/lib/services/activityService';
import { getLeadInsights } from '@/lib/services/aiLeadService';
import { CHANNELS } from '@/lib/constants/channels';
import { STAGES } from '@/lib/constants/stages';
import { formatBudget } from '@/lib/utils/format';
import { Avatar, Badge, Button } from '@/components/shared';
import {
  ChevronLeftIcon,
  EuroIcon,
  InboxIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from '@/components/shared/Icons';
import { LeadScoreBadge, NextActionCard, MatchList } from '@/components/ai';
import {
  CommunicationHistory,
  DocumentGeneratorPanel,
  TaskList,
  VisitCard,
  WorkflowStatusCard,
} from '@/components/automation';
import { PropertyCard } from '@/components/explorer/PropertyCard';
import styles from './lead.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return seedLeads.map((lead) => ({ id: lead.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const lead = await leadsRepository.getLeadById(id);
  return { title: lead ? lead.name : 'Lead' };
}

/**
 * Ficha de lead — centro operativo: perfil, IA, timeline unificado, tareas,
 * visitas, documentos y automatizaciones disparadas.
 */
export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await leadsRepository.getLeadById(id);
  if (!lead) notFound();

  const nowIso = new Date().toISOString();
  const [property, insights, snapshot] = await Promise.all([
    lead.propertyId ? propertiesRepository.getPropertyById(lead.propertyId) : Promise.resolve(null),
    getLeadInsights(lead.id),
    getAutomationSnapshot(),
  ]);

  const leadTasks = snapshot.allTasks.filter((t) => t.leadId === lead.id);
  const leadVisits = snapshot.allVisits.filter((v) => v.leadId === lead.id);
  const leadRuns = runsForLead(snapshot.runs, lead.id);
  const activity = await getLeadActivity({
    leadId: lead.id,
    tasks: snapshot.allTasks,
    visits: snapshot.allVisits,
    workflowRuns: snapshot.runs,
  });

  const isRent = lead.intent === 'alquiler';

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="Ruta">
          <Link href="/inbox" className={styles.back}>
            <ChevronLeftIcon size={15} />
            Inbox
          </Link>
        </nav>

        <header className={styles.header}>
          <Avatar name={lead.name} size="lg" />
          <div className={styles.identity}>
            <h1 className={styles.name}>{lead.name}</h1>
            <span className={styles.via}>
              Vía {CHANNELS[lead.channel].label} ·{' '}
              {lead.intent === 'compra' ? 'Compra' : isRent ? 'Alquiler' : 'Vende'}
            </span>
          </div>
          <Link href="/inbox">
            <Button variant="primary" iconLeft={<InboxIcon size={16} />}>
              Abrir conversación
            </Button>
          </Link>
        </header>

        <div className={styles.badges}>
          <Badge stage={lead.stage}>{STAGES[lead.stage].label}</Badge>
          {insights && <LeadScoreBadge score={insights.score} />}
          {insights && (
            <Badge tone="accent" dot>
              {insights.intent.label}
            </Badge>
          )}
          {lead.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        {insights && <NextActionCard action={insights.nextAction} className={styles.nextAction} />}

        <div className={styles.columns}>
          {/* Columna principal: historia comercial + tareas */}
          <div className={styles.mainCol}>
            <section className={styles.card} aria-label="Historia comercial">
              <h2 className={styles.cardTitle}>Historia comercial</h2>
              <CommunicationHistory events={activity} />
            </section>

            <section className={styles.card} aria-label="Tareas">
              <h2 className={styles.cardTitle}>Tareas</h2>
              <TaskList tasks={leadTasks} now={nowIso} />
            </section>

            {leadRuns.length > 0 && (
              <section className={styles.card} aria-label="Automatizaciones">
                <h2 className={styles.cardTitle}>Automatizaciones sobre este lead</h2>
                <div className={styles.runs}>
                  {leadRuns.map((run) => (
                    <WorkflowStatusCard key={run.id} run={run} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Columna lateral: datos, visitas, matching y documentos */}
          <aside className={styles.sideCol}>
            <section className={styles.card} aria-label="Datos de contacto">
              <h2 className={styles.cardTitle}>Datos clave</h2>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>
                    <EuroIcon size={14} /> Presupuesto
                  </dt>
                  <dd>{formatBudget(lead.budgetMin, lead.budgetMax, isRent)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>
                    <MapPinIcon size={14} /> Zona
                  </dt>
                  <dd>{lead.zone}</dd>
                </div>
                {lead.phone && (
                  <div className={styles.fact}>
                    <dt>
                      <PhoneIcon size={14} /> Teléfono
                    </dt>
                    <dd>{lead.phone}</dd>
                  </div>
                )}
                {lead.email && (
                  <div className={styles.fact}>
                    <dt>
                      <MailIcon size={14} /> Email
                    </dt>
                    <dd>{lead.email}</dd>
                  </div>
                )}
              </dl>
            </section>

            {leadVisits.length > 0 && (
              <section className={styles.card} aria-label="Visitas">
                <h2 className={styles.cardTitle}>Visitas</h2>
                <div className={styles.visits}>
                  {leadVisits.map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      leadName={lead.name}
                      propertyLabel={property ? `${property.reference} — ${property.title}` : visit.propertyId}
                    />
                  ))}
                </div>
              </section>
            )}

            {insights && insights.matches.length > 0 && (
              <section className={styles.card}>
                <MatchList matches={insights.matches} />
              </section>
            )}

            <section className={styles.card}>
              <DocumentGeneratorPanel
                lead={lead}
                property={property}
                visit={leadVisits[0] ?? null}
              />
            </section>

            {property && (
              <section className={styles.card} aria-label="Inmueble de interés">
                <h2 className={styles.cardTitle}>Inmueble de interés</h2>
                <PropertyCard property={property} className={styles.propertyCard} />
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
