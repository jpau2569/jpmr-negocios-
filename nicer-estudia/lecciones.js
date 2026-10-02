/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — lecciones
   Nicer mete la lección que está estudiando (escrita, pegada o con fotos
   de las páginas del libro), Clara le hace el resumen y los apuntes, y de
   ahí sale todo lo demás sin volver a gastar internet: las tarjetas salen
   de los conceptos clave, el esquema de los apuntes, y el examen de prueba
   de las lecciones que entran en cada examen.

   Funciones puras: entra la lección, sale el material. Se prueban en Node.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, recorta } from './utiles.js';
import { nuevaTarjeta } from './repaso.js';
import { preguntasDeIA } from './cuestionario.js';

export const MAX_TEXTO_LECCION = 30000;   // un tema entero de libro pegado
export const MAX_FOTOS_LECCION = 6;       // páginas por lección (límite de 4,5 MB de Vercel)
export const MAX_CONTENIDO_EXAMEN = 15000;

const texto = (v, largo) => (typeof v === 'string' ? v.trim().slice(0, largo) : '');
const lista = (v) => (Array.isArray(v) ? v : []);

/** Lo que devuelve Clara al resumir una lección, limpio y acotado. */
export function leccionDeIA(bruto) {
  const resumen = texto(bruto?.resumen, 2500);
  const apuntes = lista(bruto?.apuntes)
    .map((s) => ({
      titulo: texto(s?.titulo, 100),
      puntos: lista(s?.puntos).map((p) => texto(p, 300)).filter(Boolean).slice(0, 8)
    }))
    .filter((s) => s.titulo && s.puntos.length)
    .slice(0, 10);
  const conceptos = lista(bruto?.conceptos)
    .map((c) => ({ termino: texto(c?.termino, 120), definicion: texto(c?.definicion, 400) }))
    .filter((c) => c.termino && c.definicion)
    .slice(0, 15);
  if (!resumen && !apuntes.length) return null;
  return { resumen, apuntes, conceptos };
}

/** Las tarjetas salen de los conceptos clave: término → definición. */
export function tarjetasDeLeccion(leccion, hoy = aISO(), idioma = 'es') {
  return lista(leccion?.conceptos).map((c) => ({
    ...nuevaTarjeta({
      pregunta: idioma === 'en' ? `What is «${c.termino}»?` : `¿Qué es «${c.termino}»?`,
      respuesta: c.definicion,
      asignaturaId: leccion.asignaturaId || null,
      origen: 'ia'
    }, hoy),
    idioma
  }));
}

/** El esquema sale de los apuntes: cada apartado es una rama. */
export function esquemaDeLeccion(leccion) {
  const ramas = lista(leccion?.apuntes).slice(0, 6).map((s) => ({
    titulo: recorta(s.titulo, 60),
    puntos: s.puntos.slice(0, 4).map((p) => recorta(p, 90))
  }));
  if (!ramas.length) return null;
  return { titulo: recorta(leccion.titulo || 'Lección', 80), ramas };
}

/** Texto de estudio de una lección: lo que Clara lee para examinar. Si aún
    no está resumida, vale el texto original. */
export function textoDeLeccion(leccion) {
  const partes = [`## ${leccion.titulo}`];
  if (leccion.resumen) partes.push(`Resumen: ${leccion.resumen}`);
  for (const s of lista(leccion.apuntes)) partes.push(`### ${s.titulo}\n- ${s.puntos.join('\n- ')}`);
  if (lista(leccion.conceptos).length) {
    partes.push('Conceptos: ' + leccion.conceptos.map((c) => `${c.termino}: ${c.definicion}`).join(' | '));
  }
  if (!leccion.resumen && !lista(leccion.apuntes).length && leccion.texto) partes.push(leccion.texto);
  return partes.join('\n');
}

/** Todo lo que entra en un examen, recortado para que quepa en la petición
    pero repartido entre lecciones: si no, la última se quedaba fuera. */
export function contenidoDeLecciones(lecciones, maximo = MAX_CONTENIDO_EXAMEN) {
  const bloques = lista(lecciones).map(textoDeLeccion);
  if (!bloques.length) return '';
  const cupo = Math.floor(maximo / bloques.length);
  return bloques.map((b) => (b.length > cupo ? b.slice(0, cupo - 1) + '…' : b)).join('\n\n');
}

