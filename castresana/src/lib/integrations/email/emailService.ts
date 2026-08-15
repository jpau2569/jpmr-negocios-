/* ============================================================================
   emailService — envío y registro de emails comerciales.
   Mock hoy (registro local con estados simulados); Resend/SendGrid/SMTP
   mañana implementando EmailProvider en una ruta de servidor.
   ============================================================================ */

import type { Communication } from '@/types/automation';
import type { EmailProvider, EmailTemplateKind } from './emailTypes';
import { EMAIL_TEMPLATES, renderEmailTemplate, type RenderedEmail } from './emailTemplates';

const sentLog: Communication[] = [];

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36).padStart(4, '0')}`;
}

export const mockEmailProvider: EmailProvider = {
  name: 'mock',
  async send() {
    return { ok: true, providerMessageId: nextId('emmock'), status: 'enviado' as const };
  },
};

/** Provider activo. Sustituir al conectar Resend/SendGrid. */
export const emailProvider: EmailProvider = mockEmailProvider;

export interface SendEmailInput {
  leadId: string;
  to: string;
  templateId: EmailTemplateKind;
  values: Record<string, string>;
  origin?: Communication['origin'];
  now?: Date;
}

/** Vista previa sin enviar (para la UI de plantillas). */
export function previewEmail(
  templateId: EmailTemplateKind,
  values: Record<string, string>,
): RenderedEmail {
  return renderEmailTemplate(EMAIL_TEMPLATES[templateId], values);
}

/** Renderiza, envía por el provider y registra la comunicación. */
export async function sendEmailTemplate(input: SendEmailInput): Promise<Communication> {
  const rendered = previewEmail(input.templateId, input.values);
  if (rendered.missing.length > 0) {
    throw new Error(
      `Plantilla ${input.templateId}: faltan variables ${rendered.missing.join(', ')}.`,
    );
  }

  const result = await emailProvider.send({
    leadId: input.leadId,
    to: input.to,
    subject: rendered.subject,
    body: rendered.body,
    templateId: input.templateId,
    origin: input.origin ?? 'manual',
  });

  const communication: Communication = {
    id: nextId('comm-em'),
    leadId: input.leadId,
    channel: 'email',
    direction: 'out',
    templateId: input.templateId,
    subject: rendered.subject,
    body: rendered.body,
    status: result.status,
    sentAt: (input.now ?? new Date()).toISOString(),
    origin: input.origin ?? 'manual',
  };
  sentLog.push(communication);
  return communication;
}

/** Historial de envíos de la sesión (mock). */
export function getEmailLog(leadId?: string): Communication[] {
  return leadId ? sentLog.filter((c) => c.leadId === leadId) : [...sentLog];
}
