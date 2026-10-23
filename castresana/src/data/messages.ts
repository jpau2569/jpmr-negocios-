import type { Message } from '@/types';

/* Mensajes mock por lead. Solo algunos leads tienen hilo largo; el resto,
   lo suficiente para que la conversación abierta resulte creíble. */

export const messages: Message[] = [
  /* ------------------------- l-01 · Marta Fernández — hilo activo largo */
  {
    id: 'm-0101',
    leadId: 'l-01',
    direction: 'in',
    body: 'Hola, buenas tardes. He visto el piso de la calle Uría (ref. CAS-0412) y me interesa mucho. ¿Sería posible visitarlo esta semana?',
    sentAt: '2026-07-08T11:02:00+02:00',
  },
  {
    id: 'm-0102',
    leadId: 'l-01',
    direction: 'out',
    body: 'Hola Marta, encantado. Claro que sí: el piso está recién reformado y se enseña muy bien. ¿Qué días le vendrían mejor?',
    sentAt: '2026-07-08T11:20:00+02:00',
  },
  {
    id: 'm-0103',
    leadId: 'l-01',
    direction: 'in',
    body: 'Entre semana mejor a partir de las 18:00. Tengo la hipoteca preaprobada por 300.000 €, por si ayuda a agilizar.',
    sentAt: '2026-07-08T12:05:00+02:00',
  },
  {
    id: 'm-0104',
    leadId: 'l-01',
    direction: 'out',
    body: 'Ayuda muchísimo, gracias por adelantarlo. Le propongo el jueves 17 a las 18:30 en el portal. Si le encaja, la agendo ahora mismo.',
    sentAt: '2026-07-16T10:12:00+02:00',
  },
  {
    id: 'm-0105',
    leadId: 'l-01',
    direction: 'in',
    body: '¿Podría ser el jueves a última hora? Salgo de trabajar a las 18:00.',
    sentAt: '2026-07-17T09:24:00+02:00',
  },

  /* ------------------------------------ l-02 · José Luis Cuervo — oferta */
  {
    id: 'm-0201',
    leadId: 'l-02',
    direction: 'in',
    body: 'Buenos días. Tras la segunda visita al ático del Antiguo, presento oferta formal de 328.000 €.',
    sentAt: '2026-07-15T10:02:00+02:00',
  },
  {
    id: 'm-0202',
    leadId: 'l-02',
    direction: 'out',
    body: 'Buenos días, José Luis. Recibida la oferta; la traslado hoy mismo a la propiedad y le mantengo informado.',
    sentAt: '2026-07-15T10:31:00+02:00',
  },
  {
    id: 'm-0203',
    leadId: 'l-02',
    direction: 'in',
    body: 'Mantengo la oferta de 328.000 €. ¿Hay respuesta de la propiedad?',
    sentAt: '2026-07-17T08:41:00+02:00',
  },

  /* --------------------------------------- l-03 · Carmen Álvarez — nuevo */
  {
    id: 'm-0301',
    leadId: 'l-03',
    direction: 'in',
    body: 'Hola, vi el piso junto al Campo San Francisco. ¿Sigue disponible?',
    sentAt: '2026-07-17T07:58:00+02:00',
  },

  /* ----------------------------- l-04 · Familia González-Prado — seguim. */
  {
    id: 'm-0401',
    leadId: 'l-04',
    direction: 'out',
    body: '¿Qué os pareció el adosado de La Fresneda? Quedó libre otra visita el sábado por si queréis repetir con más calma.',
    sentAt: '2026-07-16T18:50:00+02:00',
  },
  {
    id: 'm-0402',
    leadId: 'l-04',
    direction: 'in',
    body: 'Nos encantó el adosado. Lo hablamos este fin de semana y te decimos.',
    sentAt: '2026-07-16T19:33:00+02:00',
  },

  /* ------------------------------------------ l-05 · Diego Menéndez — web */
  {
    id: 'm-0501',
    leadId: 'l-05',
    direction: 'in',
    body: 'Formulario web: interesado en el apartamento de Ciudad Naranco (CAS-0421). Disponibilidad para entrar en septiembre.',
    sentAt: '2026-07-16T17:05:00+02:00',
  },

  /* ------------------------------------- l-06 · Hostelería El Fontán S.L. */
  {
    id: 'm-0601',
    leadId: 'l-06',
    direction: 'out',
    body: 'Confirmada visita al local el viernes a las 10:00 con el gerente.',
    sentAt: '2026-07-16T13:12:00+02:00',
  },

  /* ----------------------------------------- l-07 · Lucía Vega — vendedora */
  {
    id: 'm-0701',
    leadId: 'l-07',
    direction: 'out',
    body: 'Le adjunto la valoración de la casa de Las Regueras: 265.000 € como precio de salida recomendado, con margen de negociación.',
    sentAt: '2026-07-15T18:30:00+02:00',
  },
  {
    id: 'm-0702',
    leadId: 'l-07',
    direction: 'in',
    body: 'Gracias por la valoración. Necesito comentarlo con mis hermanos.',
    sentAt: '2026-07-15T20:47:00+02:00',
  },

  /* ------------------------------------------- l-08 · Pablo Suárez — visita */
  {
    id: 'm-0801',
    leadId: 'l-08',
    direction: 'out',
    body: 'Le confirmo la visita al piso de Buenavista este sábado a las 12:00. Nos vemos en el portal.',
    sentAt: '2026-07-15T14:02:00+02:00',
  },
  {
    id: 'm-0802',
    leadId: 'l-08',
    direction: 'in',
    body: 'Perfecto, nos vemos el sábado a las 12:00 en el portal. Gracias.',
    sentAt: '2026-07-15T14:28:00+02:00',
  },

  /* ---------------------------------------- l-09 · Rosario Blanco — cerrado */
  {
    id: 'm-0901',
    leadId: 'l-09',
    direction: 'in',
    body: 'Muchísimas gracias por todo, Pau. Os recomendaré sin duda.',
    sentAt: '2026-07-14T11:50:00+02:00',
  },

  /* -------------------------------------- l-10 · Andrés Castañón — oferta */
  {
    id: 'm-1001',
    leadId: 'l-10',
    direction: 'out',
    body: 'La propiedad responde con contraoferta: 405.000 € con la cocina equipada incluida. Quedo a la espera de su decisión.',
    sentAt: '2026-07-13T09:10:00+02:00',
  },
  {
    id: 'm-1002',
    leadId: 'l-10',
    direction: 'in',
    body: 'Recibida la contraoferta. Lo estudio con el banco y respondo.',
    sentAt: '2026-07-13T09:36:00+02:00',
  },
];

export function getMessagesByLead(leadId: string): Message[] {
  return messages
    .filter((m) => m.leadId === leadId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}
