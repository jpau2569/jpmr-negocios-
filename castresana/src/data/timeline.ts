import type { TimelineEvent } from '@/types';

/* Hitos de seguimiento por lead (timeline resumido del panel de contexto). */

export const timeline: TimelineEvent[] = [
  /* l-01 · Marta Fernández */
  {
    id: 't-0101',
    leadId: 'l-01',
    kind: 'creado',
    title: 'Lead creado desde WhatsApp',
    at: '2026-07-08T11:02:00+02:00',
  },
  {
    id: 't-0102',
    leadId: 'l-01',
    kind: 'nota',
    title: 'Hipoteca preaprobada (300.000 €)',
    detail: 'Confirmado por la interesada. Banco: Caja Rural de Asturias.',
    at: '2026-07-08T12:10:00+02:00',
  },
  {
    id: 't-0103',
    leadId: 'l-01',
    kind: 'visita',
    title: 'Visita propuesta · CAS-0412',
    detail: 'Jueves 17 · pendiente de confirmar hora final.',
    at: '2026-07-16T10:12:00+02:00',
  },
  {
    id: 't-0104',
    leadId: 'l-01',
    kind: 'tarea',
    title: 'Confirmar visita a las 18:30',
    detail: 'Responder al último mensaje y cerrar hora.',
    at: '2026-07-17T09:30:00+02:00',
    done: false,
  },

  /* l-02 · José Luis Cuervo */
  {
    id: 't-0201',
    leadId: 'l-02',
    kind: 'creado',
    title: 'Lead desde portal inmobiliario',
    at: '2026-06-29T16:44:00+02:00',
  },
  {
    id: 't-0202',
    leadId: 'l-02',
    kind: 'visita',
    title: '2ª visita realizada · CAS-0398',
    at: '2026-07-14T17:00:00+02:00',
  },
  {
    id: 't-0203',
    leadId: 'l-02',
    kind: 'oferta',
    title: 'Oferta recibida: 328.000 €',
    detail: 'Trasladada a la propiedad el 15/07.',
    at: '2026-07-15T10:31:00+02:00',
  },
  {
    id: 't-0204',
    leadId: 'l-02',
    kind: 'tarea',
    title: 'Llamar a la propiedad hoy',
    detail: 'Recordar plazo de respuesta de 48 h.',
    at: '2026-07-17T09:00:00+02:00',
    done: false,
  },

  /* l-03 · Carmen Álvarez */
  {
    id: 't-0301',
    leadId: 'l-03',
    kind: 'creado',
    title: 'Lead nuevo desde portal',
    at: '2026-07-17T07:58:00+02:00',
  },
  {
    id: 't-0302',
    leadId: 'l-03',
    kind: 'tarea',
    title: 'Primer contacto en < 1 h',
    detail: 'Responder y cualificar presupuesto.',
    at: '2026-07-17T08:00:00+02:00',
    done: false,
  },

  /* l-04 · Familia González-Prado */
  {
    id: 't-0401',
    leadId: 'l-04',
    kind: 'visita',
    title: 'Visita realizada · CAS-0377',
    at: '2026-07-15T18:00:00+02:00',
  },
  {
    id: 't-0402',
    leadId: 'l-04',
    kind: 'tarea',
    title: 'Seguimiento el lunes',
    detail: 'Preguntar decisión tras el fin de semana.',
    at: '2026-07-20T10:00:00+02:00',
    done: false,
  },

  /* l-06 · Hostelería El Fontán */
  {
    id: 't-0601',
    leadId: 'l-06',
    kind: 'llamada',
    title: 'Llamada de cualificación',
    detail: 'Necesitan salida de humos y 120 m² mínimo.',
    at: '2026-07-10T09:30:00+02:00',
  },
  {
    id: 't-0602',
    leadId: 'l-06',
    kind: 'visita',
    title: 'Visita agendada · CAS-0366',
    detail: 'Viernes 18 · 10:00 con el gerente.',
    at: '2026-07-16T13:12:00+02:00',
  },

  /* l-07 · Lucía Vega */
  {
    id: 't-0701',
    leadId: 'l-07',
    kind: 'nota',
    title: 'Valoración enviada: 265.000 €',
    at: '2026-07-15T18:30:00+02:00',
  },
  {
    id: 't-0702',
    leadId: 'l-07',
    kind: 'tarea',
    title: 'Recordatorio suave en 5 días',
    detail: 'Decisión pendiente de los hermanos.',
    at: '2026-07-20T09:00:00+02:00',
    done: false,
  },

  /* l-09 · Rosario Blanco */
  {
    id: 't-0901',
    leadId: 'l-09',
    kind: 'oferta',
    title: 'Operación cerrada y escriturada',
    detail: 'Piso en Centro — Uría · 172.000 €.',
    at: '2026-07-14T11:00:00+02:00',
  },

  /* l-10 · Andrés Castañón */
  {
    id: 't-1001',
    leadId: 'l-10',
    kind: 'oferta',
    title: 'Contraoferta enviada: 405.000 €',
    at: '2026-07-13T09:10:00+02:00',
  },
];

export function getTimelineByLead(leadId: string): TimelineEvent[] {
  return timeline
    .filter((t) => t.leadId === leadId)
    .sort((a, b) => b.at.localeCompare(a.at));
}
