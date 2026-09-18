/* ============================================================================
   Inicialización de firebase-admin para los scripts de terminal.
   NUNCA se importa desde la app (solo scripts/). Credenciales:
     · FIRESTORE_EMULATOR_HOST=127.0.0.1:8080  → emulador, sin credenciales
     · GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json → proyecto real
   ============================================================================ */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function getAdminDb(): Firestore {
  if (getApps().length === 0) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      (process.env.FIRESTORE_EMULATOR_HOST ? 'castresana-dev' : undefined);

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      // Emulador: no hacen falta credenciales.
      initializeApp({ projectId });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault(), projectId });
    } else {
      console.error(
        '\n✗ Sin credenciales. Opciones:\n' +
          '  · Emulador:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed\n' +
          '  · Proyecto:  GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccount.json npm run seed\n',
      );
      process.exit(1);
    }
  }
  return getFirestore();
}

/** Convierte los campos de fecha ISO conocidos a Date (admin → Timestamp). */
export function withDates<T extends Record<string, unknown>>(doc: T): T {
  const DATE_FIELDS = new Set([
    'createdAt',
    'lastMessageAt',
    'publishedAt',
    'sentAt',
    'scheduledAt',
    'dueAt',
    'at',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    out[key] = DATE_FIELDS.has(key) && typeof value === 'string' ? new Date(value) : value;
  }
  return out as T;
}
