// ============================================================================
//  Cartera de inmuebles, propietarios, historial de precios y encargos.
//  - Un inmueble puede tener varios propietarios y un propietario varios
//    inmuebles (tabla inmueble_propietarios).
//  - La dirección interna NUNCA se mezcla con la ubicación pública.
//  - Los datos que vienen de un anuncio no están confirmados: quedan marcados
//    como «pendientes de confirmar» hasta que alguien los verifica.
//  - Cada encargo con vigencia crea (y mantiene) su recordatorio de vencimiento.
// ============================================================================
import { insertar, actualizar, hidratar, siguienteContador } from "./bd.mjs";
import { limpiar, exige, INMUEBLE, ENCARGO } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { patronLike, paginacion } from "./config.mjs";
import * as contactos from "./contactos.mjs";
import { noEncontrado, invalido, conflicto, normaliza, sello, hoy, sumaDias, diasEntre } from "./util.mjs";
import { ESTADOS_COMERCIALES_ACTIVOS } from "./catalogos.mjs";

const fmtFecha = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const CAMPOS_BASICOS_FALTANTES = {
  superficie_m2: "superficie", habitaciones: "habitaciones", banos: "baños", planta: "planta", ascensor: "ascensor",
  estado_conservacion: "estado de conservación", precio_actual: "precio", direccion_interna: "dirección interna", descripcion_comercial: "descripción comercial",
};

export function datosFaltantes(i) {
  return Object.entries(CAMPOS_BASICOS_FALTANTES)
    .filter(([k]) => i[k] === null || i[k] === undefined || i[k] === "" || (k === "estado_conservacion" && i[k] === "desconocido"))
    .map(([k, nombre]) => ({ campo: k, nombre }));
}

export function obtenerFila(ctx, id) {
  const f = ctx.bd.uno("SELECT * FROM inmuebles WHERE id = ?", [id]);
  if (!f) throw noEncontrado("El inmueble");
  return hidratar("inmuebles", f);
}

export function generarReferencia(ctx) {
  const cfg = ctx.config().referencias;
  for (;;) {
    const n = siguienteContador(ctx.bd, "inmueble");
    const ref = `${cfg.inmueble_prefijo}-${String(n).padStart(cfg.inmueble_digitos, "0")}`;
    if (!ctx.bd.uno("SELECT 1 FROM inmuebles WHERE referencia = ?", [ref])) return ref;
  }
}

const tituloAuto = (v) => `${v.tipo} en ${v.municipio}${v.zona ? ` · ${v.zona}` : ""}`;
const ubicacionAuto = (v) => (v.zona ? `${v.zona}, ${v.municipio}` : v.municipio);

function exigeReferenciaLibre(ctx, ref, excluirId = null) {
  const otro = ctx.bd.uno("SELECT id FROM inmuebles WHERE norm(referencia) = ? AND id IS NOT ?", [normaliza(ref), excluirId]);
  if (otro) throw conflicto("referencia_repetida", `La referencia «${ref}» ya la usa otro inmueble.`, { campos: { referencia: "Esa referencia ya existe." } });
}

/** Crea la fila del inmueble (y su primer precio). Lo usa el alta manual y la confirmación de encargo. */
export function crearFila(ctx, valores, extra = {}, { motivoPrecio = "Precio inicial" } = {}) {
  const ahora = sello(ctx.reloj);
  const v = { ...valores };
  if (v.referencia) exigeReferenciaLibre(ctx, v.referencia); else v.referencia = generarReferencia(ctx);
  if (!v.titulo) v.titulo = tituloAuto(v);
  if (!v.ubicacion_publica) v.ubicacion_publica = ubicacionAuto(v);
  const id = insertar(ctx.bd, "inmuebles", { ...v, ...extra, creado_en: ahora, actualizado_en: ahora });
  if (v.precio_actual !== null && v.precio_actual !== undefined) {
    insertar(ctx.bd, "inmueble_precios", { inmueble_id: id, precio: v.precio_actual, fecha: hoy(ctx.reloj), motivo: motivoPrecio, creado_en: ahora });
  }
  auditoria.registrar(ctx, "inmueble", id, "crear", { resumen: `Inmueble ${v.referencia} creado.` });
  return id;
}

