// ============================================================================
//  Fotos Fáciles — pantalla del ordenador
// ============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    headers: { "content-type": "application/json", ...(opciones.headers || {}) },
    ...opciones,
  });
  const texto = await res.text();
  let cuerpo = {};
  try { cuerpo = texto ? JSON.parse(texto) : {}; } catch { cuerpo = { error: texto }; }
  if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
  return cuerpo;
}

const enviar = (ruta, datos, metodo = "POST") =>
  api(ruta, { method: metodo, body: JSON.stringify(datos || {}) });

function tamanoLegible(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1).replace(".", ",")} ${u[i]}`;
}

const fechaCorta = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const APP = {
  estado: null,
  pestana: "movil",
  galeria: { archivos: [], total: 0, seleccion: new Set() },
  cable: { archivos: [], seleccion: new Set(), raiz: null },
  pegar: { origen: null, destino: null, seleccion: new Set(), portapapeles: [] },
  temporizador: null,
};

// --- Pestañas ---------------------------------------------------------------
function abrePestana(nombre) {
  APP.pestana = nombre;
  $$(".pestanas button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.panel === nombre)));
  $$(".panel").forEach((p) => { p.hidden = p.id !== `panel-${nombre}`; });
  if (nombre === "fotos") { cargaGaleria(true); cargaInmuebles(); }
  if (nombre === "compartir") cargaAlbumes();
  if (nombre === "pegar" && !APP.pegar.origen) {
    // Origen: la carpeta personal (donde el Explorador deja lo del móvil).
    // Destino: la carpeta de la app, que es lo que se quiere rellenar.
    abreCarpeta("origen", APP.estado?.casa || null);
    abreCarpeta("destino", APP.estado?.destino || null);
  }
}

// --- Estado general ---------------------------------------------------------
async function cargaEstado() {
  APP.estado = await api("/api/estado");
  const e = APP.estado;
  $("#subtitulo").textContent = `${e.resumenTexto} · guardando en ${e.destino}`;
  $("#qr").innerHTML = e.qr;
  $("#url-movil").textContent = `http://${e.red.ip}:${e.red.puerto}/m`;
  $("#pin").textContent = e.pin || "····";
  $("#destino-vivo").textContent = e.destino;
  $("#ips-detectadas").textContent = e.red.direcciones.map((d) => d.ip).join(", ") || "sin red";

  const otras = e.red.direcciones.slice(1);
  $("#btn-otra-ip").hidden = otras.length === 0;
  $("#aviso-red").textContent = e.red.direcciones.length
    ? `Red detectada: ${e.red.direcciones[0].interfaz}`
    : "⚠️ Este ordenador no está conectado a ninguna red WiFi o cable de red.";

  $("#cfg-destino").value = e.config.carpetaDestino;
  $("#cfg-organizar").value = e.config.organizarPor;
  $("#cfg-inmueble").value = e.config.inmueble || "";
  $("#cfg-renombrar").checked = !!e.config.renombrar;
  $("#cfg-pin").checked = !!e.config.pedirPin;
  $("#cfg-publica").value = e.config.urlPublica || "";
}

// --- Galería en vivo (modo WiFi) -------------------------------------------
let ultimoTotal = -1;
async function refrescaVivo() {
  if (APP.pestana !== "movil") return;
  try {
    const { archivos, total } = await api("/api/galeria?limite=18");
    $("#contador-vivo").textContent = `${total} archivos`;
    $("#vacio-vivo").hidden = archivos.length > 0;
    if (total !== ultimoTotal) {
      ultimoTotal = total;
      $("#galeria-vivo").innerHTML = archivos.map(tarjetaFoto).join("");
      conectaVisor("#galeria-vivo");
      const e = await api("/api/estado");
      $("#subtitulo").textContent = `${e.resumenTexto} · guardando en ${e.destino}`;
    }
  } catch { /* el servidor puede estar reiniciando */ }
}

