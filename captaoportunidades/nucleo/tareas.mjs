// ============================================================================
//  Agenda y tareas.
//  Vistas: Hoy, Semana (lunes-domingo), Pendientes, Vencidas, Calendario.
//  Recordatorios INTERNOS reales: el programa calcula qué tareas han llegado a
//  su hora de aviso y la pantalla los muestra mientras está abierta. No hay
//  procesos en segundo plano ni avisos externos (no simulamos lo que no existe).
//  Las tareas de llamada/WhatsApp/correo respetan «No contactar» y la
//  habilitación del canal.
// ============================================================================
import { insertar, actualizar } from "./bd.mjs";
import { limpiar, exige, TAREA } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { patronLike, paginacion } from "./config.mjs";
import * as contactos from "./contactos.mjs";
import { exigeRelaciones } from "./actividades.mjs";
import { noEncontrado, conflicto, invalido, normaliza, sello, hoy, horaAhora, lunesDe, sumaDias, fechaValida, exigeVersion } from "./util.mjs";
import { CANAL_DE_TAREA } from "./catalogos.mjs";

const ABIERTA = "t.estado IN ('pendiente','en_curso')";
const prioridadOrden = "CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END";

export function obtenerFila(ctx, id) {
  const f = ctx.bd.uno("SELECT * FROM tareas WHERE id = ?", [id]);
  if (!f) throw noEncontrado("La tarea");
  return f;
}

const esVencida = (t, hoyIso, hm) =>
  ["pendiente", "en_curso"].includes(t.estado) && (t.fecha < hoyIso || (t.fecha === hoyIso && t.hora && t.hora < hm));

/** ¿A quién se dirige la tarea? Su contacto o, si no, el propietario de su oportunidad. */
function contactoDeTarea(ctx, t) {
  if (t.contacto_id) return t.contacto_id;
  if (t.oportunidad_id) return ctx.bd.valor("SELECT contacto_id FROM oportunidades WHERE id = ?", [t.oportunidad_id]) || null;
  if (t.demanda_id) return ctx.bd.valor("SELECT contacto_id FROM demandas WHERE id = ?", [t.demanda_id]) || null;
  return null;
}

/** Bloquea (lanza) o avisa si la tarea implica comunicarse con quien no se puede. */
function controlComunicacion(ctx, t) {
  const canal = CANAL_DE_TAREA[t.tipo];
  if (!canal || !["pendiente", "en_curso"].includes(t.estado)) return null;
  const cid = contactoDeTarea(ctx, t);
  if (!cid) return null;
  const r = contactos.evaluarComunicacion(ctx, cid, canal);
  if (!r.permitido) {
    throw conflicto("comunicacion_bloqueada", `No se puede preparar esta tarea: ${r.motivo}`, { contacto_id: cid, canal });
  }
  return r.nivel === "aviso" ? r.motivo : null;
}

function enriquecer(ctx, filas, hoyIso, hm) {
  return filas.map((t) => {
    const out = { ...t, vencida: esVencida(t, hoyIso, hm) };
    const canal = CANAL_DE_TAREA[t.tipo];
    if (canal && ["pendiente", "en_curso"].includes(t.estado)) {
      const cid = contactoDeTarea(ctx, t);
      if (cid) {
        const r = contactos.evaluarComunicacion(ctx, cid, canal);
        if (r.nivel !== "ok") out.comunicacion = { nivel: r.nivel, motivo: r.motivo };
      }
    }
    return out;
  });
}

export function crear(ctx, entrada) {
  const { valores, errores } = limpiar(TAREA, entrada, { cat: ctx.cat });
  valores.responsable = valores.responsable || ctx.usuario();
  exigeRelaciones(ctx, valores, errores, { minimoUna: false });
  if (valores.aviso_min != null && valores.hora == null && valores.aviso_min > 0) errores.aviso_min = "Para avisar con antelación necesito la hora de la tarea.";
  exige(errores);
  const aviso = controlComunicacion(ctx, valores);
  const id = ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    const nuevo = insertar(ctx.bd, "tareas", {
      ...valores, completada_en: valores.estado === "hecha" ? ahora : null, creado_en: ahora, actualizado_en: ahora,
    });
    auditoria.registrar(ctx, "tarea", nuevo, "crear", { resumen: "Tarea creada." });
    return nuevo;
  });
  return { tarea: ctx.bd.uno("SELECT * FROM tareas WHERE id = ?", [id]), avisos: aviso ? [aviso] : [] };
}

