/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — la hoja firmada: forma, validación y huella SHA-256
   El MISMO código corre en el móvil (antes de firmar y para la cola sin
   conexión) y en el Worker (al recibirla). Así el código SHA-256 que el
   móvil pone al pie del PDF es exactamente el que guarda el servidor.

   Lo que se firma (y entra en el SHA-256) es TODO lo que sale en el PDF:
   datos, textos legales tal como estaban al firmar, marca, agente,
   fecha del móvil y las dos firmas. Si cambia una coma, cambia el código.

   Firmas: JPEG sobre fondo blanco (como en Cerebro), porque el generador
   de PDF propio (cerebro/pdf.js) incrusta JPEG sin recomprimir; un PNG
   necesitaría otro decodificador. Máximo 150 KB por firma.
   Módulo puro (solo usa crypto.subtle, que existe en Workers, navegador y Node).
   ═══════════════════════════════════════════════════════════════════ */

import { CAMPOS_PISO, CAMPOS_INMUEBLE, limpiaFicha, nombrePiso } from '../cerebro/campos-piso.js';
import { esFirmaJpeg } from '../cerebro/visitas.js';
import { esISO, esHora, telefonoWhatsapp } from '../cerebro/utiles.js';
import { validaMarca, MAX_TEXTO_LEGAL } from './marca.js';
import { analizaJpegDataUrl } from './jpeg.js';

export const VERSION_HOJA = 1;
export const TIPOS = { visita: 'Hoja de visita', captacion: 'Hoja de captación' };
export const MAX_FIRMA_BYTES = 150 * 1024;
export const MAX_HOJA_CARACTERES = 700_000;
/* Una hoja firmada sin cobertura puede esperar en el móvil. Más de 90 días
   o una fecha del futuro (reloj del móvil mal) no se aceptan. */
export const ANTIGUEDAD_MAXIMA_MS = 90 * 86400_000;
export const ADELANTO_MAXIMO_MS = 10 * 60_000;

/* En la captación salen todos los datos de campos-piso.js menos los
   internos (el precio mínimo nunca sale en un PDF ni se firma). */
export const CAMPOS_CAPTACION = CAMPOS_PISO.filter((c) => !c.interno);
/* Obligatorios para firmar un encargo: nadie firma con huecos en blanco. */
export const OBLIGATORIOS_CAPTACION = ['propNombre', 'tipoEncargo', 'honorarios', 'duracion', 'lugarFirma'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const esId = (x) => typeof x === 'string' && UUID.test(x);
export const nuevoId = () => crypto.randomUUID();

const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const esObjeto = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const cifras = (t) => String(t ?? '').replace(/\D/g, '');

/* ── Forma canónica y SHA-256 ────────────────────────────────────────── */

/**
 * JSON con las claves ordenadas, siempre igual para el mismo contenido
 * (JSON.stringify depende del orden en que se crearon las claves).
 */
export function canonico(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new TypeError('canonico: número no válido');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  }
  throw new TypeError(`canonico: tipo no admitido (${typeof v})`);
}

export async function sha256Hex(t) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t))));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Huella SHA-256 (64 caracteres hexadecimales) del contenido firmado. */
export const hashHoja = (hoja) => sha256Hex(canonico(hoja));
export const esHash = (x) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

/**
 * Huella de los textos legales de una hoja SIN la marca «revisados»: el
 * Worker guarda la de cada versión que el titular marca como revisada, y
 * así acepta una hoja firmada sin conexión con unos textos que estaban
 * revisados al firmarla aunque luego se hayan cambiado en Ajustes.
 */
export function huellaTextos(textos) {
  const { revisados, ...resto } = textos && typeof textos === 'object' ? textos : {};
  return sha256Hex(canonico(resto));
}

/* ── Firmas ──────────────────────────────────────────────────────────── */

/** Bytes aproximados de un dataURL base64 (sin decodificarlo). */
export const bytesDeBase64 = (dataUrl) => {
  const b64 = String(dataUrl).split(',')[1] || '';
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
};

