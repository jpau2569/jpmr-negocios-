// ============================================================================
//  Test de interfaz de Fotos para Idealista con Chromium real (Playwright)
// ----------------------------------------------------------------------------
//  npm run test:ui  (o node test/fotos-idealista.ui.test.mjs)
//  Genera 4 JPEG en el propio navegador (uno con EXIF de orientación, otro
//  casi igual a otro), los carga, simula /api/fotos-idealista y comprueba:
//  repetida apartada, orden y nombres, avisos, ZIP con JPEG sin EXIF y con
//  la orientación aplicada, reordenar, cambiar estancia, fallo de la IA y
//  que no hay desbordamiento a 390 ni a 1366 px.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { tieneExif } from "../fotos-idealista/procesar.js";

const PORT = 8137;
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const server = http.createServer(async (req, res) => {
  try {
    const ruta = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const data = await readFile(join(ROOT, ruta));
    res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end("no encontrado"); }
});
await new Promise((ok) => server.listen(PORT, ok));

// ── ZIP «store»: lista de entradas ────────────────────────────────────────────
function leerZip(buf) {
  const entradas = [];
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const tam = buf.readUInt32LE(p + 18), largoNombre = buf.readUInt16LE(p + 26), extra = buf.readUInt16LE(p + 28);
    const nombre = buf.slice(p + 30, p + 30 + largoNombre).toString("utf8");
    const inicio = p + 30 + largoNombre + extra;
    entradas.push({ nombre, datos: buf.slice(inicio, inicio + tam) });
    p = inicio + tam;
  }
  return entradas;
}
// Medidas de un JPEG leyendo su marcador SOF.
function medidasJpeg(b) {
  let p = 2;
  while (p < b.length) {
    const m = b[p + 1], largo = b.readUInt16BE(p + 2);
    if (m >= 0xc0 && m <= 0xc3) return { alto: b.readUInt16BE(p + 5), ancho: b.readUInt16BE(p + 7) };
    p += 2 + largo;
  }
  return null;
}

