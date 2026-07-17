/* ============================================================================
   Documentos — tipos de la capa documental.
   El contenido estructurado (DocumentContent) vive en types/automation.ts;
   aquí van los contratos de generación.
   ============================================================================ */

import type { Lead, Property, Visit } from '@/types';
import type { DocumentContent, DocumentKind } from '@/types/automation';

export type { DocumentContent, DocumentKind, DocumentSection, GeneratedDocument } from '@/types/automation';

/** Metadatos de cada tipo de documento (catálogo para la UI). */
export interface DocumentKindMeta {
  kind: DocumentKind;
  name: string;
  description: string;
  /** Contexto necesario para generarlo. */
  requires: Array<'lead' | 'property' | 'visit'>;
  /** Estado de la plantilla en esta fase. */
  ready: boolean;
}

export interface GenerateContext {
  lead?: Lead;
  property?: Property;
  visit?: Visit;
  agentName?: string;
  now?: Date;
}

/** Contrato de todo generador: contexto → contenido estructurado. */
export type DocumentGenerator = (ctx: GenerateContext) => DocumentContent;
