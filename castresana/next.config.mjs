import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Este proyecto vive en una subcarpeta con su propio lockfile; fijamos la
  // raíz para que Next no la infiera del repositorio padre.
  outputFileTracingRoot: projectRoot,
  // El manifest y el service worker viven en /public y se sirven tal cual.
  // Cuando integremos una estrategia de caché real (Workbox / serwist),
  // aquí añadiremos las cabeceras y el registro del SW definitivo.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
