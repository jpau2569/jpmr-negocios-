#!/usr/bin/env node
// ============================================================================
//  CAPTAOPORTUNIDADES ASTURIAS — arranque.
//    node captaoportunidades/iniciar.mjs [--puerto 4380] [--datos <carpeta>] [--no-abrir]
//  Sin dependencias ni `npm install`. Necesita Node.js 22.13 o superior.
//  Escucha solo en 127.0.0.1 y guarda los datos en ~/.captaoportunidades
//  (o en la carpeta indicada con --datos o con la variable CAPTAO_DATOS).
// ============================================================================
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUERTO_BASE = 4380;

function versionNodeValida() {
  const [mayor, menor] = process.versions.node.split(".").map(Number);
  return mayor > 22 || (mayor === 22 && menor >= 13);
}

function abrirNavegador(url) {
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref(); } catch { /* sin navegador: se muestra la dirección */ }
}

/** ¿Ya hay una copia del programa funcionando en este puerto? */
function yaEstaEnMarcha(puerto) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: puerto, path: "/api/estado", timeout: 800 }, (res) => {
      let t = "";
      res.on("data", (c) => (t += c));
      res.on("end", () => { try { resolve(JSON.parse(t).app === "captaoportunidades"); } catch { resolve(false); } });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/** Arranca todo y devuelve { app, server, puerto, url, cerrar }. Lo usan también los tests. */
export async function iniciar({ puerto = PUERTO_BASE, datos, reloj, copiasAutomaticas = true } = {}) {
  const { crearApp } = await import("./nucleo/app.mjs");
  const { crearServidor, escuchar } = await import("./nucleo/servidor.mjs");
  const { copiaAutomaticaSiToca } = await import("./nucleo/copias.mjs");
  const app = crearApp({ datos, reloj });
  app.bd("real"); // abre y migra ya: si algo va mal, se sabe al arrancar
  const server = crearServidor(app, { webDir: path.join(AQUI, "web") });
  const puertoReal = await escuchar(server, puerto);
  let temporizador = null;
  if (copiasAutomaticas) {
    const intentar = () => copiaAutomaticaSiToca(app).catch((e) => console.error("[copia automática] no se pudo hacer:", e.message));
    await intentar();
    temporizador = setInterval(intentar, 6 * 3600 * 1000);
    temporizador.unref();
  }
  return {
    app, server, puerto: puertoReal, url: `http://127.0.0.1:${puertoReal}/`,
    async cerrar() {
      if (temporizador) clearInterval(temporizador);
      await new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); });
      app.cerrar();
    },
  };
}

async function principal() {
  if (!versionNodeValida()) {
    console.error(`\nEste programa necesita Node.js 22.13 o superior (tienes ${process.versions.node}).\nDescarga la versión actual en https://nodejs.org y vuelve a abrirlo.\n`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const val = (nombre) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : undefined; };
  const puerto = Number(val("--puerto")) || PUERTO_BASE;
  const abrir = !args.includes("--no-abrir");

  for (let p = puerto; p < puerto + 10; p++) {
    if (await yaEstaEnMarcha(p)) {
      console.log(`\nCAPTAOPORTUNIDADES ya está en marcha en http://127.0.0.1:${p}/ — la abro de nuevo.\n`);
      if (abrir) abrirNavegador(`http://127.0.0.1:${p}/`);
      return;
    }
  }
  const { carpetaDatosPorDefecto } = await import("./nucleo/app.mjs");
  const datos = val("--datos") ? path.resolve(val("--datos")) : carpetaDatosPorDefecto();
  let marcha;
  try { marcha = await iniciar({ puerto, datos }); }
  catch (e) {
    console.error(`\nNo se pudo arrancar: ${e.message}\n`);
    process.exit(1);
  }
  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  CAPTAOPORTUNIDADES ASTURIAS · Fase 1                    │
  └──────────────────────────────────────────────────────────┘
  Abre:            ${marcha.url}
  Tus datos están en: ${datos}
  (Solo accesible desde este ordenador. Para cerrar: Ctrl+C)
`);
  if (abrir) abrirNavegador(marcha.url);
  const salir = async () => { await marcha.cerrar(); process.exit(0); };
  process.on("SIGINT", salir);
  process.on("SIGTERM", salir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  principal().catch((e) => { console.error(e); process.exit(1); });
}
