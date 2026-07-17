/* Resumen de visita — acta breve con feedback y siguientes pasos. */

import type { DocumentContent } from '@/types/automation';
import type { GenerateContext } from './documentTypes';
import { formatDay, formatTime } from '@/lib/utils/format';

const STATUS_LABEL = {
  propuesta: 'Propuesta (sin confirmar)',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
} as const;

export function generateVisitSummaryPdf(ctx: GenerateContext): DocumentContent {
  const { visit, lead, property } = ctx;
  if (!visit) throw new Error('generateVisitSummaryPdf requiere una visita.');

  return {
    kind: 'resumen-visita',
    title: 'Resumen de visita',
    subtitle: `${property?.reference ?? visit.propertyId} · ${formatDay(visit.scheduledAt)} · ${formatTime(visit.scheduledAt)}`,
    sections: [
      {
        heading: 'Datos de la visita',
        facts: [
          { label: 'Cliente', value: lead?.name ?? visit.leadId },
          { label: 'Inmueble', value: property ? `${property.reference} — ${property.title}` : visit.propertyId },
          { label: 'Fecha y hora', value: `${formatDay(visit.scheduledAt)} · ${formatTime(visit.scheduledAt)}` },
          { label: 'Estado', value: STATUS_LABEL[visit.status] },
        ],
      },
      {
        heading: 'Notas y feedback',
        paragraphs: [
          visit.notes ?? 'Sin notas previas registradas.',
          visit.feedback ?? 'Feedback pendiente de registrar tras la visita.',
        ],
      },
      {
        heading: 'Siguientes pasos',
        paragraphs: [
          visit.status === 'realizada'
            ? 'Hacer seguimiento post-visita en 24-48 h y registrar decisión del cliente.'
            : 'Confirmar asistencia y enviar recordatorio 24 h antes.',
        ],
      },
    ],
    footer: `Uso interno — Asesoría Castresana · Visita ${visit.id}`,
  };
}
