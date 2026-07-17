'use client';

import type { Lead, Message, Property, TimelineEvent } from '@/types';
import { cn } from '@/lib/utils/cn';
import { InboxProvider, useInboxStore } from '@/store/inboxStore';
import { EmptyState } from '@/components/shared';
import { InboxIcon } from '@/components/shared/Icons';
import { LeadList } from './LeadList';
import { ConversationPanel } from './ConversationPanel';
import { LeadContextPanel } from './LeadContextPanel';
import styles from './InboxView.module.css';

/* La página (server component) pasa todos los datos ya resueltos; este
   componente solo compone la vista y el estado de UI. */
export interface InboxViewProps {
  leads: Lead[];
  messagesByLead: Record<string, Message[]>;
  propertiesById: Record<string, Property>;
  timelineByLead: Record<string, TimelineEvent[]>;
}

export function InboxView(props: InboxViewProps) {
  return (
    <InboxProvider initialLeadId={props.leads[0]?.id ?? null}>
      <InboxLayout {...props} />
    </InboxProvider>
  );
}

function InboxLayout({ leads, messagesByLead, propertiesById, timelineByLead }: InboxViewProps) {
  const { selectedLeadId, mobilePane } = useInboxStore();
  const lead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <div className={cn(styles.grid, styles[`pane-${mobilePane}`])}>
      <div className={cn(styles.col, styles.listCol)}>
        <LeadList leads={leads} />
      </div>

      <div className={cn(styles.col, styles.conversationCol)}>
        {lead ? (
          <ConversationPanel lead={lead} messages={messagesByLead[lead.id] ?? []} />
        ) : (
          <EmptyState
            icon={<InboxIcon size={22} />}
            title="Selecciona una conversación"
            description="Elige un lead de la lista para ver su hilo completo."
          />
        )}
      </div>

      <div className={cn(styles.col, styles.contextCol)}>
        {lead && (
          <LeadContextPanel
            lead={lead}
            property={lead.propertyId ? propertiesById[lead.propertyId] : undefined}
            events={timelineByLead[lead.id] ?? []}
          />
        )}
      </div>
    </div>
  );
}
