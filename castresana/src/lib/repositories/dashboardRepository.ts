/* Repositorio del panel comercial: agrega métricas de leads, visitas,
   tareas y propiedades. En Firestore usa lecturas simples (los agregados
   diarios vivirán en analyticsDaily cuando haya Cloud Functions). */

import { getDocs, query, where } from 'firebase/firestore';
import type { DashboardSummary, Intent, LeadStage, Task, Visit } from '@/types';
import type { Lead, Property } from '@/types';
import { COLLECTIONS, typedCollection } from '@/lib/firebase/firestore';
import { seedLeads, seedProperties, seedTasks, seedVisits } from '@/data/seed';
import { useFirestoreSource } from './shared';

const EMPTY_STAGES: Record<LeadStage, number> = {
  nuevo: 0,
  seguimiento: 0,
  visita: 0,
  oferta: 0,
  cerrado: 0,
};

const EMPTY_INTENTS: Record<Intent, number> = { compra: 0, alquiler: 0, venta: 0 };

function summarize(
  leads: Lead[],
  properties: Property[],
  visits: Visit[],
  tasks: Task[],
  now: Date,
): DashboardSummary {
  const byStage = { ...EMPTY_STAGES };
  const byIntent = { ...EMPTY_INTENTS };
  let unread = 0;

  for (const lead of leads) {
    byStage[lead.stage] += 1;
    byIntent[lead.intent] += 1;
    if (lead.unread > 0) unread += 1;
  }

  return {
    activeLeads: leads.filter((l) => l.stage !== 'cerrado').length,
    unreadConversations: unread,
    upcomingVisits: visits.filter(
      (v) =>
        (v.status === 'propuesta' || v.status === 'confirmada') &&
        new Date(v.scheduledAt) >= now,
    ).length,
    pendingTasks: tasks.filter((t) => !t.done).length,
    availableProperties: properties.filter((p) => p.status === 'disponible').length,
    byStage,
    byIntent,
  };
}

export async function getDashboardSummary(now: Date = new Date()): Promise<DashboardSummary> {
  if (useFirestoreSource()) {
    const [leadsSnap, propertiesSnap, visitsSnap, tasksSnap] = await Promise.all([
      getDocs(typedCollection<Lead>(COLLECTIONS.leads)),
      getDocs(typedCollection<Property>(COLLECTIONS.properties)),
      getDocs(
        query(
          typedCollection<Visit>(COLLECTIONS.visits),
          where('status', 'in', ['propuesta', 'confirmada']),
        ),
      ),
      getDocs(query(typedCollection<Task>(COLLECTIONS.tasks), where('done', '==', false))),
    ]);
    return summarize(
      leadsSnap.docs.map((d) => d.data()),
      propertiesSnap.docs.map((d) => d.data()),
      visitsSnap.docs.map((d) => d.data()),
      tasksSnap.docs.map((d) => d.data()),
      now,
    );
  }
  return summarize(seedLeads, seedProperties, seedVisits, seedTasks, now);
}

/** Próximas visitas para el panel (ordenadas por fecha). */
export async function getUpcomingVisits(limit = 5, now: Date = new Date()): Promise<Visit[]> {
  const visits = useFirestoreSource()
    ? (await getDocs(typedCollection<Visit>(COLLECTIONS.visits))).docs.map((d) => d.data())
    : seedVisits;

  return visits
    .filter(
      (v) =>
        (v.status === 'propuesta' || v.status === 'confirmada') &&
        new Date(v.scheduledAt) >= now,
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, limit);
}

/** Tareas pendientes (ordenadas por vencimiento). */
export async function getPendingTasks(limit = 6): Promise<Task[]> {
  const tasks = useFirestoreSource()
    ? (await getDocs(typedCollection<Task>(COLLECTIONS.tasks))).docs.map((d) => d.data())
    : seedTasks;

  return tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit);
}
