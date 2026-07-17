import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/layout';
import { SectionHeading, Card, Badge, Button, Avatar } from '@/components/ui';
import { ChevronRightIcon, InboxIcon, PhoneIcon } from '@/components/icons';
import { mockConversations } from '@/data/mockInbox';
import { channelMeta, stageLabel, temperatureTone } from '@/lib/channelMeta';

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const lead = mockConversations.find((c) => c.leadId === id);
  return { title: lead ? lead.leadName : `Lead ${id}` };
}

/**
 * Ficha de lead — página base.
 * Reutiliza los datos mock del inbox para mostrar una ficha coherente.
 */
export default async function LeadDetailPage({ params }: PageParams) {
  const { id } = await params;
  const conversation = mockConversations.find((c) => c.leadId === id) ?? mockConversations[0];
  const temp = temperatureTone[conversation.temperature];
  const { label: channelLabel } = channelMeta[conversation.channel];

  return (
    <Page>
      <nav
        aria-label="Ruta"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}
      >
        <Link href="/inbox" style={{ color: 'var(--text-muted)' }}>
          Leads
        </Link>
        <ChevronRightIcon size={13} />
        <span style={{ color: 'var(--text-secondary)' }}>{conversation.leadName}</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Avatar initials={conversation.initials} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionHeading
            title={conversation.leadName}
            description={`Lead vía ${channelLabel} · interesado en ${conversation.subject}`}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Badge tone={temp.tone} dot>
          {temp.label}
        </Badge>
        <Badge tone="neutral">{stageLabel[conversation.stage]}</Badge>
        {conversation.propertyRef && <Badge tone="accent">{conversation.propertyRef}</Badge>}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button variant="primary" size="md" iconLeft={<PhoneIcon size={16} />}>
          Llamar
        </Button>
        <Link href="/inbox">
          <Button variant="secondary" size="md" iconLeft={<InboxIcon size={16} />}>
            Abrir conversación
          </Button>
        </Link>
      </div>

      <Card>
        <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-3)' }}>Sobre esta ficha</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 'var(--lh-normal)' }}>
          Página base del detalle de lead. Aquí irán el historial completo de
          interacciones, las propiedades de interés, notas del agente, tareas y el
          seguimiento del embudo. El identificador de la ruta es{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>/leads/{id}</code>.
        </p>
      </Card>
    </Page>
  );
}
