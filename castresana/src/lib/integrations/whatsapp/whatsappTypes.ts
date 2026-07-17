/* ============================================================================
   WhatsApp — tipos de la integración.
   Diseñados para mapear 1:1 con Twilio / WhatsApp Business API cuando se
   conecte el proveedor real; hoy la implementación es mock.
   ============================================================================ */

import type { DeliveryStatus } from '@/types/automation';

export type WhatsAppTemplateKind =
  | 'wa-primera-respuesta'
  | 'wa-propuesta-visita'
  | 'wa-envio-inmuebles'
  | 'wa-seguimiento'
  | 'wa-recuperacion'
  | 'wa-recordatorio-visita';

export interface WhatsAppTemplate {
  id: WhatsAppTemplateKind;
  name: string;
  description: string;
  /** Cuerpo con variables {{nombre}}, {{referencia}}, {{zona}}, {{fecha}}, {{lista}}. */
  body: string;
  variables: string[];
}

export interface WhatsAppSendRequest {
  leadId: string;
  /** Teléfono en formato E.164 (+34…). */
  to: string;
  body: string;
  templateId?: WhatsAppTemplateKind;
  origin: 'manual' | 'workflow' | 'ia';
}

export interface WhatsAppSendResult {
  ok: boolean;
  /** Id del mensaje en el proveedor (mock: generado localmente). */
  providerMessageId: string;
  status: DeliveryStatus;
  error?: string;
}

/**
 * Contrato del proveedor. Implementaciones previstas:
 *  · mockWhatsAppProvider (actual): registra el envío y simula entrega.
 *  · twilioProvider / metaCloudProvider: llamada real desde ruta de servidor
 *    (las credenciales NUNCA van al navegador).
 */
export interface WhatsAppProvider {
  name: string;
  send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
}
