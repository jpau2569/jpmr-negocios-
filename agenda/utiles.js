/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — utilidades sin estado
   Fechas ISO locales ('AAAA-MM-DD') y horas 'HH:MM' en la hora del
   aparato (Europe/Madrid en el móvil de Pau), formatos en español de
   España (DD/MM/AAAA, 24 h, euros) y escapes. No toca el DOM ni el
   almacenamiento: se importa también en las pruebas.
   ═══════════════════════════════════════════════════════════════════ */

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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

/** Fecha ISO real (el 30 de febrero no vale). */
export const esISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && aISO(deISO(v)) === v;
export const esHora = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

export const horaDe = (fecha = new Date()) =>
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

export function sumaDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

/** Suma meses sin saltar de mes (31 de enero + 1 → 28/29 de febrero). */
export function sumaMeses(iso, n) {
  const d = deISO(iso);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return aISO(d);
}

/** Días entre dos fechas ISO (b − a). */
export const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);

/** Lunes de la semana de esa fecha (en España la semana empieza el lunes). */
export function lunesDe(iso) {
  const d = deISO(iso);
  const dia = (d.getDay() + 6) % 7;
  return sumaDias(iso, -dia);
}

export const minutos = (hora) => {
  if (!esHora(hora)) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};
export const deMinutos = (n) => {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(n)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** DD/MM/AAAA */
export function fechaCorta(iso) {
  if (!esISO(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** «martes, 20 de octubre de 2026» */
export function fechaLarga(iso) {
  if (!esISO(iso)) return '';
  const d = deISO(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** «Hoy», «Mañana», «Ayer» o «mar 20/10». */
export function cuando(iso, hoy = aISO()) {
  if (!esISO(iso)) return 'Sin fecha';
  const n = diasEntre(hoy, iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  const d = deISO(iso);
  return `${DIAS[d.getDay()].slice(0, 3)} ${fechaCorta(iso).slice(0, 5)}${d.getFullYear() !== deISO(hoy).getFullYear() ? '/' + d.getFullYear() : ''}`;
}

/** 245.000 € (sin decimales si no los hay). */
export function euros(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });
}

/** Lee un número escrito a la española («245.000», «1.250,50», «245000»). */
export function numeroES(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  let s = String(texto ?? '').replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function escapaHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Minúsculas sin tildes ni espacios dobles, para buscar y comparar. */
export const normaliza = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function nuevoId(prefijo = 'r') {
  const azar = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefijo}_${Date.now().toString(36)}${azar}`;
}

/** Solo http(s): nada de javascript:, data: ni file:. Devuelve la URL limpia o ''. */
export function urlSegura(texto) {
  let s = String(texto ?? '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+/.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.href;
  } catch { return ''; }
}

/** Dominio sin www. */
export function dominio(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Teléfono para tel: y wa.me. Un móvil español de 9 cifras recibe el 34. */
export function telefonoLimpio(tel) {
  const s = String(tel ?? '').replace(/[^\d+]/g, '');
  return s.replace(/(?!^)\+/g, '');
}
export function telefonoWhatsapp(tel) {
  let s = telefonoLimpio(tel).replace(/^\+/, '').replace(/^00/, '');
  if (/^[67]\d{8}$/.test(s)) s = '34' + s;
  return /^\d{8,15}$/.test(s) ? s : '';
}
export const esEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export const nombreArchivo = (t) => normaliza(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'archivo';
