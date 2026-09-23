/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — exámenes al calendario del móvil
   Una web no puede mandar avisos con la app cerrada sin un servidor de
   notificaciones. El calendario del móvil sí: así que el examen y su plan
   de estudio se exportan como archivo .ics, y es el propio teléfono el que
   avisa, aunque la app no se abra en una semana.

   Función pura: entra el examen y su plan, sale el texto del .ics.
   ═══════════════════════════════════════════════════════════════════ */

import { sumaDias } from './utiles.js';

const plano = (iso) => iso.replace(/-/g, '');

/* El formato .ics exige escapar comas, puntos y comas y saltos de línea, y
   partir las líneas largas a 75 octetos. */
export function escapaIcs(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function doblaLinea(linea) {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const trozos = [];
  let actual = '';
  for (const caracter of linea) {
    if (new TextEncoder().encode(actual + caracter).length > (trozos.length ? 74 : 75)) {
      trozos.push(actual);
      actual = caracter;
    } else {
      actual += caracter;
    }
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

function evento({ uid, fecha, titulo, descripcion, avisos, sello }) {
  const lineas = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${sello}`,
    `DTSTART;VALUE=DATE:${plano(fecha)}`,
    `DTEND;VALUE=DATE:${plano(sumaDias(fecha, 1))}`,
    `SUMMARY:${escapaIcs(titulo)}`,
    `DESCRIPTION:${escapaIcs(descripcion)}`,
    'TRANSP:TRANSPARENT'
  ];
  // Los avisos de un evento de día completo cuentan desde las 00:00 de ese
  // día: PT17H es "a las cinco de la tarde", -PT7H "a las cinco de la tarde
  // del día anterior". A las 17:00 ya ha salido de clase.
  for (const disparo of avisos) {
    lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapaIcs(titulo)}`, `TRIGGER:${disparo}`, 'END:VALARM');
  }
  lineas.push('END:VEVENT');
  return lineas;
}

/**
 * El examen (con aviso la tarde anterior) y cada paso del plan (con aviso a
 * las 17:00 de su día). `sello` entra por parámetro para poder probarlo.
 */
export function icsExamen({ examen, plan, asignatura, sello = '20260101T000000Z' }) {
  const base = `nicer-${examen.id || plano(examen.fecha)}`;
  const nombre = asignatura ? `${asignatura}: ${examen.titulo}` : examen.titulo;
  const eventos = [
    ...evento({
      uid: `${base}-examen@nicer-estudia`,
      fecha: examen.fecha,
      titulo: `📝 Examen · ${nombre}`,
      descripcion: examen.temas ? `Entra: ${examen.temas}` : 'Examen apuntado en Nicer Estudia.',
      avisos: ['-PT7H'],
      sello
    }),
    ...plan.filter((p) => p.dias > 0).flatMap((p) => evento({
      uid: `${base}-d${p.dias}@nicer-estudia`,
      fecha: p.fecha,
      titulo: `📚 ${p.foco} · ${nombre}`,
      descripcion: p.detalle,
      avisos: ['PT17H'],
      sello
    }))
  ];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nicer Estudia//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventos,
    'END:VCALENDAR'
  ].map(doblaLinea).join('\r\n') + '\r\n';
}
