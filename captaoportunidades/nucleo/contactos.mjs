// ============================================================================
//  Contactos (propietarios, compradores y otras personas) y control de
//  comunicaciones.
//  - Una persona = una ficha, con roles (puede ser propietario y comprador).
//  - Duplicados: se AVISA con candidatos; nunca se fusiona automáticamente.
//  - "No contactar" bloquea de verdad: pasa las oportunidades abiertas a
//    "No contactar" y cancela las tareas de llamada/mensaje/correo pendientes.
//  - La habilitación de comunicaciones se registra por canal, con base y
//    evidencia. Es un REGISTRO INTERNO: no garantiza cumplimiento legal.
// ============================================================================
import { insertar, actualizar, hidratar } from "./bd.mjs";
import { limpiar, exige, CONTACTO, HABILITACION } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { patronLike, paginacion } from "./config.mjs";
import {
  noEncontrado, invalido, conflicto, normaliza, telefonoNorm, emailNorm, sello, hoy,
} from "./util.mjs";
import { CANALES, BASES_POR_CANAL, CANAL_DE_TAREA, etiquetaDe, BASES_COMUNICACION } from "./catalogos.mjs";

const ANONIMO = "Contacto anonimizado";

export function obtenerFila(ctx, id) {
  const f = ctx.bd.uno("SELECT * FROM contactos WHERE id = ?", [id]);
  if (!f) throw noEncontrado("El contacto");
  return f;
}

export function nombreCompleto(c) {
  return [c.nombre, c.apellidos].filter(Boolean).join(" ");
}

// ------------------------------------------------------------ duplicados ----
export function buscarDuplicados(ctx, { nombre, apellidos, telefono, email }, excluirId = null) {
  const cands = new Map();
  const anota = (r, motivo) => {
    const c = cands.get(r.id) || { id: r.id, nombre: nombreCompleto(r), telefono: r.telefono, email: r.email, motivos: [] };
    if (!c.motivos.includes(motivo)) c.motivos.push(motivo);
    cands.set(r.id, c);
  };
  const tel = telefonoNorm(telefono);
  const mail = emailNorm(email);
  const sel = "SELECT id, nombre, apellidos, telefono, email FROM contactos WHERE anonimizado_en IS NULL AND id IS NOT ?";
  if (tel) for (const r of ctx.bd.todos(`${sel} AND telefono_norm = ?`, [excluirId, tel])) anota(r, "mismo teléfono");
  if (mail) for (const r of ctx.bd.todos(`${sel} AND email_norm = ?`, [excluirId, mail])) anota(r, "mismo correo");
  const completo = normaliza([nombre, apellidos].filter(Boolean).join(" "));
  if (completo.includes(" ")) {
    for (const r of ctx.bd.todos(`${sel} AND norm(nombre || ' ' || COALESCE(apellidos, '')) = ?`, [excluirId, completo])) anota(r, "mismo nombre");
  }
  return [...cands.values()];
}

function exigeSinDuplicados(ctx, datos, excluirId, confirmar, soloFuertes = false) {
  let cands = buscarDuplicados(ctx, datos, excluirId);
  if (soloFuertes) cands = cands.filter((c) => c.motivos.some((m) => m !== "mismo nombre"));
  if (cands.length && !confirmar) {
    throw conflicto("duplicado_posible",
      "Puede que esta persona ya exista. Revisa los contactos parecidos: si es la misma, usa la ficha que ya tienes; si no, confirma que quieres crear otra.",
      { candidatos: cands });
  }
}

// ----------------------------------------------------------------- reglas ----
function reglasProcedencia(datos, errores) {
  if ((datos.telefono || datos.email) && !datos.procedencia) {
    errores.procedencia = "Indica de dónde has obtenido el teléfono o el correo (por ejemplo: «me lo facilitó la propia persona»).";
  }
  if (datos.procedencia === "otra" && !datos.procedencia_detalle) {
    errores.procedencia_detalle = "Describe la procedencia cuando eliges «Otra».";
  }
}

