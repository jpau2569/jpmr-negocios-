import type { Conversation } from '@/types';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { channelMeta, temperatureTone } from '@/lib/channelMeta';
import { Avatar } from '@/components/ui';
import { PinIcon } from '@/components/icons';
import styles from './ConversationItem.module.css';

interface Props {
  conversation: Conversation;
  selected: boolean;
  onSelect: (id: string) => void;
}

const statusByTemp = {
  caliente: 'danger',
  templado: 'warning',
  frio: undefined,
} as const;

export function ConversationItem({ conversation, selected, onSelect }: Props) {
  const { Icon: ChannelIcon, label: channelLabel } = channelMeta[conversation.channel];
  const temp = temperatureTone[conversation.temperature];

  return (
    <button
      type="button"
      className={cn(styles.item, selected && styles.selected)}
      onClick={() => onSelect(conversation.id)}
      aria-pressed={selected}
    >
      <Avatar
        initials={conversation.initials}
        status={statusByTemp[conversation.temperature]}
      />

      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.name}>{conversation.leadName}</span>
          <span className={styles.time}>{formatRelativeTime(conversation.updatedAt)}</span>
        </div>

        <div className={styles.subjectRow}>
          <span className={styles.channelIcon} title={channelLabel} aria-label={channelLabel}>
            <ChannelIcon size={13} />
          </span>
          <span className={styles.subject}>{conversation.subject}</span>
          {conversation.pinned && (
            <span className={styles.pin} aria-label="Fijada">
              <PinIcon size={12} />
            </span>
          )}
        </div>

        <p className={styles.preview}>{conversation.preview}</p>

        <div className={styles.metaRow}>
          <span className={cn(styles.tempTag, styles[`temp-${conversation.temperature}`])}>
            {temp.label}
          </span>
          {conversation.propertyRef && (
            <span className={styles.ref}>{conversation.propertyRef}</span>
          )}
        </div>
      </div>

      {conversation.unread > 0 && (
        <span className={styles.unread} aria-label={`${conversation.unread} sin leer`}>
          {conversation.unread}
        </span>
      )}
    </button>
  );
}
