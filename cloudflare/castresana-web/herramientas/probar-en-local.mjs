#!/usr/bin/env node
// ============================================================================
//  Probar castresana-web en el PC SIN Cloudflare (ni cuenta, ni instalar nada)
//
//    node cloudflare/castresana-web/herramientas/probar-en-local.mjs [--puerto 8788] [--memoria]
//
//  Arranca el mismo Worker (src/index.js) con una base de datos SQLite en
//  .local/prueba.sqlite (o en memoria con --memoria) y abre en
//  http://localhost:8788 las páginas /valora, /visitas y /panel.
//  La clave del panel es la de la variable PANEL_CLAVE o, si no hay, una
//  aleatoria NUEVA en cada arranque que se escribe en pantalla (el repositorio
//  es público: una clave fija escrita aquí la conocería cualquiera). Telegram y Turnstile, apagados salvo que
//  pongas sus variables de entorno. Solo escucha en este ordenador (127.0.0.1).
// ============================================================================
import http from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crearManejador } from "../src/index.js";
import { creaD1, creaAssets } from "./d1-local.mjs";

/**
 * Convierte una petición de Node en Request, la pasa al Worker y devuelve la
 * respuesta. `ip` simula la cabecera cf-connecting-ip que pone Cloudflare,
 * pero solo si no viene ya: detrás de un túnel de Cloudflare (link temporal)
 * llega la IP real del visitante y así los límites por IP cuentan bien.
 */
export function servidorLocal({ env, reloj, hazFetch, ip = "127.0.0.1" } = {}) {
  const manejador = crearManejador({ reloj, hazFetch });
  return http.createServer(async (req, res) => {
    try {
      const trozos = [];
      for await (const t of req) trozos.push(t);
      const cuerpo = Buffer.concat(trozos);
      const cabeceras = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") cabeceras.set(k, v);
      if (!cabeceras.has("cf-connecting-ip")) cabeceras.set("cf-connecting-ip", ip);
      const peticion = new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
        method: req.method, headers: cabeceras,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : cuerpo,
      });
      const pendientes = [];
      const r = await manejador(peticion, env, { waitUntil: (p) => pendientes.push(p) });
      const salida = {};
      r.headers.forEach((v, k) => { salida[k] = v; });
      // En http://localhost los navegadores aceptan cookies «Secure».
      res.writeHead(r.status, salida);
      res.end(Buffer.from(await r.arrayBuffer()));
      await Promise.allSettled(pendientes);
    } catch (e) {
      console.error(e);
      res.writeHead(500); res.end("Error");
    }
  });
}

/** La de PANEL_CLAVE o, si no hay, 12 bytes aleatorios (16 caracteres) nuevos. */
export const claveDelPanel = (entorno = process.env) => entorno.PANEL_CLAVE || randomBytes(12).toString("base64url");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const puerto = Number(arg("--puerto") || 8788);
  let ruta = ":memory:";
  if (!process.argv.includes("--memoria")) {
    const carpeta = new URL("../.local/", import.meta.url);
    mkdirSync(carpeta, { recursive: true });
    ruta = fileURLToPath(new URL("prueba.sqlite", carpeta));
  }
  const clave = claveDelPanel();
  const env = {
    DB: creaD1(ruta), ASSETS: creaAssets(),
    PANEL_CLAVE: clave,
    HORARIO: process.env.HORARIO, BLOQUE_MINUTOS: process.env.BLOQUE_MINUTOS, ANTELACION_HORAS: process.env.ANTELACION_HORAS,
    DIAS_VISTA: process.env.DIAS_VISTA, FESTIVOS: process.env.FESTIVOS, TELEFONO_CONTACTO: process.env.TELEFONO_CONTACTO,
    TURNSTILE_SITEKEY: process.env.TURNSTILE_SITEKEY, TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_CON_TELEFONO: process.env.TELEGRAM_CON_TELEFONO, IP_SECRETO: process.env.IP_SECRETO,
  };
  servidorLocal({ env }).listen(puerto, "127.0.0.1", () => {
    console.log(`\n  castresana-web en local → http://localhost:${puerto}`);
    console.log(`  Páginas: /valora  /visitas  /panel`);
    console.log(`  Clave del panel: ${process.env.PANEL_CLAVE ? "(la de PANEL_CLAVE)" : `${clave}   (nueva en cada arranque)`}`);
    console.log(`  Base de datos: ${ruta === ":memory:" ? "en memoria (se borra al cerrar)" : ruta}`);
    console.log("  Para las visitas, entra en el panel → Inmuebles y carga alguno.\n  Ctrl+C para parar.\n");
  });
}
