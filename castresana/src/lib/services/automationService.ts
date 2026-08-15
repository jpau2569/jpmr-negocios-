/* ============================================================================
   automationService — ejecuta el motor de workflows sobre el estado actual
   y agrega los resultados para el dashboard y las fichas.
   ============================================================================ */

import type { Task, Visit } from '@/types';
import type { WorkflowRun } from '@/types/automation';
import { runWorkflows } from '@/lib/automation/workflowEngine';
import type { ActionArtifacts } from '@/lib/automation/actionHandlers';
import { DEFAULT_AUTOMATION_PREFS } from '@/lib/constants/automation';
import { propertiesRepository } from '@/lib/repositories';
import { seedCommunications } from '@/data/communications';
import { seedTasks, seedVisits } from '@/data/seed';
import { getAllLeadInsights } from './aiLeadService';

export interface AutomationSnapshot {
  runs: WorkflowRun[];
  artifacts: ActionArtifacts;
  /** Tareas existentes + generadas por workflows (vencidas primero). */
  allTasks: Task[];
  /** Visitas existentes + creadas por workflows. */
  allVisits: Visit[];
  /** Rendimiento por canal (envíos del historial). */
  channelStats: Array<{ channel: string; sent: number; delivered: number; read: number }>;
  /** Leads sin tocar: sin mensaje nuestro en su hilo reciente. */
  untouchedLeadIds: string[];
}

export async function getAutomationSnapshot(now: Date = new Date()): Promise<AutomationSnapshot> {
  const [{ leads, insightsByLead }, properties] = await Promise.all([
    getAllLeadInsights(now),
    propertiesRepository.getProperties(),
  ]);

  const { runs, artifacts } = runWorkflows(
    { leads, properties, visits: seedVisits, insightsByLead, now },
    DEFAULT_AUTOMATION_PREFS,
  );

  // Tareas: seed + generadas (dedup por título+lead para no duplicar en re-render).
  const seen = new Set(seedTasks.map((t) => `${t.leadId}|${t.title}`));
  const generatedTasks = artifacts.tasks.filter((t) => !seen.has(`${t.leadId}|${t.title}`));
  const allTasks = [...seedTasks, ...generatedTasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const allVisits = [...seedVisits, ...artifacts.visits];

  // Rendimiento por canal desde el historial de comunicaciones.
  const channels = ['whatsapp', 'email'] as const;
  const channelStats = channels.map((channel) => {
    const sent = seedCommunications.filter((c) => c.channel === channel);
    return {
      channel: channel === 'whatsapp' ? 'WhatsApp' : 'Email',
      sent: sent.length,
      delivered: sent.filter((c) => c.status === 'entregado' || c.status === 'leido').length,
      read: sent.filter((c) => c.status === 'leido').length,
    };
  });

  // Leads sin tocar: nuevos sin ningún envío nuestro registrado.
  const contactedIds = new Set(seedCommunications.map((c) => c.leadId));
  const untouchedLeadIds = leads
    .filter((l) => l.stage === 'nuevo' && !contactedIds.has(l.id))
    .map((l) => l.id);

  return { runs, artifacts, allTasks, allVisits, channelStats, untouchedLeadIds };
}

/** Runs de workflow que afectan a un lead concreto. */
export function runsForLead(runs: WorkflowRun[], leadId: string): WorkflowRun[] {
  return runs.filter((r) => r.leadId === leadId);
}
