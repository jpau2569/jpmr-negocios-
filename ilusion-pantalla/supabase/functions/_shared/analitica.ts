// Validación de eventos de analítica. Lista CERRADA: lo que no está en eventos.json se descarta.
// Ninguna propiedad admite texto libre (solo slug/versión con patrón, enums, números y booleanos).
import spec from './eventos.json' with { type: 'json' };

type Tipo = { tipo: 'str'; max: number; patron?: string } | { tipo: 'enum'; valores: string[] } | { tipo: 'int'; min: number; max: number } | { tipo: 'bool' };
const tipos = spec.tipos as Record<string, Tipo>;
const eventos = spec.eventos as Record<string, Record<string, [string, boolean]>>;
export const LIMITES = spec.limites;
export const CONSENTIMIENTO_VERSION = spec.consentimiento_version;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const esUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

function valida(t: Tipo, v: unknown): boolean {
  switch (t.tipo) {
    case 'bool': return typeof v === 'boolean';
    case 'int': return typeof v === 'number' && Number.isInteger(v) && v >= t.min && v <= t.max;
    case 'enum': return typeof v === 'string' && t.valores.includes(v);
    case 'str': return typeof v === 'string' && v.length >= 1 && v.length <= t.max && (!t.patron || new RegExp(t.patron).test(v));
  }
}

export type EventoLimpio = { evento: string; propiedades: Record<string, string | number | boolean>; hace_s: number };

/** Devuelve el evento saneado o null. Propiedades desconocidas se tiran; las obligatorias que falten o sean inválidas lo invalidan. */
export function sanearEvento(e: unknown): EventoLimpio | null {
  if (typeof e !== 'object' || e === null) return null;
  const { evento, propiedades, hace_s } = e as Record<string, unknown>;
  if (typeof evento !== 'string' || !Object.hasOwn(eventos, evento)) return null;
  const def = eventos[evento];
  const entrada = (typeof propiedades === 'object' && propiedades !== null ? propiedades : {}) as Record<string, unknown>;
  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, [nombreTipo, requerida]] of Object.entries(def)) {
    const v = entrada[clave];
    if (v === undefined) { if (requerida) return null; continue; }
    if (!valida(tipos[nombreTipo], v)) return null;
    limpio[clave] = v as string | number | boolean;
  }
  const h = hace_s === undefined ? 0 : hace_s;
  if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > LIMITES.antiguedad_max_s) return null;
  return { evento, propiedades: limpio, hace_s: h };
}

export interface Lote { instalacion_id: string; eventos: EventoLimpio[]; descartados: number }

/** Valida el cuerpo completo. Lanza Error con mensaje seguro si la forma general es inválida. */
export function sanearLote(cuerpo: unknown): Lote {
  if (typeof cuerpo !== 'object' || cuerpo === null) throw new Error('cuerpo inválido');
  const { instalacion_id, eventos: lista } = cuerpo as Record<string, unknown>;
  if (!esUuid(instalacion_id)) throw new Error('instalacion_id inválido');
  if (!Array.isArray(lista)) throw new Error('eventos debe ser una lista');
  if (lista.length > LIMITES.eventos_por_lote) throw new Error('lote demasiado grande');
  const limpios: EventoLimpio[] = [];
  for (const e of lista) { const l = sanearEvento(e); if (l) limpios.push(l); }
  return { instalacion_id, eventos: limpios, descartados: lista.length - limpios.length };
}

export type Finalidad = 'analitica';
export function sanearConsentimiento(c: unknown): { concedido: boolean; version_texto: string } {
  if (typeof c !== 'object' || c === null) throw new Error('consentimiento inválido');
  const { concedido, version_texto } = c as Record<string, unknown>;
  if (typeof concedido !== 'boolean') throw new Error('consentimiento inválido');
  if (typeof version_texto !== 'string' || !/^[0-9A-Za-z._-]{1,30}$/.test(version_texto)) throw new Error('versión de texto inválida');
  return { concedido, version_texto };
}
