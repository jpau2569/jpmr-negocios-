import type { Conversation } from '@/types';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { channelMeta } from '@/lib/channelMeta';
import { Avatar, Button } from '@/components/ui';
import { PanelHeader } from '@/components/layout';
import { SendIcon } from '@/components/icons';
import styles from './MessageThread.module.css';

interface Props {
  conversation: Conversation;
}

export function MessageThread({ conversation }: Props) {
  const { Icon: ChannelIcon, label } = channelMeta[conversation.channel];

  return (
    <div className={styles.thread}>
      <PanelHeader
        title={conversation.leadName}
        subtitle={conversation.subject}
        actions={
          <span className={styles.channelPill}>
            <ChannelIcon size={14} />
            {label}
          </span>
        }
      />

      <div className={styles.messages}>
        <div className={styles.dayDivider}>
          <span>Conversación</span>
        </div>

        {conversation.messages.map((message) => {
          const outbound = message.direction === 'outbound';
          return (
            <div
              key={message.id}
              className={cn(styles.messageRow, outbound ? styles.out : styles.in)}
            >
              {!outbound && <Avatar initials={conversation.initials} size="sm" />}
              <div className={styles.bubbleGroup}>
                <div className={cn(styles.bubble, outbound ? styles.bubbleOut : styles.bubbleIn)}>
                  {message.body}
                </div>
                <span className={styles.messageMeta}>
                  {message.author} · {formatRelativeTime(message.sentAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          rows={1}
          placeholder={`Responder por ${label}…`}
          aria-label="Escribir respuesta"
        />
        <Button variant="primary" iconOnly aria-label="Enviar" iconLeft={<SendIcon size={18} />} />
      </div>
    </div>
  );
}
