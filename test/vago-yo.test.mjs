// ============================================================================
//  Tests de Vago Yo (tutor de Nicer Estudia) — motor puro, fase 1
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/vago-yo.test.mjs
//  Sin red ni navegador. Incluye las pruebas obligatorias de la especificación
//  que aplican a la fase 1 (1, 2, 6, 7 y 8). Las 3, 4 y 5 (temario confirmado
//  y supervisor) son de la fase 2 y quedan marcadas como pendientes.
// ============================================================================

import * as V from "../nicer-estudia/vagoyo.js";
import { vistaTutor, vistaFamilia } from "../nicer-estudia/interfaz-tutor.js";

let pasados = 0, fallados = 0;
const check = (nombre, cond, detalle = "") => {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
};
const HOY = "2026-11-18";
const azarFijo = (...v) => { let i = 0; return () => v[i++ % v.length]; };

console.log("\n🧮 Lector de ecuaciones");
check("3(x − 2) = 12 → x = 6", V.resuelve(V.leeEcuacion("3(x − 2) = 12")).x === 6);
check("acepta coma decimal, · y ×", V.resuelve(V.leeEcuacion("2·x = 2,5×2")).x === 2.5);
check("«6» suelto se entiende como x = 6", V.resuelve(V.leeEcuacion("6")).x === 6);
check("x·x no es lineal → null", V.leeEcuacion("x(x+1)=2") === null);
check("basura → null", V.leeEcuacion("hola = 3") === null && V.leeEcuacion("3x = = 2") === null);
check("todas / ninguna", V.resuelve(V.leeEcuacion("x+1=x+1")).tipo === "todas" && V.resuelve(V.leeEcuacion("x=x+1")).tipo === "ninguna");

console.log("\n✏️  Corrección paso a paso (mira el procedimiento)");
const ej = V.primerEjercicio("mates");
check("el ejercicio de ejemplo es 3(x − 2) = 12", ej.enunciado === "3(x − 2) = 12" && ej.x === 6);
check("pasos correctos → bien", V.corrige(ej, "3x - 6 = 12\n3x = 18\nx = 6").estado === "bien");
{
  const c = V.corrige(ej, "3x - 2 = 12\nx = 14/3");
  check("no reparte el 3 → «distribuir» en la línea 1", c.estado === "error" && c.tipoError === "distribuir" && c.linea === 0);
}
{
  const c = V.corrige(ej, "3x + 6 = 12\n3x = 6\nx = 2");
  check("cambia el signo del paréntesis → «signo»", c.tipoError === "signo" && c.linea === 0);
}
{
  const c = V.corrige(ej, "3x - 6 = 12\n3x = 6\nx = 2");
  check("pasa el 6 sin cambiar signo → «transponer» en la línea 2", c.tipoError === "transponer" && c.linea === 1);
  check("reconoce el acierto concreto anterior al error", /3x - 6 = 12/.test(c.acierto || ""));
  check("da una pista para rehacer ese paso", Boolean(c.pista));
}
check("divide mal → «dividir»", V.corrige(ej, "3x-6=12\n3x=18\nx=54").tipoError === "dividir");
{
  const c = V.corrige(ej, "5");
  check("solo un resultado mal: no inventa cómo llegó, pide un paso", c.estado === "pide-paso" && c.acierto === null);
}
check("pasos bien pero sin despejar → incompleto", V.corrige(ej, "3x - 6 = 12").estado === "incompleto");
check("línea que no se entiende → no-leo, sin gastar intento", V.corrige(ej, "3x - 6 = doce").estado === "no-leo");

