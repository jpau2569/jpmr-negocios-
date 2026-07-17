/* ============================================================================
   CASTRESANA — Modelo de dominio
   Contrato de datos compartido. Cuando conectemos Firebase, estos tipos
   serán la única fuente de verdad entre la capa de datos y la UI.
   ============================================================================ */

export type ID = string;

/* Modelo Firestore (agentes, visitas, tareas, notificaciones, matching…). */
export * from './models';

/* ---------------------------------------------------------------- Canales */

export type Channel = 'whatsapp' | 'email' | 'portal' | 'telefono' | 'web';

/* ----------------------------------------------------------------- Embudo */

export type LeadStage = 'nuevo' | 'seguimiento' | 'visita' | 'oferta' | 'cerrado';

export type Intent = 'compra' | 'alquiler' | 'venta';

/* ------------------------------------------------------------------ Leads */

export interface Lead {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  stage: LeadStage;
  intent: Intent;
  channel: Channel;
  /** Zona de interés (barrios de Oviedo / Asturias). */
  zone: string;
  budgetMin?: number;
  budgetMax?: number;
  tags: string[];
  propertyId?: ID;
  unread: number;
  pinned?: boolean;
  lastMessageAt: string; // ISO
  lastMessagePreview: string;
  createdAt: string; // ISO
}

/* --------------------------------------------------------------- Mensajes */

export type MessageDirection = 'in' | 'out';

export interface Message {
  id: ID;
  leadId: ID;
  direction: MessageDirection;
  body: string;
  sentAt: string; // ISO
}

/* ------------------------------------------------------------ Propiedades */

export type PropertyKind = 'piso' | 'atico' | 'casa' | 'chalet' | 'local' | 'terreno';

export type ListingStatus = 'disponible' | 'reservado' | 'vendido';

export interface Property {
  id: ID;
  reference: string; // "CAS-0412"
  title: string;
  kind: PropertyKind;
  zone: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  operation: 'venta' | 'alquiler';
  status: ListingStatus;
  /** Etiquetas comerciales: "Reformado", "Terraza", "Inversión"… */
  tags: string[];
  /** Par de colores del placeholder de foto (gradiente cálido de la paleta). */
  palette: [string, string];
  /** Nº de fotos disponibles (mock). */
  photos: number;
  /** Tiene tour en vídeo asociado. */
  hasVideo?: boolean;
  /** Destacada para hero / rail premium. */
  featured?: boolean;
  description: string;
  features: string[];
  floor?: string;
  yearBuilt?: number;
  /** Rentabilidad estimada (solo inversión), en %. */
  yieldPct?: number;
  publishedAt: string; // ISO
}

/* ------------------------------------------------------------------ Vídeo */

export type VideoKind = 'tour' | 'dron' | 'reel' | 'zona';

export interface PropertyVideo {
  id: ID;
  propertyId: ID;
  title: string;
  subtitle: string;
  kind: VideoKind;
  /** Duración legible: "2:34". */
  duration: string;
  palette: [string, string];
}

/* ------------------------------------------------- Timeline / seguimiento */

export type TimelineKind =
  | 'creado'
  | 'mensaje'
  | 'llamada'
  | 'visita'
  | 'oferta'
  | 'nota'
  | 'tarea';

export interface TimelineEvent {
  id: ID;
  leadId: ID;
  kind: TimelineKind;
  title: string;
  detail?: string;
  at: string; // ISO
  /** Para tareas: pendiente o completada. */
  done?: boolean;
}
