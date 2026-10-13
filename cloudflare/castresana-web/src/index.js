// ============================================================================
//  castresana-web — Worker de Cloudflare de Asesoría Castresana
// ----------------------------------------------------------------------------
//   /            portada con los dos accesos
//   /valora      «Valora tu piso» (captación; NO da precio)
//   /visitas     reservas de visitas sin choques
//   /privacidad  información de privacidad (BORRADOR)
//   /panel       panel privado de Pau (clave en el secreto PANEL_CLAVE)
//   /static/*    logo, estilos y JS (carpeta public/, binding ASSETS)
//
//  Aquí solo hay rutas, permisos y cabeceras. La lógica pura vive en
//  horario.js, validacion.js, csv.js, sesion.js, mensajes.js y html.js, y el
//  SQL en datos.js. `crearManejador` deja inyectar el reloj y fetch para probar
//  el Worker entero con Node y una D1 simulada sobre SQLite.
// ============================================================================
import {
  configVisitas, hoyEnMadrid, sumaDias, diasConHuecos, huecosLibres, compruebaHueco, compruebaHoraBloqueo, esFecha, esHora, enMadrid,
} from "./horario.js";
import {
  validaValoracion, validaReserva, leeListaInmuebles, validaBloqueo, esReferencia, OPERACIONES, TIPOS, textoDe,
} from "./validacion.js";
import { aCsv } from "./csv.js";
import {
  COOKIE, LARGO_MINIMO_CLAVE, igualesSeguro, creaSesion, sesionValida, cabeceraCookie, cabeceraBorrarCookie, leeCookie, hmacHex,
} from "./sesion.js";
import { avisaTelegram, textoValoracion, textoVisita, conTelefono } from "./telegram.js";
import * as db from "./datos.js";
import * as vistas from "./html.js";

// ---- Límites -------------------------------------------------------------------
export const LIMITE = {
  valoraPorHora: 5,
  visitasPorHora: 5,
  fallosLoginIp: 5,          // por IP en 15 minutos
  // Entre todas las IP en 15 minutos. Es el freno contra quien prueba claves
  // desde muchas IP a la vez, pero también es la forma de dejar a Pau fuera:
  // basta con gastarlo. Con 200, y 5 por IP, hacen falta al menos 40 IP
  // distintas cada 15 minutos para bloquearle; a la vez, 200 intentos cada
  // 15 minutos (unos 19.000 al día) no sirven para adivinar una clave de 12
  // caracteres o más. Si aun así se bloquea, el README explica qué hacer.
  fallosLoginTotal: 200,
  ventanaLoginS: 900,
  cuerpoPublico: 16 * 1024,
  cuerpoPanel: 128 * 1024,
};
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VISTAS_PANEL = ["valoraciones", "visitas", "bloqueos", "inmuebles"];

const turnstileActivo = (env) => Boolean(env.TURNSTILE_SECRET && env.TURNSTILE_SITEKEY);

