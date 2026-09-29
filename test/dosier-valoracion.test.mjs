// ============================================================================
//  Tests del Dosier de valoración 3D — se ejecutan con: node test/dosier-valoracion.test.mjs
// ----------------------------------------------------------------------------
//  1. Lógica pura en Node: el cálculo (reutiliza cerebro/valoracion.js), la
//     regla de oro (sin comparables suficientes no hay cifra) y los datos.
//  2. Interfaz en un Chromium real: la escena 3D con Three.js servido desde
//     node_modules, el respaldo 2D sin CDN, móvil sin scroll horizontal,
//     el aviso de borrador y que el texto del JSON se escapa.
//  Si Playwright o three no están instalados, la parte 2 se salta avisando.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { construirDosier, ritmoSemanal, miles, euros, fechaLarga } from "../dosier-valoracion/calculo.js";
import { calculaValoracion } from "../cerebro/valoracion.js";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const RAIZ = new URL("..", import.meta.url).pathname;
const datos = JSON.parse(await readFile(join(RAIZ, "dosier-valoracion/datos/pis0212.json"), "utf8"));

/* ========================================================================== */
console.log("\n🧮 Cálculo");

check("miles() pone el punto también en 4 cifras", miles(1837) === "1.837" && miles(180000) === "180.000" && euros(204500) === "204.500 €");
check("fechaLarga en español", fechaLarga("2026-09-29") === "29 de septiembre de 2026" && fechaLarga("basura") === "");

const m = construirDosier(datos);
check("los 4 comparables del JSON son válidos", m.calculo.n === 4 && m.calculo.descartados.length === 0);
check("hay rango (≥3 comparables y superficie)", m.calculo.suficiente && m.calculo.valor.bajo < m.calculo.valor.central && m.calculo.valor.central < m.calculo.valor.alto);
check("el rango sale del método de Cerebro y no de otra cuenta",
  JSON.stringify(m.calculo.valor) === JSON.stringify(calculaValoracion(datos.comparables, datos.inmueble.m2Construidos).valor));
check("cifras esperadas con los ajustes provisionales (193.500 / 204.500 / 225.500)",
  m.calculo.valor.bajo === 193500 && m.calculo.valor.central === 204500 && m.calculo.valor.alto === 225500, JSON.stringify(m.calculo.valor));
check("el €/m² publicado es 180.000 / 98", Math.abs(m.eurM2Publicado - 180000 / 98) < 1e-9);
check("el precio publicado cae por debajo del rango", m.posicion?.lugar === "debajo" && m.posicion.diferenciaConBajo === 180000 - 193500);
check("el método no habla de un precio de zona que el dosier no enseña", m.metodologia.length > 100 && !/precio medio de la zona/.test(m.metodologia));
check("la bajada de precio sale de 198.000 a 180.000 (−18.000 €, −9,1 %)", m.bajada?.diferencia === 18000 && m.bajada.anterior === 198000 && Math.abs(m.bajada.porcentaje - 9.0909) < 0.001);
check("el historial tiene 3 precios (198/190/180) y las visitas 5 y 12", JSON.stringify(datos.inmueble.historialPrecios.map((h) => [h.precio, h.visitas])) === "[[198000,null],[190000,5],[180000,12]]" && m.bajada.escalones === 3);
check("el ritmo a 190.000 es 5 visitas en 30 días ≈ 1,17/semana", Math.abs(m.ritmo.antes - 5 / 30 * 7) < 1e-9);
check("el ritmo a 180.000 es 12 visitas en 20 días = 4,2/semana", Math.abs(m.ritmo.ahora - 4.2) < 1e-9);
check("el ritmo se multiplica por 3,6 al bajar a 180.000", Math.abs(m.ritmo.veces - 3.6) < 1e-9 && m.ritmo.precioAntes === 190000);
check("el JSON recoge que no hay ofertas y que a 198.000 no hubo aceptación", datos.mercado.ofertas === 0 && /Sin aceptación/.test(datos.inmueble.historialPrecios[0].nota));
check("sin días no se inventa ritmo (tramo de 198.000 sin datos)", ritmoSemanal(datos.inmueble.historialPrecios[0]) === null && ritmoSemanal({ visitas: 5, dias: 0 }) === null && ritmoSemanal({ visitas: null, dias: 20 }) === null);
check("sin historial ni precio anterior no se inventa ninguna bajada", construirDosier({ ...datos, inmueble: { ...datos.inmueble, historialPrecios: undefined } }).bajada === null);
check("la muestra de 4 se marca como reducida", m.avisos.some((a) => a.nivel === "medio" && /reducida/.test(a.texto)));
check("mientras `validado` sea false sale el aviso de BORRADOR", m.borrador && m.avisos.some((a) => a.nivel === "borrador"));
check("con `validado: true` desaparece el borrador", !construirDosier({ ...datos, validado: true }).borrador);
check("sin certificado energético se avisa", m.avisos.some((a) => /certificado energético/i.test(a.texto)));
check("hay una torre por comparable + publicado + valor central", m.torres.length === 6 && m.torres.some((t) => t.id === "publicado") && m.torres.some((t) => t.id === "central"));
check("las torres de comparables van ordenadas de menor a mayor €/m²",
  m.torres.filter((t) => t.tipo === "comparable").every((t, i, a) => i === 0 || a[i - 1].eurM2 <= t.eurM2));
