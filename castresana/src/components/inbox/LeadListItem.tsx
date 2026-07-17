'use client';

import type { Lead } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime } from '@/lib/utils/format';
import { STAGES } from '@/lib/constants/stages';
import { Avatar, Badge } from '@/components/shared';
import {
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  MonitorIcon,
  PhoneIcon,
  PinIcon,
  WhatsappIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './LeadListItem.module.css';

const CHANNEL_ICONS: Record<Lead['channel'], (p: IconProps) => React.ReactElement> = {
  whatsapp: WhatsappIcon,
  email: MailIcon,
  portal: GlobeIcon,
  telefono: PhoneIcon,
  web: MonitorIcon,
};

interface Props {
  lead: Lead;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function LeadListItem({ lead, selected, onSelect }: Props) {
  const ChannelIcon = CHANNEL_ICONS[lead.channel];
  const hasUnread = lead.unread > 0;

  return (
    <button
      type="button"
      className={cn(styles.item, selected && styles.selected)}
      onClick={() => onSelect(lead.id)}
      aria-pressed={selected}
    >
      <Avatar name={lead.name} />

      <span className={styles.body}>
        <span className={styles.topRow}>
          <span className={cn(styles.name, hasUnread && styles.nameUnread)}>
            {lead.pinned && <PinIcon size={12} className={styles.pin} />}
            {lead.name}
          </span>
          <span className={styles.time}>{formatRelativeTime(lead.lastMessageAt)}</span>
        </span>

        <span className={styles.zoneRow}>
          <MapPinIcon size={12} />
          <span className={styles.zone}>{lead.zone}</span>
          <ChannelIcon size={12} className={styles.channel} />
        </span>

        <span className={cn(styles.preview, hasUnread && styles.previewUnread)}>
          {lead.lastMessagePreview}
        </span>

        <span className={styles.metaRow}>
          <Badge stage={lead.stage}>{STAGES[lead.stage].label}</Badge>
          {lead.tags[0] && <span className={styles.tag}>{lead.tags[0]}</span>}
        </span>
      </span>

      {hasUnread && (
        <span className={styles.unread} aria-label={`${lead.unread} mensajes sin leer`}>
          {lead.unread}
        </span>
      )}
    </button>
  );
}
