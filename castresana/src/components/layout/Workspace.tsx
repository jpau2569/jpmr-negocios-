import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Workspace.module.css';

export interface WorkspaceProps {
  /** Panel izquierdo: lista (conversaciones, resultados…). Opcional. */
  list?: ReactNode;
  /** Panel central: contenido principal. */
  children: ReactNode;
  /** Panel derecho: contexto (ficha, detalles, acciones). Opcional. */
  context?: ReactNode;
  className?: string;
}

/**
 * Workspace — layout de 3 paneles reutilizable.
 *   [ lista (opc.) | principal | contexto (opc.) ]
 * Los anchos laterales salen de los tokens --panel-list-width y --context-width.
 * Cada panel hace scroll de forma independiente.
 */
export function Workspace({ list, children, context, className }: WorkspaceProps) {
  return (
    <div
      className={cn(
        styles.workspace,
        Boolean(list) && styles.hasList,
        Boolean(context) && styles.hasContext,
        className,
      )}
    >
      {list && (
        <aside className={cn(styles.panel, styles.list)} aria-label="Lista">
          {list}
        </aside>
      )}

      <section className={cn(styles.panel, styles.main)}>{children}</section>

      {context && (
        <aside className={cn(styles.panel, styles.context)} aria-label="Contexto">
          {context}
        </aside>
      )}
    </div>
  );
}
