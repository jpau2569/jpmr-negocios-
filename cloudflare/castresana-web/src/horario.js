// ============================================================================
//  Horario de visitas y huecos libres — lógica pura (sin D1 ni red)
// ----------------------------------------------------------------------------
//  Todo se razona en HORA DE MADRID (Europe/Madrid), también el día del cambio
//  de hora: la conversión hora local → instante UTC usa Intl, que trae las
//  reglas oficiales, en vez de suponer un desfase fijo de +1 o +2.
//  Un hueco se identifica por su hora local 'AAAA-MM-DDTHH:MM' (la que ve el
//  cliente), y lleva además su instante UTC para medir la antelación.
// ============================================================================

export const ZONA = "Europe/Madrid";
export const HORARIO_POR_DEFECTO = "L-V 10:00-14:00 16:30-19:30; S 10:00-13:00";
export const POR_DEFECTO = { bloque: 30, antelacionHoras: 2, diasVista: 30 };

// Letras de los días en el orden de la semana española (lunes primero) y su
// número en getUTCDay() (0 = domingo).
const ORDEN = ["L", "M", "X", "J", "V", "S", "D"];
const NUM_DIA = { D: 0, L: 1, M: 2, X: 3, J: 4, V: 5, S: 6 };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

const dos = (n) => String(n).padStart(2, "0");
const aMin = (h) => { const m = RE_HORA.exec(h); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const deMin = (n) => `${dos(Math.floor(n / 60))}:${dos(n % 60)}`;

/** ¿Es una fecha de calendario real ('2026-02-30' no lo es)? */
export function esFecha(texto) {
  const m = RE_FECHA.exec(String(texto || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const esHora = (texto) => RE_HORA.test(String(texto || ""));

/** Separa 'AAAA-MM-DDTHH:MM' en { fecha, hora } o null. */
export function partesFechaHora(texto) {
  const m = RE_FECHA_HORA.exec(String(texto || ""));
  if (!m || !esFecha(m[1]) || !esHora(m[2])) return null;
  return { fecha: m[1], hora: m[2] };
}

/** Suma días a una fecha de calendario (sin horas, sin zona). */
export function sumaDias(fecha, n) {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}`;
}
export function diaSemana(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ---- Zona horaria ----------------------------------------------------------
const formato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Fecha y hora de Madrid de un instante (milisegundos UTC). */
export function enMadrid(ms) {
  const p = {};
  for (const { type, value } of formato.formatToParts(new Date(ms))) p[type] = value;
  const hora = p.hour === "24" ? "00" : p.hour;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${hora}:${p.minute}`, segundos: Number(p.second) };
}

/** Minutos que Madrid va por delante de UTC en ese instante (60 o 120). */
export function desfaseMinutos(ms) {
  const p = enMadrid(ms);
  const [y, m, d] = p.fecha.split("-").map(Number);
  const [h, mi] = p.hora.split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, h, mi, p.segundos);
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60000);
}

/**
 * Instante UTC (ms) de una hora de Madrid. Devuelve null si esa hora no
 * existe (el último domingo de marzo, de 2:00 a 2:59, el reloj salta a las 3:00).
 * Si existe dos veces (último domingo de octubre, de 2:00 a 2:59) da una de
 * ellas de forma estable; con el horario de oficina nunca ocurre.
 */
export function madridAUtc(fecha, hora) {
  if (!esFecha(fecha) || !esHora(hora)) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, h, mi);
  let t = local - desfaseMinutos(local) * 60000;
  t = local - desfaseMinutos(t) * 60000;
  const comprobado = enMadrid(t);
  return comprobado.fecha === fecha && comprobado.hora === hora ? t : null;
}

export const hoyEnMadrid = (ahoraMs) => enMadrid(ahoraMs).fecha;

// ---- Configuración ---------------------------------------------------------
/**
 * Lee el horario en texto: «L-V 10:00-14:00 16:30-19:30; S 10:00-13:00».
 * Devuelve { ok, dias: { 0..6: [[inicioMin, finMin], …] }, error }.
 */
