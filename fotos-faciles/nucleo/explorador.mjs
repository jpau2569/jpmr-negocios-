// ============================================================================
//  Fotos Fáciles — Modo C: copiar y pegar entre carpetas
// ----------------------------------------------------------------------------
//  Permite navegar por las carpetas del PC (o de un móvil Android montado como
//  unidad, incluida la carpeta de WhatsApp) y pegar fotos donde el usuario
//  quiera, con la regla de oro del proyecto:
//
//    NUNCA se sobrescribe nada. Si ya hay un archivo con ese nombre:
//      · contenido idéntico  → se ignora (duplicado)
//      · contenido distinto  → se guarda como "IMG_001 (2).jpg"
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { esMedia, esFoto, esVideo, nombreSeguro, rutaLibre, dentroDe } from "./util.mjs";
import { hashArchivo } from "./almacen.mjs";

const OCULTAS = /^(\$recycle\.bin|system volume information|\.|node_modules)/i;

/** Contenido de una carpeta: subcarpetas y archivos de foto/vídeo. */
export async function listaCarpeta(ruta, { incluirOtros = false } = {}) {
  const destino = path.resolve(ruta);
  const entradas = await fsp.readdir(destino, { withFileTypes: true });
  const carpetas = [];
  const archivos = [];
  for (const e of entradas) {
    if (OCULTAS.test(e.name)) continue;
    const completa = path.join(destino, e.name);
    if (e.isDirectory()) { carpetas.push({ ruta: completa, nombre: e.name }); continue; }
    if (!e.isFile()) continue;
    if (!esMedia(e.name) && !incluirOtros) continue;
    const info = await fsp.stat(completa).catch(() => null);
    if (!info) continue;
    archivos.push({
      ruta: completa, nombre: e.name, tamano: info.size,
      modificado: info.mtime.toISOString(),
      tipo: esVideo(e.name) ? "video" : esFoto(e.name) ? "foto" : "otro",
    });
  }
  carpetas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  archivos.sort((a, b) => String(b.modificado).localeCompare(String(a.modificado)));
  const padre = path.dirname(destino);
  return {
    ruta: destino,
    nombre: path.basename(destino) || destino,
    padre: padre === destino ? null : padre,
    carpetas, archivos,
  };
}

/**
 * Copia (o mueve) archivos a una carpeta, sin pisar jamás lo que ya hay.
 * `alAvanzar(estado)` se llama después de cada archivo para la barra de progreso.
 */
export async function copiarArchivos(origenes, carpetaDestino, opciones = {}) {
  const { mover = false, alAvanzar = () => {}, cancelada = () => false, registrar = null } = opciones;
  const destino = path.resolve(carpetaDestino);
  await fsp.mkdir(destino, { recursive: true });

  const resumen = { copiados: 0, duplicados: 0, fallidos: 0, bytes: 0, detalles: [] };
  for (const origen of origenes) {
    if (cancelada()) break;
    const rutaOrigen = path.resolve(String(origen));
    try {
      const info = await fsp.stat(rutaOrigen);
      if (!info.isFile()) throw new Error("No es un archivo");
      if (dentroDe(rutaOrigen, destino) && path.dirname(rutaOrigen) === destino) {
        resumen.duplicados++;
        resumen.detalles.push({ nombre: path.basename(rutaOrigen), estado: "ya está aquí" });
        alAvanzar(resumen);
        continue;
      }

      const nombre = nombreSeguro(path.basename(rutaOrigen));
      let candidato = path.join(destino, nombre);
      if (fs.existsSync(candidato)) {
        const [a, b] = await Promise.all([hashArchivo(rutaOrigen), hashArchivo(candidato)]);
        if (a === b) {
          resumen.duplicados++;
          resumen.detalles.push({ nombre, estado: "duplicado" });
          if (mover) await fsp.rm(rutaOrigen, { force: true });
          alAvanzar(resumen);
          continue;
        }
        candidato = rutaLibre(candidato, (p) => fs.existsSync(p));
      }

      if (mover) {
        try { await fsp.rename(rutaOrigen, candidato); }
        catch { await fsp.copyFile(rutaOrigen, candidato); await fsp.rm(rutaOrigen, { force: true }); }
      } else {
        await fsp.copyFile(rutaOrigen, candidato);
      }
      resumen.copiados++;
      resumen.bytes += info.size;
      resumen.detalles.push({ nombre: path.basename(candidato), estado: "copiado", ruta: candidato });
      if (registrar) await registrar(candidato).catch(() => {});
    } catch (e) {
      resumen.fallidos++;
      resumen.detalles.push({ nombre: path.basename(rutaOrigen), estado: "error", error: e.message });
    }
    alAvanzar(resumen);
  }
  return resumen;
}

/** Crea una subcarpeta con nombre limpio dentro de otra. */
export async function crearCarpeta(padre, nombre) {
  const limpio = nombreSeguro(nombre, "").replace(/\./g, "").trim();
  if (!limpio) throw new Error("Pon un nombre para la carpeta");
  const ruta = path.join(path.resolve(padre), limpio);
  await fsp.mkdir(ruta, { recursive: true });
  return ruta;
}
