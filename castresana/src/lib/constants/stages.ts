import type { LeadStage } from '@/types';

/**
 * Metadatos del embudo comercial. El color real vive en los design tokens
 * (--stage-*); aquí solo se referencia la clave para que Badge la resuelva.
 */
export const STAGES: Record<LeadStage, { label: string; order: number }> = {
  nuevo: { label: 'Nuevo', order: 0 },
  seguimiento: { label: 'Seguimiento', order: 1 },
  visita: { label: 'Visita', order: 2 },
  oferta: { label: 'Oferta', order: 3 },
  cerrado: { label: 'Cerrado', order: 4 },
};

export const STAGE_KEYS = Object.keys(STAGES) as LeadStage[];
