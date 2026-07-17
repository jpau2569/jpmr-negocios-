import Link from 'next/link';
import type { Conversation } from '@/types';
import { formatRelativeTime } from '@/lib/format';
import { channelMeta, stageLabel, temperatureTone } from '@/lib/channelMeta';
import { Avatar, Badge, Button } from '@/components/ui';
import { ChevronRightIcon, PhoneIcon, PropertyIcon } from '@/components/icons';
import styles from './InboxContext.module.css';

interface Props {
  conversation: Conversation;
}

/** Panel derecho: ficha rápida del lead asociado a la conversación activa. */
export function InboxContext({ conversation }: Props) {
  const { label: channelLabel } = channelMeta[conversation.channel];
  const temp = temperatureTone[conversation.temperature];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Avatar initials={conversation.initials} size="lg" />
        <div className={styles.identity}>
          <h2 className={styles.name}>{conversation.leadName}</h2>
          <span className={styles.channel}>Vía {channelLabel}</span>
        </div>
      </div>

      <div className={styles.badges}>
        <Badge tone={temp.tone} dot>
          {temp.label}
        </Badge>
        <Badge tone="neutral">{stageLabel[conversation.stage]}</Badge>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" size="sm" fullWidth iconLeft={<PhoneIcon size={16} />}>
          Llamar
        </Button>
        <Link href={`/leads/${conversation.leadId}`} className={styles.linkButton}>
          <Button variant="secondary" size="sm" fullWidth iconRight={<ChevronRightIcon size={16} />}>
            Ver ficha del lead
          </Button>
        </Link>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Detalles</h3>
        <dl className={styles.details}>
          <div className={styles.detailRow}>
            <dt>Etapa</dt>
            <dd>{stageLabel[conversation.stage]}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Canal</dt>
            <dd>{channelLabel}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Última actividad</dt>
            <dd>{formatRelativeTime(conversation.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {conversation.propertyRef && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Propiedad de interés</h3>
          <Link href={`/properties/${conversation.propertyRef}`} className={styles.property}>
            <span className={styles.propertyIcon}>
              <PropertyIcon size={18} />
            </span>
            <span className={styles.propertyBody}>
              <span className={styles.propertyRef}>{conversation.propertyRef}</span>
              <span className={styles.propertyName}>{conversation.subject}</span>
            </span>
            <ChevronRightIcon size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}
