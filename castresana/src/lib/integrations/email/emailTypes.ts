/* ============================================================================
   Email — tipos de la integración.
   Preparado para Resend / SendGrid / SMTP desde ruta de servidor; hoy mock.
   ============================================================================ */

import type { DeliveryStatus } from '@/types/automation';

export type EmailTemplateKind =
  | 'em-bienvenida'
  | 'em-envio-inmuebles'
  | 'em-confirmacion-visita'
  | 'em-recordatorio'
  | 'em-post-visita'
  | 'em-captacion-propietario'
  | 'em-envio-dossier';

export interface EmailTemplate {
  id: EmailTemplateKind;
  name: string;
  description: string;
  /** Asunto con variables. */
  subject: string;
  /** Cuerpo en texto plano con variables {{x}} (HTML llegará con el proveedor). */
  body: string;
  variables: string[];
}

export interface EmailSendRequest {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  templateId?: EmailTemplateKind;
  origin: 'manual' | 'workflow' | 'ia';
}

export interface EmailSendResult {
  ok: boolean;
  providerMessageId: string;
  status: DeliveryStatus;
  error?: string;
}

/** Contrato del proveedor de email (mock hoy; Resend/SendGrid mañana). */
export interface EmailProvider {
  name: string;
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}
