// ============================================================================
//  Plantillas HTML — lógica pura (reciben datos, devuelven texto)
// ----------------------------------------------------------------------------
//  Regla: TODO lo que viene de fuera (cliente, base de datos, variables) pasa
//  por esc() antes de pintarse. No hay estilos ni scripts en línea: la CSP lo
//  prohíbe; todo está en /static/estilos.css y /static/app.js.
// ============================================================================
import { OPERACIONES, TIPOS, LIMITES, textoDe, telefonoBonito, esMovil } from "./validacion.js";
import { etiquetaLarga, enMadrid } from "./horario.js";
import { enlaceWhatsapp, enlaceTelefono, textoWhatsappValoracion, textoWhatsappVisita } from "./mensajes.js";

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

export const TURNSTILE_JS = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// ---- Esqueleto ----------------------------------------------------------------
export function pagina({ titulo, cuerpo, turnstile = false, privada = false, descripcion = "" }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · Asesoría Castresana</title>
${descripcion ? `<meta name="description" content="${esc(descripcion)}">` : ""}
${privada ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta name="theme-color" content="#10203a">
<link rel="icon" href="/static/logo-castresana.jpg">
<link rel="stylesheet" href="/static/estilos.css">
<script src="/static/app.js" defer></script>
${turnstile ? `<script src="${TURNSTILE_JS}" async defer></script>` : ""}
</head>
<body${privada ? ' class="es-panel"' : ""}>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera">
  <a class="marca" href="${privada ? "/panel" : "/"}"><img src="/static/logo-castresana.jpg" alt="Asesoría Castresana" width="500" height="201"></a>
</header>
<main id="contenido" class="contenido">
${cuerpo}
</main>
<footer class="pie">
  <p>Asesoría Castresana · Oviedo</p>
  <p><a href="/valora">Valora tu piso</a> · <a href="/visitas">Reservar visita</a> · <a href="/privacidad">Privacidad</a></p>
</footer>
</body>
</html>`;
}

// ---- Piezas de formulario --------------------------------------------------
const descr = (id, error, ayuda) => {
  const ids = [ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return ids ? ` aria-describedby="${ids}"` : "";
};
const pieCampo = (id, error, ayuda) =>
  `${ayuda ? `<p class="ayuda" id="${id}-ayuda">${esc(ayuda)}</p>` : ""}${error ? `<p class="error-campo" id="${id}-error">${esc(error)}</p>` : ""}`;
const etiquetaDe = (texto, obligatorio) => `${esc(texto)}${obligatorio ? "" : ' <span class="opcional">(opcional)</span>'}`;

export function campoTexto({ id, etiqueta, valor = "", error = "", ayuda = "", tipo = "text", obligatorio = true, max, extra = "" }) {
  return `<div class="campo${error ? " con-error" : ""}">
  <label for="${id}">${etiquetaDe(etiqueta, obligatorio)}</label>
  <input id="${id}" name="${id}" type="${tipo}" value="${esc(valor)}"${max ? ` maxlength="${max}"` : ""}${obligatorio ? " required" : ""}${error ? ' aria-invalid="true"' : ""}${descr(id, error, ayuda)} ${extra}>
  ${pieCampo(id, error, ayuda)}
</div>`;
}

export function campoArea({ id, etiqueta, valor = "", error = "", ayuda = "", max, obligatorio = false, filas = 4 }) {
  return `<div class="campo${error ? " con-error" : ""}">
  <label for="${id}">${etiquetaDe(etiqueta, obligatorio)}</label>
  <textarea id="${id}" name="${id}" rows="${filas}"${max ? ` maxlength="${max}"` : ""}${obligatorio ? " required" : ""}${error ? ' aria-invalid="true"' : ""}${descr(id, error, ayuda)}>${esc(valor)}</textarea>
  ${pieCampo(id, error, ayuda)}
</div>`;
}

export function campoSelect({ id, etiqueta, opciones, valor = "", error = "", ayuda = "", obligatorio = true, vacia = "Elige…", extra = "" }) {
  const ops = opciones.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(valor) ? " selected" : ""}>${esc(o.texto)}</option>`).join("");
  return `<div class="campo${error ? " con-error" : ""}">
  <label for="${id}">${etiquetaDe(etiqueta, obligatorio)}</label>
  <select id="${id}" name="${id}"${obligatorio ? " required" : ""}${error ? ' aria-invalid="true"' : ""}${descr(id, error, ayuda)} ${extra}>
    <option value="">${esc(vacia)}</option>${ops}
  </select>
  ${pieCampo(id, error, ayuda)}
</div>`;
}

