/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — mis papeles y vencimientos (personal)
   ITV, seguros, IBI, DNI, carné… cada papel con su fecha y cuántos días
   antes avisar. El estado se calcula siempre respecto a hoy.
   Funciones puras.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, diasEntre, esISO, sumaDias } from './utiles.js';

export const TIPOS_PAPEL = [
  { id: 'itv', nombre: 'ITV', icono: '🚗', aviso: 30 },
  { id: 'seguro-coche', nombre: 'Seguro del coche', icono: '🛡️', aviso: 30 },
  { id: 'revision-coche', nombre: 'Revisión del coche', icono: '🔧', aviso: 15 },
  { id: 'seguro-hogar', nombre: 'Seguro de hogar', icono: '🏠', aviso: 30 },
  { id: 'seguro-vida', nombre: 'Seguro de vida o salud', icono: '❤️', aviso: 30 },
  { id: 'ibi', nombre: 'IBI / impuestos', icono: '🏛️', aviso: 15 },
  { id: 'dni', nombre: 'DNI', icono: '🪪', aviso: 60 },
  { id: 'carne', nombre: 'Carné de conducir', icono: '🚦', aviso: 60 },
  { id: 'pasaporte', nombre: 'Pasaporte', icono: '🛂', aviso: 90 },
  { id: 'garantia', nombre: 'Garantía', icono: '🧾', aviso: 30 },
  { id: 'recibo', nombre: 'Recibo o suscripción', icono: '💳', aviso: 7 },
  { id: 'otro', nombre: 'Otro', icono: '📄', aviso: 15 },
];

export const tipoPapel = (id) => TIPOS_PAPEL.find((t) => t.id === id) || TIPOS_PAPEL[TIPOS_PAPEL.length - 1];

export function validaPapel(p) {
  const errores = [];
  const titulo = String(p?.titulo || '').trim();
  if (!titulo) errores.push('Ponle un nombre (p. ej. "ITV del Golf").');
  if (!esISO(p?.vence)) errores.push('Falta la fecha de vencimiento.');
  const aviso = Number(p?.avisoDias);
  return {
    ok: errores.length === 0,
    errores,
    papel: {
      id: p?.id,
      tipo: tipoPapel(p?.tipo).id,
      titulo: titulo.slice(0, 80),
      vence: esISO(p?.vence) ? p.vence : '',
      avisoDias: Number.isFinite(aviso) && aviso >= 0 && aviso <= 365 ? Math.round(aviso) : tipoPapel(p?.tipo).aviso,
      notas: String(p?.notas || '').trim().slice(0, 300),
    },
  };
}

/** 'vencido' | 'pronto' (dentro del plazo de aviso) | 'ok' */
export function estadoPapel(p, hoy = aISO()) {
  if (!esISO(p?.vence)) return { estado: 'ok', dias: Infinity };
  const dias = diasEntre(hoy, p.vence);
  if (dias < 0) return { estado: 'vencido', dias };
  if (dias <= (p.avisoDias ?? 30)) return { estado: 'pronto', dias };
  return { estado: 'ok', dias };
}

/** Ordena: vencidos primero, luego por fecha. */
export function ordenaPapeles(papeles, hoy = aISO()) {
  const peso = { vencido: 0, pronto: 1, ok: 2 };
  return [...(papeles || [])].sort((a, b) => {
    const ea = estadoPapel(a, hoy), eb = estadoPapel(b, hoy);
    return peso[ea.estado] - peso[eb.estado] || String(a.vence).localeCompare(String(b.vence));
  });
}

/** Eventos para el .ics: el día del vencimiento, con alarma los días de aviso antes. */
export function eventosPapeles(papeles) {
  return (papeles || []).filter((p) => esISO(p.vence)).map((p) => ({
    uid: `papel-${p.id}`,
    fecha: p.vence,
    titulo: `${tipoPapel(p.tipo).icono} Vence: ${p.titulo}`,
    descripcion: p.notas || `Renueva a tiempo: ${p.titulo}.`,
    avisoDias: p.avisoDias ?? 30,
  }));
}

/** Cuando se renueva, la siguiente fecha típica (ITV/seguros/IBI: +1 año; DNI/carné: lo decide Pau). */
export function siguienteVencimiento(p) {
  if (!esISO(p?.vence)) return '';
  const anual = ['itv', 'seguro-coche', 'seguro-hogar', 'seguro-vida', 'ibi', 'revision-coche', 'recibo'];
  if (!anual.includes(p.tipo)) return '';
  const [a, m, d] = p.vence.split('-').map(Number);
  const nuevo = `${a + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return esISO(nuevo) ? nuevo : sumaDias(p.vence, 365);
}
