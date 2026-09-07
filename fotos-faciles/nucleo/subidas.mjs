// ============================================================================
//  Fotos Fáciles — subidas reanudables desde el móvil
// ----------------------------------------------------------------------------
//  Un vídeo 4K del iPhone puede pesar 2 GB. Si el ascensor te deja sin WiFi a
//  mitad de la subida, no se pierde nada: cada archivo se escribe en un
//  `.parcial` con un identificador estable (nombre + tamaño + fecha + sesión),
//  y al reintentar el móvil pregunta cuántos bytes hay y sigue desde ahí.
//  Sobrevive incluso a cerrar y volver a abrir el programa.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { nombreSeguro } from "./util.mjs";

const CADUCIDAD_MS = 7 * 86_400_000;

export class Subidas {
  constructor(carpetaBase) {
    this.carpeta = path.join(carpetaBase, ".fotos-faciles", "parciales");
  }

  async preparar() {
    await fsp.mkdir(this.carpeta, { recursive: true });
    await this.limpiaViejas();
    return this;
  }

  identificador({ nombre, tamano, fechaMod, sesion }) {
    return crypto.createHash("sha1")
      .update([nombre, tamano, fechaMod || 0, sesion || ""].join("|"))
      .digest("hex").slice(0, 20);
  }

  rutaParcial(id) { return path.join(this.carpeta, `${id}.parcial`); }
  rutaFicha(id) { return path.join(this.carpeta, `${id}.json`); }

  /** Abre (o recupera) una subida. Devuelve { id, recibido }. */
  async abrir(meta) {
    const nombre = nombreSeguro(meta.nombre, "foto.jpg");
    const tamano = Math.max(0, Number(meta.tamano) || 0);
    const id = this.identificador({ ...meta, nombre, tamano });
    let recibido = 0;
    try { recibido = (await fsp.stat(this.rutaParcial(id))).size; } catch { /* aún no existe */ }
    if (recibido > tamano) { await fsp.rm(this.rutaParcial(id), { force: true }); recibido = 0; }
    await fsp.writeFile(this.rutaFicha(id), JSON.stringify({
      id, nombre, tamano, fechaMod: Number(meta.fechaMod) || null, creada: Date.now(),
    }), "utf8");
    return { id, recibido, nombre, tamano };
  }

  async ficha(id) {
    try { return JSON.parse(await fsp.readFile(this.rutaFicha(id), "utf8")); } catch { return null; }
  }

  /**
   * Añade bytes al final del `.parcial`. Rechaza un desplazamiento que no
   * cuadre para no mezclar dos intentos y acabar con un archivo corrupto.
   */
  async escribir(id, desplazamiento, flujo) {
    const ficha = await this.ficha(id);
    if (!ficha) throw Object.assign(new Error("Subida desconocida"), { codigo: 404 });
    const ruta = this.rutaParcial(id);
    let actual = 0;
    try { actual = (await fsp.stat(ruta)).size; } catch { /* primer trozo */ }
    if (desplazamiento !== actual) {
      throw Object.assign(new Error(`Se esperaban ${actual} bytes ya recibidos`), { codigo: 409, recibido: actual });
    }
    await new Promise((resolve, reject) => {
      const salida = fs.createWriteStream(ruta, { flags: "a" });
      const corta = (e) => { salida.destroy(); reject(e); };
      // Si el móvil pierde la WiFi a mitad, hay que soltar la promesa: lo ya
      // escrito se conserva y el siguiente intento continúa desde ahí.
      flujo.on("error", corta);
      flujo.on("aborted", () => corta(new Error("Se ha cortado la subida")));
      salida.on("error", corta);
      salida.on("finish", resolve);
      flujo.pipe(salida);
    });
    const { size } = await fsp.stat(ruta);
    return { recibido: size, completo: ficha.tamano > 0 && size >= ficha.tamano };
  }

  /** Cierra la subida y devuelve la ruta del archivo temporal ya completo. */
  async cerrar(id) {
    const ficha = await this.ficha(id);
    if (!ficha) throw Object.assign(new Error("Subida desconocida"), { codigo: 404 });
    const ruta = this.rutaParcial(id);
    const { size } = await fsp.stat(ruta);
    if (ficha.tamano > 0 && size !== ficha.tamano) {
      throw Object.assign(new Error(`Faltan bytes: ${size} de ${ficha.tamano}`), { codigo: 409, recibido: size });
    }
    return { ruta, ficha };
  }

  async descartar(id) {
    await fsp.rm(this.rutaParcial(id), { force: true });
    await fsp.rm(this.rutaFicha(id), { force: true });
  }

  /** Borra restos de subidas abandonadas hace más de una semana. */
  async limpiaViejas() {
    try {
      const ahora = Date.now();
      for (const nombre of await fsp.readdir(this.carpeta)) {
        const ruta = path.join(this.carpeta, nombre);
        const info = await fsp.stat(ruta).catch(() => null);
        if (info && ahora - info.mtimeMs > CADUCIDAD_MS) await fsp.rm(ruta, { force: true });
      }
    } catch { /* la carpeta se creará al primer uso */ }
  }
}
