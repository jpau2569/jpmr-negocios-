// ============================================================================
//  Cartera de inmuebles: lista (tabla o tarjetas) y ficha completa con
//  propietarios, historial de precios, encargos, datos pendientes de
//  confirmar y el historial de captación. La dirección interna se distingue
//  siempre de la ubicación pública.
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, eur, num, dato, si, conAviso, confirmar, toast, datosLista, enlace, icono } from "../ui.js";
import { api, etiqueta, opciones, catalogoActivo } from "../api.js";
import { nuevoInmueble, editarInmueble, nuevaTarea, nuevaActividad } from "../formularios.js";
import { cambiarPrecio, formularioEncargo, anadirPropietario, refrescar } from "../dialogos.js";
import { tabla, paginador, barraFiltros, filtrosDe, listaActividades, listaTareasFicha, listaCambios } from "./comun.js";

const LIMITE = 24;
const vistaGuardada = () => { try { return localStorage.getItem("captao.vistaInmuebles") || "tabla"; } catch { return "tabla"; } };
const guardarVista = (v) => { try { localStorage.setItem("captao.vistaInmuebles", v); } catch { /* sin almacenamiento */ } };

function resumenCaract(i) {
  return [i.superficie_m2 ? `${num(i.superficie_m2)} m²` : null, i.habitaciones != null ? `${i.habitaciones} hab.` : null, i.banos != null ? `${i.banos} baños` : null].filter(Boolean).join(" · ");
}

export async function lista(cont, { query }) {
  const f = filtrosDe("inmuebles", { q: "", estado: "", municipio: "", tipo: "", operacion: "", precio_min: "", precio_max: "", orden: "", offset: 0 }, query);
  let vista = vistaGuardada();
  const zona = h("div");
  const selVista = h("div", { class: "chips", role: "group", "aria-label": "Tipo de vista" });
  const filtros = barraFiltros([
    { n: "q", etq: "Buscar", ph: "Referencia, título, zona…", ancho: true },
    { n: "estado", etq: "Estado", t: "select", vacio: "Todos", op: [{ valor: "activos", texto: "Activos (disp., reserv., negoc.)" }, ...opciones("estados_comerciales")] },
    { n: "municipio", etq: "Municipio", lista: catalogoActivo("municipio") },
    { n: "tipo", etq: "Tipo", t: "select", op: catalogoActivo("tipo_inmueble").map((x) => ({ valor: x, texto: x })) },
    { n: "operacion", etq: "Operación", t: "select", op: opciones("operaciones") },
    { n: "precio_min", etq: "Precio desde (€)", t: "num" }, { n: "precio_max", etq: "Precio hasta (€)", t: "num" },
    { n: "orden", etq: "Ordenar por", t: "select", vacio: "Más recientes", op: [{ valor: "precio_asc", texto: "Precio: de menor a mayor" }, { valor: "precio_desc", texto: "Precio: de mayor a menor" }, { valor: "referencia", texto: "Referencia" }] },
  ], f, () => { f.offset = 0; cargar(); });
  const exp = boton("Exportar CSV", { icono: "descargar", href: api.urlDescarga("/api/exportar/inmuebles") });
  exp.setAttribute("download", "");
  cont.append(
    cabecera({ titulo: "Inmuebles", subtitulo: "Tu cartera: lo que tienes en preparación, a la venta y ya cerrado.", acciones: [
      boton("Nuevo inmueble", { clase: "primario", icono: "mas", onclick: async () => { const r = await nuevoInmueble(); if (r) location.hash = `#/inmuebles/${r.id}`; } }), exp] }),
    h("section", { class: "panel" }, filtros, h("div", { class: "filtros", style: { paddingTop: 0, borderBottom: 0 } }, selVista), zona));

  function pintarSelVista() {
    montar(selVista, ...["tabla", "tarjetas"].map((v) => boton(v === "tabla" ? "Tabla" : "Tarjetas", { clase: "peq", aria: undefined, onclick: () => { vista = v; guardarVista(v); pintarSelVista(); cargar(); } })));
    [...selVista.children].forEach((b, i) => { const v = ["tabla", "tarjetas"][i]; b.setAttribute("aria-pressed", String(vista === v)); if (vista === v) b.classList.add("primario"); });
  }

  async function cargar() {
    const r = await api.get("/api/inmuebles", { q: f.q, estado: f.estado, municipio: f.municipio, tipo: f.tipo, operacion: f.operacion, precio_min: f.precio_min.replace(/\D/g, ""), precio_max: f.precio_max.replace(/\D/g, ""), orden: f.orden, limite: LIMITE, offset: f.offset });
    const sinFiltros = !f.q && !f.estado && !f.municipio && !f.tipo && !f.operacion && !f.precio_min && !f.precio_max;
    const vacioMsg = r.total === 0 && sinFiltros
      ? vacio("Tu cartera está vacía", "Los inmuebles se crean al confirmar un encargo desde una oportunidad, o a mano con «Nuevo inmueble».", boton("Crear un inmueble", { clase: "primario", onclick: async () => { const x = await nuevoInmueble(); if (x) location.hash = `#/inmuebles/${x.id}`; } }))
      : vacio("Ningún inmueble coincide", "Prueba a quitar algún filtro.");
    let cuerpo;
    if (vista === "tarjetas" && r.datos.length) {
      cuerpo = h("div", { class: "tarjetas" }, r.datos.map((i) => h("a", { class: "tarjeta", href: `#/inmuebles/${i.id}` },
        h("div", { class: "ref" }, `${i.referencia} · ${etiqueta("operaciones", i.operacion)}`), h("div", { class: "precio" }, eur(i.precio_actual)), h("div", null, h("b", null, i.titulo)),
        h("div", { class: "ayuda" }, `${i.ubicacion_publica || i.municipio}`), h("div", { class: "ayuda" }, resumenCaract(i) || "Sin características indicadas"), h("div", null, chipDe("estados_comerciales", i.estado_comercial)))));
    } else {
      const cols = [
        { t: "Inmueble", c: (i) => h("div", null, h("a", { class: "enlace-fila", href: `#/inmuebles/${i.id}` }, i.titulo), h("span", { class: "sec" }, i.referencia)) },
        { t: "Ubicación pública", c: (i) => i.ubicacion_publica || i.municipio },
        { t: "Precio", num: true, c: (i) => eur(i.precio_actual) },
        { t: "Características", c: (i) => resumenCaract(i) || h("span", { class: "desconocido" }, "Sin indicar") },
        { t: "Estado", c: (i) => chipDe("estados_comerciales", i.estado_comercial) },
        { t: "Propietarios", c: (i) => i.propietarios || h("span", { class: "desconocido" }, "Sin asignar") },
      ];
      cuerpo = tabla(cols, r.datos, { ruta: (i) => `#/inmuebles/${i.id}` });
    }
    montar(zona, cuerpo || vacioMsg, r.total ? paginador(r, (o) => { f.offset = o; cargar(); }, "inmuebles") : null);
  }
  pintarSelVista();
  await cargar();
}

