/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — hoja de visita digital con firma
   El visitante firma con el dedo; queda registrado cuándo, qué inmueble
   y quién. La firma se guarda como JPEG pequeño dentro de la visita para
   poder volver a generar el PDF cuando haga falta.
   Funciones puras (el lienzo de la firma está en firma.js).
   ═══════════════════════════════════════════════════════════════════ */

import { esHora, esISO, rellena, fechaLarga } from './utiles.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validaVisita(v) {
  const errores = [];
  if (!esISO(v?.fecha)) errores.push('Falta la fecha de la visita.');
  if (!esHora(v?.hora)) errores.push('Falta la hora (formato 17:30).');
  if (!String(v?.inmueble || '').trim()) errores.push('Indica el inmueble (referencia o dirección).');
  if (!String(v?.visitante?.nombre || '').trim()) errores.push('Falta el nombre del visitante.');
  const email = String(v?.visitante?.email || '').trim();
  if (email && !EMAIL.test(email)) errores.push('El correo del visitante no parece válido.');
  if (!v?.aceptaRgpd) errores.push('El visitante tiene que marcar que ha leído la información de protección de datos.');
  if (!esFirmaJpeg(v?.firma)) errores.push('Falta la firma del visitante.');
  return { ok: errores.length === 0, errores };
}

export const esFirmaJpeg = (x) => typeof x === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]{100,}$/.test(x);

/** Deja solo los campos esperados y con longitudes razonables. */
export function limpiaVisita(v) {
  const t = (x, n) => String(x ?? '').trim().slice(0, n);
  return {
    id: v.id,
    fecha: v.fecha,
    hora: v.hora,
    inmueble: t(v.inmueble, 120),
    visitante: {
      nombre: t(v.visitante?.nombre, 80),
      dni: t(v.visitante?.dni, 20).toUpperCase(),
      telefono: t(v.visitante?.telefono, 20),
      email: t(v.visitante?.email, 80),
    },
    acompanantes: t(v.acompanantes, 120),
    observaciones: t(v.observaciones, 600),
    aceptaRgpd: Boolean(v.aceptaRgpd),
    aceptaOfertas: Boolean(v.aceptaOfertas),
    firma: v.firma,
    firmaAncho: Number(v.firmaAncho) || 600,
    firmaAlto: Number(v.firmaAlto) || 200,
    registrada: v.registrada || new Date().toISOString(),
    pisoId: String(v.pisoId || '').slice(0, 80),
    piso: v.piso && typeof v.piso === 'object' ? v.piso : undefined,
  };
}

/** Texto de la declaración con los datos de esta visita puestos. */
export function declaracionDe(visita, ajustes) {
  return rellena(ajustes.textoDeclaracion, {
    visitante: visita.visitante.nombre,
    dni: visita.visitante.dni || 'no indicado',
    inmueble: visita.inmueble,
    fecha: fechaLarga(visita.fecha),
    hora: visita.hora,
    empresa: ajustes.empresa,
    agente: ajustes.agente,
  });
}

/** data:image/jpeg;base64,… → Uint8Array */
export function bytesDeDataUrl(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Búsqueda por nombre, inmueble, teléfono o DNI (sin tildes ni mayúsculas). */
export function buscaVisitas(visitas, texto) {
  const q = normal(texto);
  const orden = [...(visitas || [])].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));
  if (!q) return orden;
  return orden.filter((v) => normal([v.inmueble, v.visitante?.nombre, v.visitante?.telefono, v.visitante?.dni, v.visitante?.email].join(' ')).includes(q));
}

const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
