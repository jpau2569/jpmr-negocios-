// ============================================================================
//  Tests de Nicer Estudia — motor de estudio, datos y API del Profe
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/nicer-estudia.test.mjs
//  No tocan red ni navegador: solo las funciones puras.
// ============================================================================

import * as U from "../nicer-estudia/utiles.js";
import * as D from "../nicer-estudia/datos.js";
import * as R from "../nicer-estudia/repaso.js";
import * as UI from "../nicer-estudia/interfaz.js";
import * as Q from "../nicer-estudia/cuestionario.js";
import { dibujaEsquema, esquemaDeIA, parteTexto } from "../nicer-estudia/esquema.js";
import * as A from "../nicer-estudia/ambiente.js";
import profe, { separaTarjetas, separaBloques, imagenValida, imagenesValidas, mensajeDeModo } from "../api/_profe.js";
import * as L from "../nicer-estudia/lecciones.js";
import Anthropic from "@anthropic-ai/sdk";
import { icsExamen, escapaIcs, doblaLinea } from "../nicer-estudia/calendario.js";
import { idiomaDe, limpiaParaLeer } from "../nicer-estudia/voz.js";
import { medidas } from "../nicer-estudia/foto.js";

let pasados = 0, fallados = 0;
const check = (nombre, cond, detalle = "") => {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
};
const HOY = "2026-09-08"; // martes

console.log("\n📅 Fechas");
check("aISO usa la fecha local, no UTC", U.aISO(new Date(2026, 8, 8, 23, 30)) === "2026-09-08");
check("sumaDias cruza el cambio de hora", U.sumaDias("2026-10-24", 3) === "2026-10-27");
check("diasEntre cuenta días enteros", U.diasEntre(HOY, "2026-09-15") === 7);
check("diaSemana: lunes es 1, domingo es 7", U.diaSemana("2026-09-07") === 1 && U.diaSemana("2026-09-13") === 7);
check("cuentaAtras habla en cristiano", U.cuentaAtras(HOY, HOY) === "¡es hoy!" && U.cuentaAtras("2026-09-09", HOY) === "mañana");
check("escapa neutraliza el HTML", U.escapa('<img onerror="x">') === "&lt;img onerror=&quot;x&quot;&gt;");
check("horaAMinutos rechaza basura", U.horaAMinutos("25:00") === null && U.horaAMinutos("09:15") === 555);

console.log("\n🗂️  Datos");
{
  const sucio = {
    asignaturas: [{ nombre: "Mates", color: "rojo" }],
    tareas: [{ titulo: "x", asignaturaId: "inventado", para: "mañana" }],
    tarjetas: [{ pregunta: "p" }, { pregunta: "p", respuesta: "r", caja: 99 }],
    ajustes: { pomodoro: 9999 },
    racha: { dias: 5, mejor: 2 }
  };
  const e = D.normaliza(sucio);
  check("color inválido → color por defecto", e.asignaturas[0].color === "#57606a");
  check("referencia a asignatura fantasma → null", e.tareas[0].asignaturaId === null);
  check("fecha inválida → hoy", U.esISO(e.tareas[0].para));
  check("tarjeta sin respuesta se descarta", e.tarjetas.length === 1);
  check("caja fuera de rango se recorta", e.tarjetas[0].caja === R.CAJA_MAX);
  check("ajuste absurdo se limita", e.ajustes.pomodoro === 60);
  check("el récord de racha nunca baja del actual", e.racha.mejor === 5);
  check("exportar/importar da la vuelta completa", D.importar(D.exportar(e)).ok);
  check("importar basura no revienta", D.importar("{no es json").ok === false);
}

console.log("\n🎒 Mochila y agenda");
{
  const e = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "Mates", color: "#12628a" }],
    horario: { 3: [{ id: "c1", asignaturaId: "a1", hora: "10:00" }, { id: "c2", asignaturaId: "a1", hora: "08:15" }] },
    tareas: [
      { id: "t1", titulo: "ejercicios", asignaturaId: "a1", para: "2026-09-09" },
      { id: "t2", titulo: "atrasada", asignaturaId: "a1", para: "2026-09-01" }
    ]
  });
  check("el horario se ordena por hora", e.horario[3][0].hora === "08:15");
  const m = D.mochila(e, HOY); // martes → mañana es miércoles (día 3)
  check("la mochila mira el día siguiente con clase", m.dia === "2026-09-09" && m.clases.length === 2);
  check("la mochila avisa de lo que hay que entregar", m.entregas.length === 1);
  check("lo atrasado va primero", D.pendientes(e, HOY)[0].id === "t2");
  check("paraHoy incluye lo vencido", D.paraHoy(e, HOY).length === 1);

  const vacio = D.normaliza({ asignaturas: [] });
  check("sin horario, la mochila es la de mañana", D.mochila(vacio, HOY).dia === "2026-09-09");
}

