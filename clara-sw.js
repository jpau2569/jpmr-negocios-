// ============================================================================
//  Service worker de Clara — "Compartir con Clara"
// ----------------------------------------------------------------------------
//  Solo hace una cosa: recibir lo que Pau comparte desde WhatsApp (u otra app
//  de Android) con el menú Compartir → Clara. El manifiesto (clara.webmanifest)
//  declara share_target con POST a /clara-compartir; aquí se guardan los
//  archivos y el texto en la caché "clara-compartido" y se abre el chat, que
//  los recoge (clara.html → recogeCompartido). El resto de peticiones no se
//  tocan: van a la red como siempre.
// ============================================================================

const CACHE = "clara-compartido";
const MAX_ARCHIVOS = 6;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || url.pathname !== "/clara-compartir") return;
  e.respondWith(
    (async () => {
      try {
        const form = await e.request.formData();
        const archivos = form
          .getAll("archivos")
          .filter((f) => f && typeof f === "object" && f.size > 0)
          .slice(0, MAX_ARCHIVOS);
        await caches.delete(CACHE);
        const cache = await caches.open(CACHE);
        for (let i = 0; i < archivos.length; i++) {
          await cache.put(
            `/clara-compartido/f${i}`,
            new Response(archivos[i], { headers: { "Content-Type": archivos[i].type || "application/octet-stream" } })
          );
        }
        const meta = {
          title: String(form.get("title") || ""),
          text: String(form.get("text") || ""),
          url: String(form.get("url") || ""),
          n: archivos.length,
          tipos: archivos.map((f) => f.type),
          nombres: archivos.map((f) => f.name),
          recibido: Date.now(),
        };
        await cache.put("/clara-compartido/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
      } catch {
        // Si algo falla, el chat se abre igual y Clara pide adjuntarlo con el clip.
      }
      return Response.redirect("/clara.html?compartido=1", 303);
    })()
  );
});
