// ============================================================================
//  Genera un enlace corto por demo:  escaparate3d-pro/<id>.html
// ----------------------------------------------------------------------------
//  Por qué existe: `index.html?negocio=<id>` obliga al navegador a tener el
//  js/config.js actualizado para saber que ese negocio existe. Con la caché de
//  GitHub Pages (10 minutos) eso falla justo cuando estás delante de un cliente:
//  te abre OTRO negocio. Estas páginas son direcciones nuevas —imposibles de
//  tener cacheadas— y llevan la ruta del JSON escrita dentro, así que funcionan
//  con cualquier versión del código que el móvil tenga guardada.
//
//  Además el enlace queda corto y presentable para mandarlo por WhatsApp:
//      .../escaparate3d-pro/la-taberna.html
//
//  Uso:  node escaparate3d-pro/herramientas/generar-enlaces.mjs
// ============================================================================

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EJEMPLOS = join(RAIZ, "config", "ejemplos");

const escapar = (t) => String(t || "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function paginaDeEnlace({ id, nombre, eslogan, archivo, colores }) {
  const destino = `index.html?config=config/ejemplos/${archivo}`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${escapar(colores?.fondo || "#0f1115")}">
<title>${escapar(nombre)}</title>
<meta name="description" content="${escapar(eslogan || nombre)}">
<!-- Enlace corto de la demo de ${escapar(nombre)}. Generado por
     herramientas/generar-enlaces.mjs — no editar a mano. -->
<link rel="canonical" href="${destino}">
<meta http-equiv="refresh" content="0; url=${destino}">
<style>
  body { margin:0; display:grid; place-content:center; min-height:100vh; text-align:center;
         font-family:"Segoe UI",system-ui,sans-serif;
         background:${escapar(colores?.fondo || "#0f1115")}; color:${escapar(colores?.texto || "#e9edf3")}; }
  a { color:${escapar(colores?.acento || "#6c7cff")}; }
</style>
</head>
<body>
  <p>Abriendo <strong>${escapar(nombre)}</strong>…</p>
  <p><a href="${destino}">Si no se abre solo, pulsa aquí</a></p>
  <script>location.replace(${JSON.stringify(destino)});</script>
</body>
</html>
`;
}

export async function generar() {
  const archivos = (await readdir(EJEMPLOS)).filter((f) => f.endsWith(".json"));
  const hechos = [];
  for (const archivo of archivos) {
    const cfg = JSON.parse(await readFile(join(EJEMPLOS, archivo), "utf8"));
    const id = String(cfg.id || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) {
      console.warn(`  ⚠️  ${archivo} no tiene un id válido, me lo salto.`);
      continue;
    }
    await writeFile(join(RAIZ, `${id}.html`), paginaDeEnlace({ ...cfg, archivo }), "utf8");
    hechos.push({ id, archivo, nombre: cfg.nombre });
  }
  return hechos;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hechos = await generar();
  for (const h of hechos) console.log(`  ✅ ${h.id}.html  →  ${h.nombre}`);
  console.log(`\n${hechos.length} enlaces cortos generados.`);
}
