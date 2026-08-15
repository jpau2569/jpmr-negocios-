/* ============================================================================
   Catálogo de documentos + render a HTML imprimible.
   Los generadores devuelven DocumentContent (estructura tipada); aquí está
   el catálogo para la UI y la conversión a HTML sobrio (imprimir → PDF).
   El PDF real (Storage + librería en servidor) usará esta misma estructura.
   ============================================================================ */

import type { DocumentContent } from '@/types/automation';
import type { DocumentKindMeta } from './documentTypes';

export const DOCUMENT_CATALOG: DocumentKindMeta[] = [
  {
    kind: 'propuesta-comercial',
    name: 'Propuesta comercial',
    description: 'Selección de inmuebles y condiciones para un lead.',
    requires: ['lead'],
    ready: true,
  },
  {
    kind: 'ficha-inmueble',
    name: 'Ficha de inmueble',
    description: 'Resumen imprimible con datos y características.',
    requires: ['property'],
    ready: true,
  },
  {
    kind: 'resumen-visita',
    name: 'Resumen de visita',
    description: 'Acta breve con asistentes, feedback y siguientes pasos.',
    requires: ['visit', 'lead', 'property'],
    ready: true,
  },
  {
    kind: 'resumen-lead',
    name: 'Resumen de lead',
    description: 'Briefing comercial completo del lead.',
    requires: ['lead'],
    ready: true,
  },
  {
    kind: 'dossier-propietario',
    name: 'Dossier para propietario',
    description: 'Plan de venta y servicios para captación.',
    requires: ['lead'],
    ready: false,
  },
  {
    kind: 'contrato-reserva',
    name: 'Contrato de reserva',
    description: 'Documento de reserva con señal. Requiere revisión legal.',
    requires: ['lead', 'property'],
    ready: false,
  },
  {
    kind: 'contrato-arras',
    name: 'Contrato de arras',
    description: 'Arras penitenciales. Requiere revisión legal.',
    requires: ['lead', 'property'],
    ready: false,
  },
  {
    kind: 'contrato-alquiler',
    name: 'Contrato de alquiler',
    description: 'Arrendamiento de vivienda (LAU). Requiere revisión legal.',
    requires: ['lead', 'property'],
    ready: false,
  },
];

/** Render sobrio a HTML autoportante (imprimir desde el navegador → PDF). */
export function renderDocumentHtml(content: DocumentContent): string {
  const sections = content.sections
    .map((section) => {
      const facts = section.facts
        ? `<table>${section.facts
            .map((f) => `<tr><td class="label">${f.label}</td><td>${f.value}</td></tr>`)
            .join('')}</table>`
        : '';
      const paragraphs = section.paragraphs?.map((p) => `<p>${p}</p>`).join('') ?? '';
      return `<section><h2>${section.heading}</h2>${facts}${paragraphs}</section>`;
    })
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>${content.title}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#241C14;background:#FBF8F1;
       max-width:720px;margin:0 auto;padding:48px 40px;line-height:1.55}
  header{border-bottom:2px solid #9C5F2E;padding-bottom:16px;margin-bottom:28px}
  .brand{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9C5F2E}
  h1{font-size:26px;margin:6px 0 2px}
  .subtitle{color:#786A56;font-size:14px}
  h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#5C4433;
     border-bottom:1px solid #E6DDCC;padding-bottom:6px;margin:26px 0 12px}
  p{font-size:14px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:5px 0;vertical-align:top}
  td.label{color:#786A56;width:38%}
  footer{margin-top:40px;padding-top:14px;border-top:1px solid #E6DDCC;
         font-size:11px;color:#9A8C76}
</style></head><body>
<header><div class="brand">Asesoría Castresana · Oviedo</div>
<h1>${content.title}</h1>
${content.subtitle ? `<div class="subtitle">${content.subtitle}</div>` : ''}</header>
${sections}
<footer>${content.footer}</footer>
</body></html>`;
}
