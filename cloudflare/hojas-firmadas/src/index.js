// ============================================================================
//  hojas-firmadas — Worker de Cloudflare: hojas de visita y de captación
//  firmadas con el dedo, para UNA inmobiliaria (una copia por inmobiliaria,
//  cada una con su Worker y su D1; la marca se cambia en Ajustes).
// ----------------------------------------------------------------------------
//   /                      la app (PWA); sin datos de clientes, se puede cachear
//   /manifest.webmanifest  nombre y colores de la marca
//   /icono-192.png …       icono dibujado con los colores de la marca
//   /marca/logo.jpg        logo de la inmobiliaria (público, como en su web)
//   /sw.js                 service worker (la app abre sin cobertura)
//   /static/*              estilos y JavaScript (carpeta public/)
//   /api/*                 TODO lo que tiene datos: solo con sesión
//
//  Aquí solo hay rutas, permisos y cabeceras. La lógica pura vive en
//  public/static/nucleo/ (la comparten el móvil y el Worker), sesion.js,
//  csv.js, icono.js y html.js; el SQL en datos.js. `crearManejador` deja
//  inyectar el reloj y fetch para probar el Worker entero con Node y una D1
//  simulada sobre SQLite.
// ============================================================================
import { esHojaExacta, hashHoja, canonico, resumenHoja, esId, esHash, enMadrid, normalBusqueda, TIPOS } from "../public/static/nucleo/hoja.js";
import {
  marcaCompleta, textosCompletos, validaMarca, cambiaTextos, marcaRevisados, pendientesMarca, TEXTOS_DEFECTO, GRUPOS_TEXTOS,
} from "../public/static/nucleo/marca.js";
import { esISO, sumaDias } from "../public/static/cerebro/utiles.js";
import { aCsv } from "./csv.js";
import {
  COOKIE, LARGO_MINIMO_CLAVE, igualesSeguro, creaSesion, leeSesion, cabeceraCookie, cabeceraBorrarCookie, leeCookie, hmacHex,
  resumeClave, compruebaClave, GUARDADO_DE_RELLENO, validaClaveAgente, esUsuario,
} from "./sesion.js";
import { avisaTelegram, textoHojaFirmada, telegramActivo } from "./telegram.js";
import { iconoPng } from "./icono.js";
import * as db from "./datos.js";
import { paginaApp, manifiesto, paginaMensaje } from "./html.js";

// ---- Límites -------------------------------------------------------------------
export const LIMITE = {
  fallosLoginIp: 5,          // por IP en 15 minutos
  fallosLoginTotal: 200,     // entre todas las IP en 15 minutos (ver README)
  ventanaLoginS: 900,
  subidasPorHora: 300,       // por agente: una cola grande se sube sin problema
  cuerpoHoja: 768 * 1024,    // dos firmas de 150 KB en base64 + datos + textos
  cuerpoLogo: 300 * 1024,
  cuerpoNormal: 64 * 1024,
  logoBytes: 200 * 1024,
};
const LOGO_DEFECTO = { ruta: "/static/cerebro/logo-castresana.jpg", ancho: 500, alto: 201 };

// ---- Cabeceras de seguridad ------------------------------------------------------
export function cabecerasSeguridad({ privada = true } = {}) {
  return {
    "content-security-policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "strict-transport-security": "max-age=31536000",
    "cross-origin-opener-policy": "same-origin",
    "cache-control": "no-store",
    ...(privada ? { "x-robots-tag": "noindex, nofollow" } : {}),
  };
}

const respuesta = (cuerpo, estado, tipo, extra = {}) =>
  new Response(cuerpo, { status: estado, headers: { "content-type": tipo, ...cabecerasSeguridad(), ...extra } });
const json = (obj, estado = 200, extra = {}) => respuesta(JSON.stringify(obj), estado, "application/json; charset=utf-8", extra);
const htmlR = (cuerpo, estado = 200, extra = {}) => respuesta(cuerpo, estado, "text/html; charset=utf-8", extra);

export class ErrorHttp extends Error {
  constructor(estado, mensaje, extra = {}) { super(mensaje); this.estado = estado; this.extra = extra; }
}

