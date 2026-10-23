/* ============================================================================
   Resumen automático del lead — compone un briefing corto desde datos reales.
   No redacta prosa inventada: cada campo sale de señales verificables.
   ============================================================================ */

import type { Lead, Message, Property } from '@/types';
import type { LeadScore, LeadSummary, NextAction } from '@/types/ai';
import { formatBudget, formatRelativeTime } from '@/lib/utils/format';
import { STAGES } from '@/lib/constants/stages';

/** Objeciones típicas detectables en el texto del cliente. */
const OBJECTION_PATTERNS: Array<{ rx: RegExp; label: string }> = [
  { rx: /precio|caro|negociable|ajustar/i, label: 'Sensible al precio' },
  { rx: /pensarlo|comentarlo|consultarlo|hablarlo|fin de semana/i, label: 'Decisión compartida / necesita tiempo' },
  { rx: /comparando|otras opciones|otros pisos|otras dos/i, label: 'Comparando alternativas' },
  { rx: /hermanos|familia|pareja/i, label: 'Decisión familiar' },
  { rx: /banco|hipoteca pendiente|financiaci[oó]n pendiente/i, label: 'Financiación por cerrar' },
];

export interface SummarizeLeadInput {
  lead: Lead;
  messages: Message[];
  /** Inmueble por el que preguntó, si existe. */
  property?: Property | null;
  score: LeadScore;
  nextAction: NextAction;
  now?: Date;
}

const KIND_LABEL: Record<string, string> = {
  piso: 'piso',
  atico: 'ático',
  casa: 'casa',
  chalet: 'chalet',
  local: 'local',
  terreno: 'terreno',
};

export function summarizeLead({
  lead,
  messages,
  property,
  score,
  nextAction,
  now = new Date(),
}: SummarizeLeadInput): LeadSummary {
  const isRent = lead.intent === 'alquiler';

  // Qué busca: del inmueble concreto si lo hay; si no, de intención + zona.
  const seeks = property
    ? `${property.kind === 'local' ? 'Local' : KIND_LABEL[property.kind] ?? 'Inmueble'} — preguntó por ${property.reference} (${property.title})`
    : lead.intent === 'venta'
      ? `Vender su inmueble en ${lead.zone}`
      : `${isRent ? 'Alquiler' : 'Compra'} en ${lead.zone}`;

  // Objeciones desde los mensajes entrantes (texto real del cliente).
  const inboundText = messages
    .filter((m) => m.direction === 'in')
    .map((m) => m.body)
    .join(' ');
  const objections = OBJECTION_PATTERNS.filter((p) => p.rx.test(inboundText)).map((p) => p.label);

  // Último contacto: cuándo y de quién.
  const lastMessage = messages[messages.length - 1];
  const lastContact = lastMessage
    ? `${formatRelativeTime(lead.lastMessageAt, now)} · ${lastMessage.direction === 'in' ? 'suyo' : 'nuestro'}`
    : `${formatRelativeTime(lead.lastMessageAt, now)} · sin hilo registrado`;

  // Tono de interés: score + comportamiento observable.
  const inboundCount = messages.filter((m) => m.direction === 'in').length;
  const interestTone =
    score.label === 'caliente'
      ? `Alto — ${score.explanation}`
      : score.label === 'templado'
        ? `Medio — ${score.explanation}`
        : inboundCount === 0
          ? 'Por determinar — sin mensajes suyos todavía'
          : `Bajo — ${score.explanation}`;

  return {
    leadId: lead.id,
    seeks,
    budget: formatBudget(lead.budgetMin, lead.budgetMax, isRent),
    zone: lead.zone,
    status: `${STAGES[lead.stage].label} · ${lead.unread > 0 ? `${lead.unread} sin responder` : 'al día'}`,
    objections,
    lastContact,
    interestTone,
    nextStep: `${nextAction.label} — ${nextAction.reason}`,
  };
}
