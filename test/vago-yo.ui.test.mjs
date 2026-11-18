// ============================================================================
//  Vago Yo en un navegador real (Chromium + Playwright) — fase 1
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/vago-yo.ui.test.mjs  [--capturas <carpeta>]
//  Recorrido: foto de ejemplo → confirmar el signo → fallo → pista → segundo
//  intento → repaso programado → resumen familiar. Además: las otras cinco
//  asignaturas, «Explícame», «Hablar» sin dictado, sin conexión, y que el
//  tutor no hace NINGUNA petición de red.
// ============================================================================

import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const PORT = 8179;
const RAIZ = new URL("../nicer-estudia/", import.meta.url).pathname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };
const iCap = process.argv.indexOf("--capturas");
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;
if (CAPTURAS) await mkdir(CAPTURAS, { recursive: true });

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
  } catch { res.writeHead(404).end("no"); }
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctxNav = await browser.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: "block" });
const page = await ctxNav.newPage();
// Sin dictado: así se prueba el camino de «escribe».
await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/status of 503/.test(m.text())) errores.push(m.text()); }); // el 503 lo simula la prueba
const peticionesApi = [];
page.on("request", (r) => { if (r.url().includes("/api/")) peticionesApi.push(r.url()); });

const foto = async (nombre) => { if (CAPTURAS) await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true }); };
const texto = () => page.locator("#vista").innerText();
const alInicio = async () => {
  const atras = page.locator('[data-accion="tutor-ir"][data-pantalla="inicio"]');
  if (await atras.count()) await atras.first().click();
  else await page.click('[data-accion="ir"][data-vista="tutor"]');
};

await page.goto(`http://localhost:${PORT}/app.html`, { waitUntil: "networkidle" });

console.log("\n🏠 Entrada");
check("Hoy tiene la tarjeta de Vago Yo", await page.locator('[data-vista="tutor"]').first().isVisible());
await page.click('[data-accion="ir"][data-vista="tutor"]');
let t = await texto();
check("inicio: Subir ejercicio, Explícame, Repasar, Hablar", ["Subir ejercicio", "Explícame", "Repasar", "Hablar"].every((x) => t.includes(x)));
check("dice que aún no hay IA y que el progreso se guarda en el móvil", /Sin IA todavía/.test(t) && /se guarda en este móvil/.test(t));
check("no ofrece «Seguir donde lo dejé» sin sesión", !t.includes("Seguir donde lo dejé"));
check("las seis asignaturas están", (await page.locator('[data-accion="tutor-asignatura"]').count()) === 6);
await foto("01-inicio");

console.log("\n📷 Foto de ejemplo → confirmar el signo");
await page.click('[data-pantalla="subir"]');
await page.click('[data-accion="tutor-foto"][data-id="ecuacion"]');
t = await texto();
check("pregunta por el signo antes de resolver", /menos .* o un más/.test(t));
check("no enseña aún ningún campo para resolver", (await page.locator("#tutor-intento").count()) === 0);
check("marca la lectura como de ejemplo", /lectura de ejemplo, no real/.test(t));
await foto("02-duda");
await page.click('[data-accion="tutor-elegir"][data-op="−"]');
check("tras elegir, enseña el enunciado completo", /3\(x − 2\) = 12/.test(await texto()));
await page.click('[data-accion="tutor-confirmar"]');

console.log("\n✏️  Primer intento con un fallo → pista → segundo intento");
await page.fill("#tutor-intento", "3x + 6 = 12\n3x = 6\nx = 2");
await page.click('[data-accion="tutor-comprobar"]');
t = await texto();
check("localiza el primer error en la línea 1", /línea 1/.test(t));
check("explica el signo y da pista", /menos se queda/.test(t) && /💡/.test(t));
check("el borrador sigue ahí tras repintar", (await page.inputValue("#tutor-intento")).includes("3x + 6"));
await foto("03-error");
await page.click('[data-accion="tutor-pista"]');
check("la pista aparece", /signo que hay delante/.test(await texto()));
await page.fill("#tutor-intento", "3x - 6 = 12\n3x = 18\nx = 6");
await page.click('[data-accion="tutor-comprobar"]');
t = await texto();
check("segundo intento correcto", /Todos los pasos son correctos/.test(t));
check("se apunta CON ayuda (no autónomo)", /Con ayuda/.test(t) && !/Sin ayuda en este ejercicio/.test(t.split("Apuntado")[1] || ""));
check("repaso programado para mañana con motivo", /Próximo repaso: mañana/.test(t) && /con ayuda/.test(t));
check("explica qué ve la familia", /No ve lo que escribes/.test(t));
await foto("04-registro");

