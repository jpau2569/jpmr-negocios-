// ============================================================================
//  Fotos para Idealista — estado, eventos y salida
// ----------------------------------------------------------------------------
//  Las fotos solo viven en la memoria de esta pestaña: no se guardan en
//  ningún sitio. En localStorage quedan únicamente los ajustes (retoque, IA,
//  tema y la clave de sincronización de este aparato).
// ============================================================================

import { ordenarParaIdealista, nombresArchivo, nombreZip, MAX_FOTOS_IA, MAX_B64_PETICION } from "./catalogo.js";
import { propuestaDuplicados } from "./duplicados.js";
import { preparar } from "./cargar.js";
import { htmlFoto, htmlApartada, htmlEstadoIA, htmlResumen } from "./interfaz.js";
import { crearZip, descargar } from "./zip.js";

const MAX_FOTOS = 60;
const CLAVE_AJUSTES = "fotos-idealista:ajustes";
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------------------
//  Estado
// ---------------------------------------------------------------------------
const estado = {
  fotos: [],          // en el orden del anuncio; las apartadas se saltan
  ia: { estado: "", mensaje: "" },
  ajustes: leerAjustes(),
  ocupado: false,
  ordenManual: false,  // si Pau ya ha movido fotos, las nuevas van al final
};
let contador = 0;

function leerAjustes() {
  try {
    return { retoque: true, ia: true, clave: "", tema: "", ...JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}") };
  } catch { return { retoque: true, ia: true, clave: "", tema: "" }; }
}
function guardarAjustes() {
  try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(estado.ajustes)); } catch { /* modo privado */ }
}

const activas = () => estado.fotos.filter((f) => !f.descartada);
const apartadas = () => estado.fotos.filter((f) => f.descartada);
const porId = (id) => estado.fotos.find((f) => f.id === id);
const posicionDe = (id) => { const i = activas().findIndex((f) => f.id === id); return i >= 0 ? i + 1 : 0; };
const nombres = () => nombresArchivo(activas().map((f) => f.estancia));

// ---------------------------------------------------------------------------
//  Pintar
// ---------------------------------------------------------------------------
const arrastrable = matchMedia("(pointer: fine)").matches;

function pintar() {
  const lista = activas(), fuera = apartadas(), ns = nombres();
  const hay = estado.fotos.length > 0;
  $("#bloque-fotos").classList.toggle("oculto", !hay);
  $("#bloque-salida").classList.toggle("oculto", !lista.length);
  $("#resumen").innerHTML = htmlResumen(lista.length, fuera.length);
  $("#estado-ia").innerHTML = htmlEstadoIA(estado.ia);
  $("#lista").innerHTML = lista.map((f, i) => htmlFoto(f, i + 1, lista.length, ns[i], { posicionDe, arrastrable })).join("");
  $("#bloque-apartadas").classList.toggle("oculto", !fuera.length);
  $("#apartadas").innerHTML = fuera.map((f) => htmlApartada(f, { posicionDe })).join("");
  $("#reanalizar").classList.toggle("oculto", !estado.ajustes.ia || !lista.length);
  for (const b of document.querySelectorAll("#zip, #compartir, #una-a-una, #ordenar, #reanalizar")) b.disabled = estado.ocupado;
}

function progreso(texto, fraccion) {
  const caja = $("#progreso");
  if (texto == null) { caja.classList.add("oculto"); return; }
  caja.classList.remove("oculto");
  $("#progreso-texto").textContent = texto;
  $("#progreso-barra").style.width = `${Math.round(Math.min(1, Math.max(0, fraccion)) * 100)}%`;
}

function error(texto) {
  const p = document.createElement("p");
  p.textContent = texto;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn-cerrar"; b.textContent = "×"; b.setAttribute("aria-label", "Cerrar aviso");
  b.onclick = () => p.remove();
  p.append(b);
  $("#errores").append(p);
}

// ---------------------------------------------------------------------------
//  Cargar y preparar
// ---------------------------------------------------------------------------
const pareceImagen = (a) => a.type.startsWith("image/") || /\.(jpe?g|png|webp|hei[cf])$/i.test(a.name);

