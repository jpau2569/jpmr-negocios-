/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — la marca (white-label) y los textos legales
   Una copia de la app por inmobiliaria: lo único que cambia de una a
   otra son estos datos, que se guardan en D1 y se editan en Ajustes.
   Por defecto, Asesoría Castresana. Lo que no consta va como
   [PENDIENTE: …]: nunca se inventan datos legales de nadie.
   Módulo puro: lo usan el Worker (validar y guardar) y el navegador
   (pintar los colores y el PDF).
   ═══════════════════════════════════════════════════════════════════ */

import { HOJA_CAPTACION_BORRADOR, HOJA_VISITA_BORRADOR } from '../cerebro/operaciones-datos.js';
import { contrasteRgb, rgbDeHex } from '../cerebro/documentos.js';

/* Datos de Asesoría Castresana que ya constan en el repositorio:
   teléfono y web (cerebro/datos.js), correo y dirección (escaparate3d,
   publicados en su escaparate). Razón social y CIF: no constan. */
export const MARCA_DEFECTO = Object.freeze({
  nombreComercial: 'Asesoría Castresana',
  razonSocial: '[PENDIENTE: razón social]',
  cif: '[PENDIENTE: CIF]',
  direccion: 'C/ Cabo Noval, 8 Bajo 2 · 33007 Oviedo',
  ciudad: 'Oviedo',
  telefono: '985 210 468',
  correo: 'inmobiliariacastresana@gmail.com',
  web: 'asesoriacastresana.com',
  colegiado: '',
  encabezadoFirmas: 'ASESORIA CASTRESANA INMO',
  colorPrincipal: '#10203a',
  colorAcento: '#c9a227',
  titular: 'Pau Moralejo',
});

/* Campos de la marca: etiqueta para el formulario y largo máximo. */
export const CAMPOS_MARCA = [
  { id: 'nombreComercial', etiqueta: 'Nombre comercial (sale como nombre de la app)', max: 60, obligatorio: true },
  { id: 'razonSocial', etiqueta: 'Razón social', max: 120 },
  { id: 'cif', etiqueta: 'CIF / NIF', max: 20 },
  { id: 'direccion', etiqueta: 'Dirección', max: 160 },
  { id: 'ciudad', etiqueta: 'Ciudad (para «En …, a …» de las firmas)', max: 60 },
  { id: 'telefono', etiqueta: 'Teléfono', max: 30 },
  { id: 'correo', etiqueta: 'Correo', max: 120 },
  { id: 'web', etiqueta: 'Web', max: 120 },
  { id: 'colegiado', etiqueta: 'N.º de colegiado o API', max: 60 },
  { id: 'encabezadoFirmas', etiqueta: 'Encabezado del bloque de firmas', max: 60, obligatorio: true },
  { id: 'titular', etiqueta: 'Nombre del titular (el agente que entra con la clave principal)', max: 80, obligatorio: true },
  { id: 'colorPrincipal', etiqueta: 'Color principal', color: true },
  { id: 'colorAcento', etiqueta: 'Color de acento', color: true },
];

/* Textos legales de partida: los BORRADOR de Cerebro (operaciones-datos.js,
   fuentes en cerebro/FUENTES-CAPTACION.md y FUENTES-OPERACIONES.md). */
export const TEXTOS_DEFECTO = Object.freeze({
  declaracion: HOJA_VISITA_BORRADOR.declaracion,
  rgpdVisita: HOJA_VISITA_BORRADOR.rgpd,
  visitaRevisados: false,
  conformidad: HOJA_CAPTACION_BORRADOR.conformidad,
  rgpdCaptacion: HOJA_CAPTACION_BORRADOR.rgpd,
  desistimiento: HOJA_CAPTACION_BORRADOR.desistimiento,
  captacionRevisados: false,
});
export const GRUPOS_TEXTOS = {
  visita: ['declaracion', 'rgpdVisita'],
  captacion: ['conformidad', 'rgpdCaptacion', 'desistimiento'],
};
export const MAX_TEXTO_LEGAL = 6000;

/* Aviso que se enseña antes de «Borrar datos». BORRADOR: no da plazos
   porque no se han verificado; la decisión es de la inmobiliaria. */
export const AVISO_SUPRESION = 'BORRADOR — Antes de borrar: una hoja firmada puede tener que conservarse por obligación legal (por ejemplo, para defender una reclamación o por normas de prevención del blanqueo de capitales). Esta app no conoce los plazos que se aplican a tu caso. La decisión de borrar o de conservar bloqueada es de la inmobiliaria, con su gestor o abogado. Borrar es definitivo.';

const COLOR = /^#[0-9a-f]{6}$/i;
const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

/** ¿Quedan [corchetes] por rellenar? Mientras queden, no se puede marcar «revisado». */
export const tieneCorchetes = (t) => /\[[^\]]+\]/.test(String(t ?? ''));

/** Valida y limpia la marca. Lo que falta se rellena con el valor por defecto. */
export function validaMarca(bruto) {
  const b = bruto && typeof bruto === 'object' ? bruto : {};
  const marca = {};
  const errores = [];
  for (const c of CAMPOS_MARCA) {
    if (c.color) {
      const v = String(b[c.id] ?? '').trim();
      if (!v) marca[c.id] = MARCA_DEFECTO[c.id];
      else if (COLOR.test(v)) marca[c.id] = v.toLowerCase();
      else { errores.push(`${c.etiqueta}: tiene que ser un color como #10203a.`); marca[c.id] = MARCA_DEFECTO[c.id]; }
      continue;
    }
    const v = texto(b[c.id], c.max);
    if (c.obligatorio && v.length < 2) errores.push(`Falta: ${c.etiqueta}.`);
    marca[c.id] = v;
  }
  return { ok: errores.length === 0, marca, errores };
}

