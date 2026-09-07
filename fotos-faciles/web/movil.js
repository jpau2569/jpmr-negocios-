// ============================================================================
//  Fotos Fáciles — pantalla del móvil (Modo B: sin cables)
// ----------------------------------------------------------------------------
//  Sube archivo a archivo con reanudación: si se corta la WiFi, al reintentar
//  se pregunta al PC cuántos bytes tiene y se sigue desde ahí. Antes de subir
//  nada se comprueba qué archivos ya están en el ordenador, para no repetir.
// ============================================================================
const $ = (s) => document.querySelector(s);
const A_LA_VEZ = 3;                       // subidas simultáneas

let token = "";
let parar = false;
let ESTADO = null;
let CARTERA = [];
// Cómo quiere el usuario que se guarden: por día, por inmueble, o en una
// carpeta concreta del PC que elige navegando desde el propio móvil.
const DESTINO = { modo: "fecha", carpeta: null };

// --- Token: viene en el QR (#t=…) o del PIN ---------------------------------
function recuperaToken() {
  const enHash = /[#&]t=([^&]+)/.exec(location.hash || "");
  if (enHash) {
    token = decodeURIComponent(enHash[1]);
    sessionStorage.setItem("fotosToken", token);
    history.replaceState(null, "", location.pathname);   // no dejarlo en la barra
    return true;
  }
  token = sessionStorage.getItem("fotosToken") || "";
  return !!token;
}

const cabeceras = (extra = {}) => ({ "x-fotos-token": token, ...extra });

async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, { ...opciones, headers: cabeceras(opciones.headers || {}) });
  const texto = await res.text();
  let cuerpo = {};
  try { cuerpo = texto ? JSON.parse(texto) : {}; } catch { cuerpo = { error: texto }; }
  if (!res.ok) throw Object.assign(new Error(cuerpo.error || `Error ${res.status}`), { estado: res.status, cuerpo });
  return cuerpo;
}
const enviar = (ruta, datos) => api(ruta, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(datos || {}),
});

