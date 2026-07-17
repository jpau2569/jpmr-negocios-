/* ============================================================================
   LIMPIEZA de Firestore — borra las colecciones de desarrollo.

   Uso (mismas credenciales que el seed):
     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:clear

   Seguridad: si apunta a un proyecto REAL (sin emulador), exige el flag
   --force para evitar borrados accidentales.
   ============================================================================ */

import { getAdminDb } from './firebaseAdmin';

const COLLECTIONS = [
  'agents',
  'leads',
  'conversations', // recursivo: incluye subcolección messages
  'properties',
  'visits',
  'tasks',
  'notifications',
  'matchSuggestions',
  'analyticsDaily',
];

async function main() {
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const forced = process.argv.includes('--force');

  if (!isEmulator && !forced) {
    console.error(
      '✗ Vas a borrar colecciones de un proyecto REAL.\n' +
        '  Si estás seguro: npm run seed:clear -- --force',
    );
    process.exit(1);
  }

  const db = getAdminDb();

  for (const name of COLLECTIONS) {
    process.stdout.write(`→ Borrando ${name}… `);
    // recursiveDelete elimina también las subcolecciones (messages, fcmTokens…).
    await db.recursiveDelete(db.collection(name));
    console.log('ok');
  }

  console.log('\n✓ Colecciones de desarrollo eliminadas.');
}

main().catch((error) => {
  console.error('✗ Error limpiando Firestore:', error);
  process.exit(1);
});