export function leeHorario(texto) {
  const dias = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const trozos = String(texto || "").split(";").map((t) => t.trim()).filter(Boolean);
  if (!trozos.length) return { ok: false, dias, error: "El horario está vacío." };
  for (const trozo of trozos) {
    const m = /^([LMXJVSD](?:\s*-\s*[LMXJVSD])?(?:\s*,\s*[LMXJVSD](?:\s*-\s*[LMXJVSD])?)*)\s+(.+)$/i.exec(trozo);
    if (!m) return { ok: false, dias, error: `No entiendo «${trozo}». Ejemplo: «L-V 10:00-14:00 16:30-19:30».` };
    const letras = [];
    for (const parte of m[1].toUpperCase().split(",")) {
      const [a, b] = parte.split("-").map((x) => x.trim());
      const ia = ORDEN.indexOf(a), ib = b ? ORDEN.indexOf(b) : ia;
      if (ib < ia) return { ok: false, dias, error: `El rango de días «${parte.trim()}» va al revés.` };
      for (let i = ia; i <= ib; i++) letras.push(ORDEN[i]);
    }
    const tramos = [];
    for (const t of m[2].split(/[\s,]+/).filter(Boolean)) {
      const r = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(t);
      const ini = r ? aMin(r[1]) : NaN, fin = r ? aMin(r[2]) : NaN;
      if (!r || Number.isNaN(ini) || Number.isNaN(fin) || fin <= ini) {
        return { ok: false, dias, error: `El tramo «${t}» no es válido. Ejemplo: «10:00-14:00».` };
      }
      tramos.push([ini, fin]);
    }
    for (const l of letras) dias[NUM_DIA[l]].push(...tramos);
  }
  for (const k of Object.keys(dias)) dias[k].sort((a, b) => a[0] - b[0]);
  return { ok: true, dias, error: "" };
}

function numero(valor, porDefecto, min, max) {
  const n = Number(String(valor ?? "").replace(",", ".").trim());
  return String(valor ?? "").trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? n : porDefecto;
}

/**
 * Configuración de visitas a partir de las variables del Worker. Lo que esté
 * mal escrito se sustituye por el valor por defecto y se apunta en `avisos`
 * (el panel los enseña), para que una errata no deje la web sin huecos.
 */
export function configVisitas(env = {}) {
  const avisos = [];
  let horario = leeHorario(env.HORARIO ?? HORARIO_POR_DEFECTO);
  if (!horario.ok) {
    avisos.push(`HORARIO mal escrito (${horario.error}). Se usa el de por defecto: ${HORARIO_POR_DEFECTO}.`);
    horario = leeHorario(HORARIO_POR_DEFECTO);
  }
  const bloque = Math.round(numero(env.BLOQUE_MINUTOS, POR_DEFECTO.bloque, 10, 240));
  const antelacionHoras = numero(env.ANTELACION_HORAS, POR_DEFECTO.antelacionHoras, 0, 168);
  const diasVista = Math.round(numero(env.DIAS_VISTA, POR_DEFECTO.diasVista, 1, 120));
  for (const [nombre, valor, usado] of [["BLOQUE_MINUTOS", env.BLOQUE_MINUTOS, bloque], ["ANTELACION_HORAS", env.ANTELACION_HORAS, antelacionHoras], ["DIAS_VISTA", env.DIAS_VISTA, diasVista]]) {
    if (valor !== undefined && String(valor).trim() !== "" && Number(String(valor).replace(",", ".")) !== usado) {
      avisos.push(`${nombre} = «${valor}» no es válido. Se usa ${usado}.`);
    }
  }
  const festivos = new Set();
  for (const f of String(env.FESTIVOS || "").split(/[\s,;]+/).filter(Boolean)) {
    if (esFecha(f)) festivos.add(f);
    else avisos.push(`FESTIVOS: «${f}» no es una fecha AAAA-MM-DD. Se ignora.`);
  }
  return { dias: horario.dias, bloque, antelacionMs: antelacionHoras * 3600000, diasVista, festivos, avisos };
}

// ---- Huecos ----------------------------------------------------------------
/** Todos los huecos teóricos de un día según el horario (sin mirar reservas). */
export function huecosDelDia(fecha, cfg) {
  if (!esFecha(fecha) || cfg.festivos.has(fecha)) return [];
  const salida = [];
  for (const [ini, fin] of cfg.dias[diaSemana(fecha)] || []) {
    for (let t = ini; t + cfg.bloque <= fin; t += cfg.bloque) {
      const hora = deMin(t);
      const utc = madridAUtc(fecha, hora);
      if (utc === null) continue; // hora que no existe por el cambio de hora
      salida.push({ fecha, hora, fechaHora: `${fecha}T${hora}`, utc });
    }
  }
  return salida;
}

/** ¿Está bloqueado ese hueco? bloqueos: [{ fecha, hora }] con hora '' = día entero. */
export function estaBloqueado(fecha, hora, bloqueos = []) {
  return bloqueos.some((b) => b.fecha === fecha && (b.hora === "" || b.hora === hora));
}

