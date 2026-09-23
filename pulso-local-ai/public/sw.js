// ============================================================================
//  Service worker
// ----------------------------------------------------------------------------
//  Estrategia deliberadamente conservadora: la red manda SIEMPRE, y la caché
//  solo entra cuando la red falla. En un bar el wifi va y viene, y lo peor que
//  puede pasar es enseñar el menú del día de ayer como si fuera el de hoy.
//
//  No se cachea nada de /api/: ni una reserva ni un evento de analítica.
// ============================================================================

const CACHE = "pulso-local-v1";

self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(peticion);
        if (guardada) return guardada;
        return new Response(
          "<!doctype html><meta charset=utf-8><title>Sin conexión</title>" +
          "<body style='font-family:system-ui;background:#0e0f11;color:#f3efe6;padding:2rem;text-align:center'>" +
          "<h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas cobertura, " +
          "o pregunta en la barra.</p></body>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
        );
      })
  );
});
