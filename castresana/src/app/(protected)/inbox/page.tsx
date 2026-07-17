import type { Metadata } from 'next';
import type { Message, Property, TimelineEvent } from '@/types';
import { conversationsRepository, leadsRepository, propertiesRepository } from '@/lib/repositories';
import { getTimelineByLead } from '@/data';
import { InboxView } from '@/components/inbox/InboxView';

export const metadata: Metadata = {
  title: 'Inbox',
};

/**
 * Inbox — bandeja unificada de leads y conversaciones.
 * Los datos entran por la capa de repositorios (Firestore o seeds según
 * entorno); esta página solo los indexa para la vista.
 */
export default async function InboxPage() {
  const leads = await leadsRepository.getLeads();

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
    />
  );
}
