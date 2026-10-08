// ============================================================================
//  Inicio: panel con indicadores REALES. Lo que llega en fases futuras se
//  marca como tal («Fase 2») en lugar de enseñar un 0 que parecería un dato.
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, cargando, conAviso, enlace } from "../ui.js";
import { api, sesion, etiqueta } from "../api.js";
import { nuevaOportunidad, nuevoContacto, nuevoInmueble, nuevaDemanda, nuevaTarea } from "../formularios.js";
import { refrescar } from "../dialogos.js";
import { tabla } from "./comun.js";

function saludo() {
  const hh = new Date().getHours();
  return hh < 13 ? "Buenos días" : hh < 21 ? "Buenas tardes" : "Buenas noches";
}

export async function vista(cont) {
  const d = await api.get("/api/inicio");
  const demo = sesion.modo === "demo";
  const usuario = sesion.cat.config.usuario.nombre;
  const fechaTxt = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const acciones = [
    boton("Nueva oportunidad", { clase: "primario", icono: "mas", onclick: async () => { const r = await nuevaOportunidad(); if (r) location.hash = `#/oportunidades/${r.id}`; } }),
    boton("Nuevo contacto", { onclick: async () => { const r = await nuevoContacto(); if (r) location.hash = `#/contactos/${r.id}`; } }),
    boton("Nuevo inmueble", { onclick: async () => { const r = await nuevoInmueble(); if (r) location.hash = `#/inmuebles/${r.id}`; } }),
    boton("Nueva demanda", { onclick: async () => { const r = await nuevaDemanda(); if (r) location.hash = `#/demandas/${r.id}`; } }),
    boton("Nueva tarea", { onclick: async () => { if (await nuevaTarea()) refrescar(); } }),
  ];
  cont.append(cabecera({ titulo: `${saludo()}, ${usuario}`, subtitulo: fechaTxt.charAt(0).toUpperCase() + fechaTxt.slice(1), acciones }));

  if (d.vacio && !demo) {
    cont.append(panel("Empieza por aquí", [
      h("p", { style: { marginTop: 0 } }, "Todavía no hay datos. Esto es lo que te propongo para tu primera sesión (cada paso es opcional):"),
      h("ol", { style: { lineHeight: "1.9" } },
        h("li", null, "Registra tu primera ", h("b", null, "oportunidad"), " con el botón «Nueva oportunidad»: solo piden fuente, tipo y municipio."),
        h("li", null, "Si tienes ya un propietario, crea su ", h("b", null, "contacto"), " y relaciónalo con la oportunidad."),
        h("li", null, "Cuando tengas un encargo firmado, usa «Confirmar encargo» en la oportunidad: se crea el ", h("b", null, "inmueble"), " y se vincula al propietario."),
        h("li", null, "Crea una copia de seguridad en Configuración → Copias de seguridad."),
      ),
      h("div", { class: "aviso info" }, "¿Prefieres ver primero cómo funciona? Pulsa «Probar con datos de demostración» en el menú: son datos ficticios en una base separada, no se mezclan con los tuyos."),
    ]));
  }

  // Avisos
  if (d.avisos.length) {
    cont.append(h("div", { style: { marginBottom: "16px" } }, d.avisos.map((a) => aviso(a.nivel === "bloqueo" ? "bloqueo" : "aviso", a.texto, " ", a.ruta ? enlace("Ver", a.ruta) : null))));
  }

  // Indicadores
  cont.append(h("section", { "aria-label": "Indicadores" }, h("div", { class: "kpis" }, d.indicadores.map((i) => {
    const futura = i.valor === null;
    const cuerpo = [
      futura ? h("span", { class: "chip gris sin-punto fase-tag" }, `Fase ${i.fase}`) : null,
      h("div", { class: `valor ${futura ? "sin-datos" : ""}` }, futura ? "Sin datos" : String(i.valor)),
      h("div", { class: "nombre" }, i.etiqueta),
      h("div", { class: "def" }, i.definicion),
    ];
    return i.ruta && !futura ? h("a", { class: `kpi ${i.alerta ? "alerta" : ""}`, href: i.ruta }, ...cuerpo) : h("div", { class: `kpi ${futura ? "pendiente" : ""}` }, ...cuerpo);
  }))));

  // Embudo
  const e = d.embudo;
  const max = Math.max(1, ...e.por_estado.map((x) => x.n));
  cont.append(panel("Del primer contacto al cierre", [
    h("div", { class: "fases-embudo" },
      h("div", { class: "fase-caja" }, h("div", { class: "n" }, e.detectadas), h("div", { class: "t" }, "Oportunidad detectada"), h("div", { class: "d" }, "Detectadas, en revisión o por verificar")),
      h("div", { class: "fase-caja" }, h("div", { class: "n" }, e.en_contacto), h("div", { class: "t" }, "Contacto"), h("div", { class: "d" }, "Con el propietario, hasta la propuesta")),
      h("div", { class: "fase-caja" }, h("div", { class: "n" }, e.encargos), h("div", { class: "t" }, "Captación con encargo"), h("div", { class: "d" }, "Encargo confirmado")),
      h("div", { class: "fase-caja pend" }, h("div", { class: "n", style: { color: "var(--tx3)", fontSize: "20px", paddingTop: "6px" } }, "Sin datos"), h("div", { class: "t" }, "Operación cerrada"), h("div", { class: "d" }, "Llega con Operaciones (Fase 2)"))),
    h("div", { class: "barras", role: "list", "aria-label": "Oportunidades por estado" }, e.por_estado.map((s) => h("div", { class: "barra-fila", role: "listitem" },
      h("a", { href: `#/oportunidades?estado=${s.clave}`, style: { textDecoration: "none", color: "inherit" } }, chipDe("estados_oportunidad", s.clave)),
      h("div", { class: "pista", "aria-hidden": "true" }, h("div", { class: "relleno", style: { width: `${(s.n / max) * 100}%` } })),
      h("div", { class: "num" }, s.n)))),
    h("p", { class: "ayuda", style: { marginBottom: 0 } }, `${e.descartadas} oportunidad(es) cerradas sin encargo (descartadas o «No contactar»). Las conversiones entre etapas llegan con Informes (Fase 3).`),
  ]));

  // Resultados por fuente y municipio + tareas
  const colsRes = (nombre) => [
    { t: nombre, c: (f) => h("b", null, f.clave) },
    { t: "Total", num: true, c: (f) => f.total }, { t: "Abiertas", num: true, c: (f) => f.abiertas },
    { t: "Con encargo", num: true, c: (f) => f.encargos }, { t: "Cerradas", num: true, c: (f) => f.cerradas },
  ];
  const sinOp = vacio("Aún no hay oportunidades", "Cuando registres oportunidades verás aquí cuántas llegan de cada fuente y de cada municipio.");
  cont.append(h("div", { class: "dos-col", style: { marginTop: "16px" } },
    panel("Resultados por fuente", d.por_fuente.length ? tabla(colsRes("Fuente"), d.por_fuente) : sinOp, { sinPadding: true }),
    panel("Resultados por municipio", d.por_municipio.length ? tabla(colsRes("Municipio"), d.por_municipio) : sinOp, { sinPadding: true })));
  cont.append(h("p", { class: "ayuda" }, "«Abiertas» = en cualquier estado salvo encargo confirmado, descartada o «No contactar». «Cerradas» = descartadas o «No contactar»."));

  cont.append(panel("Para hacer hoy (y lo vencido)", d.proximas_tareas.length ? h("div", null, d.proximas_tareas.map((t) => h("div", { class: `tarea ${t.vencida ? "vencida" : ""}` },
    h("input", { type: "checkbox", "aria-label": `Completar: ${t.titulo}`, onchange: async () => { await conAviso(() => api.post(`/api/tareas/${t.id}/completar`)); refrescar(); } }),
    h("div", null, h("div", { class: "titulo" }, t.titulo), h("div", { class: "meta" }, `${fecha(t.fecha)}${t.hora ? ` ${t.hora}` : ""}`, h("span", null, etiqueta("tipos_tarea", t.tipo)), t.vencida ? chip("Vencida", "rojo") : null)),
    h("div")))) : vacio("Nada pendiente para hoy", "Cuando crees tareas con fecha de hoy (o vencidas) aparecerán aquí.", boton("Ir a la agenda", { href: "#/agenda" })),
  { sinPadding: true, acciones: boton("Ver agenda", { clase: "peq", href: "#/agenda" }) }));
}