console.log("\n🔁 Repasar y posponer");
await page.click('[data-accion="tutor-posponer"]');
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click('[data-pantalla="repasar"]');
t = await texto();
check("aparece la habilidad con su estado", /Ecuaciones con paréntesis/.test(t) && /Con ayuda/.test(t));
check("pospuesto con opción de deshacer", /Pospuesto/.test(t) && (await page.locator('[data-accion="tutor-deshacer"]').count()) === 1);
await page.click('[data-accion="tutor-deshacer"]');
check("deshecho: vuelve el motivo original", /con ayuda/.test(await texto()) && !/Pospuesto/.test(await texto()));

console.log("\n👪 Resumen familiar");
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click('[data-accion="ir"][data-vista="familia"]');
t = await texto();
check("avance, dificultad, acción y próximo repaso", ["un avance", "una dificultad", "diez minutos con vosotros", "próximo repaso"].every((x) => t.toLowerCase().includes(x)), t.slice(0, 300));
check("la dificultad es concreta", /signo menos/.test(t));
check("no aparece nada de lo que escribió", !t.includes("3x + 6") && !t.includes("3x - 6"));
check("es el panel de Pau", /Panel de Pau/.test(t));
check("no manda nada solo y nadie más tiene acceso", /no manda avisos sola/.test(t) && /Nadie más tiene acceso/.test(t));
await foto("05-familia");

console.log("\n📤 Mandar el resumen a Pau (vista previa antes)");
await page.evaluate(() => { window.__compartido = null; navigator.share = async (d) => { window.__compartido = d; }; });
await page.click('[data-accion="tutor-enviar-pau"]');
const previa = await page.locator(".tutor-previa").innerText();
check("enseña el texto entero antes de mandar", /Avance/.test(previa) && /No incluye lo que escribe/.test(previa));
check("la vista previa no lleva lo que escribió", !previa.includes("3x + 6") && !previa.includes("3x - 6"));
check("todavía no se ha mandado nada", await page.evaluate(() => window.__compartido === null));
await page.click("#dlg-cancelar");
check("cancelar no manda nada", await page.evaluate(() => window.__compartido === null));
await page.click('[data-accion="tutor-enviar-pau"]');
await page.click("#dlg-aceptar");
check("al confirmar, se comparte ese mismo texto", (await page.evaluate(() => window.__compartido?.text)) === previa);

console.log("\n💾 El progreso sobrevive a cerrar la app");
const guardado = await page.evaluate(() => localStorage.getItem("nicer-estudia:vagoyo") || "");
check("se guarda sin texto del alumno", guardado.includes("ecuaciones-parentesis") && !guardado.includes("3x"));
await page.reload({ waitUntil: "networkidle" });
await page.goto(`http://localhost:${PORT}/app.html?vista=familia`, { waitUntil: "networkidle" });
check("tras recargar, el panel de Pau sigue con los datos", /signo menos/.test(await texto()));


console.log("\n🗂️  Las otras cinco asignaturas");
for (const [id, mal, bien] of [["lengua", "mañana", "mis primos"], ["fyq", "25000", "2,5"], ["ingles", "play", "plays"], ["frances", "sont", "sommes"]]) {
  await alInicio();
  await page.click(`[data-accion="tutor-asignatura"][data-id="${id}"]`);
  await page.click('[data-pantalla="subir"]');
  await page.click('[data-accion="tutor-practicar"]');
  await page.fill("#tutor-intento", mal);
  await page.click('[data-accion="tutor-comprobar"]');
  const fallo = /💡/.test(await texto());
  await page.fill("#tutor-intento", bien);
  await page.click('[data-accion="tutor-comprobar"]');
  check(`${id}: fallo con pista y después correcto`, fallo && /Apuntado/.test(await texto()));
}
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click('[data-accion="tutor-asignatura"][data-id="sociales"]');
await page.click('[data-pantalla="subir"]');
await page.click('[data-accion="tutor-practicar"]');
await page.click('[data-accion="tutor-opcion"][data-op="Hecho"]');
check("sociales: a la primera → sin ayuda", /Sin ayuda en este ejercicio/.test(await texto()));

