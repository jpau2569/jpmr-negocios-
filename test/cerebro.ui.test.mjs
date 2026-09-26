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
    const pedido = JSON.parse(cuerpo);
    lecturas.push(pedido);
    res.writeHead(200, { "content-type": "application/json" });
    if (pedido.accion === "ficha") {
      res.end(JSON.stringify({ ok: true, dudas: ["No has dicho la orientación"], enlace: { leido: false },
        ficha: { direccion: "C/ Uría 12", planta: "3º B", municipio: "Oviedo", zona: "Centro", tipo: "Piso", operacion: "Venta", precio: 245000, m2Construidos: 95, habitaciones: 3, banos: 2, ascensor: "Sí", garaje: "No", propNombre: "Luis Pérez García", propTelefono: "600222333", tipoEncargo: "Exclusiva", honorarios: "3 % + IVA", duracion: "6 meses", inventado: "no debe entrar" } }));
      return;
    }
    if (pedido.accion === "comparables") {
      res.end(JSON.stringify({ ok: true, comparables: [
        { direccion: "Piso en Uría 20", precio: 250000, m2: 95, url: "https://www.idealista.com/inmueble/1/", fuente: "idealista" },
        { direccion: "Piso en Campoamor", precio: 230000, m2: 90, url: "https://www.fotocasa.es/2", fuente: "fotocasa" },
        { direccion: "Piso en Pelayo", precio: 275000, m2: 100, url: "javascript:alert(1)", fuente: "raro" },
      ] }));
      return;
    }
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
check("seis pestañas", (await page.locator(".pestanas button").count()) === 6);
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

console.log("\n🏘️ Pisos: captación con Clara, firmas y documentos");
await page.goto(URL_APP + "#ajustes");
await page.waitForSelector("#aj-firma");
const firmar = async (selector) => {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const b = await page.locator(selector).boundingBox();
  await page.mouse.move(b.x + 20, b.y + 80); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 20 + i * 20, b.y + 80 - Math.sin(i / 2) * 40);
  await page.mouse.up();
};
await firmar("#aj-firma");
await page.click("#aj-guarda-firma");
await page.waitForSelector("#aj-refirmar");
check("la firma del agente queda guardada en Ajustes", (await estado()).ajustes.firmaAgente.startsWith("data:image/jpeg"));
check("encabezado de firmas por defecto «ASESORIA CASTRESANA INMO»", (await page.inputValue("#aj-encabezadoFirmas")) === "ASESORIA CASTRESANA INMO");