function campoRadios({ id, leyenda, opciones, valor = "", error = "", clase = "" }) {
  const ops = opciones.map((o, i) => `<label class="opcion">
    <input type="radio" name="${id}" value="${esc(o.id)}"${String(o.id) === String(valor) ? " checked" : ""}${i === 0 ? " required" : ""}${i === 0 ? ` id="${id}"` : ""}>
    <span>${esc(o.texto)}</span>
  </label>`).join("");
  return `<fieldset class="campo radios ${clase}${error ? " con-error" : ""}"${error ? ` aria-describedby="${id}-error"` : ""}>
  <legend>${esc(leyenda)}</legend>
  <div class="opciones">${ops}</div>
  ${error ? `<p class="error-campo" id="${id}-error">${esc(error)}</p>` : ""}
</fieldset>`;
}

function casillaPrivacidad({ error = "", marcada = false, para = "esta solicitud" }) {
  return `<div class="campo casilla${error ? " con-error" : ""}">
  <input type="checkbox" id="privacidad" name="privacidad" value="on" required${marcada ? " checked" : ""}${error ? ' aria-invalid="true" aria-describedby="privacidad-error"' : ""}>
  <label for="privacidad">He leído la <a href="/privacidad" target="_blank" rel="noopener">información de privacidad</a> y acepto que Asesoría Castresana use estos datos para contactarme sobre ${esc(para)}.</label>
  ${error ? `<p class="error-campo" id="privacidad-error">${esc(error)}</p>` : ""}
</div>`;
}

// Campo trampa para robots: invisible para personas (y para lectores de pantalla).
const trampa = `<div class="trampa" aria-hidden="true"><label for="web">No rellenes este campo</label><input id="web" name="web" type="text" tabindex="-1" autocomplete="off"></div>`;

const turnstileWidget = (sitekey) => (sitekey ? `<div class="cf-turnstile" data-sitekey="${esc(sitekey)}" data-language="es"></div>` : "");

function resumenErrores(errores, orden) {
  const claves = orden.filter((k) => errores[k]);
  const extra = Object.keys(errores).filter((k) => !orden.includes(k));
  const todas = [...claves, ...extra];
  if (!todas.length) return "";
  return `<div class="aviso error" role="alert" tabindex="-1" id="resumen-errores">
  <p><strong>Revisa ${todas.length === 1 ? "este dato" : "estos datos"}:</strong></p>
  <ul>${todas.map((k) => `<li><a href="#${esc(k)}">${esc(errores[k])}</a></li>`).join("")}</ul>
</div>`;
}

