/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — estado y guardado
   Todo vive en este dispositivo (localStorage): son datos de clientes y
   personales, y no salen del móvil salvo que Pau mande un PDF o guarde
   una copia. La copia de seguridad es un .json que se abre en otro
   aparato con "Abrir una copia".
   El estado se valida al cargar: una copia rota o antigua nunca rompe la app.
   ═══════════════════════════════════════════════════════════════════ */

import { validaFecha } from './operaciones.js';
import { esFirmaJpeg } from './visitas.js';
import { CAMPOS_INMUEBLE, limpiaFicha } from './campos-piso.js';

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
  // Hoja de captación (borrador hasta que Pau los marque como revisados).
  textoCaptacion: '',
  textoRgpdCaptacion: '',
  textoDesistimiento: '',
  textosCaptacionRevisados: false,
  // Encabezado del bloque de firmas de todos los documentos.
  encabezadoFirmas: 'ASESORIA CASTRESANA INMO',
  // Firma del agente (JPEG), guardada una vez para todos los documentos.
  firmaAgente: '',
  claveSync: '',
};
// Números en los ajustes (tamaño en px de la firma del agente).
const AJUSTES_NUM = ['firmaAgenteAncho', 'firmaAgenteAlto'];

export function estadoVacio() {
  return { version: VERSION_DATOS, ajustes: { ...AJUSTES_BASE }, pisos: [], visitas: [], operaciones: [], valoraciones: [], papeles: [] };
}

const lista = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e === 'object' && e.id) : []).map((e) => ({ ...e, id: String(e.id).slice(0, 80) }));
const objeto = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const cadena = (x, n) => (typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, n) : '');

