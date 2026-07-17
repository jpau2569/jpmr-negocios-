/* ============================================================================
   CASTRESANA — Service Worker básico (fase 1)
   ----------------------------------------------------------------------------
   Alcance actual, deliberadamente mínimo:
     · Precachea la página offline y los iconos.
     · Para navegaciones: red primero; si falla, sirve /offline.html.
     · Todo lo demás pasa directo a la red (sin caché de datos aún).

   Fase PWA completa (más adelante): precache del app shell, runtime caching
   (stale-while-revalidate) y sincronización en segundo plano — idealmente
   con Workbox/serwist.
   ============================================================================ */

const CACHE_NAME = 'castresana-v1';
const PRECACHE_URLS = ['/offline.html', '/icons/icon.svg', '/icons/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpia cachés de versiones anteriores.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptamos navegaciones de página; el resto va directo a red.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const offline = await cache.match('/offline.html');
      return offline ?? Response.error();
    }),
  );
});
