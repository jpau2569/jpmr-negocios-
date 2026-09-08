/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — utilidades sin estado
   Fechas en formato ISO local ('YYYY-MM-DD'), textos y formatos.
   Este módulo no toca el DOM ni el almacenamiento: se puede importar
   en Node para las pruebas.
   ═══════════════════════════════════════════════════════════════════ */

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Fecha ISO local ('YYYY-MM-DD'). Nunca toISOString(): eso convierte a UTC
    y a partir de las 22:00 en España devolvía el día siguiente. */
export function aISO(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Date local a partir de un ISO, siempre a mediodía para que ningún cambio
    de hora (marzo/octubre) desplace el día al sumar o restar. */
export function deISO(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export const esISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export function sumaDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

/** Días enteros de `desde` a `hasta` (positivo si `hasta` es futuro). */
export function diasEntre(desde, hasta) {
  const ms = deISO(hasta).getTime() - deISO(desde).getTime();
  return Math.round(ms / 86400000);
}

/** 1 = lunes … 7 = domingo (el horario escolar empieza en lunes). */
export function diaSemana(iso) {
  const n = deISO(iso).getDay();
  return n === 0 ? 7 : n;
}

export const esFinDeSemana = (iso) => diaSemana(iso) >= 6;

/** Texto humano de una fecha respecto a hoy: "hoy", "mañana", "jueves 12". */
export function fechaHumana(iso, hoy = aISO()) {
  const dif = diasEntre(hoy, iso);
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'mañana';
  if (dif === -1) return 'ayer';
  const d = deISO(iso);
  const texto = `${DIAS[d.getDay()]} ${d.getDate()}`;
  if (dif < -1) return `${texto} (pasó)`;
  if (dif > 6) return `${texto} de ${MESES[d.getMonth()]}`;
  return texto;
}

/** "Faltan 3 días" / "¡Es hoy!" — lo que de verdad quiere leer un alumno. */
export function cuentaAtras(iso, hoy = aISO()) {
  const dif = diasEntre(hoy, iso);
  if (dif < 0) return 'ya pasó';
  if (dif === 0) return '¡es hoy!';
  if (dif === 1) return 'mañana';
  return `faltan ${dif} días`;
}

/** "2 sep" — para rangos y partes, donde "ayer/hoy" no sirve. */
export function fechaCorta(iso) {
  const d = deISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

/** "1 tarjeta" / "5 tarjetas": escribir "tarjeta(s)" es de formulario, no de app. */
export function plural(n, uno, muchos) {
  return `${n} ${n === 1 ? uno : muchos}`;
}

export function minutosATexto(min) {
  const m = Math.max(0, Math.round(min || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function mmss(segundos) {
  const s = Math.max(0, Math.round(segundos || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Identificador corto y único dentro del dispositivo. */
export function id(prefijo = '') {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}${Date.now().toString(36)}${azar}`;
}

/** Escapa texto antes de meterlo en HTML: todo lo que escribe Nicer pasa por
    aquí, así una comilla o un `<` en un enunciado no rompe la pantalla. */
export function escapa(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const limita = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));

export function recorta(texto, largo = 80) {
  const t = String(texto ?? '').trim();
  return t.length > largo ? `${t.slice(0, largo - 1)}…` : t;
}

/** Normaliza para buscar y comparar: sin tildes, en minúsculas. */
export const normalizaTexto = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Suma segura de horas de un horario ("09:15" → 555 minutos). */
export function horaAMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
