/* Repositorio de conversaciones y mensajes.
   Firestore: conversations + subcolección messages.
   Demo/SSR: se derivan de los seeds locales. */

import { getDocs, orderBy, query, where } from 'firebase/firestore';
import type { Conversation, Message } from '@/types';
import { COLLECTIONS, messagesCollection, typedCollection } from '@/lib/firebase/firestore';
import { seedConversations } from '@/data/seed';
import { getMessagesByLead as seedMessagesByLead } from '@/data/messages';
import { useFirestoreSource } from './shared';

export async function getConversations(): Promise<Conversation[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(
        typedCollection<Conversation>(COLLECTIONS.conversations),
        orderBy('lastMessageAt', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => d.data());
  }
  return [...seedConversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function getConversationByLeadId(leadId: string): Promise<Conversation | null> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(
        typedCollection<Conversation>(COLLECTIONS.conversations),
        where('leadId', '==', leadId),
      ),
    );
    return snapshot.docs[0]?.data() ?? null;
  }
  return seedConversations.find((c) => c.leadId === leadId) ?? null;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(messagesCollection<Message>(conversationId), orderBy('sentAt', 'asc')),
    );
    return snapshot.docs.map((d) => d.data());
  }
  // En seeds el id de conversación es `c-<leadId>`.
  const leadId = conversationId.replace(/^c-/, '');
  return seedMessagesByLead(leadId);
}

export async function getMessagesByLeadId(leadId: string): Promise<Message[]> {
  if (useFirestoreSource()) {
    const conversation = await getConversationByLeadId(leadId);
    return conversation ? getMessages(conversation.id) : [];
  }
  return seedMessagesByLead(leadId);
}
