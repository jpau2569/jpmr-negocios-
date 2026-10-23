import type { Agent, Lead, Property, Task, Visit, AppNotification, Conversation } from '@/types';
import { leads as baseLeads } from './leads';
import { properties as baseProperties } from './mock-properties';
import { messages } from './messages';

/* ============================================================================
   SEED — dataset completo y coherente para poblar Firestore.
   Amplía los mocks de la UI hasta el volumen objetivo (12 leads, 16
   propiedades) y añade agentes, visitas, tareas y notificaciones.
   Lo consumen scripts/seedFirestore.ts y, en modo demo, los repositorios.
   ============================================================================ */

/* --------------------------------------------------------------- Agentes */

export const seedAgents: Agent[] = [
  {
    id: 'a-01',
    uid: null, // se vincula al crear el usuario en Auth
    name: 'Pau Castresana',
    email: 'pau@asesoriacastresana.es',
    phone: '+34 985 200 100',
    role: 'admin',
    active: true,
    createdAt: '2026-01-10T09:00:00+01:00',
  },
  {
    id: 'a-02',
    uid: null,
    name: 'Elena Miranda Cueto',
    email: 'elena@asesoriacastresana.es',
    phone: '+34 985 200 101',
    role: 'agente',
    active: true,
    createdAt: '2026-02-03T09:00:00+01:00',
  },
];

/* ------------------------------------------------- Leads extra (11 y 12) */

const extraLeads: Lead[] = [
  {
    id: 'l-11',
    name: 'Beatriz Llaneza Coto',
    phone: '+34 617 402 981',
    email: 'bea.llaneza@gmail.com',
    stage: 'nuevo',
    intent: 'compra',
    channel: 'portal',
    zone: 'La Florida',
    budgetMin: 280000,
    budgetMax: 330000,
    tags: ['Permuta posible'],
    propertyId: 'p-10',
    unread: 0,
    lastMessageAt: '2026-07-12T12:20:00+02:00',
    lastMessagePreview: 'Me interesa el piso de La Florida. ¿Aceptarían mi piso como parte del pago?',
    createdAt: '2026-07-12T12:20:00+02:00',
  },
  {
    id: 'l-12',
    name: 'Inversiones Nalón S.L.',
    phone: '+34 985 340 220',
    email: 'compras@inversionesnalon.es',
    stage: 'seguimiento',
    intent: 'compra',
    channel: 'email',
    zone: 'Avilés',
    budgetMin: 250000,
    budgetMax: 400000,
    tags: ['Inversor', 'Cartera'],
    propertyId: 'p-12',
    unread: 0,
    lastMessageAt: '2026-07-11T10:05:00+02:00',
    lastMessagePreview: 'Solicitamos rent roll y contratos vigentes del edificio de Sabugo.',
    createdAt: '2026-07-09T09:40:00+02:00',
  },
];

/** 12 leads: los 10 del Inbox + 2 extra del seed. */
export const seedLeads: Lead[] = [...baseLeads, ...extraLeads];

/* -------------------------------------------- Propiedades extra (15 y 16) */