// ------------------------------------------------------------- consultas ----
export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion(q);
  const donde = ["1 = 1"];
  const p = [];
  if (q.q) {
    const texto = String(q.q);
    const partes = [
      "norm(c.nombre || ' ' || COALESCE(c.apellidos, '') || ' ' || COALESCE(c.empresa, '')) LIKE ? ESCAPE '\\'",
      "c.email_norm LIKE ? ESCAPE '\\'",
    ];
    p.push(patronLike(normaliza(texto)), patronLike(texto.trim().toLowerCase()));
    const digitos = texto.replace(/\D/g, "");
    if (digitos.length >= 3) { partes.push("c.telefono_norm LIKE ? ESCAPE '\\'"); p.push(patronLike(digitos)); }
    donde.push(`(${partes.join(" OR ")})`);
  }
  if (q.rol === "propietario") donde.push("c.es_propietario = 1");
  else if (q.rol === "comprador") donde.push("c.es_comprador = 1");
  else if (q.rol === "ambos") donde.push("c.es_propietario = 1 AND c.es_comprador = 1");
  else if (q.rol === "sin_rol") donde.push("c.es_propietario = 0 AND c.es_comprador = 0");
  if (q.no_contactar === "1" || q.no_contactar === true) donde.push("c.no_contactar = 1");
  if (q.canal_habilitado) {
    donde.push("EXISTS (SELECT 1 FROM contacto_comunicaciones k WHERE k.contacto_id = c.id AND k.canal = ? AND k.estado = 'habilitado')");
    p.push(q.canal_habilitado);
  }
  const orden = { nombre: "norm(c.nombre) ASC, norm(c.apellidos) ASC", reciente: "c.creado_en DESC, c.id DESC" }[q.orden] || "c.actualizado_en DESC, c.id DESC";
  const where = donde.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM contactos c WHERE ${where}`, p);
  const filas = ctx.bd.todos(
    `SELECT c.*,
       (SELECT COUNT(*) FROM inmueble_propietarios ip WHERE ip.contacto_id = c.id) AS n_inmuebles,
       (SELECT COUNT(*) FROM oportunidades o WHERE o.contacto_id = c.id) AS n_oportunidades,
       (SELECT COUNT(*) FROM demandas d WHERE d.contacto_id = c.id AND d.estado = 'activa') AS n_demandas_activas
     FROM contactos c WHERE ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`,
    [...p, limite, offset],
  );
  return { datos: filas, total, limite, offset };
}

export function habilitaciones(ctx, id) {
  const filas = ctx.bd.todos("SELECT * FROM contacto_comunicaciones WHERE contacto_id = ?", [id]);
  return CANALES.map((c) => {
    const f = filas.find((x) => x.canal === c.clave);
    return f || { contacto_id: id, canal: c.clave, estado: "sin_revisar", base: null, evidencia: null, fecha_autorizacion: null, fecha_baja: null, fecha_robinson: null, revisado_en: null };
  });
}

export function obtener(ctx, id) {
  const c = obtenerFila(ctx, id);
  const bd = ctx.bd;
  const inmuebles = bd.todos(
    `SELECT i.id, i.referencia, i.titulo, i.municipio, i.estado_comercial, i.precio_actual, ip.porcentaje
     FROM inmueble_propietarios ip JOIN inmuebles i ON i.id = ip.inmueble_id WHERE ip.contacto_id = ? ORDER BY i.creado_en DESC`, [id]);
  const oportunidades = bd.todos(
    "SELECT id, identificador, titulo, tipo_inmueble, municipio, estado, precio_anunciado FROM oportunidades WHERE contacto_id = ? ORDER BY creado_en DESC", [id]);
  const demandas = bd.todos("SELECT * FROM demandas WHERE contacto_id = ? ORDER BY creado_en DESC", [id]).map((d) => hidratar("demandas", d));
  const tareas = bd.todos(
    "SELECT * FROM tareas WHERE contacto_id = ? AND estado IN ('pendiente','en_curso') ORDER BY fecha, COALESCE(hora, '99:99') LIMIT 30", [id]);
  const actividades = bd.todos("SELECT * FROM actividades WHERE contacto_id = ? ORDER BY fecha DESC, COALESCE(hora, '') DESC, id DESC LIMIT 50", [id]);
  const alertas = [];
  if (c.no_contactar) alertas.push({ nivel: "bloqueo", texto: `No contactar${c.no_contactar_motivo ? `: ${c.no_contactar_motivo}` : ""}` });
  if ((c.telefono || c.email) && !c.procedencia && !c.anonimizado_en) alertas.push({ nivel: "aviso", texto: "Falta la procedencia de los datos de contacto." });
  return { ...c, nombre_completo: nombreCompleto(c), comunicaciones: habilitaciones(ctx, id), inmuebles, oportunidades, demandas, tareas, actividades, alertas, cambios: auditoria.historial(ctx, "contacto", id, 80) };
}

// -------------------------------------------------------------- escritura ----
export function crear(ctx, entrada, { confirmar_duplicado = false } = {}) {
  const { valores, errores } = limpiar(CONTACTO, entrada, { cat: ctx.cat });
  reglasProcedencia(valores, errores);
  exige(errores);
  exigeSinDuplicados(ctx, valores, null, confirmar_duplicado);
  const ahora = sello(ctx.reloj);
  const id = ctx.bd.transaccion(() => {
    const nuevoId = insertar(ctx.bd, "contactos", {
      ...valores,
      telefono_norm: telefonoNorm(valores.telefono),
      email_norm: emailNorm(valores.email),
      creado_en: ahora, actualizado_en: ahora,
    });
    auditoria.registrar(ctx, "contacto", nuevoId, "crear", { resumen: "Contacto creado." });
    return nuevoId;
  });
  return obtener(ctx, id);
}

export function actualizarContacto(ctx, id, entrada, { confirmar_duplicado = false } = {}) {
  const actual = obtenerFila(ctx, id);
  if (actual.anonimizado_en) throw conflicto("anonimizado", "Este contacto está anonimizado y ya no se puede editar.");
  const { valores, errores } = limpiar(CONTACTO, entrada, { parcial: true, cat: ctx.cat });
  const tocaContacto = ["telefono", "email", "procedencia", "procedencia_detalle"].some((k) => k in valores);
  if (tocaContacto) reglasProcedencia({ ...actual, ...valores }, errores);
  // No se puede quitar un rol que tiene datos detrás.
  if (valores.es_propietario === 0 && actual.es_propietario) {
    const n = ctx.bd.valor("SELECT COUNT(*) FROM inmueble_propietarios WHERE contacto_id = ?", [id]);
    if (n > 0) errores.es_propietario = `No puedes quitar el rol de propietario: figura en ${n} inmueble(s).`;
  }
  if (valores.es_comprador === 0 && actual.es_comprador) {
    const n = ctx.bd.valor("SELECT COUNT(*) FROM demandas WHERE contacto_id = ? AND estado != 'cerrada'", [id]);
    if (n > 0) errores.es_comprador = `No puedes quitar el rol de comprador: tiene ${n} demanda(s) sin cerrar.`;
  }
  exige(errores);
  // Solo se busca duplicado si el teléfono o el correo CAMBIAN (guardar otros campos no debe molestar).
  if (("telefono" in valores && valores.telefono !== actual.telefono) || ("email" in valores && valores.email !== actual.email)) {
    exigeSinDuplicados(ctx, { ...actual, ...valores }, id, confirmar_duplicado, true);
  }
  ctx.bd.transaccion(() => {
    const extra = {};
    if ("telefono" in valores) extra.telefono_norm = telefonoNorm(valores.telefono);
    if ("email" in valores) extra.email_norm = emailNorm(valores.email);
    auditoria.registrarDiff(ctx, "contacto", id, CONTACTO, actual, valores);
    actualizar(ctx.bd, "contactos", id, { ...valores, ...extra, actualizado_en: sello(ctx.reloj) });
  });
  return obtener(ctx, id);
}

function relaciones(ctx, id) {
  const bd = ctx.bd;
  return {
    inmuebles: bd.valor("SELECT COUNT(*) FROM inmueble_propietarios WHERE contacto_id = ?", [id]),
    oportunidades: bd.valor("SELECT COUNT(*) FROM oportunidades WHERE contacto_id = ?", [id]),
    demandas: bd.valor("SELECT COUNT(*) FROM demandas WHERE contacto_id = ?", [id]),
  };
}

export function eliminar(ctx, id) {
  const c = obtenerFila(ctx, id);
  const r = relaciones(ctx, id);
  if (r.inmuebles || r.oportunidades || r.demandas) {
    const partes = [];
    if (r.inmuebles) partes.push(`${r.inmuebles} inmueble(s)`);
    if (r.oportunidades) partes.push(`${r.oportunidades} oportunidad(es)`);
    if (r.demandas) partes.push(`${r.demandas} demanda(s)`);
    throw conflicto("contacto_con_relaciones",
      `No se puede eliminar: tiene ${partes.join(", ")}. Si lo que buscas es borrar sus datos personales, usa «Anonimizar»: conserva los registros sin identificar a la persona.`,
      { relaciones: r });
  }
  ctx.bd.transaccion(() => {
    // Lo que solo existe por este contacto se va con él; lo compartido se conserva sin contacto.
    ctx.bd.ejecutar("DELETE FROM actividades WHERE contacto_id = ? AND oportunidad_id IS NULL AND inmueble_id IS NULL AND demanda_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM tareas WHERE contacto_id = ? AND oportunidad_id IS NULL AND inmueble_id IS NULL AND demanda_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM contactos WHERE id = ?", [id]);
    auditoria.registrar(ctx, "contacto", id, "eliminar", { resumen: `Contacto eliminado${c.anonimizado_en ? " (anonimizado)" : ""}.` });
  });
  return { eliminado: true };
}

/**
 * Borra los datos personales pero conserva los registros (estadísticas,
 * historial comercial). Si la persona se opuso a recibir comunicaciones, se
 * exige confirmar: al anonimizarla ya no se podrá reconocer si vuelve a aparecer.
 */
export function anonimizar(ctx, id, { confirmar_perdida_bloqueo = false } = {}) {
  const c = obtenerFila(ctx, id);
  if (c.anonimizado_en) throw conflicto("anonimizado", "Este contacto ya está anonimizado.");
  if (c.no_contactar && !confirmar_perdida_bloqueo) {
    throw conflicto("perdida_bloqueo",
      "Esta persona figura como «No contactar». Si la anonimizas, ya no podrás reconocerla si vuelve a aparecer y se perderá el bloqueo efectivo. Confirma solo si es lo que quieres.",
      { requiere: "confirmar_perdida_bloqueo" });
  }
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    ctx.bd.ejecutar(
      `UPDATE contactos SET nombre = ?, apellidos = NULL, empresa = NULL, telefono = NULL, telefono_norm = NULL, email = NULL, email_norm = NULL,
         canal_preferido = NULL, procedencia_detalle = NULL, motivo_venta = NULL, notas = NULL, no_contactar_motivo = NULL,
         anonimizado_en = ?, actualizado_en = ? WHERE id = ?`,
      [`${ANONIMO} #${id}`, ahora, ahora, id]);
    ctx.bd.ejecutar("UPDATE contacto_comunicaciones SET evidencia = NULL WHERE contacto_id = ?", [id]);
    ctx.bd.ejecutar("UPDATE actividades SET resumen = '[Contenido eliminado por anonimización]', resultado = NULL WHERE contacto_id = ?", [id]);
    ctx.bd.ejecutar("UPDATE tareas SET titulo = 'Tarea de contacto anonimizado', notas = NULL WHERE contacto_id = ?", [id]);
    auditoria.registrar(ctx, "contacto", id, "anonimizar", { resumen: "Datos personales eliminados; los registros se conservan sin identificar a la persona." });
  });
  return obtener(ctx, id);
}