console.log("\n💡 Explícame");
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click('[data-accion="tutor-asignatura"][data-id="mates"]');
await page.click('[data-pantalla="explicar"]');
await page.click('[data-accion="tutor-explicar-elige"][data-i="0"]');
t = await texto();
check("respuesta mal → explica por qué y ofrece otra forma", /No es esa/.test(t) && (await page.locator('[data-accion="tutor-explicar-otra"]').count()) >= 1);
await page.click('[data-accion="tutor-explicar-otra"] >> nth=0');
check("otra explicación (bolsas)", /bolsas/.test(await texto()));
await page.click('[data-accion="tutor-revelar"]');
check("pregunta sin mirar y resumen en una frase", /En una frase/.test(await texto()));
await foto("06-explicame");

console.log("\n🎙️  Hablar sin dictado");
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click('[data-pantalla="hablar"]');
t = await texto();
check("sin dictado lo dice y deja escribir", /no deja dictar/.test(t) && (await page.locator("#tutor-habla").count()) === 1);
await page.fill("#tutor-habla", "no puedo más");
await page.click('[data-accion="tutor-enviar-habla"]');
check("«no puedo más» → pausa o último paso", /último paso pequeño/.test(await texto()));
await page.fill("#tutor-habla", "cuál es la capital de Mongolia");
await page.click('[data-accion="tutor-enviar-habla"]');
check("lo que no entiende lo dice y manda a Clara", /no hay IA/.test(await texto()) && /Preguntar a Clara/.test(await texto()));

console.log("\n📵 Sin conexión");
await ctxNav.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event("offline")));
await page.click('[data-accion="tutor-ir"][data-pantalla="inicio"]');
await page.click(".tutor-capacidades summary");
t = await texto();
check("explica qué pasa sin conexión", /Sin conexión: Vago Yo sigue funcionando/.test(t));
await page.click('[data-pantalla="subir"]');
await page.fill("#tutor-enunciado", "2(x + 1) = 10");
await page.click('[data-accion="tutor-enunciado"]');
await page.fill("#tutor-intento", "2x + 2 = 10\n2x = 8\nx = 4");
await page.click('[data-accion="tutor-comprobar"]');
check("corrige sin conexión un enunciado escrito a mano", /Sin ayuda en este ejercicio/.test(await texto()));
await ctxNav.setOffline(false);

check("con «leer fotos» apagado, el tutor no ha hecho ninguna petición a /api", peticionesApi.length === 0, peticionesApi.join(", "));

console.log("\n📸 Leer fotos de sus deberes con IA (servidor simulado)");
await page.waitForTimeout(300);
let respuestaIA = null, cuerposIA = [];
await page.route("**/api/vagoyo", (ruta) => {
  cuerposIA.push(JSON.parse(ruta.request().postData() || "{}"));
  return ruta.fulfill(respuestaIA);
});
const lecturaOk = (ejercicios) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ lectura: { legible: true, motivo: "", asignatura: "mates", pagina: "pág. 34", ejercicios, textoPareceOrden: false, datosPersonalesOmitidos: true } }) });
const fotoPrueba = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 160 } });
await alInicio();
await page.click('[data-accion="tutor-asignatura"][data-id="mates"]');
await page.click('[data-pantalla="subir"]');
check("apagado: dice que lo activa Pau y no hay botón de foto", /Lo puede activar Pau/.test(await texto()) && (await page.locator('[data-accion="tutor-foto-real"]').count()) === 0);

await page.goto(`http://localhost:${PORT}/app.html?vista=familia`, { waitUntil: "networkidle" });
t = await texto();
check("el panel de Pau explica qué sale, adónde y cuánto se guarda", /Qué sale del móvil/i.test(t) && /Anthropic/.test(t) && /30 días/.test(t));
await page.click('[data-accion="tutor-fotos-activar"]');
await page.fill("#pin1", "0427"); await page.fill("#pin2", "0427");
await page.check('input[name="leido"]');
await page.click("#dlg-aceptar");
check("activado por Pau con PIN", /Activado/.test(await texto()));
const ajustesGuardados = await page.evaluate(() => localStorage.getItem("nicer-estudia:vagoyo-ajustes") || "");
check("el PIN no se guarda en claro", ajustesGuardados.includes("pinHuella") && !ajustesGuardados.includes("0427"));
await foto("07-pau-fotos");

