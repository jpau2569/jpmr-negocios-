/* ============================================================================
   Plantillas WhatsApp — tono profesional cercano, frases cortas, es-ES.
   Variables entre {{llaves}}; renderTemplate las sustituye y avisa de las
   que falten (nunca envía huecos silenciosos).
   ============================================================================ */

import type { WhatsAppTemplate, WhatsAppTemplateKind } from './whatsappTypes';

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKind, WhatsAppTemplate> = {
  'wa-primera-respuesta': {
    id: 'wa-primera-respuesta',
    name: 'Primera respuesta',
    description: 'Contestación inicial a un lead nuevo.',
    body: 'Hola {{nombre}}, soy {{agente}} de Asesoría Castresana. Gracias por su interés en {{referencia}}. Sigue disponible y se enseña muy bien. ¿Qué días le vendrían bien para verlo?',
    variables: ['nombre', 'agente', 'referencia'],
  },
  'wa-propuesta-visita': {
    id: 'wa-propuesta-visita',
    name: 'Propuesta de visita',
    description: 'Cerrar día y hora de visita.',
    body: 'Hola {{nombre}}, ¿cerramos la visita a {{referencia}}? Tengo hueco {{fecha}}. Si le encaja, se lo confirmo ahora mismo.',
    variables: ['nombre', 'referencia', 'fecha'],
  },
  'wa-envio-inmuebles': {
    id: 'wa-envio-inmuebles',
    name: 'Envío de inmuebles',
    description: 'Selección de propiedades que encajan.',
    body: 'Hola {{nombre}}, le he preparado una selección que encaja con lo que busca en {{zona}}:\n{{lista}}\n¿Le organizo visita a alguna?',
    variables: ['nombre', 'zona', 'lista'],
  },
  'wa-seguimiento': {
    id: 'wa-seguimiento',
    name: 'Seguimiento',
    description: 'Retomar conversación tras silencio.',
    body: 'Hola {{nombre}}, le escribo por retomar el hilo. {{referencia}} sigue disponible y ha despertado interés. Si quiere, avanzamos sin compromiso.',
    variables: ['nombre', 'referencia'],
  },
  'wa-recuperacion': {
    id: 'wa-recuperacion',
    name: 'Recuperación de lead frío',
    description: 'Repesca con novedades de stock.',
    body: 'Hola {{nombre}}, hace tiempo que no hablamos y han entrado novedades en {{zona}} que encajan con su búsqueda. ¿Le envío una selección actualizada?',
    variables: ['nombre', 'zona'],
  },
  'wa-recordatorio-visita': {
    id: 'wa-recordatorio-visita',
    name: 'Recordatorio de cita',
    description: 'Recordatorio 24 h antes de la visita.',
    body: 'Hola {{nombre}}, le recuerdo nuestra visita de mañana {{fecha}} en {{direccion}}. Cualquier cambio, avíseme por aquí. ¡Hasta mañana!',
    variables: ['nombre', 'fecha', 'direccion'],
  },
};

export interface RenderedTemplate {
  body: string;
  /** Variables sin valor: el envío debe bloquearse o pedirlas. */
  missing: string[];
}

/** Sustituye variables {{x}} por sus valores; reporta las que falten. */
export function renderTemplate(
  template: WhatsAppTemplate,
  values: Record<string, string>,
): RenderedTemplate {
  const missing: string[] = [];
  const body = template.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === '') {
      missing.push(key);
      return `{{${key}}}`;
    }
    return value;
  });
  return { body, missing };
}
