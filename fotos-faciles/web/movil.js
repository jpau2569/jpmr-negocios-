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
    const estado = await api("/api/estado");
    $("#error-pin").innerHTML = "";
    $("#sub").textContent = `Conectado a ${estado.destino.split(/[\\/]/).pop() || "tu ordenador"}`;
    $("#destino-info").textContent = `Se guardarán en: ${estado.destino}`;
    if (estado.config.organizarPor === "inmueble") {
      $("#campo-inmueble").hidden = false;
      $("#inmueble").value = estado.config.inmueble || "";
    }
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
      const fin = await enviar(`/api/subida/${trabajo.id}/cerrar`, { inmueble: $("#inmueble")?.value || "" });
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