/**
 * { dataUrl, ancho, alto } con un JPEG de verdad y ≤ 150 KB. Se analiza la
 * estructura del archivo (jpeg.js: SOI, segmentos, SOF con medidas
 * razonables, datos de imagen y EOI) y las medidas tienen que ser las que
 * dice la hoja. Lo que no se puede detectar: una firma en BLANCO bien
 * formada (ver jpeg.js); eso lo frena el móvil, que exige un trazo.
 */
export function limpiaFirma(f, quien) {
  if (!esObjeto(f) || !esFirmaJpeg(f.dataUrl)) return { error: `Falta la firma ${quien}.` };
  if (!String(f.dataUrl).startsWith('data:image/jpeg;base64,/9j/')) return { error: `La firma ${quien} no es una imagen válida.` };
  if (bytesDeBase64(f.dataUrl) > MAX_FIRMA_BYTES) return { error: `La firma ${quien} pesa demasiado (máximo 150 KB).` };
  const ancho = Number(f.ancho);
  const alto = Number(f.alto);
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 50 || alto < 20 || ancho > 2000 || alto > 2000) {
    return { error: `La firma ${quien} no tiene un tamaño válido.` };
  }
  const jpeg = analizaJpegDataUrl(f.dataUrl, { maxLado: 2000 });
  if (!jpeg.ok) return { error: `La firma ${quien} no es una imagen válida (${jpeg.motivo}).` };
  if (jpeg.ancho !== ancho || jpeg.alto !== alto) return { error: `La firma ${quien} no tiene las medidas que dice.` };
  return { firma: { dataUrl: f.dataUrl, ancho, alto } };
}

/* ── Datos ───────────────────────────────────────────────────────────── */

function limpiaPiso(p, campos) {
  const fuente = esObjeto(p) ? p : {};
  const limpio = limpiaFicha(Object.fromEntries(campos.map((c) => [c.id, fuente[c.id]])));
  // limpiaFicha conoce todos los campos: se quitan los que no tocan.
  const permitidos = new Set(campos.map((c) => c.id));
  for (const k of Object.keys(limpio)) if (!permitidos.has(k)) delete limpio[k];
  return limpio;
}

function limpiaTextos(t, tipo) {
  const o = esObjeto(t) ? t : {};
  const claves = tipo === 'visita' ? ['declaracion', 'rgpd'] : ['conformidad', 'rgpd', 'desistimiento'];
  const r = { revisados: o.revisados === true };
  const errores = [];
  for (const k of claves) {
    r[k] = texto(o[k], MAX_TEXTO_LEGAL);
    if (!r[k]) errores.push('Faltan los textos legales: entra con conexión una vez para descargarlos.');
  }
  return { textos: r, errores: [...new Set(errores)] };
}

function limpiaDatosVisita(d) {
  const o = esObjeto(d) ? d : {};
  const v = esObjeto(o.visitante) ? o.visitante : {};
  const datos = {
    fecha: texto(o.fecha, 10),
    hora: texto(o.hora, 5),
    visitante: {
      nombre: texto(v.nombre, 80),
      dni: texto(v.dni, 20).toUpperCase(),
      telefono: texto(v.telefono, 20),
      email: texto(v.email, 80),
    },
    acompanantes: texto(o.acompanantes, 120),
    observaciones: texto(o.observaciones, 600),
    aceptaRgpd: o.aceptaRgpd === true,
    aceptaOfertas: o.aceptaOfertas === true,
    piso: limpiaPiso(o.piso, CAMPOS_INMUEBLE),
  };
  const errores = [];
  if (!esISO(datos.fecha)) errores.push('Falta la fecha de la visita.');
  if (!esHora(datos.hora)) errores.push('Falta la hora de la visita (por ejemplo 17:30).');
  if (datos.visitante.nombre.length < 2) errores.push('Falta el nombre del visitante.');
  const tel = cifras(datos.visitante.telefono);
  if (tel.length < 9 || tel.length > 15) errores.push('Falta el teléfono del visitante (9 cifras como mínimo).');
  if (datos.visitante.email && !EMAIL.test(datos.visitante.email)) errores.push('El correo del visitante no parece válido.');
  if (!datos.piso.referencia && !datos.piso.direccion) errores.push('Indica la referencia o la dirección del piso.');
  if (!datos.aceptaRgpd) errores.push('El visitante tiene que marcar que ha leído la información de protección de datos.');
  return { datos, errores };
}