// ------------------------------------------------------ comunicaciones ----
/** ¿Se puede preparar una comunicación comercial por este canal? Usado por tareas y, más adelante, marketing e IA. */
export function puedeComunicar(contacto, canal, comunicaciones = []) {
  if (!contacto) return { permitido: true, nivel: "ok", motivo: null };
  if (contacto.no_contactar) {
    return { permitido: false, nivel: "bloqueo", motivo: `Figura como «No contactar»${contacto.no_contactar_motivo ? ` (${contacto.no_contactar_motivo})` : ""}.` };
  }
  const h = comunicaciones.find((x) => x.canal === canal);
  const nombre = etiquetaDe(CANALES, canal);
  if (h?.estado === "baja") return { permitido: false, nivel: "bloqueo", motivo: `Ha manifestado oposición o baja en ${nombre}.` };
  if (h?.estado === "no_habilitado") return { permitido: false, nivel: "bloqueo", motivo: `${nombre} está marcado como no habilitado para este contacto.` };
  if (!h || h.estado === "sin_revisar") return { permitido: true, nivel: "aviso", motivo: `La habilitación de ${nombre} no está revisada para este contacto.` };
  return { permitido: true, nivel: "ok", motivo: null };
}

export function evaluarComunicacion(ctx, contactoId, canal) {
  if (!contactoId) return { permitido: true, nivel: "ok", motivo: null };
  const c = obtenerFila(ctx, contactoId);
  return puedeComunicar(c, canal, habilitaciones(ctx, contactoId));
}

