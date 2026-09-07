// ============================================================================
//  Fotos Fáciles — servidor local
// ----------------------------------------------------------------------------
//  Todo ocurre en el ordenador del usuario: ninguna foto sale a internet. El
//  servidor sirve tres pantallas (ordenador, móvil y álbum compartido) y una
//  API pequeña. Sin dependencias: solo módulos de Node.
// ============================================================================
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { leerConfig, guardarConfig } from "./config.mjs";
import { mejorDireccion, direccionesLocales } from "./red.mjs";
import { svg as qrSvg } from "./qr.mjs";
import { abrirAlmacen } from "./almacen.mjs";
import { Subidas } from "./subidas.mjs";
import { Seguridad, ipDe } from "./seguridad.mjs";
import { Albumes, enlacesDe } from "./compartir.mjs";
import { listaUnidades, escanea, carpetasDelUsuario, carpetasConFotos } from "./dispositivos.mjs";
import { listaCarpeta, copiarArchivos, crearCarpeta } from "./explorador.mjs";
import * as wpd from "./wpd.mjs";
import { nuevaTarea, verTarea, cancelaTarea, terminaTarea } from "./tareas.mjs";
import { miniaturaIncrustada } from "./exif.mjs";
import {
  leeCartera, guardaFotoEscaparate, publicaEnEscaparate, preparaLimpiaFotos,
  abreCarpeta, localizaRepo, publicable,
} from "./ecosistema.mjs";
import { mime, dentroDe, esFoto, esMedia, tamanoLegible } from "./util.mjs";
import { recursoEmbebido, empaquetado } from "./recursos.mjs";

export const VERSION = "1.1.0";
// Al empaquetar en un ejecutable único no hay `import.meta.url`: en ese caso
// las pantallas viajan incrustadas y esta ruta no llega a usarse.
const AQUI = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); }
  catch { return path.dirname(process.execPath); }
})();
const WEB = path.join(AQUI, "..", "web");
const MAX_JSON = 4 * 1024 * 1024;

