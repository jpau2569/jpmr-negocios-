'use client';

/* ============================================================================
   inboxStore — estado de UI del Inbox (Context + useReducer, sin dependencias).
   Gestiona: lead seleccionado, filtro por etapa, búsqueda y visibilidad de
   paneles en móvil. Los DATOS viven en src/data (mock hoy, Firebase mañana);
   aquí solo vive el estado efímero de la interfaz.
   ============================================================================ */

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { LeadStage } from '@/types';

export type StageFilter = LeadStage | 'todos';

/** Panel visible en móvil (en desktop se ven los tres a la vez). */
export type MobilePane = 'list' | 'conversation' | 'context';

interface InboxState {
  selectedLeadId: string | null;
  stageFilter: StageFilter;
  query: string;
  mobilePane: MobilePane;
}

type InboxAction =
  | { type: 'select-lead'; id: string }
  | { type: 'set-stage-filter'; stage: StageFilter }
  | { type: 'set-query'; query: string }
  | { type: 'set-mobile-pane'; pane: MobilePane }
  | { type: 'back-to-list' };

function reducer(state: InboxState, action: InboxAction): InboxState {
  switch (action.type) {
    case 'select-lead':
      // Al seleccionar en móvil saltamos a la conversación.
      return { ...state, selectedLeadId: action.id, mobilePane: 'conversation' };
    case 'set-stage-filter':
      return { ...state, stageFilter: action.stage };
    case 'set-query':
      return { ...state, query: action.query };
    case 'set-mobile-pane':
      return { ...state, mobilePane: action.pane };
    case 'back-to-list':
      return { ...state, mobilePane: 'list' };
    default:
      return state;
  }
}

interface InboxStore extends InboxState {
  selectLead: (id: string) => void;
  setStageFilter: (stage: StageFilter) => void;
  setQuery: (query: string) => void;
  setMobilePane: (pane: MobilePane) => void;
  backToList: () => void;
}

const InboxContext = createContext<InboxStore | null>(null);

export function InboxProvider({
  children,
  initialLeadId,
}: {
  children: ReactNode;
  initialLeadId: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, {
    selectedLeadId: initialLeadId,
    stageFilter: 'todos',
    query: '',
    mobilePane: 'list',
  });

  const store = useMemo<InboxStore>(
    () => ({
      ...state,
      selectLead: (id) => dispatch({ type: 'select-lead', id }),
      setStageFilter: (stage) => dispatch({ type: 'set-stage-filter', stage }),
      setQuery: (query) => dispatch({ type: 'set-query', query }),
      setMobilePane: (pane) => dispatch({ type: 'set-mobile-pane', pane }),
      backToList: () => dispatch({ type: 'back-to-list' }),
    }),
    [state],
  );

  return <InboxContext.Provider value={store}>{children}</InboxContext.Provider>;
}

export function useInboxStore(): InboxStore {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInboxStore debe usarse dentro de <InboxProvider>');
  return ctx;
}
