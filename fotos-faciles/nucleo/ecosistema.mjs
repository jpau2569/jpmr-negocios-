// ============================================================================
//  Fotos Fáciles — enganche con el resto del ecosistema de Pau
// ----------------------------------------------------------------------------
//  Dos puentes, los dos sobre archivos que ya existen en este repositorio:
//
//  1) ESCAPARATE 3D. Las fotos propias de un inmueble se copian a
//     `escaparate3d/fotos/` y se apuntan en `pisos.json`. Se guardan con el
//     sufijo `-propia-NN` a propósito: `sincronizar.mjs` nombra las suyas
//     `<ref>-01.jpg`, así que nunca chocan, y como ese script CONSERVA las
//     `imagenes` que ya había (`[...antes.imagenes]`), las nuestras sobreviven
//     a cada sincronización y se quedan las primeras — es decir, la portada.
//
//  2) LIMPIAFOTOS. Se prepara una carpeta plana con las fotos elegidas y se
//     abre en el explorador, para arrastrarlas a la herramienta web de una vez.
//
//  Nada de esto borra ni renombra un original: siempre se trabaja con copias.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nombreSeguro, carpetaSegura, extension } from "./util.mjs";

// Igual que en el servidor: dentro del ejecutable único se parte de donde
// está el propio programa, que es lo que el usuario deja junto al repositorio.
const AQUI = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); }
  catch { return path.dirname(process.execPath); }
})();

/** Mismo "slug" que usa `escaparate3d/herramientas/sincronizar.mjs`. */
export const babel = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Formatos que un navegador pinta sin problemas dentro del carrusel WebGL. */
export const EXT_PUBLICABLES = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * Busca la raíz del repositorio subiendo carpetas hasta encontrar el
 * escaparate. Devuelve null si Fotos Fáciles vive suelto en otro sitio.
 */
export function localizaRepo(desde = AQUI) {
  // Escotilla para cuando Fotos Fáciles vive fuera del repositorio (y para los tests).
  if (process.env.FOTOS_FACILES_REPO) return path.resolve(process.env.FOTOS_FACILES_REPO);
  let actual = path.resolve(desde);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(actual, "escaparate3d", "pisos.json"))) return actual;
    const padre = path.dirname(actual);
    if (padre === actual) break;
    actual = padre;
  }
  return null;
}

const rutaPisos = (repo) => path.join(repo, "escaparate3d", "pisos.json");
const rutaFotos = (repo) => path.join(repo, "escaparate3d", "fotos");

/** La cartera tal y como la ve el escaparate 3D. */
export async function leeCartera(repo = localizaRepo()) {
  if (!repo) return { hay: false, ruta: null, inmuebles: [] };
  try {
    const datos = JSON.parse(await fsp.readFile(rutaPisos(repo), "utf8"));
    const inmuebles = (datos.inmuebles || []).filter((p) => p && (p.referencia || p.titulo));
    return {
      hay: true,
      ruta: rutaPisos(repo),
      negocio: datos.negocio || null,
      inmuebles: inmuebles.map((p) => ({
        referencia: p.referencia || null,
        titulo: p.titulo || "",
        zona: p.zona || null,
        precioTexto: p.precioTexto || (p.precio ? `${Number(p.precio).toLocaleString("es-ES")} €` : null),
        fotos: Array.isArray(p.imagenes) ? p.imagenes.length : 0,
        activo: p.activo !== false,
        etiqueta: etiquetaInmueble(p),
        carpeta: carpetaDeInmueble(p),
      })),
    };
  } catch {
    return { hay: true, ruta: rutaPisos(repo), inmuebles: [], error: "No se ha podido leer pisos.json" };
  }
}

/** "PIS0190 — Piso reformado de 3 habitaciones" */
export function etiquetaInmueble(p) {
  const ref = p.referencia || p.ref;
  const titulo = (p.titulo || "").trim();
  return [ref, titulo].filter(Boolean).join(" — ") || "Sin referencia";
}

/** Nombre de carpeta para el modo "carpeta por inmueble". */
export function carpetaDeInmueble(p) {
  const ref = (p.referencia || p.ref || "").toString().toUpperCase().trim();
  const titulo = (p.titulo || "").trim();
  return carpetaSegura([ref, titulo].filter(Boolean).join(" - ")) || carpetaSegura(titulo) || "Sin referencia";
}