function tarjetaFoto(f, seleccionable = false) {
  const url = `/api/miniatura?ruta=${encodeURIComponent(f.ruta)}`;
  return `<div class="miniatura" data-ruta="${encodeURIComponent(f.ruta)}" data-tipo="${f.tipo || "foto"}"
    ${seleccionable ? 'role="button" aria-pressed="false"' : ""} title="${f.nombre}">
    <img loading="lazy" src="${url}" alt="${f.nombre}" />
    <span class="tic">✓</span>
    <span class="marca">${f.tipo === "video" ? "🎬 " : ""}${tamanoLegible(f.tamano)}</span>
  </div>`;
}

// --- Visor ------------------------------------------------------------------
function conectaVisor(contenedor) {
  $$(`${contenedor} .miniatura`).forEach((el) => {
    if (el.getAttribute("role") === "button") return;
    el.onclick = () => {
      const ruta = decodeURIComponent(el.dataset.ruta);
      const url = `/api/archivo?ruta=${encodeURIComponent(ruta)}`;
      $("#visor-contenido").innerHTML = el.dataset.tipo === "video"
        ? `<video src="${url}" controls autoplay></video>`
        : `<img src="${url}" alt="" />`;
      $("#visor").hidden = false;
    };
  });
}
$("#btn-cerrar-visor").onclick = () => { $("#visor").hidden = true; $("#visor-contenido").innerHTML = ""; };
$("#visor").onclick = (e) => { if (e.target.id === "visor") $("#btn-cerrar-visor").click(); };

// --- Selección genérica -----------------------------------------------------
function conectaSeleccion(contenedor, conjunto, alCambiar = () => {}) {
  $$(`${contenedor} .miniatura[role="button"]`).forEach((el) => {
    const ruta = decodeURIComponent(el.dataset.ruta);
    el.setAttribute("aria-pressed", String(conjunto.has(ruta)));
    el.onclick = () => {
      if (conjunto.has(ruta)) conjunto.delete(ruta); else conjunto.add(ruta);
      el.setAttribute("aria-pressed", String(conjunto.has(ruta)));
      alCambiar();
    };
  });
}

// --- Modo A: dispositivos ---------------------------------------------------
$("#btn-buscar-dispositivos").onclick = async () => {
  $("#estado-dispositivos").textContent = "Buscando…";
  try {
    const { unidades, carpetas, aviso, portatiles = [] } = await api("/api/dispositivos");
    $("#aviso-iphone").innerHTML = aviso ? `<div class="aviso">${aviso}</div>` : "";
    const filas = [];
    for (const u of unidades) {
      filas.push(`<li><span class="nombre"><strong>${u.etiqueta}</strong> — <code class="url">${u.ruta}</code>
        ${u.extraible ? '<span class="etiqueta ok">extraíble</span>' : ""}</span>
        <button data-escanear="${encodeURIComponent(u.carpetasFoto?.[0]?.ruta || u.ruta)}">Ver fotos</button></li>`);
      for (const c of u.carpetasFoto || []) {
        filas.push(`<li style="padding-left:26px"><span class="nombre">↳ ${c.etiqueta}</span>
          <button data-escanear="${encodeURIComponent(c.ruta)}">Ver fotos</button></li>`);
      }
    }
    for (const d of portatiles) {
      filas.push(`<li><span class="nombre">📱 <strong>${d.nombre}</strong> — ${d.tipo}
        <span class="etiqueta dup">MTP · experimental</span></span>
        <button data-portatil="${encodeURIComponent(JSON.stringify(d.camino))}">Abrir</button></li>`);
    }
    for (const c of carpetas) {
      filas.push(`<li><span class="nombre">📁 ${c.etiqueta} — <code class="url">${c.ruta}</code></span>
        <button data-escanear="${encodeURIComponent(c.ruta)}">Ver fotos</button></li>`);
    }
    $("#lista-unidades").innerHTML = filas.join("") || '<li class="vacio">No se ha detectado ningún dispositivo.</li>';
    $("#estado-dispositivos").textContent = `${unidades.length} unidades detectadas`;
    $$("#lista-unidades button[data-escanear]").forEach((b) => {
      b.onclick = () => escanea(decodeURIComponent(b.dataset.escanear));
    });
    $$("#lista-unidades button[data-portatil]").forEach((b) => {
      b.onclick = () => abrePortatil(JSON.parse(decodeURIComponent(b.dataset.portatil)));
    });
  } catch (e) { $("#estado-dispositivos").textContent = e.message; }
};

