// ============================================================================
//  Piezas comunes de las pantallas de lista: tabla responsive (en móvil se
//  convierte en tarjetas), paginador, barra de filtros, línea de tiempo y
//  tarjetas de actividad/tareas/historial reutilizadas en las fichas.
// ============================================================================
import { h, boton, chip, chipDe, vacio, fecha, sello, icono, debounce, conAviso, toast } from "../ui.js";
import { api, etiqueta } from "../api.js";
import { refrescar } from "../dialogos.js";

/** Filtros por pantalla que sobreviven al ir a una ficha y volver. */
const memoria = new Map();
export function filtrosDe(clave, defecto, query = {}) {
  const hayQuery = Object.keys(query).length > 0;
  const base = hayQuery ? { ...defecto } : { ...defecto, ...(memoria.get(clave) || {}) };
  for (const [k, v] of Object.entries(query)) if (k in defecto || k === "q") base[k] = v;
  memoria.set(clave, base);
  // El filtro de la URL se consume UNA vez: si no, cada refresco lo volvería a aplicar y no se podría cambiar de pestaña o filtro.
  if (hayQuery && location.hash.includes("?")) history.replaceState(null, "", location.hash.split("?")[0]);
  return base;
}

/**
 * columnas: [{ t: 'Cabecera', c: (fila) => nodo, num?: true, sinEtq?: true, clase? }]
 * opciones.ruta(fila) → destino al pulsar la fila.
 */
export function tabla(columnas, filas, { ruta, vacioMsg } = {}) {
  if (!filas.length) return vacioMsg || null;
  return h("div", { class: "tabla-caja" }, h("table", { class: "tabla" },
    h("thead", null, h("tr", null, columnas.map((c) => h("th", { scope: "col", class: c.num ? "num" : "" }, c.t)))),
    h("tbody", null, filas.map((f) => h("tr", {
      class: ruta ? "fila" : "",
      onclick: ruta ? (e) => { if (e.target.closest("a, button, input, select, label")) return; location.hash = ruta(f); } : undefined,
    }, columnas.map((c) => h("td", { "data-label": c.t, class: `${c.num ? "num" : ""} ${c.sinEtq ? "sin-etq" : ""} ${c.clase || ""}`.trim() }, c.c(f)))))),
  ));
}

export function paginador({ total, limite, offset }, alCambiar, nombre = "registros") {
  const desde = total ? offset + 1 : 0;
  const hasta = Math.min(total, offset + limite);
  return h("div", { class: "pie-tabla" },
    h("span", null, total ? `Mostrando ${desde}–${hasta} de ${total} ${nombre}` : `0 ${nombre}`),
    h("span", { class: "chips" },
      boton("Anterior", { clase: "peq", deshabilitado: offset <= 0, onclick: () => alCambiar(Math.max(0, offset - limite)) }),
      boton("Siguiente", { clase: "peq", deshabilitado: offset + limite >= total, onclick: () => alCambiar(offset + limite) })));
}

/**
 * Barra de filtros. def: [{ n, etq, t: 'texto'|'select'|'num', op?: [{valor,texto}], ancho?: true, lista?: [] }]
 */
export function barraFiltros(def, valores, alCambiar) {
  const dispara = debounce(alCambiar, 280);
  return h("div", { class: "filtros", role: "search" }, def.map((f) => {
    const id = `filtro-${f.n}`;
    let control;
    if (f.t === "select") {
      control = h("select", { id, onchange: (e) => { valores[f.n] = e.target.value; alCambiar(); } }, h("option", { value: "" }, f.vacio || "Todos"), f.op.map((o) => h("option", { value: o.valor }, o.texto)));
      control.value = valores[f.n] ?? "";
    } else {
      const lid = f.lista ? `${id}-dl` : undefined;
      control = [h("input", { id, type: f.t === "num" ? "text" : "search", inputmode: f.t === "num" ? "numeric" : undefined, value: valores[f.n] ?? "", placeholder: f.ph || "", list: lid,
        oninput: (e) => { valores[f.n] = e.target.value.trim(); dispara(); } }),
      f.lista ? h("datalist", { id: lid }, f.lista.map((x) => h("option", { value: x }))) : null];
    }
    return h("div", { class: `campo ${f.ancho ? "ancho" : ""}` }, h("label", { for: id }, f.etq), control);
  }));
}

export function lineaTiempo(items) {
  return h("ul", { class: "linea-tiempo" }, items.map((it) => h("li", null, h("div", { class: "cuando" }, it.cuando), h("div", { class: "que" }, it.que))));
}

export const textoActividad = (a) => [
  h("b", null, etiqueta("tipos_actividad", a.tipo)),
  a.direccion && a.direccion !== "interna" ? ` · ${a.direccion === "entrante" ? "entrante" : "saliente"}` : "",
  a.resultado ? ` · ${a.resultado}` : "", h("br"), a.resumen,
];

/** Panel «Actividad» de una ficha, con botón para registrar. */
export function listaActividades(actividades, { alAnadir, alBorrar } = {}) {
  if (!actividades.length) return vacio("Aún no hay actividad", "Registra aquí las llamadas, mensajes, reuniones y notas.", alAnadir ? boton("Registrar actividad", { clase: "primario peq", icono: "mas", onclick: alAnadir }) : null);
  return lineaTiempo(actividades.map((a) => ({
    cuando: [`${fecha(a.fecha)}${a.hora ? ` ${a.hora}` : ""}`, alBorrar ? h("button", { type: "button", class: "btn peq suave", "aria-label": "Eliminar esta actividad", title: "Eliminar", onclick: () => alBorrar(a) }, icono("papelera")) : null],
    que: textoActividad(a),
  })));
}

export function listaTareasFicha(tareas, { alCompletar } = {}) {
  if (!tareas.length) return h("p", { class: "ayuda", style: { margin: 0 } }, "No hay tareas pendientes.");
  return h("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" } }, tareas.map((t) => h("li", { style: { display: "flex", gap: "8px", alignItems: "flex-start" } },
    h("input", { type: "checkbox", "aria-label": `Completar: ${t.titulo}`, onchange: async () => { await conAviso(() => api.post(`/api/tareas/${t.id}/completar`)); alCompletar ? alCompletar() : refrescar(); } }),
    h("span", null, h("b", null, t.titulo), h("br"), h("small", { class: "ayuda" }, `${fecha(t.fecha)}${t.hora ? ` ${t.hora}` : ""} · ${etiqueta("tipos_tarea", t.tipo)}`)))));
}

/** Historial de cambios (campo a campo). Los datos personales no guardan su valor. */
export function listaCambios(cambios) {
  if (!cambios.length) return h("p", { class: "ayuda", style: { margin: 0 } }, "Sin cambios registrados.");
  const nombres = { estado: "Estado", precio_actual: "Precio", estado_comercial: "Estado comercial", municipio: "Municipio", zona: "Zona" };
  return lineaTiempo(cambios.map((c) => ({
    cuando: sello(c.fecha),
    que: c.resumen
      ? c.resumen
      : c.campo === "estado" ? ["Estado: ", c.valor_anterior ? [chipDe(c.entidad === "tarea" ? "estados_tarea" : "estados_oportunidad", c.valor_anterior), " → "] : "", chipDe(c.entidad === "tarea" ? "estados_tarea" : "estados_oportunidad", c.valor_nuevo)]
      : c.campo ? `${nombres[c.campo] || c.campo}: ${c.valor_anterior ?? "—"} → ${c.valor_nuevo ?? "—"}` : c.accion,
  })));
}

export { chip, toast };