console.log("\n🃏 Repaso espaciado");
{
  let t = R.nuevaTarjeta({ pregunta: "¿capital de Asturias?", respuesta: "Oviedo" }, HOY);
  check("una tarjeta nueva toca hoy", R.tocaHoy(t, HOY));
  t = R.repasada(t, true, HOY);
  check("acierto → caja 1, mañana", t.caja === 1 && t.proximo === "2026-09-09");
  t = R.repasada(t, true, "2026-09-09");
  t = R.repasada(t, true, "2026-09-11");
  check("los intervalos crecen", t.caja === 3 && t.proximo === "2026-09-15");
  const fallada = R.repasada(t, false, "2026-09-15");
  check("fallo → vuelve a la caja 1, no a la 0", fallada.caja === 1);
  check("se cuentan aciertos y fallos", fallada.aciertos === 3 && fallada.fallos === 1);

  const muchas = Array.from({ length: 50 }, () => R.nuevaTarjeta({ pregunta: "p", respuesta: "r" }, HOY));
  check("la cola diaria tiene tope", R.colaDeHoy(muchas, HOY, 20).length === 20);
  check("una tarjeta futura no entra en la cola", R.colaDeHoy([{ ...t, proximo: "2026-12-01" }], HOY, 20).length === 0);
  check("la previsión cubre 7 días", R.previsionRepaso(muchas, HOY).length === 7);
}

console.log("\n📝 Plan de examen");
{
  const plan = R.planExamen({ fecha: "2026-09-22" }, HOY);
  check("con dos semanas hay 5 hitos", plan.length === 5);
  check("el primer hito es 7 días antes", plan[0].fecha === "2026-09-15");
  check("el último es el día del examen", plan.at(-1).fecha === "2026-09-22");
  const corto = R.planExamen({ fecha: "2026-09-09" }, HOY);
  check("con un día de margen sigue habiendo plan", corto.length >= 1 && corto.at(-1).fecha === "2026-09-09");
  check("un examen pasado no genera plan", R.planExamen({ fecha: "2026-09-01" }, HOY).length === 0);
}

console.log("\n🔥 Racha y puntos");
{
  check("primer día de racha", R.actualizaRacha({ dias: 0, mejor: 0, ultimoDia: null }, HOY).dias === 1);
  const seguida = R.actualizaRacha({ dias: 3, mejor: 3, ultimoDia: "2026-09-07" }, HOY);
  check("día seguido suma", seguida.dias === 4 && seguida.mejor === 4);
  check("día saltado reinicia", R.actualizaRacha({ dias: 9, mejor: 9, ultimoDia: "2026-09-01" }, HOY).dias === 1);
  check("el récord se conserva al romperse", R.actualizaRacha({ dias: 9, mejor: 9, ultimoDia: "2026-09-01" }, HOY).mejor === 9);
  check("dos veces el mismo día no suma", R.actualizaRacha({ dias: 4, mejor: 4, ultimoDia: HOY }, HOY).dias === 4);
  check("una racha vieja ya no cuenta", R.rachaVigente({ dias: 9, ultimoDia: "2026-09-01" }, HOY) === 0);
  check("los niveles suben", R.nivel(0).nombre === "Empezando" && R.nivel(5000).siguiente === null);
}

console.log("\n📋 Plan del día");
{
  const tareas = [
    { id: "t1", titulo: "atrasada", dias: -2 },
    { id: "t2", titulo: "de hoy", dias: 0 }
  ];
  const examenes = [{ id: "e1", titulo: "Bio", fecha: "2026-09-10", dias: 2 }];
  const plan = R.planDelDia({ tareas, examenes, tarjetasHoy: 6, minutosHechos: 0, objetivo: 45 }, HOY);
  check("lo atrasado abre el plan", plan[0].tipo === "atrasada");
  check("el plan nunca pasa de 5 cosas", plan.length <= 5);
  check("el repaso entra en el plan", plan.some((p) => p.tipo === "repaso"));
  const tranquilo = R.planDelDia({ tareas: [], examenes: [], tarjetasHoy: 0, minutosHechos: 0, objetivo: 45 }, HOY);
  check("un día sin nada propone adelantar", tranquilo[0].tipo === "libre");
}

console.log("\n📨 Parte semanal");
{
  const e = D.normaliza({
    alumno: { nombre: "Nicer" },
    sesiones: [{ fecha: HOY, minutos: 50 }, { fecha: "2026-09-07", minutos: 25 }, { fecha: "2026-08-01", minutos: 999 }],
    tareas: [{ id: "t", titulo: "x", hecha: true, hechaEl: HOY, para: HOY }]
  });
  const s = R.parteSemanal(e, HOY);
  check("solo cuenta los últimos 7 días", s.minutos === 75);
  check("cuenta los días activos", s.diasActivos === 2);
  const texto = UI.textoParteSemanal(e, HOY);
  check("el parte se puede mandar por WhatsApp", texto.includes("Nicer") && texto.includes("1 h 15 min"));
}

