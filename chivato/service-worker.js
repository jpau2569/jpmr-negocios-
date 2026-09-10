/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — service worker
   · Casco de la app y catálogo de testigos: se sirven desde la caché y se
     refrescan por detrás, para que la app abra al instante y funcione en
     un aparcamiento subterráneo sin cobertura.
   · /api/chivato: red siempre. Un análisis cacheado sería un diagnóstico
     viejo, y eso es peor que no tener respuesta.
   ═══════════════════════════════════════════════════════════════════════ */

const VERSION = 'chivato-v1.0.0';
const CASCO = `${VERSION}-casco`;

const RECURSOS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './datos/testigos.json',
  './js/app.js',
  './js/catalogo.js',
  './js/camara.js',
  './js/vision.js',
  './js/historial.js',
  './js/interfaz.js',
  './js/iconos.js',
  './icono-32.png',
  './icono-96.png',
  './icono-180.png',
  './icono-192.png',
  './icono-512.png',
  './icono-maskable-192.png',
  './icono-maskable-512.png',
];

/* Se guardan de uno en uno: `addAll` es todo o nada, y un solo recurso que
   falte dejaría la app entera sin modo sin conexión. */
self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CASCO);
    const resultados = await Promise.allSettled(RECURSOS.map((r) => cache.add(r)));
    const fallidos = resultados
      .map((r, i) => (r.status === 'rejected' ? RECURSOS[i] : null))
      .filter(Boolean);
    if (fallidos.length) console.warn('[chivato] sin cachear:', fallidos);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;              // el análisis, siempre fresco
  if (url.origin !== self.location.origin) return;          // tipografías y demás, al navegador

  evento.respondWith((async () => {
    const cache = await caches.open(CASCO);
    const guardado = await cache.match(request, { ignoreSearch: true });

    const desdeRed = fetch(request)
      .then((resp) => {
        if (resp && resp.ok) cache.put(request, resp.clone());
        return resp;
      })
      .catch(() => null);

    if (guardado) { evento.waitUntil(desdeRed); return guardado; }

    const resp = await desdeRed;
    if (resp) return resp;

    // Navegación sin red y sin copia: se sirve la portada de la app.
    if (request.mode === 'navigate') {
      const portada = await cache.match('./index.html');
      if (portada) return portada;
    }
    return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
  })());
});
