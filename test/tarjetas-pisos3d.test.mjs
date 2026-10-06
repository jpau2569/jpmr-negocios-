// ============================================================================
//  Tests de «Nuestros pisos» en las tarjetas digitales — Chromium real
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/tarjetas-pisos3d.test.mjs
//  No sale a Internet: la cartera, las fotos y los CDN se interceptan.
//  Comprueba tres cosas:
//    1. La tarjeta de Pau enseña el bloque de pisos (y NO se rompe si la cartera
//       falla, viene vacía o trae texto malicioso).
//    2. La página «enviar» añade el enlace al escaparate solo cuando toca.
//    3. El escaparate admite ?ag=<clave> SOLO de una lista cerrada (un número
//       libre en la URL desviaría las visitas de los clientes a otro móvil).
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const RAIZ = new URL("..", import.meta.url).pathname;
const TARJETAS = join(RAIZ, "tarjetas-castresana");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".vcf": "text/vcard" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

// Servidor estático. `limpias` imita cleanUrls de Vercel (/pau → pau/index.html).
function servidor(raiz, puerto, { limpias = false, transforma } = {}) {
  const srv = http.createServer(async (req, res) => {
    let ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta.endsWith("/")) ruta += "index.html";
    const seguro = normalize(join(raiz, ruta));
    if (!seguro.startsWith(raiz)) return res.writeHead(403).end();
    const candidatos = limpias && !extname(ruta) ? [seguro + ".html", join(seguro, "index.html")] : [seguro];
    for (const c of candidatos) {
      try {
        let data = await readFile(c);
        if (transforma && c.endsWith(".html")) data = Buffer.from(transforma(data.toString("utf8")));
        res.writeHead(200, { "content-type": MIME[extname(c)] || "application/octet-stream" });
        return res.end(data);
      } catch { /* siguiente candidato */ }
    }
    res.writeHead(404).end("no encontrado");
  });
  return new Promise((ok) => srv.listen(puerto, () => ok(srv)));
}

const PORT_TARJETA = 8131, PORT_ESCAPARATE = 8132;
const srvTarjetas = await servidor(TARJETAS, PORT_TARJETA, { limpias: true });
// Al escaparate se le añade una persona de prueba: así se puede demostrar que el
// número cambia de verdad (el de Pau coincide con el de por defecto).
const srvEscaparate = await servidor(RAIZ, PORT_ESCAPARATE, {
  transforma: (html) => html.replace(
    'pau: { nombre: "Pau", whatsapp: "34672775721" },',
    'pau: { nombre: "Pau", whatsapp: "34672775721" },\n    prueba: { nombre: "Prueba", whatsapp: "34600000000" },'),
});

