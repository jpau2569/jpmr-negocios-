import type { Metadata } from 'next';
import { Workspace, PanelHeader } from '@/components/layout';
import { SearchField, EmptyState, Badge, Button } from '@/components/ui';
import { ExplorerIcon, FilterIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Explorer',
};

const facets = ['Venta', 'Alquiler', 'Piso', 'Ático', 'Chalet', 'Local', '2+ dorm.', 'Terraza'];

/**
 * Explorer — buscador visual de propiedades (mapa + rejilla).
 * Página base: estructura de 3 paneles lista; el buscador real llega después.
 */
export default function ExplorerPage() {
  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PanelHeader title="Explorer" subtitle="Buscar">
        <SearchField placeholder="Zona, referencia, precio…" />
      </PanelHeader>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {facets.map((f) => (
          <Badge key={f} tone="neutral">
            {f}
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <Workspace list={list}>
      <PanelHeader
        title="Resultados"
        subtitle="0 propiedades"
        actions={
          <Button variant="ghost" size="sm" iconLeft={<FilterIcon size={16} />}>
            Filtros
          </Button>
        }
      />
      <EmptyState
        icon={<ExplorerIcon size={22} />}
        title="Explorer en construcción"
        description="Aquí vivirá el buscador visual de propiedades con mapa y rejilla de resultados. Conectaremos el catálogo en un paso posterior."
      />
    </Workspace>
  );
}
