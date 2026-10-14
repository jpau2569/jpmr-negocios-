// ============================================================================
//  Marcador de tokens (uso-marcador.js) en un Chromium real.
//  Ejecutar con: node test/uso-marcador.ui.test.mjs
// ============================================================================
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

let pasados = 0, fallados = 0;
const check = (n, c) => { if (c) { pasados++; console.log(`  ✅ ${n}`); } else { fallados++; console.error(`  ❌ ${n}`); } };
const RAIZ = new URL("..", import.meta.url).pathname;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const srv = http.createServer(async (q, r) => {
  try { const p = decodeURIComponent(q.url.split("?")[0]); const b = await readFile(join(RAIZ, p)); r.writeHead(200, { "content-type": TIPOS[extname(p)] || "application/octet-stream" }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const BASE = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const mes = new Date().toISOString().slice(0, 7);
const uso = { meses: { [mes]: { entrada: 12000, salida: 3400, cache_lectura: 50000, cache_escritura: 2000, llamadas: 7, coste_usd: 0.4231 } }, nube: null, tope: 5 };
const leePastilla = (pg) => pg.evaluate(() => document.querySelector("#uso-marcador")?.shadowRoot.getElementById("pill").textContent);

console.log("Marcador de tokens");
for (const ruta of ["/index.html", "/clara.html", "/cerebro/app.html", "/nicer-estudia/app.html", "/oportunidades/index.html", "/sol-niebla-agua/app.html"]) {
  const pg = await browser.newPage({ viewport: { width: 360, height: 740 } });
  const errores = []; pg.on("pageerror", (e) => errores.push(String(e)));
  await pg.addInitScript((u) => localStorage.setItem("clara_uso_v1", JSON.stringify(u)), uso);
  await pg.goto(BASE + ruta); await pg.waitForTimeout(400);
  const t = await leePastilla(pg);
  check(`${ruta}: enseña tokens y gasto (${t})`, /67,4 k tokens/.test(t || "") && /0,42 \$/.test(t || ""));
  check(`${ruta}: sin errores de JavaScript del marcador`, !errores.some((e) => /uso-marcador|__usoMarcador/.test(e)));
  await pg.close();
}

const nuevo = await browser.newPage();
await nuevo.goto(BASE + "/index.html"); await nuevo.waitForTimeout(300);
check("visitante sin Clara: no se ve", await nuevo.evaluate(() => getComputedStyle(document.querySelector("#uso-marcador")).display) === "none");
await nuevo.goto(BASE + "/index.html?tokens=1"); await nuevo.waitForTimeout(300);
check("?tokens=1 lo activa (con 0 tokens)", /0 tokens/.test(await leePastilla(nuevo)));
await nuevo.evaluate(() => document.querySelector("#uso-marcador").shadowRoot.getElementById("pill").click());
await nuevo.evaluate(() => document.querySelector("#uso-marcador").shadowRoot.getElementById("ocultar").click());
check("«Ocultar» lo apaga", await nuevo.evaluate(() => getComputedStyle(document.querySelector("#uso-marcador")).display) === "none");
await nuevo.goto(BASE + "/index.html"); await nuevo.waitForTimeout(300);
check("sigue oculto tras recargar", await nuevo.evaluate(() => getComputedStyle(document.querySelector("#uso-marcador")).display) === "none");

for (const ruta of ["/escaparate.html", "/oportunidades/portal.html"]) {
  const pg = await browser.newPage();
  await pg.addInitScript((u) => localStorage.setItem("clara_uso_v1", JSON.stringify(u)), uso);
  await pg.goto(BASE + ruta); await pg.waitForTimeout(300);
  check(`${ruta}: páginas de clientes sin marcador`, (await pg.evaluate(() => !document.querySelector("#uso-marcador"))));
  await pg.close();
}
await browser.close(); srv.close();
console.log(`\n${pasados} correctas, ${fallados} fallidas`);
process.exit(fallados ? 1 : 0);
