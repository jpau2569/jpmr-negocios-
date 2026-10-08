// ============================================================================
//  Diálogos con reglas de negocio: estado de oportunidad, verificación de
//  contacto, confirmación de encargo, habilitación de comunicaciones,
//  «No contactar», anonimizar, precios, encargos, propietarios y posponer.
// ============================================================================
import { h, abrirDialogo, boton, aviso, toast, confirmar, hoyIso, eur, nombreDe, fecha } from "./ui.js";
import { dialogoFormulario, nuevoContacto } from "./formularios.js";
import { api, ApiError, opciones, enums, etiqueta, catalogoActivo } from "./api.js";

/** Pide a la pantalla actual que se vuelva a pintar con datos nuevos. */
export const refrescar = () => window.dispatchEvent(new Event("captao:refrescar"));

// ------------------------------------------------- estado de oportunidad ----
export async function cambiarEstadoOportunidad(o, preseleccion) {
  const trans = o.transiciones.filter((t) => t.estado !== o.estado);
  const primero = preseleccion || trans.find((t) => t.ok)?.estado || trans[0].estado;
  const info = h("div");
  const pintarInfo = (estado, f, d) => {
    const t = trans.find((x) => x.estado === estado);
    info.replaceChildren();
    const ok = d.pie.querySelector('button[type="submit"]');
    if (!t) return;
    if (!t.ok) {
      const acciones = [];
      if (t.accion === "verificar") acciones.push(boton("Verificar contacto ahora", { clase: "peq", onclick: async () => { d.cerrar(null); if (await verificarContacto(o)) refrescar(); } }));
      if (t.via === "confirmar_encargo") acciones.push(boton("Confirmar encargo", { clase: "peq primario", onclick: async () => { d.cerrar(null); confirmarEncargo(o); } }));
      info.append(aviso("bloqueo", t.motivo, " ", ...acciones));
    }
    ok.disabled = !t.ok;
    const exigeMotivo = estado === "descartada" || estado === "no_contactar" || o.estado === "no_contactar";
    f.refs.motivo.caja.hidden = !exigeMotivo;
    f.refs.motivo.caja.querySelector("label").firstChild.textContent = estado === "descartada" ? "Motivo del descarte" : o.estado === "no_contactar" ? "Motivo para levantar el bloqueo" : "Motivo";
    f.refs.marcar_contacto.caja.hidden = !(estado === "no_contactar" && o.contacto && !o.contacto.no_contactar);
    f.refs.levantar_no_contactar.caja.hidden = o.estado !== "no_contactar";
  };
  return dialogoFormulario({
    titulo: `Cambiar el estado de ${o.identificador}`, clase: "estrecho", textoOk: "Cambiar estado",
    intro: h("div", null, h("p", { style: { marginTop: 0 } }, "Estado actual: ", h("b", null, etiqueta("estados_oportunidad", o.estado))), info),
    campos: [
      { n: "estado", t: "select", etq: "Nuevo estado", sinVacio: true, op: trans.map((t) => ({ valor: t.estado, texto: `${t.etiqueta}${t.ok ? "" : "  — no disponible"}` })), alEscribir: (v, refs) => pintarInfo(v, { refs }, ctlDialogo.d) },
      { n: "motivo", t: "texto", etq: "Motivo", oculto: true, lista: catalogoActivo("motivo_descarte"), max: 300, ayuda: "Obligatorio. Puedes elegir uno de la lista o escribir el tuyo." },
      { n: "marcar_contacto", t: "check", etq: `Marcar también a ${o.contacto?.nombre_completo || "la persona"} como «No contactar» (recomendado)`, oculto: true },
      { n: "levantar_no_contactar", t: "check", etq: "Confirmo que levanto el bloqueo «No contactar»", oculto: true, ayuda: "Hazlo solo si la persona ha vuelto a ponerse en contacto contigo." },
    ],
    valores: { estado: primero, marcar_contacto: true },
    alAbrir: (f, d) => { ctlDialogo.d = d; pintarInfo(primero, f, d); },
    enviar: (v) => api.post(`/api/oportunidades/${o.id}/estado`, v.estado === "no_contactar" ? v : { ...v, marcar_contacto: undefined }),
  }).then((r) => {
    if (r?.avisos?.length) for (const a of r.avisos) toast(a, { tipo: "aviso", ms: 9000 });
    return r;
  });
}
const ctlDialogo = { d: null };