async function leeJson(request, maximo) {
  const largo = Number(request.headers.get("content-length") || 0);
  if (largo > maximo) throw new ErrorHttp(413, "Lo enviado es demasiado grande.");
  const tipo = (request.headers.get("content-type") || "").toLowerCase();
  // Exigir JSON obliga a otra web a pasar por la comprobación CORS previa,
  // que este Worker nunca aprueba.
  if (!tipo.startsWith("application/json")) throw new ErrorHttp(415, "Formato de envío no admitido.");
  const cuerpo = await request.text();
  if (cuerpo.length > maximo) throw new ErrorHttp(413, "Lo enviado es demasiado grande.");
  try {
    const v = JSON.parse(cuerpo || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new ErrorHttp(400, "Lo enviado no es válido.");
  }
}

/**
 * Los cambios (POST) solo se aceptan desde esta misma web: Sec-Fetch-Site lo
 * pone el navegador y otra web no lo puede falsear; si no viene, se mira
 * Origin. Además la cookie es SameSite=Strict y se exige JSON.
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

// La IP se guarda como HMAC-SHA256 con una clave secreta (IP_SECRETO o, si
// no, derivada de PANEL_CLAVE), igual que en castresana-web.
let claveIpTemporal = "";
export function secretoIp(env) {
  const propio = String(env.IP_SECRETO || "");
  if (propio.length >= 16) return `hojas-firmadas/ip/v1|propio|${propio}`;
  const panel = String(env.PANEL_CLAVE || "");
  if (panel) return `hojas-firmadas/ip/v1|panel|${panel}`;
  if (!claveIpTemporal) claveIpTemporal = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `hojas-firmadas/ip/v1|temporal|${claveIpTemporal}`;
}
const ipResumida = async (request, env) => (await hmacHex(secretoIp(env), ipDe(request))).slice(0, 32);

function enSegundoPlano(ctx, promesa) {
  const p = Promise.resolve(promesa).catch((e) => console.warn("Tarea en segundo plano:", e?.message || e));
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
  return p;
}

/** Medianoche de Madrid de ese día, en ISO UTC ('' si la fecha no vale). */
export function inicioDiaMadridUtc(fecha) {
  if (!esISO(fecha)) return "";
  const [a, m, d] = fecha.split("-").map(Number);
  for (const h of [1, 2]) { // horario de invierno (+1) o de verano (+2)
    const iso = new Date(Date.UTC(a, m - 1, d, 0, 0) - h * 3600_000).toISOString();
    const e = enMadrid(iso);
    if (e.iso === fecha && e.hora === "00:00") return iso;
  }
  return "";
}

// ---- Marca ------------------------------------------------------------------------
async function leeMarca(base) {
  const [marca, textos, logo] = await Promise.all([db.leeAjuste(base, "marca"), db.leeAjuste(base, "textos"), db.leeAjuste(base, "logo")]);
  let infoLogo;
  if (!logo) infoLogo = { modo: "defecto", ancho: LOGO_DEFECTO.ancho, alto: LOGO_DEFECTO.alto };
  else if (logo.ninguno) infoLogo = { modo: "ninguno" };
  else infoLogo = { modo: "propio", ancho: logo.ancho, alto: logo.alto };
  return { marca: marcaCompleta(marca), textos: textosCompletos(textos), logo: infoLogo, logoDatos: logo };
}

/** Logo subido: JPEG de verdad (FF D8 FF), ≤ 200 KB y medidas razonables. */
export function validaLogo(b) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(b?.dataUrl || ""));
  if (!m) return { error: "El logo tiene que llegar como JPEG (la app lo convierte sola)." };
  let bytes;
  try { bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch { return { error: "El logo no es válido." }; }
  if (bytes.length > LIMITE.logoBytes) return { error: "El logo pesa más de 200 KB." };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: "El archivo no es un JPEG." };
  const ancho = Number(b.ancho), alto = Number(b.alto);
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 16 || alto < 16 || ancho > 1600 || alto > 1600) return { error: "Las medidas del logo no son válidas." };
  return { logo: { dataUrl: b.dataUrl, ancho, alto } };
}