check("el ajuste se aplica: PIS0177 baja un 10 %",
  Math.abs(m.torres.find((t) => t.id === "PIS0177").eurM2 - (169000 / 75) * 0.9) < 1e-9);

// Regla de oro: con menos de 3 comparables NO hay cifra.
const pocos = construirDosier({ ...datos, comparables: datos.comparables.slice(0, 2) });
check("con 2 comparables no se da ningún precio", !pocos.calculo.suficiente && !pocos.calculo.valor && pocos.calculo.faltan === 1 && pocos.posicion === null);
check("y el dosier lo dice", pocos.avisos.some((a) => a.nivel === "alto" && /faltan 1/.test(a.texto)));
const sinM2 = construirDosier({ ...datos, inmueble: { ...datos.inmueble, m2Construidos: 0 } });
check("sin superficie del inmueble tampoco hay cifra", !sinM2.calculo.valor);
const vacio = construirDosier({});
check("un JSON vacío no revienta", vacio.torres.length === 0 && !vacio.calculo.suficiente);

/* ========================================================================== */
console.log("\n📄 Datos del piso");

check("referencia y precio publicado tal como están en la web", datos.inmueble.ref === "PIS0212" && datos.inmueble.precioPublicado === 180000);
check("superficie 98 construidos / 87 útiles", datos.inmueble.m2Construidos === 98 && datos.inmueble.m2Utiles === 87);
check("el certificado energético no se inventa: null hasta confirmarlo", datos.inmueble.certificadoEnergetico === null);
check("los pendientes incluyen dirección, energético, comunidad e IBI",
  ["Dirección", "Certificado energético", "comunidad", "IBI"].every((k) => datos.pendientes.some((p) => p.includes(k))));
