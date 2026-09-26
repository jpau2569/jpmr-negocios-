// ============================================================================
//  Test de Cerebro Útil Pau con navegador real (Chromium + Playwright)
//  Ejecutar con: npm run test:ui
//  Recorre lo que hará Pau: firmar una hoja de visita y descargar su PDF,
//  crear una operación y avanzar, valorar con comparables, leer un papel con
//  foto (/api/cerebro simulada), copia de seguridad, sin conexión y anchos
//  de móvil y PC sin desbordes.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8125;
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const lecturas = [];
const server = http.createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/api/cerebro") {
    let cuerpo = "";
    for await (const t of req) cuerpo += t;
    lecturas.push(JSON.parse(cuerpo));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, lectura: { legible: true, tipo: "itv", titulo: "ITV Seat León 1234ABC", vence: "2027-03-14", otras_fechas: [{ que: "Inspección", fecha: "2026-03-14" }], notas: "Estación de Lugones" } }));
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
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, hasTouch: true });
const page = await context.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("dialog", (d) => d.accept());
const URL_APP = `http://localhost:${PORT}/cerebro/app.html`;
const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem("cerebro_util_pau_v1") || "null"));
const sinDesborde = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

console.log("\n🏠 Arranque");
await page.goto(URL_APP);
await page.waitForSelector("h1");
check("abre en Hoy con saludo", /Buen(os|as) (días|tardes|noches)/.test(await page.textContent("h1")));
check("cinco pestañas", (await page.locator(".pestanas button").count()) === 5);
check("sin desborde a 390 px", await sinDesborde());

console.log("\n✍️ Hoja de visita");
await page.click('a[href="#nueva-visita"]');
await page.waitForSelector("#form-visita");
check("aviso de textos legales en borrador", (await page.textContent("#vista")).includes("borrador"));
await page.click('#form-visita button[type="submit"]');
const errs = await page.textContent("#v-errores");
check("sin datos: explica qué falta (inmueble, nombre, RGPD y firma)", errs.includes("inmueble") && errs.includes("nombre") && errs.includes("protección de datos") && errs.includes("firma"), errs);
await page.fill("#v-inmueble", "Piso en C/ Uría 12, 3ºB");
await page.fill("#v-nombre", "Ana García López");
await page.fill("#v-dni", "12345678z");
await page.fill("#v-tel", "600 111 222");
await page.fill("#v-obs", "Le gusta la luz. <script>alert(1)</script>");
check("la declaración se rellena mientras escribe", (await page.textContent("#v-declaracion")).includes("Ana García López"));
await page.check("#v-rgpd");
const caja = await page.locator("#v-firma").boundingBox();
await page.mouse.move(caja.x + 30, caja.y + 120);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(caja.x + 30 + i * 22, caja.y + 120 - Math.sin(i / 2) * 50);
await page.mouse.up();
// Doble toque rápido en "Guardar": no debe duplicar la visita.
await page.evaluate(() => { const f = document.getElementById("form-visita"); f.requestSubmit(); f.requestSubmit(); });
await page.waitForFunction(() => location.hash.startsWith("#visita/"));
let e = await estado();
check("visita guardada con firma JPEG", e.visitas.length === 1 && e.visitas[0].firma.startsWith("data:image/jpeg;base64,") && e.visitas[0].visitante.dni === "12345678Z");
check("el texto del cliente se pinta como texto (sin HTML inyectado)", (await page.locator("#vista script").count()) === 0 && (await page.textContent("#vista")).includes("<script>"));
const [descargaPdf] = await Promise.all([page.waitForEvent("download"), page.click("#v-descargar")]);
const pdf = await readFile(await descargaPdf.path());
check("descarga un PDF válido con su nombre", pdf.subarray(0, 8).toString() === "%PDF-1.4" && descargaPdf.suggestedFilename().endsWith(".pdf") && /Uria-12/.test(descargaPdf.suggestedFilename()), descargaPdf.suggestedFilename());
check("el PDF lleva la firma y el nombre", pdf.includes(Buffer.from("/DCTDecode")) && pdf.includes(Buffer.from("Ana Garc", "latin1")));
await page.click('.pestanas button[data-ir="visitas"]');
await page.waitForSelector("#busca-visita");
await page.fill("#busca-visita", "garcia");
check("buscador encuentra sin tildes", (await page.locator("#lista-visitas .tarjeta").count()) === 1);