await page.goto(URL_APP + "#piso/nuevo");
await page.waitForSelector("#pf-rellenar");
check("ficha nueva con la dirección limpia (sin /nuevo)", /#piso\/piso-/.test(page.url()));
await page.fill("#pf-dictado", "Piso en Uría 12, tercero B, Oviedo centro, 95 metros, tres habitaciones, dos baños, con ascensor, 245.000 euros. Propietario Luis Pérez García, exclusiva, 3 % más IVA, seis meses.");
await page.click("#pf-rellenar");
await page.waitForFunction(() => document.querySelector("#pf-estado")?.textContent.includes("He rellenado"), null, { timeout: 5000 }).catch(() => {});
check("Clara rellena la ficha y avisa de revisar y de sus dudas", (await page.textContent("#pf-estado")).includes("Revísalos") && (await page.textContent("#pf-estado")).includes("orientación"));
check("campos rellenos en el formulario", (await page.inputValue("#pf-direccion")) === "C/ Uría 12" && (await page.inputValue("#pf-precio")) === "245000" && (await page.inputValue("#pf-ascensor")) === "Sí");
const piso1 = (await estado()).pisos.at(-1);
check("lo inventado no entra en la ficha guardada", piso1.inventado === undefined && piso1.propNombre === "Luis Pérez García");
check("el dictado viaja al servidor con la clave", lecturas.at(-1).accion === "ficha" && lecturas.at(-1).texto.includes("tercero B") && lecturas.at(-1).clave === "mi-clave");
await page.fill("#pf-m2Utiles", "85.5");
await page.locator("#pf-comunidad").evaluate((el) => { el.closest("details").open = true; });
await page.fill("#pf-comunidad", "45.50");
await page.waitForTimeout(600);
check("decimales guardados tal cual (85,5 m² y 45,50 €)", (await estado()).pisos.at(-1).m2Utiles === 85.5 && (await estado()).pisos.at(-1).comunidad === 45.5);
// Rellenar otra vez no machaca lo escrito: avisa del choque y deja elegir.
await page.fill("#pf-precio", "250000");
await page.waitForTimeout(500);
await page.fill("#pf-dictado", "Otra vez los datos");
await page.click("#pf-rellenar");
await page.waitForSelector("[data-acepta]", { timeout: 5000 }).catch(() => {});
check("Rellenar con Clara no cambia lo que Pau ya tenía y lo enseña", (await estado()).pisos.at(-1).precio === 250000 && (await page.textContent("#pf-estado")).includes("tú tenías «250000»"));
await page.click('[data-acepta="precio"]');
check("…y con un toque se acepta lo de Clara", (await estado()).pisos.at(-1).precio === 245000);
await page.locator("#pf-lugarFirma").evaluate((el) => { el.closest("details").open = true; });
await page.selectOption("#pf-lugarFirma", "Fuera de la oficina");
await page.fill("#pf-precioMinimo", "230000");
await firmar("#pf-firma");
// Sin pulsar «Guardar firma»: al sacar el PDF la firma se guarda sola.
const [capSinGuardar] = await Promise.all([page.waitForEvent("download"), page.click("#pf-captacion-desc")]);
const pdfSinGuardar = (await readFile(await capSinGuardar.path())).toString("latin1");
check("una firma sin guardar se guarda sola al sacar el PDF y sale en él", (await estado()).pisos.at(-1).firmaPropietario.startsWith("data:image/jpeg") && (pdfSinGuardar.match(/\/DCTDecode/g) || []).length >= 3);
await page.reload();
await page.waitForSelector("#pf-refirmar");
check("firma del propietario guardada", (await estado()).pisos.at(-1).firmaPropietario.startsWith("data:image/jpeg"));
const [cap] = await Promise.all([page.waitForEvent("download"), page.click("#pf-captacion-desc")]);
const capPdf = (await readFile(await cap.path())).toString("latin1");
check("hoja de captación en PDF con el logo y dos firmas", capPdf.startsWith("%PDF") && (capPdf.match(/\/DCTDecode/g) || []).length >= 3);
check("encabezado de firmas «ASESORIA CASTRESANA INMO»", capPdf.includes("ASESORIA CASTRESANA INMO"));
check("firmado fuera de la oficina → incluye el desistimiento", capPdf.includes("DERECHO DE DESISTIMIENTO"));
check("el precio mínimo interno NO sale en el PDF", !capPdf.includes("230.000") && !capPdf.includes("Precio m\xednimo"));

await page.click('a[href^="#nueva-visita/"]');
await page.waitForSelector("#v-piso");
check("la hoja de visita llega con el piso elegido", (await page.inputValue("#v-inmueble")).includes("Uría 12"));
await page.fill("#v-nombre", "Marta Visitante");
await page.check("#v-rgpd");
await firmar("#v-firma");
await page.click('#form-visita button[type="submit"]');
await page.waitForFunction(() => location.hash.startsWith("#visita/"));
const vis = (await estado()).visitas.at(-1);
check("la visita guarda la copia de los datos del piso (sin propietario)", vis.piso?.m2Construidos === 95 && vis.piso?.propNombre === undefined && vis.pisoId === piso1.id);
const [visPdfDesc] = await Promise.all([page.waitForEvent("download"), page.click("#v-descargar")]);
const visPdf = (await readFile(await visPdfDesc.path())).toString("latin1");
check("PDF de visita con datos del inmueble, logo y firmas encabezadas", visPdf.includes("DATOS DEL INMUEBLE") && visPdf.includes("ASESORIA CASTRESANA INMO") && (visPdf.match(/\/DCTDecode/g) || []).length >= 3);

await page.goto(URL_APP + "#piso/" + piso1.id);
await page.waitForSelector("#pf-valorar");
await page.click("#pf-valorar");
await page.waitForFunction(() => location.hash.startsWith("#valoracion/"));
check("valorar el piso rellena el inmueble", (await page.inputValue("#vi-municipio")) === "Oviedo" && (await page.inputValue("#vi-m2")) === "95");
await page.click("#val-buscar");
await page.waitForSelector("#val-anade-cand", { timeout: 5000 }).catch(() => {});
check("Clara propone comparables y avisa de que son precios de oferta", (await page.textContent("#val-candidatos")).includes("OFERTA") && (await page.locator("[data-cand]").count()) === 3);
check("un enlace no https no se convierte en enlace", (await page.locator('#val-candidatos a[href^="javascript"]').count()) === 0);
await page.click("#val-anade-cand");
await page.waitForFunction(() => document.querySelector("#val-resultado")?.textContent.includes("Rango"), null, { timeout: 5000 }).catch(() => {});
check("con 3 comparables hay rango, marcado como muestra reducida", (await page.textContent("#val-resultado")).includes("Muestra reducida"));
check("referencia de zona de Oviedo como contexto", (await page.textContent("#val-resultado")).includes("Referencia de zona"));

const { enlaceImportacion } = await import("../cerebro/importar.js");
const enlace = enlaceImportacion(`http://localhost:${PORT}`, { v: 1, tipo: "valoracion", datos: { inmueble: { direccion: "Gijón, calle Corrida 5", municipio: "Gijón", m2: 80 }, propietario: "<b>Eva</b>",
  comparables: [{ direccion: "A", fuente: "anuncio", precio: 200000, m2: 80, notas: "https://x.es/1" }, { direccion: "B", fuente: "anuncio", precio: 210000, m2: 82 }, { direccion: "C", fuente: "venta", precio: 190000, m2: 78 }] } });
await page.goto(enlace);
await page.waitForFunction(() => location.hash.startsWith("#valoracion/"), null, { timeout: 5000 }).catch(() => {});
check("el enlace de Clara abre la valoración lista", (await page.inputValue("#vi-direccion")) === "Gijón, calle Corrida 5" && (await page.textContent("#val-resultado")).includes("Rango"));
check("lo que viene en el enlace se pinta como texto", (await page.inputValue("#vi-prop")) === "<b>Eva</b>");
const basura = await page.goto(`http://localhost:${PORT}/cerebro/app.html#importar=%%%basura`);
await page.waitForTimeout(300);
check("un enlace roto no rompe la app", (await page.locator(".pestanas").count()) === 1);

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