// --- Cartera simulada con la forma real de /api/escaparate -------------------
const item = (n, extra = {}) => ({
  ref: "REF" + n, operacion: "venta", titulo: `Piso ${n} en Oviedo`, localidad: "Oviedo",
  precio: 400000 - n * 20000, m2: 80 + n, habitaciones: 3, banos: 2,
  foto: `https://storage.googleapis.com/static.inmoweb.es/p${n}.jpg`, url: `https://www.asesoriacastresana.com/p${n}`, ...extra,
});
const CARTERA = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => item(n));
CARTERA.push(item(9, { operacion: "alquiler", precio: 1000, titulo: "Apartamento en Llanes" }));

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function paginaNueva({ ancho = 390, api = { status: 200, body: { ok: true, items: CARTERA } }, leads } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
  const page = await ctx.newPage();
  page.errores = [];
  page.on("pageerror", (e) => page.errores.push(String(e)));
  await page.addInitScript(() => { window.__abiertas = []; window.open = (u) => { window.__abiertas.push(String(u)); return null; }; });
  await page.route(/^https?:\/\/(?!localhost)/, (route) => {
    const u = route.request().url();
    if (u.startsWith("https://jpmr-negocios.vercel.app/api/escaparate")) {
      return route.fulfill({ status: api.status, contentType: "application/json", body: JSON.stringify(api.body ?? {}) });
    }
    if (u.startsWith("https://jpmr-negocios.vercel.app/api/foto")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.abort(); // fuentes de Google, qrcode.js…: no se necesitan
  });
  if (leads) {
    await page.route("**/api/lead", async (route) => { leads.push(JSON.parse(route.request().postData() || "{}")); await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  }
  return page;
}

const URL_TARJETA = `http://localhost:${PORT_TARJETA}/pau`;
const URL_ENVIAR = `http://localhost:${PORT_TARJETA}/pau/enviar`;
const ESC = "https://jpmr-negocios.vercel.app/escaparate3d/";

// ============================================================================
console.log("\n— Tarjeta de Pau: bloque «Nuestros pisos» (móvil, 390 px) —");
{
  const page = await paginaNueva();
  await page.goto(URL_TARJETA);
  await page.waitForSelector("#pisos3d:not([hidden]) .p3-it", { timeout: 5000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    visible: !document.getElementById("pisos3d").hidden,
    n: document.querySelectorAll("#pisos3d .p3-it").length,
    cta: document.querySelector("#pisos3d .p3-cta")?.textContent.trim(),
    ctaHref: document.querySelector("#pisos3d .p3-cta")?.href,
    badge: !!document.querySelector("#pisos3d .p3-badge"),
    primero: document.querySelector("#pisos3d .p3-it")?.href,
    ultimo: [...document.querySelectorAll("#pisos3d .p3-it")].pop()?.href,
    precios: [...document.querySelectorAll("#pisos3d .p3-p")].map((e) => e.textContent),
    ops: [...document.querySelectorAll("#pisos3d .p3-op")].map((e) => e.textContent),
    meta: document.querySelector("#pisos3d .p3-m")?.textContent,
    desborda: document.documentElement.scrollWidth > window.innerWidth,
    posicion: [...document.querySelectorAll(".wrap > *")].map((e) => e.id || e.className.split(" ")[0]),
  }));
  check("el bloque aparece y enseña 4 pisos", r.visible && r.n === 4, JSON.stringify(r));
  check("en el móvil el botón NO promete 3D (el escaparate enseña la lista)", r.cta === "Ver los 9 pisos" && !r.badge, r.cta);
  check("el botón abre el escaparate con la clave de Pau", r.ctaHref === ESC + "?ag=pau", r.ctaHref);
  check("cada piso abre el escaparate con su referencia y la clave de Pau", r.primero === ESC + "?ag=pau&ref=REF1", r.primero);
  check("se reparten por toda la lista: el último es el más asequible de las ventas", r.ultimo === ESC + "?ag=pau&ref=REF8", r.ultimo);
  check("solo salen ventas (el alquiler no entra en la muestra)", r.ops.every((o) => o === "Venta"), r.ops.join());
  check("precio con formato español y metros/habitaciones (con espacio duro: «3 hab.» no se parte)", r.precios[0] === "380.000 €" && r.meta === "Oviedo · 81 m² · 3 hab.", `${r.precios[0]} | ${JSON.stringify(r.meta)}`);
  check("la página no se ensancha en el móvil (sin scroll horizontal)", !r.desborda);
  check("el bloque va tras «Guardar en mis contactos» y antes de los datos", r.posicion.indexOf("pisos3d") === r.posicion.indexOf("save") + 1 && r.posicion.indexOf("box") === r.posicion.indexOf("pisos3d") + 1, r.posicion.join(" > "));
  check("sin errores de JavaScript", page.errores.length === 0, page.errores.join(" | "));
  await page.context().close();
}

console.log("\n— Tarjeta de Pau: pantalla ancha (1280 px) —");
{
  const page = await paginaNueva({ ancho: 1280 });
  await page.goto(URL_TARJETA);
  await page.waitForSelector("#pisos3d:not([hidden]) .p3-it", { timeout: 5000 }).catch(() => {});
  const r = await page.evaluate(() => ({ cta: document.querySelector("#pisos3d .p3-cta")?.textContent.trim(), badge: !!document.querySelector("#pisos3d .p3-badge") }));
  check("en pantalla ancha sí dice «en 3D» y lleva la etiqueta 3D", r.cta === "Ver los 9 pisos en 3D" && r.badge, JSON.stringify(r));
  await page.context().close();
}

console.log("\n— La tarjeta sigue igual de útil si la cartera falla —");
for (const [nombre, api] of [
  ["la API responde 500", { status: 500, body: { error: "x" } }],
  ["la cartera viene vacía", { status: 200, body: { ok: false, items: [] } }],
  ["ningún piso trae foto", { status: 200, body: { items: [item(1, { foto: null }), item(2, { foto: "javascript:alert(1)" })] } }],
  ["la API devuelve basura", { status: 200, body: "esto no es un objeto" }],
]) {
  const page = await paginaNueva({ api });
  await page.goto(URL_TARJETA);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    oculto: document.getElementById("pisos3d").hidden,
    vacio: document.getElementById("pisos3d").children.length === 0,
    contacto: !!document.querySelector('.actions a[href^="tel:"]') && !!document.querySelector('a.save[href="/pau/pau.vcf"]'),
  }));
  check(`${nombre}: el bloque no se muestra y el contacto sigue ahí`, r.oculto && r.vacio && r.contacto, JSON.stringify(r));
  check(`${nombre}: sin errores de JavaScript`, page.errores.length === 0, page.errores.join(" | "));
  await page.context().close();
}