export function actualizarTarea(ctx, id, entrada) {
  const actual = obtenerFila(ctx, id);
  exigeVersion(entrada, actual);
  const { valores, errores } = limpiar(TAREA, entrada, { parcial: true, cat: ctx.cat });
  for (const k of ["titulo", "fecha", "tipo", "prioridad", "estado"]) if (valores[k] === null) delete valores[k];
  exigeRelaciones(ctx, { ...actual, ...valores }, errores, { minimoUna: false });
  const tras = { ...actual, ...valores };
  if (tras.aviso_min != null && tras.hora == null && tras.aviso_min > 0) errores.aviso_min = "Para avisar con antelación necesito la hora de la tarea.";
  exige(errores);
  const aviso = controlComunicacion(ctx, tras);
  ctx.bd.transaccion(() => {
    const extra = {};
    // Si cambia cuándo ocurre, el aviso vuelve a estar pendiente.
    if (["fecha", "hora", "aviso_min"].some((k) => k in valores && valores[k] !== actual[k])) extra.aviso_visto_en = null;
    if (valores.estado === "hecha" && actual.estado !== "hecha") extra.completada_en = sello(ctx.reloj);
    if (valores.estado && valores.estado !== "hecha" && actual.estado === "hecha") extra.completada_en = null;
    auditoria.registrarDiff(ctx, "tarea", id, TAREA, actual, valores);
    actualizar(ctx.bd, "tareas", id, { ...valores, ...extra, actualizado_en: sello(ctx.reloj) });
  });
  return { tarea: ctx.bd.uno("SELECT * FROM tareas WHERE id = ?", [id]), avisos: aviso ? [aviso] : [] };
}

export function completar(ctx, id) {
  const t = obtenerFila(ctx, id);
  if (t.estado === "hecha") return { tarea: t, avisos: [] };
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    actualizar(ctx.bd, "tareas", id, { estado: "hecha", completada_en: ahora, actualizado_en: ahora });
    auditoria.registrar(ctx, "tarea", id, "estado", { campo: "estado", antes: t.estado, despues: "hecha" });
  });
  return { tarea: obtenerFila(ctx, id), avisos: [] };
}

export function posponer(ctx, id, { dias, fecha, hora, minutos } = {}) {
  const t = obtenerFila(ctx, id);
  if (!["pendiente", "en_curso"].includes(t.estado)) throw conflicto("tarea_cerrada", "Solo se pueden posponer tareas pendientes.");
  let nuevaFecha = t.fecha;
  let nuevaHora = t.hora;
  if (minutos) {
    const d = ctx.reloj.ahora();
    d.setMinutes(d.getMinutes() + Number(minutos));
    const dos = (n) => String(n).padStart(2, "0");
    nuevaFecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    nuevaHora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  } else if (fecha) {
    if (!fechaValida(fecha)) throw invalido("Fecha no válida.", { fecha: "Fecha no válida." });
    nuevaFecha = fecha;
    if (hora !== undefined) nuevaHora = hora || null;
  } else if (dias) {
    const n = Number(dias);
    if (!Number.isInteger(n) || n < 1 || n > 365) throw invalido("Los días deben ser un número entre 1 y 365.", { dias: "Entre 1 y 365." });
    nuevaFecha = sumaDias(t.fecha < hoy(ctx.reloj) ? hoy(ctx.reloj) : t.fecha, n);
  } else {
    throw invalido("Indica para cuándo quieres posponerla.");
  }
  ctx.bd.transaccion(() => {
    actualizar(ctx.bd, "tareas", id, { fecha: nuevaFecha, hora: nuevaHora, aviso_visto_en: null, actualizado_en: sello(ctx.reloj) });
    auditoria.registrar(ctx, "tarea", id, "posponer", { campo: "fecha", antes: t.fecha, despues: nuevaFecha });
  });
  return { tarea: obtenerFila(ctx, id), avisos: [] };
}

export function eliminar(ctx, id) {
  obtenerFila(ctx, id);
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM tareas WHERE id = ?", [id]);
    auditoria.registrar(ctx, "tarea", id, "eliminar", { resumen: "Tarea eliminada." });
  });
  return { eliminado: true };
}

export function avisoVisto(ctx, id) {
  obtenerFila(ctx, id);
  ctx.bd.ejecutar("UPDATE tareas SET aviso_visto_en = ? WHERE id = ?", [sello(ctx.reloj), id]);
  return { ok: true };
}

// ------------------------------------------------------------------ vistas ----
export function resumen(ctx) {
  const h = hoy(ctx.reloj);
  const hm = horaAhora(ctx.reloj);
  const lunes = lunesDe(h);
  const domingo = sumaDias(lunes, 6);
  const v = (sql, p) => Number(ctx.bd.valor(sql, p));
  return {
    hoy: v(`SELECT COUNT(*) FROM tareas t WHERE t.fecha = ? AND t.estado != 'cancelada'`, [h]),
    hoy_abiertas: v(`SELECT COUNT(*) FROM tareas t WHERE t.fecha = ? AND ${ABIERTA}`, [h]),
    hoy_por_hacer: v(`SELECT COUNT(*) FROM tareas t WHERE t.fecha = ? AND ${ABIERTA} AND (t.hora IS NULL OR t.hora >= ?)`, [h, hm]),
    semana: v(`SELECT COUNT(*) FROM tareas t WHERE t.fecha BETWEEN ? AND ? AND t.estado != 'cancelada'`, [lunes, domingo]),
    pendientes: v(`SELECT COUNT(*) FROM tareas t WHERE ${ABIERTA}`),
    vencidas: v(`SELECT COUNT(*) FROM tareas t WHERE ${ABIERTA} AND (t.fecha < ? OR (t.fecha = ? AND t.hora IS NOT NULL AND t.hora < ?))`, [h, h, hm]),
  };
}