// ---- Privacidad (BORRADOR) ---------------------------------------------------
export function bloquePrivacidad() {
  return `<section class="privacidad" aria-labelledby="titulo-privacidad">
  <h2 id="titulo-privacidad">Información básica de privacidad <span class="borrador">BORRADOR</span></h2>
  <p class="nota-borrador">Texto provisional pendiente de revisión por un profesional. No es todavía el texto legal definitivo.</p>
  <dl>
    <dt>Responsable</dt><dd>Asesoría Castresana. [PENDIENTE: CIF y dirección]</dd>
    <dt>Para qué</dt><dd>Atender tu solicitud (valoración de tu inmueble o visita) y ponernos en contacto contigo por teléfono o WhatsApp sobre ella.</dd>
    <dt>Base legal</dt><dd>Tu consentimiento al marcar la casilla.</dd>
    <dt>Quién más los ve</dt><dd>Nadie fuera de la asesoría salvo obligación legal. Los datos se guardan en los servidores de Cloudflare y los avisos internos pueden pasar por Telegram. [PENDIENTE: revisar proveedores y transferencias internacionales]</dd>
    <dt>Cuánto tiempo</dt><dd>[PENDIENTE: plazo de conservación]</dd>
    <dt>Tus derechos</dt><dd>Acceder, rectificar o borrar tus datos, oponerte y limitar su uso escribiendo a [PENDIENTE: correo o dirección para ejercer los derechos]. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</dd>
  </dl>
</section>`;
}

export function paginaPrivacidad() {
  return pagina({
    titulo: "Privacidad",
    cuerpo: `<h1>Privacidad</h1>${bloquePrivacidad()}<p><a class="boton secundario" href="/valora">Volver</a></p>`,
  });
}

// ---- Portada -------------------------------------------------------------------
export function paginaInicio() {
  return pagina({
    titulo: "Bienvenido",
    descripcion: "Asesoría Castresana: valora tu piso o reserva una visita.",
    cuerpo: `<h1>¿En qué te ayudamos?</h1>
<div class="tarjetas-inicio">
  <a class="tarjeta-enlace" href="/valora"><strong>Valora tu piso</strong><span>Déjanos los datos y Pau te llama para valorarlo.</span></a>
  <a class="tarjeta-enlace" href="/visitas"><strong>Reservar una visita</strong><span>Elige inmueble, día y hora libre.</span></a>
</div>`,
  });
}

// ---- «Valora tu piso» --------------------------------------------------------
const ORDEN_VALORA = ["nombre", "telefono", "correo", "operacion", "tipo", "zona", "metros", "habitaciones", "comentario", "privacidad", "turnstile", "general"];

export function paginaValora({ valores = {}, errores = {}, sitekey = "" } = {}) {
  const v = valores;
  const e = errores;
  return pagina({
    titulo: "Valora tu piso",
    turnstile: Boolean(sitekey),
    descripcion: "Déjanos los datos de tu inmueble y Pau, de Asesoría Castresana, te llamará para valorarlo.",
    cuerpo: `<h1>Valora tu piso</h1>
<p class="entradilla">Déjanos los datos de tu inmueble y <strong>Pau te llamará para valorarlo</strong>. No damos precios automáticos: cada casa es distinta y la valoración la hace una persona.</p>
${resumenErrores(e, ORDEN_VALORA)}
<form method="post" action="/valora" class="formulario" novalidate>
  ${trampa}
  ${campoTexto({ id: "nombre", etiqueta: "Nombre", valor: v.nombre, error: e.nombre, max: LIMITES.nombre, extra: 'autocomplete="name"' })}
  ${campoTexto({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: v.telefono, error: e.telefono, max: LIMITES.telefono, ayuda: "Te llamaremos a este número.", extra: 'autocomplete="tel" inputmode="tel"' })}
  ${campoTexto({ id: "correo", etiqueta: "Correo electrónico", tipo: "email", valor: v.correo, error: e.correo, max: LIMITES.correo, obligatorio: false, extra: 'autocomplete="email"' })}
  ${campoRadios({ id: "operacion", leyenda: "¿Qué quieres hacer?", opciones: OPERACIONES, valor: v.operacion, error: e.operacion, clase: "en-linea" })}
  ${campoSelect({ id: "tipo", etiqueta: "Tipo de inmueble", opciones: TIPOS, valor: v.tipo, error: e.tipo })}
  ${campoTexto({ id: "zona", etiqueta: "Zona o dirección aproximada", valor: v.zona, error: e.zona, max: LIMITES.zona, ayuda: "Por ejemplo: «Calle Uría, Oviedo» o «La Florida». No hace falta el número exacto." })}
  <div class="dos-columnas">
    ${campoTexto({ id: "metros", etiqueta: "Metros cuadrados", valor: v.metros, error: e.metros, obligatorio: false, max: 6, extra: 'inputmode="numeric" pattern="[0-9]*"' })}
    ${campoTexto({ id: "habitaciones", etiqueta: "Habitaciones", valor: v.habitaciones, error: e.habitaciones, obligatorio: false, max: 2, extra: 'inputmode="numeric" pattern="[0-9]*"' })}
  </div>
  ${campoArea({ id: "comentario", etiqueta: "Comentario", valor: v.comentario, error: e.comentario, max: LIMITES.comentario, ayuda: "Lo que quieras contarnos: estado, reformas, cuándo te viene bien que te llamemos…" })}
  ${casillaPrivacidad({ error: e.privacidad, marcada: v.privacidad === "on", para: "esta solicitud de valoración" })}
  ${turnstileWidget(sitekey)}
  ${e.turnstile ? `<p class="error-campo" id="turnstile">${esc(e.turnstile)}</p>` : ""}
  <button type="submit" class="boton">Enviar mis datos</button>
</form>
${bloquePrivacidad()}`,
  });
}

