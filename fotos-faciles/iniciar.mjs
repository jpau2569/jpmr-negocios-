#!/usr/bin/env node
// ============================================================================
//  Fotos Fáciles — arranque
// ----------------------------------------------------------------------------
//  Uso:
//    node fotos-faciles/iniciar.mjs
//    node fotos-faciles/iniciar.mjs --puerto 5000 --destino "D:\Fotos" --sin-navegador
// ============================================================================
import { execFile } from "node:child_process";
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

async function principal() {
  const args = argumentos(process.argv.slice(2));
  if (args.ayuda) {
    console.log(`Fotos Fáciles ${VERSION}
  --puerto <n>       puerto del servidor (por defecto 4321)
  --destino <ruta>   carpeta donde se guardan las fotos
  --sin-navegador    no abrir el navegador al arrancar
  --sin-pin          no pedir PIN en este ordenador (red de confianza)`);
    return;
  }

  const cambios = {};
  if (args.carpetaDestino) cambios.carpetaDestino = args.carpetaDestino;
  if (args.puerto) cambios.puerto = args.puerto;
  if (args.pedirPin === false) cambios.pedirPin = false;
  if (Object.keys(cambios).length) guardarConfig(cambios);
  const config = leerConfig();

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
    console.log(`  PIN de esta sesión : ${VERDE}${FUERTE}${seguridad.pin}${FIN}`);
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

principal().catch((e) => {
  console.error(`\n❌  No se ha podido arrancar: ${e.message}\n`);
  process.exit(1);
});
