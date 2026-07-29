// ============================================================================
//  Test de interfaz de clara.html con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: npm run test:ui
//  No llama a la API real: /api/clara se intercepta y responde en local.
//  Verifica: saludo, los 6 modos, envío y respuesta, formato enriquecido,
//  persistencia tras recargar, panel 🧠 Memoria (y que viaja en la petición),
//  botón copiar y nueva conversación.
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

// /api/clara simulada: guarda cada petición para inspeccionarla.
const peticiones = [];
await page.route("**/api/clara", async (route) => {
  peticiones.push(route.request().postDataJSON());
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ reply: "¡Hecho, Pau! La rentabilidad **bruta** es del `7,96%`. ✅" }),
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

  console.log("\n— persistencia al recargar —");
  await page.reload();
  await page.waitForSelector(".msg.clara .bubble");
  check("la conversación sigue tras recargar", await page.evaluate(() => [...document.querySelectorAll(".msg.clara .bubble")].some((b) => b.textContent.includes("7,96"))));
  check("el modo sigue activo tras recargar", await page.evaluate(() => document.querySelector('.mode[data-mode="inmobiliaria"]').classList.contains("active")));

  console.log("\n— 🧠 memoria —");
  await page.click("#memory");
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
} catch (e) {
  fallados++;
  console.error("  ❌ excepción durante el test:", e.message);
} finally {
  await browser.close();
  server.close();
}

console.log(`\nResultado UI: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
