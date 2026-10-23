import type { Lead, Property } from '@/types';
import { properties } from './mock-properties';
import { leads } from './leads';

/* ============================================================================
   Recomendaciones — hoy reglas deterministas, mañana motor de matching (IA).
   La UI consume SOLO estas funciones: cuando exista el motor real bastará
   con sustituir la implementación manteniendo las firmas.
   ============================================================================ */

export interface Rail {
  id: string;
  title: string;
  subtitle?: string;
  properties: Property[];
}

export interface LeadMatch {
  lead: Lead;
  /** Motivo legible del encaje (futuro: generado por el motor). */
  reason: string;
  /** Afinidad 0-100 (futuro: score del modelo). */
  score: number;
}

export interface PropertyRecommendation {
  property: Property;
  reason: string;
}

const byNewest = (a: Property, b: Property) => b.publishedAt.localeCompare(a.publishedAt);

/* ----------------------------------------------------- Rails del Explorer */

export function getExplorerRails(): Rail[] {
  return [
    {
      id: 'nuevas',
      title: 'Nuevas captaciones',
      subtitle: 'Lo último en entrar a cartera',
      properties: [...properties].sort(byNewest).slice(0, 8),
    },
    {
      id: 'premium',
      title: 'Propiedades premium',
      subtitle: 'Selección singular de la casa',
      properties: properties.filter((p) => p.tags.includes('Premium') || p.price >= 400000).sort((a, b) => b.price - a.price),
    },
    {
      id: 'oviedo-centro',
      title: 'Oviedo centro',
      subtitle: 'Uría, Casco Antiguo, Milán',
      properties: properties.filter((p) => p.city === 'Oviedo' && ['Centro — Uría', 'Casco Antiguo', 'Milán — Pumarín'].includes(p.zone)),
    },
    {
      id: 'costa-inversion',
      title: 'Asturias costa e inversión',
      subtitle: 'Mar, rentabilidad y patrimonio',
      properties: properties.filter((p) => p.tags.includes('Costa') || p.tags.includes('Inversión') || typeof p.yieldPct === 'number'),
    },
    {
      id: 'visita',
      title: 'Listas para visita',
      subtitle: 'Disponibles y listas para entrar',
      properties: properties.filter((p) => p.status === 'disponible' && (p.tags.includes('Listo para entrar') || p.tags.includes('Reformado'))),
    },
  ];
}

/** Propiedad destacada del hero (la featured más reciente). */
export function getHeroProperty(): Property {
  return [...properties].filter((p) => p.featured).sort(byNewest)[0] ?? properties[0];
}

/* --------------------------------------- Matching lead ↔ propiedad (mock) */

function budgetFits(lead: Lead, property: Property): boolean {
  const isRent = property.operation === 'alquiler';
  if ((lead.intent === 'alquiler') !== isRent) return false;
  const max = lead.budgetMax ?? Infinity;
  const min = lead.budgetMin ?? 0;
  // Toleramos +8% sobre presupuesto máximo (margen de negociación).
  return property.price <= max * 1.08 && property.price >= min * 0.6;
}

function zoneAffinity(lead: Lead, property: Property): boolean {
  const zl = lead.zone.toLowerCase();
  return (
    property.zone.toLowerCase().includes(zl.split(' ')[0]!) ||
    zl.includes(property.zone.toLowerCase().split(' ')[0]!) ||
    property.city.toLowerCase() === zl
  );
}

/** Leads compatibles con una propiedad, con motivo y afinidad. */
export function getCompatibleLeads(propertyId: string, limit = 4): LeadMatch[] {
  const property = properties.find((p) => p.id === propertyId);
  if (!property) return [];

  return leads
    .filter((lead) => lead.stage !== 'cerrado' && lead.intent !== 'venta')
    .map((lead) => {
      let score = 0;
      const reasons: string[] = [];

      if (lead.propertyId === property.id) {
        score += 55;
        reasons.push('ya interesado en este inmueble');
      }
      if (budgetFits(lead, property)) {
        score += 30;
        reasons.push('encaja en presupuesto');
      }
      if (zoneAffinity(lead, property)) {
        score += 25;
        reasons.push(`busca en ${lead.zone}`);
      }

      return {
        lead,
        score: Math.min(score, 98),
        reason: reasons.join(' · ') || 'perfil compatible',
      };
    })
    .filter((m) => m.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Propiedades similares a una dada (zona, tipología o rango de precio). */
export function getRelatedProperties(propertyId: string, limit = 6): Property[] {
  const base = properties.find((p) => p.id === propertyId);
  if (!base) return [];

  return properties
    .filter((p) => p.id !== base.id && p.operation === base.operation)
    .map((p) => {
      let score = 0;
      if (p.city === base.city) score += 3;
      if (p.zone === base.zone) score += 2;
      if (p.kind === base.kind) score += 2;
      if (Math.abs(p.price - base.price) / base.price < 0.25) score += 2;
      if (p.tags.some((t) => base.tags.includes(t))) score += 1;
      return { p, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Recomendaciones "para compradores activos": una propiedad + el lead al que encaja. */
export function getActiveBuyerRecommendations(limit = 8): PropertyRecommendation[] {
  const recs: PropertyRecommendation[] = [];
  const seen = new Set<string>();

  for (const lead of leads) {
    if (lead.stage === 'cerrado' || lead.intent === 'venta') continue;
    for (const property of properties) {
      if (seen.has(property.id) || property.status !== 'disponible') continue;
      if (budgetFits(lead, property) && zoneAffinity(lead, property)) {
        seen.add(property.id);
        const first = lead.name.split(' ')[0];
        recs.push({ property, reason: `Encaja con ${first} · ${lead.zone}` });
        break;
      }
    }
  }
  // Relleno con disponibles recientes si hay pocos matches.
  for (const property of [...properties].sort(byNewest)) {
    if (recs.length >= limit) break;
    if (!seen.has(property.id) && property.status === 'disponible') {
      seen.add(property.id);
      recs.push({ property, reason: 'Alta demanda en la zona' });
    }
  }
  return recs.slice(0, limit);
}