console.log("\n🗣️  Otras asignaturas (lista cerrada de fallos)");
check("Inglés: «Plays.» con mayúscula y punto vale", V.corrige(V.primerEjercicio("ingles"), "Plays.").estado === "bien");
check("Francés: «etes» sin tilde vale (no se penaliza el dictado)", V.corrige(V.EJERCICIOS.frances[1], "etes").estado === "bien");
check("FyQ: 2,5 m vale", V.corrige(V.primerEjercicio("fyq"), "2,5 m").estado === "bien");
check("FyQ: 25000 → confunde cm con m", V.corrige(V.primerEjercicio("fyq"), "25000").tipoError === "unidades-al-reves");
check("Lengua: «mañana» como sujeto → fallo conocido", V.corrige(V.primerEjercicio("lengua"), "Mañana").tipoError === "sujeto-adverbio");
{
  const c = V.corrige(V.primerEjercicio("lengua"), "vendrán");
  check("fallo desconocido: pregunta cómo lo pensó, sin diagnóstico", c.estado === "pide-paso" && !c.tipoError);
}
check("las 6 asignaturas tienen ejercicio y mini lección",
  V.ASIGNATURAS.every((a) => V.primerEjercicio(a.id) && V.LECCIONES[a.id]?.accion?.opciones?.length));

console.log("\n📷 Prueba obligatoria 1: un signo dudoso provoca una pregunta");
{
  const l = V.leeFotoDemo(V.FOTOS_DEMO[0]);
  const r = V.ejercicioDeLectura(l);
  check("la lectura es simulada y lo dice", l.simulada === true);
  check("con la duda abierta devuelve una PREGUNTA, no un ejercicio", r.tipo === "pregunta" && !r.ejercicio);
  check("la pregunta ofrece − y +", r.opciones.includes("−") && r.opciones.includes("+"));
  check("el texto leído deja el hueco a la vista", V.textoLeido(l) === "3(x ? 2) = 12");
  check("una opción que no está en la lista no se acepta", V.eligeEnLectura(l, r.indice, "×") === l);
  const menos = V.ejercicioDeLectura(V.eligeEnLectura(l, r.indice, "−"));
  const mas = V.ejercicioDeLectura(V.eligeEnLectura(l, r.indice, "+"));
  check("tras confirmar «−»: x = 6", menos.tipo === "ejercicio" && menos.ejercicio.x === 6);
  check("tras confirmar «+»: x = 2 (resuelve lo confirmado, no lo supuesto)", mas.ejercicio.x === 2);
}

console.log("\n💡 Prueba obligatoria 2: correcto con pista NO es autónomo");
{
  let s = V.nuevaSesion(ej);
  s = V.pidePista(s).sesion;
  const r = V.entregaIntento(s, "3x-6=12\n3x=18\nx=6", HOY);
  check("se registra", Boolean(r.registro));
  check("autonomo = false", r.registro.autonomo === false);
  check("cuenta la ayuda", r.registro.ayudas === 1);
}
{
  let s = V.nuevaSesion(ej);
  const r1 = V.entregaIntento(s, "3x+6=12\nx=2", HOY);
  check("fallo → no se registra todavía y la corrección trae pista", !r1.registro && Boolean(r1.correccion.pista));
  const r2 = V.entregaIntento(r1.sesion, "3x-6=12\n3x=18\nx=6", HOY);
  check("corregido tras un fallo con pista → con ayuda", r2.registro.autonomo === false);
  check("el registro guarda el fallo típico, no el texto", r2.registro.errores.includes("signo") && !JSON.stringify(r2.registro).includes("3x"));
}
{
  const r = V.entregaIntento(V.nuevaSesion(ej), "3x-6=12\n3x=18\nx=6", HOY);
  check("a la primera y sin pistas → autónomo", r.registro.autonomo === true);
}
{
  let s = V.nuevaSesion(ej);
  s = V.verEjemplo(s).sesion;
  check("ver un ejemplo resuelto también es ayuda", V.entregaIntento(s, "6", HOY).registro.autonomo === false);
}
{
  const r1 = V.entregaIntento(V.nuevaSesion(ej), "3x+6=12\nx=2", HOY);
  const r2 = V.entregaIntento(r1.sesion, "3x-6=12\n3x=6\nx=2", HOY);
  check("dos fallos seguidos → sugiere cambiar de explicación", r2.correccion.sugerirOtra === true);
  check("la otra explicación es distinta de la pista", V.otraExplicacion(r2.sesion).texto !== V.pidePista(r2.sesion).texto);
}

