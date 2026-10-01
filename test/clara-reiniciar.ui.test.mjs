// ============================================================================
//  Test del botón 🔄 Reiniciar de Clara con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: npm run test:ui
//  Comprueba que Reiniciar borra la conversación y las cachés, quita el
//  service worker, recarga y enseña el estado del servidor, SIN borrar la
//  Memoria, la clave de sincronización ni la preferencia de voz.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8125;
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

let consultasEstado = 0;
const server = http.createServer(async (req, res) => {
  const [path0, qs = ""] = req.url.split("?");
  const path = path0 === "/" ? "/clara.html" : path0;
  if (path === "/api/clara" && req.method === "GET" && qs.includes("estado")) {
    consultasEstado++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true, resumen: "Clara puede responder.",
      piezas: [
        { id: "claude", nombre: "Cerebro (Claude)", activa: true, falta: [] },
        { id: "buscador", nombre: "Búsqueda web y oídos", activa: true, falta: [] },
        { id: "nube", nombre: "Memoria y leads en la nube", activa: false, falta: ["SUPABASE_URL"] },
        { id: "conectores", nombre: "Conectores MCP", activa: false, falta: [] },
      ],
    }));
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
const page = await (await browser.newContext()).newPage();
const erroresJs = [];
page.on("pageerror", (e) => erroresJs.push(String(e)));

console.log("\n— 🔄 Reiniciar —");
await page.goto(`http://localhost:${PORT}/clara.html`);
await page.waitForFunction(() => navigator.serviceWorker?.getRegistrations().then((r) => r.length > 0), null, { timeout: 5000 }).catch(() => {});

// Estado previo: conversación guardada, memoria, clave, voz y una caché.
await page.evaluate(async () => {
  localStorage.setItem("clara_chat_v1", JSON.stringify({ history: [{ role: "user", content: "conversación vieja XYZ" }, { role: "assistant", content: "respuesta vieja" }], mode: null }));
  localStorage.setItem("clara_memoria_v1", "Pau vive en Oviedo");
  localStorage.setItem("clara_sync_v1", "clave-sync");
  localStorage.setItem("clara_voz_v1", "1");
  const c = await caches.open("vieja"); await c.put("/x", new Response("x"));
});
await page.reload();
check("la conversación vieja aparece antes de reiniciar", (await page.locator("#chat").innerText()).includes("respuesta vieja"));
check("hay botón 🔄 Reiniciar visible", await page.locator("#reboot").isVisible());

page.once("dialog", (d) => d.accept());
await Promise.all([page.waitForURL(/clara\.html$/, { timeout: 10000 }), page.click("#reboot")]);
await page.locator("text=Clara reiniciada con la última versión").waitFor({ timeout: 5000 });

const chat = await page.locator("#chat").innerText();
check("tras reiniciar: conversación vieja borrada", !chat.includes("respuesta vieja"));
check("tras reiniciar: enseña el estado del servidor", chat.includes("✅ Cerebro (Claude)") && chat.includes("⚠️ Memoria y leads en la nube — falta SUPABASE_URL"));
check("no lista conectores inactivos", !chat.includes("Conectores MCP"));
check("consulta el estado una sola vez", consultasEstado === 1, `consultas=${consultasEstado}`);
check("la URL queda limpia (sin ?v=)", !page.url().includes("?"));
const ls = await page.evaluate(() => ({ m: localStorage.getItem("clara_memoria_v1"), s: localStorage.getItem("clara_sync_v1"), v: localStorage.getItem("clara_voz_v1") }));
check("conserva Memoria, clave y voz", ls.m === "Pau vive en Oviedo" && ls.s === "clave-sync" && ls.v === "1");
check("borra las cachés antiguas", !(await page.evaluate(() => caches.keys())).includes("vieja"));

// Si el usuario cancela, no se toca nada.
await page.evaluate(() => localStorage.setItem("clara_chat_v1", JSON.stringify({ history: [{ role: "user", content: "hola" }, { role: "assistant", content: "seguimos aquí" }], mode: null })));
await page.reload();
page.once("dialog", (d) => d.dismiss());
await page.click("#reboot");
await page.waitForTimeout(500);
check("cancelar no borra la conversación", (await page.locator("#chat").innerText()).includes("seguimos aquí"));
check("una recarga normal no enseña el informe", !(await page.locator("#chat").innerText()).includes("Clara reiniciada"));
check("sin errores de JavaScript", erroresJs.length === 0, erroresJs.join(" | "));

await browser.close();
server.close();
console.log(`\nResultado Reiniciar: ${pasados} pasados, ${fallados} fallados.`);
process.exit(fallados ? 1 : 0);
