/* ============================================================================
   CASTRESANA — Tipos de dominio
   Modelo de datos base de la PWA inmobiliaria. Sin dependencias externas:
   cuando conectemos el backend, estos tipos serán el contrato compartido.
   ============================================================================ */

export type ID = string;

/* ------------------------------------------------------------------ Canales */

export type Channel = 'whatsapp' | 'email' | 'portal' | 'phone' | 'web';

/* -------------------------------------------------------------------- Leads */

export type LeadStage =
  | 'nuevo'
  | 'contactado'
  | 'cualificado'
  | 'visita'
  | 'oferta'
  | 'cerrado'
  | 'perdido';

export type LeadTemperature = 'frio' | 'templado' | 'caliente';

export interface Lead {
  id: ID;
  name: string;
  initials: string;
  email?: string;
  phone?: string;
  stage: LeadStage;
  temperature: LeadTemperature;
  channel: Channel;
  budgetMin?: number;
  budgetMax?: number;
  /** Referencias de propiedades de interés. */
  interestedIn: ID[];
  assignedTo?: string;
  createdAt: string; // ISO
  lastActivityAt: string; // ISO
  notes?: string;
}

/* --------------------------------------------------------------- Propiedades */

export type PropertyKind =
  | 'piso'
  | 'atico'
  | 'casa'
  | 'chalet'
  | 'local'
  | 'oficina'
  | 'terreno';

export type PropertyStatus = 'disponible' | 'reservado' | 'vendido' | 'borrador';
export type Operation = 'venta' | 'alquiler';

export interface Property {
  id: ID;
  reference: string; // p.ej. "CAS-0421"
  title: string;
  kind: PropertyKind;
  operation: Operation;
  status: PropertyStatus;
  price: number;
  currency: 'EUR';
  address: string;
  city: string;
  neighborhood?: string;
  bedrooms: number;
  bathrooms: number;
  areaBuilt: number; // m²
  areaUsable?: number; // m²
  features: string[];
  description?: string;
  createdAt: string; // ISO
}

/* ------------------------------------------------------- Inbox / Mensajería */

export type MessageDirection = 'inbound' | 'outbound';

export interface Message {
  id: ID;
  direction: MessageDirection;
  author: string;
  body: string;
  sentAt: string; // ISO
  read: boolean;
}

export interface Conversation {
  id: ID;
  leadId: ID;
  leadName: string;
  initials: string;
  channel: Channel;
  subject: string;
  preview: string;
  unread: number;
  pinned?: boolean;
  temperature: LeadTemperature;
  stage: LeadStage;
  /** Referencia de propiedad asociada, si la hay. */
  propertyRef?: string;
  updatedAt: string; // ISO
  messages: Message[];
}
