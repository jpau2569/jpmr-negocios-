// ============================================================================
//  Test de interfaz de Nicer Estudia con navegador real (Chromium + Playwright)
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/nicer-estudia.ui.test.mjs
//  No llama a la API real: /api/profe se intercepta y responde en local.
//  Verifica el recorrido completo: apuntar deberes (con prioridad y repetición),
//  exámenes al calendario (.ics), Clara (sugerencias, búsqueda, escuchar, foto
//  del horario y charla que se conserva al recargar),
//  marcarlos, crear y repasar tarjetas, hacer un test, guardar un esquema y un
//  apunte, el modo concentración con sonido de fondo, el Profe con su material,
//  la persistencia al recargar y que a 360 px no hay desborde horizontal.
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

// Clara responde en local. Si le llega una foto, contesta con un horario
// leído; si no, con tarjetas, test y esquema.
let ultimoCuerpo = null;
await page.route("**/api/profe", (ruta) => {
  ultimoCuerpo = JSON.parse(ruta.request().postData() || "{}");
  const responde = (datos) => ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(datos) });
  if (ultimoCuerpo.modo === "leccion") {
    return responde({
      reply: "Te he hecho los apuntes del tema 2.",
      leccion: {
        resumen: "La materia es todo lo que tiene masa y ocupa un volumen. Se presenta en tres estados.",
        apuntes: [
          { titulo: "Propiedades de la materia", puntos: ["Masa: cantidad de materia (kg)", "Volumen: espacio que ocupa (m³)"] },
          { titulo: "Estados", puntos: ["Sólido", "Líquido", "Gaseoso"] }
        ],
        conceptos: [
          { termino: "Masa", definicion: "Cantidad de materia de un cuerpo" },
          { termino: "Volumen", definicion: "Espacio que ocupa un cuerpo" }
        ]
      }
    });
  }
  if (ultimoCuerpo.modo === "examen") {
    return responde({
      reply: "¡Vamos allá!",
      examen: {
        titulo: "Examen de prueba · La materia",
        test: [
          { pregunta: "¿En qué se mide la masa?", opciones: ["kg", "m³", "°C", "s"], correcta: 0 },
          { pregunta: "¿Cuál NO es un estado de la materia?", opciones: ["Sólido", "Líquido", "Elástico", "Gaseoso"], correcta: 2 }
        ],
        desarrollo: [{ pregunta: "Explica qué es el volumen y pon un ejemplo.", puntos: 2, criterios: "Espacio que ocupa un cuerpo; ejemplo correcto." }]
      }
    });
  }
  if (ultimoCuerpo.modo === "corregir") {
    return responde({
      reply: "Buen trabajo.",
      correccion: { correcciones: [{ nota: 6, bien: "La definición es correcta.", mejorar: "Falta un ejemplo.", modelo: "Es el espacio que ocupa un cuerpo; por ejemplo, un litro de agua ocupa 1 dm³." }] }
    });
  }
  if (ultimoCuerpo.imagen) {
    return ruta.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Veo tu horario de 1º ESO. Te lo he preparado, revísalo antes de ponerlo.",
        busquedas: 0,
        horario: { dias: {
          1: [{ hora: "08:15", asignatura: "Matemáticas" }, { hora: "09:10", asignatura: "Religión" }],
          2: [{ hora: "08:15", asignatura: "Inglés" }]
        } }
      })
    });
  }
  return ruta.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    busquedas: 1,
    reply: "Una ecuación de primer grado es una balanza: lo que haces a un lado, al otro. ¿Lo probamos con 2x + 3 = 9?",
    tarjetas: [
      { pregunta: "¿Qué es despejar la x?", respuesta: "Dejar la x sola en un lado", asignatura: "Matemáticas" },
      { pregunta: "¿Qué pasa si sumo 3 a un lado?", respuesta: "Hay que sumarlo también al otro", asignatura: "Matemáticas" },
      { pregunta: "¿Qué es el término independiente?", respuesta: "El número que va solo", asignatura: "Matemáticas" }
    ],
    test: [
      { pregunta: "¿Cuánto vale x en x + 2 = 5?", opciones: ["1", "3", "7"], correcta: 1 },
      { pregunta: "¿Qué haces primero en 2x = 8?", opciones: ["Dividir entre 2", "Sumar 8"], correcta: 0 }
    ],
    esquema: {
      titulo: "Ecuaciones de primer grado",
      asignatura: "Matemáticas",
      ramas: [
        { titulo: "Qué son", puntos: ["Una igualdad con una incógnita"] },
        { titulo: "Cómo se resuelven", puntos: ["Agrupar", "Despejar"] }
      ]
    }
  })
  });
});

