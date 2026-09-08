/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — motor de estudio
   Tres ideas con evidencia detrás, traducidas a código:
     · recuerdo activo  → tarjetas pregunta/respuesta
     · repaso espaciado → cajas de Leitner con intervalos crecientes
     · práctica repartida → plan de examen en varios días, no una noche
   Funciones puras: se pueden probar en Node sin navegador.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, sumaDias, diasEntre, limita, plural } from './utiles.js';

/* Días hasta el siguiente repaso según la caja. Una tarjeta nueva se repasa
   el mismo día; a partir de ahí 1, 2, 4, 8, 16 y 32 días. Cada acierto sube
   una caja; un fallo devuelve a la 1 (no a la 0: ya la había visto). */
export const INTERVALOS = [0, 1, 2, 4, 8, 16, 32];
export const CAJA_MAX = INTERVALOS.length - 1;

export function nuevaTarjeta({ pregunta, respuesta, asignaturaId = null, origen = 'mano' }, hoy = aISO()) {
  return {
    pregunta: String(pregunta || '').trim(),
    respuesta: String(respuesta || '').trim(),
    asignaturaId,
    caja: 0,
    proximo: hoy,
    aciertos: 0,
    fallos: 0,
    origen,
    creada: hoy
  };
}

/** Devuelve una tarjeta nueva con el resultado aplicado (no muta la original). */
export function repasada(tarjeta, acierto, hoy = aISO()) {
  const caja = acierto ? Math.min(CAJA_MAX, (tarjeta.caja || 0) + 1) : 1;
  return {
    ...tarjeta,
    caja,
    proximo: sumaDias(hoy, INTERVALOS[caja]),
    aciertos: (tarjeta.aciertos || 0) + (acierto ? 1 : 0),
    fallos: (tarjeta.fallos || 0) + (acierto ? 0 : 1)
  };
}

export const tocaHoy = (tarjeta, hoy = aISO()) => diasEntre(hoy, tarjeta.proximo) <= 0;

/** Cola de repaso del día: primero lo más atrasado, luego lo peor sabido.
    Con tope, porque una lista infinita de tarjetas es la mejor forma de que
    un chaval de 12 años cierre la app y no vuelva. */
export function colaDeHoy(tarjetas, hoy = aISO(), tope = 20, asignaturaId = null) {
  return (tarjetas || [])
    .filter((t) => tocaHoy(t, hoy))
    .filter((t) => !asignaturaId || t.asignaturaId === asignaturaId)
    .sort((a, b) =>
      a.proximo.localeCompare(b.proximo)
      || (a.caja || 0) - (b.caja || 0)
      || (b.fallos || 0) - (a.fallos || 0))
    .slice(0, Math.max(1, tope));
}

/** Cuántas tarjetas van a caer cada día de la próxima semana. Sirve para
    avisar de un atasco antes de que llegue. */
export function previsionRepaso(tarjetas, hoy = aISO(), dias = 7) {
  const salida = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumaDias(hoy, i);
    const cuantas = (tarjetas || []).filter((t) =>
      i === 0 ? diasEntre(hoy, t.proximo) <= 0 : t.proximo === fecha).length;
    salida.push({ fecha, cuantas });
  }
  return salida;
}

/* ── Plan de examen ─────────────────────────────────────────────────
   Repartir el estudio en varias sesiones cortas rinde mucho más que una
   noche entera. El plan se calcula desde hoy hasta el día del examen. */
const HITOS = [
  { dias: 7, foco: 'Lectura y esquema', detalle: 'Lee el tema entero y haz un esquema de una hoja. Sin memorizar todavía.' },
  { dias: 5, foco: 'Tarjetas', detalle: 'Convierte el esquema en tarjetas de pregunta y respuesta.' },
  { dias: 3, foco: 'Primer repaso', detalle: 'Repasa las tarjetas y marca las que fallas. Haz ejercicios del tema.' },
  { dias: 1, foco: 'Repaso de lo que fallas', detalle: 'Solo las tarjetas falladas y un simulacro rápido. Dormir bien.' },
  { dias: 0, foco: 'Día del examen', detalle: 'Vistazo de 10 minutos al esquema. Nada nuevo.' }
];

export function planExamen(examen, hoy = aISO()) {
  const faltan = diasEntre(hoy, examen.fecha);
  if (faltan < 0) return [];
  // Con poco margen se comprimen los hitos para que siempre haya un plan real.
  const usados = HITOS.filter((h) => h.dias <= faltan);
  const hitos = usados.length >= 2 ? usados : HITOS.slice(-Math.min(HITOS.length, faltan + 1));
  return hitos.map((h) => ({
    fecha: sumaDias(examen.fecha, -h.dias),
    dias: h.dias,
    foco: h.foco,
    detalle: h.detalle,
    hecho: diasEntre(hoy, sumaDias(examen.fecha, -h.dias)) < 0
  }));
}

/** El hito de hoy (o el más cercano por delante) de un examen. */
export function focoDeHoy(examen, hoy = aISO()) {
  const plan = planExamen(examen, hoy);
  return plan.find((p) => diasEntre(hoy, p.fecha) >= 0) || null;
}

/* ── Racha y puntos ─────────────────────────────────────────────────
   La motivación de un chaval no es la nota de junio: es no romper la racha.
   Cuenta un día en el que estudia al menos 10 minutos o repasa tarjetas. */
export const MINIMO_RACHA = 10;