export function paginaValoraGracias({ nombre, telefono }) {
  return pagina({
    titulo: "¡Recibido!",
    cuerpo: `<div class="aviso ok" role="status">
  <h1>¡Gracias, ${esc(String(nombre).split(" ")[0])}!</h1>
  <p>Hemos recibido los datos de tu inmueble. <strong>Pau te llamará al ${esc(telefonoBonito(telefono))}</strong> para valorarlo.</p>
  <p>No te enviaremos mensajes automáticos.</p>
</div>
<p><a class="boton secundario" href="/">Volver al inicio</a></p>`,
  });
}

// ---- Reservas de visitas -------------------------------------------------------
const ORDEN_VISITA = ["referencia", "fecha", "fecha_hora", "nombre", "telefono", "comentario", "privacidad", "turnstile", "general"];

const textoInmueble = (i) => [i.referencia, i.titulo, i.zona].filter(Boolean).join(" · ");

/**
 * inmuebles: activos; dias: [{fecha, etiqueta, libres}]; huecos: [{hora, fechaHora}] del día elegido.
 * seleccion: { referencia, fecha }.
 */
export function paginaVisitas({ inmuebles = [], dias = [], huecos = null, seleccion = {}, valores = {}, errores = {}, sitekey = "", telefonoContacto = "", aviso = "" } = {}) {
  const e = errores;
  const ref = seleccion.referencia || "";
  const inmueble = inmuebles.find((i) => i.referencia.toLowerCase() === ref.toLowerCase());
  const contacto = telefonoContacto
    ? `<p>Si no encuentras hueco, ${esMovil(telefonoContacto) ? `<a href="${esc(enlaceWhatsapp(telefonoContacto, "Hola, quería concertar una visita."))}" rel="noopener">escríbenos por WhatsApp</a> o ` : ""}llámanos al <a href="${esc(enlaceTelefono(telefonoContacto))}">${esc(telefonoBonito(telefonoContacto))}</a>.</p>`
    : "";

  if (!inmuebles.length) {
    return pagina({
      titulo: "Reservar visita",
      cuerpo: `<h1>Reservar una visita</h1><div class="aviso">Ahora mismo no hay inmuebles con visitas abiertas.</div>${contacto}`,
    });
  }

  const paso1 = `<form method="get" action="/visitas" class="formulario" id="elegir-dia">
  ${campoSelect({ id: "ref", etiqueta: "Inmueble", opciones: inmuebles.map((i) => ({ id: i.referencia, texto: textoInmueble(i) })), valor: inmueble?.referencia || "", error: e.referencia, vacia: "Elige el inmueble…", extra: "data-autoenvio" })}
  ${dias.length
    ? campoSelect({ id: "fecha", etiqueta: "Día", opciones: dias.map((d) => ({ id: d.fecha, texto: `${d.etiqueta} (${d.libres} ${d.libres === 1 ? "hora libre" : "horas libres"})` })), valor: seleccion.fecha || "", error: e.fecha, vacia: "Elige el día…", extra: "data-autoenvio" })
    : `<div class="aviso">No quedan horas libres en los próximos días.</div>`}
  <button type="submit" class="boton secundario">Ver horas libres</button>
</form>`;

  let paso2 = "";
  if (inmueble && seleccion.fecha && huecos) {
    paso2 = huecos.length
      ? `<form method="post" action="/visitas" class="formulario" id="reservar" novalidate>
  ${trampa}
  <input type="hidden" name="referencia" value="${esc(inmueble.referencia)}">
  <input type="hidden" name="fecha" value="${esc(seleccion.fecha)}">
  <h2>${esc(etiquetaLarga(seleccion.fecha))}</h2>
  ${inmueble.enlace ? `<p><a href="${esc(inmueble.enlace)}" target="_blank" rel="noopener">Ver la ficha de ${esc(inmueble.referencia)}</a></p>` : ""}
  ${campoRadios({ id: "fecha_hora", leyenda: "Elige la hora", opciones: huecos.map((h) => ({ id: h.fechaHora, texto: h.hora })), valor: valores.fecha_hora, error: e.fecha_hora, clase: "huecos" })}
  ${campoTexto({ id: "nombre", etiqueta: "Nombre", valor: valores.nombre, error: e.nombre, max: LIMITES.nombre, extra: 'autocomplete="name"' })}
  ${campoTexto({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: valores.telefono, error: e.telefono, max: LIMITES.telefono, ayuda: "Para confirmarte la visita.", extra: 'autocomplete="tel" inputmode="tel"' })}
  ${campoArea({ id: "comentario", etiqueta: "Comentario", valor: valores.comentario, error: e.comentario, max: 500, filas: 3 })}
  ${casillaPrivacidad({ error: e.privacidad, marcada: valores.privacidad === "on", para: "esta visita" })}
  ${turnstileWidget(sitekey)}
  ${e.turnstile ? `<p class="error-campo" id="turnstile">${esc(e.turnstile)}</p>` : ""}
  <button type="submit" class="boton">Reservar visita</button>
</form>`
      : `<div class="aviso">Ese día ya no quedan horas libres. Elige otro.</div>`;
  }

  return pagina({
    titulo: "Reservar visita",
    turnstile: Boolean(sitekey && paso2.includes("<form")),
    descripcion: "Reserva una visita a un inmueble de Asesoría Castresana: elige día y hora libre.",
    cuerpo: `<h1>Reservar una visita</h1>
<p class="entradilla">Elige el inmueble y el día, y luego una hora libre. Las visitas son de ${esc(seleccion.bloque || 30)} minutos.</p>
${aviso ? `<div class="aviso error" role="alert">${esc(aviso)}</div>` : ""}
${resumenErrores(e, ORDEN_VISITA)}
${paso1}
${paso2}
${contacto}
${paso2.includes("<form") ? bloquePrivacidad() : ""}`,
  });
}