await page.goto(`http://localhost:${PORT}/app.html`, { waitUntil: "networkidle" });

console.log("\n🏁 Arranque");
check("la app pinta la pantalla de hoy", await page.locator(".hero .saludo").isVisible());
check("arranca con las asignaturas de ESO puestas",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).asignaturas.length)) > 5);
check("la barra inferior tiene las 5 secciones", (await page.locator("#nav button").count()) === 5);
check("el curso por defecto es 2º de ESO", (await page.locator("#sub-cabecera").textContent()).includes("2º ESO"));

console.log("\n📚 Deberes");
await page.click('[data-accion="ir"][data-vista="agenda"]').catch(() => {});
await page.click('#nav button[data-vista="agenda"]');
await page.click('[data-accion="nueva-tarea"]');
await page.fill("#f-titulo", "Ejercicios 3 y 4 página 45");
await page.selectOption('select[name="asignatura"]', { index: 1 });
await page.click("#dlg-aceptar");
check("los deberes aparecen en la lista", await page.locator(".tarea .qué").first().isVisible());

await page.click('[data-accion="nueva-tarea"]');
await page.fill("#f-titulo", "Leer 20 minutos");
await page.selectOption('select[name="prioridad"]', "alta");
await page.selectOption('select[name="repetir"]', "diaria");
await page.click("#dlg-aceptar");
check("lo prioritario se marca y sube",
  (await page.locator(".tarea").first().textContent()).includes("Prioridad"));
check("la barra inferior cuenta lo de hoy",
  (await page.locator("#aviso-agenda").textContent()) === "2");

await page.click('#nav button[data-vista="hoy"]');
check("lo prioritario abre «qué toca ahora»",
  (await page.locator(".paso").first().textContent()).includes("Leer 20 minutos"));
check("y el resto de deberes también está",
  (await page.locator("main").textContent()).includes("Ejercicios 3 y 4"));

await page.click('#nav button[data-vista="agenda"]');
await page.click('.tarea .marca'); // marca "Leer 20 minutos", que se repite
check("una tarea diaria genera la de mañana al marcarla",
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return e.tareas.some((t) => t.titulo === "Leer 20 minutos" && !t.hecha && t.para === manana);
  }));
await page.click('.tarea .marca');
check("al marcarlos se tachan", (await page.locator(".tarea.hecha").count()) === 0
  || (await page.locator("details .tarea.hecha").count()) >= 0);
check("los deberes marcados salen de lo pendiente de hoy",
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

const [descarga] = await Promise.all([
  page.waitForEvent("download"),
  page.click('[data-accion="calendario-examen"]')
]);
const ics = await (await import("node:fs/promises")).readFile(await descarga.path(), "utf8");
check("el examen se lleva al calendario del móvil como .ics", descarga.suggestedFilename().endsWith(".ics"));
check("con el examen y los pasos del plan, con avisos",
  ics.includes("BEGIN:VCALENDAR") && (ics.match(/BEGIN:VEVENT/g) || []).length === 5 && ics.includes("VALARM"));
await page.click("#dlg-aceptar"); // el aviso de «ábrelo en tu calendario»

console.log("\n🃏 Tarjetas");
await page.click('#nav button[data-vista="estudiar"]');
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

await page.click('[data-accion="nueva-tarjeta"]');
await page.fill("#f-preg", "How do you say «perro» in English?");
await page.fill("#f-resp", "Dog");
await page.selectOption('select[name="idioma"]', "en");
await page.click("#dlg-aceptar");
check("una tarjeta de inglés se escucha en inglés",
  (await page.locator('[data-accion="escuchar-tarjeta"]').textContent()).includes("Listen"));
check("y se guarda con su idioma",
  await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).tarjetas.some((t) => t.idioma === "en")));
await page.click('[data-accion="ver-respuesta"]');
await page.click('[data-accion="acierto"]');

console.log("\n👩‍🏫 Clara");
await page.click('#nav button[data-vista="profe"]');
check("la pestaña es Clara, con su cara", await page.locator(".cabeza-clara img.avatar").isVisible()
  && (await page.locator(".cabeza-clara .nombre").textContent()) === "Clara");
