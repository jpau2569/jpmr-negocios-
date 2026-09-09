// ============================================================================
//  Tests de plano-vivienda.html — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  Sin salida a Internet: se sirve el repositorio en local y Three.js sale de
//  node_modules en vez del CDN. Comprueban que el plano se pinta a escala, que
//  las estancias se pueden clicar, que las medidas recalculan todo y que la
//  maqueta 3D arranca.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = 8134;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
                ".css": "text/css", ".json": "application/json" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

console.log("\n📐 Plano de vivienda\n");

const html = await readFile(join(RAIZ, "plano-vivienda.html"), "utf8");
check("la página declara el importmap de Three.js", html.includes('"three":"https://unpkg.com/three@0.169.0'));
check("lleva el lienzo del plano y la caja de la escena 3D",
  html.includes('id="lienzo"') && html.includes('id="escena"'));
check("avisa de que las medidas son orientativas", /orientativ/i.test(html));

const servidor = http.createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(req.url.split("?")[0]);
    const cuerpo = await readFile(join(RAIZ, ruta));
    res.writeHead(200, { "content-type": TIPOS[extname(ruta)] || "application/octet-stream" });
    res.end(cuerpo);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((ok) => servidor.listen(PUERTO, ok));
const BASE_URL = `http://127.0.0.1:${PUERTO}/plano-vivienda.html`;

const opciones = { args: ["--no-sandbox"] };
if (process.env.CHROME_BIN) opciones.executablePath = process.env.CHROME_BIN;
const navegador = await chromium.launch(opciones);
const contexto = await navegador.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
// Sin red en los tests: las tipografías del CDN se sirven vacías.
await contexto.route("**fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));

let three = null, orbit = null;
try {
  three = await readFile(join(RAIZ, "node_modules/three/build/three.module.js"), "utf8");
  orbit = await readFile(join(RAIZ, "node_modules/three/examples/jsm/controls/OrbitControls.js"), "utf8");
} catch { /* sin three instalado */ }
if (three) {
  await contexto.route("**unpkg.com/three@0.169.0/build/three.module.js",
    (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: three }));
  await contexto.route("**unpkg.com/three@0.169.0/examples/jsm/controls/OrbitControls.js",
    (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: orbit }));
}

const pagina = await contexto.newPage();
const errores = [];
pagina.on("pageerror", (e) => errores.push(String(e)));
pagina.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });

await pagina.goto(BASE_URL, { waitUntil: "load" });
await pagina.waitForTimeout(500);

const pintados = await pagina.evaluate(() => {
  const c = document.getElementById("lienzo");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++;
  return n;
});
check("el plano se dibuja en el lienzo", pintados > 1500, `muestras pintadas: ${pintados}`);

const resumen = () => pagina.evaluate(() => document.getElementById("totales").innerText.replace(/\n/g, " "));
const totales = await resumen();
check("el resumen cuenta las tres habitaciones del croquis", /Habitaciones\s+3/.test(totales), totales);
check("el resumen da la superficie útil", /Superficie útil interior\s+\d/.test(totales), totales);
check("el resumen da frente y fondo", /Frente total\s+19,6 m/.test(totales) && /Fondo\s+9 m/.test(totales), totales);

const clic = async (fx, fy) => {
  // El botón de restablecer mueve el scroll: hay que recolocar el lienzo antes de tocarlo.
  await pagina.locator("#lienzo").scrollIntoViewIfNeeded();
  const caja = await pagina.locator("#lienzo").boundingBox();
  await pagina.mouse.click(caja.x + caja.width * fx, caja.y + caja.height * fy);
  await pagina.waitForTimeout(120);
  return pagina.evaluate(() => [
    document.getElementById("fichaTitulo").textContent,
    document.getElementById("fichaArea").innerText,
    document.getElementById("fichaMedidas").innerText
  ].join(" | "));
};
const salon = await clic(0.30, 0.62);
check("al tocar el salón sale su ficha", /Salón/.test(salon), salon);
check("el salón se mide como la ele del croquis (dos rectángulos)", /\+/.test(salon), salon);
const hab = await clic(0.72, 0.25);
check("al tocar una habitación sale su ficha", /Habitación/.test(hab), hab);
const patio = await clic(0.52, 0.45);
check("el patio central también es clicable", /Patio/.test(patio), patio);

await pagina.fill("#c_fondo", "12");
await pagina.waitForTimeout(200);
check("cambiar el fondo recalcula el resumen", /Fondo\s+12 m/.test(await resumen()));
await pagina.click("#btnReset");
await pagina.waitForTimeout(200);
check("restablecer devuelve las medidas de fábrica", /Fondo\s+9 m/.test(await resumen()));

await clic(0.72, 0.25);
await pagina.fill("#fichaNombre", "Dormitorio principal");
await pagina.waitForTimeout(200);
check("se puede renombrar una estancia",
  (await pagina.textContent("#fichaTitulo")).includes("Dormitorio principal"));

await pagina.reload({ waitUntil: "load" });
await pagina.waitForTimeout(400);
check("las medidas y los nombres se recuerdan en el dispositivo",
  (await pagina.content()).includes("Dormitorio principal") ||
  await pagina.evaluate(() => JSON.parse(localStorage.getItem("plano-vivienda-castresana")).nombres.hab2 === "Dormitorio principal"));

const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btnPng")]);
check("el botón descarga el plano en PNG", descarga.suggestedFilename().endsWith(".png"), descarga.suggestedFilename());

if (three) {
  await pagina.click("#tab3d");
  await pagina.waitForTimeout(2500);
  const info = await pagina.evaluate(() => {
    const c = document.querySelector("#escena canvas");
    return { hay: !!c, ancho: c ? c.width : 0, aviso: getComputedStyle(document.getElementById("aviso3d")).display };
  });
  check("la pestaña 3D levanta la escena", info.hay && info.ancho > 100, JSON.stringify(info));
  check("no aparece el aviso de «sin 3D»", info.aviso === "none");
  const lienzo3d = await pagina.locator("#escena canvas").boundingBox();
  await pagina.mouse.click(lienzo3d.x + lienzo3d.width * 0.5, lienzo3d.y + lienzo3d.height * 0.55);
  await pagina.waitForTimeout(250);
  const titulo3d = await pagina.textContent("#fichaTitulo");
  check("en el 3D también se selecciona una estancia con un clic",
    titulo3d !== "Ninguna estancia seleccionada", titulo3d);
} else {
  console.log("  ⚠️  three no está instalado (npm i): me salto la comprobación de la escena 3D.");
}

check("la página no suelta errores de JavaScript", errores.length === 0, errores.join(" / "));

await navegador.close();
await new Promise((ok) => servidor.close(ok));

console.log(`\n${fallados === 0 ? "✅" : "❌"} plano-vivienda: ${pasados} bien, ${fallados} mal\n`);
process.exit(fallados === 0 ? 0 : 1);
