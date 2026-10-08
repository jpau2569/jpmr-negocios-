// ============================================================================
//  Arranque de la interfaz: enrutador por hash, buscador global, menú «Nuevo»,
//  modo demostración y recordatorios internos (solo mientras la pantalla está
//  abierta: una web no puede avisar con la aplicación cerrada).
// ============================================================================
import { api, sesion, fijarModo, cargarCatalogos, ApiError } from "./api.js";
import { h, montar, pintarIconos, icono, boton, cargando, errorCaja, toast, toastError, confirmar, debounce, chipDe, nombreDe, vacio } from "./ui.js";
import { nuevoContacto, nuevaOportunidad, nuevoInmueble, nuevaDemanda, nuevaTarea } from "./formularios.js";
import { refrescar } from "./dialogos.js";

const $ = (id) => document.getElementById(id);
const contenido = $("contenido");

// --------------------------------------------------------------- rutas ----
const VISTAS = {
  inicio: () => import("./vistas/inicio.js"),
  oportunidades: () => import("./vistas/oportunidades.js"),
  contactos: () => import("./vistas/contactos.js"),
  inmuebles: () => import("./vistas/inmuebles.js"),
  demandas: () => import("./vistas/demandas.js"),
  agenda: () => import("./vistas/agenda.js"),
  configuracion: () => import("./vistas/configuracion.js"),
  pendiente: () => import("./vistas/pendiente.js"),
};
const FUTURAS = ["visitas", "ofertas", "operaciones", "documentos", "marketing", "asistente", "informes"];
const TITULOS = {
  inicio: "Inicio", oportunidades: "Oportunidades", propietarios: "Propietarios", compradores: "Compradores", contactos: "Contacto", inmuebles: "Inmuebles",
  demandas: "Demandas", agenda: "Agenda y tareas", configuracion: "Configuración", visitas: "Visitas", ofertas: "Ofertas", operaciones: "Operaciones",
  documentos: "Documentos", marketing: "Marketing", asistente: "Asistente IA", informes: "Informes",
};

function leerHash() {
  const crudo = location.hash.slice(1) || "/inicio";
  const [ruta, qs] = crudo.split("?");
  return { partes: ruta.split("/").filter(Boolean).map(decodeURIComponent), query: Object.fromEntries(new URLSearchParams(qs || "")) };
}

