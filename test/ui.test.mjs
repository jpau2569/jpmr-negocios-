// ============================================================================
//  Test de interfaz de clara.html con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: npm run test:ui
//  No llama a la API real: /api/clara se intercepta y responde en local.
//  Verifica: saludo, los 6 modos, envío y respuesta, formato enriquecido,
//  persistencia tras recargar, panel 🧠 Memoria (y que viaja en la petición),
//  botón copiar y nueva conversación, y los botones ⬇ HTML / ⬇ Excel (CSV):
//  uno por bloque csv, sin duplicados y sin scroll lateral de 360 a 1280 px.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8123;
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

// Servidor estático mínimo para servir clara.html y sus recursos.
const server = http.createServer(async (req, res) => {
  try {
    const path = req.url === "/" ? "/clara.html" : req.url.split("?")[0];
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("no encontrado");
  }
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

// /api/clara simulada en modo streaming (SSE): guarda cada petición para inspeccionarla.
let RESPUESTA =
  "¡Hecho, Pau! La rentabilidad **bruta** es del `7,96%`. ✅\n\n```html\n<!doctype html><html><body><h1>Mini ebook</h1></body></html>\n```";
const peticiones = [];
let EVENTOS_EXTRA = []; // p. ej. la ficha de preparar_archivo
await page.route("**/api/clara", async (route) => {
  peticiones.push(route.request().postDataJSON());
  await route.fulfill({
    contentType: "text/event-stream",
    body:
      'data: {"estado":"🧮 Calculando…"}\n\n' +
      EVENTOS_EXTRA.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") +
      `data: ${JSON.stringify({ t: RESPUESTA.slice(0, 20) })}\n\n` +
      `data: ${JSON.stringify({ t: RESPUESTA.slice(20) })}\n\n` +
      `data: ${JSON.stringify({ done: true, reply: RESPUESTA })}\n\n`,
  });
});

try {
  console.log("\n— carga inicial —");
  await page.goto(`http://localhost:${PORT}/clara.html`);
  await page.waitForSelector(".msg.clara .bubble");
  const saludo = await page.textContent(".msg.clara .bubble");
  check("saluda a Pau por su nombre", saludo.includes("Hola, Pau"));
  check("el saludo lista el modo inmobiliario", saludo.includes("negocio inmobiliario"));
  check("hay 6 botones de modo", (await page.$$(".mode")).length === 6);
  check("botones 🧠/🔊/⬇/🗑 presentes", (await page.$$("#memory, #voice, #export, #reset")).length === 4);
  check("clip de adjuntos 📎 presente", (await page.$$("#attach, #fileattach")).length === 2);

  console.log("\n— modos —");
  await page.click('.mode[data-mode="inmobiliaria"]');
  await page.waitForFunction(() => document.querySelectorAll(".msg.clara").length >= 2);
  const intro = await page.evaluate(() => [...document.querySelectorAll(".msg.clara .bubble")].at(-1).textContent);
  check("activar 🏠 muestra su intro", intro.includes("Castresana"));
  check("el botón 🏠 queda marcado activo", await page.evaluate(() => document.querySelector('.mode[data-mode="inmobiliaria"]').classList.contains("active")));

  console.log("\n— enviar y recibir —");
  await page.fill("#input", "¿Qué rentabilidad da un piso de 98.000 € a 650 €/mes?");
  await page.press("#input", "Enter");
  await page.waitForFunction(() => [...document.querySelectorAll(".msg.clara .bubble")].some((b) => b.textContent.includes("7,96")));
  check("aparece la burbuja del usuario", await page.evaluate(() => [...document.querySelectorAll(".msg.user .bubble")].some((b) => b.textContent.includes("98.000"))));
  check("aparece la respuesta de Clara", true);
  check("formato enriquecido: negrita renderizada", await page.evaluate(() => [...document.querySelectorAll(".msg.clara .bubble strong")].some((s) => s.textContent === "bruta")));
  check("formato enriquecido: código renderizado", await page.evaluate(() => [...document.querySelectorAll(".msg.clara .bubble code")].some((c) => c.textContent === "7,96%")));
  check("la respuesta tiene botón copiar", (await page.$$(".msg.clara .copy")).length >= 1);
  check("la petición llevó el modo inmobiliario", peticiones.at(-1)?.mode === "inmobiliaria");
  check("la petición pidió streaming", peticiones.at(-1)?.stream === true);
  check("HTML completo → botón ⬇ Descargar HTML", (await page.$$(".msg.clara .dlhtml")).length >= 1);

  console.log("\n— persistencia al recargar —");
  await page.reload();
  await page.waitForSelector(".msg.clara .bubble");
  check("la conversación sigue tras recargar", await page.evaluate(() => [...document.querySelectorAll(".msg.clara .bubble")].some((b) => b.textContent.includes("7,96"))));
  check("el modo sigue activo tras recargar", await page.evaluate(() => document.querySelector('.mode[data-mode="inmobiliaria"]').classList.contains("active")));

  console.log("\n— 🧠 memoria —");
  await page.click("#memory");
  check("campo de clave de sincronización presente", (await page.$$("#memClave, #memEstado")).length === 2);
  await page.fill("#memText", "Objetivo: invertir en Oviedo este año.");
  await page.click("#memSave");
  await page.fill("#input", "hola de nuevo");
  await page.press("#input", "Enter");
  await page.waitForFunction((n) => n < 2 || true, peticiones.length);
  await page.waitForTimeout(300);
  check("la memoria viaja en la petición a la API", peticiones.at(-1)?.memoria?.includes("invertir en Oviedo"), JSON.stringify(peticiones.at(-1)?.memoria));
  await page.reload();
  await page.click("#memory");
  check("la memoria persiste tras recargar", (await page.inputValue("#memText")) === "Objetivo: invertir en Oviedo este año.");
  await page.click("#memClose");

  console.log("\n— 🗑 nueva conversación —");
  page.once("dialog", (d) => d.accept());
  await page.click("#reset");
  await page.waitForSelector(".msg.clara .bubble");
  const saludo2 = await page.textContent(".msg.clara .bubble");
  check("reiniciar vuelve al saludo inicial", saludo2.includes("Hola, Pau"));
  check("reiniciar NO borra la 🧠 memoria", await page.evaluate(() => localStorage.getItem("clara_memoria_v1") === "Objetivo: invertir en Oviedo este año."));

  console.log("\n— ⬇ descargas CSV/HTML y anchos de pantalla —");
  const CSV_1 = "Ref;Precio\nA1;120000,5";
  const CSV_2 = "Mes;Comisión\nenero;3500\nfebrero;4200";
  RESPUESTA = "Dos tablas:\n\n```csv\n" + CSV_1 + "\n```\n\nY otra:\n\n```csv\n" + CSV_2 + "\n```\n\n```html\n<!doctype html><html><body>x</body></html>\n```";
  await page.fill("#input", "Dame las dos tablas");
  await page.press("#input", "Enter");
  await page.waitForFunction(() => document.querySelectorAll(".msg.clara .dlcsv").length >= 2);
  const ultima = page.locator(".msg.clara").last();
  const textos = await ultima.locator(".dlcsv").allTextContents();
  check("dos bloques csv → dos botones numerados", JSON.stringify(textos) === '["⬇ Excel (CSV) 1","⬇ Excel (CSV) 2"]', JSON.stringify(textos));
  const descargas = [];
  for (const i of [0, 1]) {
    const [d] = await Promise.all([page.waitForEvent("download"), ultima.locator(".dlcsv").nth(i).click()]);
    descargas.push([d.suggestedFilename(), (await readFile(await d.path())).toString("utf8")]);
  }
  check("cada botón descarga su tabla con su nombre -1 / -2", /^clara-\d{4}-\d{2}-\d{2}-1\.csv$/.test(descargas[0][0]) && /^clara-\d{4}-\d{2}-\d{2}-2\.csv$/.test(descargas[1][0]), JSON.stringify(descargas.map((d) => d[0])));
  check("contenido con BOM y CRLF, cada uno el suyo", descargas[0][1] === "\ufeff" + CSV_1.replace(/\n/g, "\r\n") && descargas[1][1] === "\ufeff" + CSV_2.replace(/\n/g, "\r\n"));
  check("con descargas, la fila de botones va debajo de la burbuja", await ultima.evaluate((m) => m.classList.contains("con-descargas") && m.querySelector(".acciones").getBoundingClientRect().top >= m.querySelector(".bubble").getBoundingClientRect().bottom));
  const saludoAlLado = await page.evaluate(() => { const m = document.querySelector(".msg.clara"); return !m.classList.contains("con-descargas") && m.querySelector(".copy").getBoundingClientRect().left >= m.querySelector(".bubble").getBoundingClientRect().right; });
  check("sin descargas, «copiar» sigue a la derecha de la burbuja", saludoAlLado);

  // Una sola tabla: igual que siempre.
  RESPUESTA = "Tabla:\n\n```csv\n" + CSV_1 + "\n```";
  await page.fill("#input", "Ahora solo una");
  await page.press("#input", "Enter");
  await page.waitForFunction(() => [...document.querySelectorAll(".msg.clara")].at(-1).querySelector(".dlcsv"));
  const una = page.locator(".msg.clara").last();
  check("un solo bloque → «⬇ Descargar Excel (CSV)» como antes", JSON.stringify(await una.locator(".dlcsv").allTextContents()) === '["⬇ Descargar Excel (CSV)"]');
  const [d1] = await Promise.all([page.waitForEvent("download"), una.locator(".dlcsv").click()]);
  check("un solo bloque → clara-AAAA-MM-DD.csv sin número", /^clara-\d{4}-\d{2}-\d{2}\.csv$/.test(d1.suggestedFilename()), d1.suggestedFilename());

  const porMensaje = () => page.$$eval(".msg.clara", (ms) => ms.map((m) => m.querySelectorAll(".dlcsv").length + "/" + m.querySelectorAll(".dlhtml").length + "/" + m.querySelectorAll(".copy:not(.dl)").length));
  const antes = await porMensaje();
  await page.reload();
  await page.waitForFunction((n) => document.querySelectorAll(".msg.clara").length === n, antes.length);
  const despues = await porMensaje();
  check("al volver a pintar (recarga) no se duplican los botones", JSON.stringify(antes) === JSON.stringify(despues) && despues.includes("2/1/1") && despues.includes("1/0/1"), JSON.stringify([antes, despues]));

  for (const ancho of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const main = document.querySelector("main");
      const botones = [...document.querySelectorAll(".msg.clara button")].map((b) => b.getBoundingClientRect());
      return { doc: document.documentElement.scrollWidth, vw: innerWidth, main: main.scrollWidth - main.clientWidth, fuera: botones.filter((r) => r.right > innerWidth + 0.5 || r.left < -0.5).length };
    });
    check(`${ancho} px: sin scroll lateral y ningún botón fuera de la pantalla`, m.doc <= m.vw && m.main <= 0 && m.fuera === 0, JSON.stringify(m));
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  console.log("\n— 📄 archivos de oficina (preparar_archivo) —");
  {
    const FICHA = { formato: "docx", titulo: "Carta de visita a la propietaria de Uría 12, 3ºB con un título largo de verdad", instrucciones: "Carta a la propietaria para confirmar la visita del martes.", caduca: Date.now() + 864e5, firma: "f".repeat(64) };
    const pedidosArchivo = [];
    await page.route("**/api/clara-archivo", async (route) => {
      const cuerpo = route.request().postDataJSON();
      pedidosArchivo.push(cuerpo);
      const r = pedidosArchivo.length === 1
        ? { pendiente: true, intento: 1, max: 6, estado: "ZXN0YWRv", firmaEstado: "e".repeat(64) }
        : { listo: true, intento: 2, max: 6, archivo: { nombre: "carta-de-visita.docx", formato: "docx", bytes: 18432, url: "/api/clara-archivo?descargar=file_1&f=" + "a".repeat(64) } };
      await new Promise((ok) => setTimeout(ok, 250)); // deja ver la barra de estado
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(r) });
    });
    await page.setViewportSize({ width: 360, height: 760 });
    RESPUESTA = "Te he preparado la carta: pulsa la tarjeta para crear el Word.";
    EVENTOS_EXTRA = [{ estado: "📄 Preparando el archivo…" }, { archivo: FICHA }];
    await page.fill("#input", "Hazme la carta en Word");
    await page.press("#input", "Enter");
    await page.waitForSelector(".msg.clara .archivo .acrear");
    EVENTOS_EXTRA = [];
    const boton = page.locator(".msg.clara .archivo .acrear").last();
    check("aparece la tarjeta «📄 Crear Word: …»", (await boton.textContent()).startsWith("📄 Crear Word: Carta de visita"));
    const alto = await boton.evaluate((b) => b.getBoundingClientRect().height);
    check("el botón de la tarjeta mide 44 px o más", alto >= 44, String(alto));
    await boton.click();
    await page.waitForFunction(() => /Creando el Word… 1\/6/.test(document.querySelector(".archivo .aestado")?.textContent || ""));
    check("barra de estado «Creando el Word… 1/6»", true);
    await page.waitForSelector(".msg.clara .archivo a.adl");
    const enlace = page.locator(".msg.clara .archivo a.adl").last();
    check("tras pendiente → listo sale «⬇ Descargar Word»", (await enlace.textContent()) === "⬇ Descargar Word");
    check("el enlace apunta a la descarga firmada", (await enlace.getAttribute("href")).startsWith("/api/clara-archivo?descargar=file_1&f="));
    check("se llamó dos veces y la segunda con el estado firmado", pedidosArchivo.length === 2 && pedidosArchivo[1].estado === "ZXN0YWRv" && pedidosArchivo[1].firmaEstado === "e".repeat(64) && pedidosArchivo[1].ficha.firma === FICHA.firma);
    check("se enseña el nombre y el tamaño", (await page.locator(".msg.clara .archivo .aestado").last().textContent()).includes("carta-de-visita.docx · 18 KB"));
    const m360 = await page.evaluate(() => {
      const main = document.querySelector("main");
      const fuera = [...document.querySelectorAll(".archivo, .archivo a, .archivo button")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }).length;
      return { doc: document.documentElement.scrollWidth, vw: innerWidth, main: main.scrollWidth - main.clientWidth, fuera };
    });
    check("360 px: la tarjeta no provoca scroll lateral", m360.doc <= m360.vw && m360.main <= 0 && m360.fuera === 0, JSON.stringify(m360));
    await page.reload();
    await page.waitForSelector(".msg.clara .archivo a.adl");
    check("tras recargar sigue el botón de descarga (sin volver a crear)", (await page.locator(".msg.clara .archivo .acrear").count()) === 0);
    await page.fill("#input", "gracias");
    await page.press("#input", "Enter");
    await page.waitForTimeout(400);
    check("las fichas no viajan de vuelta en el historial del chat", !JSON.stringify(peticiones.at(-1)?.messages || []).includes(FICHA.firma));
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  console.log("\n— landing del ebook (ebook.html) —");
  let leadRecibido = null;
  await page.route("**/api/lead", async (route) => {
    leadRecibido = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`http://localhost:${PORT}/ebook.html`);
  check("la landing carga con el titular", (await page.textContent("h1")).includes("7 errores"));
  await page.fill("#email", "comprador@test.com");
  await page.selectOption("#tipo", "inversor");
  await page.click("#enviar");
  await page.waitForSelector(".gracias.show");
  check("al enviar aparece la descarga de la guía", (await page.textContent("#gracias")).includes("Abrir mi guía"));
  check("el lead viajó a /api/lead", leadRecibido?.email === "comprador@test.com" && leadRecibido?.tipo === "inversor");

  console.log("\n— el ebook (ebook-guia.html) —");
  await page.goto(`http://localhost:${PORT}/ebook-guia.html`);
  check("el ebook tiene 16 páginas A4", (await page.$$(".pagina")).length === 16);
  check("portada con el título real", (await page.textContent(".portada h1")).includes("hunden el precio"));
  check("checklist con los 6 bloques", (await page.evaluate(() => document.body.textContent)).includes("Bloque 6"));
} catch (e) {
  fallados++;
  console.error("  ❌ excepción durante el test:", e.message);
} finally {
  await browser.close();
  server.close();
}

console.log(`\nResultado UI: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
