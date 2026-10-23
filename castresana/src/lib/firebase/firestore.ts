/* ============================================================================
   Firestore — acceso tipado a colecciones
   ----------------------------------------------------------------------------
   · COLLECTIONS centraliza los nombres (evita strings mágicos dispersos).
   · typedCollection/typedDoc aplican un conversor genérico que:
       - escribe: elimina `id` (el id vive en la ruta del documento)
       - lee: inyecta `id` y convierte todo Timestamp → ISO string
   · El esquema completo está documentado en docs/FIRESTORE.md.
   ============================================================================ */

import {
  collection,
  doc,
  getFirestore,
  Timestamp,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import { getFirebaseApp } from './client';

export const COLLECTIONS = {
  users: 'users',
  agents: 'agents',
  leads: 'leads',
  conversations: 'conversations',
  /** Subcolección: conversations/{conversationId}/messages */
  messages: 'messages',
  properties: 'properties',
  visits: 'visits',
  tasks: 'tasks',
  notifications: 'notifications',
  matchSuggestions: 'matchSuggestions',
  analyticsDaily: 'analyticsDaily',
} as const;

/** Firestore del proyecto, o null en modo demo. */
export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

/* ------------------------------------------------------------- Conversores */

/** Convierte recursivamente Timestamps de Firestore a ISO strings. */
export function serializeTimestamps<T>(value: T): T {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(serializeTimestamps) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeTimestamps(v);
    }
    return out as T;
  }
  return value;
}

/** Conversor genérico: id en la ruta, fechas siempre ISO en la app. */
function converter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T) {
      const { id: _id, ...data } = model;
      return data;
    },
    fromFirestore(snapshot, options) {
      const data = serializeTimestamps(snapshot.data(options));
      return { ...(data as Omit<T, 'id'>), id: snapshot.id } as T;
    },
  };
}

/** Colección raíz tipada. Lanza si se usa sin configuración (guard antes). */
export function typedCollection<T extends { id: string }>(name: string): CollectionReference<T> {
  const db = getDb();
  if (!db) throw new Error('Firestore no está configurado (modo demo).');
  return collection(db, name).withConverter(converter<T>());
}

/** Documento tipado por ruta (p. ej. typedDoc<Lead>(COLLECTIONS.leads, id)). */
export function typedDoc<T extends { id: string }>(
  name: string,
  ...path: string[]
): DocumentReference<T> {
  const db = getDb();
  if (!db) throw new Error('Firestore no está configurado (modo demo).');
  return doc(db, name, ...path).withConverter(converter<T>());
}

/** Subcolección de mensajes de una conversación. */
export function messagesCollection<T extends { id: string }>(
  conversationId: string,
): CollectionReference<T> {
  const db = getDb();
  if (!db) throw new Error('Firestore no está configurado (modo demo).');
  return collection(
    db,
    COLLECTIONS.conversations,
    conversationId,
    COLLECTIONS.messages,
  ).withConverter(converter<T>());
}