export function paginaVisitaReservada({ referencia, fechaHora, nombre }) {
  const [fecha, hora] = fechaHora.split("T");
  return pagina({
    titulo: "Visita reservada",
    cuerpo: `<div class="aviso ok" role="status">
  <h1>Visita reservada</h1>
  <p>${esc(String(nombre).split(" ")[0])}, te esperamos el <strong>${esc(etiquetaLarga(fecha))} a las ${esc(hora)}</strong> para ver el inmueble <strong>${esc(referencia)}</strong>.</p>
  <p>Pau se pondrá en contacto contigo para confirmarla. Si no puedes ir, avísanos.</p>
</div>
<p><a class="boton secundario" href="/visitas">Reservar otra visita</a></p>`,
  });
}

// ---- Errores genéricos ---------------------------------------------------------
export function paginaMensaje({ titulo, texto, enlace = "/", textoEnlace = "Volver", privada = false }) {
  return pagina({
    titulo, privada,
    cuerpo: `<h1>${esc(titulo)}</h1><div class="aviso">${esc(texto)}</div><p><a class="boton secundario" href="${esc(enlace)}">${esc(textoEnlace)}</a></p>`,
  });
}

// ---- Panel ------------------------------------------------------------------------
export function paginaEntrar({ error = "" } = {}) {
  return pagina({
    titulo: "Panel privado", privada: true,
    cuerpo: `<h1>Panel privado</h1>
${error ? `<div class="aviso error" role="alert">${esc(error)}</div>` : ""}
<form method="post" action="/panel/entrar" class="formulario">
  ${campoTexto({ id: "clave", etiqueta: "Clave", tipo: "password", extra: 'autocomplete="current-password" autofocus' })}
  <button type="submit" class="boton">Entrar</button>
</form>`,
  });
}

