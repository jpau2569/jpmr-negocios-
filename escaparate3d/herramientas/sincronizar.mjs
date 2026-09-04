// ============================================================================
//  Sincroniza escaparate3d/pisos.json con la cartera real de
//  www.asesoriacastresana.com y descarga las fotos a escaparate3d/fotos/.
// ----------------------------------------------------------------------------
//  Uso (desde la raíz del repositorio):
//    node escaparate3d/herramientas/sincronizar.mjs
//    node escaparate3d/herramientas/sincronizar.mjs --sin-fotos   (solo datos)
//    node escaparate3d/herramientas/sincronizar.mjs --refotos     (rebaja las ya bajadas)
//    node escaparate3d/herramientas/sincronizar.mjs --dry         (enseña sin escribir)
//
//  Qué hace y qué NO hace:
//   - Lee las páginas públicas de resultados con lib/cartera.js (el mismo lector
//     que usan el escaparate de la TV, Clara y el briefing). No inventa datos:
//     lo que no consta en la web, se queda a null.
//   - Actualiza precio, título, metros, habitaciones y baños de cada anuncio y
//     le pone la fecha de comprobación (campo "verificado").
//   - Conserva lo que hayas escrito a mano (descripción, planta, fotos extra).
//   - Un inmueble que ya no aparece en la web NO se borra: se marca
//     "activo": false y deja de salir en el escaparate, pero queda el histórico.
// ============================================================================

import { writeFile, readFile, mkdir, access } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { obtenerCartera } from "../../lib/cartera.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(AQUI, "..");
const FICHERO = join(CARPETA, "pisos.json");
const FOTOS = join(CARPETA, "fotos");

const opciones = new Set(process.argv.slice(2));
const sinFotos = opciones.has("--sin-fotos");
const refotos = opciones.has("--refotos");
const enSeco = opciones.has("--dry");

const hoy = new Date().toISOString().slice(0, 10);

const babel = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const clave = (p) => p.referencia || p.ref || p.url || babel(p.titulo);

async function existe(ruta) {
  try { await access(ruta); return true; } catch { return false; }
}

// Descarga una foto al hosting propio. Devuelve la ruta relativa o null.
async function bajaFoto(url, nombre) {
  const extUrl = (extname(new URL(url).pathname) || ".jpg").split("?")[0].toLowerCase();
  const ext = [".jpg", ".jpeg", ".png", ".webp"].includes(extUrl) ? extUrl : ".jpg";
  const destino = join(FOTOS, nombre + ext);
  const relativa = `fotos/${nombre}${ext}`;
  if (!refotos && (await existe(destino))) return relativa;
  if (enSeco) return relativa;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (escaparate3d/sincronizar)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length < 1024) throw new Error("archivo demasiado pequeño, parece un error");
  await mkdir(FOTOS, { recursive: true });
  await writeFile(destino, bytes);
  return relativa;
}

async function leeActual() {
  try {
    const datos = JSON.parse(await readFile(FICHERO, "utf8"));
    return Array.isArray(datos) ? { inmuebles: datos } : datos;
  } catch {
    return { inmuebles: [] };
  }
}

const main = async () => {
  console.log("Leyendo la cartera de www.asesoriacastresana.com…");
  const { items, errores } = await obtenerCartera();
  if (errores.length) console.warn("  avisos:", errores.join("; "));
  if (!items.length) {
    console.error("No se ha leído ningún inmueble. No toco pisos.json para no vaciarlo por error.");
    process.exitCode = 1;
    return;
  }
  console.log(`  ${items.length} inmuebles leídos.`);

  const actual = await leeActual();
  const previos = new Map((actual.inmuebles || []).map((p) => [clave(p), p]));
  const vistos = new Set();
  const salida = [];
  let fotosNuevas = 0;

  for (const it of items) {
    const k = clave(it);
    vistos.add(k);
    const antes = previos.get(k) || {};

    let imagenes = Array.isArray(antes.imagenes) ? [...antes.imagenes] : [];
    if (!sinFotos && it.foto) {
      const nombre = babel(it.ref || it.titulo) + "-01";
      try {
        const ruta = await bajaFoto(it.foto, nombre);
        if (!imagenes.includes(ruta)) { imagenes.unshift(ruta); fotosNuevas++; }
      } catch (e) {
        console.warn(`  foto de ${it.ref || it.titulo}: ${e.message}`);
      }
    }

    salida.push({
      referencia: it.ref || antes.referencia || null,
      titulo: it.titulo || antes.titulo,
      operacion: it.operacion,
      zona: it.localidad || antes.zona || null,
      precio: it.precio ?? antes.precio ?? null,
      habitaciones: it.habitaciones ?? antes.habitaciones ?? null,
      banos: it.banos ?? antes.banos ?? null,
      superficieConstruida: it.m2 ?? antes.superficieConstruida ?? null,
      planta: antes.planta ?? null,                          // la web de resultados no lo da
      descripcion: antes.descripcion || it.descripcion || null, // gana lo escrito a mano
      imagen: imagenes[0] || null,
      imagenes,
      url: it.url || antes.url || null,
      activo: true,
      verificado: hoy,
    });
  }

  // Los que ya no están en la web: se conservan, apagados.
  let apagados = 0;
  for (const [k, p] of previos) {
    if (vistos.has(k)) continue;
    if (p.activo === false) { salida.push(p); continue; }
    salida.push({ ...p, activo: false, retiradoEl: hoy });
    apagados++;
  }

  const datos = {
    negocio: actual.negocio || "Asesoría Castresana",
    web: actual.web || "https://www.asesoriacastresana.com",
    actualizado: hoy,
    nota: "Generado por escaparate3d/herramientas/sincronizar.mjs a partir de la web oficial. Esquema en pisos.ejemplo.json.",
    inmuebles: salida,
  };

  if (enSeco) {
    console.log("\n--dry: no escribo nada. Resumen de lo que haría:");
  } else {
    await writeFile(FICHERO, JSON.stringify(datos, null, 2) + "\n", "utf8");
  }
  console.log(`\nActivos: ${salida.filter((p) => p.activo).length}`);
  console.log(`Retirados en esta pasada: ${apagados}`);
  console.log(`Fotos nuevas descargadas: ${fotosNuevas}`);
  if (!enSeco) console.log(`Escrito: ${FICHERO}`);
};

main().catch((e) => { console.error(e); process.exitCode = 1; });
