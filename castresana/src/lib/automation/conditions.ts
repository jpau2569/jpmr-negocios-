/* ============================================================================
   Condiciones de workflow — predicados con id, registrados y reutilizables.
   Cada condición recibe el contexto del evento y responde sí/no + motivo.
   ============================================================================ */

import type { Lead, Property, Visit } from '@/types';
import type { LeadInsights } from '@/types/ai';
import type { AutomationPreferences } from '@/types/automation';

const HOUR = 3_600_000;

export interface ConditionContext {
  lead?: Lead;
  property?: Property;
  visit?: Visit;
  insights?: LeadInsights;
  prefs: AutomationPreferences;
  now: Date;
}

export interface ConditionResult {
  pass: boolean;
  reason: string;
}

export type Condition = (ctx: ConditionContext) => ConditionResult;

function silenceHours(lead: Lead, now: Date): number {
  return (now.getTime() - new Date(lead.lastMessageAt).getTime()) / HOUR;
}

/** Registro de condiciones disponibles para las reglas. */
export const CONDITIONS: Record<string, Condition> = {
  'lead-activo': (ctx) => ({
    pass: Boolean(ctx.lead && ctx.lead.stage !== 'cerrado'),
    reason: ctx.lead?.stage === 'cerrado' ? 'lead cerrado' : 'lead activo',
  }),

  'tiene-mensajes-sin-leer': (ctx) => ({
    pass: Boolean(ctx.lead && ctx.lead.unread > 0),
    reason: ctx.lead ? `${ctx.lead.unread} sin leer` : 'sin lead',
  }),

  'es-caliente': (ctx) => ({
    pass: ctx.insights?.score.label === 'caliente',
    reason: ctx.insights ? `score ${ctx.insights.score.score}` : 'sin análisis',
  }),

  'silencio-supera-limite-caliente': (ctx) => {
    if (!ctx.lead) return { pass: false, reason: 'sin lead' };
    const hours = silenceHours(ctx.lead, ctx.now);
    return {
      pass: hours >= ctx.prefs.hotLeadMaxSilenceHours,
      reason: `${Math.round(hours)} h de silencio (límite ${ctx.prefs.hotLeadMaxSilenceHours} h)`,
    };
  },

  'silencio-supera-seguimiento': (ctx) => {
    if (!ctx.lead) return { pass: false, reason: 'sin lead' };
    const hours = silenceHours(ctx.lead, ctx.now);
    return {
      pass: hours >= ctx.prefs.followUpAfterHours,
      reason: `${Math.round(hours)} h sin actividad (umbral ${ctx.prefs.followUpAfterHours} h)`,
    };
  },

  'visita-sin-confirmar': (ctx) => ({
    pass: ctx.visit?.status === 'propuesta',
    reason: ctx.visit ? `visita ${ctx.visit.status}` : 'sin visita',
  }),

  'visita-confirmada': (ctx) => ({
    pass: ctx.visit?.status === 'confirmada',
    reason: ctx.visit ? `visita ${ctx.visit.status}` : 'sin visita',
  }),

  'recordatorios-activados': (ctx) => ({
    pass: ctx.prefs.visitReminders,
    reason: ctx.prefs.visitReminders ? 'recordatorios activados' : 'recordatorios desactivados',
  }),

  'propiedad-disponible': (ctx) => ({
    pass: ctx.property?.status === 'disponible',
    reason: ctx.property ? `estado ${ctx.property.status}` : 'sin propiedad',
  }),

  'quiere-vender': (ctx) => ({
    pass: ctx.lead?.intent === 'venta',
    reason: ctx.lead ? `intención ${ctx.lead.intent}` : 'sin lead',
  }),
};

/** Evalúa una lista de ids de condición; falla la primera que no pase. */
export function evaluateConditions(
  ids: string[],
  ctx: ConditionContext,
): { pass: boolean; detail: string } {
  for (const id of ids) {
    const condition = CONDITIONS[id];
    if (!condition) return { pass: false, detail: `condición desconocida: ${id}` };
    const result = condition(ctx);
    if (!result.pass) return { pass: false, detail: `${id}: ${result.reason}` };
  }
  return { pass: true, detail: 'todas las condiciones cumplidas' };
}