console.log("\n🔁 Progreso y repaso");
{
  const reg = (fecha, id, autonomo, errores = []) => ({ fecha, habilidad: "ecuaciones-parentesis", ejercicioId: id, correcto: true, autonomo, ayudas: autonomo ? 0 : 1, errores });
  check("sin intentos → «aún no lo sabemos»", V.estadoHabilidad([]) === "sin-datos" && V.ESTADOS["sin-datos"] === "Aún no lo sabemos");
  check("un acierto solo no consolida", V.estadoHabilidad([reg(HOY, "a", true)]) === "sin-ayuda");
  check("dos aciertos el MISMO día no consolidan", V.estadoHabilidad([reg(HOY, "a", true), reg(HOY, "b", true)]) === "sin-ayuda");
  check("mismo ejercicio en dos días no consolida", V.estadoHabilidad([reg("2026-11-15", "a", true), reg(HOY, "a", true)]) === "sin-ayuda");
  check("ejercicios distintos y repaso otro día → consolidado", V.estadoHabilidad([reg("2026-11-15", "a", true), reg(HOY, "b", true)]) === "consolidado");
  check("último con ayuda → con ayuda", V.estadoHabilidad([reg(HOY, "a", false)]) === "con-ayuda");

  let p = V.registra({}, reg(HOY, "a", false), HOY);
  check("con ayuda → repaso mañana con motivo", p["ecuaciones-parentesis"].repaso.fecha === "2026-11-19" && /ayuda/.test(p["ecuaciones-parentesis"].repaso.motivo));
  p = V.registra({}, reg(HOY, "a", true), HOY);
  check("sin ayuda → repaso en 3 días", p["ecuaciones-parentesis"].repaso.fecha === "2026-11-21");
  const rep = V.proximoRepaso([reg("2026-11-17", "a", false, ["signo"]), reg(HOY, "b", false, ["signo"])], HOY);
  check("fallo repetido → adelanta y explica por qué", rep.fecha === "2026-11-19" && /Adelanto/.test(rep.motivo) && /signo/.test(rep.motivo));
  const conExamen = V.proximoRepaso([reg(HOY, "a", true)], HOY, { examen: "2026-11-20" });
  check("el examen adelanta el repaso al día antes", conExamen.fecha === "2026-11-19" && /examen/.test(conExamen.motivo));

  const pos = V.pospone(p, "ecuaciones-parentesis", 1);
  check("posponer mueve un día", pos["ecuaciones-parentesis"].repaso.fecha === "2026-11-22");
  check("y se puede deshacer", V.deshacePospuesto(pos, "ecuaciones-parentesis")["ecuaciones-parentesis"].repaso.fecha === "2026-11-21");
  check("registra no muta el progreso anterior", Object.keys(V.registra({}, reg(HOY, "a", true), HOY)).length === 1 && Object.keys({}).length === 0);
}

console.log("\n👪 Prueba obligatoria 6: el resumen familiar ayuda sin revelar el chat");
{
  const SECRETO = "mi profe de mates es un pesado";
  // Matemáticas: falla el signo y luego lo corrige.
  const m1 = V.entregaIntento(V.nuevaSesion(ej), "3x+6=12\nx=2", HOY);
  const m2 = V.entregaIntento(m1.sesion, "3x-6=12\n3x=18\nx=6", HOY);
  // Lengua: escribe algo personal como respuesta (cuenta como intento).
  const l0 = V.nuevaSesion(V.primerEjercicio("lengua"));
  const l1 = V.entregaIntento(l0, SECRETO, HOY);
  const l2 = V.entregaIntento(l1.sesion, "mis primos", HOY);
  check("lo personal cuenta como intento pero no se guarda", l1.correccion.estado === "pide-paso" && !JSON.stringify(l2.registro).includes("profe"));
  const prog = V.registra(V.registra({}, m2.registro, HOY), l2.registro, HOY);
  const res = V.resumenFamiliar(prog, HOY);
  const todo = JSON.stringify(res) + vistaFamilia({}, { hoy: HOY, tutor: { progreso: prog } });
  check("trae un avance, una dificultad, una acción y el próximo repaso", res.avance && res.dificultad && res.accion && res.proximo);
  check("la acción es concreta para la familia", /juntos|explique/.test(res.accion));
  check("no aparece nada de lo que escribió el alumno", !todo.includes(SECRETO) && !todo.includes("3x+6"));
  check("habla de una dificultad concreta, sin etiquetas", /signo menos/.test(res.dificultad) && !/vago|torpe|despistado/i.test(todo.replace(/Vago Yo/g, "")));
  check("no convierte minutos ni rachas en nota", !/minuto|racha/i.test(JSON.stringify(res)));
  const vacio = V.resumenFamiliar({}, HOY);
  check("sin datos dice «aún no lo sabemos»", vacio.vacio && /Aún no lo sabemos/.test(vacio.avance));
  const fict = V.resumenFamiliar(V.semanaFicticia(HOY), HOY);
  check("la semana ficticia produce un resumen completo", !fict.vacio && /2 ecuaciones/.test(fict.avance) && fict.proximo);
}

