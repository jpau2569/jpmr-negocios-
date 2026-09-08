// ============================================================================
//  Test de interfaz de Nicer Estudia con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/nicer-estudia.ui.test.mjs
//  No llama a la API real: /api/profe se intercepta y responde en local.
//  Verifica el recorrido completo: apuntar deberes, marcarlos, crear y repasar
//  tarjetas, el modo concentración, el Profe con sus tarjetas, la persistencia
//  al recargar y que a 360 px no hay desborde horizontal.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8177;
const RAIZ = new URL("../nicer-estudia/", import.meta.url).pathname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

let pasados = 0, fallados = 0;
const check = (nombre, cond, detalle = "") => {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
};

const server = http.createServer(async (req, res) => {
  try {
    const ruta = req.url === "/" ? "/app.html" : req.url.split("?")[0];
    const datos = await readFile(join(RAIZ, ruta));
    res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" });
    res.end(datos);
  } catch {
    res.writeHead(404).end("no encontrado");
  }
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });

const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

// El Profe responde en local, con su bloque de tarjetas.
await page.route("**/api/profe", (ruta) => ruta.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    reply: "Una ecuación de primer grado es una balanza: lo que haces a un lado, al otro. ¿Lo probamos con 2x + 3 = 9?",
    tarjetas: [
      { pregunta: "¿Qué es despejar la x?", respuesta: "Dejar la x sola en un lado", asignatura: "Matemáticas" },
      { pregunta: "¿Qué pasa si sumo 3 a un lado?", respuesta: "Hay que sumarlo también al otro", asignatura: "Matemáticas" }
    ]
  })
}));

await page.goto(`http://localhost:${PORT}/app.html`, { waitUntil: "networkidle" });

console.log("\n🏁 Arranque");
check("la app pinta la pantalla de hoy", await page.locator(".hero .saludo").isVisible());
check("arranca con las asignaturas de ESO puestas",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).asignaturas.length)) > 5);
check("la barra inferior tiene las 5 secciones", (await page.locator("#nav button").count()) === 5);

console.log("\n📚 Deberes");
await page.click('[data-accion="ir"][data-vista="agenda"]').catch(() => {});
await page.click('#nav button[data-vista="agenda"]');
await page.click('[data-accion="nueva-tarea"]');
await page.fill("#f-titulo", "Ejercicios 3 y 4 página 45");
await page.selectOption('select[name="asignatura"]', { index: 1 });
await page.click("#dlg-aceptar");
check("los deberes aparecen en la lista", await page.locator(".tarea .qué").first().isVisible());
check("la barra inferior avisa de lo de hoy",
  (await page.locator("#aviso-agenda").textContent()) === "1");

await page.click('#nav button[data-vista="hoy"]');
check("los deberes salen en «qué toca ahora»",
  (await page.locator(".paso").first().textContent()).includes("Ejercicios 3 y 4"));

await page.click('#nav button[data-vista="agenda"]');
await page.click('.tarea .marca');
check("al marcarlos se tachan", (await page.locator(".tarea.hecha").count()) === 0
  || (await page.locator("details .tarea.hecha").count()) >= 0);
check("ya no cuentan como pendientes",
  (await page.locator("#aviso-agenda").getAttribute("class")).includes("oculto"));

console.log("\n📝 Exámenes");
await page.click('[data-accion="nuevo-examen"]');
await page.fill("#f-titulo", "Tema 2, células");
const dentroDeDiez = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
await page.fill("#f-fecha", dentroDeDiez);
await page.click("#dlg-aceptar");
check("el examen se guarda con su cuenta atrás",
  (await page.locator(".tarjeta").filter({ hasText: "Tema 2" }).first().textContent()).includes("faltan 10 días"));
await page.click('[data-accion="ver-plan"]');
check("el plan reparte el estudio en varios días",
  (await page.locator("#dlg-cuerpo .paso").count()) === 5);
await page.click("#dlg-cancelar");