console.log("\n🖨️  Render");
{
  const e = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "Mates", color: "#12628a" }],
    tareas: [{ id: "t1", titulo: '<script>alert(1)</script>', asignaturaId: "a1", para: HOY }]
  });
  const html = UI.vistaAgenda(e, { hoy: HOY });
  check("el render escapa lo que escribe el alumno", !html.includes("<script>alert"));
  check("las vistas se pintan sin datos", UI.vistaHoy(D.normaliza({}), { hoy: HOY }).length > 100);
  check("la vista Yo aguanta el estado vacío", UI.vistaYo(D.normaliza({}), { hoy: HOY }).length > 100);
  check("Estudiar se pinta en sus cuatro pestañas",
    ["tarjetas", "test", "esquemas", "apuntes"]
      .every((sub) => UI.vistaEstudiar(D.normaliza({}), { hoy: HOY, sub, hechasHoy: 0 }).length > 50));
  check("la planta crece con la racha",
    UI.etapaDe(0).nombre === "Semilla" && UI.etapaDe(15).nombre === "Árbol");
  check("los contadores de la barra cuadran", UI.contadores(e, HOY).agenda === 1);
}

console.log("\n🤖 API del Profe");
{
  const conBloque = `Aquí tienes el resumen.

[[TARJETAS]]
[{"pregunta":"¿Qué es una célula?","respuesta":"La unidad de los seres vivos","asignatura":"Biología"}]
[[/TARJETAS]]`;
  const r = separaTarjetas(conBloque);
  check("el bloque de tarjetas se extrae", r.tarjetas.length === 1 && r.tarjetas[0].asignatura === "Biología");
  check("el bloque no llega al alumno", !r.visible.includes("[[TARJETAS]]"));
  check("sin bloque, todo es texto", separaTarjetas("hola").visible === "hola");
  check("JSON roto no rompe la respuesta", separaTarjetas("hola [[TARJETAS]]{roto[[/TARJETAS]]").tarjetas.length === 0);
  check("tarjeta incompleta se descarta",
    separaTarjetas('x [[TARJETAS]][{"pregunta":"p"}][[/TARJETAS]]').tarjetas.length === 0);

  const completo = separaBloques(`Ahí va.
[[TEST]]{"titulo":"T","asignatura":"Mates","preguntas":[{"pregunta":"¿2+2?","opciones":["3","4"],"correcta":1}]}[[/TEST]]
[[ESQUEMA]]{"titulo":"La célula","ramas":[{"titulo":"Partes","puntos":["Núcleo"]}]}[[/ESQUEMA]]`);
  check("el test del Profe llega separado", completo.test.length === 1 && completo.test[0].correcta === 1);
  check("el esquema del Profe llega separado", completo.esquema.titulo === "La célula");
  check("ni el test ni el esquema llegan al chat",
    completo.visible === "Ahí va." );
  check("una pregunta sin opciones se cae",
    separaBloques('x [[TEST]]{"preguntas":[{"pregunta":"p","opciones":[],"correcta":0}]}[[/TEST]]').test.length === 0);
  check("un esquema vacío no llega", separaBloques('x [[ESQUEMA]]{"titulo":"t","ramas":[]}[[/ESQUEMA]]').esquema === null);

  const conHorario = separaBloques(`Veo tu horario.
[[HORARIO]]{"dias":{"1":[{"hora":"8:15","asignatura":"Matemáticas"},{"hora":"xx","asignatura":"Inglés"}],"3":[{"hora":"09:10","asignatura":""}]}}[[/HORARIO]]`);
  check("el horario de la foto llega separado", conHorario.horario?.dias?.[1]?.length === 2);
  check("las horas se normalizan y las ilegibles se vacían",
    conHorario.horario.dias[1][0].hora === "08:15" && conHorario.horario.dias[1][1].hora === "");
  check("un día sin clases válidas no aparece", !conHorario.horario.dias[3]);
  check("las tarjetas de inglés llegan marcadas",
    separaBloques('x [[TARJETAS]][{"pregunta":"dog","respuesta":"perro","idioma":"en"}][[/TARJETAS]]').tarjetas[0].idioma === "en");
  check("solo se aceptan fotos JPEG, PNG o WebP", imagenValida({ media_type: "image/gif", data: "QUJD" }) === null);
  check("una foto con datos raros se ignora", imagenValida({ media_type: "image/jpeg", data: "<script>" }) === null);
  check("una foto enorme se ignora", imagenValida({ media_type: "image/jpeg", data: "A".repeat(4_000_000) }) === null);
  check("como mucho 6 páginas por lección", imagenesValidas(Array(10).fill({ media_type: "image/jpeg", data: "QUJD" })).length === 6);
  check("y sin pasar del tamaño que cabe en Vercel",
    imagenesValidas(Array(3).fill({ media_type: "image/jpeg", data: "A".repeat(1_500_000) })).length === 2);
  const examenMsg = mensajeDeModo("examen", { examen: { titulo: "Tema 2", asignatura: "FyQ" }, contenido: "" });
  check("sin lecciones, el examen avisa de que no es con sus apuntes", examenMsg.content.includes("No tengo las lecciones"));
  check("un modo sin datos no genera mensaje", mensajeDeModo("corregir", { preguntas: [] }) === null);
  const bloques = separaBloques('Listo.\n[[EXAMEN]]{"titulo":"t","test":[],"desarrollo":[]}[[/EXAMEN]]\n[[CORRECCION]][1,2][[/CORRECCION]]');
  check("el examen del modo examen llega aparte", bloques.examen?.titulo === "t" && bloques.visible === "Listo.");
  check("un bloque que no es un objeto se descarta", bloques.correccion === null);
}

