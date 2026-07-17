import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/layout';
import { SectionHeading, Card, Badge, Button, Stat } from '@/components/ui';
import { BedIcon, BathIcon, AreaIcon, ChevronRightIcon, PropertyIcon } from '@/components/icons';

interface PageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  return { title: `Propiedad ${id}` };
}

/**
 * Detalle de propiedad — página base.
 * Lee el id de la ruta y maqueta la ficha; los datos reales llegan después.
 */
export default async function PropertyDetailPage({ params }: PageParams) {
  const { id } = await params;

  return (
    <Page width="wide">
      <nav
        aria-label="Ruta"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}
      >
        <Link href="/explorer" style={{ color: 'var(--text-muted)' }}>
          Propiedades
        </Link>
        <ChevronRightIcon size={13} />
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{id}</span>
      </nav>

      <SectionHeading
        eyebrow="Ficha de propiedad"
        title="Ático con terraza · Ensanche"
        description="Vivienda exterior con orientación sur y acabados premium."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Badge tone="success" dot>
              Disponible
            </Badge>
            <Button variant="primary" size="md">
              Editar
            </Button>
          </div>
        }
      />

      <Card padding="none">
        <div
          style={{
            aspectRatio: '21 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-faint)',
            background:
              'linear-gradient(135deg, var(--c-carbon-800), var(--c-carbon-900))',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <PropertyIcon size={40} />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        <Stat label="Precio" value="465.000 €" />
        <Stat label="Dormitorios" value="3" icon={<BedIcon size={18} />} />
        <Stat label="Baños" value="2" icon={<BathIcon size={18} />} />
        <Stat label="Superficie" value="128 m²" icon={<AreaIcon size={18} />} />
      </div>

      <Card>
        <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-3)' }}>Descripción</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 'var(--lh-normal)' }}>
          Página base de detalle de propiedad. Aquí irán la galería completa, la
          ubicación en mapa, las características, la información energética y el
          histórico de leads interesados. La referencia mostrada arriba proviene de
          la ruta dinámica <code style={{ fontFamily: 'var(--font-mono)' }}>/properties/{id}</code>.
        </p>
      </Card>
    </Page>
  );
}