// ============================================================================
export function crearManejador({ reloj = () => Date.now(), hazFetch = (...a) => fetch(...a) } = {}) {
  const iconos = new Map(); // caché por isolate: dibujar el icono cuesta unos milisegundos

  return async function fetchWorker(request, env, ctx) {
    const url = new URL(request.url);
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    const metodo = request.method === "HEAD" ? "GET" : request.method;
    try {
      if (ruta.startsWith("/api/")) return await api(request, env, ctx, url, ruta, metodo);
      if (metodo !== "GET") return noPermitido("GET");
      if (ruta.startsWith("/static/")) return await estatico(request, env, "no-cache");
      if (ruta === "/sw.js") return await estatico(request, env, "no-cache", { "service-worker-allowed": "/" });
      if (ruta === "/robots.txt") return respuesta("User-agent: *\nDisallow: /\n", 200, "text/plain; charset=utf-8");
      if (ruta === "/" || ruta === "/index.html") {
        const { marca, logo } = await leeMarca(env.DB);
        return htmlR(paginaApp({ marca, conLogo: logo.modo !== "ninguno" }), 200, { "cache-control": "no-cache" });
      }
      if (ruta === "/manifest.webmanifest") {
        const { marca } = await leeMarca(env.DB);
        return respuesta(manifiesto(marca), 200, "application/manifest+json; charset=utf-8", { "cache-control": "no-cache" });
      }
      const icono = /^\/icono-(192|512)\.png$/.exec(ruta);
      if (icono) {
        const { marca } = await leeMarca(env.DB);
        const clave = `${icono[1]}|${marca.colorPrincipal}|${marca.colorAcento}`;
        if (!iconos.has(clave)) iconos.set(clave, await iconoPng(Number(icono[1]), marca.colorPrincipal, marca.colorAcento));
        return respuesta(iconos.get(clave), 200, "image/png", { "cache-control": "public, max-age=3600" });
      }
      if (ruta === "/marca/logo.jpg") {
        const { logoDatos } = await leeMarca(env.DB);
        if (!logoDatos) return await estatico(new Request(new URL(LOGO_DEFECTO.ruta, url), request), env, "no-cache");
        if (logoDatos.ninguno) return respuesta("Sin logo", 404, "text/plain; charset=utf-8");
        const bytes = Uint8Array.from(atob(logoDatos.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
        return respuesta(bytes, 200, "image/jpeg", { "cache-control": "no-cache" });
      }
      return htmlR(paginaMensaje({ titulo: "No encontrado", texto: "Esta página no existe." }), 404);
    } catch (e) {
      if (e instanceof ErrorHttp) return json({ error: e.message, ...e.extra }, e.estado);
      console.error("Error inesperado:", e?.stack || e);
      return json({ error: "Ha habido un error en el servidor. Vuelve a intentarlo en un momento." }, 500);
    }

    // ---- Archivos de public/ (binding ASSETS) -------------------------------------
    async function estatico(req, entorno, cache, extra = {}) {
      if (!entorno.ASSETS) return respuesta("No encontrado", 404, "text/plain; charset=utf-8");
      const r = await entorno.ASSETS.fetch(req);
      const h = new Headers(r.headers);
      for (const [k, v] of Object.entries(cabecerasSeguridad())) h.set(k, v);
      h.set("cache-control", r.ok ? cache : "no-store");
      for (const [k, v] of Object.entries(extra)) h.set(k, v);
      return new Response(r.body, { status: r.status, headers: h });
    }
  };

  // ==========================================================================
  //  API
  // ==========================================================================
  async function api(req, env, ctx, u, ruta, met) {
    const clave = String(env.PANEL_CLAVE || "");
    if (clave.length < LARGO_MINIMO_CLAVE) {
      throw new ErrorHttp(503, `App apagada: falta el secreto PANEL_CLAVE o tiene menos de ${LARGO_MINIMO_CLAVE} caracteres. Mira el README, paso «Secretos».`, { apagada: true });
    }
    const ahora = reloj();
    const iso = new Date(ahora).toISOString();
    if (met === "POST") compruebaOrigen(req, u);

    // ---- Entrar ----------------------------------------------------------------
    if (ruta === "/api/entrar") {
      if (met !== "POST") return noPermitido("POST");
      const datos = await leeJson(req, 4096);
      // PRIMERO se suma el intento y DESPUÉS se compara (atómico en D1): así,
      // aunque lleguen 40 a la vez, como mucho se comparan 5 por IP.
      const claveIpLogin = `login:${await ipResumida(req, env)}`;
      const [nIp, nTodos] = await Promise.all([
        db.sumaIntento(env.DB, claveIpLogin, LIMITE.ventanaLoginS, ahora),
        db.sumaIntento(env.DB, "login:todos", LIMITE.ventanaLoginS, ahora),
      ]);
      if (nIp > LIMITE.fallosLoginIp || nTodos > LIMITE.fallosLoginTotal) {
        throw new ErrorHttp(429, "Demasiados intentos fallidos. Espera 15 minutos y vuelve a probar.");
      }
      const usuario = String(datos.usuario || "").trim().toLowerCase().slice(0, 40);
      const claveDada = String(datos.clave || "").slice(0, 200);
      let sesion = null;
      if (!usuario) {
        if (await igualesSeguro(claveDada, clave)) sesion = { agente: 0, version: 0 };
      } else {
        const ag = esUsuario(usuario) ? await db.agentePorUsuario(env.DB, usuario) : null;
        const ok = await compruebaClave(claveDada, ag || GUARDADO_DE_RELLENO);
        if (ok && ag) sesion = { agente: ag.id, version: ag.version };
      }
      if (!sesion) throw new ErrorHttp(401, usuario ? "Usuario o clave incorrectos." : "Clave incorrecta.");
      await Promise.all([
        db.restaIntento(env.DB, claveIpLogin, LIMITE.ventanaLoginS, ahora),
        db.restaIntento(env.DB, "login:todos", LIMITE.ventanaLoginS, ahora),
      ]);
      enSegundoPlano(ctx, db.limpiaLimites(env.DB, ahora));
      return json({ ok: true }, 200, { "set-cookie": cabeceraCookie(await creaSesion(clave, ahora, sesion)) });
    }

    // ---- A partir de aquí, con sesión -------------------------------------------
    const yo = await quienSoy(env, req, clave, ahora);
    if (!yo) throw new ErrorHttp(401, "Tu sesión ha caducado o no has entrado. Vuelve a entrar.", { sesion: false });

    if (ruta === "/api/salir") {
      if (met !== "POST") return noPermitido("POST");
      return json({ ok: true }, 200, { "set-cookie": cabeceraBorrarCookie() });
    }

    if (ruta === "/api/yo" && met === "GET") {
      const { marca, textos, logo } = await leeMarca(env.DB);
      const avisos = [];
      if (yo.titular) {
        const p = pendientesMarca(marca);
        if (p.length) avisos.push(`Faltan datos de la marca: ${p.join(", ")}. Complétalos en Ajustes.`);
        if (!textos.visitaRevisados) avisos.push("Los textos legales de la hoja de visita son BORRADOR: revísalos con un profesional.");
        if (!textos.captacionRevisados) avisos.push("Los textos legales de la hoja de captación son BORRADOR: revísalos con un profesional.");
        if (!telegramActivo(env)) avisos.push("Telegram apagado (es opcional): faltan los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.");
      }
      return json({ agente: { id: yo.id, nombre: yo.nombre, titular: yo.titular }, marca, textos, logo, avisos });
    }

    // ---- Hojas --------------------------------------------------------------------
    if (ruta === "/api/hojas" && met === "POST") return subeHoja(req, env, ctx, yo, ahora, iso);
    if (ruta === "/api/hojas" && met === "GET") {
      const q = u.searchParams;
      const tipo = ["visita", "captacion"].includes(q.get("tipo")) ? q.get("tipo") : "";
      const desde = esISO(q.get("desde")) ? q.get("desde") : "";
      const hasta = esISO(q.get("hasta")) ? q.get("hasta") : "";
      const filas = await db.listaHojas(env.DB, {
        tipo,
        desdeUtc: desde ? inicioDiaMadridUtc(desde) : "",
        hastaUtc: hasta ? inicioDiaMadridUtc(sumaDias(hasta, 1)) : "",
        referencia: String(q.get("ref") || "").trim().slice(0, 40),
        nombre: normalBusqueda(q.get("nombre")).slice(0, 60),
        limite: 200,
      });
      return json({ hojas: filas, total: await db.cuentaHojas(env.DB), limite: 200 });
    }
    const mHoja = /^\/api\/hojas\/([0-9a-f-]{36})(\/anular|\/borrar)?$/.exec(ruta);
    if (mHoja) {
      const id = mHoja[1];
      if (!esId(id)) throw new ErrorHttp(404, "Esa hoja no existe.");
      if (!mHoja[2] && met === "GET") {
        const f = await db.leeHoja(env.DB, id);
        if (!f) throw new ErrorHttp(404, "Esa hoja no existe o se borró.");
        return json({
          hoja: JSON.parse(f.contenido),
          registro: { hash: f.hash, recibida: f.recibida, estado: f.estado, anulada: f.anulada, motivo: f.motivo, anuladaPor: f.anulada_por, agente: f.agente },
        });
      }
      if (met !== "POST") return noPermitido(mHoja[2] ? "POST" : "GET");
      soloTitular(yo);
      const datos = await leeJson(req, LIMITE.cuerpoNormal);
      if (mHoja[2] === "/anular") {
        const motivo = String(datos.motivo || "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (motivo.length < 5) throw new ErrorHttp(422, "Escribe el motivo de la anulación (5 caracteres o más).");
        const n = await db.anulaHoja(env.DB, id, { cuando: iso, motivo, quien: yo.nombre });
        if (!n) {
          const f = await db.leeHoja(env.DB, id);
          throw new ErrorHttp(f ? 409 : 404, f ? "Esa hoja ya estaba anulada." : "Esa hoja no existe.");
        }
        return json({ ok: true, anulada: iso });
      }
      // Supresión (RGPD): con confirmación escrita.
      if (String(datos.confirmacion || "") !== "BORRAR") throw new ErrorHttp(422, "Para borrar, escribe BORRAR en la casilla de confirmación.");
      const n = await db.borraHoja(env.DB, id, { cuando: iso, quien: yo.nombre });
      if (!n) throw new ErrorHttp(404, "Esa hoja no existe o ya se borró.");
      return json({ ok: true, borrada: iso });
    }

    if (ruta === "/api/exportar" && met === "GET") {
      soloTitular(yo);
      const madrid = (x) => { const e = enMadrid(x); return e.fecha ? `${e.fecha} ${e.hora}` : ""; };
      const filas = (await db.filasCsv(env.DB)).map((f) => [
        TIPOS[f.tipo] || f.tipo, f.estado, madrid(f.firmada), madrid(f.recibida), f.referencia, f.inmueble, f.nombre,
        f.dni, f.telefono, f.correo, f.visita, f.agente, f.hash, madrid(f.anulada), f.motivo, f.id,
      ]);
      const csv = aCsv(["Tipo", "Estado", "Firmada (móvil, hora de Madrid)", "Registrada (servidor)", "Referencia", "Inmueble", "Nombre",
        "DNI / NIE", "Teléfono", "Correo", "Visita (día y hora)", "Agente", "SHA-256", "Anulada el", "Motivo de anulación", "Id"], filas);
      return respuesta(csv, 200, "text/csv; charset=utf-8", { "content-disposition": `attachment; filename="hojas-firmadas-${enMadrid(iso).iso}.csv"` });
    }

    // ---- Ajustes (solo el titular) ----------------------------------------------
    if (ruta.startsWith("/api/ajustes/")) {
      if (met !== "POST") return noPermitido("POST");
      soloTitular(yo);
      const datos = await leeJson(req, ruta === "/api/ajustes/logo" ? LIMITE.cuerpoLogo : LIMITE.cuerpoNormal);
      if (ruta === "/api/ajustes/marca") {
        const r = validaMarca(datos.marca);
        if (!r.ok) throw new ErrorHttp(422, "Revisa los datos de la marca.", { errores: r.errores });
        await db.guardaAjuste(env.DB, "marca", r.marca, iso);
        return json({ ok: true, marca: r.marca });
      }
      if (ruta === "/api/ajustes/textos") {
        const r = cambiaTextos(await db.leeAjuste(env.DB, "textos"), datos.textos);
        if (!r.ok) throw new ErrorHttp(422, "Revisa los textos legales.", { errores: r.errores });
        await db.guardaAjuste(env.DB, "textos", r.textos, iso);
        return json({ ok: true, textos: r.textos });
      }
      if (ruta === "/api/ajustes/revisados") {
        const r = marcaRevisados(await db.leeAjuste(env.DB, "textos"), String(datos.grupo || ""), datos.valor === true);
        if (!r.ok) throw new ErrorHttp(422, r.error);
        await db.guardaAjuste(env.DB, "textos", r.textos, iso);
        return json({ ok: true, textos: r.textos });
      }
      if (ruta === "/api/ajustes/borrador") {
        const grupo = String(datos.grupo || "");
        if (!GRUPOS_TEXTOS[grupo]) throw new ErrorHttp(422, "Grupo de textos desconocido.");
        const t = textosCompletos(await db.leeAjuste(env.DB, "textos"));
        for (const k of GRUPOS_TEXTOS[grupo]) t[k] = TEXTOS_DEFECTO[k];
        t[`${grupo}Revisados`] = false;
        await db.guardaAjuste(env.DB, "textos", t, iso);
        return json({ ok: true, textos: t });
      }
      if (ruta === "/api/ajustes/logo") {
        if (datos.defecto === true) { await db.borraAjuste(env.DB, "logo"); return json({ ok: true, logo: { modo: "defecto", ancho: LOGO_DEFECTO.ancho, alto: LOGO_DEFECTO.alto } }); }
        if (datos.quitar === true) { await db.guardaAjuste(env.DB, "logo", { ninguno: true }, iso); return json({ ok: true, logo: { modo: "ninguno" } }); }
        const r = validaLogo(datos);
        if (r.error) throw new ErrorHttp(422, r.error);
        await db.guardaAjuste(env.DB, "logo", r.logo, iso);
        return json({ ok: true, logo: { modo: "propio", ancho: r.logo.ancho, alto: r.logo.alto } });
      }
      throw new ErrorHttp(404, "Ese ajuste no existe.");
    }

    // ---- Agentes (solo el titular) -----------------------------------------------
    if (ruta === "/api/agentes" || ruta.startsWith("/api/agentes/")) {
      soloTitular(yo);
      if (ruta === "/api/agentes" && met === "GET") return json({ agentes: await db.listaAgentes(env.DB) });
      if (met !== "POST") return noPermitido("POST");
      const datos = await leeJson(req, 4096);
      if (ruta === "/api/agentes") {
        const nombre = String(datos.nombre || "").replace(/\s+/g, " ").trim().slice(0, 80);
        const usuario = String(datos.usuario || "").trim().toLowerCase();
        const errores = [];
        if (nombre.length < 2) errores.push("Falta el nombre del agente (sale en las hojas).");
        if (!esUsuario(usuario)) errores.push("El usuario tiene que tener de 3 a 30 letras sin tildes, cifras, punto o guion (por ejemplo, ana.garcia).");
        const malClave = validaClaveAgente(datos.clave);
        if (malClave) errores.push(malClave);
        if (errores.length) throw new ErrorHttp(422, "Revisa los datos del agente.", { errores });
        const id = await db.creaAgente(env.DB, { nombre, usuario, ...(await resumeClave(String(datos.clave))) }, iso);
        if (!id) throw new ErrorHttp(409, "Ya hay un agente con ese usuario.");
        return json({ ok: true, id });
      }
      const m = /^\/api\/agentes\/(\d{1,9})\/(clave|baja)$/.exec(ruta);
      if (!m) throw new ErrorHttp(404, "Esa acción no existe.");
      const id = Number(m[1]);
      if (m[2] === "clave") {
        const malClave = validaClaveAgente(datos.clave);
        if (malClave) throw new ErrorHttp(422, malClave);
        const n = await db.cambiaClaveAgente(env.DB, id, await resumeClave(String(datos.clave)));
        if (!n) throw new ErrorHttp(404, "Ese agente no existe o está de baja.");
        return json({ ok: true });
      }
      const n = await db.bajaAgente(env.DB, id);
      if (!n) throw new ErrorHttp(404, "Ese agente no existe o ya está de baja.");
      return json({ ok: true });
    }

    if (ruta === "/api/registro" && met === "GET") {
      soloTitular(yo);
      return json({ registro: await db.listaRegistro(env.DB) });
    }
    throw new ErrorHttp(404, "Esa dirección no existe.");
  }

  // ---- Subir una hoja firmada (idempotente) --------------------------------------
  async function subeHoja(req, env, ctx, yo, ahora, iso) {
    const n = await db.sumaIntento(env.DB, `subida:${yo.id}`, 3600, ahora);
    if (n > LIMITE.subidasPorHora) throw new ErrorHttp(429, "Demasiadas hojas en una hora. Se volverán a intentar más tarde.");
    const datos = await leeJson(req, LIMITE.cuerpoHoja);
    const r = esHojaExacta(datos.hoja, { ahoraMs: ahora });
    if (!r.ok) throw new ErrorHttp(422, "La hoja no es válida.", { errores: r.errores });
    const hoja = r.hoja;
    // Un agente sube sus hojas; el titular puede subir las de cualquiera (por
    // ejemplo, si entra en el móvil de un agente para vaciar su cola).
    if (!yo.titular && hoja.agente.id !== yo.id) throw new ErrorHttp(403, "Esta hoja la firmó otro agente: tiene que subirla él.");
    const hash = await hashHoja(hoja);
    if (!esHash(datos.hash) || datos.hash !== hash) throw new ErrorHttp(422, "El código SHA-256 no coincide con el contenido: la hoja ha cambiado después de firmarse.");
    const res = resumenHoja(hoja);
    const resultado = await db.guardaHoja(env.DB, {
      id: hoja.id, tipo: hoja.tipo, referencia: res.referencia, inmueble: res.inmueble, nombre: res.nombre, busqueda: res.busqueda,
      agenteId: hoja.agente.id, agente: hoja.agente.nombre, firmada: hoja.firmadaEn, recibida: iso,
      ip: await ipResumida(req, env), contenido: canonico(hoja), hash,
    });
    if (resultado === "conflicto") throw new ErrorHttp(409, "Ya hay otra hoja con ese identificador y distinto contenido.");
    if (resultado === "borrada") throw new ErrorHttp(410, "Esa hoja se borró por supresión de datos y no se vuelve a guardar.", { borrada: true });
    if (resultado === "repetida") {
      const f = await db.leeHoja(env.DB, hoja.id);
      return json({ ok: true, repetida: true, id: hoja.id, hash, recibida: f.recibida, estado: f.estado });
    }
    enSegundoPlano(ctx, avisaTelegram(env, textoHojaFirmada(hoja), hazFetch));
    enSegundoPlano(ctx, db.limpiaLimites(env.DB, ahora));
    return json({ ok: true, id: hoja.id, hash, recibida: iso, estado: "firmada" }, 201);
  }

  async function quienSoy(env, req, clave, ahora) {
    const s = await leeSesion(leeCookie(req.headers.get("cookie"), COOKIE), clave, ahora);
    if (!s) return null;
    if (s.agente === 0) {
      const { marca } = await leeMarca(env.DB);
      return { id: 0, nombre: marca.titular, titular: true };
    }
    const ag = await db.agentePorId(env.DB, s.agente);
    if (!ag || !ag.activo || ag.version !== s.version) return null;
    return { id: ag.id, nombre: ag.nombre, titular: false };
  }
}


function soloTitular(yo) {
  if (!yo.titular) throw new ErrorHttp(403, "Esto solo lo puede hacer el titular (la clave principal).");
}

function noPermitido(permitidos) {
  return respuesta(JSON.stringify({ error: "Método no permitido" }), 405, "application/json; charset=utf-8", { allow: permitidos });
}

export default { fetch: crearManejador() };