let ficha = 0;
async function pintar({ conservarFoco = false } = {}) {
  const mia = ++ficha;
  const { partes, query } = leerHash();
  const raiz = partes[0] || "inicio";
  marcarMenu(raiz);
  document.title = `${TITULOS[raiz] || "CAPTAOPORTUNIDADES"} · CAPTAOPORTUNIDADES ASTURIAS`;
  montar(contenido, cargando());
  const contexto = { partes, query, refrescar: () => pintar({ conservarFoco: true }) };
  try {
    let modulo, vista;
    if (raiz === "inicio") { modulo = await VISTAS.inicio(); vista = modulo.vista; }
    else if (raiz === "oportunidades") { modulo = await VISTAS.oportunidades(); vista = partes[1] ? modulo.detalle : modulo.lista; }
    else if (raiz === "propietarios" || raiz === "compradores") { modulo = await VISTAS.contactos(); vista = (c, x) => modulo.lista(c, { ...x, modo: raiz }); }
    else if (raiz === "contactos") { modulo = await VISTAS.contactos(); vista = partes[1] ? modulo.detalle : modulo.lista; }
    else if (raiz === "inmuebles") { modulo = await VISTAS.inmuebles(); vista = partes[1] ? modulo.detalle : modulo.lista; }
    else if (raiz === "demandas") { modulo = await VISTAS.demandas(); vista = partes[1] ? modulo.detalle : modulo.lista; }
    else if (raiz === "agenda") { modulo = await VISTAS.agenda(); vista = modulo.vista; }
    else if (raiz === "configuracion") { modulo = await VISTAS.configuracion(); vista = modulo.vista; }
    else if (FUTURAS.includes(raiz)) { modulo = await VISTAS.pendiente(); vista = (c, x) => modulo.vista(c, { ...x, seccion: raiz }); }
    else { vista = (c) => montar(c, vacio("Esa página no existe", "Usa el menú de la izquierda para volver a una sección.", boton("Ir al inicio", { clase: "primario", href: "#/inicio" }))); }
    const fragmento = h("div");
    await vista(fragmento, contexto);
    if (mia !== ficha) return;
    montar(contenido, ...fragmento.childNodes);
    pintarIconos(contenido);
    if (!conservarFoco) { contenido.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  } catch (e) {
    if (mia !== ficha) return;
    montar(contenido, errorCaja(e instanceof Error ? e : new Error(String(e)), () => pintar()));
    if (!(e instanceof ApiError)) console.error(e);
  }
}

function marcarMenu(raiz) {
  const activa = raiz === "contactos" ? "propietarios" : raiz;
  for (const a of document.querySelectorAll("#nav a")) {
    if (a.dataset.ruta === activa) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

// ----------------------------------------------------------- cromado ----
function pintarCromado() {
  const demo = sesion.modo === "demo";
  const banner = $("banner-demo");
  banner.hidden = !demo;
  if (demo) {
    montar(banner, icono("alerta"),
      h("span", { class: "txt" }, h("b", null, "MODO DEMOSTRACIÓN"), " · Estos datos son ficticios y están separados de los tuyos. Nada de lo que hagas aquí afecta a tu información real."),
      h("div", { class: "acc" },
        boton("Restablecer la demostración", { clase: "peq", onclick: async () => {
          if (!(await confirmar({ titulo: "Restablecer la demostración", mensaje: "Se borrará lo que hayas hecho en la demostración y volverá a su estado inicial. Tus datos reales no se tocan.", textoOk: "Restablecer" }))) return;
          try { await api.post("/api/demo/restablecer"); toast("Demostración restablecida."); refrescar(); } catch (e) { toastError(e); }
        } }),
        boton("Volver a mis datos reales", { clase: "peq primario", onclick: () => cambiarModo("real") })));
  }
  document.body.dataset.modo = sesion.modo;
  $("menu-modo").textContent = demo ? "Datos de demostración (ficticios)" : "Datos reales";
  const btn = $("btn-demo");
  btn.textContent = demo ? "Volver a mis datos reales" : "Probar con datos de demostración";
}
async function cambiarModo(modo) {
  fijarModo(modo);
  try { await cargarCatalogos(true); } catch (e) { toastError(e); }
  pintarCromado();
  anunciados.clear();
  sondear();
  if (leerHash().partes[0] === "inicio") pintar(); else location.hash = "#/inicio";
  toast(modo === "demo" ? "Estás en la demostración: datos ficticios y separados de los reales." : "De vuelta a tus datos reales.", { ms: 5000 });
}

// -------------------------------------------------------- buscador global ----
function iniciarBuscador() {
  const entrada = $("buscar");
  const caja = $("resultados");
  let ultimo = 0;
  const cerrar = () => { caja.hidden = true; };
  const buscar = debounce(async () => {
    const q = entrada.value.trim();
    if (q.length < 2) { cerrar(); return; }
    const mia = ++ultimo;
    try {
      const r = await api.get("/api/buscar", { q });
      if (mia !== ultimo) return;
      if (!r.grupos.length) { montar(caja, h("div", { class: "ayuda", style: { padding: "12px" } }, `Sin resultados para «${q}».`)); caja.hidden = false; return; }
      montar(caja, ...r.grupos.map((g) => [h("h4", null, g.titulo), ...g.items.map((it) => h("a", { href: it.ruta, onclick: () => { cerrar(); entrada.value = ""; } },
        h("span", null, it.titulo), h("small", null, it.detalle || ""), it.alerta ? chipDe("estados_habilitacion", "baja") && h("span", { class: "chip rojo" }, it.alerta) : null))]));
      caja.hidden = false;
    } catch { cerrar(); }
  }, 200);
  entrada.addEventListener("input", buscar);
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { cerrar(); entrada.blur(); }
    if (e.key === "ArrowDown") { caja.querySelector("a")?.focus(); e.preventDefault(); }
    if (e.key === "Enter") { const a = caja.querySelector("a"); if (a) { location.hash = a.getAttribute("href"); cerrar(); entrada.value = ""; entrada.blur(); } }
  });
  caja.addEventListener("keydown", (e) => {
    const enlaces = [...caja.querySelectorAll("a")];
    const i = enlaces.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { enlaces[i + 1]?.focus(); e.preventDefault(); }
    if (e.key === "ArrowUp") { (enlaces[i - 1] || entrada).focus(); e.preventDefault(); }
    if (e.key === "Escape") { cerrar(); entrada.focus(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".buscador")) cerrar(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.querySelector("dialog[open]")) { e.preventDefault(); entrada.focus(); }
  });
}

// ------------------------------------------------------------ menú Nuevo ----
function iniciarNuevo() {
  const btn = $("btn-nuevo");
  const lista = $("lista-nuevo");
  const cerrar = () => { lista.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", () => { lista.hidden = !lista.hidden; btn.setAttribute("aria-expanded", String(!lista.hidden)); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu-nuevo")) cerrar(); });
  lista.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-nuevo]");
    if (!b) return;
    cerrar();
    const que = b.dataset.nuevo;
    const crear = { oportunidad: nuevaOportunidad, contacto: () => nuevoContacto(), inmueble: nuevoInmueble, demanda: nuevaDemanda, tarea: () => nuevaTarea() }[que];
    const r = await crear();
    if (!r) return;
    const destino = { oportunidad: `#/oportunidades/${r.id}`, contacto: `#/contactos/${r.id}`, inmueble: `#/inmuebles/${r.id}`, demanda: `#/demandas/${r.id}`, tarea: "#/agenda" }[que];
    toast("Guardado.");
    if (location.hash === destino) refrescar(); else location.hash = destino;
  });
}