async function escanea(ruta) {
  $("#estado-dispositivos").textContent = `Leyendo ${ruta}…`;
  const datos = await api(`/api/dispositivo/escanear?ruta=${encodeURIComponent(ruta)}`);
  APP.cable = { archivos: datos.archivos, seleccion: new Set(datos.archivos.filter((a) => a.nuevo).map((a) => a.ruta)), raiz: ruta };
  const nuevas = datos.archivos.filter((a) => a.nuevo).length;
  $("#tarjeta-escaneo").hidden = false;
  $("#titulo-escaneo").textContent = `${datos.archivos.length} archivos · ${nuevas} nuevos${datos.cortado ? " (mostrando los más recientes)" : ""}`;
  $("#galeria-cable").innerHTML = datos.archivos.map((a) => {
    const html = tarjetaFoto(a, true);
    return a.nuevo ? html : html.replace('class="miniatura"', 'class="miniatura" style="opacity:.4"');
  }).join("");
  conectaSeleccion("#galeria-cable", APP.cable.seleccion, pintaBotonImportar);
  pintaBotonImportar();
  $("#estado-dispositivos").textContent = "";
}

function pintaBotonImportar() {
  $("#btn-importar").textContent = `Importar seleccionadas (${APP.cable.seleccion.size})`;
  $("#btn-importar").disabled = APP.cable.seleccion.size === 0;
}
$("#btn-todas-nuevas").onclick = () => {
  APP.cable.seleccion = new Set(APP.cable.archivos.filter((a) => a.nuevo).map((a) => a.ruta));
  conectaSeleccion("#galeria-cable", APP.cable.seleccion, pintaBotonImportar);
  $$('#galeria-cable .miniatura').forEach((el) => el.setAttribute("aria-pressed", String(APP.cable.seleccion.has(decodeURIComponent(el.dataset.ruta)))));
  pintaBotonImportar();
};
$("#btn-ninguna-cable").onclick = () => {
  APP.cable.seleccion.clear();
  $$('#galeria-cable .miniatura').forEach((el) => el.setAttribute("aria-pressed", "false"));
  pintaBotonImportar();
};
$("#btn-importar").onclick = async () => {
  const { tarea } = await enviar("/api/dispositivo/importar", { archivos: [...APP.cable.seleccion] });
  sigueTarea(tarea, "Importando del dispositivo", () => escanea(APP.cable.raiz));
};

// --- Modo A (bis): iPhone/Android por cable, vía MTP -------------------------
APP.portatil = { camino: [], archivos: [], seleccion: new Set() };

async function abrePortatil(camino) {
  $("#tarjeta-portatil").hidden = false;
  $("#estado-dispositivos").textContent = "Leyendo el dispositivo… (puede tardar unos segundos)";
  try {
    const datos = await api(`/api/portatil/explorar?camino=${encodeURIComponent(JSON.stringify(camino))}`);
    APP.portatil = { camino, archivos: datos.archivos, seleccion: new Set() };

    $("#migas-portatil").innerHTML = camino.map((n, i) =>
      `<button data-nivel="${i + 1}">${n}</button>`).join(" › ") || "<span>Dispositivo</span>";
    $$("#migas-portatil button").forEach((b) => {
      b.onclick = () => abrePortatil(camino.slice(0, Number(b.dataset.nivel)));
    });

    $("#carpetas-portatil").innerHTML = datos.carpetas.map((c) =>
      `<li><span class="nombre">📁 ${c.nombre}</span>
       <button data-ir="${encodeURIComponent(JSON.stringify(c.camino))}">Abrir</button></li>`).join("")
      || (camino.length > 1 ? "" : '<li class="vacio">Sin subcarpetas</li>');
    $$("#carpetas-portatil button[data-ir]").forEach((b) => {
      b.onclick = () => abrePortatil(JSON.parse(decodeURIComponent(b.dataset.ir)));
    });

    pintaArchivosPortatil();
    $("#estado-dispositivos").textContent = "";
  } catch (e) {
    $("#estado-dispositivos").textContent = `No se ha podido leer el dispositivo: ${e.message}. Prueba con el modo WiFi (QR).`;
  }
}

