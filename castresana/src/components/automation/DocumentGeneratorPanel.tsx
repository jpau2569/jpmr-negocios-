'use client';

import { useState } from 'react';
import type { Lead, Property, Visit } from '@/types';
import type { DocumentContent, DocumentKind } from '@/types/automation';
import { cn } from '@/lib/utils/cn';
import { DOCUMENT_CATALOG, renderDocumentHtml } from '@/lib/documents/documentTemplates';
import { generatePropertyPdf } from '@/lib/documents/generatePropertyPdf';
import { generateLeadSummaryPdf } from '@/lib/documents/generateLeadSummaryPdf';
import { generateVisitSummaryPdf } from '@/lib/documents/generateVisitSummaryPdf';
import { FileIcon } from '@/components/shared/Icons';
import styles from './DocumentGeneratorPanel.module.css';

export interface DocumentGeneratorPanelProps {
  lead?: Lead;
  property?: Property | null;
  visit?: Visit | null;
}

const GENERATORS: Partial<Record<DocumentKind, (ctx: { lead?: Lead; property?: Property | null; visit?: Visit | null }) => DocumentContent>> = {
  'ficha-inmueble': (ctx) => generatePropertyPdf({ property: ctx.property ?? undefined }),
  'resumen-lead': (ctx) => generateLeadSummaryPdf({ lead: ctx.lead }),
  'resumen-visita': (ctx) =>
    generateVisitSummaryPdf({
      visit: ctx.visit ?? undefined,
      lead: ctx.lead,
      property: ctx.property ?? undefined,
    }),
  'propuesta-comercial': (ctx) => generateLeadSummaryPdf({ lead: ctx.lead }),
};

/**
 * Generador de documentos: los disponibles se abren como HTML imprimible
 * (imprimir → PDF); los marcados «en preparación» aún no tienen plantilla
 * final (contratos: requieren revisión legal antes de activarse).
 */
export function DocumentGeneratorPanel({ lead, property, visit }: DocumentGeneratorPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const available = DOCUMENT_CATALOG.filter((meta) =>
    meta.requires.every((req) =>
      req === 'lead' ? Boolean(lead) : req === 'property' ? Boolean(property) : Boolean(visit),
    ),
  );

  if (available.length === 0) return null;

  const open = (kind: DocumentKind) => {
    const generator = GENERATORS[kind];
    if (!generator) return;
    try {
      const content = generator({ lead, property, visit });
      const html = renderDocumentHtml(content);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el documento.');
    }
  };

  return (
    <section className={styles.panel} aria-label="Documentos">
      <h3 className={styles.heading}>
        <FileIcon size={14} />
        Documentos
      </h3>
      <ul className={styles.list}>
        {available.map((meta) => (
          <li key={meta.kind} className={styles.item}>
            <div className={styles.info}>
              <span className={styles.name}>{meta.name}</span>
              <span className={styles.description}>{meta.description}</span>
            </div>
            {meta.ready ? (
              <button type="button" className={styles.generate} onClick={() => open(meta.kind)}>
                Generar
              </button>
            ) : (
              <span className={cn(styles.badge)}>En preparación</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
