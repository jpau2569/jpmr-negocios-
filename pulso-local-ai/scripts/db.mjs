#!/usr/bin/env node
// ============================================================================
//  PULSO LOCAL AI — aplicar migraciones y seed
// ----------------------------------------------------------------------------
//  Dos formas de trabajar, según lo que tengas a mano:
//
//    1. Con `psql` instalado y `SUPABASE_DB_URL` en el entorno:
//         npm run db:migrate      → aplica supabase/migrations/*.sql en orden
//         npm run db:seed         → aplica el seed de Asesoría Castresana
//         npm run db:reset        → migraciones + seed, en una pasada
//
//    2. Sin `psql` (por ejemplo, desde el navegador del proyecto de Supabase):
//         node scripts/db.mjs migrate --print > /tmp/migraciones.sql
//       y pegas el resultado en el editor SQL de Supabase.
//
//  No borra nada. `reset` no significa «borrar la base de datos»: significa
//  «dejarla al día», y las migraciones están escritas para poder repetirse.
// ============================================================================

import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirMigraciones = path.join(raiz, "supabase", "migrations");
const dirSeed = path.join(raiz, "supabase", "seed");

async function leerSql(dir) {
  const ficheros = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const partes = [];
  for (const f of ficheros) {
    partes.push(`-- >>> ${path.relative(raiz, path.join(dir, f))}\n${await readFile(path.join(dir, f), "utf8")}`);
  }
  return { ficheros, sql: partes.join("\n\n") };
}

function ejecutarPsql(sql) {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      "Falta SUPABASE_DB_URL.\n" +
        "  · Cópiala de Supabase → Project Settings → Database → Connection string (URI).\n" +
        "  · O vuelve a lanzar el comando con --print y pega el SQL en el editor de Supabase.",
    );
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    const hijo = spawn("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", "-"], { stdio: ["pipe", "inherit", "inherit"] });
    hijo.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("No se encuentra `psql`. Instálalo o usa --print y pega el SQL en Supabase."));
      } else reject(err);
    });
    hijo.stdin.end(sql);
    hijo.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`psql terminó con código ${codigo}`))));
  });
}

async function main() {
  const [comando = "reset", ...resto] = process.argv.slice(2);
  const soloImprimir = resto.includes("--print");

  const bloques = [];
  if (comando === "migrate" || comando === "reset") {
    const { ficheros, sql } = await leerSql(dirMigraciones);
    if (!soloImprimir) console.error(`Migraciones: ${ficheros.join(", ")}`);
    bloques.push(sql);
  }
  if (comando === "seed" || comando === "reset") {
    const { ficheros, sql } = await leerSql(dirSeed);
    if (!soloImprimir) console.error(`Seed: ${ficheros.join(", ")}`);
    bloques.push(sql);
  }
  if (!bloques.length) {
    console.error("Uso: node scripts/db.mjs [migrate|seed|reset] [--print]");
    process.exit(1);
  }

  const sql = bloques.join("\n\n");
  if (soloImprimir) {
    // `node scripts/db.mjs migrate --print | head` cierra la tubería antes de
    // tiempo: eso no es un fallo, así que no se propaga como tal.
    process.stdout.on("error", (err) => {
      if (err.code !== "EPIPE") throw err;
    });
    process.stdout.write(sql);
    return;
  }
  await ejecutarPsql(sql);
  console.error("Listo.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