/** Las lecciones de un examen: las que eligió; si no eligió ninguna, las de
    la misma asignatura que ya están resumidas. */
export function leccionesDeExamen(estado, examen) {
  const todas = lista(estado?.lecciones);
  const elegidas = lista(examen?.leccionIds).map((id) => todas.find((l) => l.id === id)).filter(Boolean);
  if (elegidas.length) return elegidas;
  return examen?.asignaturaId
    ? todas.filter((l) => l.asignaturaId === examen.asignaturaId && (l.resumen || l.apuntes?.length))
    : [];
}

/* ── Examen de prueba ─────────────────────────────────────────────
   Como uno de verdad de 2º de ESO: una parte tipo test (se corrige sola)
   y dos o tres preguntas de desarrollo que corrige Clara con criterios. */

export function examenDeIA(bruto, asignaturaId = null) {
  const test = preguntasDeIA(bruto?.test, asignaturaId);
  const desarrollo = lista(bruto?.desarrollo)
    .map((p) => ({
      pregunta: texto(p?.pregunta, 400),
      criterios: texto(p?.criterios, 800),
      puntos: Math.min(4, Math.max(1, Number(p?.puntos) || 2))
    }))
    .filter((p) => p.pregunta)
    .slice(0, 4);
  if (!test.length && !desarrollo.length) return null;
  return { titulo: texto(bruto?.titulo, 120) || 'Examen de prueba', test, desarrollo };
}

/** Corrección de Clara para el desarrollo, validada. */
export function correccionDeIA(bruto, cuantas) {
  const lista2 = lista(bruto?.correcciones).slice(0, cuantas).map((c) => ({
    nota: Math.min(10, Math.max(0, Math.round((Number(c?.nota) || 0) * 10) / 10)),
    bien: texto(c?.bien, 400),
    mejorar: texto(c?.mejorar, 400),
    modelo: texto(c?.modelo, 600)
  }));
  return lista2.length === cuantas ? lista2 : null;
}

/**
 * Nota final sobre 10. Cada pregunta tipo test vale 1 punto y cada una de
 * desarrollo lo que diga su campo `puntos` (2 por defecto), como en un
 * examen real donde lo de desarrollar pesa más.
 */
export function notaFinal({ aciertos = 0, total = 0 } = {}, desarrollo = [], notasDesarrollo = []) {
  const pesoDes = desarrollo.reduce((t, p) => t + (p.puntos || 2), 0);
  const logradoDes = desarrollo.reduce((t, p, i) => t + ((notasDesarrollo[i] ?? 0) / 10) * (p.puntos || 2), 0);
  const maximo = total + pesoDes;
  if (!maximo) return 0;
  return Math.round(((aciertos + logradoDes) / maximo) * 100) / 10;
}

/* ── Material de estudio ──────────────────────────────────────────
   Clara lo prepara una vez por lección (en dos mitades: teoría y
   práctica) y se guarda en la propia lección, así que después se lee,
   se hace el mini test y se descarga la ficha sin internet. */

const ICONO = /^[\p{Extended_Pictographic}\u200D\uFE0F]{1,8}$/u;