function pintaArchivosPortatil() {
  const { archivos, seleccion } = APP.portatil;
  $("#archivos-portatil").innerHTML = archivos.length
    ? archivos.slice(0, 500).map((a) => `<li>
        <input type="checkbox" data-nombre="${encodeURIComponent(a.nombre)}" ${seleccion.has(a.nombre) ? "checked" : ""} />
        <span class="nombre">${a.tipo === "video" ? "🎬" : "🖼️"} ${a.nombre}</span>
        ${a.tamano ? `<span class="etiqueta">${tamanoLegible(a.tamano)}</span>` : ""}
        <span class="etiqueta ${a.nuevo ? "ok" : "dup"}">${a.nuevo ? "nueva" : "ya la tienes"}</span></li>`).join("")
    : '<li class="vacio">Esta carpeta no tiene fotos. Entra en DCIM.</li>';
  $$("#archivos-portatil input[type=checkbox]").forEach((c) => {
    c.onchange = () => {
      const n = decodeURIComponent(c.dataset.nombre);
      if (c.checked) seleccion.add(n); else seleccion.delete(n);
      $("#btn-importar-portatil").textContent = `Importar seleccionadas (${seleccion.size})`;
    };
  });
  $("#btn-importar-portatil").textContent = `Importar seleccionadas (${seleccion.size})`;
}

$("#btn-todas-portatil").onclick = () => {
  APP.portatil.seleccion = new Set(APP.portatil.archivos.filter((a) => a.nuevo).map((a) => a.nombre));
  pintaArchivosPortatil();
};
$("#btn-importar-portatil").onclick = async () => {
  const nombres = [...APP.portatil.seleccion];
  if (!nombres.length) return;
  const { tarea } = await enviar("/api/portatil/importar", { camino: APP.portatil.camino, nombres });
  sigueTarea(tarea, "Copiando del dispositivo (MTP es lento, ten paciencia)", () => abrePortatil(APP.portatil.camino));
};

// --- Modo C: explorador dual ------------------------------------------------
async function abreCarpeta(lado, ruta) {
  const datos = await api(`/api/explorar${ruta ? `?ruta=${encodeURIComponent(ruta)}` : ""}`);
  APP.pegar[lado] = datos;
  const migas = $(`#migas-${lado}`);
  migas.innerHTML = `${datos.padre ? `<button data-sube="${encodeURIComponent(datos.padre)}">⬆ Subir</button>` : ""}
    <span style="align-self:center">${datos.ruta}</span>`;
  if (datos.padre) migas.querySelector("[data-sube]").onclick = () => abreCarpeta(lado, decodeURIComponent(migas.querySelector("[data-sube]").dataset.sube));

  $(`#carpetas-${lado}`).innerHTML = datos.carpetas.slice(0, 60)
    .map((c) => `<li><span class="nombre">📁 ${c.nombre}</span><button data-ir="${encodeURIComponent(c.ruta)}">Abrir</button></li>`).join("")
    || '<li class="vacio">Sin subcarpetas</li>';
  $$(`#carpetas-${lado} button[data-ir]`).forEach((b) => { b.onclick = () => abreCarpeta(lado, decodeURIComponent(b.dataset.ir)); });

  const seleccionable = lado === "origen";
  $(`#galeria-${lado}`).innerHTML = datos.archivos.slice(0, 120).map((a) => tarjetaFoto(a, seleccionable)).join("");
  if (seleccionable) {
    APP.pegar.seleccion = new Set();
    conectaSeleccion("#galeria-origen", APP.pegar.seleccion, pintaPortapapeles);
  } else conectaVisor("#galeria-destino");
  pintaPortapapeles();
}

