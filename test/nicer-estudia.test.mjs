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
import { separaTarjetas } from "../api/profe.js";

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