function limpiaDatosCaptacion(d) {
  const o = esObjeto(d) ? d : {};
  const datos = { piso: limpiaPiso(o.piso, CAMPOS_CAPTACION), notas: texto(o.notas, 2000) };
  const errores = [];
  const p = datos.piso;
  for (const id of OBLIGATORIOS_CAPTACION) {
    if (p[id] === undefined || p[id] === '') errores.push(`Falta: ${CAMPOS_PISO.find((c) => c.id === id).etiqueta}.`);
  }
  if (!p.referencia && !p.direccion) errores.push('Indica la referencia o la dirección del piso.');
  if (p.propEmail && !EMAIL.test(p.propEmail)) errores.push('El correo del propietario no parece válido.');
  if (!esISO(p.fechaCaptacion)) errores.push('Falta la fecha de captación.');
  return { datos, errores };
}

/**
 * Deja la hoja con la forma exacta que se firma y dice qué falta.
 * opciones.ahoraMs: reloj para comprobar la fecha del móvil (el Worker pasa
 * el suyo; el móvil, el propio).
 * Devuelve { ok, hoja, errores }.
 */
export function limpiaHoja(bruto, { ahoraMs = Date.now() } = {}) {
  const b = esObjeto(bruto) ? bruto : {};
  const errores = [];
  const tipo = b.tipo === 'captacion' ? 'captacion' : b.tipo === 'visita' ? 'visita' : '';
  if (!tipo) errores.push('Tipo de hoja desconocido.');
  if (!esId(b.id)) errores.push('La hoja no tiene un identificador válido.');
  if (b.v !== VERSION_HOJA) errores.push('Versión de hoja no admitida: actualiza la app.');

  const firmadaEn = texto(b.firmadaEn, 30);
  const t = Date.parse(firmadaEn);
  // Siempre en la forma de toISOString() (con milésimas): así las fechas se
  // pueden ordenar y filtrar como texto en la base de datos.
  if (Number.isNaN(t) || new Date(t).toISOString() !== firmadaEn) errores.push('Falta la fecha de firma.');
  else if (t > ahoraMs + ADELANTO_MAXIMO_MS) errores.push('La fecha de firma es del futuro: revisa la hora del móvil.');
  else if (t < ahoraMs - ANTIGUEDAD_MAXIMA_MS) errores.push('La hoja se firmó hace más de 90 días y no se puede subir.');

  const ag = esObjeto(b.agente) ? b.agente : {};
  const agente = { id: Number.isSafeInteger(ag.id) && ag.id >= 0 ? ag.id : -1, nombre: texto(ag.nombre, 80) };
  if (agente.id < 0 || agente.nombre.length < 2) errores.push('Falta el agente.');

  const m = validaMarca(b.marca);
  if (!m.ok) errores.push(...m.errores);

  const tx = limpiaTextos(b.textos, tipo || 'visita');
  errores.push(...tx.errores);

  const dd = tipo === 'captacion' ? limpiaDatosCaptacion(b.datos) : limpiaDatosVisita(b.datos);
  errores.push(...dd.errores);

  const fb = esObjeto(b.firmas) ? b.firmas : {};
  const fc = limpiaFirma(fb.cliente, tipo === 'captacion' ? 'del propietario' : 'del visitante');
  const fa = limpiaFirma(fb.agente, 'del agente');
  if (fc.error) errores.push(fc.error);
  if (fa.error) errores.push(fa.error);

  const hoja = {
    v: VERSION_HOJA,
    id: esId(b.id) ? b.id : '',
    tipo,
    firmadaEn,
    agente,
    marca: m.marca,
    textos: tx.textos,
    datos: dd.datos,
    firmas: { cliente: fc.firma || null, agente: fa.firma || null },
  };
  if (errores.length === 0 && canonico(hoja).length > MAX_HOJA_CARACTERES) errores.push('La hoja es demasiado grande.');
  return { ok: errores.length === 0, hoja, errores };
}

