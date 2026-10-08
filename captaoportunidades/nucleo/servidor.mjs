// ============================================================================
//  Servidor HTTP local. Sirve la interfaz y la API desde el mismo origen.
//  Defensas (esto guarda datos personales y escucha en el equipo):
//   - Escucha SOLO en 127.0.0.1 (no accesible desde la red).
//   - Comprueba la cabecera Host (anti «DNS rebinding»): una web maliciosa no
//     puede hacer que el navegador hable con la API usando otro nombre.
//   - Rechaza peticiones con Origin ajeno o Sec-Fetch-Site «cross-site».
//   - Todo lo que cambia datos exige la cabecera X-Captao (un formulario de
//     otra web no puede añadirla).
//   - CSP estricta: ni scripts ni estilos en línea, nada de recursos externos.
//   - Límite de tamaño del JSON (1 MB) y mensajes de error sin detalles internos.
// ============================================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { RUTAS, Respuesta } from "./rutas.mjs";
import { ErrorApp } from "./util.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};
const MAX_JSON = 1024 * 1024;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function seguridad(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function enviarJson(res, estado, cuerpo) {
  const data = Buffer.from(JSON.stringify(cuerpo), "utf8");
  res.writeHead(estado, { "content-type": "application/json; charset=utf-8", "content-length": data.length, "cache-control": "no-store" });
  res.end(data);
}
function enviarError(res, estado, codigo, mensaje, extra = {}) {
  enviarJson(res, estado, { error: { codigo, mensaje, ...extra } });
}

export function hostPermitido(host, puertoLocal) {
  const m = /^(127\.0\.0\.1|localhost|\[::1\]):(\d+)$/i.exec(host || "");
  return Boolean(m) && Number(m[2]) === puertoLocal;
}

async function leerJson(req) {
  const tipo = String(req.headers["content-type"] || "");
  const largo = Number(req.headers["content-length"] || 0);
  if (largo > MAX_JSON) throw new ErrorApp(413, "demasiado_grande", "Los datos enviados son demasiado grandes.");
  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > MAX_JSON) throw new ErrorApp(413, "demasiado_grande", "Los datos enviados son demasiado grandes.");
    trozos.push(t);
  }
  if (!total) return null;
  if (!/application\/json/i.test(tipo)) throw new ErrorApp(415, "tipo_no_admitido", "Los datos deben enviarse como JSON.");
  try { return JSON.parse(Buffer.concat(trozos).toString("utf8")); }
  catch { throw new ErrorApp(400, "json_invalido", "Los datos enviados no son JSON válido."); }
}

function responder(res, resultado) {
  if (resultado instanceof Respuesta) {
    if (resultado.archivo) {
      const st = fs.statSync(resultado.archivo);
      res.writeHead(resultado.estado, { "content-type": resultado.tipo, "content-length": st.size, "cache-control": "no-store", ...resultado.cabeceras });
      fs.createReadStream(resultado.archivo).pipe(res);
      return;
    }
    if (typeof resultado.cuerpo === "string") {
      const data = Buffer.from(resultado.cuerpo, "utf8");
      res.writeHead(resultado.estado, { "content-type": resultado.tipo, "content-length": data.length, "cache-control": "no-store", ...resultado.cabeceras });
      res.end(data);
      return;
    }
    return enviarJson(res, resultado.estado, resultado.cuerpo);
  }
  return enviarJson(res, 200, resultado ?? {});
}