export function crear(ctx, entrada) {
  const { valores, errores } = limpiar(INMUEBLE, entrada, { cat: ctx.cat });
  exige(errores);
  const id = ctx.bd.transaccion(() => crearFila(ctx, valores));
  return obtener(ctx, id);
}

export function actualizarInmueble(ctx, id, entrada) {
  const actual = obtenerFila(ctx, id);
  const { valores, errores } = limpiar(INMUEBLE, entrada, { parcial: true, cat: ctx.cat });
  exige(errores);
  if (valores.referencia === null) delete valores.referencia;
  if (valores.titulo === null) valores.titulo = tituloAuto({ ...actual, ...valores });
  if (valores.referencia && normaliza(valores.referencia) !== normaliza(actual.referencia)) exigeReferenciaLibre(ctx, valores.referencia, id);
  const motivoPrecio = typeof entrada?.motivo_precio === "string" ? entrada.motivo_precio.trim().slice(0, 200) : null;
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    auditoria.registrarDiff(ctx, "inmueble", id, INMUEBLE, actual, valores);
    actualizar(ctx.bd, "inmuebles", id, { ...valores, actualizado_en: ahora });
    if ("precio_actual" in valores && valores.precio_actual !== null && valores.precio_actual !== actual.precio_actual) {
      insertar(ctx.bd, "inmueble_precios", { inmueble_id: id, precio: valores.precio_actual, fecha: hoy(ctx.reloj), motivo: motivoPrecio || null, creado_en: ahora });
    }
    if (valores.estado_comercial && valores.estado_comercial !== actual.estado_comercial) cierresPorEstado(ctx, id, valores.estado_comercial);
  });
  return obtener(ctx, id);
}

/** Al vender/alquilar se finalizan los encargos vigentes; al retirar/archivar se apagan sus avisos. */
function cierresPorEstado(ctx, id, estado) {
  const ahora = sello(ctx.reloj);
  if (estado === "vendido" || estado === "alquilado") {
    for (const e of ctx.bd.todos("SELECT id FROM encargos WHERE inmueble_id = ? AND estado = 'vigente'", [id])) {
      actualizar(ctx.bd, "encargos", e.id, { estado: "finalizado", actualizado_en: ahora });
      auditoria.registrar(ctx, "encargo", e.id, "estado", { campo: "estado", antes: "vigente", despues: "finalizado", resumen: "Encargo finalizado por la venta/alquiler del inmueble." });
    }
  }
  if (["vendido", "alquilado", "retirado", "archivado"].includes(estado)) {
    ctx.bd.ejecutar(
      "UPDATE tareas SET estado = 'cancelada', actualizado_en = ? WHERE inmueble_id = ? AND tipo = 'vencimiento_encargo' AND estado IN ('pendiente','en_curso')", [ahora, id]);
  }
}

