// ============================================================================
//  Agenda y tareas: Hoy · Semana · Pendientes · Vencidas · Calendario.
//  Los recordatorios son internos: avisan mientras esta pantalla está abierta.
// ============================================================================
import { h, montar, cabecera, panel, boton, chip, chipDe, vacio, fecha, fechaLarga, conAviso, confirmar, toast, hoyIso, icono } from "../ui.js";
import { api, etiqueta } from "../api.js";
import { nuevaTarea, editarTarea } from "../formularios.js";
import { posponerTarea, refrescar } from "../dialogos.js";
import { filtrosDe } from "./comun.js";

const VISTAS = [["hoy", "Hoy"], ["semana", "Semana"], ["pendientes", "Pendientes"], ["vencidas", "Vencidas"], ["calendario", "Calendario"], ["hechas", "Hechas"]];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dos = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

function relacion(t) {
  const partes = [];
  if (t.oportunidad_id) partes.push(h("a", { href: `#/oportunidades/${t.oportunidad_id}` }, t.oportunidad_identificador || "Oportunidad"));
  if (t.inmueble_id) partes.push(h("a", { href: `#/inmuebles/${t.inmueble_id}` }, t.inmueble_referencia || "Inmueble"));
  if (t.demanda_id) partes.push(h("a", { href: `#/demandas/${t.demanda_id}` }, "Demanda"));
  if (t.contacto_id) partes.push(h("a", { href: `#/contactos/${t.contacto_id}` }, [t.contacto_nombre, t.contacto_apellidos].filter(Boolean).join(" ") || "Contacto"));
  return partes;
}
const etiquetaRel = (t) => (t.oportunidad_identificador || t.inmueble_referencia || [t.contacto_nombre, t.contacto_apellidos].filter(Boolean).join(" ") || undefined);

function filaTarea(t) {
  const hecha = t.estado === "hecha";
  return h("div", { class: `tarea ${hecha ? "hecha" : ""} ${t.vencida ? "vencida" : ""}`, id: `tarea-${t.id}` },
    h("input", { type: "checkbox", checked: hecha, "aria-label": `${hecha ? "Reabrir" : "Completar"}: ${t.titulo}`, onchange: async (e) => {
      const marcada = e.target.checked;
      await conAviso(() => (marcada ? api.post(`/api/tareas/${t.id}/completar`) : api.put(`/api/tareas/${t.id}`, { estado: "pendiente" })));
      refrescar();
    } }),
    h("div", null,
      h("div", { class: "titulo" }, t.titulo),
      h("div", { class: "meta" },
        h("span", null, h("b", null, t.hora || "Todo el día")), h("span", null, etiqueta("tipos_tarea", t.tipo)), chipDe("prioridades", t.prioridad),
        t.vencida ? chip("Vencida", "rojo") : null, t.aviso_min != null && !hecha ? h("span", { title: "Recordatorio interno (con la aplicación abierta)" }, icono("campana"), ` ${t.aviso_min === 0 ? "a la hora" : `${t.aviso_min} min antes`}`) : null,
        t.comunicacion ? chip(t.comunicacion.nivel === "bloqueo" ? "Contacto bloqueado" : "Canal sin revisar", t.comunicacion.nivel === "bloqueo" ? "rojo" : "ambar", { punto: false }) : null,
        ...relacion(t)),
      t.notas ? h("div", { class: "ayuda", style: { whiteSpace: "pre-wrap" } }, t.notas) : null),
    h("div", { class: "acc" },
      hecha ? null : boton(null, { clase: "peq icono suave", icono: "reloj", titulo: "Posponer", onclick: async () => { if (await posponerTarea(t)) refrescar(); } }),
      boton(null, { clase: "peq icono suave", icono: "editar", titulo: "Editar", onclick: async () => { if (await editarTarea(t, etiquetaRel(t))) refrescar(); } }),
      boton(null, { clase: "peq icono suave", icono: "papelera", titulo: "Eliminar", onclick: async () => {
        if (await confirmar({ titulo: "Eliminar tarea", mensaje: `Se eliminará «${t.titulo}».`, textoOk: "Eliminar", peligro: true })) { await conAviso(() => api.del(`/api/tareas/${t.id}`)); refrescar(); }
      } })));
}

function agrupadaPorDia(tareas, hoy) {
  const grupos = new Map();
  for (const t of tareas) (grupos.get(t.fecha) || grupos.set(t.fecha, []).get(t.fecha)).push(t);
  return [...grupos.entries()].map(([dia, items]) => h("div", null,
    h("div", { class: "grupo-dia" }, dia === hoy ? "Hoy · " : "", fechaLarga(dia)), items.map(filaTarea)));
}

