// ============================================================================
//  Escaparate 3D Pro — piezas de interfaz comunes (overlay HTML)
// ----------------------------------------------------------------------------
//  Todo lo importante para vender vive en HTML sobre el canvas, nunca dentro
//  del 3D: los botones de teléfono, WhatsApp, redes y acciones tienen que ser
//  pulsables, accesibles y visibles aunque el WebGL no arranque.
// ============================================================================

export const $ = (id) => document.getElementById(id);

// Se comprueba aquí, y no en escena.js, para que el orquestador pueda saber si
// hay 3D SIN cargar Three.js: escena.js trae la librería del CDN y, si no hay
// red, un import estático dejaría la página entera en blanco.
export function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function crear(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === "clase") nodo.className = valor;
    else if (clave === "texto") nodo.textContent = valor;
    else if (clave === "html") nodo.innerHTML = valor;
    else if (clave.startsWith("on") && typeof valor === "function") nodo.addEventListener(clave.slice(2), valor);
    else if (clave === "datos") for (const [k, v] of Object.entries(valor)) nodo.dataset[k] = v;
    else nodo.setAttribute(clave, valor === true ? "" : String(valor));
  }
  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo);
  }
  return nodo;
}

export const vaciar = (nodo) => { while (nodo?.firstChild) nodo.firstChild.remove(); return nodo; };

/* --- Formatos ------------------------------------------------------------- */

export function euros(valor, { decimales = 0 } = {}) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "";
  return Number(valor).toLocaleString("es-ES", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  });
}

export function fechaLarga(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

export const hoyISO = () => new Date().toISOString().slice(0, 10);

export function sumaDias(iso, dias) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/* --- Enlaces de contacto (los tres botones que cierran ventas) ------------- */

export const hayWhatsapp = (cfg) => Boolean(cfg?.contacto?.whatsapp);

export function enlaceWhatsapp(cfg, texto) {
  if (!hayWhatsapp(cfg)) return "";
  return `https://wa.me/${cfg.contacto.whatsapp}?text=${encodeURIComponent(texto)}`;
}

export function enlaceCorreo(cfg, asunto, cuerpo) {
  if (!cfg?.contacto?.email) return "";
  return `mailto:${cfg.contacto.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export function enlaceMapa(cfg) {
  const { mapaLat, mapaLng, direccion } = cfg?.contacto || {};
  if (typeof mapaLat === "number" && typeof mapaLng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${mapaLat},${mapaLng}`;
  }
  if (direccion) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
  return "";
}

/* --- Iconos (trazos propios, sencillos y reconocibles) -------------------- */

const ICONOS = {
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14.5 8.5h2.2V5.4h-2.4c-2.4 0-3.8 1.5-3.8 3.9v1.6H8.3v3.1h2.2V21h3.3v-7h2.3l.4-3.1h-2.7V9.6c0-.8.3-1.1 1-1.1z"/>',
  tiktok: '<path d="M15 4c.6 2.2 2 3.4 4 3.6v3c-1.5.1-2.9-.3-4-1.1v5.9c0 3.1-2.4 5.6-5.4 5.6S4.2 18.5 4.2 15.4 6.6 9.8 9.6 9.8c.3 0 .6 0 .9.1v3.2a2.5 2.5 0 1 0 1.7 2.3V4z"/>',
  googleBusiness: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3c1.8-1.6 2.8-4 2.8-7z"/><path d="M12 21c2.5 0 4.6-.8 6.2-2.3l-3-2.4c-.8.6-1.9.9-3.2.9-2.5 0-4.6-1.6-5.3-3.9H3.5v2.4A9 9 0 0 0 12 21z"/><path d="M6.7 13.3a5.4 5.4 0 0 1 0-3.4V7.5H3.5a9 9 0 0 0 0 8.1z"/><path d="M12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9 9 0 0 0 3.5 7.5l3.2 2.4C7.4 8.2 9.5 6.6 12 6.6z"/>',
  telefono: '<path d="M6 3h3l2 5-2.2 1.4a12 12 0 0 0 5.8 5.8L16 13l5 2v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4 6.2 2 2 0 0 1 6 4z"/>',
  whatsapp: '<path d="M20 11.6a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.6z"/><path d="M9 9.2c.3-.7.6-.7.9-.7h.6c.2 0 .5 0 .7.5l.7 1.7c.1.3 0 .5-.1.7l-.4.5c-.1.2-.3.3-.1.6a6 6 0 0 0 2.8 2.4c.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5v.7c0 .4-.4.9-1 1a7 7 0 0 1-3.6-.8 9.4 9.4 0 0 1-4.2-4.3c-.5-1-.5-2 .1-2.7z"/>',
  mapa: '<path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
};