/** Normaliza el material (venga de Clara o de una copia). null si está vacío. */
export function normalizaMaterial(bruto) {
  if (!bruto || typeof bruto !== 'object') return null;
  const explicacion = lista(bruto.explicacion)
    .map((a) => ({ titulo: texto(a?.titulo, 100), texto: texto(a?.texto, 1500) }))
    .filter((a) => a.texto)
    .slice(0, 6);
  const inf = bruto.infografia && typeof bruto.infografia === 'object' ? bruto.infografia : null;
  const bloques = lista(inf?.bloques)
    .map((b) => {
      const icono = texto(b?.icono, 12);
      return {
        icono: ICONO.test(icono) ? icono : '',
        titulo: texto(b?.titulo, 60),
        puntos: lista(b?.puntos).map((x) => texto(x, 120)).filter(Boolean).slice(0, 4)
      };
    })
    .filter((b) => b.titulo && b.puntos.length)
    .slice(0, 6);
  const infografia = bloques.length ? {
    titulo: texto(inf?.titulo, 100),
    idea: texto(inf?.idea, 240),
    bloques,
    datos: lista(inf?.datos)
      .map((d) => ({ valor: texto(d?.valor, 40), etiqueta: texto(d?.etiqueta, 80) }))
      .filter((d) => d.valor && d.etiqueta)
      .slice(0, 4),
    recuerda: texto(inf?.recuerda, 240)
  } : null;
  const ejemplos = lista(bruto.ejemplos)
    .map((e) => ({
      enunciado: texto(e?.enunciado, 600),
      pasos: lista(e?.pasos).map((x) => texto(x, 300)).filter(Boolean).slice(0, 6),
      solucion: texto(e?.solucion, 400)
    }))
    .filter((e) => e.enunciado && (e.pasos.length || e.solucion))
    .slice(0, 4);
  const ejercicios = lista(bruto.ejercicios)
    .map((e) => ({ enunciado: texto(e?.enunciado, 600), pista: texto(e?.pista, 200), solucion: texto(e?.solucion, 800) }))
    .filter((e) => e.enunciado && e.solucion)
    .slice(0, 8);
  const minitest = preguntasDeIA(bruto.minitest).slice(0, 10)
    .map(({ pregunta, opciones, correcta, explicacion: porque }) => ({ pregunta, opciones, correcta, explicacion: porque || '' }));
  if (!explicacion.length && !infografia && !ejemplos.length && !ejercicios.length && !minitest.length) return null;
  return {
    explicacion, infografia, ejemplos, ejercicios, minitest,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(bruto.fecha || '') ? bruto.fecha : aISO()
  };
}

/** Junta las dos mitades que devuelve Clara. Si solo llega una, vale igual. */
export function materialDeIA(teoria, practica, hoy = aISO()) {
  return normalizaMaterial({ ...(teoria || {}), ...(practica || {}), fecha: hoy });
}

/** ¿Qué trae el material? Para los botones y la ficha. */
export function resumenMaterial(m) {
  return {
    explicacion: m?.explicacion?.length || 0,
    infografia: m?.infografia ? 1 : 0,
    ejemplos: m?.ejemplos?.length || 0,
    ejercicios: m?.ejercicios?.length || 0,
    minitest: m?.minitest?.length || 0
  };
}

/** Preguntas del mini test de una lección, listas para el test de la app. */
export function minitestDeLeccion(leccion) {
  return preguntasDeIA(leccion?.material?.minitest, leccion?.asignaturaId || null);
}

/* ── Mini test del día ────────────────────────────────────────────
   Cada día un mini test distinto, pero el MISMO durante todo el día (así
   la ficha en PDF coincide con lo que hace en la app). Sale de los mini
   tests de sus lecciones, primero las de exámenes cercanos y las últimas
   que ha metido. Sin internet. */

function semilla(textoSemilla) {
  let h = 2166136261;
  for (const c of String(textoSemilla)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MIN_MINITEST = 4;

export function miniTestDelDia(estado, hoy = aISO(), cuantas = 8) {
  const azar = semilla(hoy);
  const lecciones = lista(estado?.lecciones).filter((l) => l.material?.minitest?.length);
  const enExamen = new Set();
  for (const e of lista(estado?.examenes)) {
    if (!e?.fecha || e.fecha < hoy) continue;
    const dias = (Date.parse(e.fecha) - Date.parse(hoy)) / 86400000;
    if (dias > 14) continue;
    for (const l of leccionesDeExamen(estado, e)) enExamen.add(l.id);
  }
  const orden = [...lecciones].sort((a, b) =>
    (enExamen.has(b.id) - enExamen.has(a.id)) || String(b.fecha).localeCompare(String(a.fecha)));
  const elegidas = orden.slice(0, 4);
  const bolsa = [];
  for (const l of elegidas) {
    const propias = minitestDeLeccion(l).map((p) => ({ ...p, leccionId: l.id }));
    for (let i = propias.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [propias[i], propias[j]] = [propias[j], propias[i]];
    }
    bolsa.push(propias);
  }
  // Repartidas entre lecciones: una de cada, por turnos.
  const preguntas = [];
  for (let ronda = 0; preguntas.length < cuantas && bolsa.some((b) => b.length); ronda++) {
    for (const b of bolsa) if (b.length && preguntas.length < cuantas) preguntas.push(b.shift());
  }
  return {
    titulo: `Mini test del ${hoy.split('-').reverse().join('/')}`,
    preguntas,
    lecciones: elegidas.map((l) => l.titulo)
  };
}
