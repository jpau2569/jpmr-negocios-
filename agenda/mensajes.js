/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — mensajes de WhatsApp ya redactados
   Funciones puras: reciben datos y devuelven texto. No envían nada.
   La app abre WhatsApp con el texto escrito (wa.me) y es Pau quien
   pulsa «enviar» allí. Por eso nunca se apunta un envío solo: Pau
   confirma con «Ya lo he enviado».
   Los pisos solo llevan los datos PÚBLICOS (fichaCompartible).
   ═══════════════════════════════════════════════════════════════════ */

import { fichaCompartible } from './datos.js';
import { aISO, fechaLarga, sumaDias, telefonoWhatsapp } from './utiles.js';

export const TIPOS_MENSAJE = {
  recordatorio: '⏰ Recordatorio de cita',
  piso: '🏠 Piso',
  enlace: '🎬 Vídeo o enlace',
  libre: '✍️ Mensaje libre',
};

const saludo = (c) => `Hola${c?.nombre ? ' ' + c.nombre.trim() : ''}`;

export function firma(ajustes = {}) {
  const nombre = (ajustes.nombre || '').trim();
  const tel = (ajustes.whatsapp || '').trim();
  if (!nombre && !tel) return 'Un saludo.';
  return `Un saludo, ${nombre || ''}${nombre && tel ? ' · ' : ''}${tel}`.trim();
}

/** «hoy», «mañana» o «el martes, 21 de octubre». */
export function cuandoTexto(iso, hoy = aISO()) {
  if (iso === hoy) return 'hoy';
  if (iso === sumaDias(hoy, 1)) return 'mañana';
  const larga = fechaLarga(iso);
  // El año solo si no es el de ahora.
  return 'el ' + (iso.slice(0, 4) === hoy.slice(0, 4) ? larga.replace(/ de \d{4}$/, '') : larga);
}

function queCita(e, inm) {
  if (e.tipo === 'visita') {
    if (!inm) return 'la visita';
    const que = `al ${inm.tipo}${inm.zona ? ' de ' + inm.zona : ''}`;
    return `la visita ${que}${inm.referencia ? ` (ref. ${inm.referencia})` : ''}`;
  }
  if (e.tipo === 'firma') return 'la firma';
  if (e.tipo === 'llamada') return 'nuestra llamada';
  return 'nuestra cita';
}

export function mensajeRecordatorio({ evento, cliente, inmueble, ajustes, hoy = aISO() }) {
  const hora = !evento.todoElDia && evento.inicio ? ` a las ${evento.inicio}` : '';
  const donde = evento.ubicacion && evento.tipo !== 'llamada' ? ` en ${evento.ubicacion}` : '';
  return `${saludo(cliente)}, te recuerdo ${queCita(evento, inmueble)} ${cuandoTexto(evento.fecha, hoy)}${hora}${donde}.\n`
    + 'Si te surge cualquier cosa, dímelo y lo cambiamos.\n\n'
    + firma(ajustes);
}

export function mensajePiso({ inmueble, cliente, ajustes }) {
  return `${saludo(cliente)}, te paso este inmueble que puede encajarte:\n\n${fichaCompartible(inmueble)}\n\n`
    + '¿Te apetece verlo? Dime qué día te viene bien.\n\n'
    + firma(ajustes);
}

export function mensajeEnlace({ url, titulo = '', video = false, cliente, ajustes }) {
  const que = video ? 'este vídeo' : 'este enlace';
  return `${saludo(cliente)}, te paso ${que}${titulo ? `: ${titulo}` : ''}\n${url}\n\n${firma(ajustes)}`;
}

export function mensajeLibre({ cliente, ajustes }) {
  return `${saludo(cliente)}, \n\n${firma(ajustes)}`;
}

/** Enlace que abre el chat con el texto escrito, o '' si el teléfono no sirve. */
export function enlaceWhatsapp(telefono, texto = '') {
  const n = telefonoWhatsapp(telefono);
  if (!n) return '';
  return `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

/** Lo que se apunta en el historial cuando Pau confirma que lo ha enviado. */
export function resumenEnvio({ tipo, evento, inmueble, url, titulo, texto }) {
  if (tipo === 'recordatorio' && evento) return `Recordatorio por WhatsApp de la cita del ${evento.fecha.split('-').reverse().join('/')}${evento.inicio ? ' a las ' + evento.inicio : ''}.`;
  if (tipo === 'piso' && inmueble) return `Le he enviado por WhatsApp el inmueble ${[inmueble.referencia, inmueble.titulo].filter(Boolean).join(' · ') || inmueble.tipo}.`;
  if (tipo === 'enlace' && url) return `Le he enviado por WhatsApp ${titulo ? `«${titulo}»` : 'un enlace'}: ${url}`;
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  return `Mensaje por WhatsApp: ${limpio.length > 160 ? limpio.slice(0, 157) + '…' : limpio}`;
}