async function api(app, req, res, url) {
  const metodo = req.method;
  const origen = req.headers.origin;
  const esteOrigen = `http://${req.headers.host}`;
  if (origen && origen !== esteOrigen) return enviarError(res, 403, "origen_no_permitido", "Petición rechazada: no procede de esta aplicación.");
  const sitio = req.headers["sec-fetch-site"];
  if (sitio && !["same-origin", "none"].includes(sitio)) return enviarError(res, 403, "origen_no_permitido", "Petición rechazada: no procede de esta aplicación.");
  if (!["GET", "HEAD"].includes(metodo) && req.headers["x-captao"] !== "1") {
    return enviarError(res, 403, "falta_cabecera", "Petición rechazada: falta la cabecera de seguridad de la aplicación.");
  }
  if (app.mantenimiento === "restaurando") {
    return enviarError(res, 503, "mantenimiento", "Se está restaurando una copia de seguridad. Espera unos segundos y vuelve a intentarlo.");
  }

  const ruta = url.pathname;
  let coincide = null;
  let otrosMetodos = false;
  for (const def of RUTAS) {
    const m = def.regex.exec(ruta);
    if (!m) continue;
    if (def.metodo !== (metodo === "HEAD" ? "GET" : metodo)) { otrosMetodos = true; continue; }
    coincide = { def, params: Object.fromEntries(def.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
    break;
  }
  if (!coincide) {
    return otrosMetodos
      ? enviarError(res, 405, "metodo_no_permitido", "Método no permitido para esta dirección.")
      : enviarError(res, 404, "no_encontrado", "No existe esa dirección de la API.");
  }

  const modoPedido = String(req.headers["x-captao-modo"] || url.searchParams.get("modo") || "real");
  const modo = modoPedido === "demo" ? "demo" : "real";
  const query = Object.fromEntries(url.searchParams.entries());
  const tieneCuerpo = ["POST", "PUT", "PATCH"].includes(metodo);
  const body = tieneCuerpo && !coincide.def.crudo ? await leerJson(req) : null;
  let ctxCache = null;
  const resultado = await coincide.def.manejador({
    app, modo, params: coincide.params, query, body, req,
    ctx: () => (ctxCache ??= app.ctx(modo)),
  });
  responder(res, resultado);
}

function estatico(webDir, req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) return enviarError(res, 405, "metodo_no_permitido", "Método no permitido.");
  let pedida = url.pathname === "/" ? "/index.html" : url.pathname;
  const abs = path.resolve(webDir, "." + pedida);
  if (abs !== path.resolve(webDir) && !abs.startsWith(path.resolve(webDir) + path.sep)) return enviarError(res, 403, "prohibido", "Acceso denegado.");
  let st;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (!st || !st.isFile()) return enviarError(res, 404, "no_encontrado", "No existe esa página.");
  const tipo = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "content-type": tipo, "content-length": st.size, "cache-control": "no-cache" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(abs).pipe(res);
}

export function crearServidor(app, { webDir }) {
  const server = http.createServer(async (req, res) => {
    try {
      seguridad(res);
      if (!hostPermitido(req.headers.host, req.socket.localPort)) {
        return enviarError(res, 421, "host_no_permitido", "Dirección no permitida. Abre la aplicación desde http://127.0.0.1 o http://localhost.");
      }
      let url;
      try { url = new URL(req.url, `http://${req.headers.host}`); decodeURIComponent(url.pathname); }
      catch { return enviarError(res, 400, "url_invalida", "Dirección no válida."); }
      if (url.pathname.startsWith("/api/")) await api(app, req, res, url);
      else estatico(webDir, req, res, url);
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      if (e instanceof ErrorApp) return enviarError(res, e.estado, e.codigo, e.message, e.extra);
      if (typeof e?.code === "string" && e.code.startsWith("SQLITE_CONSTRAINT")) {
        return enviarError(res, 409, "restriccion", "No se pudo guardar porque choca con otros datos (por ejemplo, un valor repetido o un registro relacionado).");
      }
      console.error("[error interno]", e);
      enviarError(res, 500, "error_interno", "Ha ocurrido un error inesperado. Tus datos no se han perdido; si se repite, avisa a quien mantiene el programa.");
    }
  });
  server.keepAliveTimeout = 5000;
  return server;
}

/** Escucha en 127.0.0.1; si el puerto está ocupado prueba los siguientes. */
export function escuchar(server, puerto, intentos = 10) {
  return new Promise((resolve, reject) => {
    let actual = puerto;
    const probar = () => {
      const alError = (e) => {
        if (e.code === "EADDRINUSE" && actual < puerto + intentos - 1) { actual++; probar(); } else reject(e);
      };
      server.once("error", alError);
      server.listen(actual, "127.0.0.1", () => { server.off("error", alError); resolve(server.address().port); });
    };
    probar();
  });
}