console.log("\n📄 Prueba obligatoria 7: una orden dentro de un PDF no cambia nada");
{
  const antesR = JSON.stringify(V.REGLAS), antesP = JSON.stringify(V.PERMISOS_DEMO);
  const l = V.leeFotoDemo(V.FOTOS_DEMO[1]);
  const r = V.ejercicioDeLectura(l);
  check("detecta la frase y avisa de que es texto del documento", l.ordenes.length === 1 && /texto del documento/.test(l.aviso));
  check("el ejercicio sigue siendo la ecuación (2(x + 4) = 18 → x = 5)", r.tipo === "ejercicio" && r.ejercicio.x === 5);
  check("reglas y permisos siguen iguales", JSON.stringify(V.REGLAS) === antesR && JSON.stringify(V.PERMISOS_DEMO) === antesP);
  check("y están congelados", Object.isFrozen(V.REGLAS) && Object.isFrozen(V.PERMISOS_DEMO) && Object.isFrozen(V.PERMISOS_DEMO.supervisor));
  check("avisos externos apagados por defecto", V.PERMISOS_DEMO.avisosExternos === false && V.PERMISOS_DEMO.familiaVeConversaciones === false);
}

console.log("\n📵 Prueba obligatoria 8: sin IA, voz o conexión, lo explica");
{
  const caps = V.capacidades({ enLinea: false, puedeDictar: false, puedeLeer: false });
  const de = (id) => caps.find((c) => c.id === id);
  check("la IA sale como apagada, no simulada como real", de("ia").estado === "no");
  check("la lectura de fotos sale como simulada", de("foto").estado === "simulado");
  check("sin dictado ofrece escribir", de("dictado").estado === "no" && /escribe/i.test(de("dictado").texto));
  check("sin conexión dice que el tutor sigue funcionando", de("conexion").estado === "no" && /sigue funcionando/.test(de("conexion").texto));
  check("corregir funciona sin internet", de("correccion").estado === "si");
  const conDictadoSinRed = V.capacidades({ enLinea: false, puedeDictar: true });
  check("dictado sin red: avisa de que necesita conexión", /conexión/.test(conDictadoSinRed.find((c) => c.id === "dictado").texto));
}

console.log("\n💬 Intenciones");
check("«no entiendo»", V.intencion("Es que no lo entiendo") === "no-entiendo");
check("«otra explicación»", V.intencion("dame otra explicación") === "otra-explicacion");
check("«léemelo»", V.intencion("léemelo porfa") === "leer");
check("«no puedo más» gana a «no entiendo»", V.intencion("no puedo más, no entiendo nada") === "no-puedo-mas");
check("«quiero practicar»", V.intencion("quiero practicar") === "practicar");
check("lo desconocido → null (no se inventa)", V.intencion("¿cuál es la capital de Mongolia?") === null);

console.log("\n🎲 Ejercicios nuevos del mismo tipo");
{
  const otro = V.otroDelMismoTipo(ej, azarFijo(0.1, 0.5, 0.2, 0.7));
  check("otra ecuación, distinta y con solución entera", otro.tipo === "ecuacion" && otro.enunciado !== ej.enunciado && Number.isInteger(otro.x));
  check("se corrige con su propia solución", V.corrige(otro, String(otro.x)).estado === "bien");
  const ing = V.otroDelMismoTipo(V.primerEjercicio("ingles"), () => 0);
  check("Inglés: otro distinto de la misma habilidad", ing.id !== "ing-3a-1" && ing.habilidad === "present-simple-3a");
  check("deEnunciado acepta lo que escribe él", V.deEnunciado("4(x + 3) = 20").x === 2);
  check("deEnunciado rechaza lo que no es ecuación", V.deEnunciado("hola") === null && V.deEnunciado("7") === null);
}

