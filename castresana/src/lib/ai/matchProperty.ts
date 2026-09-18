/* ============================================================================
   Matching lead ↔ inmueble — motor determinista v1.
   Cada componente suma a un score 0-100 y deja una razón legible.
   ============================================================================ */

import type { Lead, Property } from '@/types';
import type { PropertyMatch } from '@/types/ai';

/** Tamaño orientativo por presupuesto no informado: no penalizamos, no inventamos. */
const MATCH_THRESHOLD = 35;

function budgetComponent(lead: Lead, property: Property): { points: number; reason?: string } {
  const max = lead.budgetMax;
  const min = lead.budgetMin ?? 0;
  if (!max) return { points: 8 }; // sin presupuesto informado: neutro, sin razón inventada

  const price = property.price;
  if (price <= max && price >= min * 0.75) {
    const headroom = 1 - price / max;
    if (headroom <= 0.1) return { points: 35, reason: 'ajusta el presupuesto al máximo' };
    return { points: 30, reason: 'dentro de presupuesto' };
  }
  if (price <= max * 1.08) return { points: 18, reason: 'ligeramente sobre presupuesto (negociable)' };
  if (price < min * 0.75) return { points: 6, reason: 'muy por debajo de lo que busca' };
  return { points: 0 };
}

function zoneComponent(lead: Lead, property: Property): { points: number; reason?: string } {
  const leadZone = lead.zone.toLowerCase();
  const propZone = property.zone.toLowerCase();
  const propCity = property.city.toLowerCase();

  if (propZone === leadZone) return { points: 25, reason: `zona exacta: ${property.zone}` };
  const leadHead = leadZone.split(/[\s—-]+/)[0] ?? '';
  if (leadHead.length > 3 && (propZone.includes(leadHead) || leadZone.includes(propZone.split(/[\s—-]+/)[0] ?? '¤'))) {
    return { points: 18, reason: `zona afín a ${lead.zone}` };
  }
  if (leadZone.includes(propCity) || propCity === leadZone) {
    return { points: 12, reason: `misma ciudad (${property.city})` };
  }
  return { points: 0 };
}

function sizeComponent(lead: Lead, property: Property): { points: number; reason?: string } {
  // Sin preferencias explícitas de tamaño en el modelo: usamos presupuesto como proxy
  // solo para descartar extremos; los dormitorios puntúan si el inmueble es vivienda.
  if (property.kind === 'local' || property.kind === 'terreno') return { points: 4 };
  if (property.bedrooms >= 2 && property.bedrooms <= 4) {
    return { points: 8, reason: `${property.bedrooms} dormitorios` };
  }
  return { points: 4 };
}

function tagComponent(lead: Lead, property: Property): { points: number; reason?: string } {
  const leadTags = lead.tags.map((t) => t.toLowerCase());
  const propTags = property.tags.map((t) => t.toLowerCase());

  if (leadTags.some((t) => t.includes('inversor') || t.includes('cartera'))) {
    if (propTags.some((t) => t.includes('inversión') || t.includes('rentabilidad')) || property.yieldPct) {
      return { points: 14, reason: 'perfil inversor y producto de inversión' };
    }
    return { points: 0 };
  }
  const shared = propTags.filter((t) =>
    ['terraza', 'garaje', 'jardín', 'reformado', 'listo para entrar'].includes(t),
  );
  if (shared.length >= 2) return { points: 8, reason: `extras valorados: ${shared.slice(0, 2).join(', ')}` };
  if (shared.length === 1) return { points: 4 };
  return { points: 0 };
}

function urgencyComponent(lead: Lead): { points: number; reason?: string } {
  if (lead.stage === 'oferta' || lead.stage === 'visita') {
    return { points: 10, reason: 'lead en fase avanzada' };
  }
  if (lead.tags.some((t) => t.toLowerCase().includes('urgente'))) {
    return { points: 10, reason: 'urgencia declarada' };
  }
  return { points: 0 };
}

/** Encaje de UN inmueble con un lead. Null si la operación no coincide o no llega al umbral. */
export function matchProperty(lead: Lead, property: Property): PropertyMatch | null {
  // Operación: alquiler solo casa con alquiler; compra/inversión con venta.
  const wantsRent = lead.intent === 'alquiler';
  if (wantsRent !== (property.operation === 'alquiler')) return null;
  if (lead.intent === 'venta') return null; // los vendedores no reciben stock
  if (property.status !== 'disponible') return null;

  const parts = [
    budgetComponent(lead, property),
    zoneComponent(lead, property),
    sizeComponent(lead, property),
    tagComponent(lead, property),
    urgencyComponent(lead),
  ];

  let score = parts.reduce((sum, p) => sum + p.points, 0);
  // Interés ya declarado en este inmueble: encaje casi seguro.
  if (lead.propertyId === property.id) score = Math.max(score, 90);
  score = Math.min(score, 98);

  if (score < MATCH_THRESHOLD) return null;

  const reasons = parts.map((p) => p.reason).filter((r): r is string => Boolean(r));
  if (lead.propertyId === property.id) reasons.unshift('ya preguntó por este inmueble');

  return {
    propertyId: property.id,
    reference: property.reference,
    title: property.title,
    price: property.price,
    operation: property.operation,
    zone: property.zone,
    score,
    reasons: reasons.slice(0, 3),
  };
}

/** Top-N propiedades del stock para un lead, ordenadas por encaje. */
export function matchPropertiesForLead(
  lead: Lead,
  properties: Property[],
  limit = 4,
): PropertyMatch[] {
  return properties
    .map((property) => matchProperty(lead, property))
    .filter((m): m is PropertyMatch => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
