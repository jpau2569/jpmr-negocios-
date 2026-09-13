#!/usr/bin/env node
// ============================================================================
//  Compila a JavaScript los módulos puros que prueban los tests.
// ----------------------------------------------------------------------------
//  Los tests van en `.mjs` y se ejecutan con el runner de Node, sin Jest ni
//  Vitest. Para poder probar el código real (que está en TypeScript) se compila
//  aquí un subconjunto: solo los módulos sin dependencias de Next ni de
//  Supabase. Así los tests prueban el mismo código que se despliega, no una
//  copia que se queda desactualizada.
// ============================================================================

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, ".test-build");

const resultado = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "-p", path.join(raiz, "test", "tsconfig.test.json")],
  { stdio: "inherit", cwd: raiz },
);

if (resultado.status !== 0) {
  console.error("No se ha podido compilar el código para los tests.");
  process.exit(resultado.status ?? 1);
}

// El proyecto es ESM ("type": "module"), pero esta compilación es CommonJS.
// Este package.json evita que Node intente leer los .js emitidos como módulos.
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));