const PESTANAS = [
  { id: "valoraciones", texto: "Valoraciones" },
  { id: "visitas", texto: "Visitas" },
  { id: "bloqueos", texto: "Bloqueos" },
  { id: "inmuebles", texto: "Inmuebles" },
];

export const MENSAJES_PANEL = {
  cancelada: "Visita cancelada. El hueco vuelve a estar libre.",
  "ya-cancelada": "Esa visita ya estaba cancelada.",
  bloqueado: "Bloqueo guardado.",
  "bloqueo-repetido": "Ese bloqueo ya existía.",
  "bloqueo-con-visita": "Bloqueo guardado. Ojo: ya hay una visita en ese hueco; cancélala si no vas a poder.",
  desbloqueado: "Bloqueo quitado.",
  cargados: "Lista de inmuebles guardada.",
  activado: "Inmueble activado: ya se puede reservar.",
  desactivado: "Inmueble desactivado: ya no sale en las reservas.",
  borrado: "Inmueble borrado de la lista (sus visitas siguen en el historial).",
};

function cabeceraPanel(activa, { avisos = [], mensaje = "", errores = [] }) {
  const nav = PESTANAS.map((p) => `<a href="/panel?vista=${p.id}"${p.id === activa ? ' aria-current="page" class="activa"' : ""}>${esc(p.texto)}</a>`).join("");
  return `<div class="barra-panel">
  <nav class="pestanas" aria-label="Secciones del panel">${nav}</nav>
  <form method="post" action="/panel/salir"><button type="submit" class="boton pequeno secundario">Salir</button></form>
</div>
${avisos.length ? `<div class="aviso" role="status"><p><strong>Configuración:</strong></p><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
${mensaje ? `<div class="aviso ok" role="status">${esc(mensaje)}</div>` : ""}
${errores.length ? `<div class="aviso error" role="alert"><ul>${errores.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}`;
}

const fechaMadrid = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const m = enMadrid(t);
  const [y, mo, d] = m.fecha.split("-");
  return `${d}/${mo}/${y} ${m.hora}`;
};

function enlacesContacto(telefono, textoWa) {
  const wa = enlaceWhatsapp(telefono, textoWa);
  return `<a class="boton pequeno" href="${esc(enlaceTelefono(telefono))}">Llamar ${esc(telefonoBonito(telefono))}</a>${wa ? ` <a class="boton pequeno whatsapp" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}`;
}

export function panelValoraciones({ valoraciones, total, ...extra }) {
  const lista = valoraciones.length
    ? valoraciones.map((v) => `<article class="ficha">
  <header><h2>${esc(v.nombre)}</h2><p class="fecha">${esc(fechaMadrid(v.creada))}</p></header>
  <p><strong>${esc(textoDe(OPERACIONES, v.operacion))}</strong> · ${esc(textoDe(TIPOS, v.tipo))} · ${esc(v.zona)}${v.metros ? ` · ${esc(v.metros)} m²` : ""}${v.habitaciones !== null && v.habitaciones !== undefined ? ` · ${esc(v.habitaciones)} hab.` : ""}</p>
  ${v.correo ? `<p>Correo: <a href="mailto:${esc(v.correo)}">${esc(v.correo)}</a></p>` : ""}
  ${v.comentario ? `<p class="comentario">${esc(v.comentario)}</p>` : ""}
  <p class="acciones">${enlacesContacto(v.telefono, textoWhatsappValoracion(v))}</p>