function pintaPortapapeles() {
  const n = APP.pegar.portapapeles.length;
  $("#portapapeles-info").textContent = n
    ? `${n} archivos copiados, listos para pegar`
    : `${APP.pegar.seleccion.size} seleccionados`;
  $("#btn-pegar").disabled = n === 0;
}
$("#btn-copiar-sel").onclick = () => {
  APP.pegar.portapapeles = [...APP.pegar.seleccion];
  pintaPortapapeles();
};
$("#btn-pegar").onclick = async () => {
  const destino = APP.pegar.destino?.ruta;
  if (!destino || !APP.pegar.portapapeles.length) return;
  const { tarea } = await enviar("/api/copiar", { archivos: APP.pegar.portapapeles, destino });
  sigueTarea(tarea, "Pegando archivos", () => abreCarpeta("destino", destino));
};
$("#btn-nueva-carpeta").onclick = async () => {
  const nombre = prompt("Nombre de la carpeta nueva:");
  if (!nombre) return;
  const { ruta } = await enviar("/api/carpeta", { padre: APP.pegar.destino?.ruta, nombre });
  abreCarpeta("destino", ruta);
};
document.addEventListener("keydown", (e) => {
  if (APP.pestana !== "pegar" || !(e.ctrlKey || e.metaKey)) return;
  if (e.key === "c") { e.preventDefault(); $("#btn-copiar-sel").click(); }
  if (e.key === "v") { e.preventDefault(); $("#btn-pegar").click(); }
});

// --- Galería completa -------------------------------------------------------
async function cargaGaleria(reinicia = false) {
  if (reinicia) { APP.galeria.archivos = []; APP.galeria.seleccion.clear(); }
  const datos = await api(`/api/galeria?desde=${APP.galeria.archivos.length}&limite=60`);
  APP.galeria.archivos.push(...datos.archivos);
  APP.galeria.total = datos.total;
  $("#galeria-todo").innerHTML = APP.galeria.archivos.map((a) => tarjetaFoto(a, true)).join("");
  conectaSeleccion("#galeria-todo", APP.galeria.seleccion, pintaBotonEnlace);
  $("#vacio-galeria").hidden = APP.galeria.archivos.length > 0;
  $("#btn-mas").hidden = APP.galeria.archivos.length >= datos.total;
  pintaBotonEnlace();
  const { historial } = await api("/api/historial");
  $("#lista-historial").innerHTML = historial.map((h) => `<li>
    <span class="nombre">${{ movil: "📶 Móvil (WiFi)", cable: "🔌 Cable/USB", pegar: "📋 Pegado", mover: "📋 Movido", enlace: "🔗 Enlace", escaparate: "🏠 Escaparate 3D", limpiafotos: "🪄 LimpiaFotos" }[h.tipo] || h.tipo}
      ${h.nombre ? ` — ${h.nombre}` : ""}</span>
    <span class="etiqueta ok">${h.fotos || 0} archivos</span>
    ${h.duplicados ? `<span class="etiqueta dup">${h.duplicados} repetidos</span>` : ""}
    ${h.bytes ? `<span class="etiqueta">${tamanoLegible(h.bytes)}</span>` : ""}
    <span class="etiqueta">${fechaCorta(h.cuando)}</span></li>`).join("")
    || '<li class="vacio">Todavía no hay transferencias.</li>';
}
function pintaBotonEnlace() {
  $("#btn-enlace").textContent = `🔗 Generar enlace (${APP.galeria.seleccion.size})`;
  $("#btn-enlace").disabled = APP.galeria.seleccion.size === 0;
}
$("#btn-mas").onclick = () => cargaGaleria();
$("#btn-ninguna-galeria").onclick = () => {
  APP.galeria.seleccion.clear();
  $$('#galeria-todo .miniatura').forEach((el) => el.setAttribute("aria-pressed", "false"));
  pintaBotonEnlace();
};
$("#btn-enlace").onclick = async () => {
  const nombre = prompt("Nombre del enlace (lo verá el cliente):", "Fotos del inmueble") || "Fotos";
  const dias = Number(prompt("¿Cuántos días quieres que funcione?", "7")) || 7;
  const album = await enviar("/api/albumes", { nombre, dias, archivos: [...APP.galeria.seleccion] });
  await navigator.clipboard.writeText(album.publico || album.local).catch(() => {});
  alert(`Enlace creado y copiado al portapapeles:\n\n${album.publico || album.local}\n\nCaduca en ${dias} días.`);
  abrePestana("compartir");
};