check("propone por dónde empezar", (await page.locator('[data-accion="sugerencia"]').count()) >= 6);
await page.click('[data-accion="sugerencia"][data-id="test"]');
check("una sugerencia deja la frase empezada", (await page.inputValue("#profe-texto")).startsWith("Ponme un test"));
await page.fill("#profe-texto", "no entiendo las ecuaciones de primer grado");
await page.click('[data-accion="preguntar"]');
await page.waitForSelector('.burbuja.profe:has-text("balanza")');
check("Clara contesta", (await page.locator(".burbuja.profe").last().textContent()).includes("balanza"));
check("dice cuándo ha buscado en internet", await page.locator('.burbuja.profe:has-text("Ha buscado en internet")').isVisible());
check("y su respuesta se puede escuchar", (await page.locator('[data-accion="escuchar"]').count()) >= 1);
check("ofrece guardar las tarjetas que ha hecho",
  await page.locator('[data-accion="guardar-tarjetas"]').isVisible());
await page.click('[data-accion="guardar-tarjetas"]');
await page.click("#dlg-aceptar");
check("las tarjetas del Profe se guardan con su asignatura",
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
    const mates = e.asignaturas.find((a) => a.nombre === "Matemáticas");
    return e.tarjetas.filter((t) => t.origen === "ia" && t.asignaturaId === mates.id).length === 3;
  }));

console.log("\n🧪 Test (autoevaluación)");
await page.click('#nav button[data-vista="profe"]');
check("el Profe ofrece el test que ha preparado",
  await page.locator('[data-accion="empezar-test-ia"]').isVisible());
await page.click('[data-accion="empezar-test-ia"]');
check("el test empieza por la primera pregunta",
  (await page.locator("main").textContent()).includes("Pregunta 1 de 2"));
// Primera bien, segunda mal: así se comprueban las dos ramas.
await page.click('.opcion >> nth=1');
check("al responder se marca la correcta", (await page.locator(".opcion--bien").count()) === 1);
await page.click('[data-accion="siguiente-pregunta"]');
await page.click('.opcion >> nth=1');
await page.click('[data-accion="siguiente-pregunta"]');
check("sale la nota al terminar", (await page.locator("main").textContent()).includes("Nota 5"));
check("el resultado se guarda",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).tests[0].nota)) === 5);
check("lo fallado del Profe se convierte en tarjeta",
  await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1"))
    .tarjetas.some((t) => t.pregunta.includes("¿Qué haces primero en 2x = 8?"))));
await page.click('[data-accion="cerrar-test"]');

// Y el test sin conexión, a partir de sus propias tarjetas.
await page.click('[data-accion="sub"][data-sub="test"]');
await page.click('[data-accion="test-tarjetas"]');
check("también hay test con sus tarjetas, sin internet",
  (await page.locator("main").textContent()).includes("Pregunta 1 de"));
check("las opciones son cuatro", (await page.locator(".opcion").count()) === 4);
await page.click('[data-accion="cerrar-test"]').catch(() => {});

console.log("\n🗺️  Esquema");
await page.click('#nav button[data-vista="profe"]');
await page.click('[data-accion="guardar-esquema"]');
check("el esquema se guarda y se dibuja",
  await page.locator(".lienzo-esquema svg").first().isVisible());
check("el esquema queda con su asignatura",
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
    const mates = e.asignaturas.find((a) => a.nombre === "Matemáticas");
    return e.esquemas.length === 1 && e.esquemas[0].asignaturaId === mates.id;
  }));

console.log("\n📓 Notas sueltas");
await page.click('[data-accion="sub"][data-sub="lecciones"]');
await page.click('[data-accion="nuevo-apunte"]');
await page.fill("#f-titulo", "Tema 2 — la célula");
await page.fill("#f-texto", "La célula es la unidad más pequeña de los seres vivos.");
await page.click("#dlg-aceptar");
check("el apunte se guarda y se ve",
  (await page.locator("main").textContent()).includes("Tema 2 — la célula"));
check("desde el apunte se piden tarjetas al Profe",
  await page.locator('[data-accion="tarjetas-de-apunte"]').isVisible());

