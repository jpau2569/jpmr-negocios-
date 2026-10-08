// ============================================================================
//  Demandas de compradores. Un comprador puede tener varias.
//  - Lo que el cliente MANIFIESTA no se presenta como hecho: una financiación
//    solo consta como «aprobada» si se anota la evidencia.
//  - Una demanda que no se toca en N días se marca como caducada para que se
//    reconfirme con el cliente antes de enviarle nada.
// ============================================================================
import { insertar, actualizar, hidratar } from "./bd.mjs";
import { limpiar, exige, DEMANDA } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { patronLike, paginacion } from "./config.mjs";
import * as contactos from "./contactos.mjs";
import { noEncontrado, conflicto, normaliza, sello, diasEntre, hoy, exigeVersion } from "./util.mjs";

export function obtenerFila(ctx, id) {
  const f = ctx.bd.uno("SELECT * FROM demandas WHERE id = ?", [id]);
  if (!f) throw noEncontrado("La demanda");
  return hidratar("demandas", f);
}

function reglas(d, errores) {
  if (d.presupuesto_min != null && d.presupuesto_max != null && d.presupuesto_min > d.presupuesto_max) {
    errores.presupuesto_max = "El presupuesto máximo no puede ser menor que el mínimo.";
  }
  if (d.financiacion === "aprobada_acreditada" && !d.financiacion_evidencia) {
    errores.financiacion_evidencia = "Para marcar la financiación como aprobada anota la evidencia (por ejemplo: «carta de aprobación del banco, recibida el 12/03»). Si solo lo ha dicho el cliente, elige «manifestado».";
  }
  if (d.estado === "cerrada" && !d.motivo_cierre) errores.motivo_cierre = "Indica por qué se cierra la demanda (compró, desistió, sin respuesta…).";
}

const obsoleta = (ctx, d) => d.estado === "activa" && diasEntre(d.actualizado_en.slice(0, 10), hoy(ctx.reloj)) > ctx.config().avisos.demanda_obsoleta_dias;

export function crear(ctx, entrada) {
  const { valores, errores } = limpiar(DEMANDA, entrada, { cat: ctx.cat });
  reglas(valores, errores);
  if (valores.contacto_id) {
    const c = ctx.bd.uno("SELECT id, anonimizado_en FROM contactos WHERE id = ?", [valores.contacto_id]);
    if (!c) errores.contacto_id = "El comprador elegido ya no existe.";
    else if (c.anonimizado_en) errores.contacto_id = "Ese contacto está anonimizado.";
  }
  exige(errores);
  const id = ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    const nuevo = insertar(ctx.bd, "demandas", { ...valores, creado_en: ahora, actualizado_en: ahora });
    ctx.bd.ejecutar("UPDATE contactos SET es_comprador = 1, actualizado_en = ? WHERE id = ? AND es_comprador = 0", [ahora, valores.contacto_id]);
    auditoria.registrar(ctx, "demanda", nuevo, "crear", { resumen: "Demanda registrada." });
    return nuevo;
  });
  return obtener(ctx, id);
}

export function actualizarDemanda(ctx, id, entrada) {
  const actual = obtenerFila(ctx, id);
  exigeVersion(entrada, actual);
  const { valores, errores } = limpiar(DEMANDA, entrada, { parcial: true, cat: ctx.cat });
  delete valores.contacto_id; // la demanda no cambia de comprador
  for (const k of ["operacion", "ascensor", "garaje", "terraza", "plazo_compra", "financiacion", "estado"]) if (valores[k] === null) delete valores[k];
  reglas({ ...actual, ...valores }, errores);
  exige(errores);
  ctx.bd.transaccion(() => {
    auditoria.registrarDiff(ctx, "demanda", id, DEMANDA, actual, valores);
    actualizar(ctx.bd, "demandas", id, { ...valores, actualizado_en: sello(ctx.reloj) });
  });
  return obtener(ctx, id);
}

/** «He hablado con el cliente y sigue buscando lo mismo»: renueva la fecha de actualización. */
export function confirmarVigente(ctx, id) {
  const d = obtenerFila(ctx, id);
  if (d.estado === "cerrada") throw conflicto("demanda_cerrada", "La demanda está cerrada: reábrela antes.");
  ctx.bd.transaccion(() => {
    actualizar(ctx.bd, "demandas", id, { actualizado_en: sello(ctx.reloj) });
    auditoria.registrar(ctx, "demanda", id, "confirmar", { resumen: "Vigencia confirmada con el cliente." });
  });
  return obtener(ctx, id);
}

