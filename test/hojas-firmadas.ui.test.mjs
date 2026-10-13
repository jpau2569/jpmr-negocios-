// ============================================================================
//  Prueba de interfaz de cloudflare/hojas-firmadas en Chromium real — npm run test:ui
//  Sirve el Worker con herramientas/probar-en-local.mjs (D1 sobre SQLite) y:
//   · a 360 px (móvil, firma con el DEDO: eventos táctiles de verdad por CDP)
//     y a 1366 px (PC, firma con el ratón): entrar, hoja de visita y de
//     captación, PDF, WhatsApp, lista, detalle y anular;
//   · sin conexión: firmar, queda en la cola con el aviso «pendiente de
//     subir», recargar sin red (abre desde la caché del service worker) y,
//     al volver la red, se sube sola y una sola vez;
//   · sin scroll lateral, todo lo táctil ≥ 44 px (también los enlaces sueltos
//     y la etiqueta de las casillas) y sin errores de CSP;
//   · cola compartida: lo que firmó otro usuario en el mismo móvil no se ve.
// ============================================================================
import { chromium } from "playwright";
import { servidorLocal } from "../cloudflare/hojas-firmadas/herramientas/probar-en-local.mjs";
import { creaD1, creaAssets } from "../cloudflare/hojas-firmadas/herramientas/d1-local.mjs";
import { hashHoja } from "../cloudflare/hojas-firmadas/public/static/nucleo/hoja.js";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const CLAVE = "clave-de-la-prueba-de-interfaz";
const db = creaD1();
const env = { DB: db, ASSETS: creaAssets(), PANEL_CLAVE: CLAVE };
const servidor = servidorLocal({ env });
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${servidor.address().port}`;
const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const cuenta = () => db._base.prepare("SELECT COUNT(*) AS n FROM hojas").get().n;

const sinScrollLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function tactilesPequenos(p) {
  return p.evaluate(() => {
    const sel = "button, select, input:not([type=checkbox]), textarea, a.boton, a.enlace-tactil, .pestanas a, summary, .casilla label, .hoja-fila";
    return [...document.querySelectorAll(sel)]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el: el.tagName + (el.id ? "#" + el.id : el.className ? "." + String(el.className).split(" ")[0] : ""), alto: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.alto < 44);
  });
}
async function revisa(p, donde) {
  check(`${donde}: sin scroll lateral`, await sinScrollLateral(p));
  const peq = await tactilesPequenos(p);
  check(`${donde}: todo lo táctil mide 44 px o más`, peq.length === 0, JSON.stringify(peq.slice(0, 6)));
}

/** Firma dentro del lienzo: con el dedo (eventos táctiles por CDP) o con el ratón. */
async function firma(p, cdp, selector) {
  const lienzo = p.locator(selector);
  await lienzo.scrollIntoViewIfNeeded();
  const c = await lienzo.boundingBox();
  const puntos = Array.from({ length: 24 }, (_, i) => ({ x: c.x + 20 + (i * (c.width - 40)) / 23, y: c.y + c.height / 2 + Math.sin(i / 2) * (c.height / 4) }));
  if (cdp) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [puntos[0]] });
    for (const pt of puntos.slice(1)) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [pt] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await p.mouse.move(puntos[0].x, puntos[0].y);
    await p.mouse.down();
    for (const pt of puntos.slice(1)) await p.mouse.move(pt.x, pt.y, { steps: 2 });
    await p.mouse.up();
  }
}

async function rellenaVisita(p, nombre) {
  await p.fill("#v-nombre", nombre);
  await p.fill("#v-dni", "12345678z");
  await p.fill("#v-telefono", "600 11 22 33");
  await p.fill("#p-referencia", "PIS0190");
  await p.fill("#p-direccion", "Uría 12");
  await p.check("#v-rgpd");
}

async function recorrido(ancho) {
  console.log(`\n📱 ${ancho} px`);
  const movil = ancho < 500;
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 820 }, deviceScaleFactor: 2, hasTouch: movil, isMobile: movil, locale: "es-ES", timezoneId: "Europe/Madrid", acceptDownloads: true });
  // En el móvil se simula la hoja de «Compartir» del sistema (Web Share API):
  // se apunta qué archivo se habría compartido.
  if (movil) {
    await contexto.addInitScript(() => {
      navigator.canShare = (d) => Boolean(d?.files?.length);
      navigator.share = async (d) => { window.__compartido = { nombre: d.files[0].name, tipo: d.files[0].type, bytes: d.files[0].size }; };
    });
  }
  const p = await contexto.newPage();
  const cdp = movil ? await contexto.newCDPSession(p) : null;
  const errores = [];
  p.on("console", (m) => { if (m.type() === "error" && !/status of (401|422|409)/.test(m.text())) errores.push(m.text()); });
  p.on("pageerror", (e) => errores.push(String(e)));
  if (process.env.DEPURA) p.on("console", (m) => console.log("   [consola]", m.type(), m.text()));

  // ---- Entrar ----
  await p.goto(BASE);
  await p.waitForSelector("#form-entrar");
  check("título de la app desde el nombre comercial", (await p.title()) === "Asesoría Castresana · Hojas firmadas");
  check("logo de la marca en la barra", (await p.locator(".logo").evaluate((i) => i.naturalWidth)) > 0);
  await revisa(p, "entrar");
  await p.fill("#clave", "mala");
  await p.click("#form-entrar button[type=submit]");
  await p.waitForFunction(() => document.getElementById("error-entrar")?.textContent.length > 0);
  check("clave mala: mensaje claro", /incorrecta/.test(await p.textContent("#error-entrar")));
  await p.fill("#clave", CLAVE);
  await p.click("#form-entrar button[type=submit]");
  await p.waitForSelector(".acciones-grandes");
  check("entra y saluda al titular", /Hola, Pau Moralejo/.test(await p.textContent("h1")));
  await revisa(p, "inicio");
  await p.evaluate(() => navigator.serviceWorker.ready);

  // ---- Hoja de visita ----
  await p.click("a[href='#visita']");
  await p.waitForSelector("#form-hoja");
  await revisa(p, "hoja de visita");
  check("todos los campos tienen etiqueta", await p.evaluate(() => [...document.querySelectorAll("#form-hoja input, #form-hoja select, #form-hoja textarea")].every((el) => el.labels && el.labels.length > 0)));
  check("aviso BORRADOR de los textos legales", await p.locator(".aviso-borrador").isVisible());
  const casillas = await p.evaluate(() => [...document.querySelectorAll(".casilla label")].map((l) => ({ alto: l.getBoundingClientRect().height, conCasilla: Boolean(l.querySelector("input[type=checkbox]")) })));
  check("casillas de RGPD y ofertas: la etiqueta (≥ 44 px) envuelve la casilla", casillas.length === 2 && casillas.every((c) => c.alto >= 44 && c.conCasilla), JSON.stringify(casillas));
  await p.locator("label[for=v-ofertas]").click({ position: { x: 200, y: 10 } });
  check("tocar el texto de la casilla la marca", await p.isChecked("#v-ofertas"));
  await p.uncheck("#v-ofertas");
  await p.click("#form-hoja button[type=submit]");
  await p.waitForSelector("#errores:not([hidden])");
  check("firmar vacío: lista de lo que falta, con el foco", await p.evaluate(() => document.activeElement?.id === "errores") && /firma del visitante/.test(await p.textContent("#errores")));
  await rellenaVisita(p, `Ana García ${ancho}`);
  check("la declaración se rellena en vivo con los datos", /Ana García/.test(await p.textContent("#texto-declaracion")) && /PIS0190/.test(await p.textContent("#texto-declaracion")));
  await firma(p, cdp, "#firma-cliente");
  check(movil ? "firma del visitante con el dedo" : "firma del visitante con el ratón", (await p.textContent("#estado-firma-cliente")) === "Firmado");
  await firma(p, cdp, "#firma-agente");
  check("firma del agente", (await p.textContent("#estado-firma-agente")) === "Firmado");
  await p.click("[data-borrar-firma=agente]");
  check("«Borrar firma» la deja en blanco", (await p.textContent("#estado-firma-agente")) === "Sin firmar");
  await firma(p, cdp, "#firma-agente");
  const antes = cuenta();
  await p.click("#form-hoja button[type=submit]");
  await p.waitForSelector(".estado-subida.subida", { timeout: 10_000 });
  check("firmada y subida a la nube", cuenta() === antes + 1);
  await revisa(p, "hoja firmada");
  const fila = db._base.prepare("SELECT * FROM hojas ORDER BY recibida DESC, rowid DESC LIMIT 1").get();
  const contenido = JSON.parse(fila.contenido);
  check("en D1: el hash es el SHA-256 del contenido", fila.hash === await hashHoja(contenido));
  check("en D1: dos firmas JPEG de 150 KB o menos", ["cliente", "agente"].every((k) => contenido.firmas[k].dataUrl.startsWith("data:image/jpeg;base64,/9j/") && contenido.firmas[k].dataUrl.length < 205_000));
  check("la pantalla enseña el mismo SHA-256", (await p.textContent(".huella code")) === fila.hash);
  const wa = await p.getAttribute("a[href^='https://wa.me/']", "href");
  check("WhatsApp con el número del visitante y el texto preparado", wa.startsWith("https://wa.me/34600112233?text=Hola%20Ana"));
  check("correo con mailto", (await p.getAttribute("a[href^='mailto:']", "href")).startsWith("mailto:?subject="));
  const [descarga] = await Promise.all([p.waitForEvent("download"), p.click("[data-accion=descargar]")]);
  const ruta = await descarga.path();
  const pdf = (await import("node:fs")).readFileSync(ruta).toString("latin1");
  check("PDF descargado con el SHA-256 al pie y la marca", pdf.startsWith("%PDF-1.4") && pdf.includes(fila.hash) && pdf.includes("(ASESORIA CASTRESANA INMO)") && /Hoja-visita-PIS0190-\d{4}-\d{2}-\d{2}\.pdf/.test(descarga.suggestedFilename()));
  check("PDF subido: bajo las firmas, visita, firma en el móvil y registro en el servidor", pdf.includes("Visita del ") && pdf.includes("Registrada en el servidor el"));
  if (movil) {
    await p.click("[data-accion=compartir]");
    const c = await p.waitForFunction(() => window.__compartido).then((h) => h.jsonValue());
    check("«Compartir PDF» pasa el PDF a la hoja de compartir del móvil (Web Share API)", c.tipo === "application/pdf" && c.nombre.endsWith(".pdf") && c.bytes > 1000);
  } else {
    const [comparte] = await Promise.all([p.waitForEvent("download"), p.click("[data-accion=compartir]")]);
    check("«Compartir PDF» sin Web Share de archivos: lo descarga", comparte.suggestedFilename().endsWith(".pdf"));
  }

  // ---- Lista, detalle y anular ----
  await p.click(".pestanas a[href='#hojas']");
  await p.waitForSelector(".lista-hojas .hoja-fila");
  await revisa(p, "lista de hojas");
  await p.fill("#f-nombre", `ana garcia ${ancho}`);
  await p.click("#form-filtros button[type=submit]");
  await p.waitForFunction(() => document.querySelectorAll("#resultados .hoja-fila").length === 1);
  check("filtro por nombre sin tildes", (await p.locator("#resultados .hoja-fila").count()) === 1);
  await p.click("#resultados .hoja-fila");
  await p.waitForSelector(".datos");
  await revisa(p, "detalle");
  check("detalle con el SHA-256", (await p.textContent(".huella code")) === fila.hash);
  check("el SHA-256 explicado en palabras de Pau", /Código de comprobación \(SHA-256\): sirve para demostrar que la hoja no ha cambiado/.test(await p.textContent(".huella")));
  check("«← Volver a la lista» con zona táctil de 44 px", (await p.locator("a.enlace-tactil[href='#hojas']").evaluate((a) => a.getBoundingClientRect().height)) >= 44);
  await p.fill("#motivo", "Prueba de anulación desde la interfaz");
  await p.click("#form-anular button[type=submit]");
  await p.waitForFunction(() => /ANULADA/.test(document.querySelector(".datos")?.textContent || ""));
  check("anulada: lo dice el detalle y la base de datos", db._base.prepare("SELECT estado FROM hojas WHERE id = ?").get(fila.id).estado === "anulada");
  const [desc2] = await Promise.all([p.waitForEvent("download"), p.click("[data-accion=descargar]")]);
  check("el PDF de una hoja anulada lo dice al pie", (await import("node:fs")).readFileSync(await desc2.path()).toString("latin1").includes("ANULADA el "));

  // ---- Hoja de captación ----
  await p.click(".pestanas a[href='#inicio']");
  await p.click("a[href='#captacion']");
  await p.waitForSelector("#form-hoja[data-tipo=captacion]");
  check("captación: honorarios y duración en blanco", (await p.inputValue("#c-honorarios")) === "" && (await p.inputValue("#c-duracion")) === "");
  check("captación: sin desistimiento mientras no se elija «fuera de la oficina»", await p.locator("#caja-desistimiento").isHidden());
  await p.fill("#c-propNombre", `Luis Fernández ${ancho}`);
  await p.fill("#c-referencia", "PIS0201");
  await p.selectOption("#c-tipoEncargo", "Exclusiva");
  await p.fill("#c-honorarios", "3 % + IVA");
  await p.fill("#c-duracion", "6 meses");
  await p.selectOption("#c-lugarFirma", "Fuera de la oficina");
  check("fuera de la oficina: aparece el desistimiento de 14 días", await p.locator("#caja-desistimiento").isVisible() && /14 días/.test(await p.textContent("#texto-desistimiento")));
  check("la conformidad se rellena con las condiciones escritas", /3 % \+ IVA/.test(await p.textContent("#texto-conformidad")));
  await revisa(p, "hoja de captación");
  await firma(p, cdp, "#firma-cliente");
  await firma(p, cdp, "#firma-agente");
  await p.click("#form-hoja button[type=submit]");
  await p.waitForSelector(".estado-subida.subida", { timeout: 10_000 });
  const cap = JSON.parse(db._base.prepare("SELECT contenido FROM hojas WHERE tipo = 'captacion' ORDER BY rowid DESC LIMIT 1").get().contenido);
  check("captación guardada con lugar de firma, fecha y textos de desistimiento", cap.datos.piso.lugarFirma === "Fuera de la oficina" && /^\d{4}-\d{2}-\d{2}$/.test(cap.datos.piso.fechaCaptacion) && /14 días/.test(cap.textos.desistimiento));

  check("sin errores en consola (CSP incluida)", errores.length === 0, errores.join(" | "));
  return { contexto, p, cdp, errores };
}

const movil = await recorrido(360);
const pc = await recorrido(1366);

// ---- Ajustes (en el PC): la marca cambia la app ----
console.log("\n🏷️  Ajustes de marca (1366 px)");
{
  const { p } = pc;
  await p.click(".pestanas a[href='#ajustes']");
  await p.waitForSelector("#form-marca");
  await revisa(p, "ajustes");
  check("el aviso dice qué datos de la marca faltan (CIF, razón social)", /razón social y el CIF siguen como \[PENDIENTE\]/.test(await p.textContent(".avisos")));
  check("el aviso de Telegram en palabras de Pau", /Avisos por Telegram: sin configurar \(opcional\)/.test(await p.textContent(".avisos")) && !/TELEGRAM_/.test(await p.textContent(".avisos")));
  check("Ajustes: «Los agentes solo ven sus hojas» activado por defecto", await p.isChecked("#p-soloSuyas"));
  await p.fill("#m-nombreComercial", "Pisos Norte");
  await p.fill("#m-encabezadoFirmas", "PISOS NORTE GESTION SL");
  await p.evaluate(() => { const c = document.getElementById("m-colorPrincipal"); c.value = "#ffe600"; c.dispatchEvent(new Event("input", { bubbles: true })); });
  check("vista previa: texto negro sobre amarillo (contraste WCAG)", (await p.locator("#muestra-boton").evaluate((e) => getComputedStyle(e).color)) === "rgb(0, 0, 0)");
  await p.click("#form-marca button[type=submit]");
  await p.waitForFunction(() => /Marca guardada/.test(document.getElementById("marca-ok")?.textContent || ""));
  await p.reload();
  await p.waitForSelector(".acciones-grandes, #form-marca");
  check("al recargar, la app se llama como la marca nueva", (await p.title()) === "Pisos Norte · Hojas firmadas" && (await p.textContent(".nombre-app")) === "Pisos Norte");
  await p.goto(`${BASE}/#inicio`);
  await p.waitForSelector(".avisos");
  check("Inicio avisa: otra inmobiliaria con el logo y el encabezado de Castresana", /logo de serie/.test(await p.textContent(".avisos")));
  check("«Ir a Ajustes» con zona táctil de 44 px", (await p.locator(".avisos a.enlace-tactil").evaluate((a) => a.getBoundingClientRect().height)) >= 44);
  check("la barra usa el color nuevo con texto legible", (await p.locator(".barra").evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color].join("|"))) === "rgb(255, 230, 0)|rgb(0, 0, 0)");
  check("sin errores en consola", pc.errores.length === 0, pc.errores.join(" | "));
}

