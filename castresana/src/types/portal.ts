/* ============================================================================
   CASTRESANA — Tipos de los portales externos (cliente y propietario)
   ----------------------------------------------------------------------------
   Regla de oro: los portales muestran SOLO información pensada para el
   destinatario. Los view models traducen el modelo interno a este contrato;
   nada de scores IA, notas internas ni datos de terceros.
   ============================================================================ */

import type { ID } from './index';

/* ------------------------------------------------------------------ Acceso */

export type PortalRole = 'client' | 'owner';

export type PortalPermission =
  /* comunes */
  | 'view-portal'
  | 'view-documents'
  /* cliente */
  | 'view-recommendations'
  | 'mark-interest'
  | 'request-visit'
  /* propietario */
  | 'view-metrics'
  | 'view-activity'
  /* futuro: el propietario aprueba cambios (precio, marketing) */
  | 'approve-actions';

interface PortalSessionBase {
  token: ID;
  role: PortalRole;
  createdAt: string;
  /** ISO; pasado este momento el enlace muestra «caducado». */
  expiresAt: string;
  permissions: PortalPermission[];
}

/** Sesión de portal de cliente comprador/inquilino (ligada a un lead). */
export interface ClientPortalSession extends PortalSessionBase {
  role: 'client';
  leadId: ID;
}

/** Sesión de portal de propietario (ligada a un inmueble; lead opcional). */
export interface OwnerPortalSession extends PortalSessionBase {
  role: 'owner';
  propertyId: ID;
  /** Lead vendedor asociado, si existe en el sistema. */
  leadId?: ID;
  /** Nombre a mostrar cuando no hay lead. */
  ownerName: string;
}

export type PortalSession = ClientPortalSession | OwnerPortalSession;

export type PortalResolution =
  | { ok: true; session: PortalSession }
  | { ok: false; reason: 'invalid' | 'expired' };

/* ----------------------------------------------- Selección para el cliente */

export type SelectionStatus = 'nueva' | 'enviada' | 'interesa' | 'descartada' | 'visitada';

/** Inmueble compartido con el cliente, con motivo en su lenguaje. */
export interface SharedPropertySelection {
  propertyId: ID;
  /** Por qué se la enviamos, escrito PARA el cliente. */
  reason: string;
  status: SelectionStatus;
  sharedAt: string;
}

/* -------------------------------------------------------- Visitas (portal) */

export interface PortalVisit {
  id: ID;
  propertyId: ID;
  propertyLabel: string;
  scheduledAt: string;
  status: 'propuesta' | 'confirmada' | 'realizada' | 'cancelada';
  /** Nota apta para el destinatario (sin comentarios internos). */
  note?: string;
}

/* ------------------------------------------------------ Timeline (portal) */

export type PortalTimelineKind =
  | 'publicacion'
  | 'marketing'
  | 'interes'
  | 'visita'
  | 'comunicacion'
  | 'documento'
  | 'hito';

export interface PortalTimelineEvent {
  id: string;
  kind: PortalTimelineKind;
  title: string;
  detail?: string;
  at: string;
}

/* ---------------------------------------------------- Métricas propietario */

export interface OwnerMetrics {
  daysOnMarket: number;
  portalViews: number;
  favorites: number;
  contacts: number;
  /** Compradores de nuestra cartera que encajan (sin identificarlos). */
  matchingBuyers: number;
  visitsDone: number;
  visitsPending: number;
  /** Feedback agregado de visitas, en lenguaje neutro. */
  feedbackSummary: string[];
}

/** Acción de marketing realizada sobre el inmueble. */
export interface MarketingAction {
  id: string;
  title: string;
  detail?: string;
  at: string;
  done: boolean;
}

/* -------------------------------------------------------------- Documentos */

export interface PortalDocument {
  id: string;
  title: string;
  description: string;
  /** Disponible para descargar/generar, o pendiente de preparación. */
  available: boolean;
  updatedAt?: string;
}

/* ------------------------------------------------------------- View models */

/** Todo lo que la home del portal de cliente necesita pintar. */
export interface ClientPortalViewModel {
  clientName: string;
  agent: { name: string; phone?: string; email?: string };
  /** Resumen de su búsqueda, en su lenguaje. */
  searchSummary: string;
  budgetLabel: string;
  zoneLabel: string;
  /** Próximos pasos escritos PARA el cliente. */
  nextSteps: string[];
  selections: SharedPropertySelection[];
  visits: PortalVisit[];
  /** Resumen de comunicaciones apto para cliente. */
  communications: PortalTimelineEvent[];
  documents: PortalDocument[];
  expiresAt: string;
}

/** Todo lo que la home del portal de propietario necesita pintar. */
export interface OwnerPortalViewModel {
  ownerName: string;
  agent: { name: string; phone?: string; email?: string };
  property: {
    id: ID;
    reference: string;
    title: string;
    zone: string;
    city: string;
    price: number;
    operation: 'venta' | 'alquiler';
    status: 'disponible' | 'reservado' | 'vendido';
    publishedAt: string;
    photos: number;
    hasVideo?: boolean;
    palette: [string, string];
  };
  metrics: OwnerMetrics;
  marketing: MarketingAction[];
  timeline: PortalTimelineEvent[];
  visits: PortalVisit[];
  /** Sugerencias del agente al propietario (transparencia). */
  suggestions: string[];
  documents: PortalDocument[];
  expiresAt: string;
}
