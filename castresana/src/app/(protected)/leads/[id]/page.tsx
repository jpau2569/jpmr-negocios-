import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { leadsRepository, propertiesRepository } from '@/lib/repositories';
import { seedLeads } from '@/data/seed';
import { getTimelineByLead } from '@/data';
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
import { Timeline } from '@/components/inbox/Timeline';
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

/** Ficha de lead: perfil, contacto, inmueble de interés y seguimiento. */
export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await leadsRepository.getLeadById(id);
  if (!lead) notFound();

  const property = lead.propertyId
    ? await propertiesRepository.getPropertyById(lead.propertyId)
    : null;
  const events = getTimelineByLead(lead.id);
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
          {lead.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        <div className={styles.columns}>
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

            <h2 className={styles.cardTitle}>Seguimiento</h2>
            <Timeline events={events} />
          </section>

          {property && (
            <aside className={styles.side} aria-label="Inmueble de interés">
              <h2 className={styles.cardTitle}>Inmueble de interés</h2>
              <PropertyCard property={property} className={styles.propertyCard} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
