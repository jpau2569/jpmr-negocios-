/* ============================================================================
   CASTRESANA — Tipos de la capa de IA comercial
   ----------------------------------------------------------------------------
   Contrato entre el motor (lib/ai), los servicios (lib/services) y la UI
   (components/ai). Regla de la casa: TODO resultado lleva razones cortas y
   legibles — nada de puntuaciones opacas.
   ============================================================================ */

import type { ID } from './index';

type OperationKind = 'venta' | 'alquiler';

/* ------------------------------------------------------------ Lead scoring */

export type ScoreLabel = 'frio' | 'templado' | 'caliente';

/** Señal individual que suma o resta al score (visible en la explicación). */
export interface ScoreSignal {
  label: string;
  points: number;
}

export interface LeadScore {
  leadId: ID;
  /** 0-100. */
  score: number;
  label: ScoreLabel;
  /** Señales aplicadas, ordenadas por impacto. */
  signals: ScoreSignal[];
  /** Explicación de una línea para la UI. */
  explanation: string;
}

/* ------------------------------------------------------ Intención comercial */

export type CommercialIntent =
  | 'compra-inmediata'
  | 'busqueda-activa'
  | 'exploracion'
  | 'inversion'
  | 'alquiler-urgente'
  | 'propietario-vendedor'
  | 'captacion-potencial';

export interface IntentClassification {
  intent: CommercialIntent;
  /** Etiqueta legible («Compra inmediata»). */
  label: string;
  confidence: 'alta' | 'media' | 'baja';
  reasons: string[];
}

/* ------------------------------------------------------------------ Resumen */

export interface LeadSummary {
  leadId: ID;
  /** Qué busca («Piso de 2-3 hab. en Centro — Uría, compra»). */
  seeks: string;
  budget: string;
  zone: string;
  /** Estado actual en lenguaje comercial. */
  status: string;
  /** Objeciones detectadas en la conversación. */
  objections: string[];
  /** Último contacto en relativo («hace 2 h, entrante»). */
  lastContact: string;
  /** Tono de interés («Alto: responde en el día y pide visita»). */
  interestTone: string;
  /** Siguiente paso recomendado (deriva de NextAction). */
  nextStep: string;
}

/* ------------------------------------------------------ Respuestas sugeridas */

export type ReplyKind =
  | 'primera-respuesta'
  | 'propuesta-visita'
  | 'envio-inmuebles'
  | 'seguimiento-silencio'
  | 'respuesta-objecion'
  | 'cierre-suave'
  | 'recuperacion';

export interface SuggestedReply {
  kind: ReplyKind;
  /** Etiqueta corta del chip («Proponer visita»). */
  label: string;
  /** Texto listo para insertar en el composer (editable por el agente). */
  text: string;
  /** Por qué se sugiere. */
  reason: string;
}

/* -------------------------------------------------------- Siguiente acción */

export type NextActionKind =
  | 'responder-ahora'
  | 'llamar-hoy'
  | 'proponer-visita'
  | 'confirmar-visita'
  | 'enviar-inmuebles'
  | 'pedir-financiacion'
  | 'solicitar-documentacion'
  | 'recontactar-48h'
  | 'derivar-agente'
  | 'archivar-temporal';

export interface NextAction {
  kind: NextActionKind;
  label: string;
  /** Razonamiento corto visible («Lleva 2 mensajes sin respuesta y es caliente»). */
  reason: string;
  urgency: 'hoy' | 'esta-semana' | 'sin-prisa';
}

/* ------------------------------------------------------------------ Matching */

export interface PropertyMatch {
  propertyId: ID;
  reference: string;
  title: string;
  price: number;
  operation: OperationKind;
  zone: string;
  /** Encaje 0-100. */
  score: number;
  reasons: string[];
}

/* ------------------------------------------------------------------- Alertas */

export type AlertKind =
  | 'caliente-sin-respuesta'
  | 'visita-sin-confirmar'
  | 'captacion-compatible'
  | 'lead-enfriandose'
  | 'inmueble-con-demanda'
  | 'sin-seguimiento';

export interface SmartAlert {
  id: string;
  kind: AlertKind;
  severity: 'alta' | 'media' | 'baja';
  title: string;
  detail: string;
  leadId?: ID;
  propertyId?: ID;
  /** Ruta interna a la que llevar al agente. */
  link: string;
}

/* -------------------------------------------------- Agregado por lead (UI) */

export interface LeadInsights {
  leadId: ID;
  score: LeadScore;
  intent: IntentClassification;
  summary: LeadSummary;
  replies: SuggestedReply[];
  nextAction: NextAction;
  /** Top propiedades del stock que encajan. */
  matches: PropertyMatch[];
}

/* ------------------------------------------------------- Panel IA (dashboard) */

export interface PriorityLead {
  leadId: ID;
  name: string;
  zone: string;
  unread: number;
  score: number;
  label: ScoreLabel;
  action: NextAction;
}

export interface Opportunity {
  leadId: ID;
  leadName: string;
  match: PropertyMatch;
}

export interface PropertyDemand {
  propertyId: ID;
  reference: string;
  title: string;
  /** Nº de leads activos con encaje ≥ umbral. */
  matchCount: number;
  topScore: number;
}

export interface AgentLoad {
  agentId: ID;
  name: string;
  openTasks: number;
  upcomingVisits: number;
}

/** Pulso comercial del día: todo lo que el panel IA necesita pintar. */
export interface CommercialPulse {
  generatedAt: string;
  priorityLeads: PriorityLead[];
  alerts: SmartAlert[];
  opportunities: Opportunity[];
  propertyDemand: PropertyDemand[];
  agentLoad: AgentLoad[];
  /** Recomendaciones del día en una línea cada una. */
  dailyTips: string[];
}
