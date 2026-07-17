/* ============================================================================
   CASTRESANA — Service Worker (PLACEHOLDER)
   ----------------------------------------------------------------------------
   Este SW aún NO implementa estrategia de caché. Solo se instala y activa para
   dejar el terreno preparado y que la app sea instalable como PWA.

   Próximo paso (cuando definamos offline real):
     - Precache del App Shell (rutas base + estáticos críticos).
     - Runtime caching (stale-while-revalidate para datos, cache-first para
       imágenes de propiedades).
     - Página offline de reserva.
   Recomendado migrar a Workbox / serwist en ese momento.
   ============================================================================ */

const VERSION = 'castresana-v0-placeholder';

self.addEventListener('install', () => {
  // Activa esta versión inmediatamente, sin esperar a que se cierren pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Toma control de las páginas ya abiertas.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Placeholder: dejamos pasar todas las peticiones a la red (sin caché).
  // No interceptamos nada todavía.
});