const extraProperties: Property[] = [
  {
    id: 'p-15',
    reference: 'CAS-0451',
    title: 'Estudio reformado junto a la Losa',
    kind: 'piso',
    zone: 'Estación — La Losa',
    city: 'Oviedo',
    price: 118000,
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 44,
    operation: 'venta',
    status: 'disponible',
    tags: ['Reformado', 'Inversión', 'Alto potencial'],
    palette: ['#6E5238', '#100E0C'],
    photos: 12,
    description:
      'Estudio completamente reformado a 200 metros de la estación intermodal. Alquilado hasta hace un mes por 620 €/mes: rentabilidad bruta superior al 6% a precio de salida. Ideal primera inversión.',
    features: ['Reformado 2025', 'Junto a la estación', 'Rentabilidad ~6,3%', 'Amueblado'],
    floor: '1ª planta',
    yearBuilt: 1968,
    yieldPct: 6.3,
    publishedAt: '2026-07-16T10:00:00+02:00',
  },
  {
    id: 'p-16',
    reference: 'CAS-0452',
    title: 'Bajo con terraza en Somió',
    kind: 'piso',
    zone: 'Somió',
    city: 'Gijón',
    price: 298000,
    bedrooms: 3,
    bathrooms: 2,
    areaM2: 108,
    operation: 'venta',
    status: 'disponible',
    tags: ['Terraza', 'Garaje', 'Listo para entrar'],
    palette: ['#86A063', '#16120F'],
    photos: 26,
    description:
      'Bajo con terraza de 40 m² y jardín comunitario en la zona residencial más tranquila de Gijón. Tres dormitorios, cocina office y garaje cerrado. A diez minutos de la playa y del centro.',
    features: ['Terraza 40 m²', 'Jardín comunitario', 'Garaje cerrado', 'Cocina office'],
    floor: 'Bajo',
    yearBuilt: 1995,
    publishedAt: '2026-07-13T10:00:00+02:00',
  },
];

/** 16 propiedades: las 14 del Explorer + 2 extra del seed. */
export const seedProperties: Property[] = [...baseProperties, ...extraProperties];

/* --------------------------------------------------------- Conversaciones */

/**
 * Cabeceras de conversación derivadas de los leads (una por lead con
 * mensajes). Los mensajes van a la subcolección conversations/{id}/messages.
 */
export const seedConversations: Conversation[] = seedLeads
  .filter((lead) => messages.some((m) => m.leadId === lead.id))
  .map((lead) => ({
    id: `c-${lead.id}`,
    leadId: lead.id,
    agentId: 'a-01',
    channel: lead.channel,
    subject: lead.lastMessagePreview.slice(0, 60),
    lastMessageAt: lead.lastMessageAt,
    lastMessagePreview: lead.lastMessagePreview,
    unreadCount: lead.unread,
    createdAt: lead.createdAt,
  }));

/* ----------------------------------------------------------------- Visitas */

export const seedVisits: Visit[] = [
  {
    id: 'v-seed-01',
    leadId: 'l-01',
    propertyId: 'p-01',
    agentId: 'a-01',
    scheduledAt: '2026-07-17T18:30:00+02:00',
    status: 'propuesta',
    notes: 'Pendiente de confirmar hora exacta (la interesada sale a las 18:00).',
    createdAt: '2026-07-16T10:12:00+02:00',
  },
  {
    id: 'v-seed-02',
    leadId: 'l-06',
    propertyId: 'p-06',
    agentId: 'a-02',
    scheduledAt: '2026-07-18T10:00:00+02:00',
    status: 'confirmada',
    notes: 'Acude el gerente. Llevar medidas de la salida de humos.',
    createdAt: '2026-07-16T13:12:00+02:00',
  },
  {
    id: 'v-seed-03',
    leadId: 'l-08',
    propertyId: 'p-08',
    agentId: 'a-01',
    scheduledAt: '2026-07-19T12:00:00+02:00',
    status: 'confirmada',
    createdAt: '2026-07-15T14:02:00+02:00',
  },
  {
    id: 'v-seed-04',
    leadId: 'l-04',
    propertyId: 'p-04',
    agentId: 'a-02',
    scheduledAt: '2026-07-15T18:00:00+02:00',
    status: 'realizada',
    feedback: 'Muy buena impresión; dudan por el precio. Valorar ajuste o mejora.',
    createdAt: '2026-07-13T11:00:00+02:00',
  },
  {
    id: 'v-seed-05',
    leadId: 'l-02',
    propertyId: 'p-02',
    agentId: 'a-01',
    scheduledAt: '2026-07-14T17:00:00+02:00',
    status: 'realizada',
    feedback: 'Segunda visita. Presentó oferta de 328.000 € al día siguiente.',
    createdAt: '2026-07-12T09:30:00+02:00',
  },
];