/** Siguiente hueco libre de `<raiz>-propia-NN` dentro de escaparate3d/fotos. */
async function siguienteNumero(carpeta, raiz) {
  let mayor = 0;
  const re = new RegExp(`^${raiz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-propia-(\\d{2,})\\.`, "i");
  for (const f of await fsp.readdir(carpeta).catch(() => [])) {
    const m = re.exec(f);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return mayor + 1;
}

/**
 * Guarda una foto ya preparada (redimensionada por el navegador) dentro de
 * `escaparate3d/fotos/`. Devuelve la ruta relativa que entiende pisos.json.
 */
export async function guardaFotoEscaparate({ repo = localizaRepo(), referencia, titulo, datos, extensionArchivo = ".jpg" }) {
  if (!repo) throw new Error("No encuentro la carpeta del escaparate 3D junto a Fotos Fáciles");
  const ext = EXT_PUBLICABLES.has(extensionArchivo) ? extensionArchivo : ".jpg";
  const raiz = babel(referencia || titulo);
  if (!raiz) throw new Error("Hace falta la referencia o el título del inmueble");
  const carpeta = rutaFotos(repo);
  await fsp.mkdir(carpeta, { recursive: true });
  const n = await siguienteNumero(carpeta, raiz);
  const nombre = `${raiz}-propia-${String(n).padStart(2, "0")}${ext}`;
  await fsp.writeFile(path.join(carpeta, nombre), datos);
  return `fotos/${nombre}`;
}

/**
 * Apunta las fotos en `pisos.json`, delante de las del portal (la primera pasa
 * a ser la portada). Si el inmueble aún no está en la cartera, se crea la
 * entrada mínima. Se deja una copia de seguridad `pisos.json.bak`.
 */
export async function publicaEnEscaparate({ repo = localizaRepo(), referencia, titulo, relativas = [] }) {
  if (!repo) throw new Error("No encuentro la carpeta del escaparate 3D junto a Fotos Fáciles");
  if (!relativas.length) throw new Error("No hay fotos que publicar");
  const fichero = rutaPisos(repo);

  let datos;
  try { datos = JSON.parse(await fsp.readFile(fichero, "utf8")); }
  catch { datos = { negocio: null, web: null, inmuebles: [] }; }
  if (!Array.isArray(datos.inmuebles)) datos.inmuebles = [];

  const clave = babel(referencia || titulo);
  let entrada = datos.inmuebles.find((p) => babel(p.referencia || p.ref || p.url || p.titulo) === clave);
  const nueva = !entrada;
  if (nueva) {
    entrada = {
      referencia: referencia || null,
      titulo: titulo || referencia || "Inmueble",
      operacion: "venta",
      zona: null, precio: null, habitaciones: null, banos: null,
      superficieConstruida: null, descripcion: null,
      imagen: null, imagenes: [], url: null, activo: true,
    };
    datos.inmuebles.push(entrada);
  }

  const previas = Array.isArray(entrada.imagenes) ? entrada.imagenes : [];
  const todas = [...relativas, ...previas.filter((r) => !relativas.includes(r))];
  entrada.imagenes = todas;
  entrada.imagen = todas[0] || null;
  if (titulo && (!entrada.titulo || nueva)) entrada.titulo = titulo;
  entrada.activo = true;
  entrada.verificado = new Date().toISOString().slice(0, 10);
  datos.actualizado = new Date().toISOString().slice(0, 10);

  // Copia de seguridad antes de tocar un archivo que es fuente de verdad.
  await fsp.copyFile(fichero, `${fichero}.bak`).catch(() => {});
  await fsp.writeFile(fichero, `${JSON.stringify(datos, null, 2)}\n`, "utf8");

  return {
    ruta: fichero, referencia: entrada.referencia, titulo: entrada.titulo,
    nueva, fotos: todas.length, portada: entrada.imagen,
  };
}

/**
 * Copia las fotos elegidas a una carpeta plana lista para arrastrarlas a
 * LimpiaFotos. Devuelve la carpeta para poder abrirla en el explorador.
 */
export async function preparaLimpiaFotos({ carpetaBase, etiqueta, archivos = [] }) {
  if (!archivos.length) throw new Error("No has elegido ninguna foto");
  const carpeta = path.join(carpetaBase, "_Para LimpiaFotos", carpetaSegura(etiqueta) || "sin-etiqueta");
  await fsp.mkdir(carpeta, { recursive: true });
  let copiadas = 0;
  for (const origen of archivos) {
    const destino = path.join(carpeta, nombreSeguro(path.basename(origen)));
    if (fs.existsSync(destino)) continue;      // ya preparada en otra tanda
    await fsp.copyFile(origen, destino);
    copiadas++;
  }
  return { carpeta, copiadas, total: archivos.length };
}

/** Abre una carpeta en el Explorador de Windows, el Finder o el de Linux. */
export function abreCarpeta(ruta) {
  const [orden, args] = process.platform === "win32"
    ? ["explorer.exe", [path.resolve(ruta)]]
    : process.platform === "darwin"
      ? ["open", [path.resolve(ruta)]]
      : ["xdg-open", [path.resolve(ruta)]];
  return new Promise((resolve) => execFile(orden, args, () => resolve(true)));
}

/** ¿Se puede publicar este archivo en el escaparate tal cual? */
export const publicable = (nombre) => EXT_PUBLICABLES.has(extension(nombre));
