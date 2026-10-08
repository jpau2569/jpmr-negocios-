// ============================================================================
//  Demandas de compradores: lista y ficha. Lo que el cliente manifiesta no se
//  presenta como hecho (la financiación solo consta como aprobada con
//  evidencia) y las demandas sin actualizar se marcan como caducadas.
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, hace, eur, num, dato, conAviso, confirmar, toast, datosLista, enlace } from "../ui.js";
import { api, etiqueta, opciones, catalogoActivo } from "../api.js";
import { nuevaDemanda, editarDemanda, nuevaTarea, nuevaActividad } from "../formularios.js";
import { refrescar } from "../dialogos.js";
import { tabla, paginador, barraFiltros, filtrosDe, listaActividades, listaTareasFicha, listaCambios } from "./comun.js";

const LIMITE = 25;
const rangoPresupuesto = (d) => (d.presupuesto_min != null && d.presupuesto_max != null ? `${eur(d.presupuesto_min)} – ${eur(d.presupuesto_max)}` : d.presupuesto_max != null ? `hasta ${eur(d.presupuesto_max)}` : d.presupuesto_min != null ? `desde ${eur(d.presupuesto_min)}` : null);
const claves = (d) => [d.ascensor === "imprescindible" ? "ascensor" : null, d.garaje === "imprescindible" ? "garaje" : null, d.terraza === "imprescindible" ? "terraza" : null, d.habitaciones_min ? `${d.habitaciones_min}+ hab.` : null].filter(Boolean).join(", ");

export async function lista(cont, { query }) {
  const f = filtrosDe("demandas", { q: "", estado: "", municipio: "", tipo: "", presupuesto_max: "", obsoletas: "", offset: 0 }, query);
  const zona = h("div");
  const filtros = barraFiltros([
    { n: "q", etq: "Buscar", ph: "Comprador, zona, nombre…", ancho: true },
    { n: "estado", etq: "Estado", t: "select", op: opciones("estados_demanda") },
    { n: "municipio", etq: "Municipio", lista: catalogoActivo("municipio") },
    { n: "tipo", etq: "Tipo", t: "select", op: catalogoActivo("tipo_inmueble").map((x) => ({ valor: x, texto: x })) },
    { n: "presupuesto_max", etq: "Presupuesto hasta (€)", t: "num" },
    { n: "obsoletas", etq: "Actualización", t: "select", op: [{ valor: "1", texto: "Solo caducadas" }] },
  ], f, () => { f.offset = 0; cargar(); });
  const exp = boton("Exportar CSV", { icono: "descargar", href: api.urlDescarga("/api/exportar/demandas") });
  exp.setAttribute("download", "");
  cont.append(cabecera({ titulo: "Demandas", subtitulo: "Lo que busca cada comprador. Una persona puede tener varias demandas.", acciones: [
    boton("Nueva demanda", { clase: "primario", icono: "mas", onclick: async () => { const r = await nuevaDemanda(); if (r) location.hash = `#/demandas/${r.id}`; } }), exp] }),
  h("section", { class: "panel" }, filtros, zona));

  async function cargar() {
    const r = await api.get("/api/demandas", { q: f.q, estado: f.estado, municipio: f.municipio, tipo: f.tipo, presupuesto_max: f.presupuesto_max.replace(/\D/g, ""), obsoletas: f.obsoletas, limite: LIMITE, offset: f.offset });
    const cols = [
      { t: "Comprador", c: (d) => h("div", null, h("a", { class: "enlace-fila", href: `#/demandas/${d.id}` }, [d.contacto_nombre, d.contacto_apellidos].filter(Boolean).join(" ")), d.contacto_no_contactar ? [" ", chip("No contactar", "rojo")] : null, d.nombre ? h("span", { class: "sec" }, d.nombre) : null) },
      { t: "Dónde", c: (d) => (d.municipios.length ? d.municipios.join(", ") : h("span", { class: "desconocido" }, "Sin indicar")) },
      { t: "Presupuesto", num: true, c: (d) => rangoPresupuesto(d) || h("span", { class: "desconocido" }, "Sin indicar") },
      { t: "Tipo", c: (d) => (d.tipos.length ? d.tipos.join(", ") : h("span", { class: "desconocido" }, "Cualquiera")) },
      { t: "Imprescindible", c: (d) => claves(d) || h("span", { class: "desconocido" }, "—") },
      { t: "Financiación", c: (d) => h("span", { class: "sec", style: { color: "inherit" } }, etiqueta("financiacion", d.financiacion)) },
      { t: "Actualizada", c: (d) => h("span", null, hace(d.actualizado_en), d.obsoleta ? [" ", chip("Caducada", "ambar")] : null) },
      { t: "Estado", c: (d) => chipDe("estados_demanda", d.estado) },
    ];
    const sinFiltros = !f.q && !f.estado && !f.municipio && !f.tipo && !f.presupuesto_max && !f.obsoletas;
    montar(zona, tabla(cols, r.datos, { ruta: (d) => `#/demandas/${d.id}`, vacioMsg: r.total === 0 && sinFiltros
      ? vacio("Aún no hay demandas", "Crea la demanda de un comprador: dónde busca, con qué presupuesto y qué es imprescindible para él.", boton("Crear la primera demanda", { clase: "primario", onclick: async () => { const x = await nuevaDemanda(); if (x) location.hash = `#/demandas/${x.id}`; } }))
      : vacio("Ninguna demanda coincide", "Prueba a quitar algún filtro.") }),
    r.total ? paginador(r, (o) => { f.offset = o; cargar(); }, "demandas") : null);
  }
  await cargar();
}

