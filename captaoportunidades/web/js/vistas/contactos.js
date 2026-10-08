// ============================================================================
//  Propietarios y contactos / Compradores: lista y ficha. Una persona = una
//  ficha con roles (puede ser propietaria y compradora). Incluye el control de
//  comunicaciones por canal y el bloqueo «No contactar».
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, eur, dato, conAviso, confirmar, toast, datosLista, enlace, nombreDe } from "../ui.js";
import { api, etiqueta, opciones } from "../api.js";
import { nuevoContacto, editarContacto, nuevaTarea, nuevaActividad, nuevaDemanda } from "../formularios.js";
import { editarHabilitaciones, marcarNoContactar, levantarNoContactar, anonimizarContacto, refrescar } from "../dialogos.js";
import { tabla, paginador, barraFiltros, filtrosDe, listaActividades, listaTareasFicha, listaCambios } from "./comun.js";

const LIMITE = 25;

function chipsRol(c) {
  return h("span", { class: "chips" }, c.es_propietario ? chip("Propietario", "azul", { punto: false }) : null, c.es_comprador ? chip("Comprador", "verde", { punto: false }) : null,
    c.no_contactar ? chip("No contactar", "rojo") : null, c.anonimizado_en ? chip("Anonimizado", "gris", { punto: false }) : null);
}

export async function lista(cont, { query, modo = "propietarios" }) {
  const comp = modo === "compradores";
  const f = filtrosDe(`contactos-${modo}`, { q: "", rol: comp ? "comprador" : "", no_contactar: "", offset: 0 }, query);
  const zona = h("div");
  const filtros = barraFiltros([
    { n: "q", etq: "Buscar", ph: "Nombre, teléfono o correo…", ancho: true },
    { n: "rol", etq: "Rol", t: "select", vacio: "Todos", op: [{ valor: "propietario", texto: "Propietarios" }, { valor: "comprador", texto: "Compradores" }, { valor: "ambos", texto: "Propietario y comprador" }, { valor: "sin_rol", texto: "Sin rol asignado" }] },
    { n: "no_contactar", etq: "Comunicaciones", t: "select", vacio: "Todos", op: [{ valor: "1", texto: "Solo «No contactar»" }] },
  ], f, () => { f.offset = 0; cargar(); });
  const nuevo = boton(comp ? "Nuevo comprador" : "Nuevo contacto", { clase: "primario", icono: "mas", onclick: async () => {
    const r = await nuevoContacto(comp ? { es_comprador: true } : { es_propietario: true });
    if (r) location.hash = `#/contactos/${r.id}`;
  } });
  const exp = boton("Exportar CSV", { icono: "descargar", href: api.urlDescarga("/api/exportar/contactos") });
  exp.setAttribute("download", "");
  const expSin = boton("Sin datos personales", { clase: "peq", href: api.urlDescarga("/api/exportar/contactos", { sin_personales: "1" }), titulo: "Exporta solo columnas sin teléfono, correo ni textos libres" });
  expSin.setAttribute("download", "");
  cont.append(
    cabecera({
      titulo: comp ? "Compradores" : "Propietarios y contactos",
      subtitulo: comp ? "Personas que buscan inmueble. Cada una puede tener varias demandas." : "Propietarios y otras personas con las que trabajas. Una persona puede ser propietaria y compradora a la vez, con una sola ficha.",
      acciones: [nuevo, exp, expSin] }),
    h("section", { class: "panel" }, filtros, zona));

  async function cargar() {
    const r = await api.get("/api/contactos", { q: f.q, rol: f.rol, no_contactar: f.no_contactar, limite: LIMITE, offset: f.offset });
    const cols = [
      { t: "Nombre", c: (c) => h("div", null, h("a", { class: "enlace-fila", href: `#/contactos/${c.id}` }, nombreDe(c)), c.empresa ? h("span", { class: "sec" }, c.empresa) : null) },
      { t: "Rol", c: chipsRol },
      { t: "Contacto", c: (c) => (c.telefono || c.email ? h("div", null, c.telefono || null, c.telefono && c.email ? h("br") : null, c.email ? h("span", { class: "sec" }, c.email) : null) : h("span", { class: "desconocido" }, "Sin datos")) },
      { t: "Procedencia", c: (c) => (c.procedencia ? etiqueta("procedencias", c.procedencia) : h("span", { class: "desconocido" }, "—")) },
      { t: "Inmuebles", num: true, c: (c) => c.n_inmuebles },
      { t: "Oportunidades", num: true, c: (c) => c.n_oportunidades },
      { t: "Demandas activas", num: true, c: (c) => c.n_demandas_activas },
    ];
    const sinFiltros = !f.q && !f.no_contactar && (!f.rol || (comp && f.rol === "comprador"));
    montar(zona,
      tabla(cols, r.datos, { ruta: (c) => `#/contactos/${c.id}`, vacioMsg: r.total === 0 && sinFiltros
        ? vacio(comp ? "Aún no hay compradores" : "Aún no hay contactos", "Crea la ficha de la persona y, si busca inmueble, añádele su demanda. No hace falta rellenar todo: solo el nombre.", boton("Crear el primero", { clase: "primario", onclick: async () => { const x = await nuevoContacto(comp ? { es_comprador: true } : { es_propietario: true }); if (x) location.hash = `#/contactos/${x.id}`; } }))
        : vacio("Ningún contacto coincide", "Prueba con otro nombre o quita algún filtro.") }),
      r.total ? paginador(r, (o) => { f.offset = o; cargar(); }, "contactos") : null);
  }
  await cargar();
}