/** La marca guardada (o nada) mezclada con la de por defecto: siempre completa. */
export function marcaCompleta(guardada) {
  const r = validaMarca({ ...MARCA_DEFECTO, ...(guardada && typeof guardada === 'object' ? guardada : {}) });
  for (const c of CAMPOS_MARCA) if (c.obligatorio && r.marca[c.id].length < 2) r.marca[c.id] = MARCA_DEFECTO[c.id];
  return r.marca;
}

/** Textos guardados (o nada) mezclados con los de por defecto. */
export function textosCompletos(guardados) {
  const g = guardados && typeof guardados === 'object' ? guardados : {};
  const t = {};
  for (const k of [...GRUPOS_TEXTOS.visita, ...GRUPOS_TEXTOS.captacion]) {
    t[k] = typeof g[k] === 'string' ? texto(g[k], MAX_TEXTO_LEGAL) : TEXTOS_DEFECTO[k];
  }
  t.visitaRevisados = g.visitaRevisados === true && !GRUPOS_TEXTOS.visita.some((k) => tieneCorchetes(t[k]));
  t.captacionRevisados = g.captacionRevisados === true && !GRUPOS_TEXTOS.captacion.some((k) => tieneCorchetes(t[k]));
  return t;
}

/**
 * Cambia los textos. Si cambia alguno de un grupo, ese grupo vuelve a ser
 * BORRADOR: un profesional tiene que revisarlo otra vez.
 */
export function cambiaTextos(actuales, nuevos) {
  const a = textosCompletos(actuales);
  const n = nuevos && typeof nuevos === 'object' ? nuevos : {};
  const t = { ...a };
  const errores = [];
  for (const grupo of Object.keys(GRUPOS_TEXTOS)) {
    let cambiado = false;
    for (const k of GRUPOS_TEXTOS[grupo]) {
      if (typeof n[k] !== 'string') continue;
      if (n[k].length > MAX_TEXTO_LEGAL) { errores.push(`Un texto legal pasa de ${MAX_TEXTO_LEGAL} caracteres.`); continue; }
      const v = texto(n[k], MAX_TEXTO_LEGAL);
      if (!v) { errores.push('Los textos legales no pueden quedar vacíos (vuelve al borrador si hace falta).'); continue; }
      if (v !== a[k]) { t[k] = v; cambiado = true; }
    }
    if (cambiado) t[`${grupo}Revisados`] = false;
  }
  return { ok: errores.length === 0, textos: t, errores };
}

/** Marca o desmarca «revisado por un profesional». No deja si quedan [corchetes]. */
export function marcaRevisados(actuales, grupo, valor) {
  const t = textosCompletos(actuales);
  if (!GRUPOS_TEXTOS[grupo]) return { ok: false, error: 'Grupo de textos desconocido.' };
  if (valor && GRUPOS_TEXTOS[grupo].some((k) => tieneCorchetes(t[k]))) {
    return { ok: false, error: 'Aún quedan datos entre [corchetes] por completar en esos textos.' };
  }
  return { ok: true, textos: { ...t, [`${grupo}Revisados`]: Boolean(valor) } };
}

/** Datos de la marca que siguen [PENDIENTE] (para avisar en Ajustes). */
export const pendientesMarca = (marca) => CAMPOS_MARCA.filter((c) => tieneCorchetes(marca?.[c.id])).map((c) => c.etiqueta);

/* ── Colores legibles (WCAG) ─────────────────────────────────────────── */

/** Texto blanco o negro, el que más contraste tenga sobre ese fondo. */
export function textoSobre(hex) {
  const c = rgbDeHex(hex) || [16, 32, 58];
  return contrasteRgb(c, [255, 255, 255]) >= contrasteRgb(c, [0, 0, 0]) ? '#ffffff' : '#000000';
}

/** Contraste entre dos colores en hexadecimal (1 a 21). */
export function contraste(hexA, hexB) {
  const a = rgbDeHex(hexA);
  const b = rgbDeHex(hexB);
  return a && b ? contrasteRgb(a, b) : 1;
}

/**
 * Colores para la interfaz: el principal se usa como fondo de botones y
 * barra (con texto blanco o negro según convenga). Si el principal no se lee
 * como texto sobre blanco (contraste < 4,5), los títulos van en gris oscuro.
 */
export function coloresInterfaz(marca) {
  const principal = COLOR.test(marca?.colorPrincipal || '') ? marca.colorPrincipal : MARCA_DEFECTO.colorPrincipal;
  const acento = COLOR.test(marca?.colorAcento || '') ? marca.colorAcento : MARCA_DEFECTO.colorAcento;
  return {
    principal,
    acento,
    sobrePrincipal: textoSobre(principal),
    sobreAcento: textoSobre(acento),
    titulos: contraste(principal, '#ffffff') >= 4.5 ? principal : '#222222',
  };
}

/** Línea legal pequeña bajo la cabecera del PDF (solo los datos que constan). */
export function lineaLegal(marca) {
  const v = (x) => (x && !tieneCorchetes(x) ? x : '');
  return [v(marca.razonSocial), v(marca.cif) && `CIF ${marca.cif}`, v(marca.direccion), v(marca.correo), v(marca.colegiado) && `N.º col./API ${marca.colegiado}`].filter(Boolean).join(' · ');
}
