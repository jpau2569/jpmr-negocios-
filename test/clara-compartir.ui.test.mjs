// ============================================================================
//  Test de "Compartir con Clara" con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: npm run test:ui
//  Simula lo que hace Android al compartir desde WhatsApp: un POST
//  multipart a /clara-compartir (el destino del share_target del manifiesto).
//  Lo recoge el service worker clara-sw.js, el chat adjunta las fotos, prepara
//  el mensaje y al enviarlo las fotos viajan a /api/clara (simulada aquí).
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8124;
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const peticiones = [];
const server = http.createServer(async (req, res) => {
  const path = req.url === "/" ? "/clara.html" : req.url.split("?")[0];
  if (path === "/api/clara") {
    let cuerpo = "";
    for await (const trozo of req) cuerpo += trozo;
    peticiones.push(JSON.parse(cuerpo));
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(`data: ${JSON.stringify({ t: "Veo dos fotos del salón." })}\n\ndata: ${JSON.stringify({ done: true, reply: "Veo dos fotos del salón." })}\n\n`);
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405).end("el servidor no debería recibir este POST");
    return;
  }
  try {
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("no encontrado");
  }
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext();
const page = await context.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));

const BASE = `http://localhost:${PORT}`;

console.log("\n📲 Manifiesto");
const manifiesto = JSON.parse(await readFile(join(ROOT, "clara.webmanifest"), "utf8"));
check("declara share_target por POST multipart", manifiesto.share_target?.method === "POST" && manifiesto.share_target?.enctype === "multipart/form-data" && manifiesto.share_target?.action === "/clara-compartir");
check("acepta fotos y el campo coincide con el service worker", manifiesto.share_target?.params?.files?.[0]?.name === "archivos" && manifiesto.share_target.params.files[0].accept.includes("image/*"));
check("iconos PNG 192 y 512 (los pide Android para instalarla)", ["192x192", "512x512"].every((t) => manifiesto.icons.some((i) => i.sizes === t && i.type === "image/png")));

console.log("\n⚙️ Service worker");
await page.goto(`${BASE}/clara.html`);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
const controlada = await page.evaluate(() => !!navigator.serviceWorker.controller);
check("clara-sw.js se registra y controla el chat", controlada);
const alcance = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
check("su alcance se limita a /clara (no toca las otras apps)", alcance === `${BASE}/clara`, alcance);

console.log("\n📤 Compartir desde WhatsApp (simulado)");
const destino = await page.evaluate(async () => {
  const foto = (color) =>
    new Promise((ok) => {
      const c = document.createElement("canvas");
      c.width = 400; c.height = 300;
      const g = c.getContext("2d");
      g.fillStyle = color; g.fillRect(0, 0, 400, 300);
      c.toBlob((b) => ok(new File([b], `IMG-${color.slice(1)}.png`, { type: "image/png" })), "image/png");
    });
  const fd = new FormData();
  fd.append("text", "Mira el piso que te dije https://www.asesoriacastresana.com/inmueble/123");
  fd.append("archivos", await foto("#c9a227"));
  fd.append("archivos", await foto("#10203a"));
  const r = await fetch("/clara-compartir", { method: "POST", body: fd });
  return r.url;
});
check("el service worker responde y redirige al chat", destino.endsWith("/clara.html?compartido=1"), destino);

await page.goto(`${BASE}/clara.html?compartido=1`);
await page.waitForFunction(() => document.querySelectorAll("#attachbar .attachchip").length === 2, null, { timeout: 5000 }).catch(() => {});
check("las 2 fotos quedan adjuntas", (await page.locator("#attachbar .attachchip").count()) === 2);
const texto = await page.inputValue("#input");
check("mensaje preparado con el enlace y el hueco para el piso", texto.startsWith("📲 Compartido desde WhatsApp (2 archivos)") && texto.includes("asesoriacastresana.com/inmueble/123") && texto.trimEnd().endsWith("Es del piso:"), texto);
check("la dirección se limpia (recargar no lo repite)", !page.url().includes("compartido"));
check("lo compartido se borra del almacén tras recogerlo", await page.evaluate(async () => !(await caches.has("clara-compartido"))));

console.log("\n✉️ Envío a Clara");
await page.fill("#input", texto + "Uría 12, hazme la ficha para Inmoweb");
await page.click("#send");
await page.waitForFunction(() => document.body.innerText.includes("Veo dos fotos del salón."), null, { timeout: 5000 }).catch(() => {});
const ultima = peticiones.at(-1);
const msj = ultima?.messages?.at(-1);
check("viajan las 2 fotos como adjuntos JPEG", msj?.adjuntos?.length === 2 && msj.adjuntos.every((a) => a.media_type === "image/jpeg" && a.data.length > 100));
check("con el texto de Pau", msj?.content?.includes("Uría 12"));
check("las fotos se ven en la burbuja", (await page.locator(".msg.user .adjs img.adj").count()) === 2);
check("la respuesta de Clara aparece", (await page.textContent("#chat")).includes("Veo dos fotos del salón."));

await page.reload();
check("tras recargar, la conversación sigue (sin guardar las fotos pesadas)", (await page.textContent("#chat")).includes("Uría 12") && (await page.evaluate(() => !localStorage.getItem("clara_chat_v1").includes("data:image"))));

console.log("\n🧹 Consola");
check("ni un error de JavaScript", errores.length === 0, errores.join(" | "));

await browser.close();
server.close();
console.log(`\nResultado Compartir: ${pasados} pasados, ${fallados} fallados.`);
process.exit(fallados === 0 ? 0 : 1);
