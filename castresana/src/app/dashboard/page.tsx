import type { Metadata } from 'next';
import { Page } from '@/components/layout';
import { SectionHeading, Stat, Card, EmptyState, Button } from '@/components/ui';
import { DashboardIcon, InboxIcon, LeadsIcon, PropertyIcon, PlusIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Panel',
};

/**
 * Dashboard — visión general del negocio.
 * Página base: KPIs con datos de ejemplo y huecos para gráficos y actividad.
 */
export default function DashboardPage() {
  return (
    <Page width="wide">
      <SectionHeading
        eyebrow="Resumen"
        title="Buenos días, Pau"
        description="Así va tu cartera esta semana."
        actions={
          <Button variant="primary" size="md" iconLeft={<PlusIcon size={16} />}>
            Nueva propiedad
          </Button>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Stat label="Leads activos" value="34" delta="12% vs. semana previa" trend="up" icon={<LeadsIcon size={18} />} />
        <Stat label="Sin responder" value="3" delta="2 urgentes" trend="down" icon={<InboxIcon size={18} />} />
        <Stat label="Propiedades" value="128" delta="6 nuevas" trend="up" icon={<PropertyIcon size={18} />} />
        <Stat label="Visitas semana" value="9" delta="Estable" trend="flat" icon={<DashboardIcon size={18} />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
        <Card padding="none">
          <EmptyState
            icon={<DashboardIcon size={22} />}
            title="Embudo de ventas"
            description="Aquí irá el gráfico del pipeline por etapas (nuevo → cerrado). Lo conectaremos con datos reales más adelante."
          />
        </Card>
        <Card padding="none">
          <EmptyState
            icon={<InboxIcon size={22} />}
            title="Actividad reciente"
            description="Últimos mensajes, visitas y cambios de etapa aparecerán en esta columna."
          />
        </Card>
      </div>
    </Page>
  );
}
