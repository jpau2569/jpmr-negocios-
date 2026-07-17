import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCompatibleLeads,
  getProperty,
  getPropertyActivity,
  getRelatedProperties,
  properties,
} from '@/data';
import { ChevronLeftIcon } from '@/components/shared/Icons';
import { PropertyGallery } from '@/components/properties/PropertyGallery';
import { PropertySummary } from '@/components/properties/PropertySummary';
import { PropertyDescription } from '@/components/properties/PropertyDescription';
import { PropertySpecs } from '@/components/properties/PropertySpecs';
import { PropertyActions } from '@/components/properties/PropertyActions';
import { RelatedLeads } from '@/components/properties/RelatedLeads';
import { PropertyTimeline } from '@/components/properties/PropertyTimeline';
import { RelatedProperties } from '@/components/properties/RelatedProperties';
import styles from './property.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return properties.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const property = getProperty(id);
  return { title: property ? `${property.reference} · ${property.title}` : 'Propiedad' };
}

/** Ficha de inmueble: galería, resumen, CTAs, matching de leads y similares. */
export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const property = getProperty(id);
  if (!property) notFound();

  const matches = getCompatibleLeads(property.id);
  const related = getRelatedProperties(property.id);
  const activity = getPropertyActivity(property);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="Ruta">
          <Link href="/explorer" className={styles.back}>
            <ChevronLeftIcon size={15} />
            Explorer
          </Link>
          <span className={styles.crumbRef}>{property.reference}</span>
        </nav>

        <PropertyGallery property={property} />

        <div className={styles.columns}>
          <div className={styles.mainCol}>
            <PropertySummary property={property} />
            <hr className={styles.rule} />
            <PropertyDescription property={property} />
            <hr className={styles.rule} />
            <PropertySpecs property={property} />
          </div>

          <aside className={styles.sideCol}>
            <div className={styles.sideSticky}>
              <PropertyActions property={property} />
              <RelatedLeads matches={matches} />
              <PropertyTimeline activity={activity} />
            </div>
          </aside>
        </div>

        <RelatedProperties properties={related} />
      </div>
    </div>
  );
}
