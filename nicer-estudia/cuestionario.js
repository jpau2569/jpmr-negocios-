/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — cuestionarios (tests)
   Autoevaluarse con preguntas de opción múltiple, no solo dar la vuelta
   a una tarjeta: obliga a decidir y da una nota, que es lo que de verdad
   dice si el tema está aprendido o solo leído.

   Se generan de dos maneras:
     · sin conexión, a partir de las tarjetas que ya tiene (las respuestas
       de las otras tarjetas hacen de opciones falsas)
     · con el Profe, que devuelve un test de un tema en un bloque [[TEST]]

   Funciones puras: el azar entra por parámetro para poder probarlas.
   ═══════════════════════════════════════════════════════════════════ */

import { id } from './utiles.js';

export const MIN_TARJETAS = 4;   // con menos no hay opciones falsas creíbles
export const MAX_OPCIONES = 4;

/** Baraja una copia (Fisher-Yates) sin tocar el original. */
export function baraja(lista, azar = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Test a partir de las tarjetas del alumno. Devuelve [] si no hay material
 * suficiente: es mejor no ofrecer test que ofrecer uno con dos opciones
 * evidentes.
 */
export function generaDesdeTarjetas(tarjetas, { cuantas = 8, asignaturaId = null, azar = Math.random } = {}) {
  const candidatas = (tarjetas || []).filter((t) => t.pregunta && t.respuesta);
  const propias = asignaturaId ? candidatas.filter((t) => t.asignaturaId === asignaturaId) : candidatas;
  const fuente = propias.length >= MIN_TARJETAS ? propias : candidatas;
  if (fuente.length < MIN_TARJETAS) return [];

  return baraja(fuente, azar).slice(0, cuantas).map((tarjeta) => {
    // Las opciones falsas salen de otras tarjetas: se parecen lo justo.
    const falsas = baraja(
      fuente
        .filter((t) => t.id !== tarjeta.id && t.respuesta !== tarjeta.respuesta)
        .map((t) => t.respuesta),
      azar
    );
    const unicas = [...new Set(falsas)].slice(0, MAX_OPCIONES - 1);
    const opciones = baraja([tarjeta.respuesta, ...unicas], azar);
    return {
      id: id('pr'),
      pregunta: tarjeta.pregunta,
      opciones,
      correcta: opciones.indexOf(tarjeta.respuesta),
      tarjetaId: tarjeta.id || null,
      asignaturaId: tarjeta.asignaturaId || null
    };
  });
}

/** Valida un test venido del Profe: si algo no cuadra, esa pregunta se cae. */
export function preguntasDeIA(brutas, asignaturaId = null) {
  return (Array.isArray(brutas) ? brutas : [])
    .map((p) => {
      const opciones = (Array.isArray(p?.opciones) ? p.opciones : [])
        .map((o) => String(o).trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, MAX_OPCIONES);
      const correcta = Number(p?.correcta);
      if (!p?.pregunta || opciones.length < 2) return null;
      if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) return null;
      return {
        id: id('pr'),
        pregunta: String(p.pregunta).trim().slice(0, 300),
        opciones,
        correcta,
        tarjetaId: null,
        asignaturaId
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

/** Corrige el test entero. `respuestas` es un array de índices (o null). */
export function corrige(preguntas, respuestas) {
  const total = preguntas.length || 1;
  const falladas = preguntas.filter((p, i) => respuestas[i] !== p.correcta);
  const aciertos = preguntas.length - falladas.length;
  return {
    aciertos,
    total: preguntas.length,
    nota: Math.round((aciertos / total) * 100) / 10,
    falladas
  };
}

/** Un comentario honesto de la nota: ni castigo ni falso ánimo. */
export function comentario({ nota, total }) {
  if (!total) return 'Sin preguntas.';
  if (nota >= 9) return '¡Te lo sabes! Repasa solo lo que fallaste y a otra cosa.';
  if (nota >= 7) return 'Bien. Con un repaso más de lo fallado, listo.';
  if (nota >= 5) return 'Aprobado justo. Esto pide otro repaso mañana.';
  if (nota >= 3) return 'Aún no está. No pasa nada: repásalo hoy y vuelve a intentarlo mañana.';
  return 'Esto está sin estudiar todavía. Empieza por leer el tema y hacer el esquema.';
}