/**
 * ¿Respeta la antelación mínima y los días vista? Los días vista se cuentan
 * por calendario de Madrid: con 30, se puede reservar hasta el día hoy + 30
 * incluido, a cualquier hora del horario.
 */
export function dentroDePlazo(hueco, ahoraMs, cfg) {
  return hueco.utc - ahoraMs >= cfg.antelacionMs && hueco.fecha <= sumaDias(hoyEnMadrid(ahoraMs), cfg.diasVista);
}

/**
 * Huecos libres de un día: dentro de plazo, sin reserva activa y sin bloqueo.
 * ocupados: Set de 'AAAA-MM-DDTHH:MM'.
 */
export function huecosLibres(fecha, { ahoraMs, cfg, ocupados = new Set(), bloqueos = [] }) {
  return huecosDelDia(fecha, cfg).filter((h) =>
    dentroDePlazo(h, ahoraMs, cfg) && !ocupados.has(h.fechaHora) && !estaBloqueado(h.fecha, h.hora, bloqueos));
}

/** Días (de hoy a hoy + diasVista) que tienen al menos un hueco libre. */
export function diasConHuecos({ ahoraMs, cfg, ocupados = new Set(), bloqueos = [] }) {
  const hoy = hoyEnMadrid(ahoraMs);
  const salida = [];
  for (let i = 0; i <= cfg.diasVista; i++) {
    const fecha = sumaDias(hoy, i);
    const libres = huecosLibres(fecha, { ahoraMs, cfg, ocupados, bloqueos }).length;
    if (libres) salida.push({ fecha, libres, etiqueta: etiquetaCorta(fecha) });
  }
  return salida;
}

/**
 * Comprueba en el servidor el hueco que pide el cliente (nunca nos fiamos del
 * formulario). Devuelve { ok, fecha, hora, utc, motivo }.
 */
export function compruebaHueco(fechaHora, { ahoraMs, cfg, bloqueos = [] }) {
  const p = partesFechaHora(fechaHora);
  if (!p) return { ok: false, motivo: "La fecha u hora no es válida." };
  const hueco = huecosDelDia(p.fecha, cfg).find((h) => h.hora === p.hora);
  if (!hueco) return { ok: false, motivo: "Esa hora no está dentro del horario de visitas." };
  if (hueco.utc - ahoraMs < cfg.antelacionMs) return { ok: false, motivo: "Esa hora ya no se puede reservar: hace falta más antelación." };
  if (!dentroDePlazo(hueco, ahoraMs, cfg)) return { ok: false, motivo: `Solo se puede reservar con ${cfg.diasVista} días de antelación como mucho.` };
  if (estaBloqueado(p.fecha, p.hora, bloqueos)) return { ok: false, motivo: "Esa hora no está disponible." };
  return { ok: true, fecha: p.fecha, hora: p.hora, utc: hueco.utc, motivo: "" };
}

/**
 * ¿Se puede bloquear esa hora? Solo si es uno de los huecos de ese día según
 * el horario: un bloqueo a las 10:15 con bloques de 30 minutos (o a las 15:00,
 * fuera del horario) no taparía nada y Pau creería que sí. Sin hora (día
 * entero) siempre vale. Devuelve { ok, motivo }.
 */
export function compruebaHoraBloqueo(fecha, hora, cfg) {
  if (!hora) return { ok: true, motivo: "" };
  const huecos = huecosDelDia(fecha, cfg);
  if (huecos.some((h) => h.hora === hora)) return { ok: true, motivo: "" };
  if (!huecos.length) {
    return { ok: false, motivo: `El ${etiquetaLarga(fecha)} no hay visitas según el horario, así que no hace falta bloquear las ${hora}. Si quieres, deja la hora vacía para bloquear el día entero.` };
  }
  const lista = huecos.map((h) => h.hora).join(", ");
  return { ok: false, motivo: `Las ${hora} no es una hora de visita del ${etiquetaLarga(fecha)}. Las horas de ese día son: ${lista}. Elige una de ellas o deja la hora vacía para bloquear el día entero.` };
}

// ---- Textos de fechas ------------------------------------------------------
export function etiquetaLarga(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]} de ${y}`;
}
export function etiquetaCorta(fecha) {
  const [, m, d] = fecha.split("-").map(Number);
  return `${DIAS_CORTOS[diaSemana(fecha)]} ${d} ${MESES_CORTOS[m - 1]}`;
}