export async function detalle(cont, { partes }) {
  const d = await api.get(`/api/demandas/${partes[1]}`);
  const nombre = d.nombre || `Demanda de ${d.contacto.nombre_completo}`;
  document.title = `${nombre} · CAPTAOPORTUNIDADES ASTURIAS`;
  const rel = { demanda_id: d.id, contacto_id: d.contacto.id };

  cont.append(cabecera({
    migas: [enlace("Demandas", "#/demandas"), " › ", nombre], titulo: nombre,
    subtitulo: h("span", null, "Comprador: ", enlace(d.contacto.nombre_completo, `#/contactos/${d.contacto.id}`), " · ", chipDe("estados_demanda", d.estado), ` · actualizada ${hace(d.actualizado_en)}`),
    acciones: [
      boton("Editar", { clase: "primario", icono: "editar", onclick: async () => { if (await editarDemanda(d)) refrescar(); } }),
      d.estado !== "cerrada" ? boton("Confirmar que sigue vigente", { icono: "check", titulo: "Úsalo cuando hables con el cliente y siga buscando lo mismo", onclick: async () => { await conAviso(() => api.post(`/api/demandas/${d.id}/confirmar-vigente`), { ok: "Vigencia confirmada." }); refrescar(); } }) : null,
      boton("Nueva tarea", { onclick: async () => { if (await nuevaTarea({}, rel, nombre)) refrescar(); } }),
      boton("Registrar actividad", { onclick: async () => { if (await nuevaActividad(rel, nombre)) refrescar(); } }),
    ],
  }));
  for (const a of d.alertas) cont.append(aviso(a.nivel, a.texto));

  const busca = datosLista([
    ["Operación", etiqueta("operaciones_demanda", d.operacion)],
    ["Municipios", d.municipios.length ? h("span", { class: "chips" }, d.municipios.map((m) => chip(m, "azul", { punto: false }))) : dato(null)],
    ["Zonas", dato(d.zonas)], ["Presupuesto", dato(rangoPresupuesto(d))],
    ["Tipos de inmueble", d.tipos.length ? d.tipos.join(", ") : dato(null)],
    ["Superficie mínima", dato(d.superficie_min, (x) => num(x, "m²"))], ["Habitaciones mínimas", dato(d.habitaciones_min)], ["Baños mínimos", dato(d.banos_min)],
    ["Estados aceptables", d.estados_aceptables.length ? d.estados_aceptables.map((e) => etiqueta("estados_conservacion", e)).join(", ") : dato(null)],
  ]);
  const requisitos = datosLista([
    ["Ascensor", etiqueta("nivel_requisito", d.ascensor)], ["Garaje", etiqueta("nivel_requisito", d.garaje)], ["Terraza", etiqueta("nivel_requisito", d.terraza)],
    ["Requisitos imprescindibles", dato(d.requisitos_imprescindibles), true], ["Preferencias", dato(d.preferencias), true],
  ]);
  const fin = datosLista([
    ["Plazo de compra", etiqueta("plazos_compra", d.plazo_compra)],
    ["Situación de financiación", h("span", null, etiqueta("financiacion", d.financiacion))],
    ["Evidencia", d.financiacion === "aprobada_acreditada" ? dato(d.financiacion_evidencia) : h("span", { class: "desconocido" }, "No acreditada")],
    d.estado === "cerrada" ? ["Motivo de cierre", dato(d.motivo_cierre), true] : null,
  ]);
  const q = new URLSearchParams();
  if (d.municipios[0]) q.set("municipio", d.municipios[0]);
  if (d.tipos[0]) q.set("tipo", d.tipos[0]);
  if (d.presupuesto_max) q.set("precio_max", String(d.presupuesto_max));

  cont.append(h("div", { class: "col-ppal" },
    h("div", null,
      panel("Qué busca", busca), panel("Requisitos", requisitos),
      panel("Plazo y financiación", [fin, h("p", { class: "nota-legal" }, "Lo que el cliente manifiesta no es lo mismo que lo acreditado: solo se marca «aprobada» si hay evidencia anotada.")]),
      panel("Cruce con la cartera", [
        h("p", { style: { marginTop: 0 } }, "La comparación automática entre demandas y cartera, con reglas transparentes (qué coincide, qué no y qué se desconoce), llega en la ", h("b", null, "Fase 2"), "."),
        h("p", { class: "ayuda" }, "Mientras tanto puedes mirar a ojo la cartera con los criterios principales de esta demanda:"),
        boton("Ver inmuebles con estos criterios", { href: `#/inmuebles?${q.toString()}` }),
      ]),
    ),
    h("div", null,
      panel("Actividad", listaActividades(d.actividades, { alAnadir: async () => { if (await nuevaActividad(rel, nombre)) refrescar(); } }), { acciones: d.actividades.length ? boton("Registrar", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaActividad(rel, nombre)) refrescar(); } }) : null }),
      panel("Tareas pendientes", listaTareasFicha(d.tareas), { acciones: boton("Nueva", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaTarea({}, rel, nombre)) refrescar(); } }) }),
      panel("Historial de cambios", listaCambios(d.cambios)),
    )));

  cont.append(h("div", { style: { marginTop: "24px" } }, boton("Eliminar demanda", { clase: "borde-peligro peq", icono: "papelera", onclick: async () => {
    if (!(await confirmar({ titulo: "Eliminar demanda", mensaje: "Se borrará esta demanda. Si el cliente ya no busca, es mejor cerrarla: se conserva el historial.", textoOk: "Eliminar", peligro: true }))) return;
    if (await conAviso(() => api.del(`/api/demandas/${d.id}`), { ok: "Demanda eliminada." })) location.hash = "#/demandas";
  } })));
}