export function icono(nombre, tam = 20) {
  const svg = ICONOS[nombre] || ICONOS.web;
  return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg>`;
}

const NOMBRE_RED = {
  web: "Web oficial", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", googleBusiness: "Google",
};

// Botones REALES de redes: si el cliente no tiene un perfil, el botón no existe.
export function botonesRedes(cfg, { clase = "boton-red" } = {}) {
  return Object.entries(cfg.redes || {})
    .filter(([, url]) => Boolean(url))
    .map(([red, url]) => crear("a", {
      clase,
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      title: NOMBRE_RED[red] || red,
      "aria-label": NOMBRE_RED[red] || red,
      html: `${icono(red)}<span>${NOMBRE_RED[red] || red}</span>`,
    }));
}

/* --- Modal y avisos -------------------------------------------------------- */

let cerrarPendiente = null;

export function abrirModal(titulo, contenido, { alCerrar } = {}) {
  const capa = $("modal");
  const caja = $("modal-caja");
  $("modal-titulo").textContent = titulo;
  vaciar($("modal-cuerpo")).append(contenido);
  capa.hidden = false;
  document.body.classList.add("sin-scroll");
  cerrarPendiente = alCerrar || null;
  caja.scrollTop = 0;
  $("modal-cerrar").focus();
}

export function cerrarModal() {
  const capa = $("modal");
  if (!capa || capa.hidden) return;
  capa.hidden = true;
  document.body.classList.remove("sin-scroll");
  vaciar($("modal-cuerpo"));
  if (cerrarPendiente) { const f = cerrarPendiente; cerrarPendiente = null; f(); }
}

let temporizadorAviso = null;
export function aviso(texto, { error = false, ms = 4200 } = {}) {
  const caja = $("aviso");
  if (!caja) return;
  caja.textContent = texto;
  caja.classList.toggle("es-error", Boolean(error));
  caja.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.hidden = true; }, ms);
}

/* --- Formularios ---------------------------------------------------------- */

export function campo({ id, etiqueta, tipo = "text", requerido = false, ...resto }) {
  const entrada = tipo === "textarea"
    ? crear("textarea", { id, name: id, rows: 3, required: requerido, ...resto })
    : tipo === "select"
      ? crear("select", { id, name: id, required: requerido }, (resto.opciones || []).map((o) =>
          crear("option", { value: o.valor ?? o }, [document.createTextNode(o.texto ?? o)])))
      : crear("input", { id, name: id, type: tipo, required: requerido, ...resto });
  return crear("label", { clase: "campo", for: id }, [
    crear("span", { texto: etiqueta + (requerido ? " *" : "") }),
    entrada,
  ]);
}

export function valores(formulario) {
  return Object.fromEntries([...new FormData(formulario).entries()].map(([k, v]) => [k, String(v).trim()]));
}

// Mensaje listo para pegar en WhatsApp o correo, con los datos del negocio.
export function bloqueEnvio(cfg, { asunto, mensaje, alCopiar = () => {} }) {
  const wasap = enlaceWhatsapp(cfg, mensaje);
  const correo = enlaceCorreo(cfg, asunto, mensaje);
  const botones = [];
  if (wasap) botones.push(crear("a", { clase: "boton principal", href: wasap, target: "_blank", rel: "noopener", html: `${icono("whatsapp")}<span>Enviar por WhatsApp</span>` }));
  if (correo) botones.push(crear("a", { clase: "boton", href: correo, html: "Enviar por correo" }));
  if (cfg.contacto.telefono) {
    botones.push(crear("a", { clase: botones.length ? "boton" : "boton principal", href: "tel:" + cfg.contacto.telefono, html: `${icono("telefono")}<span>Llamar ${cfg.contacto.telefonoTexto}</span>` }));
  }
  botones.push(crear("button", {
    clase: "boton plano", type: "button", texto: "Copiar el mensaje",
    onclick: async () => {
      try { await navigator.clipboard.writeText(mensaje); aviso("Mensaje copiado."); alCopiar(); }
      catch { aviso("Tu navegador no deja copiar automáticamente: selecciona el texto de abajo.", { error: true }); }
    },
  }));
  return crear("div", { clase: "bloque-envio" }, [
    crear("div", { clase: "botonera" }, botones),
    crear("details", {}, [crear("summary", { texto: "Ver el mensaje" }), crear("pre", { clase: "mensaje", texto: mensaje })]),
  ]);
}