export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion({ limite: 200, ...q });
  const h = hoy(ctx.reloj);
  const hm = horaAhora(ctx.reloj);
  const donde = ["1 = 1"];
  const p = [];
  switch (q.vista) {
    case "hoy": donde.push("t.fecha = ?", "t.estado != 'cancelada'"); p.push(h); break;
    case "semana": {
      const l = lunesDe(h);
      donde.push("t.fecha BETWEEN ? AND ?", "t.estado != 'cancelada'"); p.push(l, sumaDias(l, 6)); break;
    }
    case "pendientes": donde.push(ABIERTA); break;
    case "vencidas": donde.push(ABIERTA, "(t.fecha < ? OR (t.fecha = ? AND t.hora IS NOT NULL AND t.hora < ?))"); p.push(h, h, hm); break;
    case "hechas": donde.push("t.estado = 'hecha'"); break;
    case "calendario": {
      if (!fechaValida(q.desde) || !fechaValida(q.hasta)) throw invalido("Indica el rango de fechas del calendario.");
      donde.push("t.fecha BETWEEN ? AND ?", "t.estado != 'cancelada'"); p.push(q.desde, q.hasta); break;
    }
    default: break;
  }
  if (q.estado) donde.push("t.estado = ?"), p.push(q.estado);
  if (q.tipo) donde.push("t.tipo = ?"), p.push(q.tipo);
  if (q.prioridad) donde.push("t.prioridad = ?"), p.push(q.prioridad);
  if (q.responsable) donde.push("norm(t.responsable) = ?"), p.push(normaliza(q.responsable));
  for (const campo of ["contacto_id", "oportunidad_id", "inmueble_id", "demanda_id"]) if (q[campo]) donde.push(`t.${campo} = ?`), p.push(Number(q[campo]));
  if (q.q) donde.push(`norm(t.titulo) LIKE ? ESCAPE '\\'`), p.push(patronLike(normaliza(q.q)));
  const where = donde.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM tareas t WHERE ${where}`, p);
  const filas = ctx.bd.todos(
    `SELECT t.*, c.nombre AS contacto_nombre, c.apellidos AS contacto_apellidos, o.identificador AS oportunidad_identificador, i.referencia AS inmueble_referencia
     FROM tareas t LEFT JOIN contactos c ON c.id = t.contacto_id LEFT JOIN oportunidades o ON o.id = t.oportunidad_id LEFT JOIN inmuebles i ON i.id = t.inmueble_id
     WHERE ${where} ORDER BY t.fecha ASC, COALESCE(t.hora, '99:99') ASC, ${prioridadOrden} ASC, t.id ASC LIMIT ? OFFSET ?`,
    [...p, limite, offset],
  );
  return { datos: enriquecer(ctx, filas, h, hm), total, limite, offset, resumen: resumen(ctx) };
}

/** Tareas cuyo aviso ya ha llegado y no se han marcado como vistas. */
export function recordatorios(ctx) {
  const h = hoy(ctx.reloj);
  const hm = horaAhora(ctx.reloj);
  const ahoraMin = ctx.reloj.ahora();
  const filas = ctx.bd.todos(
    `SELECT t.*, c.nombre AS contacto_nombre, c.apellidos AS contacto_apellidos FROM tareas t LEFT JOIN contactos c ON c.id = t.contacto_id
     WHERE ${ABIERTA} AND t.aviso_min IS NOT NULL AND t.aviso_visto_en IS NULL AND t.fecha <= ? ORDER BY t.fecha, COALESCE(t.hora, '00:00')`, [h]);
  const items = [];
  for (const t of filas) {
    let llegado;
    if (t.fecha < h) llegado = true;
    else if (!t.hora) llegado = true; // sin hora: avisa desde el comienzo del día
    else {
      const [hh, mm] = t.hora.split(":").map(Number);
      const momento = new Date(ahoraMin.getFullYear(), ahoraMin.getMonth(), ahoraMin.getDate(), hh, mm - (t.aviso_min || 0), 0);
      llegado = ahoraMin >= momento;
    }
    if (llegado) items.push({ ...t, vencida: esVencida(t, h, hm) });
  }
  return { ahora: sello(ctx.reloj), items, resumen: resumen(ctx) };
}