console.log("\n— Texto malicioso en la cartera no se ejecuta —");
{
  const malo = item(1, {
    titulo: '<img src=x onerror="window.__pwned=1">', localidad: '<script>window.__pwned=2</script>',
    ref: 'X"><img src=x onerror="window.__pwned=3">',
  });
  const page = await paginaNueva({ api: { status: 200, body: { items: [malo, item(2), item(3), item(4), item(5)] } } });
  await page.goto(URL_TARJETA);
  await page.waitForSelector("#pisos3d:not([hidden]) .p3-it", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    pwned: window.__pwned || null,
    imgs: document.querySelectorAll("#pisos3d img").length,
    scripts: document.querySelectorAll("#pisos3d script").length,
    href: document.querySelector("#pisos3d .p3-it")?.getAttribute("href"),
  }));
  check("no se ejecuta nada y solo hay las 4 fotos esperadas", !r.pwned && r.imgs === 4 && r.scripts === 0, JSON.stringify(r));
  check("la referencia viaja codificada en el enlace", r.href.includes("ref=X%22%3E%3Cimg"), r.href);
  await page.context().close();
}

// ============================================================================
console.log("\n— Página «enviar»: enlace a los pisos en el mensaje —");
{
  const page = await paginaNueva();
  await page.goto(URL_ENVIAR);
  const texto = () => page.inputValue("#f-body-mail");
  const enlace = ESC + "?ag=pau";

  let t = await texto();
  check("por defecto (Presentación) el mensaje lleva el enlace a los pisos", t.includes(enlace) && t.includes("Si quiere ver los pisos"), t.slice(0, 400));
  check("la casilla viene marcada", await page.isChecked("#f-pisos"));
  check("el enlace va antes de la despedida, no en medio del contacto", t.indexOf(enlace) < t.indexOf("Quedamos a su disposición") && t.indexOf("Quedamos a su disposición") < t.indexOf("Tarjeta digital:"));
  check("lo de antes sigue: tarjeta digital, contacto y aviso legal", t.includes("Tarjeta digital: ") && t.includes("Móvil: 672 77 57 21") && t.includes("AVISO DE CONFIDENCIALIDAD"));

  await page.uncheck("#f-pisos");
  t = await texto();
  check("al desmarcar la casilla desaparece el enlace y su frase", !t.includes("escaparate3d") && !t.includes("Si quiere ver los pisos"));

  await page.check("#f-pisos");
  await page.click('#chips .chip[data-k="legal"]');
  t = await texto();
  check("en «Consulta jurídica» la casilla sale desmarcada y no hay enlace", !(await page.isChecked("#f-pisos")) && !t.includes("escaparate3d"));
  await page.click('#chips .chip[data-k="asesoria"]');
  check("en «Fiscal, laboral y contable» tampoco", !(await page.isChecked("#f-pisos")) && !(await texto()).includes("escaparate3d"));

  for (const k of ["inmueble", "reunion", "seguimiento", "general"]) {
    await page.click(`#chips .chip[data-k="${k}"]`);
    check(`en «${k}» vuelve a salir marcada y con enlace`, (await page.isChecked("#f-pisos")) && (await texto()).includes(enlace));
  }

  await page.fill("#f-name", "María");
  t = await texto();
  check("el nombre del cliente sigue funcionando", t.startsWith("Hola, María:"));

  const href = await page.getAttribute("#go-app", "href");
  check("el correo (mailto) lleva el enlace en el cuerpo", decodeURIComponent(href).includes(enlace));
  const gmail = await page.getAttribute("#go-web", "href");
  check("Gmail web lleva el enlace en el cuerpo", decodeURIComponent(gmail).includes(enlace));
  check("sin errores de JavaScript", page.errores.length === 0, page.errores.join(" | "));
  await page.context().close();
}

