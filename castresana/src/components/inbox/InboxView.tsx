'use client';

import { useMemo, useState } from 'react';
import type { Conversation } from '@/types';
import { cn } from '@/lib/cn';
import { Workspace, PanelHeader } from '@/components/layout';
import { SearchField, Button, EmptyState } from '@/components/ui';
import { InboxIcon, FilterIcon, PlusIcon } from '@/components/icons';
import { ConversationItem } from './ConversationItem';
import { MessageThread } from './MessageThread';
import { InboxContext } from './InboxContext';
import styles from './InboxView.module.css';

interface Props {
  conversations: Conversation[];
}

type FilterKey = 'todas' | 'sin-leer' | 'caliente';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'sin-leer', label: 'Sin leer' },
  { key: 'caliente', label: 'Calientes' },
];

export function InboxView({ conversations }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [selectedId, setSelectedId] = useState<string>(conversations[0]?.id ?? '');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'sin-leer' && c.unread === 0) return false;
      if (filter === 'caliente' && c.temperature !== 'caliente') return false;
      if (!q) return true;
      return (
        c.leadName.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, filter]);

  const selected =
    conversations.find((c) => c.id === selectedId) ?? visible[0] ?? conversations[0];

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const list = (
    <div className={styles.listPanel}>
      <PanelHeader
        title="Inbox"
        subtitle={totalUnread > 0 ? `${totalUnread} sin leer` : 'Al día'}
        actions={
          <Button variant="ghost" size="sm" iconOnly aria-label="Nueva conversación">
            <PlusIcon size={18} />
          </Button>
        }
      >
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o asunto…"
        />
      </PanelHeader>

      <div className={styles.filters}>
        <div className={styles.filterTabs}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={cn(styles.filterTab, filter === f.key && styles.filterTabActive)}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className={styles.filterIcon} aria-label="Más filtros">
          <FilterIcon size={16} />
        </button>
      </div>

      <div className={styles.items}>
        {visible.length > 0 ? (
          visible.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              selected={selected?.id === c.id}
              onSelect={setSelectedId}
            />
          ))
        ) : (
          <EmptyState
            icon={<InboxIcon size={22} />}
            title="Sin resultados"
            description="No hay conversaciones que coincidan con el filtro."
          />
        )}
      </div>
    </div>
  );

  if (!selected) {
    return (
      <Workspace list={list}>
        <EmptyState
          icon={<InboxIcon size={22} />}
          title="Bandeja vacía"
          description="Cuando entren mensajes de tus leads, aparecerán aquí."
        />
      </Workspace>
    );
  }

  return (
    <Workspace list={list} context={<InboxContext conversation={selected} />}>
      <MessageThread conversation={selected} />
    </Workspace>
  );
}
