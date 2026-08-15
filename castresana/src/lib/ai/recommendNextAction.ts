/* ============================================================================
   Siguiente mejor acción — árbol de decisión priorizado.
   La primera regla que aplica gana; el razonamiento se muestra al agente.
   ============================================================================ */

import type { Lead, Message, Visit } from '@/types';
import type { LeadScore, NextAction, PropertyMatch } from '@/types/ai';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface NextActionInput {
  lead: Lead;
  messages: Message[];
  visits: Visit[];
  matches: PropertyMatch[];
  score: LeadScore;
  now?: Date;
}

export function recommendNextAction({
  lead,
  messages,
  visits,
  matches,
  score,
  now = new Date(),
}: NextActionInput): NextAction {
  const nowMs = now.getTime();
  const silenceMs = nowMs - new Date(lead.lastMessageAt).getTime();
  const lastMessage = messages[messages.length - 1];
  const pendingVisit = visits.find((v) => v.status === 'propuesta');
  const financeMissing = !lead.tags.some((t) => /preaprobada|financiaci[oó]n/i.test(t));

  // 1 · Cerrado → nada que hacer aquí.
  if (lead.stage === 'cerrado') {
    return {
      kind: 'archivar-temporal',
      label: 'Archivar (pedir reseña)',
      reason: 'Operación cerrada. Buen momento para pedir reseña y recomendación.',
      urgency: 'sin-prisa',
    };
  }

  // 2 · Mensaje entrante sin responder: lo primero siempre es responder.
  if (lead.unread > 0 && lastMessage?.direction === 'in') {
    return {
      kind: 'responder-ahora',
      label: 'Responder ahora',
      reason:
        score.label === 'caliente'
          ? `Lead caliente (${score.score}) con ${lead.unread} mensaje(s) sin responder.`
          : `Tiene ${lead.unread} mensaje(s) esperando respuesta.`,
      urgency: 'hoy',
    };
  }

  // 3 · Visita propuesta sin confirmar.
  if (pendingVisit) {
    return {
      kind: 'confirmar-visita',
      label: 'Confirmar la visita',
      reason: 'Hay una visita propuesta sin hora cerrada. Confirmarla evita que se enfríe.',
      urgency: 'hoy',
    };
  }

  // 4 · Oferta en curso: teléfono, no chat.
  if (lead.stage === 'oferta') {
    return {
      kind: 'llamar-hoy',
      label: 'Llamar hoy',
      reason: 'Oferta sobre la mesa: la negociación se gestiona mejor por teléfono.',
      urgency: 'hoy',
    };
  }

  // 5 · Visita hecha y financiación sin acreditar.
  if (lead.stage === 'visita' && lead.intent === 'compra' && financeMissing) {
    return {
      kind: 'pedir-financiacion',
      label: 'Preguntar por financiación',
      reason: 'Ya ha visitado: confirmar capacidad de compra antes de avanzar.',
      urgency: 'esta-semana',
    };
  }

  // 6 · Buen encaje con stock y aún sin propuesta de inmuebles.
  if (matches.length >= 2 && (lead.stage === 'nuevo' || lead.stage === 'seguimiento')) {
    return {
      kind: 'enviar-inmuebles',
      label: `Enviar ${Math.min(matches.length, 3)} inmuebles`,
      reason: `Hay ${matches.length} propiedades que encajan (mejor: ${matches[0]!.reference} al ${matches[0]!.score}%).`,
      urgency: score.label === 'caliente' ? 'hoy' : 'esta-semana',
    };
  }

  // 7 · Interesado en un inmueble concreto sin visita aún.
  if (lead.propertyId && lead.stage !== 'visita' && score.score >= 40) {
    return {
      kind: 'proponer-visita',
      label: 'Proponer visita',
      reason: 'Interés claro en un inmueble concreto y aún no ha visitado.',
      urgency: 'esta-semana',
    };
  }

  // 8 · Vendedor en seguimiento: documentación para el encargo.
  if (lead.intent === 'venta') {
    return {
      kind: 'solicitar-documentacion',
      label: 'Pedir documentación',
      reason: 'Captación en curso: nota simple y datos del inmueble aceleran el encargo.',
      urgency: 'esta-semana',
    };
  }

  // 9 · Silencio tras nuestro mensaje.
  if (lastMessage?.direction === 'out' && silenceMs > 2 * DAY && silenceMs <= 10 * DAY) {
    return {
      kind: 'recontactar-48h',
      label: 'Seguimiento suave',
      reason: `Sin respuesta desde hace ${Math.round(silenceMs / DAY)} días. Un toque corto reactiva sin presionar.`,
      urgency: 'esta-semana',
    };
  }

  // 10 · Frío y muy parado: archivar con fecha de repesca.
  if (score.label === 'frio' && silenceMs > 10 * DAY) {
    return {
      kind: 'archivar-temporal',
      label: 'Archivar y repescar en 30 días',
      reason: 'Lead frío sin actividad reciente. Mejor repescar con novedades de stock.',
      urgency: 'sin-prisa',
    };
  }

  // 11 · Por defecto: mantener el hilo vivo.
  return {
    kind: 'recontactar-48h',
    label: 'Toque de seguimiento',
    reason: 'Sin urgencias detectadas: mantener el contacto con algo de valor (novedad, precio).',
    urgency: 'sin-prisa',
  };
}