const SVG_VIDEO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="6" fill="#1d2330"/><path d="M26 20l20 12-20 12z" fill="#7cc4ff"/></svg>`;

// --- Ayudas HTTP -------------------------------------------------------------
const json = (res, codigo, cuerpo) => {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(texto),
    "cache-control": "no-store",
  });
  res.end(texto);
};

function leeJson(req) {
  return new Promise((resolve, reject) => {
    let datos = "", total = 0;
    req.on("data", (t) => {
      total += t.length;
      if (total > MAX_JSON) { reject(new Error("Petición demasiado grande")); req.destroy(); return; }
      datos += t;
    });
    req.on("end", () => { try { resolve(datos ? JSON.parse(datos) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const MAX_FOTO = 12 * 1024 * 1024;

/** Lee un cuerpo binario entero en memoria (fotos ya reducidas, no vídeos). */
function leeBinario(req, tope = MAX_FOTO) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let total = 0;
    req.on("data", (t) => {
      total += t.length;
      if (total > tope) { reject(new Error("La foto es demasiado grande")); req.destroy(); return; }
      trozos.push(t);
    });
    req.on("end", () => resolve(Buffer.concat(trozos)));
    req.on("error", reject);
  });
}

/** Envía un archivo del disco con soporte de rangos (necesario para vídeo). */
async function enviaArchivo(req, res, ruta, { descarga = false } = {}) {
  let info;
  try { info = await fsp.stat(ruta); } catch { return json(res, 404, { error: "No encontrado" }); }
  if (!info.isFile()) return json(res, 404, { error: "No encontrado" });

  const cabeceras = {
    "content-type": mime(ruta),
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=60",
    "last-modified": info.mtime.toUTCString(),
  };
  if (descarga) cabeceras["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(ruta))}`;

  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (rango) {
    const inicio = rango[1] ? Number(rango[1]) : Math.max(0, info.size - Number(rango[2] || 0));
    const fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), info.size - 1) : info.size - 1;
    if (isNaN(inicio) || inicio >= info.size) {
      res.writeHead(416, { "content-range": `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, {
      ...cabeceras,
      "content-range": `bytes ${inicio}-${fin}/${info.size}`,
      "content-length": fin - inicio + 1,
    });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(ruta, { start: inicio, end: fin }).pipe(res);
  }

  res.writeHead(200, { ...cabeceras, "content-length": info.size });
  if (req.method === "HEAD") return res.end();
  return fs.createReadStream(ruta).pipe(res);
}

async function enviaEstatico(res, nombre) {
  const incrustado = recursoEmbebido(nombre);
  if (incrustado) {
    res.writeHead(200, { "content-type": mime(nombre), "cache-control": "no-cache", "content-length": incrustado.length });
    return res.end(incrustado);
  }
  const ruta = path.join(WEB, nombre);
  if (!dentroDe(WEB, ruta)) return json(res, 403, { error: "Prohibido" });
  try {
    const cuerpo = await fsp.readFile(ruta);
    res.writeHead(200, { "content-type": mime(ruta), "cache-control": "no-cache", "content-length": cuerpo.length });
    res.end(cuerpo);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
}

// --- El servidor -------------------------------------------------------------
export async function crearServidor(opciones = {}) {
  const config = { ...leerConfig(), ...opciones.config };
  await fsp.mkdir(config.carpetaDestino, { recursive: true });

  const almacen = await abrirAlmacen(config.carpetaDestino);
  const subidas = await new Subidas(config.carpetaDestino).preparar();
  const seguridad = new Seguridad({ pedirPin: config.pedirPin });
  const albumes = await new Albumes(config.carpetaDestino).preparar(seguridad);

  const estado = { config, almacen, subidas, seguridad, albumes, arrancado: Date.now(), ultimaSubida: 0 };

  /** Raíces de las que se puede leer. Es una app local, pero sin barra libre. */
  function raicesPermitidas() {
    const raices = [os.homedir(), estado.config.carpetaDestino, os.tmpdir()];
    if (process.platform === "win32") for (let c = 65; c <= 90; c++) raices.push(`${String.fromCharCode(c)}:\\`);
    else raices.push("/Volumes", "/media", "/run/media", "/mnt");
    return raices;
  }
  const rutaPermitida = (ruta) => raicesPermitidas().some((r) => dentroDe(r, ruta));

  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const ruta = decodeURIComponent(url.pathname);
    try {
      await enruta(req, res, url, ruta);
    } catch (e) {
      if (!res.headersSent) json(res, e.codigo || 500, { error: e.message || "Error interno" });
      else res.end();
    }
  });

  async function enruta(req, res, url, ruta) {
    // ---- Páginas ------------------------------------------------------------
    if (ruta === "/" || ruta === "/index.html") return enviaEstatico(res, "pc.html");
    if (ruta === "/m" || ruta === "/movil") return enviaEstatico(res, "movil.html");
    if (/^\/a\/[^/]+$/.test(ruta)) return enviaEstatico(res, "album.html");
    if (ruta.startsWith("/web/")) return enviaEstatico(res, ruta.slice(5));
    if (ruta === "/favicon.ico") return enviaEstatico(res, "icono.svg");

    // ---- Álbumes compartidos (token propio, solo lectura) -------------------
    const mAlbum = /^\/api\/album\/([A-Za-z0-9_-]+)$/.exec(ruta);
    if (mAlbum) {
      const id = seguridad.albumDeToken(mAlbum[1]);
      const contenido = id && estado.albumes.contenido(id);
      if (!contenido) return json(res, 404, { error: "Este enlace ha caducado o ya no existe" });
      await estado.albumes.apuntaVisita(id);
      return json(res, 200, {
        nombre: contenido.nombre, caduca: contenido.caduca,
        archivos: contenido.archivos.map((a) => ({ indice: a.indice, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano })),
      });
    }
    const mArchivoAlbum = /^\/a\/([A-Za-z0-9_-]+)\/(f|mini)\/(\d+)$/.exec(ruta);
    if (mArchivoAlbum) {
      const id = seguridad.albumDeToken(mArchivoAlbum[1]);
      const contenido = id && estado.albumes.contenido(id);
      const ficha = contenido?.archivos[Number(mArchivoAlbum[3])];
      if (!ficha) return json(res, 404, { error: "No encontrado" });
      if (mArchivoAlbum[2] === "mini") return enviaMiniatura(res, ficha.ruta);
      return enviaArchivo(req, res, ficha.ruta, { descarga: url.searchParams.get("descargar") === "1" });
    }

    // ---- Entrada (sin token) ------------------------------------------------
    if (ruta === "/api/estado-publico") {
      return json(res, 200, {
        app: "Fotos Fáciles", version: VERSION,
        pidePin: true, local: seguridad.esLocal(req),
        destino: path.basename(estado.config.carpetaDestino),
      });
    }
    if (ruta === "/api/entrar" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const intento = seguridad.entrarConPin(ipDe(req), String(cuerpo.pin || ""));
      if (!intento.ok) {
        return json(res, 429, {
          error: intento.espera
            ? `Demasiados intentos. Espera ${intento.espera} segundos.`
            : `PIN incorrecto. Te quedan ${intento.restantes} intentos.`,
        });
      }
      res.setHeader("set-cookie", `fotos_token=${encodeURIComponent(intento.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return json(res, 200, { token: intento.token });
    }

    // ---- A partir de aquí hace falta token ---------------------------------
    if (!ruta.startsWith("/api/")) return json(res, 404, { error: "No encontrado" });
    if (!seguridad.autorizada(req, url)) return json(res, 401, { error: "Escanea el QR o escribe el PIN" });

    if (ruta === "/api/estado") return json(res, 200, await construyeEstado(req));

    if (ruta === "/api/config" && req.method === "POST") {
      const cambios = await leeJson(req);
      const permitidos = ["carpetaDestino", "organizarPor", "inmueble", "renombrar", "pedirPin", "urlPublica", "abrirNavegador"];
      const limpio = Object.fromEntries(Object.entries(cambios).filter(([k]) => permitidos.includes(k)));
      estado.config = guardarConfig(limpio);
      seguridad.pedirPin = estado.config.pedirPin;
      if (limpio.carpetaDestino) {
        await fsp.mkdir(estado.config.carpetaDestino, { recursive: true });
        estado.almacen = await abrirAlmacen(estado.config.carpetaDestino);
        estado.subidas = await new Subidas(estado.config.carpetaDestino).preparar();
        estado.albumes = await new Albumes(estado.config.carpetaDestino).preparar(seguridad);
      }
      return json(res, 200, await construyeEstado(req));
    }

    // ---- Modo B: subidas desde el móvil ------------------------------------
    if (ruta === "/api/ya-tengo" && req.method === "POST") {
      const { archivos = [] } = await leeJson(req);
      return json(res, 200, {
        conocidos: archivos.map((a) => !!estado.almacen.yaTengoHuella(a.nombre, a.tamano)),
      });
    }

    if (ruta === "/api/subida/abrir" && req.method === "POST") {
      const meta = await leeJson(req);
      return json(res, 200, await estado.subidas.abrir({ ...meta, sesion: meta.sesion || ipDe(req) }));
    }

    const mSubir = /^\/api\/subida\/([a-f0-9]{20})$/.exec(ruta);
    if (mSubir && (req.method === "PUT" || req.method === "PATCH")) {
      const desde = Number(url.searchParams.get("desde") || 0);
      try {
        const avance = await estado.subidas.escribir(mSubir[1], desde, req);
        estado.ultimaSubida = Date.now();
        return json(res, 200, avance);
      } catch (e) {
        return json(res, e.codigo || 500, { error: e.message, recibido: e.recibido });
      }
    }
    if (mSubir && req.method === "DELETE") {
      await estado.subidas.descartar(mSubir[1]);
      return json(res, 200, { ok: true });
    }

    const mCerrar = /^\/api\/subida\/([a-f0-9]{20})\/cerrar$/.exec(ruta);
    if (mCerrar && req.method === "POST") {
      const cuerpo = await leeJson(req).catch(() => ({}));
      try {
        const { ruta: parcial, ficha } = await estado.subidas.cerrar(mCerrar[1]);
        // El móvil puede pedir una carpeta concreta del PC. Si lo hace, se
        // respeta el nombre original: es lo que espera quien elige la carpeta.
        let carpetaFija = null;
        if (cuerpo.carpeta) {
          carpetaFija = path.resolve(String(cuerpo.carpeta));
          if (!rutaPermitida(carpetaFija)) return json(res, 403, { error: "Carpeta no permitida" });
        }
        const resultado = await estado.almacen.incorporar(parcial, {
          nombre: ficha.nombre, origen: "movil", mover: true,
          organizarPor: cuerpo.organizarPor || estado.config.organizarPor,
          inmueble: cuerpo.inmueble ?? estado.config.inmueble,
          renombrar: carpetaFija ? false : estado.config.renombrar,
          fechaCliente: ficha.fechaMod,
          carpetaFija,
        });
        await estado.subidas.descartar(mCerrar[1]);
        return json(res, 200, {
          estado: resultado.estado,
          nombre: path.basename(resultado.ruta),
          ruta: resultado.ruta,
        });
      } catch (e) {
        return json(res, e.codigo || 500, { error: e.message, recibido: e.recibido });
      }
    }

    if (ruta === "/api/subida/resumen" && req.method === "POST") {
      const { fotos = 0, videos = 0, bytes = 0, duplicados = 0 } = await leeJson(req);
      estado.almacen.apunta({ tipo: "movil", fotos, videos, bytes, duplicados, origen: ipDe(req) });
      return json(res, 200, { ok: true });
    }

    // ---- Galería, archivos e historial --------------------------------------
    if (ruta === "/api/galeria") {
      const limite = Math.min(500, Number(url.searchParams.get("limite")) || 60);
      const desde = Math.max(0, Number(url.searchParams.get("desde")) || 0);
      return json(res, 200, estado.almacen.galeria({ limite, desde }));
    }
    if (ruta === "/api/historial") {
      return json(res, 200, { historial: estado.almacen.historial.slice(-80).reverse() });
    }
    if (ruta === "/api/miniatura") {
      const destino = path.resolve(url.searchParams.get("ruta") || "");
      if (!rutaPermitida(destino)) return json(res, 403, { error: "Ruta no permitida" });
      return enviaMiniatura(res, destino);
    }
    if (ruta === "/api/archivo") {
      const destino = path.resolve(url.searchParams.get("ruta") || "");
      if (!rutaPermitida(destino)) return json(res, 403, { error: "Ruta no permitida" });
      return enviaArchivo(req, res, destino, { descarga: url.searchParams.get("descargar") === "1" });
    }

    // ---- Modo A: unidades por cable ----------------------------------------
    if (ruta === "/api/dispositivos") {
      const [unidades, portatiles] = await Promise.all([listaUnidades(), wpd.dispositivos()]);
      return json(res, 200, {
        unidades,
        portatiles,
        carpetas: carpetasDelUsuario(),
        aviso: process.platform === "win32"
          ? "El iPhone se conecta por MTP y no tiene letra de unidad. Aquí abajo aparece como «dispositivo portátil» (experimental). Si da guerra, el camino seguro y más rápido es el modo WiFi con QR."
          : null,
      });
    }
    if (ruta === "/api/portatil/explorar") {
      if (!wpd.disponible()) return json(res, 400, { error: "Los dispositivos portátiles solo se leen en Windows" });
      let camino = [];
      try { camino = JSON.parse(url.searchParams.get("camino") || "[]"); } catch { camino = []; }
      if (!Array.isArray(camino)) return json(res, 400, { error: "Camino no válido" });
      const contenido = await wpd.explora(camino.map(String));
      return json(res, 200, {
        camino,
        ...contenido,
        archivos: contenido.archivos.map((a) => ({
          ...a, tipo: esFoto(a.nombre) ? "foto" : "video",
          nuevo: !estado.almacen.yaTengoHuella(a.nombre, a.tamano),
        })).filter((a) => esMedia(a.nombre)),
      });
    }
    if (ruta === "/api/portatil/importar" && req.method === "POST") {
      if (!wpd.disponible()) return json(res, 400, { error: "Los dispositivos portátiles solo se leen en Windows" });
      const cuerpo = await leeJson(req);
      const camino = Array.isArray(cuerpo.camino) ? cuerpo.camino.map(String) : [];
      const nombres = Array.isArray(cuerpo.nombres) ? cuerpo.nombres.map(String) : [];
      if (!nombres.length) return json(res, 400, { error: "No has elegido ninguna foto" });
      const tarea = nuevaTarea("Importando del dispositivo portátil", nombres.length);
      importaPortatil(tarea, camino, nombres, cuerpo).catch((e) => terminaTarea(tarea, { error: e.message }));
      return json(res, 200, { tarea: tarea.id });
    }
    if (ruta === "/api/dispositivo/escanear") {
      const raiz = path.resolve(url.searchParams.get("ruta") || "");
      if (!rutaPermitida(raiz)) return json(res, 403, { error: "Ruta no permitida" });
      const resultado = await escanea(raiz, {
        yaEsta: (nombre, tamano) => estado.almacen.yaTengoHuella(nombre, tamano),
      });
      return json(res, 200, { ...resultado, carpetasFoto: await carpetasConFotos(raiz) });
    }
    if (ruta === "/api/dispositivo/importar" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const archivos = (cuerpo.archivos || []).map((r) => path.resolve(String(r))).filter(rutaPermitida);
      if (!archivos.length) return json(res, 400, { error: "No has elegido ninguna foto" });
      const tarea = nuevaTarea("Importando desde el dispositivo", archivos.length);
      importaEnSegundoPlano(tarea, archivos, cuerpo).catch((e) => terminaTarea(tarea, { error: e.message }));
      return json(res, 200, { tarea: tarea.id });
    }

    // ---- Modo C: explorar, copiar y pegar -----------------------------------
    if (ruta === "/api/explorar") {
      const destino = path.resolve(url.searchParams.get("ruta") || estado.config.carpetaDestino);
      if (!rutaPermitida(destino)) return json(res, 403, { error: "Ruta no permitida" });
      return json(res, 200, await listaCarpeta(destino));
    }
    if (ruta === "/api/copiar" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const destino = path.resolve(String(cuerpo.destino || ""));
      const archivos = (cuerpo.archivos || []).map((r) => path.resolve(String(r))).filter(rutaPermitida);
      if (!rutaPermitida(destino)) return json(res, 403, { error: "Carpeta de destino no permitida" });
      if (!archivos.length) return json(res, 400, { error: "No has copiado ninguna foto" });
      const tarea = nuevaTarea(cuerpo.mover ? "Moviendo archivos" : "Pegando archivos", archivos.length);
      pegaEnSegundoPlano(tarea, archivos, destino, !!cuerpo.mover).catch((e) => terminaTarea(tarea, { error: e.message }));
      return json(res, 200, { tarea: tarea.id });
    }
    if (ruta === "/api/carpeta" && req.method === "POST") {
      const { padre, nombre } = await leeJson(req);
      const base = path.resolve(String(padre || estado.config.carpetaDestino));
      if (!rutaPermitida(base)) return json(res, 403, { error: "Ruta no permitida" });
      return json(res, 200, { ruta: await crearCarpeta(base, nombre) });
    }

    // ---- Tareas -------------------------------------------------------------
    const mTarea = /^\/api\/tarea\/([a-f0-9]+)$/.exec(ruta);
    if (mTarea) {
      const tarea = verTarea(mTarea[1]);
      return tarea ? json(res, 200, tarea) : json(res, 404, { error: "Tarea desconocida" });
    }
    const mCancelar = /^\/api\/tarea\/([a-f0-9]+)\/cancelar$/.exec(ruta);
    if (mCancelar && req.method === "POST") return json(res, 200, { ok: cancelaTarea(mCancelar[1]) });

    // ---- Puentes con el ecosistema (escaparate 3D y LimpiaFotos) -----------
    if (ruta === "/api/inmuebles") {
      const cartera = await leeCartera();
      return json(res, 200, { ...cartera, actual: estado.config.inmueble || "" });
    }
    if (ruta === "/api/escaparate/foto" && (req.method === "PUT" || req.method === "POST")) {
      const datos = await leeBinario(req);
      if (!datos.length) return json(res, 400, { error: "No ha llegado la foto" });
      const relativa = await guardaFotoEscaparate({
        referencia: url.searchParams.get("referencia") || "",
        titulo: url.searchParams.get("titulo") || "",
        extensionArchivo: url.searchParams.get("ext") || ".jpg",
        datos,
      });
      return json(res, 200, { relativa });
    }
    if (ruta === "/api/escaparate/publicar" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const resultado = await publicaEnEscaparate({
        referencia: cuerpo.referencia, titulo: cuerpo.titulo, relativas: cuerpo.relativas || [],
      });
      estado.almacen.apunta({
        tipo: "escaparate", nombre: resultado.titulo, fotos: (cuerpo.relativas || []).length,
      });
      return json(res, 200, resultado);
    }
    if (ruta === "/api/limpiafotos" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const archivos = (cuerpo.archivos || []).map((r) => path.resolve(String(r))).filter(rutaPermitida);
      const r = await preparaLimpiaFotos({
        carpetaBase: estado.config.carpetaDestino,
        etiqueta: cuerpo.etiqueta || estado.config.inmueble || "fotos",
        archivos,
      });
      if (cuerpo.abrir !== false) abreCarpeta(r.carpeta);
      estado.almacen.apunta({ tipo: "limpiafotos", nombre: cuerpo.etiqueta || "", fotos: r.copiadas });
      return json(res, 200, r);
    }
    if (ruta === "/api/abrir-carpeta" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const destino = path.resolve(String(cuerpo.ruta || estado.config.carpetaDestino));
      if (!rutaPermitida(destino)) return json(res, 403, { error: "Ruta no permitida" });
      await abreCarpeta(destino);
      return json(res, 200, { ok: true });
    }

    // ---- Compartir ----------------------------------------------------------
    if (ruta === "/api/albumes" && req.method === "GET") {
      const ip = mejorDireccion();
      return json(res, 200, {
        albumes: estado.albumes.vivos().map((a) => ({
          ...a, ...enlacesDe(a, { ip, puerto: estado.config.puerto, urlPublica: estado.config.urlPublica }),
        })),
        hayTunel: !!estado.config.urlPublica,
      });
    }
    if (ruta === "/api/albumes" && req.method === "POST") {
      const cuerpo = await leeJson(req);
      const archivos = (cuerpo.archivos || []).map((r) => path.resolve(String(r))).filter(rutaPermitida);
      const album = await estado.albumes.crear({
        nombre: cuerpo.nombre, archivos, dias: Number(cuerpo.dias) || 7, seguridad,
      });
      estado.almacen.apunta({ tipo: "enlace", nombre: album.nombre, fotos: album.archivos.length });
      return json(res, 200, {
        ...album,
        ...enlacesDe(album, { ip: mejorDireccion(), puerto: estado.config.puerto, urlPublica: estado.config.urlPublica }),
      });
    }
    const mBorrarAlbum = /^\/api\/albumes\/([a-f0-9]+)$/.exec(ruta);
    if (mBorrarAlbum && req.method === "DELETE") {
      await estado.albumes.borrar(mBorrarAlbum[1]);
      return json(res, 200, { ok: true });
    }

    if (ruta === "/api/apagar" && req.method === "POST") {
      json(res, 200, { ok: true });
      setTimeout(() => { estado.almacen.guardaAhora(); servidor.close(); process.exit(0); }, 200);
      return;
    }

    return json(res, 404, { error: "No encontrado" });
  }

  // --- Piezas auxiliares -----------------------------------------------------
  async function enviaMiniatura(res, destino) {
    if (!esFoto(destino)) {
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "private, max-age=600" });
      return res.end(SVG_VIDEO);
    }
    const mini = await miniaturaIncrustada(destino);
    if (mini) {
      res.writeHead(200, { "content-type": "image/jpeg", "content-length": mini.length, "cache-control": "private, max-age=600" });
      return res.end(mini);
    }
    // Sin miniatura incrustada se manda el original y lo escala el navegador.
    return enviaArchivo({ method: "GET", headers: {} }, res, destino);
  }

  async function construyeEstado(req) {
    const ip = mejorDireccion();
    const urlMovil = `http://${ip}:${estado.config.puerto}/m#t=${encodeURIComponent(seguridad.token)}`;
    const local = seguridad.esLocal(req);
    return {
      app: "Fotos Fáciles", version: VERSION,
      config: estado.config,
      red: { ip, puerto: estado.config.puerto, direcciones: direccionesLocales() },
      urlMovil,
      qr: qrSvg(urlMovil, { nivel: "M", margen: 2 }),
      pin: local ? seguridad.pin : null,
      token: local ? seguridad.token : null,
      resumen: estado.almacen.resumen(),
      resumenTexto: (() => {
        const r = estado.almacen.resumen();
        return `${r.fotos} fotos y ${r.videos} vídeos · ${tamanoLegible(r.bytes)}`;
      })(),
      destino: estado.config.carpetaDestino,
      casa: os.homedir(),
      repo: localizaRepo(),
      empaquetado: empaquetado(),
      extensionesPublicables: [".jpg", ".jpeg", ".png", ".webp"],
      plataforma: process.platform,
    };
  }

  async function importaEnSegundoPlano(tarea, archivos, opciones) {
    for (const origen of archivos) {
      if (tarea.cancelada) break;
      tarea.archivo = path.basename(origen);
      try {
        const r = await estado.almacen.incorporar(origen, {
          nombre: path.basename(origen), origen: "cable",
          organizarPor: estado.config.organizarPor,
          inmueble: opciones.inmueble ?? estado.config.inmueble,
          renombrar: estado.config.renombrar,
        });
        if (r.estado === "duplicado") tarea.duplicados++;
        else { tarea.copiados++; tarea.bytes += r.ficha.tamano; }
      } catch (e) {
        tarea.fallidos++;
        tarea.detalles.push({ nombre: path.basename(origen), error: e.message });
      }
      tarea.hechos++;
    }
    estado.almacen.guardaAhora();
    estado.almacen.apunta({
      tipo: "cable", fotos: tarea.copiados, duplicados: tarea.duplicados,
      fallidos: tarea.fallidos, bytes: tarea.bytes,
    });
    terminaTarea(tarea);
  }

  /**
   * MTP no deja leer un archivo en streaming: primero se copia a una carpeta
   * temporal del PC (en tandas, para ir enseñando avance) y de ahí al almacén.
   */
  async function importaPortatil(tarea, camino, nombres, opciones) {
    const temporal = wpd.carpetaTemporal();
    await fsp.mkdir(temporal, { recursive: true });
    const TANDA = 10;
    try {
      for (let i = 0; i < nombres.length && !tarea.cancelada; i += TANDA) {
        const tanda = nombres.slice(i, i + TANDA);
        tarea.archivo = tanda[0];
        let copiados = [];
        try { copiados = await wpd.copia(camino, tanda, temporal); }
        catch (e) {
          tarea.fallidos += tanda.length;
          tarea.hechos += tanda.length;
          tarea.detalles.push({ nombre: tanda[0], error: e.message });
          continue;
        }
        for (const temporalRuta of copiados) {
          try {
            const r = await estado.almacen.incorporar(temporalRuta, {
              nombre: path.basename(temporalRuta), origen: "iphone-cable", mover: true,
              organizarPor: estado.config.organizarPor,
              inmueble: opciones.inmueble ?? estado.config.inmueble,
              renombrar: estado.config.renombrar,
            });
            if (r.estado === "duplicado") tarea.duplicados++;
            else { tarea.copiados++; tarea.bytes += r.ficha.tamano; }
          } catch (e) {
            tarea.fallidos++;
            tarea.detalles.push({ nombre: path.basename(temporalRuta), error: e.message });
          }
          tarea.hechos++;
        }
        tarea.hechos = Math.max(tarea.hechos, Math.min(nombres.length, i + tanda.length));
      }
    } finally {
      await fsp.rm(temporal, { recursive: true, force: true }).catch(() => {});
    }
    estado.almacen.guardaAhora();
    estado.almacen.apunta({
      tipo: "iphone-cable", fotos: tarea.copiados, duplicados: tarea.duplicados,
      fallidos: tarea.fallidos, bytes: tarea.bytes,
    });
    terminaTarea(tarea);
  }

  async function pegaEnSegundoPlano(tarea, archivos, destino, mover) {
    const dentroDelAlmacen = dentroDe(estado.config.carpetaDestino, destino);
    const resumen = await copiarArchivos(archivos, destino, {
      mover,
      cancelada: () => tarea.cancelada,
      alAvanzar: (r) => {
        tarea.hechos = r.copiados + r.duplicados + r.fallidos;
        tarea.copiados = r.copiados; tarea.duplicados = r.duplicados;
        tarea.fallidos = r.fallidos; tarea.bytes = r.bytes;
      },
      // Si se pega dentro de la carpeta de la app, se apunta en el índice (sin
      // volver a copiarlo) para que el móvil no lo mande otra vez como nuevo.
      registrar: dentroDelAlmacen
        ? (rutaFinal) => estado.almacen.registrarExistente(rutaFinal, "pegado")
        : null,
    });
    tarea.detalles = resumen.detalles.slice(-50);
    estado.almacen.apunta({
      tipo: mover ? "mover" : "pegar", fotos: resumen.copiados,
      duplicados: resumen.duplicados, fallidos: resumen.fallidos, bytes: resumen.bytes, destino,
    });
    terminaTarea(tarea);
  }

  return { servidor, estado, seguridad };
}

/** Arranca escuchando; si el puerto está ocupado prueba los siguientes. */
export async function arranca({ puerto, intentos = 12, config } = {}) {
  const cfg = { ...leerConfig(), ...config };
  const { servidor, estado, seguridad } = await crearServidor({ config: cfg });
  let puertoActual = Number(puerto) || cfg.puerto;

  for (let i = 0; i < intentos; i++) {
    try {
      await new Promise((resolve, reject) => {
        const falla = (e) => { servidor.off("listening", ok); reject(e); };
        const ok = () => { servidor.off("error", falla); resolve(); };
        servidor.once("error", falla);
        servidor.once("listening", ok);
        servidor.listen(puertoActual, "0.0.0.0");
      });
      // Con puerto 0 el sistema elige uno libre: hay que preguntarle cuál.
      puertoActual = servidor.address()?.port || puertoActual;
      estado.config.puerto = puertoActual;
      return { servidor, estado, seguridad, puerto: puertoActual };
    } catch (e) {
      if (e.code !== "EADDRINUSE") throw e;
      puertoActual = puertoActual === 0 ? 0 : puertoActual + 1;
    }
  }
  throw new Error(`No hay ningún puerto libre a partir del ${puerto || cfg.puerto}`);
}