async function anadir(archivos) {
  if (estado.ocupado) return;
  let nuevos = [...archivos].filter(pareceImagen);
  const ignorados = archivos.length - nuevos.length;
  if (ignorados) error(`${ignorados} ${ignorados === 1 ? "archivo no es una foto y se ha" : "archivos no son fotos y se han"} dejado fuera.`);
  const hueco = MAX_FOTOS - estado.fotos.length;
  if (nuevos.length > hueco) {
    error(`Como mucho ${MAX_FOTOS} fotos por piso: se han dejado fuera ${nuevos.length - Math.max(0, hueco)}.`);
    nuevos = nuevos.slice(0, Math.max(0, hueco));
  }
  if (!nuevos.length) return;

  estado.ocupado = true;
  pintar();
  let hechas = 0;
  for (const archivo of nuevos) {
    progreso(`Preparando foto ${hechas + 1} de ${nuevos.length}…`, hechas / nuevos.length);
    try {
      const r = await preparar(archivo, { retoque: estado.ajustes.retoque });
      estado.fotos.push({
        id: `f${++contador}`, archivo, nombreOriginal: archivo.name, ...r,
        vistaUrl: URL.createObjectURL(r.vista),
        estancia: null, estanciaManual: false, ia: null, descartada: false, motivo: null, parecidaA: null, mantener: false,
      });
    } catch (e) {
      error(`No he podido abrir «${archivo.name}»: ${e.message}`);
    }
    hechas++;
    pintar();
  }
  progreso(null);
  marcarDuplicados();
  estado.ocupado = false;
  if (estado.ajustes.ia) await analizarIA();
  else estado.ia = { estado: "apagada", mensaje: "" };
  if (estado.ordenManual) pintar();
  else ordenar();
}

/** Aparta las repetidas (salvo las que Pau ha decidido mantener). */
function marcarDuplicados() {
  const candidatas = estado.fotos.filter((f) => !f.mantener && (!f.descartada || f.motivo === "duplicado"));
  for (const f of candidatas) if (f.motivo === "duplicado") { f.descartada = false; f.motivo = null; f.parecidaA = null; }
  for (const p of propuestaDuplicados(candidatas)) {
    const buena = candidatas[p.quedarse];
    for (const i of p.quitar) Object.assign(candidatas[i], { descartada: true, motivo: "duplicado", parecidaA: buena.id });
  }
}

/** Reprocesa todas las fotos (al cambiar el interruptor de retoque). */
async function reprocesar() {
  if (!estado.fotos.length || estado.ocupado) return;
  estado.ocupado = true;
  pintar();
  let n = 0;
  for (const f of estado.fotos) {
    progreso(`Volviendo a preparar la foto ${n + 1} de ${estado.fotos.length}…`, n / estado.fotos.length);
    try {
      const r = await preparar(f.archivo, { retoque: estado.ajustes.retoque });
      URL.revokeObjectURL(f.vistaUrl);
      Object.assign(f, r, { vistaUrl: URL.createObjectURL(r.vista) });
    } catch (e) { error(`No he podido volver a preparar «${f.nombreOriginal}»: ${e.message}`); }
    n++;
  }
  progreso(null);
  estado.ocupado = false;
  pintar();
}

// ---------------------------------------------------------------------------
//  IA (opcional)
// ---------------------------------------------------------------------------
/** Trocea en envíos de ≤ 20 fotos y ≤ 3,6 MB (Vercel corta a 4,5 MB). */
function trozos(fotos) {
  const salida = [];
  let actual = [], peso = 0;
  for (const f of fotos) {
    if (actual.length && (actual.length >= MAX_FOTOS_IA || peso + f.mini.length > MAX_B64_PETICION)) {
      salida.push(actual); actual = []; peso = 0;
    }
    actual.push(f); peso += f.mini.length;
  }
  if (actual.length) salida.push(actual);
  return salida;
}

async function analizarIA() {
  const fotos = activas();
  if (!fotos.length) return;
  estado.ocupado = true;
  estado.ia = { estado: "trabajando", mensaje: `La IA está mirando ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}…` };
  pintar();
  try {
    let revisadas = 0;
    for (const grupo of trozos(fotos)) {
      const r = await fetch("/api/fotos-idealista", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave: estado.ajustes.clave, fotos: grupo.map((f) => ({ data: f.mini, media_type: "image/jpeg" })) }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok || !datos.ok) {
        const e = new Error(datos.error || `el servidor ha respondido ${r.status}.`);
        e.codigo = r.status;
        throw e;
      }
      grupo.forEach((f, i) => {
        const x = datos.fotos?.[i];
        if (!x) return;
        f.ia = x;
        if (!f.estanciaManual) f.estancia = x.estancia;
        revisadas++;
      });
    }
    estado.ia = { estado: "ok", mensaje: `La IA ha revisado ${revisadas} ${revisadas === 1 ? "foto" : "fotos"}. Repasa lo que propone: tú decides.` };
  } catch (e) {
    let msg = e.message;
    if (e.codigo === 401) msg = `${e.message} Escríbela en «Clave de la IA».`;
    if (e instanceof TypeError) msg = "no hay conexión con el servidor.";
    estado.ia = { estado: "error", mensaje: /[.!?]$/.test(msg) ? msg : `${msg}.` };
  } finally {
    estado.ocupado = false;
  }
}

