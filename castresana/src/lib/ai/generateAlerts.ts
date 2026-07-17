/* ============================================================================
   Alertas inteligentes — condiciones de negocio sobre el estado del sistema.
   Cada alerta lleva severidad, detalle y enlace. Este mismo generador
   alimentará las push (FCM) cuando se conecte el backend de notificaciones.
   ============================================================================ */

import type { Lead, Property, Visit } from '@/types';
import type { LeadInsights, SmartAlert } from '@/types/ai';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface GenerateAlertsInput {
  leads: Lead[];
  insightsByLead: Record<string, LeadInsights>;
  visits: Visit[];
  properties: Property[];
  now?: Date;
}

export function generateAlerts({
  leads,
  insightsByLead,
  visits,
  properties,
  now = new Date(),
}: GenerateAlertsInput): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const nowMs = now.getTime();
  const leadName = (id: string) => leads.find((l) => l.id === id)?.name ?? id;

  // --- 1 · Lead caliente sin respuesta ---------------------------------------
  for (const lead of leads) {
    const insights = insightsByLead[lead.id];
    if (!insights) continue;
    const silenceH = Math.round((nowMs - new Date(lead.lastMessageAt).getTime()) / HOUR);

    if (insights.score.label === 'caliente' && lead.unread > 0) {
      alerts.push({
        id: `al-hot-${lead.id}`,
        kind: 'caliente-sin-respuesta',
        severity: 'alta',
        title: `${lead.name} (caliente) espera respuesta`,
        detail: `Score ${insights.score.score} · ${lead.unread} mensaje(s) sin responder desde hace ${silenceH} h.`,
        leadId: lead.id,
        link: '/inbox',
      });
    }

    // --- 4 · Lead enfriándose -------------------------------------------------
    const silenceDays = silenceH / 24;
    if (
      insights.score.label === 'templado' &&
      lead.stage !== 'cerrado' &&
      silenceDays >= 3 &&
      silenceDays <= 14
    ) {
      alerts.push({
        id: `al-cooling-${lead.id}`,
        kind: 'lead-enfriandose',
        severity: 'media',
        title: `${lead.name} se está enfriando`,
        detail: `${Math.round(silenceDays)} días sin actividad. Acción sugerida: ${insights.nextAction.label.toLowerCase()}.`,
        leadId: lead.id,
        link: '/inbox',
      });
    }

    // --- 6 · Conversación sin seguimiento ------------------------------------
    if (lead.stage !== 'cerrado' && silenceDays > 14) {
      alerts.push({
        id: `al-stale-${lead.id}`,
        kind: 'sin-seguimiento',
        severity: 'baja',
        title: `Sin seguimiento: ${lead.name}`,
        detail: `Más de ${Math.floor(silenceDays)} días sin contacto. Valorar repesca o archivo temporal.`,
        leadId: lead.id,
        link: `/leads/${lead.id}`,
      });
    }
  }

  // --- 2 · Visita pendiente de confirmar --------------------------------------
  for (const visit of visits) {
    if (visit.status !== 'propuesta') continue;
    const hoursTo = (new Date(visit.scheduledAt).getTime() - nowMs) / HOUR;
    if (hoursTo < 72) {
      alerts.push({
        id: `al-visit-${visit.id}`,
        kind: 'visita-sin-confirmar',
        severity: hoursTo < 24 ? 'alta' : 'media',
        title: `Visita sin confirmar · ${leadName(visit.leadId)}`,
        detail:
          hoursTo <= 0
            ? 'La fecha propuesta ya pasó: reprogramar cuanto antes.'
            : `Programada en ${Math.max(1, Math.round(hoursTo))} h y sigue sin confirmar.`,
        leadId: visit.leadId,
        propertyId: visit.propertyId,
        link: '/inbox',
      });
    }
  }

  // --- 3 · Nueva captación compatible con leads activos -------------------------
  const FRESH_DAYS = 7;
  for (const property of properties) {
    const ageDays = (nowMs - new Date(property.publishedAt).getTime()) / DAY;
    if (ageDays > FRESH_DAYS || property.status !== 'disponible') continue;

    const compatible = Object.values(insightsByLead).filter((i) =>
      i.matches.some((m) => m.propertyId === property.id && m.score >= 55),
    );
    if (compatible.length > 0) {
      alerts.push({
        id: `al-newprop-${property.id}`,
        kind: 'captacion-compatible',
        severity: 'media',
        title: `Captación nueva con ${compatible.length} lead(s) compatible(s)`,
        detail: `${property.reference} — ${property.title}. Enviarla puede generar visitas esta semana.`,
        propertyId: property.id,
        link: `/properties/${property.id}`,
      });
    }
  }

  // --- 5 · Inmueble con varias coincidencias activas -----------------------------
  for (const property of properties) {
    if (property.status !== 'disponible') continue;
    const demandCount = Object.values(insightsByLead).filter((i) =>
      i.matches.some((m) => m.propertyId === property.id && m.score >= 50),
    ).length;
    if (demandCount >= 3) {
      alerts.push({
        id: `al-demand-${property.id}`,
        kind: 'inmueble-con-demanda',
        severity: 'baja',
        title: `Demanda alta: ${property.reference}`,
        detail: `${demandCount} leads activos encajan con este inmueble. Buen candidato para ronda de visitas.`,
        propertyId: property.id,
        link: `/properties/${property.id}`,
      });
    }
  }

  const severityOrder = { alta: 0, media: 1, baja: 2 } as const;
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
