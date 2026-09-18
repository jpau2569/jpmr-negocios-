// Enrutador único de /api: Vercel Hobby admite 12 funciones como máximo.
import { readdir, readFile } from "node:fs/promises";
import handler, { rutasDisponibles } from "../api/[ruta].js";

let pasados = 0, fallados = 0;
const check = (n, ok) => { ok ? pasados++ : fallados++; console.log(`  ${ok ? "✅" : "❌"} ${n}`); };

console.log("\n— api/[ruta].js (enrutador único) —");

const funciones = [];
async function recorrer(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const ruta = `${dir}/${e.name}`;
    if (e.isDirectory()) await recorrer(ruta);
    else if (/\.(js|mjs|ts)$/.test(e.name)) funciones.push(ruta);
  }
}
await recorrer("api");
check(`caben en el plan Hobby (${funciones.length} ≤ 12 funciones)`, funciones.length <= 12);

const archivos = (await readdir("api")).filter((f) => /^_.*\.js$/.test(f)).map((f) => f.slice(1, -3)).sort();
check("cada endpoint api/_X.js tiene su ruta", JSON.stringify(archivos) === JSON.stringify([...rutasDisponibles].sort()));

for (const nombre of rutasDisponibles) {
  const m = await import(`../api/_${nombre}.js`);
  check(`/api/${nombre} carga y exporta un handler`, typeof m.default === "function");
}

function resFalsa() {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}

let r = resFalsa();
await handler({ method: "GET", query: { ruta: "no-existe" }, headers: {} }, r);
check("una ruta desconocida da 404", r.code === 404);

r = resFalsa();
await handler({ method: "GET", query: { ruta: "__proto__" }, headers: {} }, r);
check("no se puede colar __proto__ como ruta", r.code === 404);

r = resFalsa();
const req = { method: "GET", query: { ruta: "health" }, headers: {} };
await handler(req, r);
check("/api/health responde a través del enrutador", r.code === 200);
check("el endpoint no recibe el parámetro interno 'ruta'", !("ruta" in req.query));

const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
const inc = String(vercel.functions?.["api/[ruta].js"]?.includeFiles || "");
check("el enrutador incluye los prompts de agentes/", inc.includes("agentes"));
check("el enrutador tiene 60 s para Clara, CasteBot y Luxury Motion", vercel.functions?.["api/[ruta].js"]?.maxDuration >= 60);
check("la ficha pública /p/<slug> sigue apuntando a su endpoint",
  (vercel.rewrites || []).some((w) => w.source === "/p/:slug" && w.destination.startsWith("/api/oportunidades-ficha")));

console.log(`\n${fallados === 0 ? "✅" : "❌"} Enrutador: ${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados === 0 ? 0 : 1);
