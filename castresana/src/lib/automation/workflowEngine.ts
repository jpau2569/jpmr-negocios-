/* ============================================================================
   workflowEngine — reglas por defecto + evaluación completa.
   ----------------------------------------------------------------------------
   runWorkflows(state, prefs):
     1. Para cada regla activa, detecta ocurrencias de su trigger.
     2. Evalúa condiciones (con motivo del fallo si no pasan → run 'omitido').
     3. Ejecuta acciones → acumula ARTEFACTOS (tareas, alertas, visitas…).
     4. Devuelve runs auditables + artefactos agregados.
   Determinista: misma entrada, misma salida. La persistencia llegará con
   Cloud Functions escuchando eventos reales; este módulo no cambiará.
   ============================================================================ */

import type { AutomationPreferences, WorkflowRule, WorkflowRun } from '@/types/automation';
import { evaluateConditions, type ConditionContext } from './conditions';
import { ACTION_HANDLERS, emptyArtifacts, type ActionArtifacts } from './actionHandlers';
import { detectOccurrences, type SystemState } from './triggerHandlers';

/* ------------------------------------------------------- Reglas por defecto */

export const DEFAULT_WORKFLOWS: WorkflowRule[] = [
  {
    id: 'wf-lead-nuevo',
    name: 'Alta de lead nuevo',
    description: 'Lead nuevo → tarea de primer contacto + respuesta sugerida.',
    trigger: 'lead-nuevo',
    conditions: ['lead-activo'],
    actions: [
      {
        type: 'crear-tarea',
        params: { titulo: 'Primer contacto en <1 h', venceEnHoras: '1', detalle: 'Responder y cualificar presupuesto.' },
      },
      { type: 'sugerir-respuesta' },
    ],
    enabled: true,
  },
  {
    id: 'wf-caliente-sin-respuesta',
    name: 'Caliente sin respuesta',
    description: 'Lead caliente con silencio sobre el límite → alerta prioritaria.',
    trigger: 'caliente-sin-respuesta',
    conditions: ['lead-activo', 'es-caliente', 'silencio-supera-limite-caliente'],
    actions: [
      {
        type: 'generar-alerta',
        params: { severidad: 'alta', titulo: 'Lead caliente esperando respuesta' },
      },
    ],
    enabled: true,
  },
  {
    id: 'wf-visita-solicitada',
    name: 'Visita solicitada',
    description: 'El cliente pide visita → crear visita pendiente de confirmar.',
    trigger: 'visita-solicitada',
    conditions: ['lead-activo'],
    actions: [{ type: 'crear-visita', params: { enHoras: '48' } }],
    enabled: true,
  },
  {
    id: 'wf-recordatorio-visita',
    name: 'Recordatorio de visita',
    description: 'Visita confirmada en <48 h → programar recordatorio.',
    trigger: 'visita-confirmada',
    conditions: ['visita-confirmada', 'recordatorios-activados'],
    actions: [
      { type: 'programar-recordatorio', params: { cuando: '24 h antes' } },
      { type: 'enviar-plantilla', params: { plantilla: 'wa-recordatorio-visita' } },
    ],
    enabled: true,
  },
  {
    id: 'wf-seguimiento-48h',
    name: 'Seguimiento tras silencio',
    description: 'Sin respuesta en 48 h → sugerir seguimiento suave.',
    trigger: 'sin-respuesta-48h',
    conditions: ['lead-activo', 'silencio-supera-seguimiento'],
    actions: [
      { type: 'enviar-plantilla', params: { plantilla: 'wa-seguimiento' } },
      {
        type: 'crear-tarea',
        params: { titulo: 'Seguimiento suave', venceEnHoras: '24', detalle: 'Enviar plantilla de seguimiento aprobada.' },
      },
    ],
    enabled: true,
  },
  {
    id: 'wf-captacion-nueva',
    name: 'Captación con demanda',
    description: 'Propiedad nueva con varios leads compatibles → recomendaciones.',
    trigger: 'captacion-nueva',
    conditions: ['propiedad-disponible'],
    actions: [
      { type: 'generar-recomendaciones' },
      {
        type: 'crear-tarea',
        params: { titulo: 'Enviar captación a leads compatibles', venceEnHoras: '24' },
      },
    ],
    enabled: true,
  },
  {
    id: 'wf-captacion-propietario',
    name: 'Flujo de captación',
    description: 'Propietario vendedor detectado → iniciar flujo de captación.',
    trigger: 'vendedor-detectado',
    conditions: ['lead-activo', 'quiere-vender'],
    actions: [
      { type: 'iniciar-captacion' },
      { type: 'enviar-plantilla', params: { plantilla: 'em-captacion-propietario' } },
    ],
    enabled: true,
  },
];

/* ---------------------------------------------------------------- Ejecución */

export interface WorkflowEvaluation {
  runs: WorkflowRun[];
  artifacts: ActionArtifacts;
}

function mergeArtifacts(target: ActionArtifacts, source: ActionArtifacts): void {
  target.tasks.push(...source.tasks);
  target.alerts.push(...source.alerts);
  target.communications.push(...source.communications);
  target.visits.push(...source.visits);
  target.notes.push(...source.notes);
}

export function runWorkflows(
  state: SystemState,
  prefs: AutomationPreferences,
  rules: WorkflowRule[] = DEFAULT_WORKFLOWS,
): WorkflowEvaluation {
  const runs: WorkflowRun[] = [];
  const artifacts = emptyArtifacts();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    for (const occurrence of detectOccurrences(rule.trigger, state)) {
      const runId = `run-${rule.id}-${occurrence.lead?.id ?? occurrence.property?.id ?? occurrence.visit?.id ?? 'x'}`;
      const ctx: ConditionContext = {
        lead: occurrence.lead,
        property: occurrence.property,
        visit: occurrence.visit,
        insights: occurrence.lead ? state.insightsByLead[occurrence.lead.id] : undefined,
        prefs,
        now: state.now,
      };

      const conditions = evaluateConditions(rule.conditions, ctx);
      if (!conditions.pass) {
        runs.push({
          id: runId,
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: rule.trigger,
          leadId: occurrence.lead?.id,
          propertyId: occurrence.property?.id,
          firedAt: state.now.toISOString(),
          actionsExecuted: [],
          result: 'omitido',
          detail: `Condición no cumplida — ${conditions.detail}`,
        });
        continue;
      }

      const executed: string[] = [];
      for (const actionSpec of rule.actions) {
        const handler = ACTION_HANDLERS[actionSpec.type];
        const result = handler(actionSpec, ctx, runId);
        executed.push(result.description);
        mergeArtifacts(artifacts, result.artifacts);
      }

      runs.push({
        id: runId,
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: rule.trigger,
        leadId: occurrence.lead?.id,
        propertyId: occurrence.property?.id,
        firedAt: state.now.toISOString(),
        actionsExecuted: executed,
        result: 'ok',
        detail: occurrence.detail,
      });
    }
  }

  return { runs, artifacts };
}