console.log("\n🤖 Clara por dentro (Claude y Gemini simulados)");
{
  const original = Anthropic.Messages.prototype.create;
  const fetchOriginal = globalThis.fetch;
  const claves = { a: process.env.ANTHROPIC_API_KEY, g: process.env.GEMINI_API_KEY };
  const peticiones = [];
  const resFalsa = () => {
    const r = { code: 200, body: null, headers: {} };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    return r;
  };
  process.env.ANTHROPIC_API_KEY = "clave-de-prueba";
  process.env.GEMINI_API_KEY = "clave-de-prueba";

  // Gemini simulado: devuelve un resumen con su fuente.
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "La Revolución Industrial empezó en Inglaterra hacia 1760." }] },
      groundingMetadata: { groundingChunks: [{ web: { title: "Historia", uri: "https://ejemplo.es" } }] } }]
  }), { status: 200, headers: { "content-type": "application/json" } });

  // Claude simulado: primero pide buscar, luego contesta con la fuente.
  Anthropic.Messages.prototype.create = async function (p) {
    peticiones.push(JSON.parse(JSON.stringify(p)));
    if (peticiones.length === 1) {
      return { stop_reason: "tool_use", content: [
        { type: "thinking", thinking: "", signature: "s" },
        { type: "tool_use", id: "tu_1", name: "buscar_web", input: { consulta: "Revolución Industrial inicio" } }
      ] };
    }
    return { stop_reason: "end_turn", content: [{ type: "text", text: "Empezó en Inglaterra hacia 1760 (fuente: Historia)." }] };
  };

  const r1 = resFalsa();
  await profe({ method: "POST", body: {
    mensajes: [{ role: "user", content: "¿Cuándo empezó la Revolución Industrial? Es para un trabajo." }],
    curso: "1º ESO", nombre: "Nicer", asignaturas: ["Geografía e Historia"]
  } }, r1);
  check("Clara responde después de buscar", r1.code === 200 && r1.body.reply.includes("1760"));
  check("avisa de que ha buscado en internet", r1.body.busquedas === 1);
  check("con clave de Gemini se le ofrece el buscador", peticiones[0].tools?.[0]?.name === "buscar_web");
  const segunda = peticiones[1]?.messages || [];
  check("devuelve el turno entero (con el razonamiento) antes del resultado",
    segunda.at(-2)?.role === "assistant" && segunda.at(-2).content[0].type === "thinking");
  check("el resultado de la búsqueda vuelve como tool_result",
    segunda.at(-1)?.content?.[0]?.type === "tool_result" && segunda.at(-1).content[0].tool_use_id === "tu_1");
  check("el tope de tokens ya no corta un test largo", peticiones[0].max_tokens >= 4000);
  check("el prompt es el de Clara", peticiones[0].system[0].text.startsWith("Eres CLARA"));

  // Foto: va delante del texto en el último mensaje, y sin Gemini no hay buscador.
  delete process.env.GEMINI_API_KEY;
  peticiones.length = 0;
  Anthropic.Messages.prototype.create = async function (p) {
    peticiones.push(JSON.parse(JSON.stringify(p)));
    return { stop_reason: "end_turn", content: [{ type: "text", text: "Veo el ejercicio 4 de fracciones." }] };
  };
  const r2 = resFalsa();
  await profe({ method: "POST", body: {
    mensajes: [{ role: "user", content: "¿Me ayudas con esto?" }],
    imagen: { media_type: "image/jpeg", data: "QUJDRA==" }
  } }, r2);
  const contenido = peticiones[0].messages.at(-1).content;
  check("la foto va delante del texto", Array.isArray(contenido) && contenido[0].type === "image" && contenido[1].type === "text");
  check("con su tipo y en base64", contenido[0].source.media_type === "image/jpeg" && contenido[0].source.type === "base64");
  check("sin clave de Gemini no se ofrece el buscador", !peticiones[0].tools);
  check("y el prompt no promete buscar", !peticiones[0].system[0].text.includes("buscar_web"));

  // Modos de trabajo: lección con fotos, sin buscador y con sus instrucciones.
  process.env.GEMINI_API_KEY = "clave-de-prueba";
  peticiones.length = 0;
  Anthropic.Messages.prototype.create = async function (p) {
    peticiones.push(JSON.parse(JSON.stringify(p)));
    return { stop_reason: "end_turn", content: [{ type: "text", text: 'Hecho.\n[[LECCION]]{"resumen":"r","apuntes":[{"titulo":"t","puntos":["p"]}],"conceptos":[]}[[/LECCION]]' }] };
  };
  const r4 = resFalsa();
  await profe({ method: "POST", body: {
    modo: "leccion",
    leccion: { titulo: "Tema 2", asignatura: "Física y Química", texto: "La materia…" },
    imagenes: [{ media_type: "image/jpeg", data: "QUJD" }, { media_type: "image/jpeg", data: "REVG" }]
  } }, r4);
  check("resumir una lección devuelve los apuntes aparte", r4.body.leccion?.resumen === "r" && r4.body.reply === "Hecho.");
  const pideLeccion = peticiones[0];
  check("las fotos de las páginas van delante del texto",
    pideLeccion.messages[0].content.filter((b) => b.type === "image").length === 2 && pideLeccion.messages[0].content.at(-1).type === "text");
  check("con las instrucciones de su modo en un bloque aparte (el de Clara sigue en caché)",
    pideLeccion.system.length === 2 && pideLeccion.system[1].text.includes("[[LECCION]]") && pideLeccion.system[0].cache_control);
  check("en los modos de trabajo no se ofrece el buscador", !pideLeccion.tools);

  const r5 = resFalsa();
  await profe({ method: "POST", body: { modo: "leccion", leccion: { titulo: "vacía" } } }, r5);
  check("una lección sin texto ni fotos se rechaza con un mensaje claro", r5.code === 400 && r5.body.error.includes("foto"));

  peticiones.length = 0;
  const r6 = resFalsa();
  await profe({ method: "POST", body: { modo: "corregir", preguntas: [{ pregunta: "Define masa", criterios: "materia", respuesta: "" }] } }, r6);
  check("corregir va con esfuerzo bajo, que es lo que más impaciencia da", peticiones[0].output_config.effort === "low");
  check("una respuesta en blanco se le dice a Clara como tal", peticiones[0].messages[0].content.includes("(en blanco)"));
  delete process.env.GEMINI_API_KEY;

  // Rechazo del modelo: respuesta amable, sin romper la app.
  Anthropic.Messages.prototype.create = async () => ({ stop_reason: "refusal", content: [] });
  const r3 = resFalsa();
  await profe({ method: "POST", body: { mensajes: [{ role: "user", content: "algo raro" }] } }, r3);
  check("si el modelo se niega, contesta con cariño y sin error", r3.code === 200 && r3.body.reply.length > 20);

  Anthropic.Messages.prototype.create = original;
  globalThis.fetch = fetchOriginal;
  if (claves.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = claves.a;
  if (claves.g === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = claves.g;
}


console.log("\n📝 Cuestionarios");
{
  const tarjetas = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: "t" + n, pregunta: "Pregunta " + n, respuesta: "Respuesta " + n, asignaturaId: "a1"
  }));
  // Azar determinista: si no, la prueba dependería de la suerte.
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);

  const test = Q.generaDesdeTarjetas(tarjetas, { cuantas: 4, azar });
  check("el test sale de las tarjetas", test.length === 4);
  check("cada pregunta tiene cuatro opciones", test.every((p) => p.opciones.length === 4));
  check("la correcta es la respuesta de su tarjeta",
    test.every((p) => p.opciones[p.correcta] === "Respuesta " + p.pregunta.split(" ")[1]));
  check("no hay opciones repetidas", test.every((p) => new Set(p.opciones).size === p.opciones.length));
  check("con menos de cuatro tarjetas no hay test", Q.generaDesdeTarjetas(tarjetas.slice(0, 3), { azar }).length === 0);
  check("las tarjetas no se tocan al generar el test", tarjetas.every((t) => !("opciones" in t)));

  const respuestas = test.map((p, i) => (i === 0 ? p.correcta : (p.correcta + 1) % p.opciones.length));
  const r = Q.corrige(test, respuestas);
  check("corrige y pone nota sobre 10", r.aciertos === 1 && r.total === 4 && r.nota === 2.5);
  check("devuelve lo fallado para volver a repasarlo", r.falladas.length === 3);
  check("sin responder nada, cero", Q.corrige(test, [null, null, null, null]).nota === 0);
  check("el comentario cambia con la nota",
    Q.comentario({ nota: 10, total: 4 }) !== Q.comentario({ nota: 2, total: 4 }));

  const deIA = Q.preguntasDeIA([
    { pregunta: "¿2+2?", opciones: ["3", "4"], correcta: 1 },
    { pregunta: "rota", opciones: ["1"], correcta: 0 },
    { pregunta: "fuera de rango", opciones: ["a", "b"], correcta: 9 }
  ]);
  check("del test del Profe solo pasa lo válido", deIA.length === 1 && deIA[0].correcta === 1);
}