export async function vista(cont, { query }) {
  const f = filtrosDe("agenda", { vista: "hoy", mes: "", dia: "" }, query);
  if (query.tarea) { // abierta desde el buscador global
    const t = await api.get(`/api/tareas/${query.tarea}`).catch(() => null);
    if (t) { history.replaceState(null, "", "#/agenda"); if (await editarTarea(t)) refrescar(); }
  }
  const hoy = hoyIso();
  const resumen = (await api.get("/api/tareas", { vista: "hoy", limite: 1 })).resumen;
  const cuentas = { hoy: resumen.hoy, semana: resumen.semana, pendientes: resumen.pendientes, vencidas: resumen.vencidas };

  cont.append(cabecera({ titulo: "Agenda y tareas", subtitulo: "Tus tareas, seguimientos y vencimientos. Los recordatorios avisan mientras tengas esta aplicación abierta.", acciones: [
    boton("Nueva tarea", { clase: "primario", icono: "mas", onclick: async () => { if (await nuevaTarea({ fecha: f.dia || hoy })) refrescar(); } })] }));

  cont.append(h("div", { class: "tabs", role: "tablist" }, VISTAS.map(([clave, texto]) => h("button", {
    type: "button", role: "tab", "aria-selected": String(f.vista === clave), onclick: () => { f.vista = clave; refrescar(); },
  }, texto, cuentas[clave] != null ? h("span", { class: `n ${clave === "vencidas" && cuentas[clave] > 0 ? "alerta" : ""}` }, cuentas[clave]) : null))));

  const zona = h("div");
  cont.append(zona);

  if (f.vista === "calendario") return calendario(zona, f, hoy);

  const r = await api.get("/api/tareas", { vista: f.vista });
  const vacios = {
    hoy: ["Nada para hoy", "No hay tareas con fecha de hoy. Aprovecha para adelantar seguimientos."],
    semana: ["Semana despejada", "No hay tareas de lunes a domingo."], pendientes: ["Todo al día", "No tienes tareas pendientes."],
    vencidas: ["Nada vencido", "No tienes tareas pasadas de fecha. ¡Bien!"], hechas: ["Aún no has completado tareas", "Aquí verás lo que vayas terminando."],
  };
  if (!r.datos.length) { zona.append(panel(null, vacio(vacios[f.vista][0], vacios[f.vista][1], boton("Nueva tarea", { clase: "primario", onclick: async () => { if (await nuevaTarea()) refrescar(); } })))); return; }
  zona.append(h("section", { class: "panel" }, f.vista === "hoy" ? r.datos.map(filaTarea) : agrupadaPorDia(r.datos, hoy)));
}

async function calendario(zona, f, hoy) {
  const [a0, m0] = (f.mes || hoy.slice(0, 7)).split("-").map(Number);
  const primero = new Date(a0, m0 - 1, 1);
  const inicioGrid = new Date(primero); inicioGrid.setDate(1 - ((primero.getDay() + 6) % 7));
  const finGrid = new Date(inicioGrid); finGrid.setDate(inicioGrid.getDate() + 41);
  const r = await api.get("/api/tareas", { vista: "calendario", desde: iso(inicioGrid), hasta: iso(finGrid), limite: 200 });
  const porDia = new Map();
  for (const t of r.datos) (porDia.get(t.fecha) || porDia.set(t.fecha, []).get(t.fecha)).push(t);
  const mover = (n) => { const d = new Date(a0, m0 - 1 + n, 1); f.mes = `${d.getFullYear()}-${dos(d.getMonth() + 1)}`; f.dia = ""; refrescar(); };
  const nombreMes = primero.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrid); d.setDate(inicioGrid.getDate() + i);
    const k = iso(d);
    const items = porDia.get(k) || [];
    celdas.push(h("button", { type: "button", class: `dia ${d.getMonth() !== m0 - 1 ? "fuera" : ""} ${k === hoy ? "hoy" : ""} ${k === f.dia ? "sel" : ""}`,
      "aria-label": `${fechaLarga(k)}: ${items.length} tarea(s)`, onclick: () => { f.dia = f.dia === k ? "" : k; refrescar(); } },
    h("span", { class: "num-dia" }, d.getDate()),
    ...items.slice(0, 3).map((t) => h("span", { class: `mini ${t.estado === "hecha" ? "hecha" : t.prioridad === "alta" ? "alta" : ""}` }, `${t.hora ? `${t.hora} ` : ""}${t.titulo}`)),
    items.length > 3 ? h("span", { class: "mas" }, `+${items.length - 3} más`) : null));
  }
  zona.append(h("section", { class: "panel" },
    h("header", null, h("h2", { style: { textTransform: "capitalize" } }, nombreMes),
      h("div", { class: "acciones", style: { display: "flex", gap: "6px" } },
        boton("Anterior", { clase: "peq", onclick: () => mover(-1) }), boton("Hoy", { clase: "peq", onclick: () => { f.mes = ""; f.dia = hoy; refrescar(); } }), boton("Siguiente", { clase: "peq", onclick: () => mover(1) }))),
    h("div", { class: "cuerpo" }, h("div", { class: "calendario" }, DIAS.map((d) => h("div", { class: "cab" }, d)), celdas))));

  if (f.dia) {
    const items = porDia.get(f.dia) || [];
    zona.append(h("section", { class: "panel" },
      h("header", null, h("h2", null, fechaLarga(f.dia)), boton("Nueva tarea este día", { clase: "peq primario", onclick: async () => { if (await nuevaTarea({ fecha: f.dia })) refrescar(); } })),
      items.length ? items.map(filaTarea) : h("div", { class: "cuerpo" }, vacio("Nada este día", "Pulsa «Nueva tarea este día» para planificar algo."))));
  }
}