</article>`).join("")
    : `<p>Todavía no hay solicitudes de valoración.</p>`;
  return pagina({
    titulo: "Panel · Valoraciones", privada: true,
    cuerpo: `${cabeceraPanel("valoraciones", extra)}
<div class="titulo-seccion"><h1>Valoraciones <span class="cuenta">(${esc(total)})</span></h1>
<a class="boton pequeno secundario" href="/panel/exportar?que=valoraciones" download>Descargar Excel (CSV)</a></div>
<p class="ayuda">De la más nueva a la más vieja${total > valoraciones.length ? ` (se ven las ${valoraciones.length} últimas; el CSV las lleva todas)` : ""}.</p>
${lista}`,
  });
}

export function panelVisitas({ porDia, desde, hasta, ...extra }) {
  const bloques = porDia.length
    ? porDia.map(({ fecha, visitas }) => `<section class="dia">
  <h2>${esc(etiquetaLarga(fecha))}</h2>
  ${visitas.map((v) => `<article class="ficha${v.estado === "cancelada" ? " cancelada" : ""}">
    <header><h3>${esc(v.fecha_hora.slice(11))} · ${esc(v.referencia)}</h3>${v.estado === "cancelada" ? '<p class="etiqueta">Cancelada</p>' : ""}</header>
    <p>${esc(v.nombre)}${v.comentario ? ` — <span class="comentario">${esc(v.comentario)}</span>` : ""}</p>
    ${v.estado === "activa" ? `<p class="acciones">${enlacesContacto(v.telefono, textoWhatsappVisita(v))}</p>
    <form method="post" action="/panel/visitas/cancelar" data-confirmar="¿Cancelar la visita de ${esc(v.nombre)} (${esc(v.fecha_hora.replace("T", " "))})? El hueco quedará libre. Al cliente no se le avisa: escríbele tú.">
      <input type="hidden" name="id" value="${esc(v.id)}"><input type="hidden" name="desde" value="${esc(desde)}">
      <button type="submit" class="boton pequeno peligro">Cancelar visita</button>
    </form>` : ""}
  </article>`).join("")}
</section>`).join("")
    : `<p>No hay visitas entre el ${esc(etiquetaLarga(desde))} y el ${esc(etiquetaLarga(hasta))}.</p>`;
  return pagina({
    titulo: "Panel · Visitas", privada: true,
    cuerpo: `${cabeceraPanel("visitas", extra)}
<div class="titulo-seccion"><h1>Visitas</h1>
<a class="boton pequeno secundario" href="/panel/exportar?que=visitas" download>Descargar Excel (CSV)</a></div>
<form method="get" action="/panel" class="formulario en-linea">
  <input type="hidden" name="vista" value="visitas">
  ${campoTexto({ id: "desde", etiqueta: "Desde el día", tipo: "date", valor: desde, ayuda: "Se ven 14 días a partir de esa fecha." })}
  <button type="submit" class="boton secundario">Ver</button>