console.log("\n🛟 No perder trabajo");
await page.goto(URL_APP + "#nueva-visita");
await page.waitForSelector("#form-visita");
await page.fill("#v-nombre", "A medias");
let preguntado = "";
page.removeAllListeners("dialog");
page.once("dialog", (d) => { preguntado = d.message(); d.dismiss(); });
await page.click('.pestanas button[data-ir="hoy"]');
await page.waitForTimeout(300);
check("al salir con una visita a medias pregunta y, si dice que no, la conserva", preguntado.includes("a medias") && (await page.inputValue("#v-nombre")) === "A medias");
page.on("dialog", (d) => d.accept());
await page.click('.pestanas button[data-ir="hoy"]');
await page.waitForFunction(() => location.hash === "#hoy");

console.log("\n📑 Operación");
await page.goto(URL_APP + "#nueva-operacion");
await page.waitForSelector("#form-op");
await page.fill("#o-inmueble", "Piso en C/ Uría 12, 3ºB");
await page.fill("#o-precio", "240000");
await page.fill("#o-a-nombre", "Ana García");
await page.fill("#o-a-tel", "600111222");
await page.fill("#o-b-nombre", "Luis Pérez");
await page.fill("#o-notaria", "Notaría de la calle Uría");
await page.click('#form-op button[type="submit"]');
await page.waitForFunction(() => location.hash.startsWith("#operacion/"));
check("ficha con fases y la primera marcada", (await page.locator(".fases span.actual").textContent()).includes("Reserva"));
const primero = page.locator("[data-papel]").first();
await primero.check();
await page.waitForTimeout(100);
e = await estado();
check("marcar un papel se guarda", Object.values(e.operaciones[0].papeles).filter(Boolean).length === 1);
await page.click("#op-adelante");
check("avanza a la siguiente fase", (await page.locator(".fases span.actual").textContent()).includes("2."));
await page.click("text=＋ Añadir una fecha");
await page.fill("#f-nombre", "Firma en notaría");
await page.fill("#f-fecha", "2026-10-05");
await page.fill("#f-hora", "10:30");
await page.click('#form-fecha button[type="submit"]');
e = await estado();
check("fecha clave añadida", e.operaciones[0].fechas.length === 1 && e.operaciones[0].fechas[0].hora === "10:30");
check("mensajes preparados con nombres y fecha", (await page.textContent("#vista")).includes("Ana García") && (await page.textContent("#vista")).includes("05/10/2026"));
check("botón de WhatsApp al comprador", (await page.locator('a[href^="https://wa.me/34600111222"]').count()) > 0);
const [ics] = await Promise.all([page.waitForEvent("download"), page.click("#op-ics1")]);
const icsTxt = (await readFile(await ics.path())).toString();
check("calendario .ics con la firma y su alarma", icsTxt.includes("BEGIN:VEVENT") && icsTxt.includes("DTSTART:20261005T103000") && icsTxt.includes("VALARM"));

console.log("\n📊 Valoración");
await page.goto(URL_APP + "#valorar");
await page.click("#val-nueva");
await page.waitForFunction(() => location.hash.startsWith("#valoracion/"));
await page.fill("#vi-direccion", "C/ Uría 12, 3ºB");
await page.fill("#vi-m2", "92");
check("sin comparables no hay precio y el PDF está bloqueado", (await page.textContent("#val-resultado")).includes("comparable") && (await page.isDisabled("#val-pdf")));
const comps = [["Uría 20", "250000", "95"], ["Campoamor 3", "230000", "90"], ["Pelayo 1", "275000", "100"]];
for (const [i, [dir, precio, m2]] of comps.entries()) {
  await page.click("#val-anade");
  await page.fill(`#c-${i}-dir`, dir);
  await page.fill(`#c-${i}-precio`, precio);
  await page.fill(`#c-${i}-m2`, m2);
}
const rango = await page.textContent("#val-resultado");
check("con 3 comparables da el rango", rango.includes("Rango orientativo") && /\d{3}\.\d{3}/.test(rango), rango);
check("PDF desbloqueado", !(await page.isDisabled("#val-pdf")));
const [valPdf] = await Promise.all([page.waitForEvent("download"), page.click("#val-descarga")]);
check("descarga el informe PDF", (await readFile(await valPdf.path())).subarray(0, 5).toString() === "%PDF-");
await page.reload();
await page.waitForSelector("#val-resultado");
check("los comparables se guardan al escribir", (await page.inputValue("#c-2-dir")) === "Pelayo 1");

