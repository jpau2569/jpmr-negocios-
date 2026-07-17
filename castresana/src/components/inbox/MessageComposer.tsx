'use client';

import { useState } from 'react';
import { CHANNELS } from '@/lib/constants/channels';
import type { Channel } from '@/types';
import type { SuggestedReply } from '@/types/ai';
import { IconButton } from '@/components/shared';
import { PaperclipIcon, SendIcon } from '@/components/shared/Icons';
import { SuggestedReplies } from '@/components/ai';
import styles from './MessageComposer.module.css';

interface Props {
  channel: Channel;
  /** Respuestas sugeridas por la capa IA (chips sobre el composer). */
  replies?: SuggestedReply[];
}

/**
 * Composer de mensaje. En esta fase no envía nada real: mantiene el borrador
 * en estado local y lo limpia al "enviar". Las sugerencias IA se insertan
 * como borrador editable: la IA propone, el agente decide.
 */
export function MessageComposer({ channel, replies = [] }: Props) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    setDraft(''); // Fase mock: aquí conectará el envío real (Firebase).
  };

  return (
    <>
      <SuggestedReplies replies={replies} onPick={setDraft} />
      <div className={styles.composer}>
        <IconButton label="Adjuntar archivo" size="md">
          <PaperclipIcon size={18} />
        </IconButton>

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
