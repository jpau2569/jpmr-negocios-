'use client';

import { useState } from 'react';
import { CHANNELS } from '@/lib/constants/channels';
import type { Channel, Lead, Property } from '@/types';
import type { SuggestedReply } from '@/types/ai';
import { IconButton } from '@/components/shared';
import { FileIcon, PaperclipIcon, SendIcon } from '@/components/shared/Icons';
import { SuggestedReplies } from '@/components/ai';
import { MessageTemplatePicker } from '@/components/automation';
import styles from './MessageComposer.module.css';

interface Props {
  channel: Channel;
  /** Lead activo (para resolver variables de plantillas). */
  lead?: Lead;
  property?: Property | null;
  /** Respuestas sugeridas por la capa IA (chips sobre el composer). */
  replies?: SuggestedReply[];
}

/**
 * Composer de mensaje con dos ayudas: respuestas sugeridas (IA) y plantillas
 * (WhatsApp/email). Ambas insertan borrador editable — el agente decide.
 * El envío real llegará con Firebase.
 */
export function MessageComposer({ channel, lead, property, replies = [] }: Props) {
  const [draft, setDraft] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const canSend = draft.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    setDraft(''); // Fase mock: aquí conectará el envío real (Firebase).
  };

  return (
    <>
      {showTemplates && lead ? (
        <MessageTemplatePicker
          lead={lead}
          property={property}
          onPick={setDraft}
          onClose={() => setShowTemplates(false)}
        />
      ) : (
        <SuggestedReplies replies={replies} onPick={setDraft} />
      )}

      <div className={styles.composer}>
        <IconButton label="Adjuntar archivo" size="md">
          <PaperclipIcon size={18} />
        </IconButton>
        {lead && (
          <IconButton
            label="Plantillas de mensaje"
            size="md"
            active={showTemplates}
            onClick={() => setShowTemplates((v) => !v)}
          >
            <FileIcon size={17} />
          </IconButton>
        )}

        <textarea
          className={styles.input}
          rows={1}
          placeholder={`Responder por ${CHANNELS[channel].label}…`}
          aria-label="Escribir mensaje"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <button
          type="button"
          className={styles.send}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Enviar mensaje"
        >
          <SendIcon size={17} />
        </button>
      </div>
    </>
  );
}