export function actualizaRacha(racha, hoy = aISO()) {
  const previo = racha?.ultimoDia || null;
  if (previo === hoy) return { ...racha };
  const dias = previo && diasEntre(previo, hoy) === 1 ? (racha.dias || 0) + 1 : 1;
  return { dias, mejor: Math.max(racha?.mejor || 0, dias), ultimoDia: hoy };
}

/** Si se saltó un día, la racha ya está rota aunque nadie haya abierto la app. */
export function rachaVigente(racha, hoy = aISO()) {
  if (!racha?.ultimoDia) return 0;
  const dif = diasEntre(racha.ultimoDia, hoy);
  return dif <= 1 ? (racha.dias || 0) : 0;
}

export const NIVELES = [
  { desde: 0, nombre: 'Empezando' },
  { desde: 150, nombre: 'Constante' },
  { desde: 400, nombre: 'En racha' },
  { desde: 900, nombre: 'Máquina' },
  { desde: 1800, nombre: 'Imparable' },
  { desde: 3500, nombre: 'Leyenda del Lastra' }
];

/** Puntos: el tiempo cuenta, pero lo que más suma es terminar cosas. */
export function puntos(estado) {
  const minutos = (estado.sesiones || []).reduce((t, s) => t + s.minutos, 0);
  const tareas = (estado.tareas || []).filter((t) => t.hecha).length;
  const repasos = (estado.tarjetas || []).reduce((t, c) => t + (c.aciertos || 0), 0);
  return Math.round(minutos * 0.5 + tareas * 10 + repasos * 2);
}

export function nivel(total) {
  const actual = [...NIVELES].reverse().find((n) => total >= n.desde) || NIVELES[0];
  const siguiente = NIVELES.find((n) => n.desde > total) || null;
  const suelo = actual.desde;
  const techo = siguiente ? siguiente.desde : suelo + 1;
  return {
    nombre: actual.nombre,
    siguiente: siguiente?.nombre || null,
    faltan: siguiente ? siguiente.desde - total : 0,
    progreso: siguiente ? limita((total - suelo) / (techo - suelo), 0, 1) : 1
  };
}

/* ── Parte semanal ──────────────────────────────────────────────────
   Resumen honesto de la semana para enseñárselo a papá sin discutir. */
export function parteSemanal(estado, hoy = aISO()) {
  const desde = sumaDias(hoy, -6);
  const enRango = (iso) => iso >= desde && iso <= hoy;

  const minutos = (estado.sesiones || [])
    .filter((s) => enRango(s.fecha))
    .reduce((t, s) => t + s.minutos, 0);
  const tareasHechas = (estado.tareas || []).filter((t) => t.hecha && enRango(t.hechaEl || '')).length;
  const pendientes = (estado.tareas || []).filter((t) => !t.hecha).length;
  const atrasadas = (estado.tareas || []).filter((t) => !t.hecha && diasEntre(hoy, t.para) < 0).length;
  const diasActivos = new Set((estado.sesiones || [])
    .filter((s) => enRango(s.fecha) && s.minutos > 0).map((s) => s.fecha)).size;
  const repasos = (estado.tarjetas || []).filter((c) => enRango(c.creada)).length;
  const examenes = (estado.examenes || [])
    .filter((e) => diasEntre(hoy, e.fecha) >= 0 && diasEntre(hoy, e.fecha) <= 14);

  return { desde, hasta: hoy, minutos, diasActivos, tareasHechas, pendientes, atrasadas, tarjetasNuevas: repasos, examenes };
}

/* ── Qué toca ahora ─────────────────────────────────────────────────
   El corazón de la pantalla "Hoy": una lista corta y ordenada. Primero lo
   que se entrega antes, después el examen más cercano, después el repaso.
   Nunca más de cinco cosas: una lista larga no se empieza. */
export function planDelDia({ tareas, examenes, tarjetasHoy, minutosHechos, objetivo }, hoy = aISO()) {
  const bloques = [];

  for (const t of tareas.filter((x) => x.dias < 0).slice(0, 2)) {
    bloques.push({ tipo: 'atrasada', titulo: t.titulo, ref: t.id, aviso: 'Se entregaba ya', prioridad: 0 });
  }
  for (const t of tareas.filter((x) => x.dias === 0).slice(0, 3)) {
    bloques.push({ tipo: 'tarea', titulo: t.titulo, ref: t.id, aviso: 'Para hoy', prioridad: 1 });
  }
  const examen = examenes[0];
  if (examen) {
    const foco = focoDeHoy(examen, hoy);
    if (foco && diasEntre(hoy, foco.fecha) === 0) {
      bloques.push({ tipo: 'examen', titulo: `${examen.titulo}: ${foco.foco}`, ref: examen.id, aviso: foco.detalle, prioridad: 1 });
    } else if (examen.dias <= 3) {
      bloques.push({ tipo: 'examen', titulo: `Repasar ${examen.titulo}`, ref: examen.id, aviso: `Examen ${examen.dias === 1 ? 'mañana' : `en ${examen.dias} días`}`, prioridad: 2 });
    }
  }
  if (tarjetasHoy > 0) {
    bloques.push({ tipo: 'repaso', titulo: `Repasar ${plural(tarjetasHoy, 'tarjeta', 'tarjetas')}`, ref: null, aviso: 'Cinco minutos y listo', prioridad: 3 });
  }
  if (minutosHechos < objetivo && bloques.length === 0) {
    bloques.push({ tipo: 'libre', titulo: 'Adelanta algo del próximo examen', ref: null, aviso: 'No hay nada urgente hoy', prioridad: 4 });
  }
  return bloques.sort((a, b) => a.prioridad - b.prioridad).slice(0, 5);
}