// ---------------------------------------------------------------------------
//  Orden
// ---------------------------------------------------------------------------
function ordenar() {
  estado.ordenManual = false;
  const ids = ordenarParaIdealista(activas().map((f) => ({
    id: f.id, estancia: f.estancia, calidad: f.ia?.calidad,
    es_portada_candidata: f.ia?.es_portada_candidata, avisos: f.ia?.avisos,
  })));
  const pos = new Map(ids.map((id, i) => [id, i]));
  estado.fotos = [...activas().sort((a, b) => pos.get(a.id) - pos.get(b.id)), ...apartadas()];
  pintar();
}

/** Mueve la foto `id` a la posición de `destino` entre las activas. */
function mover(id, destinoIndice) {
  const lista = activas();
  const i = lista.findIndex((f) => f.id === id);
  if (i < 0 || destinoIndice < 0 || destinoIndice >= lista.length || i === destinoIndice) return;
  estado.ordenManual = true;
  const [f] = lista.splice(i, 1);
  lista.splice(destinoIndice, 0, f);
  estado.fotos = [...lista, ...apartadas()];
  pintar();
}

// ---------------------------------------------------------------------------
//  Salida
// ---------------------------------------------------------------------------
function archivosSalida() {
  const ns = nombres();
  return activas().map((f, i) => ({ nombre: ns[i], blob: f.blob }));
}

async function descargarZip() {
  const lista = archivosSalida();
  if (!lista.length) return;
  estado.ocupado = true; pintar();
  try {
    progreso("Preparando el ZIP…", 0.5);
    const archivos = [];
    for (const a of lista) archivos.push({ nombre: a.nombre, contenido: new Uint8Array(await a.blob.arrayBuffer()) });
    descargar(crearZip(archivos), nombreZip($("#referencia").value));
  } catch (e) {
    error(`No he podido crear el ZIP: ${e.message}`);
  } finally {
    progreso(null);
    estado.ocupado = false; pintar();
  }
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function unaAUna() {
  for (const a of archivosSalida()) { descargar(a.blob, a.nombre); await esperar(350); }
}

function puedeCompartir() {
  try {
    return !!navigator.canShare?.({ files: [new File([new Uint8Array(1)], "prueba.jpg", { type: "image/jpeg" })] });
  } catch { return false; }
}

async function compartir() {
  const files = archivosSalida().map((a) => new File([a.blob], a.nombre, { type: "image/jpeg" }));
  if (!navigator.canShare?.({ files })) { error("Este navegador no deja compartir tantas fotos juntas. Usa «Descargar ZIP»."); return; }
  try {
    await navigator.share({ files, title: "Fotos del inmueble" });
  } catch (e) {
    if (e.name !== "AbortError") error(`No se han podido compartir: ${e.message}`);
  }
}

function empezar() {
  if (estado.fotos.length && !confirm("¿Borrar estas fotos de la pantalla y empezar con otro piso?")) return;
  for (const f of estado.fotos) URL.revokeObjectURL(f.vistaUrl);
  estado.fotos = [];
  estado.ia = { estado: estado.ajustes.ia ? "" : "apagada", mensaje: "" };
  estado.ordenManual = false;
  $("#referencia").value = "";
  $("#errores").innerHTML = "";
  pintar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
//  Eventos
// ---------------------------------------------------------------------------
$("#archivos").addEventListener("change", (e) => { anadir(e.target.files); e.target.value = ""; });

const zona = $("#zona");
const sonArchivos = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
zona.addEventListener("dragover", (e) => { if (sonArchivos(e)) { e.preventDefault(); zona.classList.add("encima"); } });
zona.addEventListener("dragleave", () => zona.classList.remove("encima"));
zona.addEventListener("drop", (e) => {
  if (!sonArchivos(e)) return;
  e.preventDefault(); zona.classList.remove("encima");
  anadir(e.dataTransfer.files);
});
// Soltar fotos fuera de la zona no debe abrir la foto en la pestaña.
window.addEventListener("dragover", (e) => { if (sonArchivos(e)) e.preventDefault(); });
window.addEventListener("drop", (e) => { if (sonArchivos(e)) { e.preventDefault(); anadir(e.dataTransfer.files); } });

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-accion]");
  if (!b || b.tagName === "SELECT" || estado.ocupado && b.dataset.accion !== "descargar-una") return;
  const f = porId(b.dataset.id);
  if (!f) return;
  const i = activas().indexOf(f);
  switch (b.dataset.accion) {
    case "subir": mover(f.id, i - 1); enfocar(f.id, "subir"); break;
    case "bajar": mover(f.id, i + 1); enfocar(f.id, "bajar"); break;
    case "quitar": Object.assign(f, { descartada: true, motivo: "quitada", parecidaA: null }); pintar(); break;
    case "recuperar": Object.assign(f, { descartada: false, motivo: null, parecidaA: null, mantener: true }); pintar(); break;
    case "descargar-una": descargar(f.blob, nombres()[i]); break;
  }
});