// ---- Sin conexión (móvil) ----
console.log("\n📵 Sin conexión (360 px)");
{
  const { contexto, p, cdp, errores } = movil;
  await p.click(".pestanas a[href='#inicio']");
  await p.waitForSelector(".acciones-grandes");
  await contexto.setOffline(true);
  await p.waitForFunction(() => document.getElementById("red")?.textContent === "Sin conexión");
  check("se ve el aviso «Sin conexión»", true);
  await p.click("a[href='#visita']");
  await p.waitForSelector("#form-hoja");
  await rellenaVisita(p, "Carmen Sin Cobertura");
  await firma(p, cdp, "#firma-cliente");
  await firma(p, cdp, "#firma-agente");
  const antes = cuenta();
  await p.click("#form-hoja button[type=submit]");
  await p.waitForSelector(".estado-subida.pendiente");
  check("firmada sin red: «pendiente de subir»", /Pendiente de subir/.test(await p.textContent("#estado-subida")) && cuenta() === antes);
  await p.waitForSelector("#pendientes:not([hidden])");
  check("aviso visible arriba: 1 hoja pendiente de subir", /1 hoja pendiente de subir/.test(await p.textContent("#pendientes")));
  const enCola = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("hojas-firmadas"); r.onsuccess = () => { const q = r.result.transaction("pendientes").objectStore("pendientes").count(); q.onsuccess = () => ok(q.result); }; }));
  check("está en la cola local (IndexedDB)", enCola === 1);
  const [desc] = await Promise.all([p.waitForEvent("download"), p.click("[data-accion=descargar]")]);
  const pdfSinRed = (await import("node:fs")).readFileSync(await desc.path()).toString("latin1");
  check("sin red también sale el PDF (dice «Pendiente de registrar»)", pdfSinRed.includes("Pendiente de registrar en el servidor"));
  check("y NO dice «Registrada» (no se ha subido)", !pdfSinRed.includes("Registrada") && pdfSinRed.includes("Visita del "));
  await revisa(p, "firmada sin red");
  await p.reload();
  await p.waitForSelector(".acciones-grandes", { timeout: 10_000 });
  check("recargar sin red: la app abre desde la caché del service worker", /Hola, Pau Moralejo/.test(await p.textContent("h1")));
  await p.waitForSelector("#pendientes:not([hidden])");
  check("y sigue el aviso de la hoja pendiente", /1 hoja pendiente/.test(await p.textContent("#pendientes")));
  await contexto.setOffline(false);
  await p.waitForFunction(() => document.getElementById("pendientes").hidden === true, null, { timeout: 15_000 });
  check("al volver la red se sube sola", cuenta() === antes + 1);
  check("y una sola vez (sin duplicar)", db._base.prepare("SELECT COUNT(*) AS n FROM hojas WHERE nombre = 'Carmen Sin Cobertura'").get().n === 1);
  const vacia = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("hojas-firmadas"); r.onsuccess = () => { const q = r.result.transaction("pendientes").objectStore("pendientes").count(); q.onsuccess = () => ok(q.result); }; }));
  check("y se borra del móvil", vacia === 0);
  // Reenvío de la misma hoja (por ejemplo, otra pestaña con la cola vieja): no duplica.
  const fila = db._base.prepare("SELECT contenido, hash FROM hojas WHERE nombre = 'Carmen Sin Cobertura'").get();
  const st = await p.evaluate(async ({ hoja, hash }) => (await fetch("/api/hojas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hoja, hash }) })).status, { hoja: JSON.parse(fila.contenido), hash: fila.hash });
  check("volver a mandarla da 200 (repetida) y sigue habiendo una", st === 200 && db._base.prepare("SELECT COUNT(*) AS n FROM hojas WHERE nombre = 'Carmen Sin Cobertura'").get().n === 1);
  check("sin errores en consola", errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(e)).length === 0, errores.join(" | "));
}

// ---- Cola compartida (móvil): dos usuarios en el mismo teléfono ----
console.log("\n👥 Cola compartida y salir de verdad (360 px)");
{
  const { p } = movil;
  p.on("dialog", (d) => d.accept());
  const alta = await p.evaluate(async () => (await fetch("/api/agentes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre: "Ana Agente", usuario: "ana.movil", clave: "clave de ana movil" }) })).status);
  check("alta de una agente desde el móvil del titular", alta === 200);
  // El titular firma y la hoja se queda en la cola (el servidor no responde).
  await p.route("**/api/hojas", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : r.continue()));
  await p.goto(`${BASE}/#visita`);
  await p.waitForSelector("#form-hoja");
  await rellenaVisita(p, "Elena Privada Titular");
  await firma(p, movil.cdp, "#firma-cliente");
  await firma(p, movil.cdp, "#firma-agente");
  await p.click("#form-hoja button[type=submit]");
  await p.waitForSelector(".estado-subida.pendiente");
  const idPendiente = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("hojas-firmadas"); r.onsuccess = () => { const q = r.result.transaction("pendientes").objectStore("pendientes").getAll(); q.onsuccess = () => ok(q.result[0]?.id); }; }));
  const cookieVieja = (await p.context().cookies()).find((c) => c.name === "__Host-sesion");
  await p.goto(`${BASE}/#ajustes`);
  await p.waitForSelector("#salir");
  await p.click("#salir");
  await p.waitForSelector("#form-entrar");
  await p.unroute("**/api/hojas");
  // La cookie del titular, copiada antes de salir, ya no vale en el servidor.
  const conVieja = await fetch(`${BASE}/api/yo`, { headers: { cookie: `${cookieVieja?.name}=${cookieVieja?.value}` } });
  check("tras «Salir», la cookie copiada del titular ya no vale (401)", Boolean(cookieVieja) && conVieja.status === 401);
  await p.fill("#usuario", "ana.movil");
  await p.fill("#clave", "clave de ana movil");
  await p.click("#form-entrar button[type=submit]");
  await p.waitForSelector(".acciones-grandes");
  await p.waitForSelector("#pendientes:not([hidden])");
  const aviso = await p.textContent("#pendientes");
  check("la agente ve «1 hoja pendiente de otro usuario en este móvil»", /1 hoja pendiente de otro usuario en este móvil/.test(aviso), aviso);
  check("…sin datos de esa hoja", !/Elena|PIS0190|600/.test(aviso));
  await p.goto(`${BASE}/#hojas`);
  await p.waitForSelector("#form-filtros");
  await p.waitForTimeout(300);
  const lista = await p.textContent("main");
  check("en «Hojas» no sale la hoja del titular, solo cuántas hay", !lista.includes("Elena") && /1 hoja pendiente de otro usuario/.test(lista));
  await p.goto(`${BASE}/#local/${idPendiente}`);
  await p.waitForSelector("main .error");
  check("abrirla por su dirección tampoco enseña nada", /otro usuario/.test(await p.textContent("main")) && !(await p.textContent("main")).includes("Elena"));
  const enCola = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open("hojas-firmadas"); r.onsuccess = () => { const q = r.result.transaction("pendientes").objectStore("pendientes").count(); q.onsuccess = () => ok(q.result); }; }));
  check("la agente no la intenta subir: sigue en la cola", enCola === 1 && db._base.prepare("SELECT COUNT(*) AS n FROM hojas WHERE nombre = 'Elena Privada Titular'").get().n === 0);
  await revisa(p, "hojas de la agente");
  // El titular vuelve a entrar y se sube.
  await p.goto(`${BASE}/#ajustes`);
  await p.waitForSelector("#salir");
  await p.click("#salir");
  await p.waitForSelector("#form-entrar");
  await p.fill("#clave", CLAVE);
  await p.click("#form-entrar button[type=submit]");
  await p.waitForSelector(".acciones-grandes");
  await p.waitForFunction(() => document.getElementById("pendientes").hidden === true, null, { timeout: 15_000 });
  check("el titular vuelve a entrar y su hoja se sube sola", db._base.prepare("SELECT COUNT(*) AS n FROM hojas WHERE nombre = 'Elena Privada Titular'").get().n === 1);
}

await navegador.close();
servidor.close();
console.log(`\nResultado hojas-firmadas (interfaz): ${pasados} pasados, ${fallados} fallados.`);
if (fallados) process.exit(1);