// ----------------------------------------------- verificación de contacto ----
export async function verificarContacto(o) {
  return dialogoFormulario({
    titulo: "Verificar si se puede contactar", clase: "estrecho", textoOk: "Guardar verificación",
    intro: aviso("info", "Antes de pasar a contacto, anota cómo sabes que se puede contactar (por ejemplo: «la propia persona nos escribió», «el anuncio invita a contactar por el portal»). Es un registro interno, no una garantía legal."),
    campos: [
      { n: "verificacion_contacto", t: "select", etq: "Resultado", sinVacio: true, op: opciones("verificacion_contacto") },
      { n: "verificacion_evidencia", t: "largo", etq: "Evidencia", max: 500, filas: 3, ayuda: "Obligatoria si eliges «Contacto permitido»." },
    ],
    valores: { verificacion_contacto: o.verificacion_contacto, verificacion_evidencia: o.verificacion_evidencia },
    pieExtra: [boton("La propia persona nos contactó", { clase: "peq", onclick: (e) => {
      const form = e.target.closest("dialog").querySelector("form");
      form.querySelector("select").value = "permitido";
      form.querySelector("textarea").value = "La propia persona se puso en contacto con nosotros (entrante).";
    } })],
    enviar: (v) => api.put(`/api/oportunidades/${o.id}`, { ...v, version: o.actualizado_en }),
  });
}

// ------------------------------------------------------ confirmar encargo ----
export async function confirmarEncargo(o) {
  const previa = await api.get(`/api/oportunidades/${o.id}/encargo-previa`);
  const sim = previa.similares || [];
  const campos = [
    ...(o.contacto ? [] : [{ t: "seccion", etq: "Propietario" }, { n: "contacto_id", t: "contacto", etq: "¿Quién es el propietario?", req: true, ancho: "completo", crear: (q) => nuevoContacto({ nombre: q, es_propietario: true }) }]),
    ...(sim.length ? [
      { t: "seccion", etq: "Este inmueble podría estar ya en tu cartera" },
      { n: "inmueble_modo", t: "select", etq: "¿Qué hacemos?", req: true, ancho: "completo", sinVacio: false, vacio: "— Elige una opción —",
        op: [...sim.map((s) => ({ valor: `usar:${s.id}`, texto: `Usar ${s.referencia} · ${s.titulo} (${s.motivos.join(", ")})` })), { valor: "nuevo", texto: "Es otro distinto: crear un inmueble nuevo" }] },
    ] : []),
    ...(o.inmueble_id || sim.length ? [] : [
      { t: "seccion", etq: "Inmueble (se crea con los datos de la oportunidad)" },
      { n: "inm_precio", t: "num", etq: "Precio acordado con el propietario (€)", ancho: "mitad", ayuda: `Si lo dejas vacío se usará el del anuncio (${eur(o.precio_anunciado)}) y quedará «pendiente de confirmar».` },
      { n: "inm_planta", t: "texto", etq: "Planta", ancho: "mitad", max: 20 },
      { n: "inm_direccion", t: "texto", etq: "Dirección interna (no se publica)", ancho: "completo", max: 300 },
    ]),
    { t: "seccion", etq: "Encargo" },
    { n: "enc_tipo", t: "select", etq: "Tipo de encargo", ancho: "mitad", op: opciones("tipos_encargo"), sinVacio: true },
    { n: "enc_exclusividad", t: "check", etq: "Con exclusividad", ancho: "mitad" },
    { n: "enc_fecha", t: "fecha", etq: "Fecha del encargo", ancho: "mitad" },
    { n: "enc_vigencia", t: "fecha", etq: "Vigencia hasta", ancho: "mitad", ayuda: "Se crea un aviso de vencimiento automático." },
    { n: "enc_hon_tipo", t: "select", etq: "Honorarios", ancho: "mitad", op: opciones("honorarios_tipo"), sinVacio: true },
    { n: "enc_hon_valor", t: "num", etq: "Importe o porcentaje", ancho: "mitad" },
    { n: "enc_hon_notas", t: "texto", etq: "Condiciones de los honorarios", ancho: "completo", max: 500, ayuda: "Texto libre; no hace falta el IVA ni cálculos fiscales aquí." },
  ];
  const resultado = await dialogoFormulario({
    titulo: `Confirmar encargo · ${o.identificador}`, clase: "ancho", textoOk: "Confirmar encargo",
    intro: [
      aviso("info", "Se creará el inmueble (o se reutilizará el que elijas), se vinculará al propietario y la oportunidad quedará en «Encargo confirmado». El historial de captación se conserva."),
      h("p", { class: "nota-legal" }, "Este paso solo registra el encargo en el CRM. No genera ni firma ningún contrato: cualquier plantilla contractual es un borrador pendiente de revisión profesional."),
    ],
    campos, valores: { enc_tipo: "venta", enc_fecha: hoyIso(), enc_hon_tipo: "sin_definir", enc_exclusividad: false },
    enviar: async (v) => {
      const cuerpo = {
        encargo: { tipo: v.enc_tipo, exclusividad: v.enc_exclusividad, fecha_encargo: v.enc_fecha, vigencia_hasta: v.enc_vigencia, honorarios_tipo: v.enc_hon_tipo, honorarios_valor: v.enc_hon_valor, honorarios_notas: v.enc_hon_notas },
        inmueble: { precio_actual: v.inm_precio, planta: v.inm_planta, direccion_interna: v.inm_direccion },
        confirmar_duplicado: v.confirmar_duplicado,
      };
      if (v.contacto_id) cuerpo.contacto_id = v.contacto_id;
      if (sim.length) {
        if (!v.inmueble_modo) throw new ApiError(422, { error: { codigo: "validacion", mensaje: "Elige si usas el inmueble que ya tienes o creas uno nuevo.", campos: { inmueble_modo: "Elige una opción." } } });
        if (v.inmueble_modo === "nuevo") cuerpo.crear_nuevo = true; else cuerpo.inmueble_id = Number(v.inmueble_modo.split(":")[1]);
      }
      return api.post(`/api/oportunidades/${o.id}/confirmar-encargo`, cuerpo);
    },
  });
  if (resultado && resultado.inmueble) {
    toast(`Encargo confirmado. ${resultado.inmueble_reutilizado ? "Inmueble reutilizado" : "Inmueble creado"}: ${resultado.inmueble.referencia}.`, { ms: 7000 });
    location.hash = `#/inmuebles/${resultado.inmueble.id}`;
  }
  return resultado;
}

