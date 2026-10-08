// ============================================================================
//  Oportunidades: lista con embudo y filtros + ficha con estado, verificación
//  de contacto, confirmación de encargo, actividad, tareas e historial.
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, eur, num, dato, urlSegura, conAviso, confirmar, toast, datosLista, enlace, icono } from "../ui.js";
import { api, etiqueta, opciones, catalogoActivo, enums } from "../api.js";
import { nuevaOportunidad, editarOportunidad, nuevaTarea, nuevaActividad } from "../formularios.js";
import { cambiarEstadoOportunidad, verificarContacto, confirmarEncargo, refrescar } from "../dialogos.js";
import { tabla, paginador, barraFiltros, filtrosDe, listaActividades, listaTareasFicha, listaCambios } from "./comun.js";

const LIMITE = 25;

export async function lista(cont, { query }) {
  const f = filtrosDe("oportunidades", { q: "", estado: "", fuente: "", municipio: "", clasificacion: "", orden: "", offset: 0 }, query);
  const chipsEmbudo = h("div", { class: "embudo-chips", role: "group", "aria-label": "Filtrar por estado" });
  const zona = h("div");
  const filtros = barraFiltros([
    { n: "q", etq: "Buscar", ph: "Identificador, título, zona…", ancho: true },
    { n: "fuente", etq: "Fuente", t: "select", op: catalogoActivo("fuente").map((x) => ({ valor: x, texto: x })) },
    { n: "municipio", etq: "Municipio", lista: catalogoActivo("municipio") },
    { n: "clasificacion", etq: "Anunciante", t: "select", op: opciones("clasificacion_anunciante") },
    { n: "orden", etq: "Ordenar por", t: "select", vacio: "Más recientes", op: [{ valor: "antiguas", texto: "Más antiguas" }, { valor: "precio_desc", texto: "Precio: de mayor a menor" }, { valor: "precio_asc", texto: "Precio: de menor a mayor" }, { valor: "proxima", texto: "Próxima acción" }] },
  ], f, () => { f.offset = 0; cargar(); });

  const nueva = boton("Nueva oportunidad", { clase: "primario", icono: "mas", onclick: async () => { const r = await nuevaOportunidad(); if (r) location.hash = `#/oportunidades/${r.id}`; } });
  const exportar = boton("Exportar CSV", { icono: "descargar", href: api.urlDescarga("/api/exportar/oportunidades") });
  exportar.setAttribute("download", "");
  cont.append(
    cabecera({ titulo: "Oportunidades", subtitulo: "Propietarios y anuncios que quieres captar, desde que los detectas hasta que firman el encargo.", acciones: [nueva, exportar] }),
    chipsEmbudo, h("section", { class: "panel" }, filtros, zona));

  async function cargar() {
    const r = await api.get("/api/oportunidades", { q: f.q, estado: f.estado, fuente: f.fuente, municipio: f.municipio, clasificacion: f.clasificacion, orden: f.orden, limite: LIMITE, offset: f.offset });
    const totalTodas = Object.values(r.conteo_estados).reduce((a, b) => a + b, 0);
    const abiertas = Object.entries(r.conteo_estados).filter(([k]) => !["encargo_confirmado", "descartada", "no_contactar"].includes(k)).reduce((a, [, n]) => a + n, 0);
    const chipB = (valor, texto, n) => h("button", { type: "button", "aria-pressed": String(f.estado === valor), onclick: () => { f.estado = f.estado === valor ? "" : valor; f.offset = 0; cargar(); } }, texto, h("b", null, n));
    montar(chipsEmbudo, chipB("", "Todas", totalTodas), chipB("abiertas", "Abiertas", abiertas),
      ...enums().estados_oportunidad.map((e) => chipB(e.clave, e.etiqueta, r.conteo_estados[e.clave] || 0)));
    const cols = [
      { t: "Oportunidad", c: (o) => h("div", null, h("a", { class: "enlace-fila", href: `#/oportunidades/${o.id}` }, o.titulo || `${o.tipo_inmueble} en ${o.municipio}`), h("span", { class: "sec" }, `${o.identificador} · ${o.municipio}${o.zona ? ` · ${o.zona}` : ""}`)) },
      { t: "Precio", num: true, c: (o) => eur(o.precio_anunciado) },
      { t: "Fuente", c: (o) => o.fuente },
      { t: "Estado", c: (o) => h("div", null, chipDe("estados_oportunidad", o.estado), h("span", { class: "sec" }, `${o.dias_en_estado} día(s) en este estado`)) },
      { t: "Propietario", c: (o) => (o.contacto_id ? h("span", null, [o.contacto_nombre, o.contacto_apellidos].filter(Boolean).join(" "), o.contacto_no_contactar ? [" ", chip("No contactar", "rojo")] : null) : h("span", { class: "desconocido" }, "Sin asignar")) },
      { t: "Próxima acción", c: (o) => (o.proxima_accion ? h("span", null, o.proxima_accion, o.proxima_accion_fecha ? h("span", { class: "sec" }, fecha(o.proxima_accion_fecha)) : null) : h("span", { class: "desconocido" }, "—")) },
    ];
    montar(zona,
      tabla(cols, r.datos, { ruta: (o) => `#/oportunidades/${o.id}`, vacioMsg: r.total === 0 && !f.q && !f.estado && !f.fuente && !f.municipio && !f.clasificacion && totalTodas === 0
        ? vacio("Aún no tienes oportunidades", "Registra aquí cada anuncio o propietario interesante que detectes. Solo hacen falta la fuente, el tipo de inmueble y el municipio.", boton("Registrar la primera oportunidad", { clase: "primario", onclick: async () => { const x = await nuevaOportunidad(); if (x) location.hash = `#/oportunidades/${x.id}`; } }))
        : vacio("Ninguna oportunidad coincide", "Prueba a quitar algún filtro.", boton("Quitar filtros", { onclick: () => { Object.assign(f, { q: "", estado: "", fuente: "", municipio: "", clasificacion: "", orden: "", offset: 0 }); refrescar(); } })) }),
      r.total ? paginador(r, (o) => { f.offset = o; cargar(); }, "oportunidades") : null);
  }
  await cargar();
}