console.log("\n🗺️  Esquemas");
{
  const esquema = {
    titulo: "La célula",
    ramas: [
      { titulo: "Tipos", puntos: ["Procariota", "Eucariota"] },
      { titulo: "Partes", puntos: ["Membrana", "Núcleo"] },
      { titulo: "Funciones", puntos: ["Nutrición"] }
    ]
  };
  const { svg, alto } = dibujaEsquema(esquema);
  check("dibuja un SVG con todas las ramas",
    svg.startsWith("<svg") && esquema.ramas.every((r) => svg.includes(r.titulo)));
  check("el alto se adapta al contenido", alto > 200 && alto < 900);
  check("el texto del alumno va escapado", dibujaEsquema({ titulo: "<script>", ramas: esquema.ramas }).svg.includes("&lt;script&gt;"));
  check("parte las líneas largas", parteTexto("una frase bastante larga que no cabe de una sola vez", 20).length >= 3);
  check("un esquema sin ramas no se guarda", esquemaDeIA({ titulo: "x", ramas: [] }) === null);
  check("el esquema del Profe se limpia", esquemaDeIA({ titulo: "x", ramas: [{ titulo: "r", puntos: ["a", ""] }] }).ramas[0].puntos.length === 1);
}

console.log("\n🎧 Sonido de fondo");
{
  check("hay ambientes y todos tienen nombre", A.AMBIENTES.length >= 4 && A.AMBIENTES.every((x) => x.nombre));
  check("cada ambiente que no es silencio tiene perfil",
    A.AMBIENTES.filter((x) => x.id !== "ninguno").every((x) => A.perfil(x.id)));
  check("un ambiente inventado no existe", A.perfil("reggaeton") === null);
  check("sin Web Audio, no revienta: solo no suena",
    A.crearAmbiente(null).reproducir("lluvia") === false);
}

