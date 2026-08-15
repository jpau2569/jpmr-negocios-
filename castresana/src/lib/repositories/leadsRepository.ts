/* Repositorio de leads: Firestore si hay sesión posible, seeds en demo/SSR. */

import { getDocs, orderBy, query, where, getDoc } from 'firebase/firestore';
import type { Lead, LeadStage } from '@/types';
import { COLLECTIONS, typedCollection, typedDoc } from '@/lib/firebase/firestore';
import { seedLeads } from '@/data/seed';
import { useFirestoreSource } from './shared';

export async function getLeads(): Promise<Lead[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(typedCollection<Lead>(COLLECTIONS.leads), orderBy('lastMessageAt', 'desc')),
    );
    return snapshot.docs.map((d) => d.data());
  }
  return [...seedLeads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (useFirestoreSource()) {
    const snapshot = await getDoc(typedDoc<Lead>(COLLECTIONS.leads, id));
    return snapshot.exists() ? snapshot.data() : null;
  }
  return seedLeads.find((lead) => lead.id === id) ?? null;
}

export async function getLeadsByStage(stage: LeadStage): Promise<Lead[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(
        typedCollection<Lead>(COLLECTIONS.leads),
        where('stage', '==', stage),
        orderBy('lastMessageAt', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => d.data());
  }
  return seedLeads.filter((lead) => lead.stage === stage);
}