export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion(q);
  const donde = ["1 = 1"];
  const p = [];
  if (q.q) {
    const t = patronLike(normaliza(q.q));
    donde.push(`norm(i.referencia || ' ' || i.titulo || ' ' || i.municipio || ' ' || COALESCE(i.zona, '') || ' ' || COALESCE(i.direccion_interna, '')) LIKE ? ESCAPE '\\'`);
    p.push(t);
  }
  if (q.estado === "activos") donde.push(`i.estado_comercial IN (${ESTADOS_COMERCIALES_ACTIVOS.map(() => "?").join(",")})`), p.push(...ESTADOS_COMERCIALES_ACTIVOS);
  else if (q.estado) donde.push("i.estado_comercial = ?"), p.push(q.estado);
  if (q.municipio) donde.push("norm(i.municipio) = ?"), p.push(normaliza(q.municipio));
  if (q.tipo) donde.push("norm(i.tipo) = ?"), p.push(normaliza(q.tipo));
  if (q.operacion) donde.push("i.operacion = ?"), p.push(q.operacion);
  if (q.precio_min) donde.push("i.precio_actual >= ?"), p.push(Number(q.precio_min));
  if (q.precio_max) donde.push("i.precio_actual <= ?"), p.push(Number(q.precio_max));
  if (q.propietario_id) donde.push("EXISTS (SELECT 1 FROM inmueble_propietarios ip WHERE ip.inmueble_id = i.id AND ip.contacto_id = ?)"), p.push(Number(q.propietario_id));
  const orden = { precio_asc: "i.precio_actual ASC", precio_desc: "i.precio_actual DESC", referencia: "i.referencia ASC" }[q.orden] || "i.actualizado_en DESC, i.id DESC";
  const where = donde.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM inmuebles i WHERE ${where}`, p);
  const filas = ctx.bd.todos(
    `SELECT i.*,
       (SELECT GROUP_CONCAT(c.nombre || COALESCE(' ' || c.apellidos, ''), ', ') FROM inmueble_propietarios ip JOIN contactos c ON c.id = ip.contacto_id WHERE ip.inmueble_id = i.id) AS propietarios
     FROM inmuebles i WHERE ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`,
    [...p, limite, offset],
  ).map((f) => hidratar("inmuebles", f));
  return { datos: filas, total, limite, offset };
}

export function estadoEfectivoEncargo(e, hoyIso) {
  return e.estado === "vigente" && e.vigencia_hasta && e.vigencia_hasta < hoyIso ? "vencido" : e.estado;
}

export function propietariosDe(ctx, id) {
  return ctx.bd.todos(
    `SELECT ip.contacto_id, ip.porcentaje, ip.principal, c.nombre, c.apellidos, c.telefono, c.email, c.no_contactar, c.anonimizado_en
     FROM inmueble_propietarios ip JOIN contactos c ON c.id = ip.contacto_id WHERE ip.inmueble_id = ? ORDER BY ip.principal DESC, ip.creado_en`, [id],
  ).map((r) => ({ ...r, nombre_completo: contactos.nombreCompleto(r) }));
}

export function encargosDe(ctx, id) {
  const hoyIso = hoy(ctx.reloj);
  return ctx.bd.todos("SELECT * FROM encargos WHERE inmueble_id = ? ORDER BY fecha_encargo DESC, id DESC", [id])
    .map((e) => ({ ...e, estado_efectivo: estadoEfectivoEncargo(e, hoyIso), dias_para_vencer: e.vigencia_hasta ? diasEntre(hoyIso, e.vigencia_hasta) : null }));
}

export function obtener(ctx, id) {
  const i = obtenerFila(ctx, id);
  const bd = ctx.bd;
  const propietarios = propietariosDe(ctx, id);
  const precios = bd.todos("SELECT * FROM inmueble_precios WHERE inmueble_id = ? ORDER BY fecha DESC, id DESC", [id]);
  const encargos = encargosDe(ctx, id);
  let captacion = null;
  if (i.oportunidad_origen_id) {
    const o = bd.uno("SELECT id, identificador, titulo, estado, fecha_deteccion, fuente, enlace, notas, precio_anunciado FROM oportunidades WHERE id = ?", [i.oportunidad_origen_id]);
    if (o) {
      captacion = {
        oportunidad: o,
        actividades: bd.todos("SELECT * FROM actividades WHERE oportunidad_id = ? ORDER BY fecha DESC, id DESC LIMIT 50", [o.id]),
        cambios: auditoria.historial(ctx, "oportunidad", o.id, 60),
      };
    }
  }
  const tareas = bd.todos("SELECT * FROM tareas WHERE inmueble_id = ? AND estado IN ('pendiente','en_curso') ORDER BY fecha, COALESCE(hora, '99:99') LIMIT 30", [id]);
  const actividades = bd.todos("SELECT * FROM actividades WHERE inmueble_id = ? ORDER BY fecha DESC, id DESC LIMIT 50", [id]);
  const alertas = [];
  if (propietarios.some((p) => p.no_contactar)) alertas.push({ nivel: "bloqueo", texto: "Algún propietario figura como «No contactar»." });
  for (const e of encargos.filter((x) => x.estado === "vigente")) {
    const nombre = `El encargo de ${e.tipo}`;
    if (e.estado_efectivo === "vencido") alertas.push({ nivel: "aviso", texto: `${nombre} ha pasado su fecha de vigencia.` });
    else if (e.dias_para_vencer !== null && e.dias_para_vencer <= ctx.config().avisos.encargo_dias) alertas.push({ nivel: "aviso", texto: `${nombre} vence en ${e.dias_para_vencer} día(s).` });
  }
  if (!propietarios.length && ["disponible", "reservado", "en_negociacion"].includes(i.estado_comercial)) alertas.push({ nivel: "aviso", texto: "El inmueble está activo y no tiene propietario asignado." });
  return {
    ...i, propietarios, precios, encargos, captacion, tareas, actividades, alertas,
    datos_faltantes: datosFaltantes(i), cambios: auditoria.historial(ctx, "inmueble", id, 80),
  };
}

export function eliminar(ctx, id) {
  const i = obtenerFila(ctx, id);
  const n = ctx.bd.valor("SELECT COUNT(*) FROM encargos WHERE inmueble_id = ?", [id]);
  if (n > 0 || i.oportunidad_origen_id) {
    throw conflicto("inmueble_con_historial",
      "Este inmueble tiene un historial de captación o encargos y no se puede borrar sin perderlo. Cámbialo a «Archivado» o «Retirado»: deja de contar como activo y se conserva todo.");
  }
  const act = ctx.bd.valor("SELECT COUNT(*) FROM actividades WHERE inmueble_id = ?", [id]);
  if (act > 0) throw conflicto("inmueble_con_historial", "Este inmueble tiene actividad registrada. Cámbialo a «Archivado»: se conserva el historial y deja de contar como activo.");
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM tareas WHERE inmueble_id = ? AND oportunidad_id IS NULL AND contacto_id IS NULL AND demanda_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM inmuebles WHERE id = ?", [id]);
    auditoria.registrar(ctx, "inmueble", id, "eliminar", { resumen: `Inmueble ${i.referencia} eliminado.` });
  });
  return { eliminado: true };
}

// ------------------------------------------------------------ propietarios ----
export function anadirPropietario(ctx, inmuebleId, { contacto_id, porcentaje } = {}) {
  const i = obtenerFila(ctx, inmuebleId);
  const c = contactos.obtenerFila(ctx, Number(contacto_id));
  let pct = null;
  if (porcentaje !== undefined && porcentaje !== null && porcentaje !== "") {
    pct = Number(porcentaje);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw invalido("El porcentaje debe estar entre 0 y 100.", { porcentaje: "Entre 0 y 100." });
  }
  if (ctx.bd.uno("SELECT 1 FROM inmueble_propietarios WHERE inmueble_id = ? AND contacto_id = ?", [inmuebleId, c.id])) {
    throw conflicto("ya_es_propietario", "Esa persona ya figura como propietaria de este inmueble.");
  }
  const suma = Number(ctx.bd.valor("SELECT COALESCE(SUM(porcentaje), 0) FROM inmueble_propietarios WHERE inmueble_id = ?", [inmuebleId])) + (pct || 0);
  if (suma > 100.0001) throw invalido(`Los porcentajes de propiedad suman ${suma}%: no pueden pasar del 100 %.`, { porcentaje: "La suma supera el 100 %." });
  ctx.bd.transaccion(() => {
    const hay = ctx.bd.valor("SELECT COUNT(*) FROM inmueble_propietarios WHERE inmueble_id = ?", [inmuebleId]);
    insertar(ctx.bd, "inmueble_propietarios", { inmueble_id: inmuebleId, contacto_id: c.id, porcentaje: pct, principal: hay === 0 ? 1 : 0, creado_en: sello(ctx.reloj) });
    if (!c.es_propietario) actualizar(ctx.bd, "contactos", c.id, { es_propietario: 1, actualizado_en: sello(ctx.reloj) });
    auditoria.registrar(ctx, "inmueble", inmuebleId, "vincular", { campo: "propietario", resumen: `Propietario vinculado a ${i.referencia}.` });
  });
  return propietariosDe(ctx, inmuebleId);
}

export function quitarPropietario(ctx, inmuebleId, contactoId) {
  const i = obtenerFila(ctx, inmuebleId);
  const fila = ctx.bd.uno("SELECT * FROM inmueble_propietarios WHERE inmueble_id = ? AND contacto_id = ?", [inmuebleId, contactoId]);
  if (!fila) throw noEncontrado("El vínculo con el propietario");
  const total = ctx.bd.valor("SELECT COUNT(*) FROM inmueble_propietarios WHERE inmueble_id = ?", [inmuebleId]);
  const vigente = ctx.bd.valor("SELECT COUNT(*) FROM encargos WHERE inmueble_id = ? AND estado = 'vigente'", [inmuebleId]);
  if (total === 1 && vigente > 0) throw conflicto("ultimo_propietario", "Es el único propietario y el inmueble tiene un encargo vigente. Añade antes al nuevo propietario.");
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM inmueble_propietarios WHERE inmueble_id = ? AND contacto_id = ?", [inmuebleId, contactoId]);
    if (fila.principal) {
      const otro = ctx.bd.uno("SELECT contacto_id FROM inmueble_propietarios WHERE inmueble_id = ? ORDER BY creado_en LIMIT 1", [inmuebleId]);
      if (otro) ctx.bd.ejecutar("UPDATE inmueble_propietarios SET principal = 1 WHERE inmueble_id = ? AND contacto_id = ?", [inmuebleId, otro.contacto_id]);
    }
    // Si ya no es propietario de nada, el rol se retira.
    const resto = ctx.bd.valor("SELECT COUNT(*) FROM inmueble_propietarios WHERE contacto_id = ?", [contactoId]);
    if (resto === 0) ctx.bd.ejecutar("UPDATE contactos SET es_propietario = 0 WHERE id = ?", [contactoId]);
    auditoria.registrar(ctx, "inmueble", inmuebleId, "desvincular", { campo: "propietario", resumen: `Propietario desvinculado de ${i.referencia}.` });
  });
  return propietariosDe(ctx, inmuebleId);
}

export function confirmarDato(ctx, id, campo) {
  const i = obtenerFila(ctx, id);
  if (!i.datos_pendientes.includes(campo)) throw conflicto("no_pendiente", "Ese dato no figura como pendiente de confirmar.");
  const resto = i.datos_pendientes.filter((x) => x !== campo);
  ctx.bd.transaccion(() => {
    actualizar(ctx.bd, "inmuebles", id, { datos_pendientes: resto, actualizado_en: sello(ctx.reloj) });
    auditoria.registrar(ctx, "inmueble", id, "confirmar", { campo, resumen: `Dato confirmado: ${campo.replace(/_/g, " ")}.` });
  });
  return obtener(ctx, id);
}

// ---------------------------------------------------------------- encargos ----
function validarEncargo(valores, errores, fechaBase) {
  const fecha = valores.fecha_encargo || fechaBase;
  if (valores.vigencia_hasta && fecha && valores.vigencia_hasta < fecha) errores.vigencia_hasta = "La vigencia no puede ser anterior a la fecha del encargo.";
  if (valores.honorarios_tipo && valores.honorarios_tipo !== "sin_definir" && (valores.honorarios_valor === null || valores.honorarios_valor === undefined)) {
    errores.honorarios_valor = "Indica el importe o el porcentaje de los honorarios.";
  }
  if (valores.honorarios_tipo === "porcentaje" && valores.honorarios_valor > 100) errores.honorarios_valor = "Un porcentaje no puede pasar de 100.";
}

/** Mantiene el aviso de vencimiento: una sola tarea automática por encargo. */
export function sincronizarAvisoEncargo(ctx, encargoId, { reabrir = false } = {}) {
  const e = ctx.bd.uno("SELECT e.*, i.referencia FROM encargos e JOIN inmuebles i ON i.id = e.inmueble_id WHERE e.id = ?", [encargoId]);
  if (!e) return;
  const ahora = sello(ctx.reloj);
  const tarea = ctx.bd.uno("SELECT * FROM tareas WHERE encargo_id = ? ORDER BY id LIMIT 1", [encargoId]);
  if (e.estado !== "vigente" || !e.vigencia_hasta) {
    if (tarea && ["pendiente", "en_curso"].includes(tarea.estado)) actualizar(ctx.bd, "tareas", tarea.id, { estado: "cancelada", actualizado_en: ahora });
    return;
  }
  const hoyIso = hoy(ctx.reloj);
  const aviso = sumaDias(e.vigencia_hasta, -ctx.config().avisos.encargo_dias);
  const fecha = e.vigencia_hasta < hoyIso ? e.vigencia_hasta : aviso < hoyIso ? hoyIso : aviso;
  const titulo = `Vence el encargo de ${e.referencia} el ${fmtFecha(e.vigencia_hasta)}`;
  if (!tarea) {
    insertar(ctx.bd, "tareas", {
      titulo, tipo: "vencimiento_encargo", fecha, prioridad: "alta", responsable: ctx.usuario(), estado: "pendiente",
      notas: "Aviso automático del vencimiento del encargo: valora renovar, renegociar o dejarlo vencer.",
      inmueble_id: e.inmueble_id, encargo_id: encargoId, aviso_min: 0, creado_en: ahora, actualizado_en: ahora,
    });
  } else if (reabrir || ["pendiente", "en_curso"].includes(tarea.estado)) {
    actualizar(ctx.bd, "tareas", tarea.id, { titulo, fecha, estado: "pendiente", aviso_visto_en: null, completada_en: null, actualizado_en: ahora });
  }
}

export function crearEncargo(ctx, inmuebleId, entrada, { oportunidad_id = null } = {}) {
  const i = obtenerFila(ctx, inmuebleId);
  const { valores, errores } = limpiar(ENCARGO, entrada);
  valores.fecha_encargo = valores.fecha_encargo || hoy(ctx.reloj);
  validarEncargo(valores, errores, valores.fecha_encargo);
  exige(errores);
  if (valores.estado === "vigente") {
    const vig = ctx.bd.uno("SELECT id FROM encargos WHERE inmueble_id = ? AND estado = 'vigente' AND tipo = ?", [inmuebleId, valores.tipo]);
    if (vig) throw conflicto("encargo_vigente", `${i.referencia} ya tiene un encargo vigente de ese tipo. Márcalo como finalizado o cancelado antes de registrar uno nuevo.`);
  }
  const id = ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    const nuevo = insertar(ctx.bd, "encargos", { ...valores, inmueble_id: inmuebleId, oportunidad_id, creado_en: ahora, actualizado_en: ahora });
    auditoria.registrar(ctx, "encargo", nuevo, "crear", { resumen: `Encargo registrado en ${i.referencia}.` });
    auditoria.registrar(ctx, "inmueble", inmuebleId, "encargo", { resumen: "Encargo registrado." });
    sincronizarAvisoEncargo(ctx, nuevo);
    return nuevo;
  });
  return ctx.bd.uno("SELECT * FROM encargos WHERE id = ?", [id]);
}

export function actualizarEncargo(ctx, id, entrada) {
  const actual = ctx.bd.uno("SELECT * FROM encargos WHERE id = ?", [id]);
  if (!actual) throw noEncontrado("El encargo");
  const { valores, errores } = limpiar(ENCARGO, entrada, { parcial: true });
  validarEncargo({ ...actual, ...valores }, errores, actual.fecha_encargo);
  exige(errores);
  if (valores.estado === "vigente" && actual.estado !== "vigente") {
    const vig = ctx.bd.uno("SELECT id FROM encargos WHERE inmueble_id = ? AND estado = 'vigente' AND tipo = ? AND id != ?", [actual.inmueble_id, valores.tipo || actual.tipo, id]);
    if (vig) throw conflicto("encargo_vigente", "Ese inmueble ya tiene otro encargo vigente del mismo tipo.");
  }
  ctx.bd.transaccion(() => {
    auditoria.registrarDiff(ctx, "encargo", id, ENCARGO, actual, valores);
    actualizar(ctx.bd, "encargos", id, { ...valores, actualizado_en: sello(ctx.reloj) });
    sincronizarAvisoEncargo(ctx, id, { reabrir: "vigencia_hasta" in valores && valores.vigencia_hasta !== actual.vigencia_hasta });
  });
  return ctx.bd.uno("SELECT * FROM encargos WHERE id = ?", [id]);
}

/** Inmuebles que podrían ser el mismo que una oportunidad (para no duplicar). */
export function buscarSimilares(ctx, o) {
  const cands = ctx.bd.todos(
    "SELECT id, referencia, titulo, municipio, zona, superficie_m2, precio_actual, estado_comercial, tipo FROM inmuebles WHERE norm(municipio) = ? AND norm(tipo) = ?",
    [normaliza(o.municipio), normaliza(o.tipo_inmueble || o.tipo)],
  );
  const salida = [];
  for (const c of cands) {
    const motivos = [];
    if (o.superficie_m2 && c.superficie_m2 && Math.abs(c.superficie_m2 - o.superficie_m2) / o.superficie_m2 <= 0.03) motivos.push("misma superficie");
    if (o.zona && c.zona && normaliza(o.zona) === normaliza(c.zona)) motivos.push("misma zona");
    const precio = o.precio_anunciado ?? o.precio_actual;
    if (precio && c.precio_actual && Math.abs(c.precio_actual - precio) / precio <= 0.05) motivos.push("precio similar");
    if (motivos.includes("misma superficie") || (motivos.includes("misma zona") && motivos.includes("precio similar"))) salida.push({ ...c, motivos });
  }
  return salida;
}