/**
 * ¿Lo recibido es EXACTAMENTE una hoja limpia? El Worker no arregla nada en
 * silencio: si limpiar cambiara algo, el SHA-256 ya no sería el del PDF que
 * tiene el cliente, así que se rechaza.
 */
export function esHojaExacta(bruto, opciones) {
  const r = limpiaHoja(bruto, opciones);
  if (!r.ok) return r;
  let igual = false;
  try { igual = canonico(r.hoja) === canonico(bruto); } catch { igual = false; }
  return igual ? r : { ok: false, hoja: r.hoja, errores: ['La hoja trae datos que no se esperaban.'] };
}

/* ── Resúmenes para listas, filtros, CSV y avisos ────────────────────── */

export const normalBusqueda = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Lo que se guarda en columnas aparte para buscar y listar sin abrir la hoja. */
export function resumenHoja(hoja) {
  const p = hoja.tipo === 'captacion' ? hoja.datos.piso : hoja.datos.piso || {};
  const persona = hoja.tipo === 'captacion'
    ? { nombre: p.propNombre || '', dni: p.propDni || '', telefono: p.propTelefono || '', email: p.propEmail || '' }
    : { ...hoja.datos.visitante };
  const referencia = String(p.referencia || '');
  const inmueble = nombrePiso(p);
  return {
    referencia,
    inmueble,
    ...persona,
    busqueda: normalBusqueda([persona.nombre, referencia, p.direccion, p.municipio].filter(Boolean).join(' ')).slice(0, 400),
  };
}

/** Solo el nombre de pila (la primera palabra), para avisos con datos mínimos. */
export const nombreDePila = (nombre) => String(nombre || '').trim().split(/\s+/)[0]?.slice(0, 40) || '';

/** Fecha y hora en Madrid: { fecha: '13/10/2026', hora: '10:32', iso: '2026-10-13' }. */
export function enMadrid(iso) {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return { fecha: '', hora: '', iso: '' };
  const partes = Object.fromEntries(new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return { fecha: `${partes.day}/${partes.month}/${partes.year}`, hora: `${partes.hour}:${partes.minute}`, iso: `${partes.year}-${partes.month}-${partes.day}` };
}

/* ── Enviar (sin enviar nada solo: abren WhatsApp o el correo con el texto) ── */

export function textoEnvio(hoja, marca) {
  const r = resumenHoja(hoja);
  const que = hoja.tipo === 'captacion' ? 'la hoja de captación' : 'la hoja de visita';
  return `Hola ${nombreDePila(r.nombre)}, te envío ${que} que has firmado${r.referencia ? ` (ref. ${r.referencia})` : ''}. Te la mando en PDF en el siguiente mensaje. Un saludo, ${hoja.agente.nombre} · ${marca?.nombreComercial || hoja.marca.nombreComercial}.`;
}

export function enlaceWhatsapp(telefono, textoMensaje) {
  const n = telefonoWhatsapp(telefono);
  return `https://wa.me/${n}?text=${encodeURIComponent(textoMensaje)}`;
}

/* Para el destinatario del mailto solo se admite un correo «normal»: nada de
   ?, &, comas ni = que pudieran colar otros destinatarios o cabeceras. */
const CORREO_SIMPLE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function enlaceCorreo(correo, asunto, cuerpo) {
  const destino = CORREO_SIMPLE.test(String(correo || '')) ? correo : '';
  return `mailto:${destino}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
