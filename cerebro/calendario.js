/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — avisos al calendario del móvil (.ics)
   Una web no puede avisar con la app cerrada; el calendario del móvil sí.
   Los plazos de las operaciones y los vencimientos de los papeles se
   exportan como .ics con alarma, y es el teléfono el que avisa.
   Función pura: entra la lista de eventos, sale el texto del .ics.
   ═══════════════════════════════════════════════════════════════════ */

import { esISO, esHora, sumaDias } from './utiles.js';

export function escapaIcs(texto) {
  return String(texto ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/* Las líneas del .ics no pueden pasar de 75 octetos: se parten con CRLF + espacio. */
export function doblaLinea(linea) {
  const cod = new TextEncoder();
  if (cod.encode(linea).length <= 75) return linea;
  const trozos = [];
  let actual = '';
  for (const c of linea) {
    const limite = trozos.length ? 74 : 75;
    if (cod.encode(actual + c).length > limite) { trozos.push(actual); actual = c; } else actual += c;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

const plano = (iso) => iso.replace(/-/g, '');
function marcaTiempo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * eventos: [{ uid, fecha:'YYYY-MM-DD', hora?:'HH:MM', minutos?:60, titulo, descripcion?, lugar?, avisoDias?:1 }]
 * Con hora: evento con hora local (Europe/Madrid, hora flotante). Sin hora: de día completo.
 * avisoDias: alarma N días antes (0 = el mismo día a las 9:00 si es de día completo).
 */
export function crearIcs(eventos, { nombre = 'Cerebro Útil Pau', ahora = new Date() } = {}) {
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cerebro Util Pau//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapaIcs(nombre)}`,
  ];
  const sello = marcaTiempo(ahora);
  for (const ev of eventos || []) {
    if (!ev || !esISO(ev.fecha) || !String(ev.titulo || '').trim()) continue;
    lineas.push('BEGIN:VEVENT', `UID:${escapaIcs(ev.uid || `${plano(ev.fecha)}-${Math.random().toString(36).slice(2)}`)}@cerebro-util-pau`, `DTSTAMP:${sello}`);
    if (esHora(ev.hora)) {
      const [h, m] = ev.hora.split(':').map(Number);
      const fin = h * 60 + m + (ev.minutos || 60);
      const finDia = fin >= 1440 ? sumaDias(ev.fecha, 1) : ev.fecha;
      const fm = fin % 1440;
      lineas.push(`DTSTART:${plano(ev.fecha)}T${ev.hora.replace(':', '')}00`,
        `DTEND:${plano(finDia)}T${String(Math.floor(fm / 60)).padStart(2, '0')}${String(fm % 60).padStart(2, '0')}00`);
    } else {
      lineas.push(`DTSTART;VALUE=DATE:${plano(ev.fecha)}`, `DTEND;VALUE=DATE:${plano(sumaDias(ev.fecha, 1))}`);
    }
    lineas.push(`SUMMARY:${escapaIcs(ev.titulo)}`);
    if (ev.descripcion) lineas.push(`DESCRIPTION:${escapaIcs(ev.descripcion)}`);
    if (ev.lugar) lineas.push(`LOCATION:${escapaIcs(ev.lugar)}`);
    const dias = Number.isFinite(ev.avisoDias) ? Math.max(0, Math.round(ev.avisoDias)) : 1;
    // Día completo: el aviso "0 días" sale a las 9:00 del propio día (PT9H desde medianoche).
    const disparo = esHora(ev.hora) ? (dias ? `-P${dias}D` : '-PT30M') : (dias ? `-P${dias}DT0H` : 'PT9H');
    lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapaIcs(ev.titulo)}`, `TRIGGER:${disparo}`, 'END:VALARM', 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(doblaLinea).join('\r\n') + '\r\n';
}