// ------------------------------------------- habilitación de comunicaciones ----
export async function editarHabilitaciones(c) {
  const bases = enums().bases_comunicacion;
  const porCanal = enums().bases_por_canal;
  const campos = [];
  const valores = {};
  for (const canal of enums().canales) {
    const k = canal.clave;
    const fila = c.comunicaciones.find((x) => x.canal === k);
    campos.push({ t: "seccion", etq: canal.etiqueta });
    campos.push({ n: `${k}__estado`, t: "select", etq: "Estado", ancho: "tercio", sinVacio: true, op: opciones("estados_habilitacion") });
    campos.push({ n: `${k}__base`, t: "select", etq: "Base", ancho: "tercio", vacio: "—", op: porCanal[k].map((b) => ({ valor: b, texto: bases.find((x) => x.clave === b).etiqueta })) });
    campos.push({ n: `${k}__fecha`, t: "fecha", etq: k === "telefono" ? "Fecha de la autorización o de la consulta Robinson" : "Fecha de la autorización", ancho: "tercio" });
    campos.push({ n: `${k}__evidencia`, t: "texto", etq: "Evidencia", ancho: "completo", max: 500, ayuda: k === "email" ? "Dónde consta: formulario web, correo recibido…" : undefined });
    valores[`${k}__estado`] = fila.estado;
    valores[`${k}__base`] = fila.base;
    valores[`${k}__fecha`] = fila.base === "robinson" ? fila.fecha_robinson : fila.estado === "baja" ? fila.fecha_baja : fila.fecha_autorizacion;
    valores[`${k}__evidencia`] = fila.evidencia;
  }
  return dialogoFormulario({
    titulo: `Comunicaciones · ${c.nombre_completo}`, clase: "ancho", textoOk: "Guardar habilitaciones",
    intro: [
      aviso("aviso", "Es un registro interno de la base y la evidencia de cada canal. ", h("b", null, "No garantiza el cumplimiento legal"), ": consúltalo con tu asesor. El correo, WhatsApp y SMS comerciales a particulares sin relación previa exigen consentimiento."),
      c.no_contactar ? aviso("bloqueo", "Esta persona figura como «No contactar»: no se puede habilitar ningún canal hasta levantar el bloqueo.") : null,
    ],
    campos, valores,
    enviar: async (v) => {
      const canales = [];
      for (const canal of enums().canales) {
        const k = canal.clave;
        const orig = c.comunicaciones.find((x) => x.canal === k);
        const estado = v[`${k}__estado`], base = v[`${k}__base`], ev = v[`${k}__evidencia`], f = v[`${k}__fecha`];
        const origF = orig.base === "robinson" ? orig.fecha_robinson : orig.estado === "baja" ? orig.fecha_baja : orig.fecha_autorizacion;
        const cambiado = estado !== orig.estado || (base || null) !== (orig.base || null) || (ev || null) !== (orig.evidencia || null) || (f || null) !== (origF || null);
        if (!cambiado) continue;
        const item = { canal: k, estado, base: base || undefined, evidencia: ev || undefined };
        if (estado === "habilitado") { if (base === "robinson") item.fecha_robinson = f; else item.fecha_autorizacion = f; }
        if (estado === "baja") item.fecha_baja = f || undefined;
        canales.push(item);
      }
      if (!canales.length) return { sinCambios: true };
      try { return await api.put(`/api/contactos/${c.id}/comunicaciones`, { canales }); }
      catch (e) {
        if (e instanceof ApiError && e.estado === 422) {
          // «email.base» → «email__base»; «email.fecha_autorizacion» → «email__fecha»
          const mapa = {};
          for (const [k, m] of Object.entries(e.campos)) { const [canal, campo] = k.split("."); mapa[`${canal}__${campo.startsWith("fecha") ? "fecha" : campo}`] = m; }
          throw new ApiError(422, { error: { codigo: "validacion", mensaje: "Revisa los canales marcados.", campos: mapa } });
        }
        throw e;
      }
    },
  });
}

