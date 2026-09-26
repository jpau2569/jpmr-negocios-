/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — operaciones: de la reserva a la notaría
   Cada venta o alquiler es una tarjeta que avanza por fases, con su
   lista de papeles, sus fechas clave (que van al calendario del móvil)
   y mensajes ya redactados para cada parte.
   Los datos de dominio (fases, papeles, plazos, mensajes) viven en
   operaciones-datos.js, verificados con fuentes. Aquí solo la lógica.
   Funciones puras.
   ═══════════════════════════════════════════════════════════════════ */

import { DATOS_OPERACIONES } from './operaciones-datos.js';
import { aISO, diasEntre, esHora, esISO, rellena, sumaDias, sumaDiasHabiles } from './utiles.js';

export const TIPOS_OPERACION = [
  { id: 'compraventa', nombre: 'Compraventa', partes: ['comprador', 'vendedor'] },
  { id: 'alquiler', nombre: 'Alquiler', partes: ['inquilino', 'propietario'] },
];

export const fasesDe = (tipo) => DATOS_OPERACIONES[tipo] || DATOS_OPERACIONES.compraventa;
export const tipoOperacion = (id) => TIPOS_OPERACION.find((t) => t.id === id) || TIPOS_OPERACION[0];

export function nuevaOperacion(d = {}, hoy = aISO()) {
  const tipo = tipoOperacion(d.tipo).id;
  return {
    id: d.id,
    tipo,
    inmueble: String(d.inmueble || '').trim().slice(0, 120),
    precio: Number(d.precio) > 0 ? Number(d.precio) : null,
    partes: {
      [tipoOperacion(tipo).partes[0]]: parte(d.parteA),
      [tipoOperacion(tipo).partes[1]]: parte(d.parteB),
    },
    notaria: String(d.notaria || '').trim().slice(0, 80),
    banco: String(d.banco || '').trim().slice(0, 80),
    fase: fasesDe(tipo)[0].fase,
    papeles: {},
    fechas: [],
    notas: String(d.notas || '').trim().slice(0, 1000),
    creada: hoy,
    cerrada: false,
  };
}

function parte(p) {
  return { nombre: String(p?.nombre || '').trim().slice(0, 80), telefono: String(p?.telefono || '').trim().slice(0, 20), email: String(p?.email || '').trim().slice(0, 80) };
}

export function validaOperacion(op) {
  const errores = [];
  if (!op?.inmueble) errores.push('Indica el inmueble (referencia o dirección).');
  return { ok: errores.length === 0, errores };
}

export const indiceFase = (op) => Math.max(0, fasesDe(op.tipo).findIndex((f) => f.fase === op.fase));
export const faseActual = (op) => fasesDe(op.tipo)[indiceFase(op)];

/** Mueve la operación una fase adelante (+1) o atrás (-1). Devuelve una copia. */
export function mueveFase(op, paso) {
  const fases = fasesDe(op.tipo);
  const i = Math.min(fases.length - 1, Math.max(0, indiceFase(op) + paso));
  return { ...op, fase: fases[i].fase };
}

/** Todos los papeles de la operación, con la fase a la que pertenecen y si están hechos. */
export function papelesDe(op) {
  return fasesDe(op.tipo).flatMap((f) => f.papeles.map((p) => ({ ...p, fase: f.fase, hecho: Boolean(op.papeles?.[p.id]) })));
}

export function marcaPapel(op, idPapel, hecho) {
  return { ...op, papeles: { ...op.papeles, [idPapel]: Boolean(hecho) } };
}

/** Papeles pendientes de las fases ya alcanzadas (lo que de verdad urge). */
export function pendientesHastaAhora(op) {
  const hasta = indiceFase(op);
  const fases = fasesDe(op.tipo).map((f) => f.fase);
  return papelesDe(op).filter((p) => !p.hecho && fases.indexOf(p.fase) <= hasta && p.caracter !== 'segun-caso');
}

export function progreso(op) {
  const todos = papelesDe(op).filter((p) => p.caracter !== 'segun-caso');
  const hechos = todos.filter((p) => p.hecho).length;
  return { hechos, total: todos.length, porcentaje: todos.length ? Math.round((hechos / todos.length) * 100) : 0 };
}

