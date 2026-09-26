/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — utilidades sin estado
   Fechas ISO locales ('YYYY-MM-DD'), formatos en español y escapes.
   No toca el DOM ni el almacenamiento: se importa también en las pruebas.
   ═══════════════════════════════════════════════════════════════════ */

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha ISO local. Nunca toISOString(): pasa a UTC y de noche cambia el día. */
export function aISO(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date local a mediodía (así los cambios de hora no mueven el día). */
export function deISO(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** Fecha ISO real (el 30 de febrero o el 29 en año no bisiesto no valen). */
export const esISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && aISO(deISO(v)) === v;
export const esHora = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

export function horaActual(fecha = new Date()) {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

export function sumaDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

/** Suma n días hábiles (lunes a viernes; los festivos no se conocen aquí). */
export function sumaDiasHabiles(iso, n) {
  let d = iso;
  let quedan = n;
  while (quedan > 0) {
    d = sumaDias(d, 1);
    const dia = deISO(d).getDay();
    if (dia !== 0 && dia !== 6) quedan--;
  }
  return d;
}

export function diasEntre(desde, hasta) {
  return Math.round((deISO(hasta).getTime() - deISO(desde).getTime()) / 86400000);
}

/** "26 de septiembre de 2026" */
export function fechaLarga(iso) {
  if (!esISO(iso)) return '';
  const d = deISO(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "26/09/2026" */
export function fechaCorta(iso) {
  if (!esISO(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Texto relativo: "hoy", "mañana", "en 5 días", "hace 3 días". */
export function cuando(iso, hoy = aISO()) {
  const dif = diasEntre(hoy, iso);
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'mañana';
  if (dif === -1) return 'ayer';
  return dif > 0 ? `en ${dif} días` : `hace ${-dif} días`;
}

const FMT_EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const FMT_NUM = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** 120000 → "120.000 €" (con punto de miles aunque el número tenga 4 cifras). */
export function euros(n) {
  if (!Number.isFinite(n)) return '—';
  const s = FMT_EUR.format(Math.round(n));
  return conMiles(s);
}

export function numero(n) {
  if (!Number.isFinite(n)) return '—';
  return conMiles(FMT_NUM.format(n));
}

/* Intl en español no pone punto de miles con 4 cifras ("1500"); en
   documentos comerciales se espera "1.500". */
function conMiles(s) {
  return s.replace(/(^|[^\d,])(\d{4})(?=[^\d]|$)/g, (_, pre, n) => `${pre}${n[0]}.${n.slice(1)}`);
}

/** Convierte "120.000", "120000 €", "1.234,5" o 120000 a número. NaN si no es número. */
export function aNumero(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/[€\s]/g, '').replace(/m²|m2/gi, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function escapaHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function recorta(texto, max) {
  const s = String(texto ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

let contador = 0;
export function nuevoId(prefijo = 'id') {
  contador = (contador + 1) % 1e6;
  return `${prefijo}-${Date.now().toString(36)}-${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Teléfono español a formato internacional para wa.me ("663 26 38 42" → "34663263842"). */
export function telefonoWhatsapp(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && /^[6789]/.test(d)) d = '34' + d;
  return d.length >= 10 ? d : '';
}

/** Rellena {marcadores} de una plantilla; los que falten quedan como [marcador]. */
export function rellena(plantilla, datos) {
  return String(plantilla ?? '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = datos?.[k];
    return v === undefined || v === null || String(v).trim() === '' ? `[${k}]` : String(v);
  });
}

/** Nombre de archivo seguro: "Hoja visita Uría 12 2026-09-26.pdf" → sin caracteres raros. */
export function nombreArchivo(texto) {
  return String(texto ?? 'documento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'documento';
}
