/* ============================================================================
   Lead scoring — 0-100, determinista y explicable.
   Cada señal aplicada queda registrada con sus puntos; la explicación de la
   UI se construye con las 3 señales de mayor impacto. Nada de cajas negras.
   ============================================================================ */

import type { Lead, Message, Visit } from '@/types';
import type { LeadScore, PropertyMatch, ScoreLabel, ScoreSignal } from '@/types/ai';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface ScoreLeadInput {
  lead: Lead;
  messages: Message[];
  visits: Visit[];
  /** Encajes con el stock actual (de matchPropertiesForLead). */
  matches: PropertyMatch[];
  now?: Date;
}

function labelFor(score: number): ScoreLabel {
  if (score >= 70) return 'caliente';
  if (score >= 40) return 'templado';
  return 'frio';
}

export function scoreLead({ lead, messages, visits, matches, now = new Date() }: ScoreLeadInput): LeadScore {
  const signals: ScoreSignal[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) signals.push({ label, points });
  };

  const nowMs = now.getTime();
  const lastMessageAgeMs = nowMs - new Date(lead.lastMessageAt).getTime();
  const inbound = messages.filter((m) => m.direction === 'in');
  const lastMessage = messages[messages.length - 1];

  // --- Cerrado: fuera del embudo activo -----------------------------------
  if (lead.stage === 'cerrado') {
    return {
      leadId: lead.id,
      score: 5,
      label: 'frio',
      signals: [{ label: 'Operación cerrada', points: 0 }],
      explanation: 'Operación cerrada: sin seguimiento comercial activo.',
    };
  }

  // --- Etapa del embudo ----------------------------------------------------
  if (lead.stage === 'oferta') add('Oferta sobre la mesa', 25);
  if (lead.stage === 'visita') add('Visita en curso o agendada', 18);
  if (lead.stage === 'seguimiento') add('En seguimiento activo', 8);

  // --- Presupuesto y cualificación -----------------------------------------
  if (lead.budgetMax) add('Presupuesto informado', 10);
  if (lead.phone && lead.email) add('Contacto completo (tel. + email)', 5);
  if (lead.tags.some((t) => /preaprobada|financiaci[oó]n|n[oó]mina/i.test(t))) {
    add('Financiación acreditada', 12);
  }
  if (lead.tags.some((t) => /urgente|traslado/i.test(t))) add('Urgencia declarada', 8);

  // --- Actividad conversacional --------------------------------------------
  if (lastMessageAgeMs < 24 * HOUR) add('Actividad en las últimas 24 h', 12);
  else if (lastMessageAgeMs < 72 * HOUR) add('Actividad en los últimos 3 días', 6);

  if (inbound.length >= 4) add('Conversación rica (4+ mensajes suyos)', 8);
  else if (inbound.length >= 2) add('Ha escrito varias veces', 4);

  if (lead.unread > 0 && lastMessage?.direction === 'in') {
    add('Mensaje suyo pendiente de respuesta', 6);
  }

  const hasVisitRequest = visits.some((v) => v.status === 'propuesta' || v.status === 'confirmada');
  if (hasVisitRequest) add('Visita pedida o confirmada', 15);

  // --- Encaje con el stock --------------------------------------------------
  const bestMatch = matches[0];
  if (bestMatch && bestMatch.score >= 70) add('Encaje fuerte con el stock', 10);
  else if (bestMatch && bestMatch.score >= 50) add('Encaja con stock actual', 6);

  // --- Calidad de la fuente --------------------------------------------------
  if (lead.channel === 'whatsapp' || lead.channel === 'telefono') add('Canal directo', 5);
  else if (lead.channel === 'portal') add('Portal cualificado', 3);

  // --- Penalizaciones por enfriamiento ---------------------------------------
  if (lastMessageAgeMs > 14 * DAY) add('Más de 2 semanas sin actividad', -25);
  else if (lastMessageAgeMs > 7 * DAY) add('Más de 1 semana sin actividad', -12);

  // Silencio tras mensaje nuestro (posible desinterés)
  if (lastMessage?.direction === 'out' && lastMessageAgeMs > 3 * DAY) {
    add('Sin respuesta a nuestro último mensaje', -8);
  }

  const raw = signals.reduce((sum, s) => sum + s.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const label = labelFor(score);

  const top = [...signals].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
  const explanation = top.map((s) => s.label.toLowerCase()).join(' · ') || 'sin señales relevantes';

  return { leadId: lead.id, score, label, signals, explanation };
}