</form>
${bloques}`,
  });
}

export function panelBloqueos({ bloqueos, hoy, bloque, ...extra }) {
  const lista = bloqueos.length
    ? `<ul class="lista-simple">${bloqueos.map((b) => `<li>
  <span><strong>${esc(etiquetaLarga(b.fecha))}</strong> · ${b.hora ? esc(b.hora) : "todo el día"}${b.motivo ? ` — ${esc(b.motivo)}` : ""}</span>
  <form method="post" action="/panel/bloqueos/quitar"><input type="hidden" name="id" value="${esc(b.id)}"><button type="submit" class="boton pequeno secundario">Quitar</button></form>
</li>`).join("")}</ul>`
    : "<p>No hay bloqueos a partir de hoy.</p>";
  return pagina({
    titulo: "Panel · Bloqueos", privada: true,
    cuerpo: `${cabeceraPanel("bloqueos", extra)}
<h1>Bloquear huecos</h1>
<p class="ayuda">Para días de fiesta, vacaciones o cuando no puedas enseñar pisos. Deja la hora vacía para bloquear el día entero.</p>
<form method="post" action="/panel/bloqueos/nuevo" class="formulario">
  ${campoTexto({ id: "fecha", etiqueta: "Día", tipo: "date", extra: `min="${esc(hoy)}"` })}
  ${campoTexto({ id: "hora", etiqueta: "Hora", tipo: "time", obligatorio: false, extra: `step="${esc(bloque * 60)}"`, ayuda: "Vacía = el día entero." })}
  ${campoTexto({ id: "motivo", etiqueta: "Motivo", obligatorio: false, max: LIMITES.motivo, ayuda: "Solo lo ves tú." })}
  <button type="submit" class="boton">Bloquear</button>
</form>
<h2>Bloqueos desde hoy</h2>
${lista}`,
  });
}

export function panelInmuebles({ inmuebles, textoLista = "", ...extra }) {
  const lista = inmuebles.length
    ? `<ul class="lista-simple">${inmuebles.map((i) => `<li class="${i.activo ? "" : "inactivo"}">
  <span><strong>${esc(i.referencia)}</strong>${i.titulo ? ` · ${esc(i.titulo)}` : ""}${i.zona ? ` · ${esc(i.zona)}` : ""}${i.activo ? "" : ' <span class="etiqueta">desactivado</span>'}</span>
  <span class="acciones">
    <form method="post" action="/panel/inmuebles/estado"><input type="hidden" name="referencia" value="${esc(i.referencia)}"><input type="hidden" name="accion" value="${i.activo ? "desactivar" : "activar"}"><button type="submit" class="boton pequeno secundario">${i.activo ? "Desactivar" : "Activar"}</button></form>
    <form method="post" action="/panel/inmuebles/estado" data-confirmar="¿Borrar ${esc(i.referencia)} de la lista?"><input type="hidden" name="referencia" value="${esc(i.referencia)}"><input type="hidden" name="accion" value="borrar"><button type="submit" class="boton pequeno peligro">Borrar</button></form>
  </span>
</li>`).join("")}</ul>`
    : "<p>La lista está vacía: carga los inmuebles abajo.</p>";
  return pagina({
    titulo: "Panel · Inmuebles", privada: true,
    cuerpo: `${cabeceraPanel("inmuebles", extra)}
<h1>Inmuebles que se pueden visitar</h1>
${lista}
<h2>Cargar o actualizar la lista</h2>
<p class="ayuda">Una línea por inmueble: <code>REFERENCIA; título; zona; enlace https</code> (solo la referencia es obligatoria). También vale un JSON: <code>[{"referencia":"PIS0190","titulo":"…","zona":"…","enlace":"https://…"}]</code>. Si la referencia ya existe, se actualiza.</p>
<form method="post" action="/panel/inmuebles/cargar" class="formulario">
  ${campoArea({ id: "lista", etiqueta: "Lista", valor: textoLista, obligatorio: true, filas: 8 })}
  <div class="campo casilla">
    <input type="checkbox" id="desactivar_resto" name="desactivar_resto" value="on">
    <label for="desactivar_resto">Desactivar los inmuebles que no estén en esta lista</label>
  </div>
  <button type="submit" class="boton">Guardar lista</button>
</form>`,
  });
}