/** Acepta cualquier cosa y devuelve un estado válido (lo que no encaja se descarta). */
export function normaliza(bruto) {
  const e = estadoVacio();
  if (!bruto || typeof bruto !== 'object') return e;
  const aj = bruto.ajustes && typeof bruto.ajustes === 'object' ? bruto.ajustes : {};
  for (const k of Object.keys(AJUSTES_BASE)) {
    if (typeof AJUSTES_BASE[k] === 'boolean') e.ajustes[k] = typeof aj[k] === 'boolean' ? aj[k] : AJUSTES_BASE[k];
    else if (typeof aj[k] === 'string') e.ajustes[k] = aj[k].slice(0, 4000);
  }
  e.ajustes.firmaAgente = esFirmaJpeg(aj.firmaAgente) ? aj.firmaAgente : '';
  for (const k of AJUSTES_NUM) if (Number(aj[k]) > 0) e.ajustes[k] = Math.min(4000, Number(aj[k]));
  if (!e.ajustes.encabezadoFirmas.trim()) e.ajustes.encabezadoFirmas = AJUSTES_BASE.encabezadoFirmas;
  e.pisos = lista(bruto.pisos).map((p) => ({
    ...limpiaFicha(p),
    id: p.id,
    creado: cadena(p.creado, 10),
    notas: cadena(p.notas, 2000),
    enlace: /^https:\/\//.test(String(p.enlace || '')) ? cadena(p.enlace, 500) : '',
    firmaPropietario: esFirmaJpeg(p.firmaPropietario) ? p.firmaPropietario : '',
    firmaPropietarioAncho: Number(p.firmaPropietarioAncho) || 600,
    firmaPropietarioAlto: Number(p.firmaPropietarioAlto) || 200,
  }));
  // Cada lista se rehace con la forma que espera la app: una copia antigua,
  // rota o manipulada no puede romper una pantalla ni colar HTML.
  e.visitas = lista(bruto.visitas).map((v) => {
    const vis = objeto(v.visitante);
    return {
      ...v,
      fecha: cadena(v.fecha, 10), hora: cadena(v.hora, 5), inmueble: cadena(v.inmueble, 120),
      visitante: { nombre: cadena(vis.nombre, 80), dni: cadena(vis.dni, 20), telefono: cadena(vis.telefono, 20), email: cadena(vis.email, 80) },
      acompanantes: cadena(v.acompanantes, 120), observaciones: cadena(v.observaciones, 600),
      aceptaRgpd: v.aceptaRgpd === true, aceptaOfertas: v.aceptaOfertas === true,
      firma: esFirmaJpeg(v.firma) ? v.firma : '',
      firmaAncho: Number(v.firmaAncho) || 600, firmaAlto: Number(v.firmaAlto) || 200,
      pisoId: cadena(v.pisoId, 80),
      piso: v.piso && typeof v.piso === 'object' ? limpiaFicha(Object.fromEntries(CAMPOS_INMUEBLE.map((c) => [c.id, v.piso[c.id]]))) : undefined,
    };
  });
  e.operaciones = lista(bruto.operaciones).map((o) => ({
    ...o,
    tipo: o.tipo === 'alquiler' ? 'alquiler' : 'compraventa',
    inmueble: cadena(o.inmueble, 120),
    precio: Number(o.precio) > 0 ? Number(o.precio) : null,
    partes: Object.fromEntries(Object.entries(objeto(o.partes)).map(([k, p]) => [k, { nombre: cadena(objeto(p).nombre, 80), telefono: cadena(objeto(p).telefono, 20), email: cadena(objeto(p).email, 80) }])),
    papeles: Object.fromEntries(Object.entries(objeto(o.papeles)).map(([k, v]) => [k, v === true])),
    fechas: (Array.isArray(o.fechas) ? o.fechas : []).map((f) => ({ ...validaFecha(f).fecha, id: cadena(objeto(f).id, 80) || String(Math.random()).slice(2) })).filter((f) => f.fecha && f.nombre),
    notas: cadena(o.notas, 1000), notaria: cadena(o.notaria, 80), banco: cadena(o.banco, 80),
    cerrada: o.cerrada === true,
  }));
  e.valoraciones = lista(bruto.valoraciones).map((v) => ({
    ...v,
    inmueble: Object.fromEntries(Object.entries(objeto(v.inmueble)).map(([k, x]) => [k, k === 'm2' ? (Number(x) > 0 ? Number(x) : '') : cadena(x, 120)])),
    propietario: cadena(v.propietario, 80), comentario: cadena(v.comentario, 1500), creada: cadena(v.creada, 10),
    comparables: (Array.isArray(v.comparables) ? v.comparables : []).filter((c) => c && typeof c === 'object').map((c) => ({
      id: cadena(c.id, 80) || String(Math.random()).slice(2), direccion: cadena(c.direccion, 120), fuente: cadena(c.fuente, 20),
      precio: Number.isFinite(Number(c.precio)) && c.precio !== '' ? Number(c.precio) : '', m2: Number.isFinite(Number(c.m2)) && c.m2 !== '' ? Number(c.m2) : '',
      ajuste: Number.isFinite(Number(c.ajuste)) && c.ajuste !== '' ? Number(c.ajuste) : '', notas: cadena(c.notas, 300),
    })),
  }));
  e.papeles = lista(bruto.papeles).map((p) => ({
    ...p, tipo: cadena(p.tipo, 20), titulo: cadena(p.titulo, 80), vence: cadena(p.vence, 10),
    avisoDias: Number.isFinite(Number(p.avisoDias)) ? Math.max(0, Math.min(365, Math.round(Number(p.avisoDias)))) : 30, notas: cadena(p.notas, 300),
  }));
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
    resumen: `${estado.pisos.length} pisos, ${estado.visitas.length} visitas, ${estado.operaciones.length} operaciones, ${estado.valoraciones.length} valoraciones y ${estado.papeles.length} papeles`,
  };
}

/** Tamaño aproximado en KB de lo guardado (localStorage suele admitir ~5 MB). */
export const tamanoKb = (estado) => Math.round(new TextEncoder().encode(JSON.stringify(estado)).length / 1024);
