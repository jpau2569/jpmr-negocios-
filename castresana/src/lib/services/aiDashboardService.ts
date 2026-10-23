/* ============================================================================
   aiDashboardService — pulso comercial del día para el panel IA.
   Compone prioridades, alertas, oportunidades, demanda por inmueble y carga
   por agente a partir del motor heurístico y los datos del sistema.
   ============================================================================ */

import type { CommercialPulse, Opportunity, PriorityLead, PropertyDemand } from '@/types/ai';
import { generateAlerts } from '@/lib/ai';
import { propertiesRepository } from '@/lib/repositories';
import { seedAgents, seedTasks, seedVisits } from '@/data/seed';
import { getAllLeadInsights } from './aiLeadService';

export async function getCommercialPulse(now: Date = new Date()): Promise<CommercialPulse> {
  const [{ leads, insightsByLead }, properties] = await Promise.all([
    getAllLeadInsights(now),
    propertiesRepository.getProperties(),
  ]);

  // --- Leads prioritarios: por score, excluyendo cerrados --------------------
  const priorityLeads: PriorityLead[] = leads
    .filter((lead) => lead.stage !== 'cerrado')
    .map((lead) => {
      const i = insightsByLead[lead.id]!;
      return {
        leadId: lead.id,
        name: lead.name,
        zone: lead.zone,
        unread: lead.unread,
        score: i.score.score,
        label: i.score.label,
        action: i.nextAction,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // --- Alertas ----------------------------------------------------------------
  const alerts = generateAlerts({
    leads,
    insightsByLead,
    visits: seedVisits,
    properties,
    now,
  }).slice(0, 6);

  // --- Mejores oportunidades: mejor match por lead activo ----------------------
  const opportunities: Opportunity[] = leads
    .filter((lead) => lead.stage !== 'cerrado')
    .map((lead) => {
      const match = insightsByLead[lead.id]!.matches[0];
      return match ? { leadId: lead.id, leadName: lead.name, match } : null;
    })
    .filter((o): o is Opportunity => o !== null)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 4);

  // --- Demanda por inmueble ------------------------------------------------------
  const demandMap = new Map<string, PropertyDemand>();
  for (const insights of Object.values(insightsByLead)) {
    for (const match of insights.matches) {
      if (match.score < 50) continue;
      const current = demandMap.get(match.propertyId);
      if (current) {
        current.matchCount += 1;
        current.topScore = Math.max(current.topScore, match.score);
      } else {
        demandMap.set(match.propertyId, {
          propertyId: match.propertyId,
          reference: match.reference,
          title: match.title,
          matchCount: 1,
          topScore: match.score,
        });
      }
    }
  }
  const propertyDemand = [...demandMap.values()]
    .sort((a, b) => b.matchCount - a.matchCount || b.topScore - a.topScore)
    .slice(0, 4);

  // --- Carga por agente (tareas abiertas + visitas próximas) ---------------------
  const agentLoad = seedAgents.map((agent) => ({
    agentId: agent.id,
    name: agent.name,
    openTasks: seedTasks.filter((t) => t.agentId === agent.id && !t.done).length,
    upcomingVisits: seedVisits.filter(
      (v) =>
        v.agentId === agent.id &&
        (v.status === 'propuesta' || v.status === 'confirmada') &&
        new Date(v.scheduledAt) >= now,
    ).length,
  }));

  // --- Recomendaciones del día -----------------------------------------------------
  const dailyTips: string[] = [];
  const hot = priorityLeads.filter((l) => l.label === 'caliente');
  if (hot.length > 0) {
    dailyTips.push(
      `Empieza por ${hot.map((l) => l.name.split(' ')[0]).join(' y ')}: ${hot.length === 1 ? 'es el lead más caliente' : 'son los leads más calientes'} del día.`,
    );
  }
  const unconfirmed = alerts.find((a) => a.kind === 'visita-sin-confirmar');
  if (unconfirmed) dailyTips.push('Confirma las visitas propuestas antes del mediodía: caducan rápido.');
  if (opportunities[0]) {
    dailyTips.push(
      `Mejor cruce del día: ${opportunities[0].leadName.split(' ')[0]} ↔ ${opportunities[0].match.reference} (${opportunities[0].match.score}%).`,
    );
  }
  if (propertyDemand[0] && propertyDemand[0].matchCount >= 3) {
    dailyTips.push(
      `${propertyDemand[0].reference} acumula ${propertyDemand[0].matchCount} leads compatibles: organiza una ronda de visitas.`,
    );
  }
  if (dailyTips.length === 0) dailyTips.push('Día tranquilo: buen momento para repescar leads fríos con novedades.');

  return {
    generatedAt: now.toISOString(),
    priorityLeads,
    alerts,
    opportunities,
    propertyDemand,
    agentLoad,
    dailyTips,
  };
}
