/* ============================================================================
   Acciones de workflow — ejecutores puros: reciben contexto y devuelven
   ARTEFACTOS (tareas, alertas, comunicaciones, visitas…) sin efectos
   colaterales. El engine acumula los artefactos; la capa de persistencia
   (Firestore/Functions) los escribirá cuando se conecte.
   ============================================================================ */

import type { Task, Visit } from '@/types';
import type { SmartAlert } from '@/types/ai';
import type { Communication, WorkflowActionSpec } from '@/types/automation';
import type { ConditionContext } from './conditions';

const DAY = 86_400_000;

/** Artefactos producidos por las acciones de una ejecución. */
export interface ActionArtifacts {
  tasks: Task[];
  alerts: SmartAlert[];
  communications: Communication[];
  visits: Visit[];
  /** Descripciones legibles de acciones sin artefacto material (p. ej. sugerencias). */
  notes: string[];
}

export function emptyArtifacts(): ActionArtifacts {
  return { tasks: [], alerts: [], communications: [], visits: [], notes: [] };
}

export interface ActionResult {
  /** Descripción legible para el WorkflowRun. */
  description: string;
  artifacts: ActionArtifacts;
}

type ActionHandler = (
  spec: WorkflowActionSpec,
  ctx: ConditionContext,
  runId: string,
) => ActionResult;

function task(
  runId: string,
  ctx: ConditionContext,
  title: string,
  dueInHours: number,
  detail?: string,
): Task {
  return {
    id: `${runId}-task-${title.slice(0, 12).replace(/\s/g, '')}`,
    agentId: 'a-01',
    leadId: ctx.lead?.id,
    propertyId: ctx.property?.id ?? ctx.lead?.propertyId,
    title,
    detail,
    dueAt: new Date(ctx.now.getTime() + dueInHours * 3_600_000).toISOString(),
    done: false,
    createdAt: ctx.now.toISOString(),
  };
}

export const ACTION_HANDLERS: Record<WorkflowActionSpec['type'], ActionHandler> = {
  'crear-tarea': (spec, ctx, runId) => {
    const title = spec.params?.titulo ?? `Atender a ${ctx.lead?.name ?? 'lead'}`;
    const hours = Number(spec.params?.venceEnHoras ?? 4);
    const artifacts = emptyArtifacts();
    if (ctx.prefs.autoCreateTasks) {
      artifacts.tasks.push(task(runId, ctx, title, hours, spec.params?.detalle));
      return { description: `Tarea creada: «${title}» (vence en ${hours} h)`, artifacts };
    }
    artifacts.notes.push(`Tarea sugerida (autocreación desactivada): ${title}`);
    return { description: `Tarea sugerida: «${title}»`, artifacts };
  },

  'generar-alerta': (spec, ctx, runId) => {
    const artifacts = emptyArtifacts();
    const title = spec.params?.titulo ?? `Revisar lead ${ctx.lead?.name ?? ''}`.trim();
    artifacts.alerts.push({
      id: `${runId}-alert`,
      kind: 'caliente-sin-respuesta',
      severity: (spec.params?.severidad as SmartAlert['severity']) ?? 'alta',
      title,
      detail: spec.params?.detalle ?? 'Generada por workflow.',
      leadId: ctx.lead?.id,
      propertyId: ctx.property?.id,
      link: '/inbox',
    });
    return { description: `Alerta generada: «${title}»`, artifacts };
  },

  'sugerir-respuesta': (_spec, ctx) => {
    const artifacts = emptyArtifacts();
    const label = ctx.insights?.replies[0]?.label ?? 'respuesta contextual';
    artifacts.notes.push(`Respuesta sugerida disponible en el composer: ${label}`);
    return { description: `Respuesta sugerida (${label})`, artifacts };
  },

  'crear-visita': (spec, ctx, runId) => {
    const artifacts = emptyArtifacts();
    if (!ctx.lead || !(ctx.property?.id ?? ctx.lead.propertyId)) {
      artifacts.notes.push('No se pudo crear visita: falta lead o propiedad.');
      return { description: 'Visita no creada (datos insuficientes)', artifacts };
    }
    artifacts.visits.push({
      id: `${runId}-visit`,
      leadId: ctx.lead.id,
      propertyId: ctx.property?.id ?? ctx.lead.propertyId!,
      agentId: 'a-01',
      scheduledAt: new Date(ctx.now.getTime() + Number(spec.params?.enHoras ?? 48) * 3_600_000).toISOString(),
      status: 'propuesta',
      notes: 'Creada automáticamente por workflow: confirmar hora con el cliente.',
      createdAt: ctx.now.toISOString(),
    });
    return { description: 'Visita pendiente creada (por confirmar)', artifacts };
  },

  'programar-recordatorio': (spec, ctx, runId) => {
    const artifacts = emptyArtifacts();
    const when = spec.params?.cuando ?? '24 h antes';
    artifacts.tasks.push(
      task(runId, ctx, `Recordatorio de visita (${when})`, 20, 'Enviar plantilla wa-recordatorio-visita.'),
    );
    return { description: `Recordatorio programado (${when})`, artifacts };
  },

  'generar-recomendaciones': (_spec, ctx) => {
    const artifacts = emptyArtifacts();
    const count = ctx.insights?.matches.length ?? 0;
    artifacts.notes.push(
      count > 0
        ? `${count} inmuebles compatibles listos para enviar.`
        : 'Sin encajes de stock en este momento.',
    );
    return { description: `Recomendaciones calculadas (${count} encajes)`, artifacts };
  },

  'iniciar-captacion': (_spec, ctx, runId) => {
    const artifacts = emptyArtifacts();
    artifacts.tasks.push(
      task(runId, ctx, 'Flujo de captación: valoración + documentación', 24,
        'Agendar visita de valoración y solicitar nota simple.'),
    );
    return { description: 'Flujo de captación iniciado (tarea de valoración)', artifacts };
  },

  'enviar-plantilla': (spec, ctx) => {
    const artifacts = emptyArtifacts();
    const template = spec.params?.plantilla ?? 'plantilla por defecto';
    // El envío real lo confirma el agente (no auto-enviamos sin supervisión).
    artifacts.notes.push(`Plantilla preparada para revisión: ${template}`);
    return { description: `Plantilla «${template}» preparada (pendiente de aprobar)`, artifacts };
  },
};