// ------------------------------------------------------------------ ficha ----
export async function detalle(cont, { partes }) {
  const i = await api.get(`/api/inmuebles/${partes[1]}`);
  document.title = `${i.referencia} · CAPTAOPORTUNIDADES ASTURIAS`;
  const rel = { inmueble_id: i.id };
  const selEstado = h("select", { "aria-label": "Estado comercial", style: { minWidth: "190px" }, onchange: async (e) => {
    const r = await conAviso(() => api.put(`/api/inmuebles/${i.id}`, { estado_comercial: e.target.value }), { ok: "Estado actualizado." });
    refrescar(); void r;
  } }, opciones("estados_comerciales").map((o) => h("option", { value: o.valor }, o.texto)));
  selEstado.value = i.estado_comercial;

  cont.append(cabecera({
    migas: [enlace("Inmuebles", "#/inmuebles"), " › ", i.referencia],
    titulo: i.titulo,
    subtitulo: h("span", null, `${i.referencia} · ${etiqueta("operaciones", i.operacion)} · ${i.tipo} · `, chipDe("estados_comerciales", i.estado_comercial)),
    acciones: [selEstado, boton("Editar", { clase: "primario", icono: "editar", onclick: async () => { if (await editarInmueble(i)) refrescar(); } }),
      boton("Nueva tarea", { onclick: async () => { if (await nuevaTarea({}, rel, i.referencia)) refrescar(); } }),
      boton("Registrar actividad", { onclick: async () => { if (await nuevaActividad(rel, i.referencia)) refrescar(); } })],
  }));
  for (const a of i.alertas) cont.append(aviso(a.nivel, a.texto));

  const ficha = datosLista([
    ["Precio actual", h("b", { style: { fontSize: "20px" } }, eur(i.precio_actual))],
    ["Superficie", dato(i.superficie_m2, (x) => `${num(x)} m² (${etiqueta("tipos_superficie", i.tipo_superficie).toLowerCase()})`)],
    ["Habitaciones", dato(i.habitaciones)], ["Baños", dato(i.banos)], ["Planta", dato(i.planta)],
    ["Ascensor", dato(si(i.ascensor))], ["Garaje", dato(si(i.garaje))], ["Terraza", dato(si(i.terraza))],
    ["Estado de conservación", dato(i.estado_conservacion, (x) => etiqueta("estados_conservacion", x))],
    ["Otras características", dato(i.caracteristicas), true],
  ]);
  const ubicacion = datosLista([
    ["Municipio", i.municipio], ["Zona", dato(i.zona)],
    ["Ubicación pública", h("span", null, dato(i.ubicacion_publica), " ", chip("Se puede publicar", "verde", { punto: false }))],
    ["Dirección interna", h("span", null, dato(i.direccion_interna), " ", h("span", { class: "interno" }, icono("candado"), "Interna, no publicar"))],
  ]);

  const pendientes = i.datos_pendientes.length ? h("div", { class: "chips" }, i.datos_pendientes.map((c) => h("span", { class: "chip ambar sin-punto" }, c.replace(/_/g, " "), " ",
    h("button", { type: "button", class: "btn peq suave", style: { minHeight: "22px", padding: "0 6px" }, title: "Marcar como confirmado", onclick: async () => { await conAviso(() => api.post(`/api/inmuebles/${i.id}/confirmar-dato`, { campo: c }), { ok: "Dato confirmado." }); refrescar(); } }, "Confirmar")))) : h("p", { class: "ayuda", style: { margin: 0 } }, "No hay datos pendientes de confirmar.");
  const faltan = i.datos_faltantes.length ? h("p", { class: "ayuda" }, "Faltan por completar: ", i.datos_faltantes.map((x) => x.nombre).join(", "), ".") : null;

  const propietarios = i.propietarios.length ? h("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" } }, i.propietarios.map((p) => h("li", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
    enlace(p.nombre_completo, `#/contactos/${p.contacto_id}`), p.principal ? chip("Principal", "azul", { punto: false }) : null, p.porcentaje ? chip(`${p.porcentaje} %`, "gris", { punto: false }) : null, p.no_contactar ? chip("No contactar", "rojo") : null,
    h("button", { type: "button", class: "btn peq suave", style: { marginLeft: "auto" }, "aria-label": `Quitar a ${p.nombre_completo}`, onclick: async () => {
      if (!(await confirmar({ titulo: "Quitar propietario", mensaje: `¿Quitar a ${p.nombre_completo} como propietario de ${i.referencia}? La persona no se borra.`, textoOk: "Quitar", peligro: true }))) return;
      try { await api.del(`/api/inmuebles/${i.id}/propietarios/${p.contacto_id}`); refrescar(); } catch (e) { toast(e.message, { tipo: "error", ms: 9000 }); }
    } }, "Quitar")))) : h("p", { class: "ayuda", style: { margin: 0 } }, "Todavía no hay propietario asignado.");

  const precios = i.precios.length ? tabla([
    { t: "Fecha", c: (p) => fecha(p.fecha) }, { t: "Precio", num: true, c: (p) => eur(p.precio) },
    { t: "Variación", num: true, c: (p) => { const idx = i.precios.indexOf(p); const ant = i.precios[idx + 1]; if (!ant) return h("span", { class: "desconocido" }, "Precio inicial"); const d = p.precio - ant.precio; return `${d > 0 ? "+" : ""}${eur(d)}`; } },
    { t: "Motivo", c: (p) => dato(p.motivo) },
  ], i.precios) : h("p", { class: "ayuda", style: { margin: 0 } }, "Aún no hay precio registrado.");

  const encargos = i.encargos.length ? h("div", { style: { display: "grid", gap: "12px" } }, i.encargos.map((e) => h("div", { class: "panel", style: { boxShadow: "none" } }, h("div", { class: "cuerpo" },
    h("div", { class: "chips", style: { marginBottom: "8px" } }, chipDe("estados_encargo", e.estado_efectivo), chip(etiqueta("tipos_encargo", e.tipo), "gris", { punto: false }), e.exclusividad ? chip("Exclusiva", "azul", { punto: false }) : null),
    datosLista([
      ["Fecha del encargo", fecha(e.fecha_encargo)],
      ["Vigencia hasta", e.vigencia_hasta ? h("span", null, fecha(e.vigencia_hasta), e.estado === "vigente" && e.dias_para_vencer !== null ? ` (${e.dias_para_vencer >= 0 ? `quedan ${e.dias_para_vencer} día(s)` : `venció hace ${-e.dias_para_vencer} día(s)`})` : "") : dato(null)],
      ["Honorarios", e.honorarios_tipo === "sin_definir" ? dato(null) : e.honorarios_tipo === "porcentaje" ? `${num(e.honorarios_valor)} %` : eur(e.honorarios_valor)],
      ["Condiciones", dato(e.honorarios_notas), true], ["Notas", dato(e.notas), true],
    ]),
    h("div", { style: { marginTop: "10px" } }, boton("Editar encargo", { clase: "peq", icono: "editar", onclick: async () => { if (await formularioEncargo(i, e)) refrescar(); } })))))) : h("p", { class: "ayuda", style: { margin: 0 } }, "Este inmueble no tiene ningún encargo registrado.");

  const cap = i.captacion;
  const panelCap = cap ? panel("Historial de captación", [
    h("p", { style: { marginTop: 0 } }, "Nació de la oportunidad ", enlace(cap.oportunidad.identificador, `#/oportunidades/${cap.oportunidad.id}`), ` (${etiqueta("estados_oportunidad", cap.oportunidad.estado)}), detectada el ${fecha(cap.oportunidad.fecha_deteccion)} por ${cap.oportunidad.fuente}.`),
    cap.oportunidad.notas ? datosLista([["Notas de la captación", cap.oportunidad.notas, true]]) : null,
    h("h3", { style: { margin: "12px 0 8px" } }, "Cambios de estado de la oportunidad"), listaCambios(cap.cambios.filter((c) => c.campo === "estado" || c.accion === "crear" || c.accion === "vincular")),
    cap.actividades.length ? [h("h3", { style: { margin: "12px 0 8px" } }, "Conversaciones de la captación"), listaActividades(cap.actividades)] : null,
  ]) : null;

  cont.append(h("div", { class: "col-ppal" },
    h("div", null,
      panel("Ficha", ficha),
      panel("Ubicación", ubicacion),
      panel("Datos pendientes de confirmar", [pendientes, faltan, h("p", { class: "nota-legal" }, "Los datos que vienen de un anuncio no están verificados hasta que se confirman (visita, nota simple, documentación…).")]),
      panel("Descripción comercial", i.descripcion_comercial ? h("p", { style: { margin: 0, whiteSpace: "pre-wrap" } }, i.descripcion_comercial) : h("span", { class: "desconocido" }, "Sin descripción. Escríbela con datos confirmados; no ocultes defectos relevantes.")),
      panel("Notas internas", i.notas_internas ? h("p", { style: { margin: 0, whiteSpace: "pre-wrap" } }, i.notas_internas) : h("span", { class: "desconocido" }, "Sin notas.")),
      panelCap,
      panel("Fotografías y documentos", vacio("Llegan en la Fase 2", "Aquí podrás subir fotos y documentos, elegir la foto principal y separar el material interno del publicable. De momento no se guarda ningún archivo."), { clase: "" }),
    ),
    h("div", null,
      panel("Propietarios", propietarios, { acciones: boton("Añadir", { clase: "peq", icono: "mas", onclick: async () => { if (await anadirPropietario(i)) refrescar(); } }) }),
      panel("Encargos", [encargos, h("p", { class: "nota-legal", style: { marginTop: "12px" } }, "El CRM solo registra el encargo; no genera ni firma contratos. Cualquier plantilla contractual es un borrador pendiente de revisión profesional."), h("div", null, boton("Nuevo encargo", { clase: "peq", icono: "mas", onclick: async () => { if (await formularioEncargo(i, null)) refrescar(); } }))]),
      panel("Historial de precios", precios, { acciones: boton("Cambiar precio", { clase: "peq", onclick: async () => { if (await cambiarPrecio(i)) refrescar(); } }) }),
      panel("Tareas pendientes", listaTareasFicha(i.tareas), { acciones: boton("Nueva", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaTarea({}, rel, i.referencia)) refrescar(); } }) }),
      panel("Actividad", listaActividades(i.actividades, { alAnadir: async () => { if (await nuevaActividad(rel, i.referencia)) refrescar(); } })),
      panel("Historial de cambios", listaCambios(i.cambios)),
    )));

  cont.append(h("div", { class: "chips", style: { marginTop: "24px" } },
    i.estado_comercial !== "archivado" ? boton("Archivar inmueble", { clase: "peq", onclick: async () => { if (await confirmar({ titulo: "Archivar", mensaje: "Deja de contar como activo y se conserva todo el historial.", textoOk: "Archivar" })) { await conAviso(() => api.put(`/api/inmuebles/${i.id}`, { estado_comercial: "archivado" }), { ok: "Inmueble archivado." }); refrescar(); } } }) : null,
    boton("Eliminar inmueble", { clase: "borde-peligro peq", icono: "papelera", onclick: async () => {
      if (!(await confirmar({ titulo: "Eliminar inmueble", mensaje: `Se eliminará ${i.referencia} para siempre. Solo es posible si no tiene encargos ni historial de captación; si no, usa «Archivar».`, textoOk: "Eliminar", peligro: true }))) return;
      try { await api.del(`/api/inmuebles/${i.id}`); toast("Inmueble eliminado."); location.hash = "#/inmuebles"; } catch (e) { toast(e.message, { tipo: "error", ms: 10000 }); }
    } })));
}

