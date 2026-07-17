import type { Metadata } from 'next';
import {
  getActiveBuyerRecommendations,
  getExplorerRails,
  getHeroProperty,
  properties,
  videos,
} from '@/data';
import { ExplorerHero } from '@/components/explorer/ExplorerHero';
import { PropertyRail } from '@/components/explorer/PropertyRail';
import { PropertyCard } from '@/components/explorer/PropertyCard';
import { VideoThumbCard } from '@/components/explorer/VideoThumbCard';
import { RecommendationRail } from '@/components/explorer/RecommendationRail';
import styles from './explorer.module.css';

export const metadata: Metadata = {
  title: 'Explorer',
};

/**
 * Explorer — capa de descubrimiento visual del catálogo.
 * Convive con el Inbox: aquí se descubre, se enseña y se relaciona; la
 * gestión de leads sigue viviendo en el Inbox.
 */
export default function ExplorerPage() {
  const hero = getHeroProperty();
  const rails = getExplorerRails();
  const recommendations = getActiveBuyerRecommendations();

  // Apoyos del hero: destacadas recientes que no sean la principal.
  const heroSide = properties.filter((p) => p.featured && p.id !== hero.id);

  const railById = new Map(rails.map((r) => [r.id, r]));
  const nuevas = railById.get('nuevas');
  const premium = railById.get('premium');
  const oviedoCentro = railById.get('oviedo-centro');
  const costa = railById.get('costa-inversion');
  const visita = railById.get('visita');

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <ExplorerHero hero={hero} side={heroSide} />

        {nuevas && (
          <PropertyRail title={nuevas.title} subtitle={nuevas.subtitle}>
            {nuevas.properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </PropertyRail>
        )}

        <PropertyRail title="Vídeos y tours" subtitle="Material audiovisual de la cartera">
          {videos.map((video) => (
            <VideoThumbCard key={video.id} video={video} />
          ))}
        </PropertyRail>

        <RecommendationRail
          title="Recomendadas para compradores activos"
          subtitle="Encaje con leads del Inbox — pronto con matching automático"
          recommendations={recommendations}
        />

        {premium && (
          <PropertyRail title={premium.title} subtitle={premium.subtitle}>
            {premium.properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </PropertyRail>
        )}

        {oviedoCentro && (
          <PropertyRail title={oviedoCentro.title} subtitle={oviedoCentro.subtitle}>
            {oviedoCentro.properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </PropertyRail>
        )}

        {costa && (
          <PropertyRail title={costa.title} subtitle={costa.subtitle}>
            {costa.properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </PropertyRail>
        )}

        {visita && (
          <PropertyRail title={visita.title} subtitle={visita.subtitle}>
            {visita.properties.map((p) => (
              <PropertyCard key={p.id} property={p} variant="compact" />
            ))}
          </PropertyRail>
        )}
      </div>
    </div>
  );
}
