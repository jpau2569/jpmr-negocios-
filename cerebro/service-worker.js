/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — service worker
   En una visita puede no haber cobertura (sótanos, garajes, pueblos):
   la app abre y funciona sin conexión. Solo la lectura de documentos con
   foto necesita internet, y /api nunca se cachea.
   Al tocar cualquier archivo de la lista: súbelo aquí y sube VERSION.
   ═══════════════════════════════════════════════════════════════════ */

const VERSION = 'cerebro-v1.0.0';
const RECURSOS = [
  './', './index.html', './app.html', './styles.css', './app.js', './utiles.js', './datos.js',
  './calendario.js', './firma.js', './pdf.js', './documentos.js', './visitas.js', './operaciones.js',
  './operaciones-datos.js', './valoracion.js', './papeles.js', './manifest.json', './icono.svg',
  './icono-180.png', './icono-192.png', './icono-512.png', './icono-maskable-512.png',
];

// De uno en uno: un recurso que falle no deja la app entera sin modo sin conexión.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(RECURSOS.map((r) => cache.add(r)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('cerebro-') && n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Red primero (así Pau siempre ve la última versión) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    try {
      const resp = await fetch(e.request);
      if (resp.ok) {
        const copia = resp.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia)).catch(() => {});
      }
      return resp;
    } catch {
      const guardada = await caches.match(e.request, { ignoreSearch: true });
      return guardada || (e.request.mode === 'navigate' ? caches.match('./app.html') : Response.error());
    }
  })());
});