// --- Puentes con el ecosistema ----------------------------------------------
let CARTERA = { inmuebles: [], hay: false };

async function cargaInmuebles() {
  try {
    CARTERA = await api("/api/inmuebles");
  } catch { CARTERA = { inmuebles: [], hay: false }; }

  const sel = $("#sel-inmueble");
  sel.innerHTML = '<option value="">— Escribir a mano —</option>' +
    CARTERA.inmuebles.map((p, i) => `<option value="${i}">${p.etiqueta}${p.zona ? ` · ${p.zona}` : ""}</option>`).join("");
  sel.onchange = () => {
    const p = CARTERA.inmuebles[Number(sel.value)];
    if (!p) return;
    $("#eco-referencia").value = p.referencia || "";
    $("#eco-titulo").value = p.titulo || "";
  };

  // Si ya había un inmueble elegido, se vuelve a marcar tras recargar la lista.
  const refActual = $("#eco-referencia").value.trim().toLowerCase();
  if (refActual) {
    const i = CARTERA.inmuebles.findIndex((p) => (p.referencia || "").toLowerCase() === refActual);
    if (i >= 0) sel.value = String(i);
  }

  $("#lista-inmuebles").innerHTML = CARTERA.inmuebles.map((p) => `<option value="${p.carpeta}"></option>`).join("");
  $("#cfg-cartera").textContent = CARTERA.hay
    ? (CARTERA.inmuebles.length
      ? `${CARTERA.inmuebles.length} inmuebles leídos de tu escaparate 3D.`
      : "Tu escaparate 3D todavía no tiene inmuebles: ejecuta sincronizar.mjs o escribe el nombre a mano.")
    : "Fotos Fáciles no está dentro del repositorio, así que no puede leer tu cartera.";

  const hayRepo = !!APP.estado?.repo;
  $("#btn-escaparate").disabled = !hayRepo;
  $("#btn-escaparate").title = hayRepo ? "" : "Solo disponible si Fotos Fáciles está dentro del repositorio";
}

/**
 * Reduce una foto a 1600 px de lado con el propio navegador. Así el escaparate
 * recibe fotos del peso recomendado sin instalar ninguna librería de imagen.
 */
function reduceFoto(url, lado = 1600, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
      lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
      const ctx = lienzo.getContext("2d");
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error("no se ha podido convertir"))), "image/jpeg", calidad);
    };
    img.onerror = () => reject(new Error("el navegador no puede abrir esta foto (¿es HEIC?)"));
    img.src = url;
  });
}

