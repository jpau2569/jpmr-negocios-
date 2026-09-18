/* ============================================================================
   Respuestas sugeridas — plantillas comerciales contextualizadas.
   Tono: profesional cercano, español de España, frases cortas. El agente
   siempre puede editar antes de enviar; esto ahorra el 80% del tecleo.
   ============================================================================ */

import type { Lead, Message, Property } from '@/types';
import type { NextAction, PropertyMatch, SuggestedReply } from '@/types/ai';

const DAY = 86_400_000;

export interface SuggestReplyInput {
  lead: Lead;
  messages: Message[];
  property?: Property | null;
  matches: PropertyMatch[];
  nextAction: NextAction;
  now?: Date;
}

function firstName(fullName: string): string {
  const first = fullName.split(/\s+/)[0] ?? fullName;
  // Empresas: no trocear el nombre.
  return /s\.l\.|s\.a\.|inversiones|hostelería/i.test(fullName) ? fullName : first;
}

export function suggestReply({
  lead,
  messages,
  property,
  matches,
  nextAction,
  now = new Date(),
}: SuggestReplyInput): SuggestedReply[] {
  const suggestions: SuggestedReply[] = [];
  const name = firstName(lead.name);
  const ref = property?.reference ?? matches[0]?.reference;
  const silenceMs = now.getTime() - new Date(lead.lastMessageAt).getTime();
  const lastMessage = messages[messages.length - 1];
  const hasReplied = messages.some((m) => m.direction === 'out');
  const inboundText = messages
    .filter((m) => m.direction === 'in')
    .map((m) => m.body)
    .join(' ');

  // --- Primera respuesta (lead nuevo sin contestar) -------------------------
  if (!hasReplied) {
    suggestions.push({
      kind: 'primera-respuesta',
      label: 'Primera respuesta',
      reason: 'Aún no ha recibido respuesta. Contestar en la primera hora multiplica la conversión.',
      text: property
        ? `Hola ${name}, gracias por su interés en ${property.title} (${property.reference}). Sigue disponible y se enseña muy bien. ¿Le encajaría una visita esta semana? Dígame qué días le vienen mejor y lo organizo.`
        : `Hola ${name}, encantado de saludarle. He recibido su consulta y me pongo con ello ahora mismo. Para afinar la búsqueda: ¿qué zona prefiere y en qué presupuesto se mueve?`,
    });
  }

  // --- Propuesta de visita ---------------------------------------------------
  if (nextAction.kind === 'proponer-visita' || nextAction.kind === 'confirmar-visita') {
    suggestions.push({
      kind: 'propuesta-visita',
      label: 'Proponer visita',
      reason: 'Interés claro: cerrar fecha concreta acelera la decisión.',
      text: `Hola ${name}, ¿le viene bien que cerremos la visita${ref ? ` al ${ref}` : ''}? Tengo hueco jueves y viernes a última hora de la tarde. Dígame cuál le encaja y le confirmo en el momento.`,
    });
  }

  // --- Envío de inmuebles relacionados ---------------------------------------
  if (matches.length >= 2) {
    const list = matches
      .slice(0, 3)
      .map((m) => `· ${m.reference} — ${m.title} (${m.zone})`)
      .join('\n');
    suggestions.push({
      kind: 'envio-inmuebles',
      label: `Enviar ${Math.min(matches.length, 3)} inmuebles`,
      reason: `Hay ${matches.length} propiedades del stock que encajan con su búsqueda.`,
      text: `Hola ${name}, he seleccionado ${Math.min(matches.length, 3)} opciones que encajan con lo que busca:\n${list}\n¿Le preparo visita a alguna? Puedo enseñárselas todas en una misma tarde.`,
    });
  }

  // --- Seguimiento tras silencio ---------------------------------------------
  if (lastMessage?.direction === 'out' && silenceMs > 2 * DAY) {
    suggestions.push({
      kind: 'seguimiento-silencio',
      label: 'Seguimiento suave',
      reason: `Sin respuesta desde hace ${Math.round(silenceMs / DAY)} días.`,
      text: `Hola ${name}, le escribo solo por retomar el hilo. ${ref ? `El ${ref} sigue disponible y ha despertado bastante interés.` : 'Han entrado novedades que podrían encajarle.'} Si sigue interesado, me dice y avanzamos sin compromiso.`,
    });
  }

  // --- Respuesta a objeción ----------------------------------------------------
  if (/precio|caro|negociable/i.test(inboundText)) {
    suggestions.push({
      kind: 'respuesta-objecion',
      label: 'Responder a objeción de precio',
      reason: 'El cliente ha mencionado el precio.',
      text: `Le entiendo perfectamente, ${name}. El precio refleja el estado y la zona, pero hay cierto margen para una propuesta seria. Si me indica hasta dónde le encajaría, lo traslado a la propiedad y vemos si podemos acercarnos.`,
    });
  }
  if (/pensarlo|comentarlo|fin de semana|hermanos|familia/i.test(inboundText)) {
    suggestions.push({
      kind: 'respuesta-objecion',
      label: 'Acompañar la decisión',
      reason: 'Necesita consultarlo o tomarse tiempo.',
      text: `Por supuesto, ${name}, tómense el tiempo que necesiten: es una decisión importante. Les dejo disponible cualquier dato extra que ayude (planos, gastos de comunidad, certificado energético). ¿Les viene bien que hablemos el lunes?`,
    });
  }

  // --- Cierre suave (oferta en curso) ------------------------------------------
  if (lead.stage === 'oferta') {
    suggestions.push({
      kind: 'cierre-suave',
      label: 'Cierre suave',
      reason: 'Hay oferta en curso: mantener el momentum sin presionar.',
      text: `Hola ${name}, sigo de cerca su oferta${ref ? ` por el ${ref}` : ''} y le traslado cualquier novedad en cuanto la tenga. Si necesita ajustar algo o resolver alguna duda del proceso, estoy a un mensaje.`,
    });
  }

  // --- Recuperación de lead frío -------------------------------------------------
  if (silenceMs > 10 * DAY && lead.stage !== 'oferta' && lead.stage !== 'cerrado') {
    suggestions.push({
      kind: 'recuperacion',
      label: 'Recuperar lead frío',
      reason: 'Más de 10 días sin actividad: repescar con novedad de valor.',
      text: `Hola ${name}, hace tiempo que no hablamos y han entrado captaciones nuevas en ${lead.zone} que encajan con lo que buscaba. Si sigue con la idea, le preparo una selección actualizada en 5 minutos. ¿Se la envío?`,
    });
  }

  // Máximo 3 sugerencias, las más pertinentes primero (orden de inserción ya lo es).
  return suggestions.slice(0, 3);
}
