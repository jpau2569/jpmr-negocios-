/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — bloques de estudio
   Una sesión de concentración (30 min) se parte en bloques (15 min) y en
   cada uno toca una asignatura distinta: cambiar de tema a mitad cuesta
   menos que aguantar media hora con lo mismo, y se reparte el esfuerzo.

   Qué toca sale de SU día, en este orden:
     1. examen en los próximos 7 días (cuanto más cerca, antes)
     2. deberes para hoy o mañana (o atrasados)
     3. lo que tiene mañana en el horario (preparar la clase)
     4. lo que ha tenido hoy (repasar en caliente)
     5. tarjetas de repaso pendientes de esa asignatura
   Tutoría, Atención educativa y Educación Física no se "estudian" en
   casa: no entran salvo que tengan examen o deberes apuntados.

   Función pura: entra el estado y el día, sale el plan. Se prueba en Node.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, sumaDias, diasEntre, diaSemana, normalizaTexto } from './utiles.js';

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const NO_SE_ESTUDIAN = ['tutoria', 'atencion educativa', 'educacion fisica', 'religion', 'valores'];

export const esEstudiable = (nombre) => {
  const n = normalizaTexto(nombre || '');
  return !NO_SE_ESTUDIAN.some((x) => n.startsWith(x));
};

const cuando = (dias, iso) => (dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : dias === 2 ? 'pasado mañana'
  : `el ${DIAS_NOMBRE[new Date(`${iso}T12:00:00`).getDay()]}`);

/** El día de clase siguiente (salta fin de semana: el viernes, «mañana» es el lunes). */
function siguienteDiaDeClase(estado, hoy) {
  for (let i = 1; i <= 7; i++) {
    const dia = sumaDias(hoy, i);
    if ((estado.horario?.[diaSemana(dia)] || []).length) return dia;
  }
  return sumaDias(hoy, 1);
}

/** Candidatas ordenadas: [{ asignaturaId, nombre, puntos, motivo, accion, leccionId }]. */
export function candidatas(estado, hoy = aISO()) {
  const porId = new Map();
  const nombre = (id) => (estado.asignaturas || []).find((a) => a.id === id)?.nombre || '';
  const suma = (id, puntos, motivo, accion, extra = {}) => {
    if (!id || !nombre(id)) return;
    const c = porId.get(id) || { asignaturaId: id, nombre: nombre(id), puntos: 0, motivos: [] };
    c.puntos += puntos;
    c.motivos.push({ puntos, motivo, accion, ...extra });
    porId.set(id, c);
  };

  // 1. Exámenes cercanos.
  for (const e of estado.examenes || []) {
    const dias = diasEntre(hoy, e.fecha);
    if (dias < 0 || dias > 7) continue;
    const leccion = (estado.lecciones || []).find((l) => (e.leccionIds || []).includes(l.id) && l.material?.minitest?.length);
    suma(e.asignaturaId, 120 - dias * 12, `Examen ${cuando(dias, e.fecha)}: ${e.titulo}`,
      leccion ? `Haz el mini test de «${leccion.titulo}» y repasa lo que falles`
        : dias <= 1 ? 'Repaso final: esquema y lo que más te cuesta' : 'Repasa los apuntes del examen y hazte preguntas',
      leccion ? { leccionId: leccion.id } : {});
  }
  // 2. Deberes pendientes para hoy o mañana (o atrasados).
  for (const t of estado.tareas || []) {
    if (t.hecha) continue;
    const dias = diasEntre(hoy, t.para);
    if (dias > 1) continue;
    suma(t.asignaturaId, dias < 0 ? 90 : 70 - dias * 10,
      dias < 0 ? `Atrasado: ${t.titulo}` : `Para ${cuando(dias, t.para)}: ${t.titulo}`, `Haz: ${t.titulo}`);
  }
  // 3 y 4. Horario: lo de mañana (preparar) y lo de hoy (repasar).
  const manana = siguienteDiaDeClase(estado, hoy);
  for (const c of estado.horario?.[diaSemana(manana)] || []) {
    if (esEstudiable(nombre(c.asignaturaId))) {
      suma(c.asignaturaId, 30, `${cuando(diasEntre(hoy, manana), manana) === 'mañana' ? 'Mañana' : `El ${DIAS_NOMBRE[new Date(`${manana}T12:00:00`).getDay()]}`} tienes clase`,
        'Lee lo último que disteis y apunta tus dudas para clase');
    }
  }
  for (const c of estado.horario?.[diaSemana(hoy)] || []) {
    if (esEstudiable(nombre(c.asignaturaId))) suma(c.asignaturaId, 22, 'Hoy has tenido clase', 'Repasa lo que habéis dado hoy en 3 ideas');
  }
  // 5. Tarjetas pendientes.
  const pendientesPor = new Map();
  for (const t of estado.tarjetas || []) {
    if (t.asignaturaId && diasEntre(hoy, t.proximo) <= 0) pendientesPor.set(t.asignaturaId, (pendientesPor.get(t.asignaturaId) || 0) + 1);
  }
  for (const [id, n] of pendientesPor) suma(id, Math.min(25, n * 3), `${n} tarjeta${n === 1 ? '' : 's'} para repasar`, 'Repasa sus tarjetas');

  return [...porId.values()]
    .filter((c) => esEstudiable(c.nombre) || c.motivos.some((m) => m.puntos >= 60))
    .map((c) => {
      const principal = [...c.motivos].sort((a, b) => b.puntos - a.puntos)[0];
      return { asignaturaId: c.asignaturaId, nombre: c.nombre, puntos: c.puntos,
        motivo: principal.motivo, accion: principal.accion, leccionId: principal.leccionId || null };
    })
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
}

/**
 * Plan de la sesión: un bloque por cada `bloque` minutos.
 * Nunca dos bloques seguidos de lo mismo si hay alternativa. Sin nada que
 * proponer (sin horario, deberes ni exámenes), devuelve [] y la sesión es libre.
 * `salta` deja fuera asignaturas (el botón «Cambiar»).
 */
export function planDeBloques(estado, hoy = aISO(), { minutos = 30, bloque = 15, salta = [] } = {}) {
  if (!bloque || bloque >= minutos) return [];
  const lista = candidatas(estado, hoy).filter((c) => !salta.includes(c.asignaturaId));
  if (!lista.length) return [];
  const n = Math.ceil(minutos / bloque);
  const plan = [];
  for (let i = 0; i < n; i++) {
    const previa = plan[i - 1]?.asignaturaId;
    const c = lista.find((x) => x.asignaturaId !== previa && !plan.some((p) => p.asignaturaId === x.asignaturaId))
      || lista.find((x) => x.asignaturaId !== previa) || lista[0];
    plan.push({ ...c, inicio: i * bloque, fin: Math.min(minutos, (i + 1) * bloque) });
  }
  return plan;
}

/** Siguiente candidata para cambiar un bloque que no le apetece o no puede hacer. */
export function alternativa(estado, hoy, plan, indice) {
  const usadas = new Set(plan.map((p) => p.asignaturaId));
  const vecinas = [plan[indice - 1]?.asignaturaId, plan[indice + 1]?.asignaturaId];
  const lista = candidatas(estado, hoy);
  return lista.find((c) => !usadas.has(c.asignaturaId))
    || lista.find((c) => c.asignaturaId !== plan[indice].asignaturaId && !vecinas.includes(c.asignaturaId))
    || null;
}
