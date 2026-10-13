// ============================================================================
//  Prueba de interfaz de cloudflare/castresana-web en Chromium real — npm run test:ui
//  Sirve el Worker con herramientas/probar-en-local.mjs (D1 sobre SQLite) y
//  recorre /valora, /visitas y /panel a 360 px (móvil) y a 1366 px (PC):
//  sin scroll lateral, áreas táctiles ≥ 44 px, sin errores de CSP en consola.
// ============================================================================
import { chromium } from "playwright";
import { servidorLocal } from "../cloudflare/castresana-web/herramientas/probar-en-local.mjs";
import { creaD1, creaAssets } from "../cloudflare/castresana-web/herramientas/d1-local.mjs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const CLAVE = "clave-de-la-prueba-de-interfaz";
const db = creaD1();
db._base.prepare("INSERT INTO inmuebles (referencia, titulo, zona, enlace, activo, actualizado) VALUES (?, ?, ?, ?, 1, ?)")
  .run("PIS0190", "Piso en Uría", "Centro", "https://www.asesoriacastresana.com/", new Date().toISOString());
const env = { DB: db, ASSETS: creaAssets(), PANEL_CLAVE: CLAVE };
const servidor = servidorLocal({ env });
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${servidor.address().port}`;

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function sinScrollLateral(pagina) {
  return pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}
// Elementos que se tocan: tienen que medir al menos 44 px de alto.
async function tactilesPequenos(pagina) {
  return pagina.evaluate(() => {
    const sel = "button, select, input[type=text], input[type=tel], input[type=email], input[type=password], input[type=date], input[type=time], textarea, a.boton, .opcion, .casilla label, .pestanas a";
    return [...document.querySelectorAll(sel)]
      .filter((el) => el.offsetParent !== null && !el.closest(".trampa"))
      .map((el) => ({ el: el.tagName + (el.id ? "#" + el.id : el.className ? "." + el.className : ""), alto: el.getBoundingClientRect().height }))
      .filter((x) => x.alto < 44);
  });
}

async function recorrido(ancho) {
  console.log(`\n📱 ${ancho} px`);
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 800 }, deviceScaleFactor: 2, hasTouch: ancho < 500, locale: "es-ES" });
  const p = await contexto.newPage();
  const errores = [];
  // Se ignoran solo los 422 (envío vacío, a propósito) y 401 (pantalla de entrar
  // al panel); cualquier otro error, y en especial los de CSP («Refused to…»), cuenta.
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource: .*status of (422|401)/.test(m.text())) errores.push(m.text()); });
  p.on("pageerror", (e) => errores.push(String(e)));

  // ---- Valora tu piso ----
  await p.goto(`${BASE}/valora`);
  check("/valora carga con el logo", (await p.locator(".marca img").evaluate((i) => i.naturalWidth)) > 0);
  check("/valora sin scroll lateral", await sinScrollLateral(p));
  const pequenos = await tactilesPequenos(p);
  check("/valora: todo lo táctil mide 44 px o más", pequenos.length === 0, JSON.stringify(pequenos));
  check("todos los campos tienen etiqueta", await p.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]):not(#web), select, textarea")].every((el) => el.labels && el.labels.length > 0)));

  await p.click("button[type=submit]");
  await p.waitForSelector("#resumen-errores");
  check("enviar vacío muestra los errores y les da el foco", await p.evaluate(() => document.activeElement?.id === "resumen-errores"));
  check("con errores tampoco hay scroll lateral", await sinScrollLateral(p));

  await p.fill("#nombre", "Ana Pérez");
  await p.fill("#telefono", "600 11 22 33");
  await p.click("label.opcion:has-text('Vender')");
  await p.selectOption("#tipo", "piso");
  await p.fill("#zona", "Calle Uría, Oviedo");
  await p.fill("#metros", "85");
  await p.check("#privacidad");
  await Promise.all([p.waitForLoadState("load"), p.click("button[type=submit]")]);
  const gracias = await p.textContent("main");
  check("al enviar dice que Pau llamará (sin precio)", /Pau te llamará al 600 11 22 33/.test(gracias) && !/€/.test(gracias));

  // ---- Visitas ----
  await p.goto(`${BASE}/visitas`);
  check("/visitas sin scroll lateral", await sinScrollLateral(p));
  await p.selectOption("#ref", "PIS0190");
  const primerDia = await p.locator("#fecha option").nth(1).getAttribute("value");
  await Promise.all([p.waitForURL(/fecha=/), p.selectOption("#fecha", primerDia)]);
  check("al elegir el día se cargan solas las horas libres", (await p.locator("input[name=fecha_hora]").count()) > 0);
  check("paso de la hora sin scroll lateral", await sinScrollLateral(p));
  const pequenos2 = await tactilesPequenos(p);
  check("/visitas: todo lo táctil mide 44 px o más", pequenos2.length === 0, JSON.stringify(pequenos2));
  await p.locator("label.opcion").first().click();
  await p.fill("#nombre", "Luis Gómez");
  await p.fill("#telefono", "611223344");
  await p.check("#privacidad");
  await Promise.all([p.waitForLoadState("load"), p.click("#reservar button[type=submit]")]);
  const confirmacion = await p.textContent("main");
  check("la reserva se recibe sin darla por confirmada («Reserva recibida», «Pau te confirmará la visita»)",
    confirmacion.includes("Reserva recibida") && confirmacion.includes("Pau te confirmará la visita") && !/te esperamos/i.test(confirmacion));
  check("la página de reserva recibida no tiene scroll lateral", await sinScrollLateral(p));

  // ---- Panel ----
  await p.goto(`${BASE}/panel`);
  await p.fill("#clave", CLAVE);
  await Promise.all([p.waitForURL(`${BASE}/panel`), p.click("button[type=submit]")]);
  check("se entra al panel y se ve la valoración", (await p.textContent("main")).includes("Ana Pérez"));
  check("panel sin scroll lateral", await sinScrollLateral(p));
  check("el enlace de WhatsApp está preparado (no envía nada solo)", (await p.locator("a.whatsapp").first().getAttribute("href")).startsWith("https://wa.me/34600112233?text="));
  const pequenosVal = await tactilesPequenos(p);
  check("valoraciones (con «Borrar datos»): todo lo táctil mide 44 px o más", pequenosVal.length === 0, JSON.stringify(pequenosVal));
  // Derecho de supresión: si se cancela el aviso, no se borra nada.
  const antesVal = await p.locator("form.borrar-datos").count();
  p.once("dialog", (d) => d.dismiss());
  await p.locator("form.borrar-datos button").first().click();
  await p.waitForTimeout(300);
  check("«Borrar datos» pide confirmación y, si dices que no, no borra", (await p.locator("form.borrar-datos").count()) === antesVal && antesVal > 0);
  await p.click(".pestanas a:has-text('Visitas')");
  check("las visitas del día aparecen", (await p.textContent("main")).includes("Luis Gómez"));
  check("panel de visitas sin scroll lateral", await sinScrollLateral(p));
  const pequenos3 = await tactilesPequenos(p);
  check("panel: todo lo táctil mide 44 px o más", pequenos3.length === 0, JSON.stringify(pequenos3));
  p.once("dialog", (d) => d.accept());
  await Promise.all([p.waitForURL(/ok=cancelada/), p.locator("button:has-text('Cancelar visita')").first().click()]);
  check("cancelar pide confirmación y libera el hueco", (await p.textContent("main")).includes("Visita cancelada"));
  // Y ahora se borra del todo (derecho de supresión).
  const pequenosBorrar = await tactilesPequenos(p);
  check("panel de visitas (cancelada con «Borrar datos»): todo lo táctil mide 44 px o más", pequenosBorrar.length === 0, JSON.stringify(pequenosBorrar));
  const contraste = await p.evaluate(() => {
    const b = document.querySelector(".ficha.cancelada form.borrar-datos button");
    if (!b) return null;
    let el = b, op = 1;
    while (el) { op *= Number(getComputedStyle(el).opacity); el = el.parentElement; }
    return { op, color: getComputedStyle(b).color };
  });
  check("el botón «Borrar datos» de una visita cancelada no sale apagado (opacidad 1, rojo)", contraste && contraste.op === 1 && contraste.color === "rgb(164, 22, 26)", JSON.stringify(contraste));
  p.once("dialog", (d) => d.accept());
  await Promise.all([p.waitForURL(/ok=visita-borrada/), p.locator(".ficha.cancelada form.borrar-datos button").first().click()]);
  const trasBorrar = await p.textContent("main");
  check("«Borrar datos» quita la visita del panel y recuerda Telegram", trasBorrar.includes("Visita borrada del todo") && trasBorrar.includes("bórralo también allí a mano") && !trasBorrar.includes("Luis Gómez"));

  check("ningún error en consola (ni de CSP)", errores.length === 0, errores.join(" | "));
  await contexto.close();
}

try {
  await recorrido(360);
  await recorrido(1366);
} finally {
  await navegador.close();
  servidor.close();
}

console.log(`\n${fallados ? "❌" : "✅"} cloudflare-web (interfaz): ${pasados} correctas, ${fallados} fallidas\n`);
if (fallados) process.exit(1);
