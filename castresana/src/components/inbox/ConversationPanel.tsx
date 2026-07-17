'use client';

import type { Lead, Message, Property } from '@/types';
import type { SuggestedReply } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import { formatTime } from '@/lib/utils/format';
import { CHANNELS } from '@/lib/constants/channels';
import { STAGES } from '@/lib/constants/stages';
import { useInboxStore } from '@/store/inboxStore';
import { Avatar, Badge, IconButton } from '@/components/shared';
import { ChevronLeftIcon, MoreIcon, PhoneIcon, UsersIcon } from '@/components/shared/Icons';
import { MessageComposer } from './MessageComposer';
import styles from './ConversationPanel.module.css';

interface Props {
  lead: Lead;
  messages: Message[];
  /** Inmueble de interés del lead (variables de plantillas). */
  property?: Property | null;
  /** Respuestas sugeridas por la capa IA. */
  replies?: SuggestedReply[];
}

/** Hilo de conversación del lead activo: cabecera, mensajes y composer. */
export function ConversationPanel({ lead, messages, property, replies }: Props) {
  const { backToList, setMobilePane } = useInboxStore();

  return (
    <section className={styles.panel} aria-label={`Conversación con ${lead.name}`}>
      <header className={styles.header}>
        <IconButton label="Volver a la lista" size="md" className={styles.back} onClick={backToList}>
          <ChevronLeftIcon size={18} />
        </IconButton>

        <Avatar name={lead.name} size="sm" />

        <div className={styles.identity}>
          <span className={styles.name}>{lead.name}</span>
          <span className={styles.meta}>
            {CHANNELS[lead.channel].label} · {lead.zone}
          </span>
        </div>

        <div className={styles.headerActions}>
          <Badge stage={lead.stage}>{STAGES[lead.stage].label}</Badge>
          <IconButton label="Llamar">
            <PhoneIcon size={17} />
          </IconButton>
          <IconButton
            label="Ver contexto del lead"
            className={styles.contextButton}
            onClick={() => setMobilePane('context')}
          >
            <UsersIcon size={17} />
          </IconButton>
          <IconButton label="Más acciones">
            <MoreIcon size={17} />
          </IconButton>
        </div>
      </header>

      <div className={styles.messages}>
        <div className={styles.divider}>
          <span>Conversación</span>
        </div>

        {messages.map((m) => (
          <div key={m.id} className={cn(styles.row, m.direction === 'out' ? styles.out : styles.in)}>
            <div className={styles.bubbleWrap}>
              <div className={cn(styles.bubble, m.direction === 'out' ? styles.bubbleOut : styles.bubbleIn)}>
                {m.body}
              </div>
              <span className={styles.timestamp}>
                {m.direction === 'out' ? 'Tú · ' : ''}
                {formatTime(m.sentAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <MessageComposer channel={lead.channel} lead={lead} property={property} replies={replies} />
    </section>
  );
}
