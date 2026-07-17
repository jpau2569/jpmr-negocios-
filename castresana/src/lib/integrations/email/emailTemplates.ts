/* ============================================================================
   Plantillas de email comercial — es-ES, tono profesional cálido.
   Mismo sistema de variables {{x}} que WhatsApp (renderEmailTemplate).
   ============================================================================ */

import type { EmailTemplate, EmailTemplateKind } from './emailTypes';

export const EMAIL_TEMPLATES: Record<EmailTemplateKind, EmailTemplate> = {
  'em-bienvenida': {
    id: 'em-bienvenida',
    name: 'Bienvenida a lead',
    description: 'Primer email tras registrarse o escribir.',
    subject: 'Bienvenido/a a Asesoría Castresana, {{nombre}}',
    body: 'Hola {{nombre}},\n\nGracias por contactar con Asesoría Castresana. Soy {{agente}} y seré su persona de referencia.\n\nHe registrado su interés en {{zona}} y le iré enviando las oportunidades que encajen. Si prefiere contarme algo más de lo que busca, puede responder directamente a este correo.\n\nUn saludo,\n{{agente}}\nAsesoría Castresana · Oviedo',
    variables: ['nombre', 'agente', 'zona'],
  },
  'em-envio-inmuebles': {
    id: 'em-envio-inmuebles',
    name: 'Envío de inmuebles',
    description: 'Selección de propiedades adjunta.',
    subject: 'Selección de inmuebles en {{zona}} — Asesoría Castresana',
    body: 'Hola {{nombre}},\n\nLe adjunto la selección que hemos preparado para usted:\n\n{{lista}}\n\nTodas están disponibles a día de hoy. Si alguna le encaja, respondo en el día para organizar la visita.\n\nUn saludo,\n{{agente}}',
    variables: ['nombre', 'zona', 'lista', 'agente'],
  },
  'em-confirmacion-visita': {
    id: 'em-confirmacion-visita',
    name: 'Confirmación de visita',
    description: 'Confirma día, hora y punto de encuentro.',
    subject: 'Visita confirmada — {{referencia}} · {{fecha}}',
    body: 'Hola {{nombre}},\n\nLe confirmo la visita:\n\n· Inmueble: {{referencia}}\n· Fecha: {{fecha}}\n· Punto de encuentro: {{direccion}}\n\nSi surge cualquier imprevisto, avíseme y lo reprogramamos sin problema.\n\nUn saludo,\n{{agente}}',
    variables: ['nombre', 'referencia', 'fecha', 'direccion', 'agente'],
  },
  'em-recordatorio': {
    id: 'em-recordatorio',
    name: 'Recordatorio',
    description: 'Recordatorio de cita o gestión pendiente.',
    subject: 'Recordatorio — {{asunto}}',
    body: 'Hola {{nombre}},\n\nLe recuerdo: {{asunto}} ({{fecha}}).\n\nCualquier cambio, estoy disponible en este correo o por teléfono.\n\nUn saludo,\n{{agente}}',
    variables: ['nombre', 'asunto', 'fecha', 'agente'],
  },
  'em-post-visita': {
    id: 'em-post-visita',
    name: 'Seguimiento post-visita',
    description: 'Feedback tras la visita.',
    subject: '¿Qué le pareció {{referencia}}?',
    body: 'Hola {{nombre}},\n\nGracias por venir a la visita de {{referencia}}. Me gustaría conocer su impresión: ¿qué le pareció? ¿Hay algo que le generó dudas?\n\nSi le encajó, le explico los siguientes pasos sin compromiso. Y si no, afinamos la búsqueda con ese feedback.\n\nUn saludo,\n{{agente}}',
    variables: ['nombre', 'referencia', 'agente'],
  },
  'em-captacion-propietario': {
    id: 'em-captacion-propietario',
    name: 'Captación de propietario',
    description: 'Propuesta de servicios de venta.',
    subject: 'Valoración y plan de venta de su inmueble en {{zona}}',
    body: 'Hola {{nombre}},\n\nGracias por su confianza. Le resumo cómo trabajaríamos la venta de su inmueble en {{zona}}:\n\n1. Valoración de mercado documentada (sin coste).\n2. Reportaje fotográfico y tour profesional.\n3. Publicación en portales y en nuestra cartera de compradores activos.\n4. Informe quincenal de actividad.\n\nSi le parece, cerramos una visita para la valoración esta misma semana.\n\nUn saludo,\n{{agente}}\nAsesoría Castresana',
    variables: ['nombre', 'zona', 'agente'],
  },
  'em-envio-dossier': {
    id: 'em-envio-dossier',
    name: 'Envío de dossier',
    description: 'Documentación completa de un inmueble.',
    subject: 'Dossier de {{referencia}} — Asesoría Castresana',
    body: 'Hola {{nombre}},\n\nLe adjunto el dossier completo de {{referencia}} con planos, calificación energética y detalle de gastos.\n\nCualquier duda que surja al revisarlo, me la traslada y la resolvemos.\n\nUn saludo,\n{{agente}}',
    variables: ['nombre', 'referencia', 'agente'],
  },
};

export interface RenderedEmail {
  subject: string;
  body: string;
  missing: string[];
}

/** Renderiza asunto y cuerpo; reporta variables sin valor. */
export function renderEmailTemplate(
  template: EmailTemplate,
  values: Record<string, string>,
): RenderedEmail {
  const missing = new Set<string>();
  const substitute = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = values[key];
      if (value === undefined || value === '') {
        missing.add(key);
        return `{{${key}}}`;
      }
      return value;
    });

  return {
    subject: substitute(template.subject),
    body: substitute(template.body),
    missing: [...missing],
  };
}