console.log("\n🔁 Tareas que se repiten");
{
  const base = { id: "t1", titulo: "Leer 20 min", para: "2026-09-08", repetir: "diaria", hecha: true };
  check("la diaria salta al día siguiente", D.repiteTarea(base, HOY).para === "2026-09-09");
  check("la semanal salta siete días", D.repiteTarea({ ...base, repetir: "semanal" }, HOY).para === "2026-09-15");
  check("si se hizo tarde, la siguiente cuenta desde hoy",
    D.repiteTarea({ ...base, para: "2026-08-01" }, HOY).para === "2026-09-09");
  check("la que no se repite no genera nada", D.repiteTarea({ ...base, repetir: "no" }, HOY) === null);
  check("la nueva nace sin marcar", D.repiteTarea(base, HOY).hecha === false);
}

console.log("\n❗ Prioridad");
{
  const e = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "Mates", color: "#12628a" }],
    tareas: [
      { id: "n", titulo: "normal", para: HOY, prioridad: "normal", creada: "2026-09-01" },
      { id: "a", titulo: "importante", para: HOY, prioridad: "alta", creada: "2026-09-07" }
    ]
  });
  check("lo prioritario del mismo día va primero", D.pendientes(e, HOY)[0].id === "a");
}


console.log("\n📅 Exámenes al calendario (.ics)");
{
  const examen = { id: "ex1", titulo: "Tema 2, la célula", fecha: "2026-10-05", temas: "Págs. 24-39; y apuntes" };
  const plan = R.planExamen(examen, "2026-09-23");
  const ics = icsExamen({ examen, plan, asignatura: "Biología y Geología" });
  const eventos = ics.match(/BEGIN:VEVENT/g) || [];
  check("un evento para el examen y uno por cada paso del plan",
    eventos.length === 1 + plan.filter((p) => p.dias > 0).length);
  check("el examen avisa la tarde anterior", ics.includes("TRIGGER:-PT7H"));
  check("cada paso del plan avisa a las 17:00", ics.includes("TRIGGER:PT17H"));
  check("es un día completo con la fecha del examen", ics.includes("DTSTART;VALUE=DATE:20261005"));
  check("las líneas terminan en CRLF, como pide el formato", ics.includes("\r\n") && !/[^\r]\n/.test(ics));
  check("comas y puntos y coma van escapados", escapaIcs("a, b; c") === ["a", ", b", "; c"].join(String.fromCharCode(92)));
  const larga = doblaLinea("SUMMARY:" + "ñ".repeat(80));
  check("las líneas largas se doblan a 75 octetos",
    larga.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
  check("un examen sin plan sigue saliendo", (icsExamen({ examen, plan: [] }).match(/BEGIN:VEVENT/g) || []).length === 1);
}

console.log("\n🎤 Voz");
{
  check("reconoce una respuesta en inglés", idiomaDe("What did you do at the weekend? Tell me in English.") === "en");
  check("y una en español", idiomaDe("Muy bien, ahora dime qué es una fracción") === "es");
  check("no lee emojis ni asteriscos", limpiaParaLeer("**Bien** 🎉 hecho") === "Bien hecho");
}

console.log("\n📷 Fotos");
{
  check("una foto grande se reduce a 1600 px por el lado mayor",
    JSON.stringify(medidas(4000, 3000)) === JSON.stringify({ ancho: 1600, alto: 1200 }));
  check("una foto pequeña no se agranda", medidas(800, 600).ancho === 800);
  check("la foto vertical conserva la proporción", medidas(3000, 4000).alto === 1600);
}

console.log("\n🗓️  Horario desde una foto");
{
  const e = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "Matemáticas", color: "#12628a" }],
    horario: { 2: [{ id: "c1", asignaturaId: "a1", hora: "10:00" }] }
  });
  const r = D.aplicaHorario(e, { dias: { 1: [{ hora: "08:15", asignatura: "Mates" }, { hora: "09:10", asignatura: "Religión" }] } });
  check("reconoce las asignaturas que ya tiene", r.estado.horario[1][0].asignaturaId === "a1");
  check("crea las que no tenía", r.creadas.length === 1 && r.creadas[0] === "Religión");
  check("no toca los días que no salen en la foto", r.estado.horario[2].length === 1);
  check("no modifica el estado original", (e.horario[1] || []).length === 0);
  check("cuenta las clases puestas", r.clases === 2);
}