export function guardarHabilitaciones(ctx, id, items) {
  const contacto = obtenerFila(ctx, id);
  if (contacto.anonimizado_en) throw conflicto("anonimizado", "Este contacto está anonimizado.");
  if (!Array.isArray(items) || !items.length) throw invalido("No hay nada que guardar.");
  const hoyIso = hoy(ctx.reloj);
  const previas = habilitaciones(ctx, id);
  const preparados = [];
  const errores = {};
  for (const item of items) {
    const { valores: v, errores: e } = limpiar(HABILITACION, item);
    const canal = v.canal || item?.canal || "?";
    const err = (campo, msg) => { errores[`${canal}.${campo}`] = msg; };
    for (const [k, m] of Object.entries(e)) err(k, m);
    if (!Object.keys(e).length) {
      const nombre = etiquetaDe(CANALES, v.canal);
      if (v.estado === "habilitado") {
        if (contacto.no_contactar) err("estado", "Esta persona figura como «No contactar»: levanta primero el bloqueo, con su motivo.");
        const admitidas = BASES_POR_CANAL[v.canal] || [];
        if (!v.base) err("base", `Indica en qué se basa la comunicación por ${nombre}.`);
        else if (!admitidas.includes(v.base)) {
          err("base", `Para ${nombre} no basta «${etiquetaDe(BASES_COMUNICACION, v.base)}». Bases admitidas: ${admitidas.map((b) => etiquetaDe(BASES_COMUNICACION, b)).join("; ")}.`);
        }
        if (!v.evidencia) err("evidencia", "Anota la evidencia (dónde y cómo consta: correo, formulario, nota de la llamada…).");
        if (v.base === "robinson") { if (!v.fecha_robinson) err("fecha_robinson", "Indica cuándo comprobaste la Lista Robinson."); }
        else if (v.base && !v.fecha_autorizacion) err("fecha_autorizacion", "Indica la fecha de la autorización o solicitud.");
      } else if (v.estado === "baja") {
        v.fecha_baja = v.fecha_baja || hoyIso;
      }
      if (v.estado !== "habilitado") { v.base = v.estado === "baja" ? v.base ?? null : null; }
      if (v.estado === "sin_revisar") { v.evidencia = null; v.fecha_autorizacion = null; v.fecha_baja = null; v.fecha_robinson = null; }
    }
    preparados.push(v);
  }
  exige(errores, "Revisa los canales marcados.");
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    for (const v of preparados) {
      const previa = previas.find((x) => x.canal === v.canal);
      const fila = {
        estado: v.estado, base: v.base ?? null, evidencia: v.evidencia ?? null,
        fecha_autorizacion: v.fecha_autorizacion ?? null, fecha_baja: v.fecha_baja ?? null, fecha_robinson: v.fecha_robinson ?? null,
        revisado_en: ahora,
      };
      const existe = ctx.bd.uno("SELECT id FROM contacto_comunicaciones WHERE contacto_id = ? AND canal = ?", [id, v.canal]);
      if (existe) actualizar(ctx.bd, "contacto_comunicaciones", existe.id, fila);
      else insertar(ctx.bd, "contacto_comunicaciones", { contacto_id: id, canal: v.canal, ...fila });
      if (previa.estado !== v.estado) {
        auditoria.registrar(ctx, "contacto", id, "comunicacion", { campo: `comunicacion.${v.canal}`, antes: previa.estado, despues: v.estado });
      }
    }
  });
  return habilitaciones(ctx, id);
}

