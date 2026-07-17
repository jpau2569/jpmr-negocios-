import type { MetadataRoute } from 'next';

/**
 * Manifest PWA — servido por Next en /manifest.webmanifest y enlazado
 * automáticamente desde el <head>. Base para la instalación futura.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Castresana — Inbox inmobiliario',
    short_name: 'Castresana',
    description:
      'Software interno de Asesoría Castresana (Oviedo): leads, conversaciones y propiedades en un solo lugar.',
    id: '/',
    start_url: '/inbox',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#100E0C',
    theme_color: '#100E0C',
    lang: 'es-ES',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [{ name: 'Inbox', url: '/inbox' }],
  };
}
