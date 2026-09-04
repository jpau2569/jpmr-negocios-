/* ═══════════════════════════════════════════════════════════════════
   SOL NIEBLA Y AGUA — service worker
   · Casco de la app (HTML/CSS/JS/iconos): cache-first, se refresca en
     segundo plano para que la próxima apertura ya vaya actualizada.
   · Datos meteorológicos: red primero con caída a la última respuesta
     guardada, para que la app siga siendo útil sin cobertura.
   ═══════════════════════════════════════════════════════════════════ */

const VERSION = 'sna-v2.3.0';
const CASCO  = `${VERSION}-casco`;
const DATOS  = `${VERSION}-datos`;

const RECURSOS = [
  './',
  './index.html',
  './app.html',
  './styles.css',
  './app.js',
  './utiles.js',
  './datos.js',
  './indice.js',
  './interfaz.js',
  './manifest.json',
  './icono.svg',
  './icono-monocromo.svg',
  './icono-192.png',
  './icono-512.png',
  './icono-180.png',
  './icono-maskable-192.png',
  './icono-maskable-512.png'
];

/* Se guardan de uno en uno a propósito: `addAll` es todo o nada, así que un
   solo recurso que falte (por ejemplo un icono aún no generado, o una ruta
   que el hosting sirva distinto) dejaba a la app entera sin modo offline. */
self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CASCO);
    const resultados = await Promise.allSettled(RECURSOS.map(r => cache.add(r)));
    const fallidos = resultados
      .map((r, i) => r.status === 'rejected' ? RECURSOS[i] : null)
      .filter(Boolean);
    if (fallidos.length) console.warn('[SNA] sin cachear:', fallidos.join(', '));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ── Datos meteorológicos: red primero ──────────────────────────────
  // Tanto el backend propio (/api/tiempo) como Open-Meteo directo.
  if (url.hostname.endsWith('open-meteo.com') || url.pathname.startsWith('/api/tiempo')){
    evento.respondWith((async () => {
      const cache = await caches.open(DATOS);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err){
        const guardada = await cache.match(req);
        if (guardada) return guardada;
        throw err;
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ── Navegación: casco cacheado, con red de apoyo ───────────────────
  if (req.mode === 'navigate'){
    evento.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return (await caches.match('./app.html')) || Response.error();
      }
    })());
    return;
  }

  // ── Resto del casco: cache-first + revalidación en segundo plano ───
  evento.respondWith((async () => {
    const cache = await caches.open(CASCO);
    const guardada = await cache.match(req, { ignoreSearch: true });
    const enRed = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return guardada || (await enRed) || Response.error();
  })());
});

// Permite activar una versión nueva sin cerrar la app
self.addEventListener('message', evento => {
  if (evento.data === 'sna:actualizar') self.skipWaiting();
});