// ----------------------------------------------------- recordatorios ----
const anunciados = new Set();
async function sondear() {
  try {
    const r = await api.get("/api/recordatorios");
    const n = r.resumen.vencidas + (r.resumen.hoy_por_hacer ?? 0);
    const badge = $("campana-n");
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? "99+" : String(n);
    $("campana").setAttribute("aria-label", n ? `${n} tareas de hoy o vencidas` : "Sin tareas pendientes para hoy");
    for (const t of r.items) {
      if (anunciados.has(t.id)) continue;
      anunciados.add(t.id);
      const cuando = `${t.hora ? t.hora : "todo el día"}${t.vencida ? " · vencida" : ""}`;
      toast(h("span", null, h("b", null, t.titulo), h("br"), h("small", null, cuando)), {
        tipo: "aviso", titulo: "Recordatorio", ms: 20000,
        acciones: [
          { texto: "Hecha", onclick: async () => { await api.post(`/api/tareas/${t.id}/completar`); sondear(); if (leerHash().partes[0] === "agenda") refrescar(); } },
          { texto: "En 1 hora", onclick: async () => { await api.post(`/api/tareas/${t.id}/posponer`, { minutos: 60 }); anunciados.delete(t.id); sondear(); } },
          { texto: "Entendido", onclick: async () => { await api.post(`/api/tareas/${t.id}/aviso-visto`); sondear(); } },
        ],
      });
      try { if (window.Notification?.permission === "granted") new Notification("Recordatorio", { body: t.titulo }); } catch { /* sin permiso */ }
    }
  } catch { /* si falla el sondeo no se molesta al usuario */ }
}

// ---------------------------------------------------------------- inicio ----
async function arrancar() {
  pintarIconos(document);
  iniciarBuscador();
  iniciarNuevo();
  const menu = $("menu"), velo = $("velo"), btnMenu = $("btn-menu");
  const cerrarMenu = () => { menu.classList.remove("abierto"); velo.hidden = true; btnMenu.setAttribute("aria-expanded", "false"); };
  btnMenu.addEventListener("click", () => { menu.classList.add("abierto"); velo.hidden = false; btnMenu.setAttribute("aria-expanded", "true"); });
  velo.addEventListener("click", cerrarMenu);
  $("nav").addEventListener("click", cerrarMenu);
  $("btn-demo").addEventListener("click", () => cambiarModo(sesion.modo === "demo" ? "real" : "demo"));
  window.addEventListener("hashchange", () => { cerrarMenu(); pintar(); });
  window.addEventListener("captao:refrescar", () => pintar({ conservarFoco: true }));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });
  try {
    await cargarCatalogos();
  } catch (e) {
    montar(contenido, errorCaja(e, () => location.reload()));
    return;
  }
  pintarCromado();
  await pintar();
  sondear();
  setInterval(sondear, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sondear(); });
}

arrancar();
export { nombreDe };