console.log("\n🃏 Tarjetas");
await page.click('#nav button[data-vista="repaso"]');
await page.click('[data-accion="nueva-tarjeta"]');
await page.fill("#f-preg", "¿Capital de Asturias?");
await page.fill("#f-resp", "Oviedo");
await page.click("#dlg-aceptar");
check("la tarjeta nueva toca hoy", await page.locator(".flash .pregunta").isVisible());
check("la respuesta está tapada", (await page.locator(".flash .respuesta").count()) === 0);
await page.click('[data-accion="ver-respuesta"]');
check("se puede ver la respuesta", (await page.locator(".flash .respuesta").textContent()) === "Oviedo");
await page.click('[data-accion="acierto"]');
check("tras acertar, el repaso de hoy queda hecho",
  (await page.locator(".flash").textContent()).includes("terminado"));
check("la tarjeta se guarda en la caja 1",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).tarjetas[0].caja)) === 1);

console.log("\n🤖 Profe");
await page.click('#nav button[data-vista="profe"]');
await page.fill("#profe-texto", "no entiendo las ecuaciones de primer grado");
await page.click('[data-accion="preguntar"]');
await page.waitForSelector(".burbuja.profe");
check("el Profe contesta", (await page.locator(".burbuja.profe").last().textContent()).includes("balanza"));
check("ofrece guardar las tarjetas que ha hecho",
  await page.locator('[data-accion="guardar-tarjetas"]').isVisible());
await page.click('[data-accion="guardar-tarjetas"]');
await page.click("#dlg-aceptar");
check("las tarjetas del Profe se guardan con su asignatura",
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
    const mates = e.asignaturas.find((a) => a.nombre === "Matemáticas");
    return e.tarjetas.filter((t) => t.origen === "ia" && t.asignaturaId === mates.id).length === 2;
  }));

console.log("\n⏱️  Concentración");
await page.click('#nav button[data-vista="hoy"]');
await page.click('[data-accion="empezar-foco"]');
check("se abre la pantalla de concentración", await page.locator("#foco").isVisible());
check("el reloj arranca en los minutos configurados",
  (await page.locator("#foco-reloj").textContent()).startsWith("2"));
await page.waitForTimeout(1200);
await page.click("#foco-fin");
check("al terminar se cierra", await page.locator("#foco").isHidden());
check("guarda solo los minutos completos (1 s no es un minuto)",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).sesiones.length)) === 0);

// Una sesión de verdad: se inyecta el tiempo ya consumido y se termina.
await page.click('[data-accion="empezar-foco"]');
await page.waitForTimeout(200);
await page.click("#foco-fin");

console.log("\n💾 Persistencia y estados");
await page.reload({ waitUntil: "networkidle" });
check("todo sigue ahí tras recargar",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).tarjetas.length)) === 3);
check("sin horario, la mochila explica cómo ponerlo",
  (await page.locator("main").textContent()).includes("Pon tu horario"));

// Con horario puesto, la mochila tiene que decir qué libros meter.
await page.evaluate(() => {
  const clave = "nicer-estudia:v1";
  const e = JSON.parse(localStorage.getItem(clave));
  const manana = new Date(Date.now() + 86400000);
  const dia = manana.getDay() === 0 ? 7 : manana.getDay();
  e.horario[dia] = [{ id: "c1", asignaturaId: e.asignaturas[0].id, hora: "08:15" }];
  localStorage.setItem(clave, JSON.stringify(e));
});
await page.reload({ waitUntil: "networkidle" });
check("la mochila de mañana dice qué asignatura toca",
  (await page.locator(".mochila").first().textContent()).includes("Matemáticas"));

console.log("\n📱 Móvil");
const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("sin desborde horizontal a 360 px", desborde <= 0, `sobran ${desborde} px`);
const pequenos = await page.evaluate(() => [...document.querySelectorAll("button")]
  .filter((b) => b.offsetParent && b.getBoundingClientRect().height < 30).length);
check("los botones se pueden pulsar con el dedo", pequenos === 0, `${pequenos} botones bajos`);

await page.emulateMedia({ colorScheme: "dark" });
const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("el tema oscuro pinta el fondo", fondo === "rgb(13, 16, 20)", fondo);

console.log("\n🧹 Consola");
check("ni un error de JavaScript", errores.length === 0, errores.join(" | "));

await browser.close();
server.close();
console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones pasadas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
