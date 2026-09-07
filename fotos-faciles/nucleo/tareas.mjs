// ============================================================================
//  Fotos Fáciles — tareas largas con barra de progreso
// ----------------------------------------------------------------------------
//  Importar 300 fotos de un pendrive tarda. En vez de dejar la petición HTTP
//  colgada (y que el navegador la corte), se crea una tarea con identificador y
//  la pantalla va preguntando cómo va. Se puede cancelar a mitad.
// ============================================================================
import crypto from "node:crypto";

const tareas = new Map();
const CADUCIDAD_MS = 30 * 60_000;

export function nuevaTarea(titulo, total = 0) {
  const id = crypto.randomBytes(8).toString("hex");
  const tarea = {
    id, titulo, total, hechos: 0, copiados: 0, duplicados: 0, fallidos: 0,
    bytes: 0, estado: "en curso", archivo: "", error: null, cancelada: false,
    empezada: Date.now(), terminada: null, detalles: [],
  };
  tareas.set(id, tarea);
  limpia();
  return tarea;
}

export const verTarea = (id) => tareas.get(String(id)) || null;

export function cancelaTarea(id) {
  const t = tareas.get(String(id));
  if (t && t.estado === "en curso") { t.cancelada = true; return true; }
  return false;
}

export function terminaTarea(tarea, extra = {}) {
  tarea.estado = tarea.cancelada ? "cancelada" : (extra.error ? "error" : "terminada");
  tarea.terminada = Date.now();
  Object.assign(tarea, extra);
  return tarea;
}

function limpia() {
  const ahora = Date.now();
  for (const [id, t] of tareas) {
    if (t.terminada && ahora - t.terminada > CADUCIDAD_MS) tareas.delete(id);
  }
}

/** Solo para los tests. */
export function olvidaTareas() { tareas.clear(); }
