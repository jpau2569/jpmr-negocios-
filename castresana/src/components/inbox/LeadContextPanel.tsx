'use client';

import type { Lead, Property, TimelineEvent } from '@/types';
import type { LeadInsights } from '@/types/ai';
import { formatArea, formatBudget, formatPrice } from '@/lib/utils/format';
import { CHANNELS } from '@/lib/constants/channels';
import { STAGES } from '@/lib/constants/stages';
import { useInboxStore } from '@/store/inboxStore';
import { Avatar, Badge, Button, IconButton } from '@/components/shared';
import { LeadScoreBadge, LeadSummaryCard, MatchList, NextActionCard } from '@/components/ai';
import {
  BuildingIcon,
  ChevronLeftIcon,
  EuroIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TagIcon,
} from '@/components/shared/Icons';
import { Timeline } from './Timeline';
import styles from './LeadContextPanel.module.css';

interface Props {
  lead: Lead;
  property?: Property;
  events: TimelineEvent[];
  /** Análisis IA del lead (score, resumen, acción, matching). */
  insights?: LeadInsights;
}

/** Panel derecho: contexto completo del lead activo. */
export function LeadContextPanel({ lead, property, events, insights }: Props) {
  const { setMobilePane } = useInboxStore();
  const isRent = lead.intent === 'alquiler';

  return (
    <aside className={styles.panel} aria-label={`Contexto de ${lead.name}`}>
      <div className={styles.mobileHeader}>
        <IconButton label="Volver a la conversación" onClick={() => setMobilePane('conversation')}>
          <ChevronLeftIcon size={18} />
        </IconButton>
        <span className={styles.mobileTitle}>Contexto del lead</span>
      </div>

      <div className={styles.scroll}>
        {/* Identidad */}
        <div className={styles.identity}>
          <Avatar name={lead.name} size="lg" />
          <div className={styles.identityText}>
            <h2 className={styles.name}>{lead.name}</h2>
            <span className={styles.via}>
              Vía {CHANNELS[lead.channel].label} ·{' '}
              {lead.intent === 'compra' ? 'Compra' : lead.intent === 'alquiler' ? 'Alquiler' : 'Vende'}
            </span>
          </div>
        </div>

        <div className={styles.badges}>
          <Badge stage={lead.stage}>{STAGES[lead.stage].label}</Badge>
          {insights && <LeadScoreBadge score={insights.score} />}
          {lead.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        {insights && <NextActionCard action={insights.nextAction} />}

        <div className={styles.quickActions}>
          <Button variant="primary" size="sm" iconLeft={<PhoneIcon size={15} />} fullWidth>
            Llamar
          </Button>
          <Button variant="ghost" size="sm" iconLeft={<MailIcon size={15} />} fullWidth>
            Email
          </Button>
        </div>

        {/* Resumen IA */}
        {insights && (
          <LeadSummaryCard summary={insights.summary} intent={insights.intent} />
        )}

        {/* Datos clave */}
        <section className={styles.section}>
          <h3 className="eyebrow">Datos clave</h3>
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
                <dd className={styles.truncate}>{lead.email}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Propiedad vinculada */}
        {property && (
          <section className={styles.section}>
            <h3 className="eyebrow">Propiedad de interés</h3>
            <div className={styles.property}>
              <span className={styles.propertyThumb}>
                <BuildingIcon size={20} />
              </span>
              <div className={styles.propertyBody}>
                <span className={styles.propertyRef}>{property.reference}</span>
                <span className={styles.propertyTitle}>{property.title}</span>
                <span className={styles.propertyMeta}>
                  {formatPrice(property.price)}
                  {property.operation === 'alquiler' && '/mes'} · {formatArea(property.areaM2)}
                  {property.bedrooms > 0 && ` · ${property.bedrooms} hab.`}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Encaje con el stock (motor de matching) */}
        {insights && insights.matches.length > 0 && (
          <section className={styles.section}>
            <MatchList matches={insights.matches} />
          </section>
        )}

        {/* Timeline */}
        <section className={styles.section}>
          <h3 className="eyebrow">
            <TagIcon size={13} /> Actividad y seguimiento
          </h3>
          <Timeline events={events} />
        </section>
      </div>
    </aside>
  );
}
