import type { PropertyVideo } from '@/types';

/* Vídeos y tours mock — miniaturas para el rail audiovisual del Explorer. */

export const videos: PropertyVideo[] = [
  {
    id: 'v-01',
    propertyId: 'p-09',
    title: 'Villa en Montecerrao — tour completo',
    subtitle: 'Tour guiado · interiores y jardín',
    kind: 'tour',
    duration: '4:12',
    palette: ['#3A2A1D', '#0C0A09'],
  },
  {
    id: 'v-02',
    propertyId: 'p-11',
    title: 'Amanecer sobre San Lorenzo',
    subtitle: 'Dron · entorno y vistas',
    kind: 'dron',
    duration: '1:38',
    palette: ['#6F9A8D', '#16120F'],
  },
  {
    id: 'v-03',
    propertyId: 'p-01',
    title: 'Reforma integral en Uría, antes y después',
    subtitle: 'Reel · 60 segundos',
    kind: 'reel',
    duration: '0:58',
    palette: ['#5C4433', '#1B1613'],
  },
  {
    id: 'v-04',
    propertyId: 'p-13',
    title: 'Casa indiana de 1902 en Llanes',
    subtitle: 'Tour guiado · historia y detalle',
    kind: 'tour',
    duration: '5:47',
    palette: ['#86A063', '#1B1613'],
  },
  {
    id: 'v-05',
    propertyId: 'p-04',
    title: 'Vivir en La Fresneda',
    subtitle: 'Zona · colegios, senda y servicios',
    kind: 'zona',
    duration: '2:21',
    palette: ['#4B3626', '#100E0C'],
  },
  {
    id: 'v-06',
    propertyId: 'p-02',
    title: 'Ático sobre los tejados del Antiguo',
    subtitle: 'Reel · terraza al atardecer',
    kind: 'reel',
    duration: '0:45',
    palette: ['#876747', '#22150C'],
  },
  {
    id: 'v-07',
    propertyId: 'p-07',
    title: 'Casona y finca en Las Regueras',
    subtitle: 'Dron · finca completa',
    kind: 'dron',
    duration: '2:56',
    palette: ['#5C4433', '#2A231C'],
  },
  {
    id: 'v-08',
    propertyId: 'p-10',
    title: 'Piso de diseño en La Florida',
    subtitle: 'Tour guiado · acabados',
    kind: 'tour',
    duration: '3:05',
    palette: ['#9C5F2E', '#1B1613'],
  },
];

export const VIDEO_KIND_LABEL: Record<PropertyVideo['kind'], string> = {
  tour: 'Tour guiado',
  dron: 'Dron',
  reel: 'Reel',
  zona: 'Zona',
};

export function getVideosByProperty(propertyId: string): PropertyVideo[] {
  return videos.filter((v) => v.propertyId === propertyId);
}