// ---- Respuestas con cabeceras de seguridad -------------------------------------
export function cabecerasSeguridad(env, { privada = false } = {}) {
  const ts = turnstileActivo(env) ? " https://challenges.cloudflare.com" : "";
  return {
    "content-security-policy": [
      "default-src 'self'",
      `script-src 'self'${ts}`,
      `frame-src ${ts ? ts.trim() : "'none'"}`,
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    // same-origin y no no-referrer: con no-referrer Chromium manda «Origin: null»
    // en los formularios. Hacia otras webs (wa.me…) no se envía nada igual.
    "referrer-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "strict-transport-security": "max-age=31536000",
    "cross-origin-opener-policy": "same-origin",
    ...(privada ? { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } : { "cache-control": "no-store" }),
  };
}

function html(env, cuerpo, estado = 200, { privada = false, cabeceras = {} } = {}) {
  return new Response(cuerpo, {
    status: estado,
    headers: { "content-type": "text/html; charset=utf-8", ...cabecerasSeguridad(env, { privada }), ...cabeceras },
  });
}
function redirige(env, destino, { cookie = "" } = {}) {
  const h = { location: destino, ...cabecerasSeguridad(env, { privada: true }) };
  if (cookie) h["set-cookie"] = cookie;
  return new Response(null, { status: 303, headers: h });
}
function texto(env, cuerpo, estado = 200, tipo = "text/plain; charset=utf-8", extra = {}) {
  return new Response(cuerpo, { status: estado, headers: { "content-type": tipo, ...cabecerasSeguridad(env), ...extra } });
}

class ErrorHttp extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

async function leeFormulario(request, maximo) {
  const largo = Number(request.headers.get("content-length") || 0);
  if (largo > maximo) throw new ErrorHttp(413, "Lo enviado es demasiado grande.");
  const tipo = (request.headers.get("content-type") || "").toLowerCase();
  if (!tipo.startsWith("application/x-www-form-urlencoded")) throw new ErrorHttp(415, "Formato de envío no admitido.");
  const cuerpo = await request.text();
  if (cuerpo.length > maximo) throw new ErrorHttp(413, "Lo enviado es demasiado grande.");
  return Object.fromEntries(new URLSearchParams(cuerpo));
}

/**
 * Los POST solo se aceptan desde páginas de este mismo sitio.
 * 1) Sec-Fetch-Site lo pone el navegador y una web ajena no lo puede cambiar:
 *    si viene, manda él.
 * 2) Si no viene (navegadores antiguos), se mira Origin. Ojo: Origin puede
 *    llegar como «null» (privacidad del navegador); eso no es «otra web».
 * Además, la cookie del panel es SameSite=Strict: desde otra web no viaja.
 */
function compruebaOrigen(request, url) {
  const sitio = request.headers.get("sec-fetch-site");
  const origen = request.headers.get("origin");
  const rechazo = () => new ErrorHttp(403, "Envío rechazado: no viene de esta web.");
  if (sitio) {
    if (!["same-origin", "none"].includes(sitio)) throw rechazo();
    return;
  }
  if (origen && origen !== "null" && origen !== url.origin) throw rechazo();
}

const ipDe = (request) => request.headers.get("cf-connecting-ip") || "sin-ip";

// La IP no se guarda tal cual: se guarda un HMAC-SHA256 con una clave secreta.
// Un SHA-256 con un prefijo fijo (lo de antes) se deshace probando todas las
// IPv4, porque el prefijo está en el código, que es público. La clave sale
// del secreto IP_SECRETO si existe o, si no, de PANEL_CLAVE (derivada con su
// propia etiqueta, así no es la misma que firma las cookies). Cambiar la
// clave del panel pone los contadores a cero, que no es ningún problema.
// Sin ninguno de los dos (panel apagado) se usa una clave aleatoria de esta
// instancia: los límites cuentan peor, pero nunca se guarda algo reversible.
// Se crea la primera vez que hace falta: en Workers no se puede generar nada
// aleatorio en el ámbito global, solo dentro de una petición.
let claveIpTemporal = "";
export function secretoIp(env) {
  const propio = String(env.IP_SECRETO || "");
  if (propio.length >= 16) return `castresana-web/ip/v1|propio|${propio}`;
  const panel = String(env.PANEL_CLAVE || "");
  if (panel) return `castresana-web/ip/v1|panel|${panel}`;
  if (!claveIpTemporal) claveIpTemporal = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `castresana-web/ip/v1|temporal|${claveIpTemporal}`;
}
const claveIp = async (prefijo, request, env) => `${prefijo}:${(await hmacHex(secretoIp(env), ipDe(request))).slice(0, 32)}`;

function enSegundoPlano(ctx, promesa) {
  const p = Promise.resolve(promesa).catch((e) => console.warn("Tarea en segundo plano:", e?.message || e));
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
  return p;
}

/**
 * Turnstile: además de «success», el token tiene que haberse resuelto en ESTA
 * web (hostname). Si no, un token conseguido en otra página con la misma
 * clave pública valdría aquí.
 */
async function compruebaTurnstile(env, token, request, hazFetch) {
  if (!turnstileActivo(env)) return true;
  if (!token || token.length > 2048) return false;
  try {
    const r = await hazFetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ipDe(request) }),
    });
    const j = await r.json();
    return j?.success === true && typeof j.hostname === "string" && j.hostname.toLowerCase() === new URL(request.url).hostname.toLowerCase();
  } catch {
    return false;
  }
}

