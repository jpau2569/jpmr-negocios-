// ============================================================================
//  Utilidades de interfaz. REGLA DE SEGURIDAD: todo el texto que viene de los
//  datos se inserta con nodos de texto (nunca innerHTML), así un nombre o una
//  nota con «<script>» se ve como texto y no se ejecuta. La CSP lo refuerza.
// ============================================================================
import { ApiError, etiqueta, colorDe } from "./api.js";

// ------------------------------------------------------------------ DOM ----
export function h(tag, props, ...hijos) {
  const el = document.createElement(tag);
  let valor;
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v); // CSSOM: permitido por la CSP
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") valor = v;
      else if (k === "checked" || k === "selected" || k === "disabled" || k === "indeterminate") el[k] = Boolean(v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  }
  anadir(el, hijos);
  if (valor !== undefined) el.value = valor;
  return el;
}
function anadir(el, hijos) {
  for (const x of hijos.flat(Infinity)) {
    if (x === null || x === undefined || x === false) continue;
    el.append(x instanceof Node ? x : document.createTextNode(String(x)));
  }
}
export const montar = (el, ...hijos) => { el.replaceChildren(); anadir(el, hijos); return el; };
export const texto = (s) => document.createTextNode(s ?? "");

// --------------------------------------------------------------- iconos ----
const SVG = "http://www.w3.org/2000/svg";
const ICONOS = {
  marca: "M3 11l9-8 9 8 M5 10v10h14V10 M9 14l2 2 4-4",
  inicio: "M3 11l9-8 9 8 M5 10v10h5v-6h4v6h5V10",
  oportunidades: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01",
  propietarios: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.5-6 8-6s8 2 8 6",
  inmuebles: "M4 21V5l8-2v18 M12 9h8v12 M3 21h18 M7 8h2 M7 12h2 M7 16h2 M15 13h2 M15 17h2",
  compradores: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14.8c2.4.6 4 2.3 4 5.2",
  demandas: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3 M8 11h6",
  agenda: "M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M4 10h16 M8 3v4 M16 3v4",
  visitas: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ofertas: "M3 3h8l10 10-8 8L3 11z M7.5 7.5h.01",
  operaciones: "M4 8h16v12H4z M9 8V5h6v3 M4 13h16",
  documentos: "M6 3h8l5 5v13H6z M14 3v5h5 M9 13h6 M9 17h6",
  marketing: "M3 11v3l12 5V6L3 11z M15 9c2.5.5 4 1.5 4 3s-1.5 2.5-4 3 M7 14v5",
  ia: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  informes: "M4 20V4 M4 20h16 M8 16v-5 M13 16V8 M18 16v-8",
  config: "M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4",
  mas: "M12 5v14 M5 12h14",
  campana: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3",
  x: "M6 6l12 12 M18 6L6 18",
  check: "M5 12l5 5L20 7",
  editar: "M4 20h4L19 9l-4-4L4 16z M13 7l4 4",
  papelera: "M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13 M10 11v6 M14 11v6",
  descargar: "M12 4v11 M7 11l5 5 5-5 M5 20h14",
  subir: "M12 16V5 M7 9l5-5 5 5 M5 20h14",
  enlace: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  candado: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  alerta: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 8h.01",
  flecha: "M9 6l6 6-6 6",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  mas3: "M5 12h.01 M12 12h.01 M19 12h.01",
};
export function icono(nombre, clase = "ico") {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", clase);
  for (const d of (ICONOS[nombre] || ICONOS.info).split(" M").map((s, i) => (i ? "M" + s : s))) {
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}
export function pintarIconos(raiz = document) {
  for (const el of raiz.querySelectorAll("[data-ico]")) {
    if (el.dataset.pintado) continue;
    el.dataset.pintado = "1";
    el.prepend(icono(el.dataset.ico));
  }
}

// --------------------------------------------------------- formato es-ES ----
const fmtEur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
export const eur = (n) => (n === null || n === undefined || n === "" ? "—" : fmtEur.format(n));
export const num = (n, unidad = "") => (n === null || n === undefined || n === "" ? "—" : `${fmtNum.format(n)}${unidad ? ` ${unidad}` : ""}`);
export const fecha = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export function fechaLarga(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function sello(isoUtc) {
  if (!isoUtc) return "—";
  return new Date(isoUtc).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function hace(isoUtc) {
  if (!isoUtc) return "—";
  const dias = Math.floor((Date.now() - Date.parse(isoUtc)) / 86400000);
  return dias <= 0 ? "hoy" : dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}
export const si = (v) => (v === 1 ? "Sí" : v === 0 ? "No" : null);
export function dato(valor, formato = (x) => x) {
  return valor === null || valor === undefined || valor === "" ? h("span", { class: "desconocido" }, "Sin indicar") : formato(valor);
}
export const nombreDe = (c) => [c?.nombre, c?.apellidos].filter(Boolean).join(" ");
export const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** Solo se enlazan URLs http(s): jamás javascript: ni data:. */
export const urlSegura = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

// ----------------------------------------------------------- componentes ----
export function chip(texto, color = "gris", { punto = true } = {}) {
  return h("span", { class: `chip ${color}${punto ? "" : " sin-punto"}` }, texto);
}
export const chipDe = (lista, clave) => chip(etiqueta(lista, clave), colorDe(lista, clave));

export function boton(contenido, { clase = "", onclick, tipo = "button", titulo, icono: ic, deshabilitado, aria, href } = {}) {
  const hijos = [ic ? icono(ic) : null, contenido ? h("span", { class: "texto-btn" }, contenido) : null];
  const props = { class: `btn ${clase}`.trim(), title: titulo, "aria-label": aria || (contenido ? undefined : titulo), disabled: deshabilitado };
  if (href) return h("a", { ...props, href }, ...hijos);
  return h("button", { ...props, type: tipo, onclick }, ...hijos);
}

export function aviso(nivel, ...contenido) {
  const cl = { info: "info", aviso: "aviso-amb", bloqueo: "bloqueo", ok: "ok" }[nivel] || "";
  return h("div", { class: `aviso ${cl}`, role: nivel === "bloqueo" ? "alert" : undefined }, icono(nivel === "ok" ? "check" : nivel === "info" ? "info" : "alerta"), h("div", null, ...contenido));
}

export function vacio(titulo, textoVacio, accion) {
  return h("div", { class: "vacio" }, h("h3", null, titulo), textoVacio ? h("p", null, textoVacio) : null, accion || null);
}
export const cargando = (t = "Cargando…") => h("div", { class: "cargando", role: "status" }, t);

export function errorCaja(err, reintentar) {
  const sinConexion = err instanceof ApiError && err.estado === 0;
  return h("div", { class: "panel" }, h("div", { class: "cuerpo" },
    vacio(sinConexion ? "No se puede contactar con el programa" : "No se pudo cargar", err.message,
      reintentar ? boton("Reintentar", { clase: "primario", onclick: reintentar }) : null)));
}

export function panel(titulo, cuerpo, { acciones, clase = "", sinPadding = false } = {}) {
  return h("section", { class: `panel ${clase}`.trim() },
    titulo || acciones ? h("header", null, typeof titulo === "string" ? h("h2", null, titulo) : titulo, acciones ? h("div", { class: "acciones" }, acciones) : null) : null,
    h("div", { class: sinPadding ? "" : "cuerpo" }, cuerpo));
}

export function cabecera({ titulo, subtitulo, migas, acciones }) {
  return h("div", null,
    migas ? h("div", { class: "migas" }, migas) : null,
    h("div", { class: "cab-pagina" },
      h("div", { class: "titulos" }, h("h1", null, titulo), subtitulo ? h("p", null, subtitulo) : null),
      acciones ? h("div", { class: "acciones" }, acciones) : null));
}

export function datosLista(pares) {
  return h("dl", { class: "datos" }, pares.filter(Boolean).map(([k, v, ancho]) => [h("div", { class: ancho ? "ancho" : "" }, h("dt", null, k), h("dd", null, v ?? h("span", { class: "desconocido" }, "Sin indicar")))]));
}

// ------------------------------------------------------------- avisos ----
export function toast(mensaje, { tipo = "ok", ms = 4500, titulo, acciones = [] } = {}) {
  const caja = document.getElementById("avisos");
  const el = h("div", { class: `toast ${tipo === "error" ? "error" : tipo === "aviso" ? "aviso-t" : ""}`, role: tipo === "error" ? "alert" : "status" },
    titulo ? h("div", { class: "titulo" }, titulo) : null,
    h("div", null, mensaje),
    acciones.length ? h("div", { class: "acc" }, acciones.map((a) => h("button", { type: "button", class: "btn", onclick: () => { a.onclick?.(); el.remove(); } }, a.texto))) : null);
  caja.append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}
export function toastError(err) {
  toast(err instanceof Error ? err.message : String(err), { tipo: "error", ms: 9000 });
}

// ------------------------------------------------------------ diálogos ----
let contadorDlg = 0;
/**
 * Abre un diálogo modal. Devuelve { el, cuerpo, pie, cerrar(valor), cerrado: Promise }.
 * Se cierra con Esc, con la X o llamando a cerrar().
 */
export function abrirDialogo({ titulo, clase = "", cuerpo, pie = [] }) {
  const id = `dlg-${++contadorDlg}`;
  const dlg = h("dialog", { class: `modal ${clase}`.trim(), "aria-labelledby": `${id}-t` });
  const cuerpoEl = h("div", { class: "cuerpo" }, cuerpo);
  const pieEl = h("footer", null, pie);
  let resolver;
  const cerrado = new Promise((r) => { resolver = r; });
  let valor = null;
  const cerrar = (v = null) => { valor = v; if (dlg.open) dlg.close(); };
  dlg.addEventListener("close", () => { dlg.remove(); resolver(valor); });
  dlg.addEventListener("cancel", () => { valor = null; });
  dlg.append(h("div", { class: "modal-caja" },
    h("header", null, h("h2", { id: `${id}-t` }, titulo), h("button", { type: "button", class: "btn icono suave", "aria-label": "Cerrar", onclick: () => cerrar(null) }, icono("x"))),
    cuerpoEl, pie.length ? pieEl : null));
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, cuerpo: cuerpoEl, pie: pieEl, cerrar, cerrado };
}

/** «¿Seguro?» con texto claro. Devuelve true/false. */
export function confirmar({ titulo = "¿Seguro?", mensaje, textoOk = "Confirmar", peligro = false, detalle }) {
  return new Promise((resolve) => {
    let d;
    const ok = boton(textoOk, { clase: peligro ? "peligro" : "primario", onclick: () => d.cerrar(true) });
    const no = boton("Cancelar", { onclick: () => d.cerrar(false) });
    d = abrirDialogo({ titulo, clase: "estrecho", cuerpo: [h("p", { style: { margin: "0 0 8px" } }, mensaje), detalle || null], pie: [no, ok] });
    d.cerrado.then((v) => resolve(v === true));
    no.focus();
  });
}

// ------------------------------------------------- acciones con feedback ----
/** Ejecuta una acción asíncrona mostrando error amigable. Devuelve el resultado o undefined. */
export async function conAviso(fn, { ok } = {}) {
  try {
    const r = await fn();
    if (ok) toast(typeof ok === "function" ? ok(r) : ok);
    return r;
  } catch (e) {
    toastError(e);
    return undefined;
  }
}

/** Crea un enlace que cambia la ruta hash. */
export const enlace = (texto, ruta, clase = "") => h("a", { href: ruta, class: clase }, texto);

export function debounce(fn, ms = 220) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
