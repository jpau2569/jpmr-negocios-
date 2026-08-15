/* ============================================================================
   CASTRESANA — Tipos de automatización comercial
   ----------------------------------------------------------------------------
   Workflows, comunicaciones (WhatsApp/email), documentos y actividad
   unificada. Igual que la capa IA: todo artefacto lleva detalle legible.
   ============================================================================ */

import type { ID } from './index';

/* ------------------------------------------------------- Comunicaciones */

export type CommunicationChannel = 'whatsapp' | 'email';

/** Estados de entrega (mock hoy; mapean 1:1 a Twilio/Resend mañana). */
export type DeliveryStatus =
  | 'borrador'
  | 'en-cola'
  | 'enviado'
  | 'entregado'
  | 'leido'
  | 'fallido';

/** Registro de envío (colección `communications`). */
export interface Communication {
  id: ID;
  leadId: ID;
  agentId?: ID;
  channel: CommunicationChannel;
  direction: 'out' | 'in';
  /** Plantilla usada, si aplica. */
  templateId?: string;
  /** Solo email. */
  subject?: string;
  body: string;
  status: DeliveryStatus;
  sentAt: string; // ISO
  /** Origen del envío: manual, workflow o sugerencia IA. */
  origin: 'manual' | 'workflow' | 'ia';
}

/** Plantilla reutilizable (colección `communicationTemplates`). */
export interface CommunicationTemplate {
  id: string;
  channel: CommunicationChannel;
  name: string;
  description: string;
  /** Solo email. */
  subject?: string;
  /** Cuerpo con variables {{nombre}}, {{referencia}}, {{zona}}, {{fecha}}… */
  body: string;
  variables: string[];
}

/* ------------------------------------------------------------- Workflows */

export type WorkflowTrigger =
  | 'lead-nuevo'
  | 'caliente-sin-respuesta'
  | 'visita-solicitada'
  | 'visita-confirmada'
  | 'sin-respuesta-48h'
  | 'captacion-nueva'
  | 'vendedor-detectado';

export type WorkflowActionType =
  | 'crear-tarea'
  | 'generar-alerta'
  | 'sugerir-respuesta'
  | 'crear-visita'
  | 'programar-recordatorio'
  | 'generar-recomendaciones'
  | 'iniciar-captacion'
  | 'enviar-plantilla';

export interface WorkflowActionSpec {
  type: WorkflowActionType;
  /** Parámetros declarativos (p. ej. { plantilla: 'wa-recordatorio-visita' }). */
  params?: Record<string, string>;
}

/** Regla de automatización. */
export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  /** Ids de condiciones registradas en conditions.ts. */
  conditions: string[];
  actions: WorkflowActionSpec[];
  enabled: boolean;
}

/** Ejecución registrada de una regla (colección `workflowRuns`). */
export interface WorkflowRun {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: WorkflowTrigger;
  leadId?: ID;
  propertyId?: ID;
  firedAt: string; // ISO
  /** Acciones ejecutadas, en lenguaje legible. */
  actionsExecuted: string[];
  result: 'ok' | 'parcial' | 'omitido';
  detail: string;
}

/* ------------------------------------------------------------ Documentos */

export type DocumentKind =
  | 'propuesta-comercial'
  | 'ficha-inmueble'
  | 'resumen-visita'
  | 'contrato-reserva'
  | 'contrato-arras'
  | 'contrato-alquiler'
  | 'dossier-propietario'
  | 'resumen-lead';

/** Documento generado (colección `generatedDocuments`). */
export interface GeneratedDocument {
  id: ID;
  kind: DocumentKind;
  title: string;
  leadId?: ID;
  propertyId?: ID;
  visitId?: ID;
  createdAt: string;
  /** Ruta en Storage cuando exista el PDF real. */
  storagePath?: string;
  status: 'generado' | 'plantilla-pendiente';
}

/** Contenido estructurado de un documento (render → HTML/PDF). */
export interface DocumentContent {
  kind: DocumentKind;
  title: string;
  subtitle?: string;
  sections: DocumentSection[];
  footer: string;
}

export interface DocumentSection {
  heading: string;
  /** Párrafos o pares clave-valor. */
  paragraphs?: string[];
  facts?: Array<{ label: string; value: string }>;
}

/* --------------------------------------------------- Actividad unificada */

export type ActivityKind =
  | 'mensaje'
  | 'whatsapp'
  | 'email'
  | 'estado'
  | 'tarea'
  | 'visita'
  | 'ia'
  | 'workflow'
  | 'documento';

/** Evento del timeline comercial unificado (activity center). */
export interface ActivityEvent {
  id: string;
  leadId?: ID;
  kind: ActivityKind;
  title: string;
  detail?: string;
  at: string; // ISO
}

/* ------------------------------------------------------- Preferencias */

/** Configuración de automatización (por agencia; luego por agente). */
export interface AutomationPreferences {
  /** Recordatorios de visita activados. */
  visitReminders: boolean;
  /** Horas de silencio antes de sugerir seguimiento. */
  followUpAfterHours: number;
  /** Horas máximas de un caliente sin respuesta antes de alertar. */
  hotLeadMaxSilenceHours: number;
  /** Canal preferido para el primer contacto. */
  preferredChannel: CommunicationChannel;
  /** Plantilla por defecto por tipo de situación. */
  defaultTemplates: Partial<Record<'primeraRespuesta' | 'seguimiento' | 'recordatorioVisita', string>>;
  /** Crear tareas automáticamente desde workflows. */
  autoCreateTasks: boolean;
}
