/* Resumen de lead — briefing comercial imprimible. */

import type { DocumentContent } from '@/types/automation';
import type { GenerateContext } from './documentTypes';
import { formatBudget } from '@/lib/utils/format';
import { STAGES } from '@/lib/constants/stages';
import { CHANNELS } from '@/lib/constants/channels';

export function generateLeadSummaryPdf(ctx: GenerateContext): DocumentContent {
  const lead = ctx.lead;
  if (!lead) throw new Error('generateLeadSummaryPdf requiere un lead.');
  const isRent = lead.intent === 'alquiler';

  return {
    kind: 'resumen-lead',
    title: `Resumen comercial — ${lead.name}`,
    subtitle: `Etapa: ${STAGES[lead.stage].label} · Canal: ${CHANNELS[lead.channel].label}`,
    sections: [
      {
        heading: 'Perfil',
        facts: [
          {
            label: 'Intención',
            value: lead.intent === 'compra' ? 'Compra' : isRent ? 'Alquiler' : 'Venta de inmueble',
          },
          { label: 'Zona de interés', value: lead.zone },
          { label: 'Presupuesto', value: formatBudget(lead.budgetMin, lead.budgetMax, isRent) },
          ...(lead.phone ? [{ label: 'Teléfono', value: lead.phone }] : []),
          ...(lead.email ? [{ label: 'Email', value: lead.email }] : []),
          { label: 'Etiquetas', value: lead.tags.join(' · ') || '—' },
        ],
      },
      {
        heading: 'Situación',
        paragraphs: [
          `Último contacto registrado: ${new Date(lead.lastMessageAt).toLocaleString('es-ES')}.`,
          `Último mensaje: «${lead.lastMessagePreview}»`,
        ],
      },
    ],
    footer: `Uso interno — Asesoría Castresana · Lead ${lead.id}`,
  };
}