export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion(q);
  const donde = ["1 = 1"];
  const p = [];
  if (q.q) {
    donde.push(`norm(COALESCE(d.nombre, '') || ' ' || c.nombre || ' ' || COALESCE(c.apellidos, '') || ' ' || COALESCE(d.zonas, '') || ' ' || COALESCE(d.municipios, '')) LIKE ? ESCAPE '\\'`);
    p.push(patronLike(normaliza(q.q)));
  }
  if (q.estado) donde.push("d.estado = ?"), p.push(q.estado);
  if (q.contacto_id) donde.push("d.contacto_id = ?"), p.push(Number(q.contacto_id));
  if (q.municipio) donde.push("norm(d.municipios) LIKE ? ESCAPE '\\'"), p.push(patronLike(normaliza(`"${q.municipio}"`)));
  if (q.tipo) donde.push("norm(d.tipos) LIKE ? ESCAPE '\\'"), p.push(patronLike(normaliza(`"${q.tipo}"`)));
  if (q.presupuesto_max) donde.push("(d.presupuesto_max IS NULL OR d.presupuesto_max <= ?)"), p.push(Number(q.presupuesto_max));
  if (q.presupuesto_min) donde.push("(d.presupuesto_max IS NULL OR d.presupuesto_max >= ?)"), p.push(Number(q.presupuesto_min));
  const orden = { presupuesto: "d.presupuesto_max DESC", antiguas: "d.actualizado_en ASC" }[q.orden] || "d.actualizado_en DESC, d.id DESC";
  if (q.obsoletas === "1") {
    donde.push("d.estado = 'activa'", "date(d.actualizado_en) < date(?, '-' || ? || ' days')");
    p.push(hoy(ctx.reloj), ctx.config().avisos.demanda_obsoleta_dias);
  }
  const where = donde.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM demandas d JOIN contactos c ON c.id = d.contacto_id WHERE ${where}`, p);
  const filas = ctx.bd.todos(
    `SELECT d.*, c.nombre AS contacto_nombre, c.apellidos AS contacto_apellidos, c.no_contactar AS contacto_no_contactar
     FROM demandas d JOIN contactos c ON c.id = d.contacto_id WHERE ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`,
    [...p, limite, offset],
  ).map((f) => { hidratar("demandas", f); return { ...f, obsoleta: obsoleta(ctx, f) }; });
  return { datos: filas, total, limite, offset };
}

export function obtener(ctx, id) {
  const d = obtenerFila(ctx, id);
  const c = contactos.obtenerFila(ctx, d.contacto_id);
  const alertas = [];
  if (c.no_contactar) alertas.push({ nivel: "bloqueo", texto: "El comprador figura como «No contactar»: no prepares envíos." });
  if (obsoleta(ctx, d)) alertas.push({ nivel: "aviso", texto: "Hace tiempo que no se actualiza: confirma con el cliente que sigue buscando." });
  return {
    ...d, obsoleta: obsoleta(ctx, d), alertas,
    contacto: { id: c.id, nombre_completo: contactos.nombreCompleto(c), telefono: c.telefono, email: c.email, no_contactar: c.no_contactar },
    actividades: ctx.bd.todos("SELECT * FROM actividades WHERE demanda_id = ? ORDER BY fecha DESC, id DESC LIMIT 50", [id]),
    tareas: ctx.bd.todos("SELECT * FROM tareas WHERE demanda_id = ? AND estado IN ('pendiente','en_curso') ORDER BY fecha, COALESCE(hora, '99:99') LIMIT 30", [id]),
    cambios: auditoria.historial(ctx, "demanda", id, 80),
  };
}

export function eliminar(ctx, id) {
  obtenerFila(ctx, id);
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM actividades WHERE demanda_id = ? AND contacto_id IS NULL AND oportunidad_id IS NULL AND inmueble_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM tareas WHERE demanda_id = ? AND contacto_id IS NULL AND oportunidad_id IS NULL AND inmueble_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM demandas WHERE id = ?", [id]);
    auditoria.registrar(ctx, "demanda", id, "eliminar", { resumen: "Demanda eliminada." });
  });
  return { eliminado: true };
}
