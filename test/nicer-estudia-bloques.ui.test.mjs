// ============================================================================
//  Nicer Estudia — bloques de 15 minutos en un Chromium real, con el reloj
//  adelantado: comprueba que a los 15 min avisa del cambio de asignatura.
//  Ejecutar con: node test/nicer-estudia-bloques.ui.test.mjs
// ============================================================================
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

let pasados = 0, fallados = 0;
const check = (n, c) => { if (c) { pasados++; console.log(`  ✅ ${n}`); } else { fallados++; console.error(`  ❌ ${n}`); } };
const RAIZ = new URL("..", import.meta.url).pathname;
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const srv = http.createServer(async (q, r) => {
  try { const p = decodeURIComponent(q.url.split("?")[0]); const b = await readFile(join(RAIZ, p)); r.writeHead(200, { "content-type": TIPOS[extname(p)] || "application/octet-stream" }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const URL_APP = `http://localhost:${srv.address().port}/nicer-estudia/app.html`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
// Lunes 5 de octubre de 2026 a las 17:00 (hoy lunes, mañana martes).
await page.clock.install({ time: new Date(2026, 9, 5, 17, 0, 0) });
await page.goto(URL_APP);
await page.evaluate(() => {
  const clave = "nicer-estudia:v1";
  const e = JSON.parse(localStorage.getItem(clave) || "{}");
  e.asignaturas = [
    { id: "m", nombre: "Matemáticas", color: "#1a6a90" }, { id: "l", nombre: "Lengua Castellana", color: "#b4472c" },
    { id: "f", nombre: "Física y Química", color: "#0f6f7a" }, { id: "t", nombre: "Tutoría", color: "#57606a" }];
  e.horario = { 1: [{ id: "c1", asignaturaId: "f", hora: "08:30" }, { id: "c2", asignaturaId: "m", hora: "09:30" }],
                2: [{ id: "c3", asignaturaId: "l", hora: "08:30" }, { id: "c4", asignaturaId: "t", hora: "13:45" }] };
  e.examenes = [{ id: "x", titulo: "Ecuaciones", asignaturaId: "m", fecha: "2026-10-08", temas: "", leccionIds: [], nota: null }];
  e.ajustes = { ...(e.ajustes || {}), pomodoro: 25 }; delete e.ajustes.bloque; // un móvil con lo de antes
  localStorage.setItem(clave, JSON.stringify(e));
});
await page.reload();

console.log("\n🔁 Bloques de estudio");
const hoy = await page.locator("main").textContent();
check("Hoy enseña el plan de la sesión antes de empezar", (await page.locator(".bloque-plan").count()) === 2);
check("el móvil que tenía 25 min pasa a 30", (await page.locator('[data-accion="empezar-foco"]').textContent()).includes("30 minutos"));
check("primero el examen del jueves", (await page.locator(".bloque-plan").first().textContent()).includes("Matemáticas")
  && hoy.includes("Examen el jueves"));
await page.click('[data-accion="empezar-foco"]');
check("al empezar dice qué asignatura y qué hacer", (await page.locator("#foco-bloque").textContent()).includes("Matemáticas")
  && (await page.locator("#foco-que").textContent()) === "Bloque 1 de 2");
check("y cuándo cambia", (await page.locator("#foco-siguiente").textContent()).startsWith("Luego Lengua Castellana en 1"));
await page.clock.runFor(15 * 60 * 1000 + 2000);
check("a los 15 minutos avisa del cambio", (await page.locator("#foco-bloque.cambio").count()) === 1
  && (await page.locator("#foco-bloque").textContent()).includes("¡Cambio de asignatura!"));
check("y pasa a la siguiente asignatura", (await page.locator("#foco-bloque .bloque-asig").textContent()).includes("Lengua Castellana")
  && (await page.locator("#foco-que").textContent()) === "Bloque 2 de 2");
await page.clock.runFor(9000);
check("el aviso grande se quita solo", (await page.locator("#foco-bloque.cambio").count()) === 0);
await page.click('[data-accion="cambiar-bloque"]');
check("«Otra asignatura» la cambia", (await page.locator("#foco-bloque .bloque-asig").textContent()).includes("Física y Química"));
await page.clock.runFor(15 * 60 * 1000);
check("al acabar los 30 min llega el descanso", await page.locator("#foco.descanso").isVisible());
const sesiones = await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).sesiones);
check("cada asignatura se apunta sus minutos", sesiones.length === 2 && sesiones[0].asignaturaId === "m" && sesiones[0].minutos === 15
  && sesiones[1].asignaturaId === "f" && sesiones[1].minutos === 15);
check("sin errores de JavaScript", errores.length === 0);

await browser.close(); srv.close();
console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones pasadas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
