import type { Property } from '@/types';
import { PropertyRail } from '@/components/explorer/PropertyRail';
import { PropertyCard } from '@/components/explorer/PropertyCard';

export interface RelatedPropertiesProps {
  properties: Property[];
  title?: string;
  subtitle?: string;
}

/**
 * SimilarHomesRail — rail de viviendas similares al pie de la ficha.
 * Reutiliza el rail del Explorer para mantener el mismo lenguaje visual.
 */
export function RelatedProperties({
  properties,
  title = 'Viviendas similares',
  subtitle = 'Por zona, tipología y rango de precio',
}: RelatedPropertiesProps) {
  if (properties.length === 0) return null;

  return (
    <PropertyRail title={title} subtitle={subtitle}>
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </PropertyRail>
  );
}
