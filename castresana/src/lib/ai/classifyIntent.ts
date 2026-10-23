/* ============================================================================
   Clasificación de intención comercial — reglas sobre datos + texto.
   Devuelve intención, confianza y razones. Sin adivinar: si las señales son
   débiles, la confianza baja y se dice.
   ============================================================================ */

import type { Lead, Message } from '@/types';
import type { CommercialIntent, IntentClassification } from '@/types/ai';

const LABELS: Record<CommercialIntent, string> = {
  'compra-inmediata': 'Compra inmediata',
  'busqueda-activa': 'Búsqueda activa',
  exploracion: 'Exploración',
  inversion: 'Inversión',
  'alquiler-urgente': 'Alquiler urgente',
  'propietario-vendedor': 'Propietario vendedor',
  'captacion-potencial': 'Captación potencial',
};

const URGENCY_RX = /urgente|cuanto antes|esta semana|lo antes posible|ya mismo|septiembre/i;
const FINANCE_RX = /hipoteca|financiaci[oó]n|preaprobad|banco/i;

export function classifyIntent(lead: Lead, messages: Message[]): IntentClassification {
  const reasons: string[] = [];
  const inboundText = messages
    .filter((m) => m.direction === 'in')
    .map((m) => m.body)
    .join(' ');
  const tags = lead.tags.join(' ').toLowerCase();

  const finish = (
    intent: CommercialIntent,
    confidence: IntentClassification['confidence'],
  ): IntentClassification => ({ intent, label: LABELS[intent], confidence, reasons });

  // --- Vendedores ------------------------------------------------------------
  if (lead.intent === 'venta') {
    if (lead.stage === 'nuevo' || lead.stage === 'seguimiento') {
      reasons.push('quiere vender', 'aún sin encargo firmado');
      if (/tasaci[oó]n|valoraci[oó]n|herencia/.test(tags + inboundText.toLowerCase())) {
        reasons.push('pidió valoración');
      }
      return finish('captacion-potencial', 'alta');
    }
    reasons.push('propietario con encargo en curso');
    return finish('propietario-vendedor', 'alta');
  }

  // --- Inversores ------------------------------------------------------------
  if (/inversor|cartera|rentabilidad/.test(tags) || /rentabilidad|rent roll/i.test(inboundText)) {
    reasons.push('perfil inversor por etiquetas o mensajes');
    if (lead.budgetMax) reasons.push('presupuesto definido');
    return finish('inversion', 'alta');
  }

  // --- Alquiler ----------------------------------------------------------------
  if (lead.intent === 'alquiler') {
    if (URGENCY_RX.test(inboundText) || /urgente/.test(tags)) {
      reasons.push('busca alquiler con plazo definido');
      return finish('alquiler-urgente', 'media');
    }
    reasons.push('interesado en alquiler, sin urgencia expresada');
    return finish('busqueda-activa', 'media');
  }

  // --- Compradores ----------------------------------------------------------
  const strongSignals = [
    lead.stage === 'oferta' || lead.stage === 'visita',
    FINANCE_RX.test(inboundText) || FINANCE_RX.test(tags),
    Boolean(lead.budgetMax),
    URGENCY_RX.test(inboundText) || /urgente|traslado/.test(tags),
  ].filter(Boolean).length;

  if (strongSignals >= 3) {
    if (lead.stage === 'oferta') reasons.push('tiene oferta presentada');
    if (lead.stage === 'visita') reasons.push('está visitando');
    if (FINANCE_RX.test(inboundText) || FINANCE_RX.test(tags)) reasons.push('financiación en marcha');
    if (lead.budgetMax) reasons.push('presupuesto claro');
    return finish('compra-inmediata', 'alta');
  }

  if (strongSignals === 2 || (lead.budgetMax && messages.length >= 2)) {
    reasons.push('presupuesto y conversación en marcha');
    if (lead.propertyId) reasons.push('interés en un inmueble concreto');
    return finish('busqueda-activa', strongSignals === 2 ? 'alta' : 'media');
  }

  reasons.push('pocas señales todavía: primer contacto o consulta general');
  return finish('exploracion', messages.length <= 1 ? 'media' : 'baja');
}