$("#btn-escaparate").onclick = async () => {
  const elegidas = [...APP.galeria.seleccion];
  const referencia = $("#eco-referencia").value.trim();
  const titulo = $("#eco-titulo").value.trim();
  if (!elegidas.length) return avisoEco("Selecciona antes las fotos que quieres publicar.", "error");
  if (!referencia && !titulo) return avisoEco("Elige un inmueble de la lista o escribe su referencia.", "error");

  const boton = $("#btn-escaparate");
  boton.disabled = true;
  const relativas = [];
  const fallos = [];
  try {
    for (const [i, ruta] of elegidas.entries()) {
      avisoEco(`Preparando foto ${i + 1} de ${elegidas.length}…`);
      try {
        const reducida = await reduceFoto(`/api/archivo?ruta=${encodeURIComponent(ruta)}`);
        const destino = `/api/escaparate/foto?referencia=${encodeURIComponent(referencia)}&titulo=${encodeURIComponent(titulo)}&ext=.jpg`;
        const res = await fetch(destino, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: reducida });
        const cuerpo = await res.json();
        if (!res.ok) throw new Error(cuerpo.error || `error ${res.status}`);
        relativas.push(cuerpo.relativa);
      } catch (e) {
        fallos.push(`${ruta.split(/[\\/]/).pop()}: ${e.message}`);
      }
    }
    if (!relativas.length) throw new Error(fallos[0] || "No se ha podido preparar ninguna foto");
    const r = await enviar("/api/escaparate/publicar", { referencia, titulo, relativas });
    avisoEco(`✅ ${relativas.length} fotos publicadas en «${r.titulo}»${r.nueva ? " (inmueble nuevo en pisos.json)" : ""}. ` +
      `La portada del escaparate pasa a ser la primera.${fallos.length ? ` ${fallos.length} no se pudieron convertir.` : ""}`, "ok");
    cargaInmuebles();
  } catch (e) {
    avisoEco(`❌ ${e.message}`, "error");
  } finally { boton.disabled = false; }
};

$("#btn-limpiafotos").onclick = async () => {
  const elegidas = [...APP.galeria.seleccion];
  if (!elegidas.length) return avisoEco("Selecciona antes las fotos.", "error");
  try {
    const etiqueta = $("#eco-referencia").value.trim() || $("#eco-titulo").value.trim() || "fotos";
    const r = await enviar("/api/limpiafotos", { archivos: elegidas, etiqueta });
    avisoEco(`✅ ${r.copiadas} fotos copiadas a ${r.carpeta}. Se ha abierto la carpeta: arrástralas a LimpiaFotos.`, "ok");
  } catch (e) { avisoEco(`❌ ${e.message}`, "error"); }
};

$("#btn-abrir-carpeta").onclick = () => enviar("/api/abrir-carpeta", { ruta: APP.estado?.destino }).catch(() => {});

function avisoEco(texto, tipo = "") {
  const el = $("#eco-estado");
  el.textContent = texto;
  el.style.color = tipo === "error" ? "var(--rojo)" : tipo === "ok" ? "var(--verde)" : "var(--suave)";
}

// --- Compartir --------------------------------------------------------------
async function cargaAlbumes() {
  const { albumes, hayTunel } = await api("/api/albumes");
  $("#aviso-tunel").innerHTML = hayTunel ? "" :
    `<div class="aviso">Ahora mismo los enlaces solo funcionan dentro de tu red local. Para poder mandárselos
     a un cliente por WhatsApp desde fuera, configura un dominio propio en Ajustes.</div>`;
  $("#vacio-albumes").hidden = albumes.length > 0;
  $("#lista-albumes").innerHTML = albumes.map((a) => `<li>
    <span class="nombre"><strong>${a.nombre}</strong> — ${a.cuantos} archivos · ${a.visitas} visitas ·
      caduca el ${new Date(a.caduca).toLocaleDateString("es-ES")}<br />
      <code class="url">${a.publico || a.local}</code></span>
    <button data-copiar="${a.publico || a.local}">Copiar enlace</button>
    <button class="peligro" data-borrar="${a.id}">Borrar</button></li>`).join("");
  $$("#lista-albumes button[data-copiar]").forEach((b) => {
    b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = "¡Copiado!"; };
  });
  $$("#lista-albumes button[data-borrar]").forEach((b) => {
    b.onclick = async () => { await api(`/api/albumes/${b.dataset.borrar}`, { method: "DELETE" }); cargaAlbumes(); };
  });
}

