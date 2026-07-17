'use client';

import { useMemo, useState } from 'react';
import type { Lead, Property } from '@/types';
import { cn } from '@/lib/utils/cn';
import { WHATSAPP_TEMPLATES, renderTemplate } from '@/lib/integrations/whatsapp/whatsappTemplates';
import { EMAIL_TEMPLATES, renderEmailTemplate } from '@/lib/integrations/email/emailTemplates';
import { formatDay } from '@/lib/utils/format';
import { MailIcon, WhatsappIcon } from '@/components/shared/Icons';
import styles from './MessageTemplatePicker.module.css';

export interface MessageTemplatePickerProps {
  lead: Lead;
  property?: Property | null;
  /** Inserta el cuerpo renderizado en el composer. */
  onPick: (body: string) => void;
  onClose: () => void;
}

/**
 * Selector de plantillas WhatsApp/email con variables ya resueltas desde el
 * contexto del lead. Las variables sin dato quedan visibles como {{hueco}}
 * para que el agente las complete — jamás se rellenan inventando.
 */
export function MessageTemplatePicker({ lead, property, onPick, onClose }: MessageTemplatePickerProps) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');

  const values = useMemo<Record<string, string>>(
    () => ({
      nombre: lead.name.split(' ')[0] ?? lead.name,
      agente: 'Pau',
      zona: lead.zone,
      referencia: property?.reference ?? '',
      direccion: property ? `${property.zone}, ${property.city}` : '',
      fecha: formatDay(new Date(Date.now() + 2 * 86_400_000).toISOString()),
    }),
    [lead, property],
  );

  const templates =
    channel === 'whatsapp' ? Object.values(WHATSAPP_TEMPLATES) : Object.values(EMAIL_TEMPLATES);

  const renderBody = (id: string): { body: string; missing: string[] } => {
    if (channel === 'whatsapp') {
      const t = WHATSAPP_TEMPLATES[id as keyof typeof WHATSAPP_TEMPLATES];
      return renderTemplate(t, values);
    }
    const t = EMAIL_TEMPLATES[id as keyof typeof EMAIL_TEMPLATES];
    const r = renderEmailTemplate(t, values);
    return { body: `${r.subject}\n\n${r.body}`, missing: r.missing };
  };

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Canal">
          <button
            role="tab"
            aria-selected={channel === 'whatsapp'}
            className={cn(styles.tab, channel === 'whatsapp' && styles.tabActive)}
            onClick={() => setChannel('whatsapp')}
          >
            <WhatsappIcon size={14} /> WhatsApp
          </button>
          <button
            role="tab"
            aria-selected={channel === 'email'}
            className={cn(styles.tab, channel === 'email' && styles.tabActive)}
            onClick={() => setChannel('email')}
          >
            <MailIcon size={14} /> Email
          </button>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          Cerrar
        </button>
      </div>

      <ul className={styles.list}>
        {templates.map((template) => {
          const rendered = renderBody(template.id);
          return (
            <li key={template.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.name}>{template.name}</span>
                <button
                  type="button"
                  className={styles.use}
                  onClick={() => {
                    onPick(rendered.body);
                    onClose();
                  }}
                >
                  Usar
                </button>
              </div>
              <p className={styles.preview}>{rendered.body}</p>
              {rendered.missing.length > 0 && (
                <span className={styles.missing}>
                  Completar antes de enviar: {rendered.missing.join(', ')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
