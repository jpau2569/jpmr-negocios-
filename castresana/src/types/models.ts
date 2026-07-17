/* ============================================================================
   CASTRESANA — Modelo de datos Firestore
   ----------------------------------------------------------------------------
   Entidades persistentes de la plataforma. Convenciones:
   · Todas las fechas viajan por la app como ISO 8601 (string). La capa
     Firestore convierte Timestamp ↔ ISO en los conversores (lib/firebase).
   · Los ids de documento se duplican en el campo `id` para comodidad de la UI.
   · El esquema completo de colecciones está documentado en docs/FIRESTORE.md.
   ============================================================================ */

import type { Channel, ID, Intent, LeadStage } from './index';

/* ----------------------------------------------------------------- Agentes */

export type AgentRole = 'admin' | 'agente';

/** Perfil comercial (colección `agents`). Se vincula a Auth por `uid`. */
export interface Agent {
  id: ID;
  /** uid de Firebase Auth; null hasta que el agente activa su cuenta. */
  uid: string | null;
  name: string;
  email: string;
  phone?: string;
  role: AgentRole;
  active: boolean;
  createdAt: string;
}

/** Documento de usuario (colección `users`, id = uid de Auth). */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  /** Referencia a `agents/{agentId}` si el usuario es un agente. */
  agentId: ID | null;
  role: AgentRole;
  notificationPrefs: NotificationPreferences;
  createdAt: string;
}

/* ---------------------------------------------------------- Conversaciones */

/**
 * Cabecera de conversación (colección `conversations`).
 * Los mensajes viven en la subcolección `conversations/{id}/messages` para
 * paginar hilos largos sin cargar el documento padre.
 */
export interface Conversation {
  id: ID;
  leadId: ID;
  agentId: ID | null;
  channel: Channel;
  subject?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  /** Mensajes entrantes sin leer por el agente. */
  unreadCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ Visitas */

export type VisitStatus = 'propuesta' | 'confirmada' | 'realizada' | 'cancelada';

/** Visita comercial a un inmueble (colección `visits`). */
export interface Visit {
  id: ID;
  leadId: ID;
  propertyId: ID;
  agentId: ID;
  scheduledAt: string;
  status: VisitStatus;
  notes?: string;
  /** Feedback tras la visita (se rellena al marcarla realizada). */
  feedback?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------- Tareas */

/** Tarea de seguimiento comercial (colección `tasks`). */
export interface Task {
  id: ID;
  agentId: ID;
  leadId?: ID;
  propertyId?: ID;
  title: string;
  detail?: string;
  dueAt: string;
  done: boolean;
  createdAt: string;
}

/* ---------------------------------------------------------- Notificaciones */

export type NotificationKind =
  | 'nuevo-lead'
  | 'nuevo-mensaje'
  | 'visita'
  | 'tarea'
  | 'oferta'
  | 'sistema';

/** Notificación in-app / push (colección `notifications`). */
export interface AppNotification {
  id: ID;
  /** uid del usuario destinatario. */
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Ruta interna a la que navegar al pulsarla (p. ej. /inbox). */
  link?: string;
  read: boolean;
  createdAt: string;
}

/** Preferencias de notificación del usuario (embebidas en `users`). */
export interface NotificationPreferences {
  /** Push web (FCM) activado. */
  push: boolean;
  /** Resumen por email (futuro). */
  email: boolean;
  newLead: boolean;
  newMessage: boolean;
  visitReminder: boolean;
  taskReminder: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  push: false,
  email: false,
  newLead: true,
  newMessage: true,
  visitReminder: true,
  taskReminder: true,
};

/* ------------------------------------------------------- Matching (futuro IA) */

export type MatchStatus = 'nueva' | 'enviada' | 'descartada';

/**
 * Sugerencia lead ↔ inmueble (colección `matchSuggestions`).
 * Hoy las genera una regla determinista; mañana, el motor de matching.
 * La UI no distingue el origen: solo lee score y reason.
 */
export interface MatchSuggestion {
  id: ID;
  leadId: ID;
  propertyId: ID;
  /** Afinidad 0-100. */
  score: number;
  /** Motivo legible del encaje. */
  reason: string;
  status: MatchStatus;
  createdAt: string;
}

/* ------------------------------------------------------ Analítica (diaria) */

/** Agregado diario para el dashboard (colección `analyticsDaily`, id = YYYY-MM-DD). */
export interface AnalyticsDaily {
  id: string;
  date: string;
  newLeads: number;
  messagesIn: number;
  messagesOut: number;
  visitsScheduled: number;
  visitsDone: number;
  offersActive: number;
  byStage: Partial<Record<LeadStage, number>>;
}

/* ------------------------------------------------------- Resumen dashboard */

/** Datos del panel comercial (calculado por dashboardRepository). */
export interface DashboardSummary {
  activeLeads: number;
  unreadConversations: number;
  upcomingVisits: number;
  pendingTasks: number;
  availableProperties: number;
  byStage: Record<LeadStage, number>;
  byIntent: Record<Intent, number>;
}
