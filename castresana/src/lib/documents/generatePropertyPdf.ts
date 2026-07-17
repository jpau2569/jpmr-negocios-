/* Ficha de inmueble — generador de contenido estructurado. */

import type { DocumentContent } from '@/types/automation';
import type { GenerateContext } from './documentTypes';
import { formatArea, formatPrice } from '@/lib/utils/format';

export function generatePropertyPdf(ctx: GenerateContext): DocumentContent {
  const property = ctx.property;
  if (!property) throw new Error('generatePropertyPdf requiere una propiedad.');
  const isRent = property.operation === 'alquiler';

  return {
    kind: 'ficha-inmueble',
    title: property.title,
    subtitle: `${property.reference} · ${property.zone}, ${property.city}`,
    sections: [
      {
        heading: 'Datos principales',
        facts: [
          { label: 'Precio', value: `${formatPrice(property.price)}${isRent ? '/mes' : ''}` },
          { label: 'Operación', value: isRent ? 'Alquiler' : 'Venta' },
          { label: 'Superficie construida', value: formatArea(property.areaM2) },
          ...(property.bedrooms > 0
            ? [{ label: 'Dormitorios', value: String(property.bedrooms) }]
            : []),
          { label: 'Baños', value: String(property.bathrooms) },
          ...(property.floor ? [{ label: 'Planta', value: property.floor }] : []),
          ...(property.yearBuilt ? [{ label: 'Año construcción', value: String(property.yearBuilt) }] : []),
          ...(property.yieldPct
            ? [{ label: 'Rentabilidad estimada', value: `${property.yieldPct.toLocaleString('es-ES')} %` }]
            : []),
        ],
      },
      {
        heading: 'Descripción',
        paragraphs: [property.description],
      },
      {
        heading: 'Características',
        paragraphs: [property.features.join(' · ')],
      },
    ],
    footer: `Documento informativo sin valor contractual. Asesoría Castresana · ${property.reference}`,
  };
}
