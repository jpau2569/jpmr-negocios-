'use client';

import { useState } from 'react';
import type { SuggestedReply } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import { SparkleIcon } from '@/components/shared/Icons';
import styles from './SuggestedReplies.module.css';

export interface SuggestedRepliesProps {
  replies: SuggestedReply[];
  /** Inserta el texto elegido en el composer. */
  onPick: (text: string) => void;
}

/**
 * Chips de respuesta sugerida sobre el composer. Al pulsar, el texto se
 * inserta editable — la IA propone, el agente decide.
 */
export function SuggestedReplies({ replies, onPick }: SuggestedRepliesProps) {
  const [preview, setPreview] = useState<SuggestedReply | null>(null);

  if (replies.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.chips}>
        <span className={styles.hint} title="Sugerencias generadas por la capa IA comercial">
          <SparkleIcon size={13} />
        </span>
        {replies.map((reply) => (
          <button
            key={reply.kind + reply.label}
            type="button"
            className={cn(styles.chip, preview?.kind === reply.kind && styles.chipActive)}
            title={reply.reason}
            onClick={() => {
              onPick(reply.text);
              setPreview(reply);
            }}
            onMouseEnter={() => setPreview(reply)}
            onMouseLeave={() => setPreview(null)}
          >
            {reply.label}
          </button>
        ))}
      </div>

      {preview && (
        <div className={styles.preview}>
          <span className={styles.previewReason}>{preview.reason}</span>
          <p className={styles.previewText}>{preview.text}</p>
        </div>
      )}
    </div>
  );
}