export function marcarNoContactar(ctx, id, { motivo } = {}) {
  const c = obtenerFila(ctx, id);
  const m = String(motivo ?? "").trim();
  if (!m) throw invalido("Indica el motivo (por ejemplo: «ha pedido no ser contactado»).", { motivo: "Indica el motivo." });
  if (m.length > 300) throw invalido("El motivo es demasiado largo (máximo 300 caracteres).", { motivo: "Demasiado largo." });
  if (c.no_contactar) throw conflicto("ya_no_contactar", "Esta persona ya figura como «No contactar».");
  let oportunidades = 0;
  let tareas = 0;
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    actualizar(ctx.bd, "contactos", id, { no_contactar: 1, no_contactar_motivo: m, no_contactar_fecha: hoy(ctx.reloj), actualizado_en: ahora });
    auditoria.registrar(ctx, "contacto", id, "no_contactar", { resumen: "Marcado como «No contactar»." });
    // Oportunidades abiertas → "No contactar".
    const abiertas = ctx.bd.todos(
      "SELECT id, estado FROM oportunidades WHERE contacto_id = ? AND estado NOT IN ('encargo_confirmado','descartada','no_contactar')", [id]);
    for (const o of abiertas) {
      ctx.bd.ejecutar("UPDATE oportunidades SET estado = 'no_contactar', estado_desde = ?, motivo_descarte = ?, actualizado_en = ? WHERE id = ?",
        [ahora, "El contacto se marcó como «No contactar»", ahora, o.id]);
      auditoria.registrar(ctx, "oportunidad", o.id, "estado", { campo: "estado", antes: o.estado, despues: "no_contactar", resumen: "Pasa a «No contactar» porque el contacto se marcó así." });
      oportunidades++;
    }
    // Tareas de comunicación pendientes → canceladas.
    const tipos = Object.keys(CANAL_DE_TAREA);
    const pend = ctx.bd.todos(
      `SELECT id FROM tareas WHERE contacto_id = ? AND estado IN ('pendiente','en_curso') AND tipo IN (${tipos.map(() => "?").join(",")})`, [id, ...tipos]);
    for (const t of pend) {
      ctx.bd.ejecutar("UPDATE tareas SET estado = 'cancelada', actualizado_en = ? WHERE id = ?", [ahora, t.id]);
      auditoria.registrar(ctx, "tarea", t.id, "estado", { campo: "estado", despues: "cancelada", resumen: "Cancelada: el contacto se marcó como «No contactar»." });
      tareas++;
    }
  });
  return { contacto: obtener(ctx, id), oportunidades_afectadas: oportunidades, tareas_canceladas: tareas };
}

export function levantarNoContactar(ctx, id, { motivo } = {}) {
  const c = obtenerFila(ctx, id);
  const m = String(motivo ?? "").trim();
  if (!c.no_contactar) throw conflicto("no_bloqueado", "Esta persona no figura como «No contactar».");
  if (!m) throw invalido("Explica por qué se levanta el bloqueo (por ejemplo: «la propia persona ha pedido información»).", { motivo: "Indica el motivo." });
  if (m.length > 300) throw invalido("El motivo es demasiado largo (máximo 300 caracteres).", { motivo: "Demasiado largo." });
  ctx.bd.transaccion(() => {
    actualizar(ctx.bd, "contactos", id, { no_contactar: 0, no_contactar_motivo: null, no_contactar_fecha: null, actualizado_en: sello(ctx.reloj) });
    auditoria.registrar(ctx, "contacto", id, "levantar_no_contactar", { resumen: "Se levantó el bloqueo «No contactar» (el motivo no se guarda en el historial)." });
  });
  return obtener(ctx, id);
}