// ============================================================================
console.log("\n— Escaparate: ?ag= solo admite personas de la lista cerrada —");
{
  const wa = async (qs) => {
    const page = await paginaNueva();
    await page.goto(`http://localhost:${PORT_ESCAPARATE}/escaparate3d/?fuente=respaldo&2d=1${qs}`);
    await page.waitForSelector("#wasap-cabecera:not([hidden])", { timeout: 3000 }).catch(() => {});
    const href = (await page.getAttribute("#wasap-cabecera", "href")) || "";
    const errores = page.errores.slice();
    await page.context().close();
    return { href, errores };
  };
  const base = (await wa("")).href;
  check("sin ?ag= todo sigue como antes (WhatsApp de la agencia)", base.startsWith("https://wa.me/34672775721?text="), base);
  const prueba = await wa("&ag=prueba");
  check("?ag=prueba lleva las visitas al WhatsApp de esa persona", prueba.href.startsWith("https://wa.me/34600000000?text="), prueba.href);
  check("la clave no distingue mayúsculas", (await wa("&ag=PRUEBA")).href.startsWith("https://wa.me/34600000000"));
  check("?ag=pau sigue yendo al WhatsApp de Pau", (await wa("&ag=pau")).href.startsWith("https://wa.me/34672775721"));
  check("un número suelto en la URL NO desvía nada (?wa=…)", (await wa("&wa=34611111111")).href.startsWith("https://wa.me/34672775721"));
  check("una clave que no está en la lista se ignora", (await wa("&ag=desconocido")).href.startsWith("https://wa.me/34672775721"));
  // La clave se pasa a minúsculas antes de buscarla, así que solo estas dos
  // propiedades heredadas de Object podrían colarse (el resto llevan mayúsculas).
  for (const raro of ["__proto__", "constructor"]) {
    const r = await wa("&ag=" + raro);
    check(`la clave «${raro}» no cuela nada raro`, r.href.startsWith("https://wa.me/34672775721") && r.errores.length === 0, r.href + " " + r.errores.join());
  }
}

console.log("\n— Escaparate: el cliente queda apuntado con la tarjeta de origen —");
{
  const pide = async (qs) => {
    const leads = [];
    const page = await paginaNueva({ leads });
    await page.goto(`http://localhost:${PORT_ESCAPARATE}/escaparate3d/?fuente=respaldo&2d=1${qs}`);
    await page.waitForSelector('#lista button[data-accion="visita"]', { timeout: 5000 });
    await page.click('#lista button[data-accion="visita"]');
    await page.fill("#dlg-nombre", "Ana Prueba");
    await page.fill("#dlg-telefono", "600111222");
    await page.fill("#dlg-email", "ana@example.com");
    await page.click("#dlg-wasap");
    await page.waitForTimeout(300);
    const abiertas = await page.evaluate(() => window.__abiertas);
    await page.context().close();
    return { lead: leads[0], abiertas };
  };
  const conTarjeta = await pide("&ag=prueba");
  check("desde la tarjeta, el lead se registra con su origen", conTarjeta.lead?.origen === "escaparate3d-tarjeta-prueba", JSON.stringify(conTarjeta.lead));
  check("y el WhatsApp que se abre es el de esa persona", conTarjeta.abiertas[0]?.startsWith("https://wa.me/34600000000?text="), conTarjeta.abiertas[0]);
  const sinTarjeta = await pide("");
  check("sin tarjeta, el origen es el de siempre", sinTarjeta.lead?.origen === "escaparate3d", JSON.stringify(sinTarjeta.lead));
}

await browser.close();
srvTarjetas.close();
srvEscaparate.close();

console.log(`\n${pasados} comprobaciones correctas, ${fallados} falladas.`);
process.exit(fallados ? 1 : 0);
