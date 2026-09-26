/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — estado y guardado
   Todo vive en este dispositivo (localStorage): son datos de clientes y
   personales, y no salen del móvil salvo que Pau mande un PDF o guarde
   una copia. La copia de seguridad es un .json que se abre en otro
   aparato con "Abrir una copia".
   El estado se valida al cargar: una copia rota o antigua nunca rompe la app.
   ═══════════════════════════════════════════════════════════════════ */

export const CLAVE = 'cerebro_util_pau_v1';
export const VERSION_DATOS = 1;

export const AJUSTES_BASE = {
  agente: 'Pau Moralejo',
  empresa: 'Asesoría Castresana · Gestión Inmobiliaria',
  ciudad: 'Oviedo, Asturias',
  telefono: '985 210 468',
  whatsapp: '663 26 38 42',
  email: '',
  web: 'asesoriacastresana.com',
  // Textos de la hoja de visita: los rellena operaciones-datos.js (borrador) y Pau los puede cambiar.
  textoDeclaracion: '',
  textoRgpd: '',
  textosRevisados: false,
  claveSync: '',
};

export function estadoVacio() {
  return { version: VERSION_DATOS, ajustes: { ...AJUSTES_BASE }, visitas: [], operaciones: [], valoraciones: [], papeles: [] };
}

const lista = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e === 'object' && e.id) : []);

/** Acepta cualquier cosa y devuelve un estado válido (lo que no encaja se descarta). */
export function normaliza(bruto) {
  const e = estadoVacio();
  if (!bruto || typeof bruto !== 'object') return e;
  const aj = bruto.ajustes && typeof bruto.ajustes === 'object' ? bruto.ajustes : {};
  for (const k of Object.keys(AJUSTES_BASE)) {
    if (typeof AJUSTES_BASE[k] === 'boolean') e.ajustes[k] = typeof aj[k] === 'boolean' ? aj[k] : AJUSTES_BASE[k];
    else if (typeof aj[k] === 'string') e.ajustes[k] = aj[k].slice(0, 4000);
  }
  e.visitas = lista(bruto.visitas);
  e.operaciones = lista(bruto.operaciones).map((o) => ({ papeles: {}, fechas: [], partes: {}, ...o }));
  e.valoraciones = lista(bruto.valoraciones).map((v) => ({ comparables: [], ...v }));
  e.papeles = lista(bruto.papeles);
  return e;
}

export function carga(almacen = globalThis.localStorage) {
  try {
    return normaliza(JSON.parse(almacen?.getItem(CLAVE) || 'null'));
  } catch {
    return estadoVacio();
  }
}

/** Guarda. Devuelve { ok, error } — el error típico es el almacenamiento lleno. */
export function guarda(estado, almacen = globalThis.localStorage) {
  try {
    almacen.setItem(CLAVE, JSON.stringify(estado));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: /quota/i.test(String(e?.name || e)) ? 'lleno' : String(e?.message || e) };
  }
}

/** Copia de seguridad: el estado entero, con marca de qué es y cuándo se hizo. */
export function copiaSeguridad(estado, ahora = new Date()) {
  return JSON.stringify({ app: 'cerebro-util-pau', creada: ahora.toISOString(), ...estado }, null, 1);
}

/** Lee una copia. Devuelve { ok, estado, resumen } o { ok:false, error }. */
export function leeCopia(texto) {
  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'El archivo no es una copia válida (no es JSON).' };
  }
  if (bruto?.app !== 'cerebro-util-pau') return { ok: false, error: 'Este archivo no es una copia de Cerebro Útil Pau.' };
  const estado = normaliza(bruto);
  return {
    ok: true,
    estado,
    resumen: `${estado.visitas.length} visitas, ${estado.operaciones.length} operaciones, ${estado.valoraciones.length} valoraciones y ${estado.papeles.length} papeles`,
  };
}

/** Tamaño aproximado en KB de lo guardado (localStorage suele admitir ~5 MB). */
export const tamanoKb = (estado) => Math.round(new TextEncoder().encode(JSON.stringify(estado)).length / 1024);