/** Calcula la fecha de un plazo de la plantilla a partir de su fecha de inicio. */
export function calculaPlazo(plazo, fechaBase) {
  if (!esISO(fechaBase) || !Number.isFinite(plazo?.dias)) return '';
  return plazo.tipoDias === 'habiles' ? sumaDiasHabiles(fechaBase, plazo.dias) : sumaDias(fechaBase, plazo.dias);
}

export function plazosDe(op) {
  return fasesDe(op.tipo).flatMap((f) => (f.plazos || []).map((p) => ({ ...p, fase: f.fase })));
}

export function validaFecha(f) {
  const errores = [];
  if (!String(f?.nombre || '').trim()) errores.push('Ponle nombre a la fecha (p. ej. "Firma en notaría").');
  if (!esISO(f?.fecha)) errores.push('Falta la fecha.');
  if (f?.hora && !esHora(f.hora)) errores.push('La hora debe ser tipo 10:30.');
  return {
    ok: errores.length === 0,
    errores,
    fecha: {
      id: f?.id,
      nombre: String(f?.nombre || '').trim().slice(0, 80),
      fecha: esISO(f?.fecha) ? f.fecha : '',
      hora: esHora(f?.hora) ? f.hora : '',
      avisoDias: Number.isFinite(Number(f?.avisoDias)) ? Math.max(0, Math.min(60, Math.round(Number(f.avisoDias)))) : 1,
      hecha: Boolean(f?.hecha),
    },
  };
}

/** Fechas pendientes de todas las operaciones abiertas dentro de los próximos `dias` (incluye atrasadas). */
export function proximasFechas(operaciones, hoy = aISO(), dias = 14) {
  const out = [];
  for (const op of operaciones || []) {
    if (op.cerrada) continue;
    for (const f of op.fechas || []) {
      if (f.hecha || !esISO(f.fecha)) continue;
      const faltan = diasEntre(hoy, f.fecha);
      if (faltan <= dias) out.push({ ...f, faltan, operacion: op });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora).localeCompare(String(b.hora)));
}

export function eventosOperaciones(operaciones) {
  const out = [];
  for (const op of operaciones || []) {
    if (op.cerrada) continue;
    for (const f of op.fechas || []) {
      if (f.hecha || !esISO(f.fecha)) continue;
      out.push({
        uid: `op-${op.id}-${f.id}`,
        fecha: f.fecha,
        hora: f.hora || undefined,
        titulo: `${f.nombre} · ${op.inmueble}`,
        descripcion: `${tipoOperacion(op.tipo).nombre} de ${op.inmueble}. Fase: ${faseActual(op).titulo}.`,
        lugar: /notar/i.test(f.nombre) ? op.notaria : undefined,
        avisoDias: f.avisoDias,
      });
    }
  }
  return out;
}

/** Mensajes de la plantilla para esta operación, con los datos ya puestos. */
export function mensajesPara(op, ajustes = {}) {
  const [a, b] = tipoOperacion(op.tipo).partes;
  // La cita de firma: en compraventa, la de la notaría; en alquiler, la de la firma del contrato.
  const claveCita = op.tipo === 'alquiler' ? /firma|contrato/i : /notar/i;
  const notaria = (op.fechas || []).find((f) => claveCita.test(f.nombre) && esISO(f.fecha));
  const datos = {
    // En alquiler las plantillas también pueden usar {comprador}/{vendedor}.
    comprador: op.partes?.[a]?.nombre, vendedor: op.partes?.[b]?.nombre,
    [a]: op.partes?.[a]?.nombre, [b]: op.partes?.[b]?.nombre,
    inmueble: op.inmueble, notaria: op.notaria, banco: op.banco,
    fecha: notaria ? notaria.fecha.split('-').reverse().join('/') : '',
    hora: notaria?.hora || '',
    agente: ajustes.agente || '', empresa: ajustes.empresa || '', telefono: ajustes.telefono || '',
  };
  return (DATOS_OPERACIONES.mensajes || [])
    .filter((m) => m.tipo ? m.tipo === op.tipo : true)
    .map((m) => ({ ...m, texto: rellena(m.texto, datos), destinatario: destinatarioDe(op, m.para) }));
}

function destinatarioDe(op, para) {
  return op.partes?.[para] || (para === 'notaria' ? { nombre: op.notaria } : para === 'banco' ? { nombre: op.banco } : null);
}
