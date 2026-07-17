/* ============================================================================
   SEED de Firestore — puebla el proyecto (o el emulador) con datos coherentes.

   Uso:
     · Emulador:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed
     · Proyecto:  GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json npm run seed

   Idempotente: usa ids fijos y set() con merge, así que se puede relanzar.
   Vuelca: 2 agentes · 12 leads · 16 propiedades · conversaciones + mensajes ·
   5 visitas · 6 tareas · notificaciones · sugerencias de matching.
   ============================================================================ */

import { getAdminDb, withDates } from './firebaseAdmin';
// Imports relativos a src (los `import type '@/…'` de esos módulos se borran
// en tiempo de ejecución, así que tsx los resuelve sin configurar alias).
import {
  seedAgents,
  seedConversations,
  seedLeads,
  seedNotifications,
  seedProperties,
  seedTasks,
  seedVisits,
} from '../src/data/seed';
import { messages } from '../src/data/messages';
import { getCompatibleLeads } from '../src/data/mock-recommendations';

async function main() {
  const db = getAdminDb();
  const batchLimit = 400; // margen bajo el límite de 500 operaciones
  let batch = db.batch();
  let ops = 0;
  let total = 0;

  const commitIfNeeded = async () => {
    if (ops >= batchLimit) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  const put = async (path: string[], data: Record<string, unknown>) => {
    const [col, id, ...rest] = path;
    let ref = db.collection(col!).doc(id!);
    for (let i = 0; i < rest.length; i += 2) {
      ref = ref.collection(rest[i]!).doc(rest[i + 1]!);
    }
    batch.set(ref, withDates(data), { merge: true });
    ops += 1;
    total += 1;
    await commitIfNeeded();
  };

  console.log('→ Sembrando agentes…');
  for (const agent of seedAgents) {
    const { id, ...data } = agent;
    await put(['agents', id], data);
  }

  console.log('→ Sembrando propiedades…');
  for (const property of seedProperties) {
    const { id, ...data } = property;
    await put(['properties', id], data);
  }

  console.log('→ Sembrando leads…');
  for (const lead of seedLeads) {
    const { id, ...data } = lead;
    await put(['leads', id], { ...data, agentId: 'a-01' });
  }

  console.log('→ Sembrando conversaciones y mensajes…');
  for (const conversation of seedConversations) {
    const { id, ...data } = conversation;
    await put(['conversations', id], data);
    for (const message of messages.filter((m) => m.leadId === conversation.leadId)) {
      const { id: messageId, ...messageData } = message;
      await put(['conversations', id, 'messages', messageId], messageData);
    }
  }

  console.log('→ Sembrando visitas…');
  for (const visit of seedVisits) {
    const { id, ...data } = visit;
    await put(['visits', id], data);
  }

  console.log('→ Sembrando tareas…');
  for (const task of seedTasks) {
    const { id, ...data } = task;
    await put(['tasks', id], data);
  }

  console.log('→ Sembrando notificaciones…');
  for (const notification of seedNotifications) {
    const { id, agentId, ...data } = notification;
    // Hasta vincular agentes ↔ Auth, el destinatario es el id del agente.
    // Al activar cuentas reales: sustituir por el uid correspondiente.
    await put(['notifications', id], { ...data, userId: agentId });
  }

  console.log('→ Sembrando sugerencias de matching…');
  for (const property of seedProperties) {
    for (const match of getCompatibleLeads(property.id, 3)) {
      const id = `ms-${match.lead.id}-${property.id}`;
      await put(['matchSuggestions', id], {
        leadId: match.lead.id,
        propertyId: property.id,
        score: match.score,
        reason: match.reason,
        status: 'nueva',
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`\n✓ Seed completado: ${total} documentos escritos/actualizados.`);
}

main().catch((error) => {
  console.error('✗ Error sembrando Firestore:', error);
  process.exit(1);
});
