'use client';

import { useMemo } from 'react';
import type { Lead } from '@/types';
import type { LeadInsights } from '@/types/ai';
import { useInboxStore } from '@/store/inboxStore';
import { EmptyState } from '@/components/shared';
import { InboxIcon } from '@/components/shared/Icons';
import { InboxToolbar } from './InboxToolbar';
import { LeadListItem } from './LeadListItem';
import styles from './LeadList.module.css';

interface Props {
  leads: Lead[];
  insightsByLead?: Record<string, LeadInsights>;
}

/** Columna de leads: toolbar + listado filtrado y ordenado. */
export function LeadList({ leads, insightsByLead }: Props) {
  const { selectedLeadId, selectLead, stageFilter, query } = useInboxStore();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        if (stageFilter !== 'todos' && lead.stage !== stageFilter) return false;
        if (!q) return true;
        return (
          lead.name.toLowerCase().includes(q) ||
          lead.zone.toLowerCase().includes(q) ||
          lead.lastMessagePreview.toLowerCase().includes(q) ||
          lead.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Fijados primero; después, más recientes arriba.
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
  }, [leads, stageFilter, query]);

  return (
    <div className={styles.panel}>
      <InboxToolbar leads={leads} />

      <div className={styles.list} role="list">
        {visible.length > 0 ? (
          visible.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              selected={lead.id === selectedLeadId}
              onSelect={selectLead}
              score={insightsByLead?.[lead.id]?.score}
            />
          ))
        ) : (
          <EmptyState
            icon={<InboxIcon size={22} />}
            title="Sin resultados"
            description="Ningún lead coincide con la búsqueda o el filtro activo."
          />
        )}
      </div>
    </div>
  );
}