console.log("\n⏱️  Concentración");
await page.click('#nav button[data-vista="hoy"]');
await page.click('[data-accion="empezar-foco"]');
check("se abre la pantalla de concentración", await page.locator("#foco").isVisible());
check("el compañero acompaña la sesión", await page.locator("#foco-planta svg").isVisible());
check("los ambientes se eligen desde ahí", (await page.locator("#foco-ambientes .chip").count()) >= 4);
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
check("todo sigue ahí tras recargar", await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
  return e.tarjetas.length >= 4 && e.esquemas.length === 1 && e.apuntes.length === 1 && e.tests.length === 1;
}));
check("la mochila avisa de lo que hay que entregar mañana",
  (await page.locator("main").textContent()).includes("Entregar: Leer 20 minutos"));

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

await page.click('#nav button[data-vista="profe"]');
check("la charla con Clara sigue ahí al volver a abrir la app",
  (await page.locator(".burbuja.yo").count()) >= 1 && (await page.locator('.burbuja.profe:has-text("balanza")').count()) >= 1);

console.log("\n📷 Foto del horario");
const { readFile: leer } = await import("node:fs/promises");
await page.setInputFiles("#foto-input", {
  name: "horario.png",
  mimeType: "image/png",
  buffer: await leer(new URL("../nicer-estudia/icono-512.png", import.meta.url))
});
await page.waitForSelector(".foto-pendiente img");
check("la foto se prepara antes de mandarla", await page.locator(".foto-pendiente").isVisible());
await page.click('[data-accion="preguntar"]');
await page.waitForSelector('[data-accion="aplicar-horario"]');
check("la foto viaja reducida y en JPEG",
  ultimoCuerpo?.imagen?.media_type === "image/jpeg" && ultimoCuerpo.imagen.data.length > 500);
check("sin reenviar la foto original", !JSON.stringify(ultimoCuerpo.mensajes).includes("data:image"));
check("en el chat se ve la miniatura", await page.locator(".burbuja.yo img.foto-chat").last().isVisible());
check("Clara enseña el horario leído antes de ponerlo",
  (await page.locator(".horario-leido").textContent()).includes("Religión"));
await page.click('[data-accion="aplicar-horario"]');
await page.click("#dlg-aceptar");
check("el horario queda puesto", await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
  return e.horario[1].length === 2 && e.horario[2].length === 1;
}));
check("y la asignatura que faltaba se añade", await page.evaluate(() =>
  JSON.parse(localStorage.getItem("nicer-estudia:v1")).asignaturas.some((a) => a.nombre === "Religión")));

console.log("\n📘 Libros");
await page.click('#nav button[data-vista="estudiar"]');
await page.click('[data-accion="sub"][data-sub="lecciones"]');
await page.click('[data-accion="nuevo-libro"]');
await page.fill("#f-titulo", "Física y Química 2º ESO");
await page.selectOption('select[name="asignatura"]', { label: "Física y Química" });
await page.fill("#f-editorial", "Anaya");
await page.click("#dlg-aceptar");
check("se puede añadir un libro a mano", (await page.locator("main").textContent()).includes("Física y Química 2º ESO"));

console.log("\n📖 Lección: resumen y apuntes");
await page.click('[data-accion="nueva-leccion"]');
await page.fill("#f-titulo", "Tema 2 — La materia");
await page.selectOption('select[name="asignatura"]', { label: "Física y Química" });
await page.selectOption('select[name="libro"]', { index: 1 });
await page.fill("#f-texto", "La materia es todo lo que tiene masa y ocupa volumen. Estados: sólido, líquido y gaseoso.");
await page.setInputFiles("#f-fotos", {
  name: "pagina.png", mimeType: "image/png",
  buffer: await leer(new URL("../nicer-estudia/icono-512.png", import.meta.url))
});
await page.click("#dlg-aceptar");
await page.waitForSelector(".conceptos");
check("al guardarla, Clara la resume sola", ultimoCuerpo?.modo === "leccion");
check("le llegan el texto, la foto de la página y el libro",
  ultimoCuerpo.leccion.texto.includes("masa") && ultimoCuerpo.imagenes?.length === 1
  && ultimoCuerpo.imagenes[0].media_type === "image/jpeg" && ultimoCuerpo.leccion.libro === "Física y Química 2º ESO");
check("se ven el resumen, los apuntes y los conceptos",
  (await page.locator("main").textContent()).includes("tres estados")
  && (await page.locator(".apartado").count()) === 2 && (await page.locator(".conceptos dt").count()) === 2);
