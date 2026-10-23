import type { PropertyRecommendation } from '@/data';
import { PropertyRail } from './PropertyRail';
import { PropertyCard } from './PropertyCard';

export interface RecommendationRailProps {
  title: string;
  subtitle?: string;
  recommendations: PropertyRecommendation[];
}

/**
 * Rail de recomendaciones: tarjetas con el motivo del encaje visible.
 * Hoy las razones salen de reglas mock; mañana, del motor de matching.
 */
export function RecommendationRail({ title, subtitle, recommendations }: RecommendationRailProps) {
  if (recommendations.length === 0) return null;

  return (
    <PropertyRail title={title} subtitle={subtitle}>
      {recommendations.map(({ property, reason }) => (
        <PropertyCard key={property.id} property={property} hint={reason} />
      ))}
    </PropertyRail>
  );
}
