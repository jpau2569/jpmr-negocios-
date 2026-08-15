'use client';

import { useMemo } from 'react';
import type { Lead } from '@/types';
import { STAGES, STAGE_KEYS } from '@/lib/constants/stages';
import { useInboxStore, type StageFilter } from '@/store/inboxStore';
import { SearchInput, SegmentedControl, IconButton } from '@/components/shared';
import { FilterIcon } from '@/components/shared/Icons';
import styles from './InboxToolbar.module.css';

interface Props {
  leads: Lead[];
}

/** Cabecera del panel de lista: buscador + filtros de etapa. */
export function InboxToolbar({ leads }: Props) {
  const { query, setQuery, stageFilter, setStageFilter } = useInboxStore();

  const options = useMemo(() => {
    const counts = new Map<StageFilter, number>();
    for (const lead of leads) {
      counts.set(lead.stage, (counts.get(lead.stage) ?? 0) + 1);
    }
    return [
      { value: 'todos' as StageFilter, label: 'Todos', count: leads.length },
      ...STAGE_KEYS.map((key) => ({
        value: key as StageFilter,
        label: STAGES[key].label,
        count: counts.get(key) ?? 0,
      })),
    ];
  }, [leads]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchRow}>
        <SearchInput
          placeholder="Buscar lead, zona o mensaje…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar en el inbox"
        />
        <IconButton label="Más filtros" size="md">
          <FilterIcon size={17} />
        </IconButton>
      </div>

      <SegmentedControl
        label="Filtrar por etapa"
        options={options}
        value={stageFilter}
        onChange={setStageFilter}
      />
    </div>
  );
}
