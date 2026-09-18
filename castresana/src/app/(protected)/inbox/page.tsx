import type { Metadata } from 'next';
import type { Message, Property, TimelineEvent } from '@/types';
import { conversationsRepository, propertiesRepository } from '@/lib/repositories';
import { getTimelineByLead } from '@/data';
import { getAllLeadInsights } from '@/lib/services/aiLeadService';
import { InboxView } from '@/components/inbox/InboxView';

export const metadata: Metadata = {
  title: 'Inbox',
};

/**
 * Inbox — bandeja unificada de leads y conversaciones.
 * Los datos entran por la capa de repositorios y el análisis por la capa IA
 * (score, resumen, siguiente acción, respuestas sugeridas, matching).
 */
export default async function InboxPage() {
  const { leads, insightsByLead } = await getAllLeadInsights();

  const messagesByLead: Record<string, Message[]> = {};
  const timelineByLead: Record<string, TimelineEvent[]> = {};
  const propertiesById: Record<string, Property> = {};

  for (const lead of leads) {
    messagesByLead[lead.id] = await conversationsRepository.getMessagesByLeadId(lead.id);
    timelineByLead[lead.id] = getTimelineByLead(lead.id);
    if (lead.propertyId && !propertiesById[lead.propertyId]) {
      const property = await propertiesRepository.getPropertyById(lead.propertyId);
      if (property) propertiesById[property.id] = property;
    }
  }

  return (
    <InboxView
      leads={leads}
      messagesByLead={messagesByLead}
      propertiesById={propertiesById}
      timelineByLead={timelineByLead}
      insightsByLead={insightsByLead}
    />
  );
}