function tamanoLegible(b) {
  b = Number(b) || 0;
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB"];
  let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1).replace(".", ",")} ${u[i]}`;
}

// --- Pantalla del PIN -------------------------------------------------------
let pinEscrito = "";
function pintaPin() {
  [...$("#huecos").children].forEach((i, n) => i.classList.toggle("lleno", n < pinEscrito.length));
}
function montaTeclado() {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];
  $("#teclado").innerHTML = teclas.map((t) => (t ? `<button data-tecla="${t}">${t}</button>` : "<span></span>")).join("");
  $("#teclado").querySelectorAll("button").forEach((b) => {
    b.onclick = async () => {
      const t = b.dataset.tecla;
      if (t === "←") pinEscrito = pinEscrito.slice(0, -1);
      else if (pinEscrito.length < 4) pinEscrito += t;
      pintaPin();
      if (pinEscrito.length === 4) {
        try {
          const r = await enviar("/api/entrar", { pin: pinEscrito });
          token = r.token;
          sessionStorage.setItem("fotosToken", token);
          arrancaSubida();
        } catch (e) {
          $("#error-pin").innerHTML = `<div class="aviso error">${e.message}</div>`;
          pinEscrito = ""; pintaPin();
        }
      }
    };
  });
}

// --- Pantalla de subida -----------------------------------------------------
async function arrancaSubida() {
  $("#paso-pin").hidden = true;
  $("#paso-subir").hidden = false;
  try {
    ESTADO = await api("/api/estado");
    $("#error-pin").innerHTML = "";
    $("#sub").textContent = `Conectado a ${ESTADO.destino.split(/[\\/]/).pop() || "tu ordenador"}`;
    DESTINO.modo = ESTADO.config.organizarPor === "inmueble" ? "inmueble" : "fecha";
    document.querySelector(`input[name="destino"][value="${DESTINO.modo}"]`).checked = true;
    $("#inmueble").value = ESTADO.config.inmueble || "";
    $("#ejemplo-fecha").textContent = `${ESTADO.destino} / ${new Date().toISOString().slice(0, 10)}`;
    await cargaCartera();
    pintaDestino();
  } catch (e) {
    // Si el ordenador se ha reiniciado, el token viejo ya no vale: pedimos el PIN.
    if (e.estado === 401) {
      sessionStorage.removeItem("fotosToken");
      token = "";
      $("#paso-subir").hidden = true;
      $("#paso-pin").hidden = false;
      $("#error-pin").innerHTML = '<div class="aviso">El programa se ha reiniciado. Vuelve a escanear el QR o escribe el PIN nuevo.</div>';
      montaTeclado(); pintaPin();
    }
  }
}

// --- ¿Dónde se guardan? -----------------------------------------------------
async function cargaCartera() {
  try {
    const datos = await api("/api/inmuebles");
    CARTERA = datos.inmuebles || [];
  } catch { CARTERA = []; }
  const opciones = '<option value="">— Escribir a mano —</option>' +
    CARTERA.map((p, i) => `<option value="${i}">${p.etiqueta}</option>`).join("");
  for (const id of ["#sel-inmueble-movil", "#sel-escaparate"]) $(id).innerHTML = opciones;

  $("#sel-inmueble-movil").onchange = () => {
    const p = CARTERA[Number($("#sel-inmueble-movil").value)];
    if (p) $("#inmueble").value = p.carpeta;
  };
  $("#sel-escaparate").onchange = () => {
    const p = CARTERA[Number($("#sel-escaparate").value)];
    if (p) $("#eco-referencia-movil").value = p.referencia || p.titulo || "";
  };
}

function pintaDestino() {
  $("#bloque-inmueble").hidden = DESTINO.modo !== "inmueble";
  $("#bloque-carpeta").hidden = DESTINO.modo !== "carpeta";
  $("#carpeta-elegida").textContent = DESTINO.carpeta || "(sin elegir)";
  const texto = DESTINO.modo === "carpeta"
    ? (DESTINO.carpeta ? `Se guardarán en: ${DESTINO.carpeta}` : "Elige una carpeta del ordenador.")
    : DESTINO.modo === "inmueble"
      ? `Se guardarán en: ${ESTADO?.destino} / ${$("#inmueble").value || "(inmueble)"} / fecha`
      : `Se guardarán en: ${ESTADO?.destino} / ${new Date().toISOString().slice(0, 10)}`;
  $("#destino-info").textContent = texto;
}

document.querySelectorAll('input[name="destino"]').forEach((r) => {
  r.onchange = () => {
    DESTINO.modo = r.value;
    pintaDestino();
    if (r.value === "carpeta" && !DESTINO.carpeta) abreExplorador(ESTADO?.destino);
  };
});
$("#inmueble").oninput = pintaDestino;

// --- Explorador de las carpetas del PC, manejado desde el móvil -------------
let carpetaVista = null;

async function abreExplorador(ruta) {
  $("#explorador").hidden = false;
  try {
    const datos = await api(`/api/explorar${ruta ? `?ruta=${encodeURIComponent(ruta)}` : ""}`);
    carpetaVista = datos;
    $("#ruta-actual").textContent = datos.ruta;
    $("#btn-subir-carpeta").disabled = !datos.padre;
    $("#lista-carpetas").innerHTML = datos.carpetas.length
      ? datos.carpetas.slice(0, 200).map((c) =>
        `<li><span class="nombre">📁 ${c.nombre}</span>
         <button data-ir="${encodeURIComponent(c.ruta)}">Abrir</button></li>`).join("")
      : '<li class="vacio">Aquí no hay más carpetas. Pulsa «Guardar aquí».</li>';
    $("#lista-carpetas").querySelectorAll("button[data-ir]").forEach((b) => {
      b.onclick = () => abreExplorador(decodeURIComponent(b.dataset.ir));
    });
  } catch (e) {
    $("#lista-carpetas").innerHTML = `<li class="vacio">${e.message}</li>`;
  }
}

$("#btn-elegir-carpeta").onclick = () => abreExplorador(DESTINO.carpeta || ESTADO?.destino);
$("#btn-subir-carpeta").onclick = () => carpetaVista?.padre && abreExplorador(carpetaVista.padre);
$("#btn-usar-carpeta").onclick = () => {
  DESTINO.carpeta = carpetaVista?.ruta || null;
  DESTINO.modo = "carpeta";
  document.querySelector('input[name="destino"][value="carpeta"]').checked = true;
  $("#explorador").hidden = true;
  pintaDestino();
};
$("#btn-nueva-carpeta-movil").onclick = async () => {
  const nombre = prompt("Nombre de la carpeta nueva:");
  if (!nombre) return;
  try {
    const { ruta } = await enviar("/api/carpeta", { padre: carpetaVista?.ruta, nombre });
    abreExplorador(ruta);
  } catch (e) { alert(e.message); }
};

$("#btn-elegir").onclick = () => $("#selector").click();
$("#selector").onchange = (e) => procesa([...e.target.files]);

const zona = $("#zona");
["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("encima"); }));
["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("encima"); }));
zona.addEventListener("drop", (e) => procesa([...(e.dataTransfer?.files || [])]));

// --- El motor de subida -----------------------------------------------------
let pendientes = [];

async function procesa(archivos) {
  if (!archivos.length) return;
  parar = false;
  $("#tarjeta-progreso").hidden = false;
  $("#btn-reintentar").hidden = true;
  $("#titulo-progreso").textContent = "Comprobando qué falta…";

  // 1) Preguntar al PC qué tiene ya: evita resubir el mismo álbum dos veces.
  let conocidos = [];
  try {
    const r = await enviar("/api/ya-tengo", {
      archivos: archivos.map((f) => ({ nombre: f.name, tamano: f.size })),
    });
    conocidos = r.conocidos || [];
  } catch { conocidos = []; }

  pendientes = archivos.map((archivo, i) => ({
    archivo, estado: conocidos[i] ? "duplicado" : "esperando", subido: 0, intentos: 0,
  }));

  pintaLista();
  const total = pendientes.filter((p) => p.estado === "esperando").length;
  if (!total) {
    $("#titulo-progreso").textContent = "Ya lo tenías todo ✅";
    $("#detalle-progreso").textContent = `${archivos.length} archivos ya estaban en el ordenador.`;
    $("#barra").style.width = "100%";
    return;
  }
  $("#titulo-progreso").textContent = "Enviando al ordenador…";

  const cola = pendientes.filter((p) => p.estado === "esperando");
  const obreros = Array.from({ length: Math.min(A_LA_VEZ, cola.length) }, async () => {
    while (cola.length && !parar) {
      const trabajo = cola.shift();
      await sube(trabajo);
      pintaProgreso();
    }
  });
  await Promise.all(obreros);

  const bien = pendientes.filter((p) => p.estado === "hecho").length;
  const repes = pendientes.filter((p) => p.estado === "duplicado").length;
  const mal = pendientes.filter((p) => p.estado === "error").length;
  $("#titulo-progreso").textContent = parar ? "Parado" : (mal ? "Terminado con avisos" : "¡Listo! ✅");
  $("#detalle-progreso").textContent =
    `${bien} enviados${repes ? `, ${repes} ya estaban` : ""}${mal ? `, ${mal} con error` : ""}.`;
  $("#btn-reintentar").hidden = mal === 0;

  ofreceEscaparate();

  const bytes = pendientes.filter((p) => p.estado === "hecho").reduce((s, p) => s + p.archivo.size, 0);
  const videos = pendientes.filter((p) => p.estado === "hecho" && /video/i.test(p.archivo.type)).length;
  enviar("/api/subida/resumen", { fotos: bien - videos, videos, bytes, duplicados: repes }).catch(() => {});
}

async function sube(trabajo) {
  const { archivo } = trabajo;
  for (let intento = 0; intento < 3 && !parar; intento++) {
    trabajo.intentos = intento + 1;
    try {
      const apertura = await enviar("/api/subida/abrir", {
        nombre: archivo.name, tamano: archivo.size, fechaMod: archivo.lastModified,
        sesion: sesionId(),
      });
      trabajo.id = apertura.id;
      trabajo.subido = apertura.recibido;
      trabajo.estado = "enviando";
      pintaLista();

      if (apertura.recibido < archivo.size) {
        await subeTrozo(trabajo, apertura.recibido);
      }
      const fin = await enviar(`/api/subida/${trabajo.id}/cerrar`, {
        organizarPor: DESTINO.modo === "carpeta" ? undefined : DESTINO.modo,
        inmueble: $("#inmueble")?.value || "",
        carpeta: DESTINO.modo === "carpeta" ? DESTINO.carpeta : undefined,
      });
      trabajo.estado = fin.estado === "duplicado" ? "duplicado" : "hecho";
      trabajo.nombreFinal = fin.nombre;
      pintaLista();
      return;
    } catch (e) {
      trabajo.error = e.message;
      if (intento === 2 || parar) { trabajo.estado = "error"; pintaLista(); return; }
      await new Promise((r) => setTimeout(r, 800 * (intento + 1)));   // espera y reintenta
    }
  }
}

/** Sube el resto del archivo con XHR (es el único que da progreso real de subida). */
function subeTrozo(trabajo, desde) {
  return new Promise((resolve, reject) => {
    const { archivo } = trabajo;
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/subida/${trabajo.id}?desde=${desde}`);
    xhr.setRequestHeader("x-fotos-token", token);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      trabajo.subido = desde + ev.loaded;
      pintaProgreso();
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { trabajo.subido = archivo.size; resolve(); }
      else {
        let msg = `Error ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* texto plano */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Se ha cortado la conexión"));
    xhr.onabort = () => reject(new Error("Cancelado"));
    trabajo.xhr = xhr;
    xhr.send(desde > 0 ? archivo.slice(desde) : archivo);
  });
}

function sesionId() {
  let id = sessionStorage.getItem("fotosSesion");
  if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("fotosSesion", id); }
  return id;
}

function pintaProgreso() {
  const total = pendientes.reduce((s, p) => s + (p.estado === "duplicado" ? 0 : p.archivo.size), 0) || 1;
  const hecho = pendientes.reduce((s, p) => s + (p.estado === "hecho" ? p.archivo.size : p.subido || 0), 0);
  $("#barra").style.width = `${Math.min(100, Math.round((hecho / total) * 100))}%`;
  const hechos = pendientes.filter((p) => p.estado === "hecho" || p.estado === "duplicado").length;
  $("#detalle-progreso").textContent = `${hechos} de ${pendientes.length} · ${tamanoLegible(hecho)} de ${tamanoLegible(total)}`;
}

const ETIQUETAS = {
  esperando: '<span class="etiqueta">en cola</span>',
  enviando: '<span class="etiqueta">enviando…</span>',
  hecho: '<span class="etiqueta ok">✔ enviada</span>',
  duplicado: '<span class="etiqueta dup">ya estaba</span>',
  error: '<span class="etiqueta err">error</span>',
};

function pintaLista() {
  $("#lista-archivos").innerHTML = pendientes.slice(0, 300).map((p) => `<li>
    <span class="nombre">${p.archivo.name}</span>
    <span class="etiqueta">${tamanoLegible(p.archivo.size)}</span>
    ${ETIQUETAS[p.estado] || ""}
  </li>`).join("");
}

// --- Publicar en el escaparate 3D sin tocar el ordenador --------------------
function publicables() {
  return pendientes.filter((p) => p.estado === "hecho" && /\.(jpe?g|png|webp)$/i.test(p.archivo.name));
}

function ofreceEscaparate() {
  const hay = publicables().length;
  $("#tarjeta-escaparate").hidden = !(hay && ESTADO?.repo);
  if (!hay || !ESTADO?.repo) return;
  if (!$("#eco-referencia-movil").value) {
    const elegido = CARTERA[Number($("#sel-inmueble-movil").value)];
    $("#eco-referencia-movil").value = elegido?.referencia || "";
  }
  $("#btn-publicar-movil").textContent = `🏠 Publicar ${hay} fotos en el escaparate`;
}

/** Reduce la foto en el propio móvil, antes de mandarla. */
function reduceEnElMovil(archivo, lado = 1600, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
      lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
      lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error("no se pudo convertir"))), "image/jpeg", calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("este formato no se puede publicar")); };
    img.src = url;
  });
}

$("#btn-publicar-movil").onclick = async () => {
  const referencia = $("#eco-referencia-movil").value.trim();
  if (!referencia) return avisaEscaparate("Elige el inmueble o escribe su referencia.", "error");
  const lista = publicables();
  const boton = $("#btn-publicar-movil");
  boton.disabled = true;
  const relativas = [];
  let fallos = 0;
  try {
    for (const [i, p] of lista.entries()) {
      avisaEscaparate(`Preparando ${i + 1} de ${lista.length}…`);
      try {
        const reducida = await reduceEnElMovil(p.archivo);
        const res = await fetch(`/api/escaparate/foto?referencia=${encodeURIComponent(referencia)}&ext=.jpg`, {
          method: "PUT", headers: cabeceras({ "content-type": "image/jpeg" }), body: reducida,
        });
        const cuerpo = await res.json();
        if (!res.ok) throw new Error(cuerpo.error || `error ${res.status}`);
        relativas.push(cuerpo.relativa);
      } catch { fallos++; }
    }
    if (!relativas.length) throw new Error("No se ha podido preparar ninguna foto");
    const r = await enviar("/api/escaparate/publicar", { referencia, relativas });
    avisaEscaparate(`✅ ${relativas.length} fotos ya están en el escaparate de «${r.titulo}»` +
      `${r.nueva ? " (inmueble nuevo)" : ""}${fallos ? `. ${fallos} no se pudieron convertir.` : "."}`, "ok");
  } catch (e) {
    avisaEscaparate(`❌ ${e.message}`, "error");
  } finally { boton.disabled = false; }
};

function avisaEscaparate(texto, tipo = "") {
  $("#aviso-escaparate").innerHTML = `<div class="aviso ${tipo}">${texto}</div>`;
}

$("#btn-parar").onclick = () => {
  parar = true;
  pendientes.forEach((p) => p.xhr?.abort());
  $("#titulo-progreso").textContent = "Parado";
};
$("#btn-reintentar").onclick = () => {
  const fallidos = pendientes.filter((p) => p.estado === "error").map((p) => p.archivo);
  if (fallidos.length) procesa(fallidos);
};

// --- Arranque ---------------------------------------------------------------
if (recuperaToken()) {
  arrancaSubida();
} else {
  $("#paso-pin").hidden = false;
  montaTeclado();
  pintaPin();
}