// ------------------------------------------------------------------ ficha ----
export async function detalle(cont, { partes }) {
  const id = partes[1];
  const o = await api.get(`/api/oportunidades/${id}`);
  const titulo = o.titulo || `${o.tipo_inmueble} en ${o.municipio}`;
  const cerrada = ["descartada", "no_contactar"].includes(o.estado);
  const confirmada = o.estado === "encargo_confirmado";
  document.title = `${o.identificador} · CAPTAOPORTUNIDADES ASTURIAS`;

  const acciones = [
    confirmada ? null : boton("Cambiar estado", { clase: "primario", onclick: async () => { if (await cambiarEstadoOportunidad(o)) refrescar(); } }),
    !confirmada && !cerrada ? boton("Confirmar encargo", { icono: "check", onclick: () => confirmarEncargo(o) }) : null,
    boton("Editar", { icono: "editar", onclick: async () => { if (await editarOportunidad(o)) refrescar(); } }),
    boton("Nueva tarea", { onclick: async () => { if (await nuevaTarea({}, { oportunidad_id: o.id, contacto_id: o.contacto?.id }, o.identificador)) refrescar(); } }),
    boton("Registrar actividad", { onclick: async () => { if (await nuevaActividad({ oportunidad_id: o.id, contacto_id: o.contacto?.id }, o.identificador)) refrescar(); } }),
  ];

  cont.append(cabecera({
    migas: [enlace("Oportunidades", "#/oportunidades"), " › ", o.identificador],
    titulo,
    subtitulo: h("span", null, `${o.identificador} · detectada el ${fecha(o.fecha_deteccion)} · `, chipDe("estados_oportunidad", o.estado), ` · ${o.dias_en_estado} día(s) en este estado`),
    acciones,
  }));
  for (const a of o.alertas) cont.append(aviso(a.nivel, a.texto));
  if (confirmada && o.inmueble) cont.append(aviso("ok", "Encargo confirmado. Inmueble creado: ", enlace(`${o.inmueble.referencia} · ${o.inmueble.titulo}`, `#/inmuebles/${o.inmueble.id}`), ". Esta oportunidad es ahora su historial de captación y no se puede borrar."));

  const url = urlSegura(o.enlace);
  const datosAnuncio = datosLista([
    ["Fuente", o.fuente + (o.fuente_detalle ? ` · ${o.fuente_detalle}` : "")],
    ["Enlace", url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, "Abrir el anuncio ↗") : dato(null)],
    ["Tipo", o.tipo_inmueble], ["Municipio", o.municipio], ["Zona", dato(o.zona)],
    ["Precio anunciado", dato(o.precio_anunciado, eur)], ["Superficie", dato(o.superficie_m2, (x) => num(x, "m²"))],
    ["Habitaciones", dato(o.habitaciones)], ["Baños", dato(o.banos)],
    ["Características conocidas", dato(o.caracteristicas), true],
  ]);

  const anunciante = datosLista([
    ["Clasificación", chip(etiqueta("clasificacion_anunciante", o.clasificacion_anunciante), o.clasificacion_anunciante === "profesional" ? "ambar" : o.clasificacion_anunciante === "particular" ? "verde" : "gris")],
    ["Evidencia de la clasificación", dato(o.evidencia_clasificacion), true],
  ]);

  const verif = datosLista([
    ["Contacto", chip(etiqueta("verificacion_contacto", o.verificacion_contacto), o.verificacion_contacto === "permitido" ? "verde" : o.verificacion_contacto === "no_permitido" ? "rojo" : "ambar")],
    ["Verificado el", dato(o.verificacion_fecha, fecha)],
    ["Evidencia", dato(o.verificacion_evidencia), true],
  ]);

  const prop = o.contacto
    ? h("div", null, h("a", { href: `#/contactos/${o.contacto.id}`, style: { fontWeight: 700 } }, o.contacto.nombre_completo), o.contacto.no_contactar ? [" ", chip("No contactar", "rojo")] : null,
      h("div", { class: "ayuda" }, [o.contacto.telefono, o.contacto.email].filter(Boolean).join(" · ") || "Sin teléfono ni correo registrados"))
    : h("span", { class: "desconocido" }, "Todavía no hay un propietario relacionado. Edita la oportunidad para asignarlo.");

  const etapas = enums().estados_oportunidad;
  const idxActual = etapas.findIndex((e) => e.clave === o.estado);
  const lineales = etapas.filter((e) => e.grupo !== "cerrada");
  const cerradas = etapas.filter((e) => e.grupo === "cerrada");
  const fila = (e, i) => {
    const t = o.transiciones.find((x) => x.estado === e.clave);
    const actual = e.clave === o.estado;
    const hecha = !cerrada && etapas.findIndex((x) => x.clave === e.clave) < idxActual;
    return h("li", { class: `${actual ? "actual" : ""} ${hecha ? "hecha" : ""} ${e.grupo === "cerrada" ? "cerrada" : ""} ${t && !t.ok && !actual ? "bloqueada" : ""}` },
      h("button", { type: "button", "aria-current": actual ? "step" : undefined, disabled: confirmada && !actual, title: t && !t.ok && !actual ? t.motivo : "Cambiar a este estado",
        onclick: async () => {
          if (actual) return;
          if (e.clave === "encargo_confirmado") { confirmarEncargo(o); return; }
          if (await cambiarEstadoOportunidad(o, e.clave)) refrescar();
        } },
      h("span", { class: "punto" }, hecha ? icono("check") : String(i + 1)), h("span", null, e.etiqueta)));
  };

  cont.append(h("div", { class: "col-ppal" },
    h("div", null,
      panel("Datos del anuncio", datosAnuncio),
      panel("Propietario relacionado", prop),
      panel("Anunciante", anunciante),
      panel("Verificación de contacto", [verif, h("p", { class: "nota-legal" }, "Es un registro interno de cómo sabes que se puede contactar. No sustituye la revisión de tu asesor."), boton("Verificar o actualizar", { clase: "peq", onclick: async () => { if (await verificarContacto(o)) refrescar(); } })]),
      panel("Seguimiento", datosLista([["Responsable", dato(o.responsable)], ["Próxima acción", dato(o.proxima_accion)], ["Fecha de la próxima acción", dato(o.proxima_accion_fecha, fecha)], cerrada ? ["Motivo", dato(o.motivo_descarte), true] : null, ["Notas", dato(o.notas), true]])),
      o.inmueble ? panel("Inmueble resultante", h("div", null, enlace(`${o.inmueble.referencia} · ${o.inmueble.titulo}`, `#/inmuebles/${o.inmueble.id}`), h("div", { class: "ayuda" }, `${etiqueta("estados_comerciales", o.inmueble.estado_comercial)} · ${eur(o.inmueble.precio_actual)}`))) : null,
    ),
    h("div", null,
      panel("Etapas", [h("ol", { class: "etapas" }, lineales.map(fila)), h("hr", { class: "sep" }), h("div", { class: "ayuda", style: { marginBottom: "6px" } }, "Cerrar sin encargo"), h("ol", { class: "etapas" }, cerradas.map((e) => fila(e, etapas.indexOf(e))))]),
      panel("Actividad", listaActividades(o.actividades, {
        alAnadir: async () => { if (await nuevaActividad({ oportunidad_id: o.id, contacto_id: o.contacto?.id }, o.identificador)) refrescar(); },
        alBorrar: async (a) => { if (await confirmar({ titulo: "Eliminar actividad", mensaje: "Se borrará este apunte del historial.", textoOk: "Eliminar", peligro: true })) { await conAviso(() => api.del(`/api/actividades/${a.id}`)); refrescar(); } },
      }), { acciones: o.actividades.length ? boton("Registrar", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaActividad({ oportunidad_id: o.id, contacto_id: o.contacto?.id }, o.identificador)) refrescar(); } }) : null }),
      panel("Tareas", listaTareasFicha(o.tareas.filter((t) => ["pendiente", "en_curso"].includes(t.estado))), { acciones: boton("Nueva", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaTarea({}, { oportunidad_id: o.id, contacto_id: o.contacto?.id }, o.identificador)) refrescar(); } }) }),
      panel("Historial de cambios", listaCambios(o.cambios)),
    )));

  if (!o.inmueble_id) {
    cont.append(h("div", { style: { marginTop: "24px" } }, boton("Eliminar esta oportunidad", { clase: "borde-peligro peq", icono: "papelera", onclick: async () => {
      if (!(await confirmar({ titulo: "Eliminar oportunidad", mensaje: `Se borrarán ${o.identificador} y sus actividades y tareas. Esta acción no se puede deshacer. Si solo ya no te interesa, es mejor descartarla: se conserva el historial.`, textoOk: "Eliminar", peligro: true }))) return;
      if (await conAviso(() => api.del(`/api/oportunidades/${o.id}`), { ok: "Oportunidad eliminada." })) location.hash = "#/oportunidades";
    } })));
  }
}
