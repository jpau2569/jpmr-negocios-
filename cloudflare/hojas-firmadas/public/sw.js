/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — service worker
   Guarda la app (esqueleto, estilos, JavaScript, icono y logo) para que
   abra y se pueda firmar en un piso sin cobertura.
   NUNCA guarda /api/: ahí están los datos de clientes.
   Red primero (4 s de margen con poca cobertura) y, si no, la copia.
   Al tocar cualquier archivo de la lista: súbelo aquí y sube VERSION.
   ═══════════════════════════════════════════════════════════════════ */
const VERSION = 'hojas-firmadas-v2';
const RECURSOS = [
  '/',
  '/manifest.webmanifest',
  '/icono-192.png',
  '/icono-512.png',
  '/marca/logo.jpg',
  '/static/estilos.css',
  '/static/app/app.js',
  '/static/app/cola.js',
  '/static/app/vistas.js',
  '/static/nucleo/hoja.js',
  '/static/nucleo/jpeg.js',
  '/static/nucleo/marca.js',
  '/static/nucleo/pdf-hoja.js',
  '/static/cerebro/campos-piso.js',
  '/static/cerebro/documentos.js',
  '/static/cerebro/firma.js',
  '/static/cerebro/operaciones-datos.js',
  '/static/cerebro/pdf.js',
  '/static/cerebro/utiles.js',
  '/static/cerebro/valoracion.js',
  '/static/cerebro/visitas.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(RECURSOS.map((r) => cache.add(new Request(r, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('hojas-firmadas-') && n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

const conPlazo = (promesa, ms) => Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error('plazo')), ms))]);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const r = await conPlazo(fetch(e.request), 4000);
      if (r.ok && RECURSOS.includes(url.pathname)) cache.put(url.pathname, r.clone()).catch(() => {});
      return r;
    } catch {
      const guardada = await cache.match(e.request.mode === 'navigate' ? '/' : url.pathname);
      return guardada || new Response('Sin conexión', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});