// --- Ajustes ----------------------------------------------------------------
$("#btn-guardar-config").onclick = async () => {
  $("#estado-config").textContent = "Guardando…";
  try {
    await enviar("/api/config", {
      carpetaDestino: $("#cfg-destino").value.trim(),
      organizarPor: $("#cfg-organizar").value,
      inmueble: $("#cfg-inmueble").value.trim(),
      renombrar: $("#cfg-renombrar").checked,
      pedirPin: $("#cfg-pin").checked,
      urlPublica: $("#cfg-publica").value.trim(),
    });
    await cargaEstado();
    $("#estado-config").textContent = "✅ Guardado";
  } catch (e) { $("#estado-config").textContent = `❌ ${e.message}`; }
};

// --- Tareas con progreso ----------------------------------------------------
let tareaActiva = null;
function sigueTarea(id, titulo, alTerminar) {
  tareaActiva = id;
  $("#progreso").hidden = false;
  $("#progreso-titulo").textContent = titulo;
  const tic = setInterval(async () => {
    try {
      const t = await api(`/api/tarea/${id}`);
      const pct = t.total ? Math.round((t.hechos / t.total) * 100) : 0;
      $("#progreso-barra").style.width = `${pct}%`;
      $("#progreso-detalle").textContent =
        `${t.hechos} de ${t.total} · ${t.copiados} copiados, ${t.duplicados} repetidos${t.fallidos ? `, ${t.fallidos} con error` : ""}`;
      if (t.estado !== "en curso") {
        clearInterval(tic);
        setTimeout(() => { $("#progreso").hidden = true; }, 2200);
        $("#progreso-titulo").textContent = t.estado === "cancelada" ? "Cancelado" : "Terminado ✅";
        await cargaEstado();
        alTerminar?.();
      }
    } catch { clearInterval(tic); $("#progreso").hidden = true; }
  }, 500);
}
$("#btn-cancelar-tarea").onclick = () => { if (tareaActiva) enviar(`/api/tarea/${tareaActiva}/cancelar`, {}); };

// --- Varios -----------------------------------------------------------------
$("#btn-copiar-url").onclick = async () => {
  await navigator.clipboard.writeText(APP.estado.urlMovil);
  $("#btn-copiar-url").textContent = "¡Copiada!";
  setTimeout(() => { $("#btn-copiar-url").textContent = "Copiar dirección"; }, 1800);
};
$("#btn-otra-ip").onclick = async () => {
  const otras = APP.estado.red.direcciones;
  const elegida = prompt(`Direcciones detectadas:\n${otras.map((d, i) => `${i + 1}. ${d.ip} (${d.interfaz})`).join("\n")}\n\nEscribe el número:`);
  const d = otras[Number(elegida) - 1];
  if (!d) return;
  const url = `http://${d.ip}:${APP.estado.red.puerto}/m#t=${encodeURIComponent(APP.estado.token)}`;
  $("#url-movil").textContent = `http://${d.ip}:${APP.estado.red.puerto}/m`;
  APP.estado.urlMovil = url;
  alert("Recuerda: el QR sigue mostrando la red principal. Copia la dirección y escríbela en el móvil.");
};
$("#btn-apagar").onclick = async () => {
  if (!confirm("¿Cerrar Fotos Fáciles? Los enlaces compartidos dejarán de funcionar.")) return;
  await enviar("/api/apagar", {});
  document.body.innerHTML = '<div class="envoltorio"><div class="tarjeta"><h2>Programa cerrado</h2><p class="ayuda">Ya puedes cerrar esta pestaña. Tus fotos siguen en su carpeta.</p></div></div>';
};
$$(".pestanas button").forEach((b) => { b.onclick = () => abrePestana(b.dataset.panel); });

// --- Arranque ---------------------------------------------------------------
cargaEstado().then(() => {
  abrePestana("movil");
  refrescaVivo();
  APP.temporizador = setInterval(refrescaVivo, 2500);
}).catch((e) => {
  document.body.innerHTML = `<div class="envoltorio"><div class="tarjeta"><h2>No se puede conectar</h2>
    <p class="ayuda">${e.message}. Comprueba que el programa sigue abierto en la ventana negra.</p></div></div>`;
});
