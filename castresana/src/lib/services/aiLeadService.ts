/* ============================================================================
   aiLeadService — agrega todo el análisis IA de un lead en un solo objeto
   serializable (LeadInsights) que las páginas server pasan a la UI.
   Orden de cálculo: matching → score → intención → acción → resumen → replies.
   ============================================================================ */

import type { Lead, Property, Visit } from '@/types';
import type { LeadInsights } from '@/types/ai';
import { aiProvider, type LeadContext } from '@/lib/ai';
import { conversationsRepository, leadsRepository, propertiesRepository } from '@/lib/repositories';
import { seedVisits } from '@/data/seed';

/** Visitas de un lead (seed hoy; con Firestore real, query a `visits`). */
function visitsForLead(leadId: string): Visit[] {
  return seedVisits.filter((v) => v.leadId === leadId);
}

/** Calcula los insights completos de un lead ya cargado. */
export async function computeLeadInsights(
  lead: Lead,
  properties: Property[],
  now: Date = new Date(),
): Promise<LeadInsights> {
  const messages = await conversationsRepository.getMessagesByLeadId(lead.id);
  const property = lead.propertyId
    ? (properties.find((p) => p.id === lead.propertyId) ?? null)
    : null;

  const ctx: LeadContext = { lead, messages, visits: visitsForLead(lead.id), property, now };

  const matches = aiProvider.match(lead, properties, 4);
  const score = aiProvider.score(ctx, matches);
  const intent = aiProvider.classify(ctx);
  const nextAction = aiProvider.nextAction(ctx, matches, score);
  const summary = aiProvider.summarize(ctx, score, nextAction);
  const replies = aiProvider.replies(ctx, matches, nextAction);

  return { leadId: lead.id, score, intent, summary, replies, nextAction, matches };
}

/** Insights de un lead por id. */
export async function getLeadInsights(leadId: string): Promise<LeadInsights | null> {
  const lead = await leadsRepository.getLeadById(leadId);
  if (!lead) return null;
  const properties = await propertiesRepository.getProperties();
  return computeLeadInsights(lead, properties);
}

/** Insights de todos los leads, indexados por id (para Inbox y dashboard). */
export async function getAllLeadInsights(
  now: Date = new Date(),
): Promise<{ leads: Lead[]; insightsByLead: Record<string, LeadInsights> }> {
  const [leads, properties] = await Promise.all([
    leadsRepository.getLeads(),
    propertiesRepository.getProperties(),
  ]);

  const insightsByLead: Record<string, LeadInsights> = {};
  for (const lead of leads) {
    insightsByLead[lead.id] = await computeLeadInsights(lead, properties, now);
  }
  return { leads, insightsByLead };
}

/**
 * Leads compatibles con un inmueble (para la ficha): reutiliza el motor de
 * matching en sentido inverso y devuelve score + motivo por lead.
 */
export async function getLeadMatchesForProperty(
  propertyId: string,
  limit = 4,
): Promise<Array<{ lead: Lead; score: number; reason: string }>> {
  const [leads, property] = await Promise.all([
    leadsRepository.getLeads(),
    propertiesRepository.getPropertyById(propertyId),
  ]);
  if (!property) return [];

  return leads
    .filter((lead) => lead.stage !== 'cerrado')
    .map((lead) => {
      const match = aiProvider.match(lead, [property], 1)[0];
      return match ? { lead, score: match.score, reason: match.reasons.join(' · ') } : null;
    })
    .filter((m): m is { lead: Lead; score: number; reason: string } => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