await page.click('[data-accion="ir"][data-vista="tutor"]');
await page.click('[data-pantalla="subir"]');
t = await texto();
check("subir: avisa de que la lee una IA y de los 30 días", /IA/.test(t) && /30 días/.test(t) && (await page.locator('[data-accion="tutor-foto-real"]').count()) === 1);
respuestaIA = lecturaOk([{ numero: "5", instruccion: "Resuelve la ecuación", piezas: [{ t: "5(x " }, { duda: "dato", opciones: ["−", "+"], motivo: "La raya está borrosa." }, { t: " 1) = 20" }] }]);
await page.setInputFiles("#tutor-archivo", { name: "deberes.png", mimeType: "image/png", buffer: fotoPrueba });
await page.waitForSelector('[data-accion="tutor-elegir"]');
t = await texto();
check("foto real con signo dudoso → pregunta antes de resolver", /menos .* o un más/.test(t) && /leída por IA/.test(t));
check("enseña tu foto en la confirmación", (await page.locator("img.tutor-foto-real").count()) === 1);
check("al servidor solo le llega la foto y la asignatura", JSON.stringify(Object.keys(cuerposIA[0]).sort()) === JSON.stringify(["asignatura", "imagen"]) && cuerposIA[0].imagen.media_type === "image/jpeg");
await foto("08-foto-duda");
await page.click('[data-accion="tutor-elegir"][data-op="+"]');
await page.click('[data-accion="tutor-confirmar"]');
await page.fill("#tutor-intento", "5x + 5 = 20\n5x = 15\nx = 3");
await page.click('[data-accion="tutor-comprobar"]');
check("y lo corrige paso a paso en el móvil", /Sin ayuda en este ejercicio/.test(await texto()));

respuestaIA = lecturaOk([
  { numero: "1", piezas: [{ t: "x + 2 = 5" }] },
  { numero: "2", instruccion: "Calcula el área de un círculo de radio", piezas: [{ t: "3 cm" }] }
]);
await alInicio();
await page.click('[data-pantalla="subir"]');
await page.setInputFiles("#tutor-archivo", { name: "deberes.png", mimeType: "image/png", buffer: fotoPrueba });
await page.waitForSelector('[data-accion="tutor-elegir-ej"]');
check("varios ejercicios en la foto → elegir uno", (await page.locator('[data-accion="tutor-elegir-ej"]').count()) === 2);
await page.click('[data-accion="tutor-elegir-ej"][data-i="1"]');
check("lo que no corrige él, se lo ofrece a Clara", (await page.locator('[data-accion="tutor-a-clara"]').count()) === 1);
await page.click('[data-accion="tutor-a-clara"]');
const borrador = await page.inputValue("#profe-texto");
check("Clara recibe solo el enunciado y la petición de guía", /No me lo resuelvas/.test(borrador) && /círculo de radio 3 cm/.test(borrador));

respuestaIA = { status: 200, contentType: "application/json", body: JSON.stringify({ lectura: { legible: false, motivo: "Está movida: haz otra más cerca.", ejercicios: [] } }) };
await page.goto(`http://localhost:${PORT}/app.html?vista=tutor`, { waitUntil: "networkidle" });
await page.click('[data-pantalla="subir"]');
await page.setInputFiles("#tutor-archivo", { name: "deberes.png", mimeType: "image/png", buffer: fotoPrueba });
await page.waitForSelector(".tutor-error");
check("foto ilegible → dice qué falta, sin inventarse nada", /Está movida/.test(await texto()));
respuestaIA = { status: 503, contentType: "application/json", body: JSON.stringify({ error: "La IA está saturada. Prueba en un minuto." }) };
await page.setInputFiles("#tutor-archivo", { name: "deberes.png", mimeType: "image/png", buffer: fotoPrueba });
await page.waitForSelector(".tutor-error >> text=saturada");
check("sin IA disponible → lo explica y deja escribirlo", /saturada/.test(await texto()) && (await page.locator("#tutor-enunciado").count()) === 1);

await page.goto(`http://localhost:${PORT}/app.html?vista=familia`, { waitUntil: "networkidle" });
await page.click('[data-accion="tutor-fotos-apagar"]');
check("Pau lo apaga sin PIN (apagar siempre se puede)", /Apagado/.test(await texto()));
check("las únicas peticiones de red del tutor han sido a /api/vagoyo", peticionesApi.every((u) => u.includes("/api/vagoyo")), peticionesApi.join(", "));

console.log("\n🔒 Privacidad y calidad");
const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("sin desborde horizontal a 360 px", desborde <= 0);
check("sin errores de JavaScript", errores.length === 0, errores.join(" | "));

await browser.close();
server.close();
console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones pasadas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
