/* ============================================================================
   activityService — activity center: timeline comercial unificado.
   Mezcla mensajes, comunicaciones (WhatsApp/email), tareas, visitas,
   acciones IA y workflows en una sola línea temporal por lead.
   ============================================================================ */

import type { ActivityEvent, WorkflowRun } from '@/types/automation';
import type { Task, Visit } from '@/types';
import { conversationsRepository } from '@/lib/repositories';
import { getCommunicationsByLead } from '@/data/communications';
import { getTimelineByLead } from '@/data';

const CHANNEL_KIND = { whatsapp: 'whatsapp', email: 'email' } as const;

export interface LeadActivityInput {
  leadId: string;
  tasks: Task[];
  visits: Visit[];
  workflowRuns: WorkflowRun[];
}

/** Timeline unificado de un lead (más reciente primero). */
export async function getLeadActivity(input: LeadActivityInput): Promise<ActivityEvent[]> {
  const { leadId } = input;
  const events: ActivityEvent[] = [];

  // Mensajes del hilo (inbox).
  const messages = await conversationsRepository.getMessagesByLeadId(leadId);
  for (const m of messages) {
    events.push({
      id: `act-msg-${m.id}`,
      leadId,
      kind: 'mensaje',
      title: m.direction === 'in' ? 'Mensaje recibido' : 'Mensaje enviado',
      detail: m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body,
      at: m.sentAt,
    });
  }

  // Comunicaciones (WhatsApp / email) con estado de entrega.
  for (const c of getCommunicationsByLead(leadId)) {
    events.push({
      id: `act-comm-${c.id}`,
      leadId,
      kind: CHANNEL_KIND[c.channel],
      title:
        c.channel === 'whatsapp'
          ? `WhatsApp ${c.status}`
          : `Email ${c.status}${c.subject ? ` — ${c.subject}` : ''}`,
      detail: c.body.length > 90 ? `${c.body.slice(0, 90)}…` : c.body,
      at: c.sentAt,
    });
  }

  // Hitos del seguimiento (timeline existente: notas, ofertas, estados).
  for (const t of getTimelineByLead(leadId)) {
    events.push({
      id: `act-tl-${t.id}`,
      leadId,
      kind: t.kind === 'tarea' ? 'tarea' : t.kind === 'visita' ? 'visita' : 'estado',
      title: t.title,
      detail: t.detail,
      at: t.at,
    });
  }

  // Tareas del lead.
  for (const task of input.tasks.filter((t) => t.leadId === leadId)) {
    events.push({
      id: `act-task-${task.id}`,
      leadId,
      kind: 'tarea',
      title: `${task.done ? 'Tarea completada' : 'Tarea creada'}: ${task.title}`,
      detail: task.detail,
      at: task.createdAt,
    });
  }

  // Visitas del lead.
  for (const visit of input.visits.filter((v) => v.leadId === leadId)) {
    events.push({
      id: `act-visit-${visit.id}`,
      leadId,
      kind: 'visita',
      title: `Visita ${visit.status}`,
      detail: visit.notes ?? visit.feedback,
      at: visit.createdAt,
    });
  }

  // Workflows disparados sobre este lead.
  for (const run of input.workflowRuns.filter((r) => r.leadId === leadId && r.result === 'ok')) {
    events.push({
      id: `act-wf-${run.id}`,
      leadId,
      kind: 'workflow',
      title: `Automatización: ${run.ruleName}`,
      detail: run.actionsExecuted.join(' · '),
      at: run.firedAt,
    });
  }

  // Dedup por id y orden descendente por fecha.
  const unique = new Map(events.map((e) => [e.id, e]));
  return [...unique.values()].sort((a, b) => b.at.localeCompare(a.at));
}
