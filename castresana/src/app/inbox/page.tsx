import type { Metadata } from 'next';
import type { Message, Property, TimelineEvent } from '@/types';
import { getMessagesByLead, getProperty, getTimelineByLead, leads } from '@/data';
import { InboxView } from '@/components/inbox/InboxView';

export const metadata: Metadata = {
  title: 'Inbox',
};

/**
 * Inbox — bandeja unificada de leads y conversaciones.
 * Server component: resuelve los datos (hoy mock, mañana Firebase) y los
 * entrega ya indexados a la vista cliente.
 */
export default function InboxPage() {
  const messagesByLead: Record<string, Message[]> = {};
  const timelineByLead: Record<string, TimelineEvent[]> = {};
  const propertiesById: Record<string, Property> = {};

  for (const lead of leads) {
    messagesByLead[lead.id] = getMessagesByLead(lead.id);
    timelineByLead[lead.id] = getTimelineByLead(lead.id);
    if (lead.propertyId) {
      const property = getProperty(lead.propertyId);
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
