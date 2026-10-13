#!/usr/bin/env node
// ============================================================================
//  Copia a public/static/cerebro/ los módulos de Cerebro que reutiliza
//  Hojas firmadas (datos del piso, PDF, documentos, textos legales, firma).
//
//    node cloudflare/hojas-firmadas/herramientas/copiar-cerebro.mjs
//
//  Por qué copias y no importar de ../../cerebro: el navegador solo puede
//  cargar lo que Cloudflare sirve desde la carpeta public/ del Worker. Las
//  copias son EXACTAS (byte a byte) y test/hojas-firmadas.test.mjs falla si
//  alguna se desincroniza: la fuente única sigue siendo cerebro/.
//  Con --comprobar no copia nada: solo dice si están al día (sale con 1 si no).
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ARCHIVOS_CEREBRO = [
  "campos-piso.js",
  "pdf.js",
  "documentos.js",
  "utiles.js",
  "visitas.js",
  "valoracion.js",
  "operaciones-datos.js",
  "firma.js",
  "logo-castresana.jpg",
];

const ORIGEN = new URL("../../../cerebro/", import.meta.url);
const DESTINO = new URL("../public/static/cerebro/", import.meta.url);

/** Lista de archivos cuya copia no coincide con el original (vacía = todo al día). */
export function desincronizados() {
  return ARCHIVOS_CEREBRO.filter((n) => {
    const destino = new URL(n, DESTINO);
    return !existsSync(destino) || !readFileSync(new URL(n, ORIGEN)).equals(readFileSync(destino));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const malos = desincronizados();
  if (process.argv.includes("--comprobar")) {
    console.log(malos.length ? `Desincronizados: ${malos.join(", ")}` : "Las copias de Cerebro están al día.");
    process.exit(malos.length ? 1 : 0);
  }
  mkdirSync(DESTINO, { recursive: true });
  for (const n of ARCHIVOS_CEREBRO) writeFileSync(new URL(n, DESTINO), readFileSync(new URL(n, ORIGEN)));
  console.log(malos.length ? `Copiados de cerebro/: ${malos.join(", ")}` : "Nada que copiar: ya estaban al día.");
  console.log("Recuerda subir VERSION en public/sw.js para que los móviles cojan la copia nueva.");
}
