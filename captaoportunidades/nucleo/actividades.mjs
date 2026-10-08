// ============================================================================
//  Actividades: el historial de conversaciones y notas, colgado de un
//  contacto, oportunidad, inmueble o demanda (al menos uno).
//  Registrar una llamada que YA ocurrió nunca se bloquea (es un registro),
//  pero se avisa si el contacto figura como «No contactar».
// ============================================================================
import { insertar, actualizar } from "./bd.mjs";
import { limpiar, exige, ACTIVIDAD } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { paginacion } from "./config.mjs";
import { noEncontrado, sello, hoy, horaAhora } from "./util.mjs";
import { TIPOS_CONVERSACION } from "./catalogos.mjs";

const RELACIONES = [
  ["contacto_id", "contactos", "El contacto"],
  ["oportunidad_id", "oportunidades", "La oportunidad"],
  ["inmueble_id", "inmuebles", "El inmueble"],
  ["demanda_id", "demandas", "La demanda"],
];

export function exigeRelaciones(ctx, v, errores, { minimoUna = true } = {}) {
  let alguna = false;
  for (const [campo, tabla, nombre] of RELACIONES) {
    if (v[campo]) {
      alguna = true;
      if (!ctx.bd.uno(`SELECT 1 FROM ${tabla} WHERE id = ?`, [v[campo]])) errores[campo] = `${nombre} ya no existe.`;
    }
  }
  if (minimoUna && !alguna) errores.contacto_id = "Elige a qué pertenece: un contacto, una oportunidad, un inmueble o una demanda.";
}

export function crear(ctx, entrada) {
  const { valores, errores } = limpiar(ACTIVIDAD, entrada);
  valores.fecha = valores.fecha || hoy(ctx.reloj);
  if (!valores.hora && valores.fecha === hoy(ctx.reloj) && !(entrada && "hora" in entrada)) valores.hora = horaAhora(ctx.reloj);
  exigeRelaciones(ctx, valores, errores);
  exige(errores);
  const avisos = [];
  if (valores.contacto_id && TIPOS_CONVERSACION.includes(valores.tipo) && valores.direccion === "saliente") {
    const c = ctx.bd.uno("SELECT no_contactar FROM contactos WHERE id = ?", [valores.contacto_id]);
    if (c?.no_contactar) avisos.push("Este contacto figura como «No contactar». Se ha registrado la actividad, pero no deberías volver a comunicarte con él.");
  }
  const id = ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    const nuevo = insertar(ctx.bd, "actividades", { ...valores, creado_en: ahora, actualizado_en: ahora });
    const ent = valores.oportunidad_id ? ["oportunidad", valores.oportunidad_id] : valores.contacto_id ? ["contacto", valores.contacto_id] : valores.inmueble_id ? ["inmueble", valores.inmueble_id] : ["demanda", valores.demanda_id];
    auditoria.registrar(ctx, ent[0], ent[1], "actividad", { resumen: `Actividad registrada (${valores.tipo}).` });
    // Una conversación con el comprador confirma su demanda: renueva la fecha de actualización.
    if (valores.demanda_id && TIPOS_CONVERSACION.includes(valores.tipo)) ctx.bd.ejecutar("UPDATE demandas SET actualizado_en = ? WHERE id = ? AND estado = 'activa'", [ahora, valores.demanda_id]);
    return nuevo;
  });
  return { actividad: ctx.bd.uno("SELECT * FROM actividades WHERE id = ?", [id]), avisos };
}

export function actualizarActividad(ctx, id, entrada) {
  const actual = ctx.bd.uno("SELECT * FROM actividades WHERE id = ?", [id]);
  if (!actual) throw noEncontrado("La actividad");
  const { valores, errores } = limpiar(ACTIVIDAD, entrada, { parcial: true });
  for (const k of ["tipo", "fecha", "resumen", "direccion"]) if (valores[k] === null) delete valores[k];
  exigeRelaciones(ctx, { ...actual, ...valores }, errores);
  exige(errores);
  ctx.bd.transaccion(() => {
    auditoria.registrarDiff(ctx, "actividad", id, ACTIVIDAD, actual, valores);
    actualizar(ctx.bd, "actividades", id, { ...valores, actualizado_en: sello(ctx.reloj) });
  });
  return ctx.bd.uno("SELECT * FROM actividades WHERE id = ?", [id]);
}

export function eliminar(ctx, id) {
  if (!ctx.bd.uno("SELECT 1 FROM actividades WHERE id = ?", [id])) throw noEncontrado("La actividad");
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM actividades WHERE id = ?", [id]);
    auditoria.registrar(ctx, "actividad", id, "eliminar", { resumen: "Actividad eliminada." });
  });
  return { eliminado: true };
}

export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion(q);
  const donde = ["1 = 1"];
  const p = [];
  for (const [campo] of RELACIONES) if (q[campo]) donde.push(`a.${campo} = ?`), p.push(Number(q[campo]));
  if (q.tipo) donde.push("a.tipo = ?"), p.push(q.tipo);
  if (q.desde) donde.push("a.fecha >= ?"), p.push(q.desde);
  if (q.hasta) donde.push("a.fecha <= ?"), p.push(q.hasta);
  const where = donde.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM actividades a WHERE ${where}`, p);
  const datos = ctx.bd.todos(`SELECT a.* FROM actividades a WHERE ${where} ORDER BY a.fecha DESC, COALESCE(a.hora, '') DESC, a.id DESC LIMIT ? OFFSET ?`, [...p, limite, offset]);
  return { datos, total, limite, offset };
}