export async function detalle(cont, { partes }) {
  const c = await api.get(`/api/contactos/${partes[1]}`);
  document.title = `${c.nombre_completo} · CAPTAOPORTUNIDADES ASTURIAS`;
  const rel = { contacto_id: c.id };

  const acciones = [
    c.anonimizado_en ? null : boton("Editar", { clase: "primario", icono: "editar", onclick: async () => { if (await editarContacto(c)) refrescar(); } }),
    boton("Registrar actividad", { onclick: async () => { if (await nuevaActividad(rel, c.nombre_completo)) refrescar(); } }),
    boton("Nueva tarea", { onclick: async () => { if (await nuevaTarea({}, rel, c.nombre_completo)) refrescar(); } }),
    c.anonimizado_en ? null : boton("Nueva demanda", { onclick: async () => { if (await nuevaDemanda({ contacto_id: c.id, contacto_id__etq: c.nombre_completo })) refrescar(); } }),
    c.anonimizado_en ? null : c.no_contactar
      ? boton("Levantar «No contactar»", { onclick: async () => { if (await levantarNoContactar(c)) refrescar(); } })
      : boton("Marcar «No contactar»", { clase: "borde-peligro", onclick: async () => { if (await marcarNoContactar(c)) refrescar(); } }),
  ];
  cont.append(cabecera({ migas: [enlace(c.es_comprador && !c.es_propietario ? "Compradores" : "Propietarios y contactos", c.es_comprador && !c.es_propietario ? "#/compradores" : "#/propietarios"), " › ", c.nombre_completo], titulo: c.nombre_completo, subtitulo: chipsRol(c), acciones }));
  for (const a of c.alertas) cont.append(aviso(a.nivel, a.texto));

  const datosPersona = datosLista([
    ["Teléfono", dato(c.telefono)], ["Correo", dato(c.email)], ["Empresa", dato(c.empresa)],
    ["Canal preferido", dato(c.canal_preferido, (x) => etiqueta("canal_preferido", x))],
    ["Procedencia de los datos", dato(c.procedencia, (x) => etiqueta("procedencias", x) + (c.procedencia_detalle ? ` — ${c.procedencia_detalle}` : "")), true],
    ["Alta", dato(c.creado_en, fecha)],
  ]);
  const venta = datosLista([
    ["Motivo de venta (manifestado)", dato(c.motivo_venta), true],
    ["Plazo previsto", dato(c.plazo_venta, (x) => etiqueta("plazos_venta", x))],
    ["Notas", dato(c.notas), true],
  ]);

  const colsCom = [
    { t: "Canal", c: (x) => h("b", null, etiqueta("canales", x.canal)) },
    { t: "Estado", c: (x) => chipDe("estados_habilitacion", x.estado) },
    { t: "Base", c: (x) => dato(x.base, (b) => etiqueta("bases_comunicacion", b)) },
    { t: "Fecha", c: (x) => dato(x.estado === "baja" ? x.fecha_baja : x.base === "robinson" ? x.fecha_robinson : x.fecha_autorizacion, fecha) },
    { t: "Evidencia", c: (x) => dato(x.evidencia) },
  ];
  const panelCom = panel("Comunicaciones por canal", [
    tabla(colsCom, c.comunicaciones),
    h("p", { class: "nota-legal", style: { marginTop: "12px" } }, "Registro interno de la base y la evidencia de cada canal. No garantiza el cumplimiento legal: consúltalo con tu asesor. El correo, WhatsApp y SMS comerciales a particulares sin relación previa exigen consentimiento."),
    c.anonimizado_en ? null : boton("Editar habilitaciones", { clase: "peq", icono: "editar", onclick: async () => { if (await editarHabilitaciones(c)) refrescar(); } }),
  ], { sinPadding: false });

  const relaciones = [
    c.inmuebles.length ? h("div", null, h("h3", null, "Inmuebles"), h("ul", null, c.inmuebles.map((i) => h("li", null, enlace(`${i.referencia} · ${i.titulo}`, `#/inmuebles/${i.id}`), " ", chipDe("estados_comerciales", i.estado_comercial), i.porcentaje ? ` · ${i.porcentaje} %` : "")))) : null,
    c.oportunidades.length ? h("div", null, h("h3", null, "Oportunidades"), h("ul", null, c.oportunidades.map((o) => h("li", null, enlace(`${o.identificador} · ${o.titulo || `${o.tipo_inmueble} en ${o.municipio}`}`, `#/oportunidades/${o.id}`), " ", chipDe("estados_oportunidad", o.estado))))) : null,
    c.demandas.length ? h("div", null, h("h3", null, "Demandas"), h("ul", null, c.demandas.map((d) => h("li", null, enlace(d.nombre || `Demanda ${d.id}`, `#/demandas/${d.id}`), " ", chipDe("estados_demanda", d.estado), d.presupuesto_max ? ` · hasta ${eur(d.presupuesto_max)}` : "")))) : null,
  ].filter(Boolean);

  cont.append(h("div", { class: "col-ppal" },
    h("div", null,
      panel("Datos de contacto", datosPersona),
      c.anonimizado_en ? null : panel("Venta (solo lo que ha manifestado)", [venta, h("p", { class: "nota-legal" }, "Anota solo lo que haya dicho la propia persona. No se infieren circunstancias personales ni urgencias.")]),
      panelCom,
      panel("Relaciones", relaciones.length ? relaciones : h("p", { class: "ayuda", style: { margin: 0 } }, "Aún no está relacionado con ningún inmueble, oportunidad ni demanda.")),
    ),
    h("div", null,
      panel("Actividad y conversaciones", listaActividades(c.actividades, {
        alAnadir: async () => { if (await nuevaActividad(rel, c.nombre_completo)) refrescar(); },
        alBorrar: async (a) => { if (await confirmar({ titulo: "Eliminar actividad", mensaje: "Se borrará este apunte del historial.", textoOk: "Eliminar", peligro: true })) { await conAviso(() => api.del(`/api/actividades/${a.id}`)); refrescar(); } },
      }), { acciones: c.actividades.length ? boton("Registrar", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaActividad(rel, c.nombre_completo)) refrescar(); } }) : null }),
      panel("Tareas pendientes", listaTareasFicha(c.tareas), { acciones: boton("Nueva", { clase: "peq", icono: "mas", onclick: async () => { if (await nuevaTarea({}, rel, c.nombre_completo)) refrescar(); } }) }),
      panel("Historial de cambios", listaCambios(c.cambios)),
    )));

  cont.append(panel("Privacidad", [
    h("p", { style: { marginTop: 0 } }, "Anonimizar borra el nombre, el teléfono, el correo, las notas y el texto de sus actividades, pero conserva los registros relacionados sin identificar a la persona. Eliminar solo es posible si no tiene inmuebles, oportunidades ni demandas."),
    h("div", { class: "chips" },
      c.anonimizado_en ? null : boton("Anonimizar", { clase: "borde-peligro", onclick: async () => { const r = await anonimizarContacto(c); if (r) { toast("Contacto anonimizado."); refrescar(); } } }),
      boton("Eliminar contacto", { clase: "borde-peligro", icono: "papelera", onclick: async () => {
        if (!(await confirmar({ titulo: "Eliminar contacto", mensaje: `Se eliminará ${c.nombre_completo} y sus actividades y tareas propias. No se puede deshacer.`, textoOk: "Eliminar", peligro: true }))) return;
        let extra = "";
        if (c.no_contactar) {
          if (!(await confirmar({ titulo: "Esta persona pidió no ser contactada", peligro: true, textoOk: "Entiendo, eliminar", mensaje: "Si la eliminas ya no podrás reconocerla si vuelve a aparecer y se perderá el bloqueo efectivo." }))) return;
          extra = "?confirmar_perdida_bloqueo=1";
        }
        try { await api.del(`/api/contactos/${c.id}${extra}`); toast("Contacto eliminado."); location.hash = "#/propietarios"; }
        catch (e) { toast(e.message, { tipo: "error", ms: 10000 }); }
      } })),
  ], { clase: "" }));
}