console.log("\n📁 Papeles con foto");
await page.goto(URL_APP + "#papel/nuevo");
await page.waitForSelector("#pa-foto", { state: "attached" });
await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("cerebro_util_pau_v1")); e.ajustes.claveSync = "mi-clave"; localStorage.setItem("cerebro_util_pau_v1", JSON.stringify(e)); });
await page.reload();
await page.waitForSelector("#pa-foto", { state: "attached" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.setInputFiles("#pa-foto", { name: "itv.png", mimeType: "image/png", buffer: png });
await page.waitForFunction(() => document.getElementById("pa-vence").value === "2027-03-14", null, { timeout: 5000 }).catch(() => {});
check("la foto rellena tipo, nombre y fecha", (await page.inputValue("#pa-vence")) === "2027-03-14" && (await page.inputValue("#pa-titulo")).includes("ITV") && (await page.inputValue("#pa-tipo")) === "itv");
check("la foto viaja reducida a JPEG con la clave de sincronización", lecturas.at(-1)?.imagen?.media_type === "image/jpeg" && lecturas.at(-1)?.clave === "mi-clave");
check("pide revisar antes de guardar", (await page.textContent("#pa-lectura")).includes("Revísalo"));
await page.click('#form-papel button[type="submit"]');
await page.waitForFunction(() => location.hash === "#papeles" && document.querySelector("#vista h1")?.textContent.includes("Mis papeles"));
const listaPapeles = await page.textContent("#vista");
check("papel en la lista con su fecha", listaPapeles.includes("ITV Seat León") && listaPapeles.includes("14/03/2027"), listaPapeles.slice(0, 300));

console.log("\n⚙️ Ajustes y copia");
await page.goto(URL_APP + "#ajustes");
await page.waitForSelector("#aj-revisados");
await page.click("#aj-revisados");
check("no deja marcar revisados con [corchetes] sin completar", !(await page.isChecked("#aj-revisados")));
const [copia] = await Promise.all([page.waitForEvent("download"), page.click("#aj-copia")]);
const copiaJson = JSON.parse((await readFile(await copia.path())).toString());
check("copia con todo y SIN la clave de sincronización", copiaJson.app === "cerebro-util-pau" && copiaJson.visitas.length === 1 && copiaJson.operaciones.length === 1 && copiaJson.ajustes.claveSync === "");

console.log("\n🏠 Hoy con datos");
await page.goto(URL_APP + "#hoy");
await page.waitForSelector("h1");
check("Hoy resume operaciones en marcha", (await page.textContent("#vista")).includes("Operaciones en marcha"));

console.log("\n📴 Sin conexión");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForSelector("h1");
await context.setOffline(true);
await page.reload();
await page.waitForSelector("h1", { timeout: 5000 }).catch(() => {});
check("sin internet la app abre", (await page.locator(".pestanas").count()) === 1);
await page.click('.pestanas button[data-ir="visitas"]');
await page.waitForFunction(() => document.querySelector("#lista-visitas"), null, { timeout: 5000 }).catch(() => {});
check("y se ven las visitas guardadas", (await page.textContent("#vista")).includes("Ana García López"));
await context.setOffline(false);

console.log("\n📐 Anchos");
for (const [w, hgt] of [[360, 740], [768, 1024], [1366, 900]]) {
  await page.setViewportSize({ width: w, height: hgt });
  for (const ancla of ["hoy", "nueva-visita", "operaciones", "valorar", "papeles", "ajustes"]) {
    await page.goto(URL_APP + "#" + ancla);
    await page.waitForSelector("h1");
    if (!(await sinDesborde())) check(`sin desborde en #${ancla} a ${w} px`, false);
  }
  const op = (await estado()).operaciones[0].id;
  await page.goto(URL_APP + "#operacion/" + op);
  await page.waitForSelector("h1");
  check(`sin desborde horizontal a ${w} px (6 pantallas + ficha de operación)`, await sinDesborde());
}

console.log("\n🧹 Consola");
check("ni un error de JavaScript", errores.length === 0, errores.join(" | "));

await browser.close();
server.close();
console.log(`\nResultado Cerebro UI: ${pasados} pasados, ${fallados} fallados.`);
process.exit(fallados === 0 ? 0 : 1);