// ── Fotos de prueba, dibujadas en el navegador ────────────────────────────────
async function generarFotos(page) {
  const fotos = await page.evaluate(async () => {
    const hacer = async (w, h, pintar, q = 0.92) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); pintar(x, w, h);
      const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
      return [...new Uint8Array(await b.arrayBuffer())];
    };
    const salon = (brillo) => (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, `rgb(${30 + brillo},${40 + brillo},${60 + brillo})`); g.addColorStop(1, `rgb(${220 + brillo / 4},${200 + brillo / 4},${160 + brillo / 4})`);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = "#553"; x.fillRect(w * 0.1, h * 0.55, w * 0.5, h * 0.3);
      x.fillStyle = "#eee"; x.fillRect(w * 0.7, h * 0.1, w * 0.2, h * 0.4);
    };
    return {
      a: await hacer(400, 300, salon(0)),
      c: await hacer(300, 225, salon(12)),                          // casi igual que «a», más pequeña
      b: await hacer(400, 300, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#fff"); g.addColorStop(1, "#123");
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#a33" : "#3a3"; x.fillRect(i * 50, (i * 37) % h, 40, 60); }
      }),
      d: await hacer(400, 300, (x, w, h) => {
        x.fillStyle = "#246"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#fc0"; x.beginPath(); x.arc(w * 0.3, h * 0.5, 80, 0, 7); x.fill();
        x.fillStyle = "#fff"; x.fillRect(w * 0.6, 0, 30, h);
      }),
    };
  });
  const out = Object.fromEntries(Object.entries(fotos).map(([k, v]) => [k, Buffer.from(v)]));
  // A «d» le metemos un bloque EXIF con orientación 6 (girada 90°), como las del iPhone.
  const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.alloc(2), Buffer.from("Exif\0\0", "binary"), tiff]);
  app1.writeUInt16BE(app1.length - 2, 2);
  out.d = Buffer.concat([out.d.slice(0, 2), app1, out.d.slice(2)]);
  return out;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const erroresPagina = [];

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erroresPagina.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") erroresPagina.push(m.text()); });

  const peticiones = [];
  await page.route("**/api/fotos-idealista", async (route) => {
    const body = route.request().postDataJSON();
    peticiones.push(body);
    const n = body.fotos.length;
    const base = [
      { estancia: "cocina", calidad: { luz: 3, encuadre: 3, nitidez: 3, media: 3 }, objetos_a_retirar: [], avisos: [], es_portada_candidata: false },
      { estancia: "salon", calidad: { luz: 5, encuadre: 5, nitidez: 4, media: 4.7 }, objetos_a_retirar: [], avisos: [], es_portada_candidata: true },
      { estancia: "dormitorio", calidad: { luz: 4, encuadre: 3, nitidez: 4, media: 3.7 }, objetos_a_retirar: ["movil", "mandos"], avisos: ["posible_otro_inmueble"], es_portada_candidata: false },
    ];
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, fotos: base.slice(0, n), ignorados: [] }) });
  });

  console.log("\n— carga (390 px) —");
  await page.goto(`http://localhost:${PORT}/fotos-idealista/app.html`);
  check("título de la herramienta", (await page.textContent("h1")).includes("Fotos para Idealista"));
  check("avisa de que salen sin GPS", (await page.textContent(".privacidad")).includes("sin ubicación GPS"));
  const sinDesborde = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check("sin desbordamiento horizontal a 390 px", await sinDesborde());

  const f = await generarFotos(page);
  check("la foto de prueba con EXIF lo lleva de verdad", tieneExif(f.d));
  await page.click(".ajustes summary");
  await page.fill("#clave", "secreta");
  await page.dispatchEvent("#clave", "change");
  await page.setInputFiles("#archivos", [
    { name: "IMG_0001.JPG", mimeType: "image/jpeg", buffer: f.a },
    { name: "IMG_0002.JPG", mimeType: "image/jpeg", buffer: f.b },
    { name: "IMG_0003.JPG", mimeType: "image/jpeg", buffer: f.c },
    { name: "IMG_0004.JPG", mimeType: "image/jpeg", buffer: f.d },
  ]);
  await page.waitForSelector(".estado-ok", { timeout: 30000 });

  check("la repetida se aparta y quedan 3", (await page.$$("#lista li.foto")).length === 3 && (await page.$$("#apartadas li")).length === 1);
  check("la IA recibe solo las 3 que van, con la clave", peticiones.length === 1 && peticiones[0].fotos.length === 3 && peticiones[0].clave === "secreta");
  const mini = peticiones[0].fotos[0];
  check("la miniatura para la IA es JPEG en base64 y pequeña", mini.media_type === "image/jpeg" && /^[A-Za-z0-9+/=]+$/.test(mini.data) && mini.data.length < 600000);
  const nombres = await page.$$eval(".nombre-archivo", (l) => l.map((x) => x.textContent));
  check("orden recomendado y nombres: salón portada, cocina, dormitorio", nombres.join(" ") === "01-salon.jpg 02-cocina.jpg 03-dormitorio.jpg", nombres.join(" "));
  check("la primera lleva el sello de portada", (await page.textContent("#lista li.foto:first-child")).includes("Portada"));
  const tercera = await page.textContent("#lista li.foto:nth-child(3)");
  check("«Retira: móvil y mandos a distancia.»", tercera.includes("Retira: móvil y mandos a distancia."));
  check("«Puede ser de otro inmueble»", tercera.includes("Puede ser de otro inmueble"));
  check("enlace a /marcadeagua.html para borrar objetos", !!(await page.$('#lista li.foto:nth-child(3) a[href="/marcadeagua.html"]')));
  check("la apartada dice a cuál se parece", (await page.textContent("#apartadas")).includes("Parecida a la foto 2"));
  check("resumen: 3 listas · 1 apartada · sin GPS", (await page.textContent("#resumen")).replace(/\s+/g, " ").includes("3 fotos listas · 1 apartada · sin ubicación GPS"));
  check("sin desbordamiento con fotos a 390 px", await sinDesborde());
  const tactil = await page.$$eval("#lista button, #lista select, #zip", (l) => l.every((b) => b.getBoundingClientRect().height >= 44));
  check("botones y desplegables de 44 px o más", tactil);

  console.log("\n— ZIP —");
  await page.fill("#referencia", "Uría 12 3ºB");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#zip")]);
  check("nombre del ZIP con la referencia", descarga.suggestedFilename() === "uria-12-3b-fotos-idealista.zip", descarga.suggestedFilename());
  const zip = leerZip(await readFile(await descarga.path()));
  check("el ZIP lleva las 3 fotos con sus nombres", zip.map((e) => e.nombre).join(" ") === "01-salon.jpg 02-cocina.jpg 03-dormitorio.jpg", zip.map((e) => e.nombre).join(" "));
  check("todas son JPEG", zip.every((e) => e.datos[0] === 0xff && e.datos[1] === 0xd8));
  check("ninguna lleva EXIF (ni GPS)", zip.every((e) => !tieneExif(e.datos)));
  const dorm = medidasJpeg(zip[2].datos);
  check("la foto con orientación 6 sale girada (300×400)", dorm?.ancho === 300 && dorm?.alto === 400, JSON.stringify(dorm));
  check("no se amplía una foto pequeña (400×300 sigue igual)", JSON.stringify(medidasJpeg(zip[1].datos)) === '{"alto":300,"ancho":400}');

  console.log("\n— reordenar y cambiar estancia —");
  await page.click('#lista li.foto:first-child [data-accion="bajar"]');
  let ns = await page.$$eval(".nombre-archivo", (l) => l.map((x) => x.textContent));
  check("bajar la portada la cambia de sitio y renombra", ns.join(" ") === "01-cocina.jpg 02-salon.jpg 03-dormitorio.jpg", ns.join(" "));
  await page.selectOption("#lista li.foto:nth-child(3) select", "dormitorio_principal");
  ns = await page.$$eval(".nombre-archivo", (l) => l.map((x) => x.textContent));
  check("cambiar la estancia cambia el nombre", ns[2] === "03-dormitorio-principal.jpg", ns[2]);
  await page.click("#ordenar");
  ns = await page.$$eval(".nombre-archivo", (l) => l.map((x) => x.textContent));
  check("«Ordenar como recomienda» vuelve al orden bueno", ns.join(" ") === "01-salon.jpg 02-cocina.jpg 03-dormitorio-principal.jpg", ns.join(" "));
  await page.click('#lista li.foto:nth-child(2) [data-accion="quitar"]');
  check("quitar una foto la aparta", (await page.$$("#lista li.foto")).length === 2 && (await page.textContent("#apartadas")).includes("La has quitado tú"));
  await page.click('#apartadas [data-accion="recuperar"] >> nth=1');
  check("volver a ponerla", (await page.$$("#lista li.foto")).length === 3);

  console.log("\n— retoque apagado —");
  await page.uncheck("#op-retoque");
  await page.waitForFunction(() => !document.querySelector("#progreso:not(.oculto)"));
  check("se vuelven a preparar sin romper nada", (await page.$$("#lista li.foto")).length === 3);
  check("el ajuste se guarda en el aparato", await page.evaluate(() => JSON.parse(localStorage.getItem("fotos-idealista:ajustes")).retoque === false));

  console.log("\n— PC (1366 px) —");
  await page.setViewportSize({ width: 1366, height: 800 });
  check("sin desbordamiento a 1366 px", await sinDesborde());
  const columnas = await page.$eval("#lista", (l) => getComputedStyle(l).gridTemplateColumns.split(" ").length);
  check("rejilla de 3 columnas en PC", columnas === 3, String(columnas));

  console.log("\n— sin IA —");
  const page2 = await ctx.newPage();
  page2.on("pageerror", (e) => erroresPagina.push(e.message));
  await page2.route("**/api/fotos-idealista", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ sin_ia: true, error: "La IA no está configurada (falta ANTHROPIC_API_KEY en Vercel)." }) }));
  await page2.goto(`http://localhost:${PORT}/fotos-idealista/app.html`);
  await page2.setInputFiles("#archivos", [
    { name: "a.jpg", mimeType: "image/jpeg", buffer: f.a },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: f.b },
  ]);
  await page2.waitForSelector(".estado-error", { timeout: 30000 });
  const aviso = await page2.textContent(".estado-error");
  check("avisa de que no hay IA y de que sigue funcionando", aviso.includes("ANTHROPIC_API_KEY") && aviso.includes("sigue funcionando"));
  check("sin estancia, pide elegirla", (await page2.textContent("#lista")).includes("Elige qué estancia es"));
  await page2.selectOption("#lista li.foto:nth-child(1) select", "fachada");
  check("con el desplegable queda bien nombrada", (await page2.textContent("#lista li.foto:nth-child(1) .nombre-archivo")) === "01-fachada.jpg");
  await page2.uncheck("#op-ia");
  check("con la IA apagada lo dice claro", (await page2.textContent("#estado-ia")).includes("La IA está apagada"));

  check("sin errores de JavaScript en la página", erroresPagina.length === 0, erroresPagina.join(" | "));
} catch (e) {
  fallados++;
  console.error("  ❌ excepción:", e);
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${fallados === 0 ? "✅" : "❌"} Fotos para Idealista (Chromium): ${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados === 0 ? 0 : 1);
