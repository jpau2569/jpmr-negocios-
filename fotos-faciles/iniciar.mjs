#!/usr/bin/env node
// ============================================================================
//  Fotos Fáciles — arranque
// ----------------------------------------------------------------------------
//  Uso:
//    node fotos-faciles/iniciar.mjs
//    node fotos-faciles/iniciar.mjs --puerto 5000 --destino "D:\Fotos" --sin-navegador
// ============================================================================
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { arranca, VERSION } from "./nucleo/servidor.mjs";
import { leerConfig, guardarConfig } from "./nucleo/config.mjs";
import { direccionesLocales } from "./nucleo/red.mjs";
import { ascii } from "./nucleo/qr.mjs";
import { cerrarAlmacenes } from "./nucleo/almacen.mjs";

function argumentos(lista) {
  const salida = {};
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a === "--puerto") salida.puerto = Number(lista[++i]);
    else if (a === "--destino") salida.carpetaDestino = lista[++i];
    else if (a === "--sin-navegador") salida.abrirNavegador = false;
    else if (a === "--sin-pin") salida.pedirPin = false;
    else if (a === "--pin") salida.pin = lista[++i];
    else if (a === "--enlace-fijo") salida.enlaceFijo = true;
    else if (a === "--ayuda" || a === "-h") salida.ayuda = true;
  }
  return salida;
}

function abreNavegador(url) {
  const [orden, args] = process.platform === "win32"
    ? ["cmd.exe", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  execFile(orden, args, () => { /* si no se puede abrir, el usuario copia la URL */ });
}

const AZUL = "\x1b[36m", VERDE = "\x1b[32m", GRIS = "\x1b[90m", FUERTE = "\x1b[1m", FIN = "\x1b[0m";

/** ¿Hay ya un Fotos Fáciles escuchando en ese puerto de este ordenador? */
async function estaEnMarcha(puerto) {
  try {
    const control = AbortSignal.timeout(1200);
    const r = await fetch(`http://127.0.0.1:${puerto}/api/estado-publico`, { signal: control });
    if (!r.ok) return false;
    return (await r.json()).app === "Fotos Fáciles";
  } catch { return false; }
}

export async function principal() {
  const args = argumentos(process.argv.slice(2));
  if (args.ayuda) {
    console.log(`Fotos Fáciles ${VERSION}
  --puerto <n>       puerto del servidor (por defecto 4321)
  --destino <ruta>   carpeta donde se guardan las fotos
  --sin-navegador    no abrir el navegador al arrancar
  --sin-pin          no pedir PIN en este ordenador (red de confianza)
  --pin <numero>     PIN fijo de 4 a 8 cifras (por defecto, uno nuevo cada vez)
  --enlace-fijo      que el QR y el enlace del móvil no cambien al reiniciar`);
    return;
  }

  const cambios = {};
  if (args.carpetaDestino) cambios.carpetaDestino = args.carpetaDestino;
  if (args.puerto) cambios.puerto = args.puerto;
  if (args.pedirPin === false) cambios.pedirPin = false;
  if (args.pin !== undefined) cambios.pin = args.pin;
  if (args.enlaceFijo) cambios.enlaceFijo = true;
  if (Object.keys(cambios).length) guardarConfig(cambios);
  const config = leerConfig();

  // Si ya hay una copia en marcha (por ejemplo, la que arranca sola con
  // Windows), no se levanta una segunda en otro puerto: se avisa y se abre.
  const yaEnMarcha = await estaEnMarcha(config.puerto);
  if (yaEnMarcha) {
    const url = `http://localhost:${config.puerto}/`;
    console.log(`\n${VERDE}✔  Fotos Fáciles ya está funcionando${FIN} en ${AZUL}${url}${FIN}`);
    console.log(`${GRIS}   (se abre la pantalla; para apagarlo, pulsa «Salir» ahí dentro)${FIN}\n`);
    if (args.abrirNavegador !== false) abreNavegador(url);
    return;
  }

  const { estado, seguridad, puerto } = await arranca({ puerto: args.puerto || config.puerto });
  const direcciones = direccionesLocales();
  const ip = direcciones[0]?.ip;
  const urlPc = `http://localhost:${puerto}/`;
  const urlMovil = ip ? `http://${ip}:${puerto}/m#t=${encodeURIComponent(seguridad.token)}` : null;

  console.log(`\n${FUERTE}📷  Fotos Fáciles — Pasar a Ordenador${FIN}  ${GRIS}v${VERSION}${FIN}`);
  console.log(`${GRIS}────────────────────────────────────────────────────${FIN}`);
  console.log(`  Carpeta de destino : ${AZUL}${estado.config.carpetaDestino}${FIN}`);
  console.log(`  Pantalla del PC    : ${AZUL}${urlPc}${FIN}`);
  if (urlMovil) {
    console.log(`  Desde el móvil     : ${AZUL}http://${ip}:${puerto}/m${FIN}`);
    console.log(`  PIN ${(seguridad.pinFijo ? "fijo" : "de esta sesión").padEnd(14)} : ${VERDE}${FUERTE}${seguridad.pin}${FIN}`);
    if (seguridad.tokenFijo) console.log(`  ${GRIS}El enlace del móvil no cambia aunque reinicies.${FIN}`);
    console.log(`\n${GRIS}  Escanea este QR con la cámara del móvil (misma WiFi):${FIN}\n`);
    console.log(ascii(urlMovil, { nivel: "M", margen: 2 }));
  } else {
    console.log(`\n  ⚠️  No se ha encontrado ninguna red local. Conecta el PC a la WiFi\n     y vuelve a arrancar para poder usar el modo sin cables.`);
  }
  console.log(`\n${GRIS}  Para cerrar: Ctrl+C  ·  Las fotos NO salen de este ordenador.${FIN}\n`);

  if (estado.config.abrirNavegador && args.abrirNavegador !== false) abreNavegador(urlPc);

  const adios = () => { cerrarAlmacenes(); console.log("\n👋  Fotos Fáciles cerrado. Tus fotos siguen en su carpeta.\n"); process.exit(0); };
  process.on("SIGINT", adios);
  process.on("SIGTERM", adios);
}

/**
 * Arranca por su cuenta solo cuando se llama directamente (`node iniciar.mjs`). Dentro
 * del ejecutable único quien manda es `build/entrada.mjs`, que primero registra
 * las pantallas incrustadas y después llama a `principal()`.
 */
const llamadoDirectamente = (() => {
  try { return !!process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]); }
  catch { return false; }
})();

export function arrancaPrograma() {
  return principal().catch((e) => {
    console.error(`\n❌  No se ha podido arrancar: ${e.message}\n`);
    process.exit(1);
  });
}

if (llamadoDirectamente) arrancaPrograma();