/* ------------------------------------------------------------------ Tareas */

export const seedTasks: Task[] = [
  {
    id: 't-seed-01',
    agentId: 'a-01',
    leadId: 'l-01',
    propertyId: 'p-01',
    title: 'Confirmar visita de Marta a las 18:30',
    detail: 'Responder al último WhatsApp y cerrar hora definitiva.',
    dueAt: '2026-07-17T14:00:00+02:00',
    done: false,
    createdAt: '2026-07-17T09:30:00+02:00',
  },
  {
    id: 't-seed-02',
    agentId: 'a-01',
    leadId: 'l-02',
    propertyId: 'p-02',
    title: 'Trasladar respuesta de la propiedad a José Luis',
    detail: 'Plazo de respuesta de la oferta: 48 h.',
    dueAt: '2026-07-17T19:00:00+02:00',
    done: false,
    createdAt: '2026-07-17T09:00:00+02:00',
  },
  {
    id: 't-seed-03',
    agentId: 'a-02',
    leadId: 'l-03',
    title: 'Primer contacto con Carmen (lead nuevo)',
    detail: 'Cualificar presupuesto y proponer visita al CAS-0405.',
    dueAt: '2026-07-17T11:00:00+02:00',
    done: false,
    createdAt: '2026-07-17T08:00:00+02:00',
  },
  {
    id: 't-seed-04',
    agentId: 'a-02',
    leadId: 'l-07',
    propertyId: 'p-07',
    title: 'Recordatorio suave a Lucía (valoración)',
    dueAt: '2026-07-20T09:00:00+02:00',
    done: false,
    createdAt: '2026-07-15T20:50:00+02:00',
  },
  {
    id: 't-seed-05',
    agentId: 'a-01',
    propertyId: 'p-15',
    title: 'Publicar el estudio de La Losa en portales',
    detail: 'Fotos listas; revisar textos y destacar rentabilidad.',
    dueAt: '2026-07-18T10:00:00+02:00',
    done: true,
    createdAt: '2026-07-16T12:00:00+02:00',
  },
  {
    id: 't-seed-06',
    agentId: 'a-01',
    leadId: 'l-12',
    propertyId: 'p-12',
    title: 'Enviar rent roll del edificio de Sabugo',
    detail: 'Preparar contratos vigentes y cuadro de rentas.',
    dueAt: '2026-07-18T13:00:00+02:00',
    done: false,
    createdAt: '2026-07-11T10:10:00+02:00',
  },
];

/* ---------------------------------------------------------- Notificaciones */

/** Notificaciones de ejemplo (userId se resuelve al uid real al sembrar). */
export const seedNotifications: Array<Omit<AppNotification, 'userId'> & { agentId: string }> = [
  {
    id: 'n-seed-01',
    agentId: 'a-01',
    kind: 'nuevo-mensaje',
    title: 'Marta Fernández ha respondido',
    body: '«¿Podría ser el jueves a última hora? Salgo de trabajar a las 18:00.»',
    link: '/inbox',
    read: false,
    createdAt: '2026-07-17T09:24:00+02:00',
  },
  {
    id: 'n-seed-02',
    agentId: 'a-01',
    kind: 'nuevo-lead',
    title: 'Nuevo lead desde portal',
    body: 'Carmen Álvarez pregunta por el piso junto al Campo San Francisco (CAS-0405).',
    link: '/inbox',
    read: false,
    createdAt: '2026-07-17T07:58:00+02:00',
  },
  {
    id: 'n-seed-03',
    agentId: 'a-02',
    kind: 'visita',
    title: 'Visita confirmada mañana · 10:00',
    body: 'Hostelería El Fontán visita el local de La Corredoria (CAS-0366).',
    link: '/inbox',
    read: true,
    createdAt: '2026-07-16T13:15:00+02:00',
  },
];
