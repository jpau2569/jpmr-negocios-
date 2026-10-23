/* ============================================================================
   whatsappService — envío y registro de WhatsApp.
   Implementación actual: mock (sin red). Registra cada envío como
   Communication con estados simulados de entrega, de modo que el historial,
   el activity center y el dashboard ya funcionan de verdad.
   Conectar Twilio/Meta = implementar WhatsAppProvider en una ruta de
   servidor y sustituir el provider aquí. Nada más cambia.
   ============================================================================ */

import type { Communication } from '@/types/automation';
import type {
  WhatsAppProvider,
  WhatsAppSendRequest,
  WhatsAppSendResult,
  WhatsAppTemplateKind,
} from './whatsappTypes';
import { WHATSAPP_TEMPLATES, renderTemplate } from './whatsappTemplates';

/* Registro en memoria de la sesión (mock). Con Firestore real, esto escribe
   en la colección `communications`. */
const sentLog: Communication[] = [];

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36).padStart(4, '0')}`;
}

export const mockWhatsAppProvider: WhatsAppProvider = {
  name: 'mock',
  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    // Simulación honesta: en mock todo se "entrega"; con proveedor real,
    // estos estados llegarán por webhook.
    return {
      ok: true,
      providerMessageId: nextId('wamock'),
      status: 'entregado',
    };
  },
};

/** Provider activo. Sustituir por twilioProvider cuando se conecte. */
export const whatsappProvider: WhatsAppProvider = mockWhatsAppProvider;

export interface SendWhatsAppInput {
  leadId: string;
  to: string;
  templateId: WhatsAppTemplateKind;
  values: Record<string, string>;
  origin?: Communication['origin'];
  now?: Date;
}

/** Renderiza plantilla, envía por el provider y registra la comunicación. */
export async function sendWhatsAppTemplate(input: SendWhatsAppInput): Promise<Communication> {
  const template = WHATSAPP_TEMPLATES[input.templateId];
  const rendered = renderTemplate(template, input.values);

  if (rendered.missing.length > 0) {
    throw new Error(
      `Plantilla ${template.id}: faltan variables ${rendered.missing.join(', ')}.`,
    );
  }

  const result = await whatsappProvider.send({
    leadId: input.leadId,
    to: input.to,
    body: rendered.body,
    templateId: input.templateId,
    origin: input.origin ?? 'manual',
  });

  const communication: Communication = {
    id: nextId('comm-wa'),
    leadId: input.leadId,
    channel: 'whatsapp',
    direction: 'out',
    templateId: input.templateId,
    body: rendered.body,
    status: result.status,
    sentAt: (input.now ?? new Date()).toISOString(),
    origin: input.origin ?? 'manual',
  };
  sentLog.push(communication);
  return communication;
}

/** Historial de envíos de la sesión (mock). */
export function getWhatsAppLog(leadId?: string): Communication[] {
  return leadId ? sentLog.filter((c) => c.leadId === leadId) : [...sentLog];
}