console.log("\n💬 Conversación guardada");
{
  check("sin almacenamiento (Node), el chat empieza vacío", Array.isArray(D.cargarChat()) && D.cargarChat().length === 0);
  check("y guardar no revienta", D.guardarChat([{ rol: "user", texto: "hola" }]) === false);
  check("las tarjetas guardan su idioma", D.normaliza({ tarjetas: [{ pregunta: "dog", respuesta: "perro", idioma: "en" }] }).tarjetas[0].idioma === "en");
  check("sin idioma, español", D.normaliza({ tarjetas: [{ pregunta: "p", respuesta: "r" }] }).tarjetas[0].idioma === "es");
}


console.log("\n🎓 2º de ESO");
{
  check("el curso por defecto es 2º ESO", D.estadoInicial().alumno.curso === "2º ESO");
  check("los datos guardados con 1º ESO de fábrica pasan a 2º", D.normaliza({ version: 2, alumno: { curso: "1º ESO" } }).alumno.curso === "2º ESO");
  check("un curso puesto a mano se respeta", D.normaliza({ version: 2, alumno: { curso: "3º ESO" } }).alumno.curso === "3º ESO");
  check("y la migración solo ocurre una vez", D.normaliza({ version: 3, alumno: { curso: "1º ESO" } }).alumno.curso === "1º ESO");
}

console.log("\n📘 Libros y lecciones");
{
  const e = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "Física y Química", color: "#0f6f7a" }, { id: "a2", nombre: "Inglés", color: "#5b3fa8" }],
    libros: [{ id: "l1", asignaturaId: "a1", titulo: "FyQ 2º ESO", editorial: "Anaya" }, { id: "l2", titulo: "" }],
    lecciones: [
      { id: "x1", asignaturaId: "a1", libroId: "l1", titulo: "Tema 1", fecha: "2026-09-10" },
      { id: "x2", asignaturaId: "a1", libroId: "borrado", titulo: "Tema 2", fecha: "2026-09-20" },
      { id: "x3", asignaturaId: "a2", titulo: "Unit 1", fecha: "2026-09-15" }
    ],
    examenes: [{ titulo: "Ex", fecha: "2026-10-01", leccionIds: ["x1", "fantasma"] }]
  });
  check("un libro sin título se descarta", e.libros.length === 1);
  check("una lección con un libro que ya no existe se queda sin libro", e.lecciones.find((l) => l.id === "x2").libroId === null);
  check("un examen solo guarda lecciones que existen", JSON.stringify(e.examenes[0].leccionIds) === '["x1"]');
  const grupos = D.leccionesPorAsignatura(e);
  check("las lecciones se agrupan por asignatura", grupos.length === 2 && grupos[0].lecciones.length === 2);
  check("y lo más reciente va arriba", grupos[0].lecciones[0].id === "x2");
  check("se pueden filtrar por asignatura", D.leccionesPorAsignatura(e, "a2")[0].lecciones[0].titulo === "Unit 1");
  check("libros de una asignatura", D.librosDe(e, "a1").length === 1 && D.libro(e, "l1").editorial === "Anaya");
}