// ============================================================================
export function crearManejador({ reloj = () => Date.now(), hazFetch = (...a) => fetch(...a) } = {}) {
  return async function fetchWorker(request, env, ctx) {
    const url = new URL(request.url);
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    const metodo = request.method === "HEAD" ? "GET" : request.method;
    try {
      // Ojo: «return await» y no «return» a secas, para que los errores de las
      // funciones asíncronas los recoja este catch.
      if (ruta.startsWith("/static/")) return await estaticos(request, env, metodo);
      if (ruta === "/robots.txt") return texto(env, "User-agent: *\nDisallow: /panel\n");
      if (ruta === "/" && metodo === "GET") return html(env, vistas.paginaInicio());
      if (ruta === "/privacidad" && metodo === "GET") return html(env, vistas.paginaPrivacidad());
      if (ruta === "/valora") {
        if (metodo === "GET") return html(env, vistas.paginaValora({ sitekey: turnstileActivo(env) ? env.TURNSTILE_SITEKEY : "" }));
        if (metodo === "POST") return await valora(request, env, ctx, url);
        return noPermitido(env, "GET, POST");
      }
      if (ruta === "/visitas") {
        if (metodo === "GET") return await visitasGet(env, url);
        if (metodo === "POST") return await visitasPost(request, env, ctx, url);
        return noPermitido(env, "GET, POST");
      }
      if (ruta === "/panel" || ruta.startsWith("/panel/")) return await panel(request, env, url, ruta, metodo);
      return html(env, vistas.paginaMensaje({ titulo: "No encontrado", texto: "Esta página no existe." }), 404);
    } catch (e) {
      if (e instanceof ErrorHttp) {
        return html(env, vistas.paginaMensaje({ titulo: "No se ha podido hacer", texto: e.message, enlace: url.pathname.startsWith("/panel") ? "/panel" : "/" }), e.estado);
      }
      console.error("Error inesperado:", e?.stack || e);
      return html(env, vistas.paginaMensaje({ titulo: "Algo ha fallado", texto: "Ha habido un error en el servidor. Vuelve a intentarlo en un momento." }), 500);
    }

    // ---- /static ---------------------------------------------------------------
    async function estaticos(req, entorno, met) {
      if (met !== "GET") return noPermitido(entorno, "GET");
      if (!entorno.ASSETS) return texto(entorno, "No encontrado", 404);
      const r = await entorno.ASSETS.fetch(req);
      const h = new Headers(r.headers);
      for (const [k, v] of Object.entries(cabecerasSeguridad(entorno))) h.set(k, v);
      h.set("cache-control", r.ok ? "public, max-age=3600" : "no-store");
      return new Response(r.body, { status: r.status, headers: h });
    }

    // ---- «Valora tu piso» ----------------------------------------------------
    async function valora(req, entorno, contexto, u) {
      compruebaOrigen(req, u);
      const datos = await leeFormulario(req, LIMITE.cuerpoPublico);
      const sitekey = turnstileActivo(entorno) ? entorno.TURNSTILE_SITEKEY : "";
      // Campo trampa relleno = robot: se le contesta como si nada y no se guarda.
      if (String(datos.web || "").trim()) return html(entorno, vistas.paginaValoraGracias({ nombre: "", telefono: "" }));
      const r = validaValoracion(datos);
      if (!r.ok) return html(entorno, vistas.paginaValora({ valores: datos, errores: r.errores, sitekey }), 422);
      if (!(await compruebaTurnstile(entorno, datos["cf-turnstile-response"], req, hazFetch))) {
        return html(entorno, vistas.paginaValora({ valores: datos, errores: { turnstile: "No hemos podido comprobar que no eres un robot. Vuelve a intentarlo." }, sitekey }), 400);
      }
      const ahora = reloj();
      const cuenta = await db.sumaIntento(entorno.DB, await claveIp("valora", req, entorno), 3600, ahora);
      if (cuenta > LIMITE.valoraPorHora) {
        return html(entorno, vistas.paginaMensaje({ titulo: "Demasiados envíos", texto: "Has enviado varias solicitudes en poco tiempo. Inténtalo dentro de una hora o llámanos." }), 429);
      }
      await db.guardaValoracion(entorno.DB, r.valor, new Date(ahora).toISOString());
      enSegundoPlano(contexto, db.limpiaLimites(entorno.DB, ahora));
      enSegundoPlano(contexto, avisaTelegram(entorno, textoValoracion(r.valor, { telefono: conTelefono(entorno) }), hazFetch));
      return html(entorno, vistas.paginaValoraGracias(r.valor));
    }

    // ---- Visitas -----------------------------------------------------------------
    async function estadoVisitas(entorno) {
      const cfg = configVisitas(entorno);
      const ahoraMs = reloj();
      const hoy = hoyEnMadrid(ahoraMs);
      const hasta = sumaDias(hoy, cfg.diasVista + 1);
      const [inmuebles, ocupados, bloqueos] = await Promise.all([
        db.inmueblesActivos(entorno.DB), db.huecosOcupados(entorno.DB, hoy, hasta), db.bloqueosEntre(entorno.DB, hoy, hasta),
      ]);
      return { cfg, ahoraMs, hoy, inmuebles, ocupados, bloqueos };
    }

    function pintaVisitas(entorno, est, { referencia = "", fecha = "", valores = {}, errores = {}, aviso = "" }, estado = 200) {
      const { cfg, ahoraMs, inmuebles, ocupados, bloqueos } = est;
      const dias = diasConHuecos({ ahoraMs, cfg, ocupados, bloqueos });
      const inm = inmuebles.find((i) => i.referencia.toLowerCase() === String(referencia).toLowerCase());
      const fechaValida = esFecha(fecha) && dias.some((d) => d.fecha === fecha) ? fecha : "";
      const huecos = inm && fechaValida ? huecosLibres(fechaValida, { ahoraMs, cfg, ocupados, bloqueos }) : null;
      const err = { ...errores };
      if (err.referencia) { err.ref = err.referencia; delete err.referencia; }
      if (referencia && !inm && !err.ref) err.ref = "Ese inmueble ya no tiene visitas abiertas. Elige otro.";
      if (fecha && !fechaValida && inm && !aviso) aviso = "Ese día ya no tiene horas libres. Elige otro.";
      return html(entorno, vistas.paginaVisitas({
        inmuebles, dias, huecos, valores, errores: err, aviso,
        seleccion: { referencia: inm?.referencia || "", fecha: fechaValida, bloque: cfg.bloque },
        sitekey: turnstileActivo(entorno) ? entorno.TURNSTILE_SITEKEY : "",
        telefonoContacto: /^\d{9}$/.test(String(entorno.TELEFONO_CONTACTO || "")) ? entorno.TELEFONO_CONTACTO : "",
      }), estado);
    }

    async function visitasGet(entorno, u) {
      const est = await estadoVisitas(entorno);
      const referencia = String(u.searchParams.get("ref") || "").slice(0, 40);
      const fecha = String(u.searchParams.get("fecha") || "").slice(0, 10);
      return pintaVisitas(entorno, est, { referencia: esReferencia(referencia) ? referencia : "", fecha });
    }

    async function visitasPost(req, entorno, contexto, u) {
      compruebaOrigen(req, u);
      const datos = await leeFormulario(req, LIMITE.cuerpoPublico);
      if (String(datos.web || "").trim()) {
        return html(entorno, vistas.paginaMensaje({ titulo: "Recibido", texto: "Hemos recibido tu solicitud." }));
      }
      const est = await estadoVisitas(entorno);
      const referencia = String(datos.referencia || "").slice(0, 40);
      const fecha = String(datos.fecha || String(datos.fecha_hora || "").slice(0, 10));
      const repinta = (extra, estado) => pintaVisitas(entorno, est, { referencia, fecha, valores: datos, ...extra }, estado);

      // Límite por IP (5 por hora). Cuentan los intentos que llegan a guardarse
      // y los que fallan por validación (lo típico de un robot que prueba).
      // NO cuentan los que chocan con otra reserva (409): la persona no tiene
      // la culpa de que alguien cogiera esa hora antes, y si contaran, quien
      // llega tarde dos o tres veces se quedaría sin poder reservar.
      // El intento se suma ANTES de guardar (sumaIntento es atómico, así
      // aguanta peticiones en paralelo) y se devuelve si al final choca.
      const claveVisita = await claveIp("visita", req, entorno);
      const demasiadas = () => html(entorno, vistas.paginaMensaje({ titulo: "Demasiadas reservas", texto: "Has hecho varias reservas en poco tiempo. Inténtalo dentro de una hora o llámanos.", enlace: "/visitas" }), 429);
      const r = validaReserva(datos);
      if (!r.ok) {
        if ((await db.sumaIntento(entorno.DB, claveVisita, 3600, est.ahoraMs)) > LIMITE.visitasPorHora) return demasiadas();
        return repinta({ errores: r.errores }, 422);
      }
      const inm = est.inmuebles.find((i) => i.referencia.toLowerCase() === r.valor.referencia.toLowerCase());
      if (!inm) return repinta({ errores: { referencia: "Ese inmueble ya no tiene visitas abiertas. Elige otro." } }, 409);
      const hueco = compruebaHueco(r.valor.fechaHora, { ahoraMs: est.ahoraMs, cfg: est.cfg, bloqueos: est.bloqueos });
      if (!hueco.ok) return repinta({ aviso: hueco.motivo }, 409);
      if (!(await compruebaTurnstile(entorno, datos["cf-turnstile-response"], req, hazFetch))) {
        return repinta({ errores: { turnstile: "No hemos podido comprobar que no eres un robot. Vuelve a intentarlo." } }, 400);
      }
      if ((await db.sumaIntento(entorno.DB, claveVisita, 3600, est.ahoraMs)) > LIMITE.visitasPorHora) return demasiadas();
      const devuelve = () => db.restaIntento(entorno.DB, claveVisita, 3600, est.ahoraMs);
      const ocupada = "Esa hora acaba de reservarla otra persona. Elige otra, por favor.";
      // 1) Comprobación amable (para dar un mensaje claro)…
      if (await db.hayVisitaActiva(entorno.DB, r.valor.fechaHora)) {
        await devuelve();
        est.ocupados.add(r.valor.fechaHora);
        return repinta({ aviso: ocupada, valores: { ...datos, fecha_hora: "" } }, 409);
      }
      // 2) …y la definitiva: el índice único de la base de datos.
      const visita = { ...r.valor, referencia: inm.referencia, inicioUtc: new Date(hueco.utc).toISOString() };
      const res = await db.reservaVisita(entorno.DB, visita, new Date(est.ahoraMs).toISOString());
      if (!res.ok) {
        await devuelve();
        est.ocupados.add(r.valor.fechaHora);
        return repinta({ aviso: res.motivo === "choque" ? ocupada : "Esa hora ya no está disponible. Elige otra, por favor.", valores: { ...datos, fecha_hora: "" } }, 409);
      }
      enSegundoPlano(contexto, db.limpiaLimites(entorno.DB, est.ahoraMs));
      enSegundoPlano(contexto, avisaTelegram(entorno, textoVisita(visita, { telefono: conTelefono(entorno) }), hazFetch));
      return html(entorno, vistas.paginaVisitaReservada(visita));
    }

    // ---- Panel ---------------------------------------------------------------------
    async function panel(req, entorno, u, r, met) {
      const clave = String(entorno.PANEL_CLAVE || "");
      if (clave.length < LARGO_MINIMO_CLAVE) {
        return html(entorno, vistas.paginaMensaje({
          titulo: "Panel apagado", privada: true,
          texto: `Falta el secreto PANEL_CLAVE o tiene menos de ${LARGO_MINIMO_CLAVE} caracteres. Mira el README, paso «Secretos».`,
        }), 503, { privada: true });
      }
      const ahora = reloj();

      if (r === "/panel/entrar") {
        if (met !== "POST") return redirige(entorno, "/panel");
        compruebaOrigen(req, u);
        const datos = await leeFormulario(req, 4096);
        // PRIMERO se suma el intento y DESPUÉS se decide. Si se mirara el
        // contador, se comparara la clave y luego se sumara, 40 peticiones en
        // paralelo leerían todas «0 fallos» y se probarían las 40 claves.
        // sumaIntento es un único INSERT … ON CONFLICT … RETURNING: atómico.
        const claveIpLogin = await claveIp("login", req, entorno);
        const [nIp, nTodos] = await Promise.all([
          db.sumaIntento(entorno.DB, claveIpLogin, LIMITE.ventanaLoginS, ahora),
          db.sumaIntento(entorno.DB, "login:todos", LIMITE.ventanaLoginS, ahora),
        ]);
        if (nIp > LIMITE.fallosLoginIp || nTodos > LIMITE.fallosLoginTotal) {
          return html(entorno, vistas.paginaEntrar({ error: "Demasiados intentos fallidos. Espera 15 minutos y vuelve a probar." }), 429, { privada: true });
        }
        if (await igualesSeguro(String(datos.clave || ""), clave)) {
          // Con la clave buena el intento no cuenta como fallo: se devuelve.
          await Promise.all([
            db.restaIntento(entorno.DB, claveIpLogin, LIMITE.ventanaLoginS, ahora),
            db.restaIntento(entorno.DB, "login:todos", LIMITE.ventanaLoginS, ahora),
          ]);
          return redirige(entorno, "/panel", { cookie: cabeceraCookie(await creaSesion(clave, ahora)) });
        }
        return html(entorno, vistas.paginaEntrar({ error: "Clave incorrecta." }), 401, { privada: true });
      }

      const dentro = await sesionValida(leeCookie(req.headers.get("cookie"), COOKIE), clave, ahora);
      if (!dentro) {
        if (met === "POST") return html(entorno, vistas.paginaEntrar({ error: "Tu sesión ha caducado. Vuelve a entrar." }), 401, { privada: true });
        return html(entorno, vistas.paginaEntrar(), 401, { privada: true });
      }

      if (r === "/panel/salir" && met === "POST") {
        compruebaOrigen(req, u);
        return redirige(entorno, "/panel", { cookie: cabeceraBorrarCookie() });
      }
      if (r === "/panel/exportar" && met === "GET") return exporta(entorno, u, ahora);
      if (r === "/panel" && met === "GET") return panelVista(entorno, u, ahora);
      if (met !== "POST") return noPermitido(entorno, "POST");

      compruebaOrigen(req, u);
      const datos = await leeFormulario(req, LIMITE.cuerpoPanel);
      const iso = new Date(ahora).toISOString();
      const id = /^\d{1,12}$/.test(String(datos.id || "")) ? Number(datos.id) : NaN;

      if (r === "/panel/visitas/cancelar") {
        if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(400, "Visita no válida.");
        const n = await db.cancelaVisita(entorno.DB, id, iso);
        const desde = esFecha(datos.desde) ? `&desde=${datos.desde}` : "";
        return redirige(entorno, `/panel?vista=visitas&ok=${n ? "cancelada" : "ya-cancelada"}${desde}`);
      }
      // Derecho de supresión (RGPD): borrar de verdad, no cancelar.
      if (r === "/panel/visitas/borrar") {
        if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(400, "Visita no válida.");
        const n = await db.borraVisita(entorno.DB, id);
        const desde = esFecha(datos.desde) ? `&desde=${datos.desde}` : "";
        return redirige(entorno, `/panel?vista=visitas&ok=${n ? "visita-borrada" : "ya-borrada"}${desde}`);
      }
      if (r === "/panel/valoraciones/borrar") {
        if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(400, "Valoración no válida.");
        const n = await db.borraValoracion(entorno.DB, id);
        return redirige(entorno, `/panel?vista=valoraciones&ok=${n ? "valoracion-borrada" : "ya-borrada"}`);
      }
      if (r === "/panel/bloqueos/nuevo") {
        const b = validaBloqueo(datos, esFecha, esHora);
        if (b.ok && b.valor.hora) {
          const h = compruebaHoraBloqueo(b.valor.fecha, b.valor.hora, configVisitas(entorno));
          if (!h.ok) { b.ok = false; b.errores.push(h.motivo); }
        }
        if (!b.ok) return panelVista(entorno, new URL("/panel?vista=bloqueos", u), ahora, { errores: b.errores }, 422);
        const creado = await db.creaBloqueo(entorno.DB, b.valor, iso);
        let clave2 = creado ? "bloqueado" : "bloqueo-repetido";
        if (creado) {
          const visitas = await db.visitasEntre(entorno.DB, b.valor.fecha, b.valor.fecha);
          if (visitas.some((v) => v.estado === "activa" && (!b.valor.hora || v.fecha_hora.endsWith(`T${b.valor.hora}`)))) clave2 = "bloqueo-con-visita";
        }
        return redirige(entorno, `/panel?vista=bloqueos&ok=${clave2}`);
      }
      if (r === "/panel/bloqueos/quitar") {
        if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(400, "Bloqueo no válido.");
        await db.quitaBloqueo(entorno.DB, id);
        return redirige(entorno, "/panel?vista=bloqueos&ok=desbloqueado");
      }
      if (r === "/panel/inmuebles/cargar") {
        const l = leeListaInmuebles(datos.lista);
        if (!l.ok) return panelVista(entorno, new URL("/panel?vista=inmuebles", u), ahora, { errores: l.errores.slice(0, 20), textoLista: datos.lista }, 422);
        await db.cargaInmuebles(entorno.DB, l.lista, { desactivarResto: datos.desactivar_resto === "on" }, iso);
        return redirige(entorno, "/panel?vista=inmuebles&ok=cargados");
      }
      if (r === "/panel/inmuebles/estado") {
        const referencia = String(datos.referencia || "");
        const accion = String(datos.accion || "");
        if (!esReferencia(referencia) || !["activar", "desactivar", "borrar"].includes(accion)) throw new ErrorHttp(400, "Petición no válida.");
        await db.cambiaInmueble(entorno.DB, referencia, accion, iso);
        return redirige(entorno, `/panel?vista=inmuebles&ok=${{ activar: "activado", desactivar: "desactivado", borrar: "borrado" }[accion]}`);
      }
      return html(entorno, vistas.paginaMensaje({ titulo: "No encontrado", texto: "Esa acción no existe.", enlace: "/panel", privada: true }), 404, { privada: true });
    }

    async function panelVista(entorno, u, ahora, extraVista = {}, estado = 200) {
      const vista = VISTAS_PANEL.includes(u.searchParams.get("vista")) ? u.searchParams.get("vista") : "valoraciones";
      const cfg = configVisitas(entorno);
      const avisos = [...cfg.avisos];
      if (!entorno.TELEGRAM_BOT_TOKEN || !entorno.TELEGRAM_CHAT_ID) avisos.push("Telegram apagado: faltan los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (es opcional).");
      if (!turnstileActivo(entorno)) avisos.push("Turnstile apagado: faltan TURNSTILE_SITEKEY (variable) y TURNSTILE_SECRET (secreto). Funciona igual, con menos protección contra robots.");
      const ok = u.searchParams.get("ok");
      const comun = { avisos, mensaje: vistas.MENSAJES_PANEL[ok] || "", errores: extraVista.errores || [] };
      const hoy = hoyEnMadrid(ahora);
      const P = { privada: true };

      if (vista === "valoraciones") {
        const [valoraciones, total] = await Promise.all([db.listaValoraciones(entorno.DB), db.cuentaValoraciones(entorno.DB)]);
        return html(entorno, vistas.panelValoraciones({ valoraciones, total, ...comun }), estado, P);
      }
      if (vista === "visitas") {
        const desde = esFecha(u.searchParams.get("desde")) ? u.searchParams.get("desde") : hoy;
        const hasta = sumaDias(desde, 13);
        const lista = await db.visitasEntre(entorno.DB, desde, hasta);
        const porDia = [];
        for (const v of lista) {
          const fecha = v.fecha_hora.slice(0, 10);
          if (!porDia.length || porDia[porDia.length - 1].fecha !== fecha) porDia.push({ fecha, visitas: [] });
          porDia[porDia.length - 1].visitas.push(v);
        }
        return html(entorno, vistas.panelVisitas({ porDia, desde, hasta, ...comun }), estado, P);
      }
      if (vista === "bloqueos") {
        const bloqueos = await db.bloqueosEntre(entorno.DB, hoy, "9999-12-31");
        return html(entorno, vistas.panelBloqueos({ bloqueos, hoy, bloque: cfg.bloque, ...comun }), estado, P);
      }
      const inmuebles = await db.todosLosInmuebles(entorno.DB);
      return html(entorno, vistas.panelInmuebles({ inmuebles, textoLista: extraVista.textoLista || "", ...comun }), estado, P);
    }

    async function exporta(entorno, u, ahora) {
      const que = u.searchParams.get("que");
      const hoy = hoyEnMadrid(ahora);
      const madrid = (iso) => {
        const t = Date.parse(iso || "");
        if (Number.isNaN(t)) return "";
        const m = enMadrid(t);
        return `${m.fecha} ${m.hora}`;
      };
      let csv, nombre;
      if (que === "visitas") {
        const filas = (await db.todasLasVisitas(entorno.DB)).map((v) => [
          v.fecha_hora.slice(0, 10), v.fecha_hora.slice(11), v.referencia, v.nombre, v.telefono, v.comentario, v.estado, madrid(v.creada), madrid(v.cancelada),
        ]);
        csv = aCsv(["Día", "Hora", "Inmueble", "Nombre", "Teléfono", "Comentario", "Estado", "Reservada el", "Cancelada el"], filas);
        nombre = `visitas-${hoy}.csv`;
      } else if (que === "valoraciones") {
        const filas = (await db.listaValoraciones(entorno.DB, 100000)).map((v) => [
          madrid(v.creada), v.nombre, v.telefono, v.correo, textoDe(OPERACIONES, v.operacion), textoDe(TIPOS, v.tipo), v.zona, v.metros, v.habitaciones, v.comentario, v.privacidad,
        ]);
        csv = aCsv(["Fecha (hora de Madrid)", "Nombre", "Teléfono", "Correo", "Operación", "Tipo", "Zona", "m²", "Habitaciones", "Comentario", "Privacidad aceptada"], filas);
        nombre = `valoraciones-${hoy}.csv`;
      } else {
        throw new ErrorHttp(400, "Exportación no válida.");
      }
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${nombre}"`,
          ...cabecerasSeguridad(entorno, { privada: true }),
        },
      });
    }
  };
}

function noPermitido(env, permitidos) {
  return texto(env, "Método no permitido", 405, "text/plain; charset=utf-8", { allow: permitidos });
}

export default { fetch: crearManejador() };
