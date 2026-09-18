import type { Communication } from '@/types/automation';

/* ============================================================================
   Comunicaciones seed — historial de WhatsApp/email ya enviados, para que
   el activity center y el rendimiento por canal tengan datos coherentes.
   ============================================================================ */

export const seedCommunications: Communication[] = [
  {
    id: 'comm-s-01',
    leadId: 'l-01',
    channel: 'whatsapp',
    direction: 'out',
    templateId: 'wa-propuesta-visita',
    body: 'Hola Marta, ¿cerramos la visita a CAS-0412? Tengo hueco el jueves 17 a las 18:30. Si le encaja, se lo confirmo ahora mismo.',
    status: 'leido',
    sentAt: '2026-07-16T10:12:00+02:00',
    origin: 'manual',
  },
  {
    id: 'comm-s-02',
    leadId: 'l-04',
    channel: 'email',
    direction: 'out',
    templateId: 'em-post-visita',
    subject: '¿Qué os pareció CAS-0377?',
    body: 'Hola familia González-Prado, gracias por venir a la visita del adosado de La Fresneda…',
    status: 'entregado',
    sentAt: '2026-07-16T18:50:00+02:00',
    origin: 'manual',
  },
  {
    id: 'comm-s-03',
    leadId: 'l-05',
    channel: 'email',
    direction: 'out',
    templateId: 'em-bienvenida',
    subject: 'Bienvenido a Asesoría Castresana, Diego',
    body: 'Hola Diego, gracias por contactar con Asesoría Castresana…',
    status: 'enviado',
    sentAt: '2026-07-16T17:20:00+02:00',
    origin: 'workflow',
  },
  {
    id: 'comm-s-04',
    leadId: 'l-06',
    channel: 'whatsapp',
    direction: 'out',
    templateId: 'wa-recordatorio-visita',
    body: 'Hola, les recordamos la visita de mañana viernes 18 a las 10:00 en el local de La Corredoria (CAS-0366).',
    status: 'entregado',
    sentAt: '2026-07-17T09:00:00+02:00',
    origin: 'workflow',
  },
  {
    id: 'comm-s-05',
    leadId: 'l-07',
    channel: 'email',
    direction: 'out',
    templateId: 'em-captacion-propietario',
    subject: 'Valoración y plan de venta de su casa en Las Regueras',
    body: 'Hola Lucía, gracias por su confianza. Le resumo cómo trabajaríamos la venta…',
    status: 'leido',
    sentAt: '2026-07-15T18:30:00+02:00',
    origin: 'manual',
  },
  {
    id: 'comm-s-06',
    leadId: 'l-10',
    channel: 'email',
    direction: 'out',
    templateId: 'em-envio-dossier',
    subject: 'Dossier de CAS-0377 — Asesoría Castresana',
    body: 'Hola Andrés, le adjunto el dossier completo de CAS-0377…',
    status: 'entregado',
    sentAt: '2026-07-12T11:30:00+02:00',
    origin: 'manual',
  },
  {
    id: 'comm-s-07',
    leadId: 'l-03',
    channel: 'whatsapp',
    direction: 'out',
    templateId: 'wa-primera-respuesta',
    body: 'Hola Carmen, soy Pau de Asesoría Castresana. Gracias por su interés en CAS-0405…',
    status: 'en-cola',
    sentAt: '2026-07-17T08:05:00+02:00',
    origin: 'ia',
  },
];

export function getCommunicationsByLead(leadId: string): Communication[] {
  return seedCommunications
    .filter((c) => c.leadId === leadId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
