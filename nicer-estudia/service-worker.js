/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — service worker
   La app tiene que abrirse en el recreo, en el autobús y en el pasillo
   del colegio: sin cobertura todo funciona menos el Profe, que necesita
   internet y por eso nunca se cachea.
   Al tocar cualquier .js: añádelo a RECURSOS y sube VERSION.
   ═══════════════════════════════════════════════════════════════════ */

const VERSION = 'nicer-v2.0.0';
const CASCO = `${VERSION}-casco`;

const RECURSOS = [
  './',
  './index.html',
  './app.html',
  './styles.css',
  './app.js',
  './utiles.js',
  './datos.js',
  './repaso.js',
  './cuestionario.js',
  './esquema.js',
  './ambiente.js',
  './interfaz.js',
  './manifest.json',
  './icono.svg',
  './icono-192.png',
  './icono-512.png',
  './icono-180.png',
  './icono-maskable-192.png',
  './icono-maskable-512.png'
];

/* De uno en uno a propósito: `addAll` es todo o nada, y un solo recurso que
   falle dejaría a la app entera sin modo sin conexión. */
self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CASCO);
    const resultados = await Promise.allSettled(RECURSOS.map((r) => cache.add(r)));
    const fallidos = resultados
      .map((r, i) => (r.status === 'rejected' ? RECURSOS[i] : null))
      .filter(Boolean);
    if (fallidos.length) console.warn('[Nicer] sin cachear:', fallidos.join(', '));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // el Profe siempre en directo

  if (req.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return (await caches.match('./app.html')) || Response.error();
      }
    })());
    return;
  }

  evento.respondWith((async () => {
    const cache = await caches.open(CASCO);
    const guardada = await cache.match(req, { ignoreSearch: true });
    const enRed = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return guardada || (await enRed) || Response.error();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'nicer:actualizar') self.skipWaiting();
});
