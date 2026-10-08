// ============================================================================
//  Utilidades comunes: errores de aplicación, fechas locales, normalización
//  de texto, teléfonos, correos y URLs.
//  Fechas de agenda y negocio: "AAAA-MM-DD" y "HH:MM" en hora LOCAL del equipo
//  (una inmobiliaria de Asturias trabaja en una sola zona horaria).
//  Sellos de sistema (creado_en, historial): ISO UTC con "Z".
// ============================================================================

export class ErrorApp extends Error {
  constructor(estado, codigo, mensaje, extra = {}) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.extra = extra;
  }
}
export const noEncontrado = (que) => new ErrorApp(404, "no_encontrado", `${que} no existe o ya se ha eliminado.`);
export const invalido = (mensaje, campos = {}) => new ErrorApp(422, "validacion", mensaje, { campos });
export const conflicto = (codigo, mensaje, extra = {}) => new ErrorApp(409, codigo, mensaje, extra);

// ---------------------------------------------------------------- reloj ----
export const relojSistema = { ahora: () => new Date() };

const dos = (n) => String(n).padStart(2, "0");
export function isoLocal(d) { return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; }
export function hmLocal(d) { return `${dos(d.getHours())}:${dos(d.getMinutes())}`; }
export const hoy = (reloj) => isoLocal(reloj.ahora());
export const horaAhora = (reloj) => hmLocal(reloj.ahora());
export const sello = (reloj) => reloj.ahora().toISOString();

export function fechaValida(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d && a >= 1900 && a <= 2200;
}
export function aFecha(iso) { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d, 12, 0, 0); }
export function sumaDias(iso, n) { const f = aFecha(iso); f.setDate(f.getDate() + n); return isoLocal(f); }
/** Lunes de la semana de una fecha (la semana española empieza en lunes). */
export function lunesDe(iso) {
  const f = aFecha(iso);
  const dia = (f.getDay() + 6) % 7; // lunes = 0
  f.setDate(f.getDate() - dia);
  return isoLocal(f);
}
export function diasEntre(a, b) { return Math.round((aFecha(b) - aFecha(a)) / 86400000); }

// ---------------------------------------------------------------- texto ----
/** Minúsculas, sin tildes y con espacios colapsados: para buscar y comparar. */
export function normaliza(s) {
  if (s === null || s === undefined) return "";
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function telefonoNorm(s) {
  if (!s) return null;
  let d = String(s).replace(/\D/g, "");
  if (d.startsWith("0034")) d = d.slice(4);
  else if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
  return d.length >= 6 ? d : null;
}
export function emailNorm(s) { return s ? String(s).trim().toLowerCase() : null; }

/** Para detectar el mismo anuncio con enlaces ligeramente distintos. */
export function urlNorm(s) {
  if (!s) return null;
  try {
    const u = new URL(s);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    let ruta = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${ruta}${u.search}`;
  } catch { return null; }
}

/** Escapa un valor para CSV (separador ';' y neutralización de fórmulas de hoja de cálculo). */
export function celdaCsv(v) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function slug(s) { return normaliza(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }

export function recorta(s, n = 200) {
  if (s === null || s === undefined) return null;
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
