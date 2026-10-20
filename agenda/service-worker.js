/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — service worker
   La app abre y funciona sin conexión (los datos están en el aparato).
   Sin internet solo fallan los vídeos incrustados y abrir enlaces.
   Al tocar cualquier archivo de la lista: súbelo aquí y sube VERSION.
   ═══════════════════════════════════════════════════════════════════ */

const VERSION = 'olvido-agenda-v1.0.1';
const RECURSOS = [
  './', './index.html', './app.html', './styles.css', './app.js', './ui.js', './utiles.js', './datos.js', './comun.js',
  './captura.js', './busqueda.js', './exportar.js', './recordatorios.js',
  './p-hoy.js', './p-agenda.js', './p-tareas.js', './p-clientes.js', './p-inmuebles.js', './p-notas.js',
  './p-biblioteca.js', './p-asistente.js', './p-ajustes.js', './p-global.js',
  './manifest.json', './logo.svg', './icono-180.png', './icono-192.png', './icono-512.png', './icono-maskable-512.png',
];

// De uno en uno: un recurso que falle no deja la app sin modo sin conexión.
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
    await Promise.all(nombres.filter((n) => n.startsWith('olvido-agenda-') && n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Red primero con tiempo máximo (así se ve la última versión), y la copia guardada si no hay red.
const conTiempo = (promesa, ms) => Promise.race([promesa, new Promise((_, no) => setTimeout(() => no(new Error('lento')), ms))]);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const red = fetch(e.request).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)).catch(() => {}); }
      return resp;
    });
    try {
      return await conTiempo(red, 3000);
    } catch {
      const guardada = await caches.match(e.request, { ignoreSearch: true });
      if (guardada) return guardada;
      if (e.request.mode === 'navigate') { const app = await caches.match('./app.html'); if (app) return app; }
      return red.catch(() => Response.error());
    }
  })());
});

// Tocar una notificación abre (o enfoca) la agenda.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (ventanas[0]) return ventanas[0].focus();
    return self.clients.openWindow('./app.html#hoy');
  })());
});
