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

/** Deja los datos de una valoración con la forma que espera Cerebro. */
export function normalizaValoracion(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const i = d.inmueble && typeof d.inmueble === 'object' ? d.inmueble : {};
  const inmueble = {
    direccion: cadena(i.direccion, 120),
    municipio: cadena(i.municipio, 60),
    zona: cadena(i.zona, 60),
    m2: positivo(i.m2),
    habitaciones: positivo(i.habitaciones),
    banos: positivo(i.banos),
    planta: cadena(i.planta, 30),
    estado: cadena(i.estado, 60),
    extras: cadena(i.extras, 200),
  };
  const comparables = (Array.isArray(d.comparables) ? d.comparables : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, MAX_COMPARABLES_IMPORTACION)
    .map((c) => {
      const ajuste = numeroImportacion(c.ajuste);
      return {
        direccion: cadena(c.direccion, 120),
        fuente: FUENTES_IMPORTACION.includes(c.fuente) ? c.fuente : 'otro',
        precio: positivo(c.precio),
        m2: positivo(c.m2),
        ajuste: ajuste !== '' && ajuste >= -50 && ajuste <= 50 ? ajuste : '',
        notas: cadena(c.notas, 300),
      };
    });
  return { inmueble, propietario: cadena(d.propietario, 80), comentario: cadena(d.comentario, 1500), comparables };
}

/** Un comparable sirve si tiene dirección (o referencia), precio y m² mayores que 0. */
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
 * ok es false si no hay al menos 3 comparables con precio y m² > 0.
 */
export function preparaValoracion(entrada) {
  const datos = normalizaValoracion(entrada);
  const validos = datos.comparables.filter(comparableValido);
  const descartados = datos.comparables.length - validos.length;
  const faltan = Math.max(0, MIN_COMPARABLES_IMPORTACION - validos.length);
  const avisos = [];
  if (!datos.inmueble.m2) avisos.push('Falta la superficie del piso: añádela en Cerebro para que salga el rango.');
  if (descartados) avisos.push(`He dejado fuera ${descartados} comparable(s) sin dirección, precio o m².`);
  return {
    ok: faltan === 0,
    faltan,
    validos: validos.length,
    descartados,
    avisos,
    objeto: { v: VERSION_IMPORTACION, tipo: 'valoracion', datos: { ...datos, comparables: validos } },
  };
}
