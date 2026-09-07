#!/usr/bin/env node
// ============================================================================
//  Fotos Fáciles — construir un EJECUTABLE ÚNICO (sin necesidad de Node)
// ----------------------------------------------------------------------------
//  Usa las "Single Executable Applications" oficiales de Node: se mete todo el
//  programa (código + las tres pantallas web) dentro de una copia del propio
//  binario de Node. El resultado es un archivo que se abre con doble clic en un
//  ordenador que NO tiene Node instalado.
//
//    node fotos-faciles/herramientas/empaquetar.mjs
//    node fotos-faciles/herramientas/empaquetar.mjs --plataforma win-x64
//    node fotos-faciles/herramientas/empaquetar.mjs --plataforma darwin-arm64
//
//  Requisitos (solo para CONSTRUIR, el programa sigue sin dependencias):
//    npm install --no-save esbuild postject
//
//  Aviso de tamaño, para que no haya sorpresas: el ejecutable pesa unos 110 MB
//  porque lleva Node entero dentro. Comprimido en un ZIP se queda sobre 40 MB.
//  Es el precio de que el usuario final no tenga que instalar nada.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ejecuta = promisify(execFile);
const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, "..");
const CONSTRUCCION = path.join(APP, "build");
const DISTRIBUCION = path.join(APP, "dist");
const FUSIBLE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

const argumentos = process.argv.slice(2);
const opcion = (nombre, porDefecto = null) => {
  const i = argumentos.indexOf(`--${nombre}`);
  return i === -1 ? porDefecto : argumentos[i + 1];
};

const PLATAFORMA = opcion("plataforma", `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`);
const esWindows = PLATAFORMA.startsWith("win");
const esMac = PLATAFORMA.startsWith("darwin");

function resuelveHerramienta(nombre) {
  try { return require.resolve(`${nombre}/package.json`); }
  catch {
    throw new Error(
      `Falta "${nombre}". Instálalo solo para construir:\n    npm install --no-save esbuild postject`,
    );
  }
}

// --- 1. Incrustar las pantallas web -----------------------------------------
async function incrustaWeb() {
  const carpeta = path.join(APP, "web");
  const mapa = {};
  for (const nombre of await fsp.readdir(carpeta)) {
    const ruta = path.join(carpeta, nombre);
    if (!(await fsp.stat(ruta)).isFile()) continue;
    mapa[nombre] = (await fsp.readFile(ruta)).toString("base64");
  }
  await fsp.mkdir(CONSTRUCCION, { recursive: true });
  await fsp.writeFile(
    path.join(CONSTRUCCION, "recursos-embebidos.mjs"),
    `// Generado por herramientas/empaquetar.mjs — no editar a mano.\nexport default ${JSON.stringify(mapa)};\n`,
    "utf8",
  );
  await fsp.writeFile(
    path.join(CONSTRUCCION, "entrada.mjs"),
    `import RECURSOS from "./recursos-embebidos.mjs";
import { registraRecursos } from "../nucleo/recursos.mjs";
import { arrancaPrograma } from "../iniciar.mjs";
registraRecursos(RECURSOS);
arrancaPrograma();
`,
    "utf8",
  );
  return Object.keys(mapa).length;
}

// --- 2. Un solo archivo CommonJS (lo que exige el empaquetador de Node) ------
async function agrupa() {
  const esbuild = require(path.dirname(resuelveHerramienta("esbuild")));
  const salida = path.join(CONSTRUCCION, "app.cjs");
  await esbuild.build({
    entryPoints: [path.join(CONSTRUCCION, "entrada.mjs")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: salida,
    logLevel: "error",
    // `import.meta.url` no existe en CommonJS; el código ya sabe apañárselas,
    // pero se le da un valor válido para que ni siquiera avise.
    define: { "import.meta.url": "__filename" },
  });
  return salida;
}

// --- 3. Binario de Node de la plataforma destino -----------------------------
async function binarioNode() {
  const propio = `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`;
  if (PLATAFORMA === propio) return process.execPath;

  const cache = path.join(os.tmpdir(), "fotos-faciles-node");
  await fsp.mkdir(cache, { recursive: true });
  const destino = path.join(cache, `node-${process.version}-${PLATAFORMA}${esWindows ? ".exe" : ""}`);
  if (fs.existsSync(destino)) return destino;

  if (!esWindows) {
    throw new Error(
      `Para construir para ${PLATAFORMA} hay que ejecutar este script en esa plataforma\n` +
      "  (el binario de macOS/Linux viene en un .tar.gz que además hay que firmar).",
    );
  }
  const url = `https://nodejs.org/dist/${process.version}/${PLATAFORMA}/node.exe`;
  console.log(`  Descargando Node para Windows: ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se ha podido descargar Node (${r.status})`);
  await fsp.writeFile(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

// --- 4. Cocinar el ejecutable ------------------------------------------------
async function principal() {
  console.log("\n📦  Empaquetando Fotos Fáciles");
  console.log(`    Plataforma destino: ${PLATAFORMA}`);

  resuelveHerramienta("esbuild");
  resuelveHerramienta("postject");

  const cuantos = await incrustaWeb();
  console.log(`    ${cuantos} archivos de la web incrustados`);

  const paquete = await agrupa();
  console.log(`    Código agrupado: ${(fs.statSync(paquete).size / 1024).toFixed(0)} KB`);

  const config = path.join(CONSTRUCCION, "sea-config.json");
  await fsp.writeFile(config, JSON.stringify({
    main: paquete,
    output: path.join(CONSTRUCCION, "sea.blob"),
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }, null, 2), "utf8");
  await ejecuta(process.execPath, ["--experimental-sea-config", config]);
  console.log("    Preparado el paquete interno (sea.blob)");

  await fsp.mkdir(DISTRIBUCION, { recursive: true });
  const nombreFinal = `FotosFaciles-${PLATAFORMA}${esWindows ? ".exe" : ""}`;
  const destino = path.join(DISTRIBUCION, nombreFinal);
  await fsp.copyFile(await binarioNode(), destino);
  await fsp.chmod(destino, 0o755).catch(() => {});

  const postject = path.join(path.dirname(resuelveHerramienta("postject")), "dist", "cli.js");
  const args = [
    postject, destino, "NODE_SEA_BLOB", path.join(CONSTRUCCION, "sea.blob"),
    "--sentinel-fuse", FUSIBLE,
  ];
  if (esMac) args.push("--macho-segment-name", "NODE_SEA");
  await ejecuta(process.execPath, args, { maxBuffer: 64 * 1024 * 1024 });

  const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(0);
  console.log(`\n✅  Listo: ${destino}  (${mb} MB)`);
  console.log("    Se puede copiar a un ordenador SIN Node y abrirlo con doble clic.");
  if (esMac) console.log("    En macOS hay que firmarlo: codesign --sign - " + nombreFinal);
  console.log("");
}

principal().catch((e) => {
  console.error(`\n❌  ${e.message}\n`);
  process.exit(1);
});
