// ============================================================================
//  Test de interfaz de clara.html con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: npm run test:ui
//  No llama a la API real: /api/clara se intercepta y responde en local.
//  Verifica: saludo, los 6 modos, envío y respuesta, formato enriquecido,
//  persistencia tras recargar, panel 🧠 Memoria (y que viaja en la petición),
//  botón copiar y nueva conversación, y los botones ⬇ HTML / ⬇ Excel (CSV):
//  uno por bloque csv, sin duplicados y sin scroll lateral de 360 a 1280 px;
//  el contador «📊 Uso este mes» con sus avisos del 80 % y el 100 %, y la
//  agenda (.vcf) y el CSV de clientes como adjuntos.
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
    let MODO_ARCHIVO = "normal"; // normal | 401 | 504 | largo
    const NOMBRE_LARGO = "a".repeat(45) + ".docx";
    await page.route("**/api/clara-archivo", async (route) => {
      const cuerpo = route.request().postDataJSON();
      pedidosArchivo.push(cuerpo);
      if (MODO_ARCHIVO === "401") {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Para crear archivos hace falta tu clave de sincronización." }) });
        return;
      }
      if (MODO_ARCHIVO === "504") {
        await route.fulfill({ status: 504, contentType: "text/plain", body: "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT" });
        return;
      }
      const r = MODO_ARCHIVO === "largo"
        ? { listo: true, intento: 1, max: 6, archivo: { nombre: NOMBRE_LARGO, formato: "docx", bytes: 18432, url: "/api/clara-archivo?descargar=file_2&e=1&f=" + "b".repeat(64) } }
        : pedidosArchivo.length === 1
        ? { pendiente: true, intento: 1, max: 6, estado: "ZXN0YWRv", firmaEstado: "e".repeat(64) }
        : { listo: true, intento: 2, max: 6, archivo: { nombre: "carta-de-visita.docx", formato: "docx", bytes: 18432, url: "/api/clara-archivo?descargar=file_1&e=1&f=" + "a".repeat(64) } };
      await new Promise((ok) => setTimeout(ok, 400)); // deja ver la barra de estado
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(r) });
    });
    // La clave de sincronización ya guardada para la 🧠 Memoria viaja también aquí.
    await page.evaluate(() => localStorage.setItem("clara_sync_v1", "clave-de-pau"));
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
    await page.waitForFunction(() => (document.querySelector(".archivo .aestado")?.textContent || "") === "Creando el Word… (suele tardar 1-3 min)");
    check("primer tramo: «Creando el Word… (suele tardar 1-3 min)», sin «parte»", true);
    await page.waitForFunction(() => (document.querySelector(".archivo .aestado")?.textContent || "") === "Creando el Word… parte 2 (suele tardar 1-3 min)");
    check("segundo tramo: «Creando el Word… parte 2 (suele tardar 1-3 min)»", true);
    await page.waitForSelector(".msg.clara .archivo a.adl");
    const enlace = page.locator(".msg.clara .archivo a.adl").last();
    check("tras pendiente → listo sale «⬇ Descargar Word»", (await enlace.textContent()) === "⬇ Descargar Word");
    check("el enlace apunta a la descarga firmada", (await enlace.getAttribute("href")).startsWith("/api/clara-archivo?descargar=file_1&e="));
    check("se llamó dos veces y la segunda con el estado firmado", pedidosArchivo.length === 2 && pedidosArchivo[1].estado === "ZXN0YWRv" && pedidosArchivo[1].firmaEstado === "e".repeat(64) && pedidosArchivo[1].ficha.firma === FICHA.firma);
    check("cada llamada lleva la clave de sincronización de la 🧠 Memoria", pedidosArchivo.every((p) => p.clave === "clave-de-pau"), JSON.stringify(pedidosArchivo.map((p) => p.clave)));
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

    // Segunda tarjeta: sin clave en este dispositivo (con nube → 401), 504 y nombre muy largo.
    const FICHA2 = { ...FICHA, titulo: "Informe", firma: "9".repeat(64) };
    await page.evaluate(() => localStorage.removeItem("clara_sync_v1"));
    MODO_ARCHIVO = "401";
    RESPUESTA = "Pulsa la tarjeta para crear el informe.";
    EVENTOS_EXTRA = [{ archivo: FICHA2 }];
    await page.fill("#input", "Hazme el informe en Word");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => [...document.querySelectorAll(".msg.clara")].at(-1).querySelector(".archivo .acrear"));
    EVENTOS_EXTRA = [];
    const tarjeta2 = page.locator(".msg.clara").last().locator(".archivo");
    await tarjeta2.locator(".acrear").click();
    await page.waitForFunction(() => [...document.querySelectorAll(".msg.clara")].at(-1).querySelector(".archivo .aestado.mal"));
    const sinClave = await tarjeta2.locator(".aestado").textContent();
    check("sin clave en el dispositivo → mensaje claro de ponerla en 🧠 Memoria", sinClave.includes("no está puesta tu clave de sincronización") && sinClave.includes("🧠 Memoria"), sinClave);
    check("tras el error, el botón queda para reintentar", (await tarjeta2.locator(".acrear").textContent()).startsWith("↻ Reintentar") && !(await tarjeta2.locator(".acrear").isDisabled()));
    MODO_ARCHIVO = "504";
    await tarjeta2.locator(".acrear").click();
    await page.waitForFunction(() => /tardó demasiado/.test([...document.querySelectorAll(".msg.clara")].at(-1).querySelector(".archivo .aestado")?.textContent || ""));
    check("504 → «El servidor tardó demasiado; vuelve a pulsar»", (await tarjeta2.locator(".aestado").textContent()) === "❌ El servidor tardó demasiado; vuelve a pulsar.");
    MODO_ARCHIVO = "largo";
    await page.evaluate(() => localStorage.setItem("clara_sync_v1", "clave-de-pau"));
    await tarjeta2.locator(".acrear").click();
    await tarjeta2.locator("a.adl").waitFor();
    check("con la clave puesta, viaja en la petición", pedidosArchivo.at(-1).clave === "clave-de-pau");
    const mLargo = await page.evaluate(() => {
      const main = document.querySelector("main");
      const est = [...document.querySelectorAll(".msg.clara")].at(-1).querySelector(".archivo .aestado");
      const card = est.closest(".archivo").getBoundingClientRect();
      return { doc: document.documentElement.scrollWidth, vw: innerWidth, main: main.scrollWidth - main.clientWidth, est: est.scrollWidth - est.clientWidth, dentro: est.getBoundingClientRect().right <= card.right + 0.5, texto: est.textContent };
    });
    check("360 px: un nombre de 45 «a» no da scroll lateral (overflow-wrap:anywhere)", mLargo.texto.includes(NOMBRE_LARGO) && mLargo.doc <= mLargo.vw && mLargo.main <= 0 && mLargo.est <= 0 && mLargo.dentro, JSON.stringify(mLargo));
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  console.log("\n— 📊 contador de gasto y tope (sin nube: por dispositivo) —");
  {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.evaluate(() => { localStorage.removeItem("clara_uso_v1"); localStorage.removeItem("clara_chat_v1"); });
    await page.reload();
    await page.waitForSelector(".msg.clara .bubble");
    const mes = await page.evaluate(() => {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(new Date());
      return p.find((x) => x.type === "year").value + "-" + p.find((x) => x.type === "month").value;
    });
    const envia = async (coste, texto) => {
      EVENTOS_EXTRA = [{ uso: { llamadas: 2, entrada: 1000, salida: 100, coste_usd: coste }, uso_estado: { mes, almacen: "local", guardado: false, total: null, tope_usd: 1, nivel: "sin_datos" } }];
      const antes = await page.$$eval(".msg.clara", (n) => n.length);
      await page.fill("#input", texto);
      await page.press("#input", "Enter");
      await page.waitForFunction((n) => document.querySelectorAll(".msg.clara").length > n && !document.getElementById("typing"), antes);
      await page.waitForTimeout(100);
    };
    await envia(0.5, "uno");
    check("50 % del tope: ningún aviso", (await page.$$(".avisouso")).length === 0);
    await envia(0.35, "dos");
    const avisos = await page.$$eval(".avisouso", (n) => n.map((x) => x.textContent));
    check("al 80 % Clara avisa en el chat (con el % y el tope)", avisos.length === 1 && avisos[0].includes("85 %") && avisos[0].includes("1,00 $") && avisos[0].includes("solo avisa"), avisos.join(" | "));
    await envia(0.01, "tres");
    check("el aviso del 80 % sale una sola vez", (await page.$$(".avisouso")).length === 1);
    await envia(0.2, "cuatro");
    const avisos2 = await page.$$eval(".avisouso", (n) => n.map((x) => x.textContent));
    check("al 100 % sin nube: dice con honestidad que solo puede avisar (por dispositivo)", avisos2.length === 2 && avisos2[1].includes("🛑") && avisos2[1].includes("Sin la nube no puedo cortar el gasto"), avisos2.join(" | "));
    check("los avisos son de estado accesible (role=status)", await page.$$eval(".avisouso", (n) => n.every((x) => x.getAttribute("role") === "status")));
    await page.click("#memory");
    const uso = await page.evaluate(() => ({
      texto: document.getElementById("usoTexto").textContent,
      nota: document.getElementById("usoNota").textContent,
      barra: !document.getElementById("usoBarra").hidden,
      valor: document.getElementById("usoBarra").getAttribute("aria-valuenow"),
      agotado: document.getElementById("usoBarra").classList.contains("agotado"),
      doc: document.documentElement.scrollWidth, vw: innerWidth,
      panel: (() => { const p = document.querySelector("#memOverlay .panel"); return p.scrollWidth - p.clientWidth; })(),
    }));
    check("🧠 → «Este mes: X $ (estimado) · N llamadas»", uso.texto === "Este mes: 1,06 $ (estimado) · 8 llamadas", uso.texto);
    check("barra frente al tope, llena y en rojo al 100 %", uso.barra && uso.valor === "100" && uso.agotado);
    check("dice que es solo este dispositivo y que los precios son en dólares", uso.nota.includes("Solo este dispositivo") && uso.nota.includes("dólares") && uso.nota.includes("Tope: 1,00 $"), uso.nota);
    check("panel con el uso sin scroll lateral a 360 px", uso.doc <= uso.vw && uso.panel <= 0, JSON.stringify(uso));
    await page.click("#memClose");

    // Con la nube, el total viene del servidor (todos los dispositivos).
    await page.evaluate(() => localStorage.removeItem("clara_uso_v1"));
    EVENTOS_EXTRA = [{ uso: { llamadas: 1, coste_usd: 0.01 }, uso_estado: { mes, almacen: "nube", guardado: true, total: { coste_usd: 3, llamadas: 120 }, tope_usd: 20, nivel: "ok", porcentaje: 15 } }];
    await page.fill("#input", "cinco");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    await page.waitForTimeout(150);
    await page.click("#memory");
    const nube = await page.evaluate(() => ({ texto: document.getElementById("usoTexto").textContent, nota: document.getElementById("usoNota").textContent }));
    check("con la nube: el total del mes de todos los dispositivos", nube.texto === "Este mes: 3,00 $ (estimado) · 120 llamadas" && nube.nota.includes("Total de todos tus dispositivos") && nube.nota.includes("Tope: 20,00 $ (15 %)"), JSON.stringify(nube));
    check("la nota dice que solo cuenta a Clara", nube.nota.includes("Solo cuenta a Clara (chat, equipo y archivos); las otras apps que usan la misma clave no se suman."), nube.nota);
    await page.click("#memClose");

    // Sin clave, pero el servidor lo suma en la nube (clara_uso_suma_servidor): solo el nivel, sin cifras.
    await page.evaluate(() => localStorage.removeItem("clara_uso_v1"));
    const avisosAntes = (await page.$$(".avisouso")).length;
    EVENTOS_EXTRA = [{ uso: { llamadas: 1, coste_usd: 0.01 }, uso_estado: { mes, almacen: "local", guardado: false, total: null, tope_usd: 20, nivel: "aviso", porcentaje: null, nube_sin_clave: "sumado" } }];
    await page.fill("#input", "seis");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    await page.waitForTimeout(150);
    const avisoSrv = await page.$$eval(".avisouso", (n) => n.map((x) => x.textContent));
    check("sin clave y al 80 % del total de la nube: avisa sin dar la cifra", avisoSrv.length === avisosAntes + 1 && avisoSrv.at(-1).includes("80 %") && avisoSrv.at(-1).includes("todos tus dispositivos") && avisoSrv.at(-1).includes("clave de sincronización"), avisoSrv.at(-1));
    await page.click("#memory");
    const srv = await page.evaluate(() => document.getElementById("usoNota").textContent);
    check("panel sin clave: dice que lo de este aparato también se suma en la nube para el tope", srv.includes("también se suma en la nube") && srv.includes("ya pasa del 80 %") && !srv.includes("solo avisa"), srv);
    await page.click("#memClose");
    // Sin la función en Supabase: lo dice tal cual.
    EVENTOS_EXTRA = [{ uso: { llamadas: 1, coste_usd: 0.01 }, uso_estado: { mes, almacen: "local", guardado: false, total: null, tope_usd: 20, nivel: "sin_datos", nube_sin_clave: "fallo", motivo: "falta la función clara_uso_suma_servidor en Supabase (vuelve a pegar supabase/clara-uso.sql en el SQL Editor): mientras, el gasto de este dispositivo se cuenta solo aquí y no suma al tope" } }];
    await page.fill("#input", "siete");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    await page.waitForTimeout(150);
    await page.click("#memory");
    const falta = await page.evaluate(() => document.getElementById("usoNota").textContent);
    check("panel sin la función en Supabase: lo dice y no promete que cuente para el tope", falta.includes("clara_uso_suma_servidor") && falta.includes("no suma al tope") && !falta.includes("también se suma"), falta);
    await page.click("#memClose");
    EVENTOS_EXTRA = [];
  }

  console.log("\n— 📇 CSV de Excel (Windows-1252) y nombre largo en el chip —");
  {
    await page.setViewportSize({ width: 360, height: 760 });
    const NOMBRE = "clientes-de-inmoweb-exportados-desde-excel-el-lunes-por-la-tarde.csv";
    await page.setInputFiles("#fileattach", [{ name: NOMBRE, mimeType: "text/csv", buffer: Buffer.from("Nombre;Zona;Operación\nJosé Muñiz;Gijón;Venta\n", "latin1") }]);
    await page.waitForFunction(() => document.querySelectorAll(".attachchip").length === 1);
    const chip = await page.evaluate(() => {
      const c = document.querySelector(".attachchip");
      const n = c.querySelector(".nombre");
      const b = c.querySelector("button").getBoundingClientRect();
      return { ancho: c.getBoundingClientRect().width, title: c.title, corta: n.scrollWidth > n.clientWidth, elipsis: getComputedStyle(n).textOverflow, boton: [b.width, b.height], etiqueta: c.querySelector("button").getAttribute("aria-label"), doc: document.documentElement.scrollWidth, vw: innerWidth };
    });
    check("chip: como mucho 220 px, con «…» y el nombre completo en title", chip.ancho <= 220.5 && chip.corta && chip.elipsis === "ellipsis" && chip.title === NOMBRE, JSON.stringify(chip));
    check("chip: botón ✕ de 44 px o más y con etiqueta accesible", chip.boton[0] >= 44 && chip.boton[1] >= 44 && chip.etiqueta === "Quitar " + NOMBRE);
    check("chip largo sin scroll lateral a 360 px", chip.doc <= chip.vw);
    await page.fill("#input", "Mis clientes en CSV");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    const enviado = peticiones.at(-1).messages.at(-1).adjuntos?.[0];
    const texto = Buffer.from(enviado?.data || "", "base64").toString("utf8");
    check("CSV en Windows-1252: viaja en UTF-8 con «Gijón», «José» y «Operación» bien", texto.includes("Gijón") && texto.includes("José Muñiz") && texto.includes("Operación") && !texto.includes("\uFFFD"), JSON.stringify(texto));
    const utf = Buffer.from("Nombre;Zona\nLucía;Gijón\n", "utf8");
    await page.setInputFiles("#fileattach", [{ name: "utf8.csv", mimeType: "text/csv", buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf]) }]);
    await page.waitForFunction(() => document.querySelectorAll(".attachchip").length === 1);
    await page.fill("#input", "Otro CSV");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    const texto2 = Buffer.from(peticiones.at(-1).messages.at(-1).adjuntos?.[0]?.data || "", "base64").toString("utf8");
    check("CSV en UTF-8 (con BOM): igual que antes, sin el BOM", texto2 === "Nombre;Zona\nLucía;Gijón\n", JSON.stringify(texto2));
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  console.log("\n— 📇 agenda (.vcf) y clientes (.csv) adjuntos —");
  {
    const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Marcos\r\nTEL:611\r\nPHOTO;ENCODING=b;TYPE=JPEG:QUFBQQ==\r\n QkJCQg==\r\nNOTE:busca comprar en Oviedo\r\nEND:VCARD\r\n";
    await page.setInputFiles("#fileattach", [
      { name: "contactos.vcf", mimeType: "text/x-vcard", buffer: Buffer.from(vcf) },
      { name: "inmoweb.csv", mimeType: "text/csv", buffer: Buffer.from("nombre;zona\nLaura;Oviedo\n") },
      { name: "clientes.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("PK") },
    ]);
    await page.waitForFunction(() => document.querySelectorAll(".attachchip").length === 2);
    const chips = await page.$$eval(".attachchip", (n) => n.map((x) => x.textContent));
    check("la agenda y el CSV se adjuntan como 📇", chips.some((c) => c.includes("📇 contactos.vcf")) && chips.some((c) => c.includes("📇 inmoweb.csv")), chips.join(" | "));
    const errores = await page.$$eval(".error", (n) => n.map((x) => x.textContent));
    check("el .xlsx no se adjunta y explica que lo guarde como CSV", errores.some((e) => e.includes("clientes.xlsx") && e.includes("CSV")), errores.join(" | "));
    await page.fill("#input", "Crúzalos con mi cartera");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    const ultimo = peticiones.at(-1).messages.at(-1);
    const [aVcf, aCsv] = ultimo.adjuntos || [];
    const texto = Buffer.from(aVcf?.data || "", "base64").toString("utf8");
    check("viajan como text/vcard y text/csv", aVcf?.media_type === "text/vcard" && aCsv?.media_type === "text/csv");
    check("la foto de la agenda se quita antes de enviarla (pesa y no hace falta)", texto.includes("FN:Marcos") && texto.includes("NOTE:busca comprar") && !texto.includes("PHOTO") && !texto.includes("QkJCQg"), texto);
    check("la agenda no se guarda en el navegador", !(await page.evaluate(() => localStorage.getItem("clara_chat_v1") || "")).includes("FN:Marcos"));

    // La agenda sigue viajando en las preguntas siguientes (antes caía a la 3.ª);
    // una foto de un mensaje viejo, no.
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.setInputFiles("#fileattach", [{ name: "foto.png", mimeType: "image/png", buffer: PNG }]);
    await page.waitForFunction(() => document.querySelectorAll(".attachchip").length === 1);
    await page.fill("#input", "Y esta foto");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    for (let k = 1; k <= 7; k++) {
      await page.fill("#input", `¿Y para el piso ${k}?`);
      await page.press("#input", "Enter");
      await page.waitForFunction(() => !document.getElementById("typing"));
    }
    const ultimaPet = peticiones.at(-1).messages;
    const conLista = ultimaPet.filter((m) => (m.adjuntos || []).some((a) => a.tipo === "lista" && a.data));
    const conFoto = ultimaPet.filter((m) => (m.adjuntos || []).some((a) => a.tipo === "imagen"));
    const idx = ultimaPet.findIndex((m) => m.content === "Crúzalos con mi cartera");
    check("la agenda y el CSV siguen viajando 8 preguntas después (mientras caben)", idx >= 0 && idx < ultimaPet.length - 6 && (ultimaPet[idx].adjuntos || []).filter((a) => a.tipo === "lista").length === 2, JSON.stringify(ultimaPet.map((m) => (m.adjuntos || []).map((a) => a.tipo))));
    check("los CSV de antes también siguen (todas las listas de la conversación)", conLista.length >= 3);
    check("la foto de hace más de 6 mensajes ya no viaja", conFoto.length === 0);
    const pesoTotal = ultimaPet.reduce((t, m) => t + (m.adjuntos || []).reduce((s2, a) => s2 + (a.data || "").length, 0), 0);
    check("todo lo que viaja cabe en el límite de envío (3,5 MB en base64)", pesoTotal <= 3_500_000, String(pesoTotal));
    // Tras recargar, las listas ya no están (no se guardan): por eso el texto dice «hasta que recargues».
    await page.reload();
    await page.waitForSelector(".msg.clara .bubble");
    await page.fill("#input", "¿Sigues teniendo la agenda?");
    await page.press("#input", "Enter");
    await page.waitForFunction(() => !document.getElementById("typing"));
    check("tras recargar la página, la agenda ya no viaja (no se guarda)", !peticiones.at(-1).messages.some((m) => (m.adjuntos || []).some((a) => a.data)));
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