// ------------------------------------------------------- no contactar ----
export async function marcarNoContactar(c) {
  const r = await dialogoFormulario({
    titulo: `Marcar como «No contactar» · ${c.nombre_completo}`, clase: "estrecho", textoOk: "Marcar como No contactar",
    intro: aviso("bloqueo", "Esto bloquea de verdad: sus oportunidades abiertas pasarán a «No contactar», se cancelarán sus tareas pendientes de llamada, WhatsApp y correo y no podrás preparar nuevas comunicaciones."),
    campos: [{ n: "motivo", t: "largo", etq: "Motivo", req: true, max: 300, filas: 2, ayuda: "Por ejemplo: «ha pedido no recibir más comunicaciones»." }],
    enviar: (v) => api.post(`/api/contactos/${c.id}/no-contactar`, v),
  });
  if (r) toast(`Marcado como «No contactar». Oportunidades afectadas: ${r.oportunidades_afectadas}. Tareas canceladas: ${r.tareas_canceladas}.`, { ms: 8000 });
  return r;
}
export async function levantarNoContactar(c) {
  return dialogoFormulario({
    titulo: "Levantar el bloqueo «No contactar»", clase: "estrecho", textoOk: "Levantar el bloqueo",
    intro: aviso("aviso", "Hazlo solo si la propia persona ha vuelto a ponerse en contacto contigo. Las oportunidades y tareas canceladas no se reabren solas."),
    campos: [{ n: "motivo", t: "largo", etq: "Motivo", req: true, max: 300, filas: 2 }],
    enviar: (v) => api.post(`/api/contactos/${c.id}/levantar-no-contactar`, v),
  });
}

export async function anonimizarContacto(c) {
  let extra = {};
  if (c.no_contactar) {
    const seguir = await confirmar({
      titulo: "Esta persona pidió no ser contactada", peligro: true, textoOk: "Entiendo, continuar",
      mensaje: "Si la anonimizas, ya no podrás reconocerla si vuelve a aparecer y se perderá el bloqueo efectivo. ¿Quieres continuar?",
    });
    if (!seguir) return null;
    extra = { confirmar_perdida_bloqueo: true };
  }
  const ok = await confirmar({
    titulo: "Anonimizar contacto", peligro: true, textoOk: "Anonimizar para siempre",
    mensaje: `Se borrarán el nombre, el teléfono, el correo, las notas y los textos libres de sus actividades, tareas, oportunidades y demandas. Se conservan los estados, importes y fechas. Revisa a mano lo que hayas escrito en inmuebles o descripciones que pueda nombrarla. Las copias de seguridad que ya hiciste conservan los datos originales: elimínalas si procede. Esta acción no se puede deshacer.`,
  });
  if (!ok) return null;
  try { return await api.post(`/api/contactos/${c.id}/anonimizar`, extra); }
  catch (e) { toast(e.message, { tipo: "error", ms: 9000 }); return null; }
}

// ---------------------------------------------------------- precios ----
export async function cambiarPrecio(i) {
  return dialogoFormulario({
    titulo: `Cambiar el precio de ${i.referencia}`, clase: "estrecho", textoOk: "Guardar precio",
    intro: h("p", { style: { marginTop: 0 } }, "Precio actual: ", h("b", null, eur(i.precio_actual)), ". El cambio queda en el historial de precios."),
    campos: [
      { n: "precio_actual", t: "num", etq: "Nuevo precio (€)", req: true },
      { n: "motivo_precio", t: "texto", etq: "Motivo", max: 200, ayuda: "Por ejemplo: «bajada pactada con la propiedad»." },
    ],
    valores: { precio_actual: i.precio_actual },
    enviar: (v) => api.put(`/api/inmuebles/${i.id}`, v),
  });
}

