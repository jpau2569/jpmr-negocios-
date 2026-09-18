/* ============================================================================
   Triggers de workflow — detectan OCURRENCIAS de cada disparador a partir
   del estado del sistema. Hoy se evalúan sobre el dataset (simulación
   determinista); mañana los dispararán eventos reales (Cloud Functions,
   webhooks de portales/WhatsApp). La firma no cambiará.
   ============================================================================ */

import type { Lead, Property, Visit } from '@/types';
import type { LeadInsights } from '@/types/ai';
import type { WorkflowTrigger } from '@/types/automation';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface SystemState {
  leads: Lead[];
  properties: Property[];
  visits: Visit[];
  insightsByLead: Record<string, LeadInsights>;
  now: Date;
}

/** Una ocurrencia concreta de un trigger (entidades implicadas). */
export interface TriggerOccurrence {
  trigger: WorkflowTrigger;
  lead?: Lead;
  property?: Property;
  visit?: Visit;
  detail: string;
}

type TriggerDetector = (state: SystemState) => TriggerOccurrence[];

export const TRIGGER_DETECTORS: Record<WorkflowTrigger, TriggerDetector> = {
  /** Lead creado en las últimas 24 h. */
  'lead-nuevo': ({ leads, now }) =>
    leads
      .filter((l) => now.getTime() - new Date(l.createdAt).getTime() < DAY)
      .map((lead) => ({
        trigger: 'lead-nuevo' as const,
        lead,
        detail: `Lead entrado por ${lead.channel} hace <24 h`,
      })),

  /** Caliente con mensajes sin responder. */
  'caliente-sin-respuesta': ({ leads, insightsByLead }) =>
    leads
      .filter((l) => l.unread > 0 && insightsByLead[l.id]?.score.label === 'caliente')
      .map((lead) => ({
        trigger: 'caliente-sin-respuesta' as const,
        lead,
        detail: `Score ${insightsByLead[lead.id]!.score.score} con ${lead.unread} sin responder`,
      })),

  /** El cliente ha pedido visita (texto reciente o acción IA lo indica). */
  'visita-solicitada': ({ leads, insightsByLead }) =>
    leads
      .filter((l) => {
        const action = insightsByLead[l.id]?.nextAction.kind;
        return action === 'proponer-visita' || action === 'confirmar-visita';
      })
      .map((lead) => ({
        trigger: 'visita-solicitada' as const,
        lead,
        detail: insightsByLead[lead.id]!.nextAction.reason,
      })),

  /** Visita confirmada próxima (recordatorio). */
  'visita-confirmada': ({ visits, leads, now }) =>
    visits
      .filter(
        (v) =>
          v.status === 'confirmada' &&
          new Date(v.scheduledAt).getTime() - now.getTime() < 2 * DAY &&
          new Date(v.scheduledAt).getTime() > now.getTime(),
      )
      .map((visit) => ({
        trigger: 'visita-confirmada' as const,
        visit,
        lead: leads.find((l) => l.id === visit.leadId),
        detail: `Visita confirmada en <48 h`,
      })),

  /** Silencio ≥48 h en leads activos tras mensaje nuestro. */
  'sin-respuesta-48h': ({ leads, now }) =>
    leads
      .filter((l) => {
        const silence = now.getTime() - new Date(l.lastMessageAt).getTime();
        return l.stage !== 'cerrado' && l.unread === 0 && silence >= 2 * DAY && silence < 14 * DAY;
      })
      .map((lead) => ({
        trigger: 'sin-respuesta-48h' as const,
        lead,
        detail: `${Math.round((now.getTime() - new Date(lead.lastMessageAt).getTime()) / DAY)} días sin respuesta`,
      })),

  /** Propiedad publicada hace <7 días con varios leads compatibles. */
  'captacion-nueva': ({ properties, insightsByLead, now }) =>
    properties
      .filter((p) => p.status === 'disponible' && now.getTime() - new Date(p.publishedAt).getTime() < 7 * DAY)
      .map((property) => {
        const compatibles = Object.values(insightsByLead).filter((i) =>
          i.matches.some((m) => m.propertyId === property.id && m.score >= 55),
        ).length;
        return { property, compatibles };
      })
      .filter(({ compatibles }) => compatibles >= 2)
      .map(({ property, compatibles }) => ({
        trigger: 'captacion-nueva' as const,
        property,
        detail: `${compatibles} leads compatibles con ${property.reference}`,
      })),

  /** Propietario con intención de vender detectada. */
  'vendedor-detectado': ({ leads, insightsByLead }) =>
    leads
      .filter(
        (l) =>
          l.intent === 'venta' &&
          insightsByLead[l.id]?.intent.intent === 'captacion-potencial',
      )
      .map((lead) => ({
        trigger: 'vendedor-detectado' as const,
        lead,
        detail: 'Propietario sin encargo firmado (captación potencial)',
      })),
};

/** Detecta todas las ocurrencias de un trigger en el estado actual. */
export function detectOccurrences(
  trigger: WorkflowTrigger,
  state: SystemState,
): TriggerOccurrence[] {
  return TRIGGER_DETECTORS[trigger](state);
}