check("ids de comparables únicos y con su enlace a la ficha",
  new Set(datos.comparables.map((c) => c.id)).size === datos.comparables.length && datos.comparables.every((c) => /^https:\/\/www\.asesoriacastresana\.com\//.test(c.url)));
check("cada ajuste distinto de cero lleva su motivo escrito", datos.comparables.every((c) => !c.ajuste || (c.motivoAjuste || "").length > 10));
check("las fotos son https", datos.fotos.length >= 3 && datos.fotos.every((f) => f.startsWith("https://")));

/* ========================================================================== */
//  Parte 2: navegador real
/* ========================================================================== */

let chromium = null;
try { ({ chromium } = await import("playwright")); }
catch { console.log("\n⚠️  Playwright no está instalado: me salto los tests de interfaz."); }

let three = null, orbit = null;
try {
  three = await readFile(join(RAIZ, "node_modules/three/build/three.module.js"), "utf8");
  orbit = await readFile(join(RAIZ, "node_modules/three/examples/jsm/controls/OrbitControls.js"), "utf8");
} catch { /* sin three */ }

if (chromium) {
  console.log("\n🌐 Interfaz en Chromium");
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };
  const servidor = http.createServer(async (req, res) => {
    let ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta.endsWith("/")) ruta += "index.html";
    try {
      const d = await readFile(join(RAIZ, ruta));
      res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" }).end(d);
    } catch { res.writeHead(404).end("no encontrado"); }
  });
  await new Promise((ok) => servidor.listen(8131, ok));
  const BASE = "http://127.0.0.1:8131/dosier-valoracion/";
  const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  // Las fotos vienen de fuera: se sirven como PNG vacío para no depender de Internet.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  async function contextoCon(ancho, alto, { conThree = true, jsonExtra = null } = {}) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    await ctx.route("**storage.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
    if (conThree && three) {
      await ctx.route("**unpkg.com/three@*/build/three.module.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: three }));
      await ctx.route("**unpkg.com/three@*/examples/jsm/controls/OrbitControls.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: orbit }));
    } else {
      await ctx.route("**unpkg.com/**", (r) => r.abort());
    }
    if (jsonExtra) await ctx.route("**/datos/pis0212.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jsonExtra) }));
    return ctx;
  }

  /* --- Escritorio con 3D --- */
  if (three) {
    const ctx = await contextoCon(1280, 900);
    const p = await ctx.newPage();
    const errores = [];
    p.on("pageerror", (e) => errores.push(String(e)));
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForSelector("#escena canvas", { timeout: 8000 }).catch(() => {});
    check("el título de la portada es el del piso", (await p.textContent("h1")).includes("Piso luminoso con garaje en Oviedo"));
    check("el aviso de BORRADOR está visible", await p.locator("#aviso-borrador").isVisible());
    check("se pinta el lienzo 3D", (await p.locator("#escena canvas").count()) === 1);
    check("hay una etiqueta por torre (6)", (await p.locator("#escena .tag3d").count()) === 6);
    check("no cae al respaldo 2D", (await p.locator(".barras2d").count()) === 0);
    const antes = await p.textContent("#detalle3d");
    await p.locator("#escena .tag3d", { hasText: "PIS0177" }).dispatchEvent("click");
    const despues = await p.textContent("#detalle3d");
    check("tocar una etiqueta cambia el detalle", antes !== despues && despues.includes("PIS0177") && despues.includes("reformado"), despues);
    check("el detalle enseña el ajuste antes y después", /2\.253/.test(despues) && /2\.028/.test(despues), despues);
    const pixeles = await p.evaluate(() => {
      const c = document.querySelector("#escena canvas");
      const t = document.createElement("canvas"); t.width = 64; t.height = 64;
      const g = t.getContext("2d"); g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      let distintos = 0; for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) distintos++;
      return distintos;
    });
    check("el lienzo 3D tiene algo dibujado (no está en blanco)", pixeles > 100, `píxeles distintos: ${pixeles}`);
    const txt = await p.textContent("#valoracion");
    check("la valoración enseña el rango calculado", txt.includes("193.500") && txt.includes("225.500") && txt.includes("204.500"), txt.slice(0, 200));
    check("el resumen enseña el precio publicado, el anterior y el veredicto «por debajo»", (await p.textContent("#resumen")).includes("180.000") && (await p.textContent("#resumen")).includes("198.000") && (await p.textContent("#resumen")).includes("por debajo"));
    check("la galería tiene las fotos del JSON", (await p.locator(".galeria img").count()) === datos.fotos.length);
    check("el resumen enseña el historial con 12 visitas a 180.000 y 5 a 190.000", (await p.locator(".historia li").count()) === 3 && (await p.textContent(".historia")).includes("12 visitas") && (await p.textContent(".historia")).includes("5 visitas") && (await p.textContent(".historia")).includes("3,6 veces") && (await p.textContent(".historia")).includes("Sin aceptación") && (await p.textContent("#resumen")).includes("no ha llegado ninguna oferta") && (await p.textContent("#resumen")).includes("Lo que ha dicho el mercado"));
    check("aparece el aviso legal y el contacto", (await p.textContent("#pendientes")).includes("No es una tasación oficial") && (await p.textContent("footer")).includes("985 210 468"));
    check("sin errores de JavaScript en la página", errores.length === 0, errores.join(" | "));
    await p.emulateMedia({ media: "print" });
    check("en impresión desaparecen etiquetas y botones", !(await p.locator("#imprimir").isVisible()) && !(await p.locator(".tag3d").first().isVisible()));
    await ctx.close();
  } else {
    console.log("  ⚠️  Sin three en node_modules: me salto la escena 3D.");
  }

  /* --- Sin CDN: respaldo 2D --- */
  {
    const ctx = await contextoCon(1280, 900, { conThree: false });
    const p = await ctx.newPage();
    const errores = [];
    p.on("pageerror", (e) => errores.push(String(e)));
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForSelector(".barras2d", { timeout: 8000 }).catch(() => {});
    check("sin Three.js se dibujan las barras 2D con las 6 barras", (await p.locator(".barra2d").count()) === 6);
    check("y la tabla de comparables sigue ahí", (await p.locator("#mercado table tbody tr").count()) >= 6);
    check("sin CDN tampoco hay errores de JavaScript", errores.length === 0, errores.join(" | "));
    await ctx.close();
  }

  /* --- Móvil: sin scroll horizontal --- */
  {
    const ctx = await contextoCon(390, 800, { conThree: !!three });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    const { ancho, visible } = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: window.innerWidth }));
    check("a 390 px no hay scroll horizontal", ancho <= visible, `${ancho} > ${visible}`);
    await ctx.close();
  }

  /* --- Validado y seguridad --- */
  {
    const malo = JSON.parse(JSON.stringify(datos));
    malo.validado = true;
    malo.inmueble.titulo = 'Piso <img src=x onerror="window.__xss=1"> bonito';
    malo.comparables[0].ficha = '<script>window.__xss=1</script>';
    malo.pendientes = ['<b id="inyectado">x</b>'];
    const ctx = await contextoCon(1280, 900, { conThree: false, jsonExtra: malo });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: "networkidle" });
    check("con `validado: true` el aviso de borrador se oculta", !(await p.locator("#aviso-borrador").isVisible()));
    check("el HTML metido en el JSON se escapa y no se ejecuta", (await p.evaluate(() => window.__xss)) === undefined && (await p.locator("#inyectado").count()) === 0);
    check("el texto escapado se ve tal cual", (await p.textContent("h1")).includes("<img"));
    await ctx.close();
  }

  {
    const ctx = await contextoCon(1280, 900, { conThree: false });
    const p = await ctx.newPage();
    await p.goto(BASE + "?p=../../etc/passwd", { waitUntil: "networkidle" });
    check("una referencia con rutas raras se rechaza", (await p.textContent("#contenido")).includes("no válida"));
    await p.goto(BASE + "?p=noexiste", { waitUntil: "networkidle" });
    check("una referencia que no existe da un mensaje claro", (await p.textContent("#contenido")).includes("No se encuentra"));
    await ctx.close();
  }

  await navegador.close();
  servidor.close();
}

console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones correctas, ${fallados} falladas.`);
process.exit(fallados ? 1 : 0);