// ----------------------------------------------------------- encargos ----
export async function formularioEncargo(i, enc) {
  const campos = [
    { n: "tipo", t: "select", etq: "Tipo de encargo", ancho: "mitad", op: opciones("tipos_encargo"), sinVacio: true },
    { n: "exclusividad", t: "check", etq: "Con exclusividad", ancho: "mitad" },
    { n: "fecha_encargo", t: "fecha", etq: "Fecha del encargo", ancho: "mitad" },
    { n: "vigencia_hasta", t: "fecha", etq: "Vigencia hasta", ancho: "mitad", ayuda: "Se crea (y se mantiene) un aviso de vencimiento." },
    { n: "honorarios_tipo", t: "select", etq: "Honorarios", ancho: "mitad", op: opciones("honorarios_tipo"), sinVacio: true },
    { n: "honorarios_valor", t: "num", etq: "Importe (€) o porcentaje (%)", ancho: "mitad" },
    { n: "honorarios_notas", t: "texto", etq: "Condiciones de los honorarios", max: 500 },
    ...(enc ? [{ n: "estado", t: "select", etq: "Estado del encargo", ancho: "mitad", op: opciones("estados_encargo"), sinVacio: true }] : []),
    { n: "notas", t: "largo", etq: "Notas", max: 1000, filas: 2 },
  ];
  return dialogoFormulario({
    titulo: enc ? "Editar encargo" : `Nuevo encargo · ${i.referencia}`, campos,
    intro: h("p", { class: "nota-legal", style: { marginTop: 0 } }, "Solo registra el encargo. No genera ni firma contratos; cualquier plantilla contractual es un borrador pendiente de revisión profesional."),
    valores: enc || { tipo: "venta", fecha_encargo: hoyIso(), honorarios_tipo: "sin_definir", exclusividad: false },
    enviar: (v) => (enc ? api.put(`/api/encargos/${enc.id}`, v) : api.post(`/api/inmuebles/${i.id}/encargos`, v)),
  });
}

// --------------------------------------------------------- propietarios ----
export async function anadirPropietario(i) {
  return dialogoFormulario({
    titulo: `Añadir propietario a ${i.referencia}`, clase: "estrecho", textoOk: "Añadir",
    campos: [
      { n: "contacto_id", t: "contacto", etq: "Propietario", req: true, crear: (q) => nuevoContacto({ nombre: q, es_propietario: true }) },
      { n: "porcentaje", t: "num", etq: "Porcentaje de propiedad (%)", ancho: "mitad", ayuda: "Opcional. Entre todos no pueden pasar de 100 %." },
    ],
    enviar: (v) => api.post(`/api/inmuebles/${i.id}/propietarios`, v),
  });
}

// ------------------------------------------------------------ posponer ----
export function posponerTarea(t) {
  return new Promise((resolve) => {
    let d;
    const ir = async (cuerpo) => {
      try { const r = await api.post(`/api/tareas/${t.id}/posponer`, cuerpo); d.cerrar(r); }
      catch (e) { toast(e.message, { tipo: "error", ms: 8000 }); }
    };
    const fecha_ = h("input", { type: "date", value: t.fecha, "aria-label": "Nueva fecha" });
    const hora_ = h("input", { type: "time", value: t.hora || "", "aria-label": "Nueva hora" });
    d = abrirDialogo({
      titulo: "Posponer tarea", clase: "estrecho",
      cuerpo: [
        h("p", { style: { marginTop: 0 } }, h("b", null, t.titulo)),
        h("div", { class: "chips" },
          boton("En 1 hora", { onclick: () => ir({ minutos: 60 }) }),
          boton("Mañana", { onclick: () => ir({ dias: 1 }) }),
          boton("En 3 días", { onclick: () => ir({ dias: 3 }) }),
          boton("En 1 semana", { onclick: () => ir({ dias: 7 }) })),
        h("hr", { class: "sep" }),
        h("div", { class: "form" }, h("div", { class: "campo mitad" }, h("label", { class: "etq" }, "Fecha concreta"), fecha_), h("div", { class: "campo mitad" }, h("label", { class: "etq" }, "Hora"), hora_)),
      ],
      pie: [boton("Cancelar", { onclick: () => d.cerrar(null) }), boton("Mover a esa fecha", { clase: "primario", onclick: () => ir({ fecha: fecha_.value, hora: hora_.value }) })],
    });
    d.cerrado.then((v) => resolve(v));
  });
}

export { nombreDe, fecha };