console.log("\n🖥️  Render (escapa lo del alumno)");
{
  const malo = '<img src=x onerror=alert(1)>';
  const tutor = { pantalla: "subir", asignatura: "mates", enunciadoEscrito: malo, progreso: {}, explicar: { elegida: null }, hablar: { texto: malo } };
  const html = vistaTutor({}, { hoy: HOY, tutor });
  check("el enunciado escrito sale escapado", !html.includes(malo) && html.includes("&lt;img"));
  const html2 = vistaTutor({}, { hoy: HOY, tutor: { ...tutor, pantalla: "hablar" } });
  check("lo dictado sale escapado", !html2.includes(malo));
  const inicio = vistaTutor({}, { hoy: HOY, tutor: { ...tutor, pantalla: "inicio" } });
  check("inicio: los cuatro botones y sin «Seguir» si no hay sesión",
    ["Subir ejercicio", "Explícame", "Repasar", "Hablar"].every((b) => inicio.includes(b)) && !inicio.includes("Seguir donde lo dejé"));
  const conSesion = vistaTutor({}, { hoy: HOY, tutor: { ...tutor, pantalla: "inicio", sesion: V.nuevaSesion(ej) } });
  check("inicio: «Seguir donde lo dejé» solo con sesión recuperable", conSesion.includes("Seguir donde lo dejé"));
  check("el nombre nunca califica al alumno", !/eres (un )?vago/i.test(inicio + html + html2));
}

console.log("\n💾 Progreso guardado y mensaje para Pau");
{
  const reg = { fecha: HOY, habilidad: "sujeto", ejercicioId: "len-sujeto-1", correcto: true, autonomo: false, ayudas: 2, errores: ["sujeto-adverbio"] };
  const p = V.registra({}, reg, HOY);
  const vuelta = V.normalizaProgreso(JSON.parse(JSON.stringify(p)));
  check("ida y vuelta por JSON conserva estado y repaso", vuelta.sujeto.estado === "con-ayuda" && vuelta.sujeto.repaso.fecha === "2026-11-19");
  check("descarta habilidades desconocidas y basura", Object.keys(V.normalizaProgreso({ hackeo: { registros: [reg] }, sujeto: "x" })).length === 0);
  check("descarta fallos que no existen", V.normalizaProgreso({ sujeto: { registros: [{ ...reg, errores: ["<script>"] }] } }).sujeto.registros[0].errores.length === 0);
  check("los datos ficticios no se cargan nunca", Object.keys(V.normalizaProgreso(V.semanaFicticia(HOY))).length === 0);
  check("null, lista o texto → vacío", [null, [], "hola", 5].every((x) => Object.keys(V.normalizaProgreso(x)).length === 0));
  const pos = V.pospone(p, "sujeto", 2);
  const posVuelta = V.normalizaProgreso(JSON.parse(JSON.stringify(pos)));
  check("un aplazamiento pedido se respeta al recargar", posVuelta.sujeto.repaso.fecha === "2026-11-21" && posVuelta.sujeto.aplazado);
  check("y se puede deshacer tras recargar", V.deshacePospuesto(posVuelta, "sujeto").sujeto.repaso.fecha === "2026-11-19");

  const msg = V.textoParaPau(V.resumenFamiliar(p, HOY), { alumno: "Nicer", hoy: HOY });
  check("el mensaje para Pau lleva avance, dificultad, acción y repaso", /Avance/.test(msg) && /Dificultad/.test(msg) && /10 minutos/.test(msg) && /Próximo repaso/.test(msg));
  check("fecha en formato español", msg.includes("18/11/2026") && msg.includes("19/11/2026"));
  check("dice que no incluye lo que escribe", /No incluye lo que escribe/.test(msg));
}

console.log("\n⏳ Pendientes de la fase 2 (no se prueban aún): 3 temario confirmado, 4 foto privada del supervisor, 5 revocar enlace.");

console.log(`\n${fallados ? "❌" : "✅"} ${pasados} comprobaciones pasadas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