console.log("\n✨ Motor de lecciones");
{
  const bruto = {
    resumen: "La materia tiene masa y volumen.",
    apuntes: [{ titulo: "Propiedades", puntos: ["Masa", "Volumen", ""] }, { titulo: "", puntos: ["x"] }, { titulo: "Vacío", puntos: [] }],
    conceptos: [{ termino: "Masa", definicion: "Cantidad de materia" }, { termino: "Sin definición" }]
  };
  const m = L.leccionDeIA(bruto);
  check("se queda solo con los apartados y conceptos completos", m.apuntes.length === 1 && m.apuntes[0].puntos.length === 2 && m.conceptos.length === 1);
  check("una respuesta vacía no se guarda", L.leccionDeIA({ resumen: "", apuntes: [] }) === null);

  const leccion = { id: "x1", asignaturaId: "a1", titulo: "Tema 2 — La materia", ...m };
  const tarjetas = L.tarjetasDeLeccion(leccion, HOY);
  check("cada concepto es una tarjeta", tarjetas.length === 1 && tarjetas[0].pregunta === "¿Qué es «Masa»?");
  check("la tarjeta es de su asignatura y toca hoy", tarjetas[0].asignaturaId === "a1" && tarjetas[0].proximo === HOY);
  check("en inglés, la pregunta va en inglés", L.tarjetasDeLeccion(leccion, HOY, "en")[0].pregunta.startsWith("What is"));
  const esquema = L.esquemaDeLeccion(leccion);
  check("los apuntes se convierten en esquema", esquema.titulo === "Tema 2 — La materia" && esquema.ramas[0].titulo === "Propiedades");
  check("sin apuntes no hay esquema", L.esquemaDeLeccion({ titulo: "t", apuntes: [] }) === null);

  const larga = { titulo: "Larga", texto: "x".repeat(20000) };
  const corta = { titulo: "Corta", resumen: "Resumen corto", apuntes: [] };
  const contenido = L.contenidoDeLecciones([larga, corta], 5000);
  check("el contenido para el examen cabe en el límite", contenido.length <= 5100);
  check("y ninguna lección se queda fuera por la larga", contenido.includes("Resumen corto"));
  check("una lección sin resumir entra con su texto", L.textoDeLeccion({ titulo: "T", texto: "texto original" }).includes("texto original"));

  const estado = D.normaliza({
    asignaturas: [{ id: "a1", nombre: "FyQ", color: "#0f6f7a" }],
    lecciones: [{ id: "x1", asignaturaId: "a1", titulo: "T1", resumen: "r" }, { id: "x2", asignaturaId: "a1", titulo: "T2" }]
  });
  check("un examen usa las lecciones que eligió", L.leccionesDeExamen(estado, { leccionIds: ["x2"] })[0].id === "x2");
  check("si no eligió, las resumidas de su asignatura", L.leccionesDeExamen(estado, { asignaturaId: "a1", leccionIds: [] }).map((l) => l.id).join() === "x1");
}

console.log("\n🧪 Examen de prueba");
{
  const ex = L.examenDeIA({
    titulo: "Examen de prueba",
    test: [{ pregunta: "¿Unidad de masa?", opciones: ["kg", "m"], correcta: 0 }, { pregunta: "rota", opciones: ["a"], correcta: 0 }],
    desarrollo: [{ pregunta: "Explica el volumen", puntos: 9, criterios: "espacio" }, { pregunta: "" }]
  }, "a1");
  check("del examen de Clara solo pasa lo válido", ex.test.length === 1 && ex.desarrollo.length === 1);
  check("los puntos de desarrollo se acotan (1 a 4)", ex.desarrollo[0].puntos === 4);
  check("las preguntas quedan con su asignatura", ex.test[0].asignaturaId === "a1");
  check("un examen vacío no se usa", L.examenDeIA({ test: [], desarrollo: [] }) === null);

  const corr = L.correccionDeIA({ correcciones: [{ nota: 12, bien: "b", mejorar: "m", modelo: "mod" }] }, 1);
  check("la corrección se valida y la nota se acota a 10", corr[0].nota === 10 && corr[0].modelo === "mod");
  check("si faltan correcciones, no se usa a medias", L.correccionDeIA({ correcciones: [] }, 2) === null);

  const des = [{ puntos: 2 }];
  check("nota final: 1 de 2 en test + 6 en desarrollo de 2 puntos = 5,5",
    L.notaFinal({ aciertos: 1, total: 2 }, des, [6]) === 5.5);
  check("todo bien es un 10", L.notaFinal({ aciertos: 2, total: 2 }, des, [10]) === 10);
  check("sin desarrollo es la nota del test", L.notaFinal({ aciertos: 3, total: 4 }, [], []) === 7.5);
  check("un examen vacío es un 0, no un error", L.notaFinal({}, [], []) === 0);
}

console.log("\n🔎 Búsqueda de asignatura (la usa el Profe al crear tarjetas)");
{
  const e = D.normaliza({ asignaturas: [{ id: "a1", nombre: "Biología y Geología", color: "#2f7d4f" }] });
  check("encuentra por nombre parcial", D.buscaAsignatura(e, "Biología")?.id === "a1");
  check("ignora tildes y mayúsculas", D.buscaAsignatura(e, "biologia y geologia")?.id === "a1");
  check("no inventa una asignatura", D.buscaAsignatura(e, "Latín") === null);
}

console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones pasadas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