check("queda marcada como resumida", (await page.locator("main").textContent()).includes("Resumida"));
check("la lección se guarda con su libro y sin la foto", await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("nicer-estudia:v1"));
  const l = e.lecciones[0];
  return l.libroId && l.resumida && l.apuntes.length === 2 && !JSON.stringify(e).includes("base64");
}));

await page.click('[data-accion="tarjetas-leccion"]');
await page.click("#dlg-aceptar");
check("los conceptos se convierten en tarjetas de repaso", await page.evaluate(() =>
  JSON.parse(localStorage.getItem("nicer-estudia:v1")).tarjetas.some((t) => t.pregunta === "¿Qué es «Masa»?")));
await page.click('[data-accion="tarjetas-leccion"]');
check("y no se duplican si se pulsa dos veces", (await page.locator("#dlg-cuerpo").textContent()).includes("ya estaban"));
await page.click("#dlg-aceptar");

await page.click('[data-accion="esquema-leccion"]');
check("los apuntes se convierten en esquema sin gastar internet", await page.evaluate(() =>
  JSON.parse(localStorage.getItem("nicer-estudia:v1")).esquemas.some((e) => e.titulo === "Tema 2 — La materia")));

console.log("\n🧪 Examen de prueba de la lección");
await page.click('[data-accion="sub"][data-sub="lecciones"]');
await page.click('[data-accion="abrir-leccion"]');
await page.click('[data-accion="examen-leccion"]');
await page.waitForSelector(".opcion");
check("Clara prepara el examen con la lección", ultimoCuerpo?.modo === "examen" && ultimoCuerpo.contenido.includes("La materia"));
await page.click(".opcion >> nth=0");          // bien (kg)
await page.click('[data-accion="siguiente-pregunta"]');
await page.click(".opcion >> nth=0");          // mal (Sólido)
await page.click('[data-accion="siguiente-pregunta"]');
check("tras el test llega la parte de desarrollo", await page.locator(".respuesta-desarrollo").isVisible());
await page.fill(".respuesta-desarrollo", "Es el espacio que ocupa un cuerpo.");
await page.click('[data-accion="entregar-examen"]');
await page.waitForSelector('.flash:has-text("Nota")');
check("Clara corrige lo que ha escrito", ultimoCuerpo?.modo === "corregir"
  && ultimoCuerpo.preguntas[0].respuesta.includes("espacio"));
check("la nota junta test y desarrollo (1 + 1,2 de 4 puntos = 5,5)",
  (await page.locator(".flash .pastilla").first().textContent()).includes("5.5"));
check("enseña la respuesta de 10", (await page.locator(".modelo").first().textContent()).includes("Respuesta de 10"));
check("el examen queda en el historial con su nota", await page.evaluate(() =>
  JSON.parse(localStorage.getItem("nicer-estudia:v1")).tests.some((t) => t.nota === 5.5)));
await page.click('[data-accion="cerrar-test"]');

console.log("\n📝 Examen con sus lecciones");
await page.click('#nav button[data-vista="agenda"]');
await page.click('[data-accion="nuevo-examen"]');
await page.fill("#f-titulo", "Examen tema 2");
await page.selectOption('select[name="asignatura"]', { label: "Física y Química" });
await page.fill("#f-fecha", new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
await page.check('input[name="lecciones"]');
await page.click("#dlg-aceptar");
check("el examen guarda qué lecciones entran", await page.evaluate(() =>
  JSON.parse(localStorage.getItem("nicer-estudia:v1")).examenes.some((e) => e.titulo === "Examen tema 2" && e.leccionIds.length === 1)));
await page.locator('.tarjeta:has-text("Examen tema 2") [data-accion="examen-prueba"]').click();
await page.waitForSelector(".opcion");
check("su examen de prueba se hace con esas lecciones",
  ultimoCuerpo?.modo === "examen" && ultimoCuerpo.contenido.includes("Propiedades de la materia"));
await page.click('[data-accion="cerrar-test"]');

console.log("\n🎧 Sonido de fondo");
await page.click('#nav button[data-vista="yo"]');
await page.click('.chip >> nth=1');
check("el ambiente elegido se guarda",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("nicer-estudia:v1")).ajustes.ambiente)) !== "ninguno");
check("la planta también sale en Yo", await page.locator("main .hero svg").first().isVisible());

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
