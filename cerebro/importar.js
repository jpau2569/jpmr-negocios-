/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — enlaces de importación
   Clara (el chat) prepara una valoración con los comparables que ha
   reunido y se la pasa a Cerebro en un enlace:
     https://…/cerebro/app.html#importar=<JSON en base64url>
   Los datos viajan en el «#» del enlace, que el navegador nunca manda al
   servidor: solo los ve el móvil de Pau al abrirlo.
   Módulo puro (sin DOM): funciona igual en Node 22 y en el navegador.
   ═══════════════════════════════════════════════════════════════════ */

export const VERSION_IMPORTACION = 1;
export const TIPOS_IMPORTACION = ['valoracion'];
export const FUENTES_IMPORTACION = ['anuncio', 'venta', 'propio', 'otro'];
export const MIN_COMPARABLES_IMPORTACION = 3;
export const MAX_COMPARABLES_IMPORTACION = 20;
const MAX_CODIFICADO = 60000; // un enlace más largo que esto no es nuestro

// Rangos razonables: fuera de ellos el número es un error (1e300 €, 1,2 €,
// 0,5 m²) y se descarta en vez de estropear el €/m² de toda la valoración.
export const RANGO_PRECIO = { min: 1000, max: 50_000_000 }; // € de un comparable
export const RANGO_M2 = { min: 5, max: 100_000 };           // m² de un comparable o del inmueble
export const RANGO_AJUSTE = { min: -50, max: 50 };          // % de ajuste

/* ── base64url sobre UTF-8 (sin Buffer, para que valga en el navegador) ── */

function aBase64url(bytes) {
  let bin = '';
  // Por trozos: String.fromCharCode(...lista enorme) revienta la pila.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ── Normalización (lo que venga, sale con tipos y tamaños sanos) ── */

const cadena = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');

/** Número desde número o texto español ("120.000", "85,5", "98000 €"). '' si no vale. */
export function numeroImportacion(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (typeof v !== 'string' || !v.trim()) return '';
  // «1e300» no es un número que escriba nadie: sin esto se leería 1300.
  if (/\d\s*e\s*[+-]?\d/i.test(v)) return '';
  let s = v.replace(/[^\d.,-]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return s && Number.isFinite(n) ? n : '';
}

const positivo = (v) => {
  const n = numeroImportacion(v);
  return n !== '' && n > 0 ? n : '';
};

/** El número si está dentro de { min, max } (ambos incluidos); si no, ''. */
export function enRango(v, { min, max }) {
  const n = numeroImportacion(v);
  return n !== '' && n >= min && n <= max ? n : '';
}

/** Deja los datos de una valoración con la forma que espera Cerebro. */
export function normalizaValoracion(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const i = d.inmueble && typeof d.inmueble === 'object' ? d.inmueble : {};
  const inmueble = {
    direccion: cadena(i.direccion, 120),
    municipio: cadena(i.municipio, 60),
    zona: cadena(i.zona, 60),
    m2: enRango(i.m2, RANGO_M2),
    habitaciones: positivo(i.habitaciones),
    banos: positivo(i.banos),
    planta: cadena(i.planta, 30),
    estado: cadena(i.estado, 60),
    extras: cadena(i.extras, 200),
  };
  const comparables = (Array.isArray(d.comparables) ? d.comparables : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, MAX_COMPARABLES_IMPORTACION)
    .map((c) => ({
      direccion: cadena(c.direccion, 120),
      fuente: FUENTES_IMPORTACION.includes(c.fuente) ? c.fuente : 'otro',
      precio: enRango(c.precio, RANGO_PRECIO),
      m2: enRango(c.m2, RANGO_M2),
      ajuste: enRango(c.ajuste, RANGO_AJUSTE),
      notas: cadena(c.notas, 300),
    }));
  return { inmueble, propietario: cadena(d.propietario, 80), comentario: cadena(d.comentario, 1500), comparables };
}

/**
 * Un comparable sirve si tiene dirección (o referencia), precio y m² mayores
 * que 0. Tras normalizaValoracion, un precio o unos m² fuera de rango ya son ''.
 */
export const comparableValido = (c) => Boolean(c?.direccion) && c.precio > 0 && c.m2 > 0;

/* ── API pública ── */

/** Objeto → JSON → UTF-8 → base64url (sin «=»). */
export function codificaImportacion(obj) {
  return aBase64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Texto (el código, el «#importar=…» o el enlace entero) → objeto normalizado,
 * o null si no es una importación válida. Nunca lanza.
 */
export function decodificaImportacion(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    const marca = s.indexOf('importar=');
    if (marca >= 0) s = s.slice(marca + 'importar='.length).split(/[&#\s]/)[0];
    if (!s || s.length > MAX_CODIFICADO || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
    const obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(deBase64url(s)));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj.v !== VERSION_IMPORTACION || !TIPOS_IMPORTACION.includes(obj.tipo)) return null;
    return { v: VERSION_IMPORTACION, tipo: obj.tipo, datos: normalizaValoracion(obj.datos) };
  } catch {
    return null;
  }
}

/** `${base}/cerebro/app.html#importar=${codificado}` */
export function enlaceImportacion(base, obj) {
  return `${String(base || '').trim().replace(/\/+$/, '')}/cerebro/app.html#importar=${codificaImportacion(obj)}`;
}

/**
 * Prepara una importación de valoración a partir de lo que reúne Clara.
 * Devuelve { ok, objeto, validos, descartados, faltan, avisos }:
 * ok es false si no hay al menos 3 comparables con precio y m² dentro de rango.
 */
export function preparaValoracion(entrada) {
  const datos = normalizaValoracion(entrada);
  const validos = datos.comparables.filter(comparableValido);
  const descartados = datos.comparables.length - validos.length;
  const faltan = Math.max(0, MIN_COMPARABLES_IMPORTACION - validos.length);
  const avisos = [];
  if (!datos.inmueble.m2) avisos.push('Falta la superficie del piso: añádela en Cerebro para que salga el rango.');
  if (descartados) avisos.push(`He dejado fuera ${descartados} comparable(s) sin dirección, precio o m², o con cifras imposibles (precio fuera de 1.000-50.000.000 € o m² fuera de 5-100.000).`);
  return {
    ok: faltan === 0,
    faltan,
    validos: validos.length,
    descartados,
    avisos,
    objeto: { v: VERSION_IMPORTACION, tipo: 'valoracion', datos: { ...datos, comparables: validos } },
  };
}
