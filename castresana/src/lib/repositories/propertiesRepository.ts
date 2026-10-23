/* Repositorio de propiedades: Firestore o seeds según entorno. */

import { getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import type { Property } from '@/types';
import { COLLECTIONS, typedCollection, typedDoc } from '@/lib/firebase/firestore';
import { seedProperties } from '@/data/seed';
import { useFirestoreSource } from './shared';

export async function getProperties(): Promise<Property[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(typedCollection<Property>(COLLECTIONS.properties), orderBy('publishedAt', 'desc')),
    );
    return snapshot.docs.map((d) => d.data());
  }
  return [...seedProperties].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getPropertyById(id: string): Promise<Property | null> {
  if (useFirestoreSource()) {
    const snapshot = await getDoc(typedDoc<Property>(COLLECTIONS.properties, id));
    return snapshot.exists() ? snapshot.data() : null;
  }
  return seedProperties.find((property) => property.id === id) ?? null;
}

export async function getAvailableProperties(): Promise<Property[]> {
  if (useFirestoreSource()) {
    const snapshot = await getDocs(
      query(
        typedCollection<Property>(COLLECTIONS.properties),
        where('status', '==', 'disponible'),
        orderBy('publishedAt', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => d.data());
  }
  return seedProperties.filter((property) => property.status === 'disponible');
}
