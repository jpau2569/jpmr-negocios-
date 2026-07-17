import type { Metadata } from 'next';
import { InboxView } from '@/components/inbox/InboxView';
import { mockConversations } from '@/data/mockInbox';

export const metadata: Metadata = {
  title: 'Inbox',
};

/**
 * Inbox — bandeja unificada de conversaciones (WhatsApp, email, portales…).
 * De momento con datos mock; el estado interactivo vive en <InboxView>.
 */
export default function InboxPage() {
  return <InboxView conversations={mockConversations} />;
}