/** Tras mover con el teclado, el foco sigue a la foto. */
function enfocar(id, accion) {
  const b = document.querySelector(`[data-accion="${accion}"][data-id="${id}"]`);
  (b && !b.disabled ? b : document.querySelector(`li.foto[data-id="${id}"] select`))?.focus();
}

document.addEventListener("change", (e) => {
  const s = e.target.closest('select[data-accion="estancia"]');
  if (!s) return;
  const f = porId(s.dataset.id);
  if (!f) return;
  f.estancia = s.value || null;
  f.estanciaManual = true;
  pintar();
  document.querySelector(`select[data-id="${f.id}"]`)?.focus();
});

// Arrastrar para reordenar (solo con ratón).
let arrastrando = null;
const lista = $("#lista");
lista.addEventListener("dragstart", (e) => {
  const li = e.target.closest("li.foto");
  if (!li) return;
  arrastrando = li.dataset.id;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", arrastrando);
  li.classList.add("arrastrando");
});
lista.addEventListener("dragover", (e) => { if (arrastrando) e.preventDefault(); });
lista.addEventListener("drop", (e) => {
  if (!arrastrando) return;
  e.preventDefault();
  e.stopPropagation();
  const li = e.target.closest("li.foto");
  if (li && li.dataset.id !== arrastrando) mover(arrastrando, activas().findIndex((f) => f.id === li.dataset.id));
  arrastrando = null;
});
lista.addEventListener("dragend", () => { arrastrando = null; pintar(); });

$("#ordenar").addEventListener("click", ordenar);
$("#reanalizar").addEventListener("click", async () => { await analizarIA(); ordenar(); });
$("#zip").addEventListener("click", descargarZip);
$("#una-a-una").addEventListener("click", unaAUna);
$("#compartir").addEventListener("click", compartir);
$("#empezar").addEventListener("click", empezar);

// Ajustes
const opRetoque = $("#op-retoque"), opIA = $("#op-ia"), clave = $("#clave");
opRetoque.checked = estado.ajustes.retoque;
opIA.checked = estado.ajustes.ia;
clave.value = estado.ajustes.clave;
opRetoque.addEventListener("change", () => { estado.ajustes.retoque = opRetoque.checked; guardarAjustes(); reprocesar(); });
opIA.addEventListener("change", () => {
  estado.ajustes.ia = opIA.checked; guardarAjustes();
  estado.ia = { estado: opIA.checked ? "" : "apagada", mensaje: "" };
  pintar();
});
clave.addEventListener("change", () => { estado.ajustes.clave = clave.value.trim(); guardarAjustes(); });

$("#tema").addEventListener("click", () => {
  const oscuroAhora = document.documentElement.dataset.tema
    ? document.documentElement.dataset.tema === "oscuro"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  estado.ajustes.tema = oscuroAhora ? "claro" : "oscuro";
  document.documentElement.dataset.tema = estado.ajustes.tema;
  guardarAjustes();
});

$("#compartir").classList.toggle("oculto", !puedeCompartir());
document.body.classList.toggle("con-raton", arrastrable);
pintar();

// Para las pruebas automáticas (no expone nada que no esté ya en pantalla).
window.__fotosIdealista = { estado };
