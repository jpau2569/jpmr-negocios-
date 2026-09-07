// ============================================================================
//  Fotos Fáciles — almacén: dónde va cada archivo y qué ya tenemos
// ----------------------------------------------------------------------------
//  Regla de oro del proyecto: NUNCA se sobrescribe ni se reorganiza nada que ya
//  estuviera guardado. Si llega un archivo con el mismo nombre:
//    · mismo contenido (mismo SHA-256) → se ignora, es un duplicado;
//    · contenido distinto → se guarda al lado como "IMG_001 (2).jpg".
//
//  El índice vive en <destino>/.fotos-faciles/indice.json y guarda el hash de
//  todo lo importado, para no volver a copiar la misma foto nunca más.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { claveFecha, carpetaSegura, nombreSeguro, rutaLibre, esFoto, esVideo, extension } from "./util.mjs";
import { fechaReal } from "./exif.mjs";

const INTERNA = ".fotos-faciles";
const MAX_HISTORIAL = 500;

export function huellaRapida(nombre, tamano) {
  return `${String(nombre || "").toLowerCase()}|${Number(tamano) || 0}`;
}

/** SHA-256 de un archivo, leído por trozos para que un vídeo 4K no reviente la RAM. */
export function hashArchivo(ruta) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const flujo = fs.createReadStream(ruta, { highWaterMark: 1024 * 1024 });
    flujo.on("data", (t) => hash.update(t));
    flujo.on("error", reject);
    flujo.on("end", () => resolve(hash.digest("hex")));
  });
}

export class Almacen {
  constructor(carpetaDestino) {
    this.destino = path.resolve(carpetaDestino);
    this.interna = path.join(this.destino, INTERNA);
    this.ficheroIndice = path.join(this.interna, "indice.json");
    this.ficheroHistorial = path.join(this.interna, "historial.json");
    this.porHash = new Map();       // sha256 → { ruta, nombre, tamano, fecha, origen, importado }
    this.porHuella = new Map();     // nombre|tamaño → sha256 (atajo para no resubir)
    this.historial = [];
    this.guardadoPendiente = null;
  }

  async preparar() {
    await fsp.mkdir(this.interna, { recursive: true });
    try {
      const datos = JSON.parse(await fsp.readFile(this.ficheroIndice, "utf8"));
      for (const [hash, ficha] of Object.entries(datos.archivos || {})) {
        this.porHash.set(hash, ficha);
        this.porHuella.set(huellaRapida(ficha.nombre, ficha.tamano), hash);
      }
    } catch { /* índice nuevo */ }
    try { this.historial = JSON.parse(await fsp.readFile(this.ficheroHistorial, "utf8")) || []; } catch { this.historial = []; }
    return this;
  }

  // --- Persistencia (agrupada: 200 fotos no escriben el índice 200 veces) ----
  planificaGuardado() {
    if (this.guardadoPendiente) return;
    this.guardadoPendiente = setTimeout(() => { this.guardadoPendiente = null; this.guardaAhora(); }, 400);
    this.guardadoPendiente.unref?.();
  }

  guardaAhora() {
    try {
      fs.mkdirSync(this.interna, { recursive: true });
      const archivos = Object.fromEntries(this.porHash);
      fs.writeFileSync(this.ficheroIndice, JSON.stringify({ version: 1, archivos }), "utf8");
      fs.writeFileSync(this.ficheroHistorial, JSON.stringify(this.historial.slice(-MAX_HISTORIAL)), "utf8");
    } catch (e) { console.error("No se pudo guardar el índice:", e.message); }
  }

  // --- Consultas -------------------------------------------------------------
  yaTengoHash(hash) {
    const ficha = this.porHash.get(hash);
    if (!ficha) return null;
    return fs.existsSync(ficha.ruta) ? ficha : (this.porHash.delete(hash), null);
  }

  yaTengoHuella(nombre, tamano) {
    const hash = this.porHuella.get(huellaRapida(nombre, tamano));
    return hash ? this.yaTengoHash(hash) : null;
  }

  /** Carpeta de destino según la preferencia del usuario. */
  carpetaPara(fecha, { organizarPor = "fecha", inmueble = "" } = {}) {
    const nombreInmueble = carpetaSegura(inmueble);
    if (organizarPor === "inmueble" && nombreInmueble) {
      return path.join(this.destino, nombreInmueble, claveFecha(fecha));
    }
    if (organizarPor === "ninguna") return this.destino;
    return path.join(this.destino, claveFecha(fecha));
  }

  /** Nombre final: opcionalmente `2026-09-07_Piso-Oviedo_001.jpg`. */
  nombrePara(nombreOriginal, fecha, carpeta, { renombrar = true, inmueble = "" } = {}) {
    const limpio = nombreSeguro(nombreOriginal, "foto.jpg");
    if (!renombrar) return limpio;
    const ext = extension(limpio) || ".jpg";
    const etiqueta = carpetaSegura(inmueble).replace(/\s+/g, "-");
    const prefijo = `${claveFecha(fecha)}${etiqueta ? `_${etiqueta}` : ""}`;
    let siguiente = 1;
    try {
      const re = new RegExp(`^${prefijo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d{3,})`);
      for (const f of fs.readdirSync(carpeta)) {
        const m = re.exec(f);
        if (m) siguiente = Math.max(siguiente, Number(m[1]) + 1);
      }
    } catch { /* la carpeta aún no existe */ }
    return `${prefijo}_${String(siguiente).padStart(3, "0")}${ext}`;
  }

  /**
   * Mete en su sitio un archivo que ya está en disco (subida terminada, copia
   * desde pendrive o desde otra carpeta del PC).
   *  - `mover: true` cuando el origen es temporal nuestro (subidas).
   * Devuelve { estado: "guardado" | "duplicado", ruta, hash, ficha }.
   */
  async incorporar(rutaOrigen, opciones = {}) {
    const {
      nombre = path.basename(rutaOrigen), origen = "subida", mover = false,
      organizarPor = "fecha", inmueble = "", renombrar = true, fechaCliente = null,
    } = opciones;

    const hash = await hashArchivo(rutaOrigen);
    const yaEsta = this.yaTengoHash(hash);
    if (yaEsta) {
      if (mover) await fsp.rm(rutaOrigen, { force: true });
      return { estado: "duplicado", ruta: yaEsta.ruta, hash, ficha: yaEsta };
    }

    const fecha = await fechaReal(rutaOrigen, fechaCliente ? new Date(fechaCliente) : null, nombre);
    const carpeta = this.carpetaPara(fecha, { organizarPor, inmueble });
    await fsp.mkdir(carpeta, { recursive: true });
    const destino = rutaLibre(
      path.join(carpeta, this.nombrePara(nombre, fecha, carpeta, { renombrar, inmueble })),
      (p) => fs.existsSync(p),
    );

    if (mover) {
      try { await fsp.rename(rutaOrigen, destino); }
      catch { await fsp.copyFile(rutaOrigen, destino); await fsp.rm(rutaOrigen, { force: true }); }
    } else {
      await fsp.copyFile(rutaOrigen, destino);
    }
    try { await fsp.utimes(destino, fecha, fecha); } catch { /* da igual si falla */ }

    const { size } = await fsp.stat(destino);
    const ficha = {
      ruta: destino, nombre: path.basename(destino), tamano: size,
      fecha: fecha.toISOString(), origen, importado: new Date().toISOString(),
      tipo: esVideo(destino) ? "video" : esFoto(destino) ? "foto" : "otro",
    };
    this.porHash.set(hash, ficha);
    this.porHuella.set(huellaRapida(nombre, size), hash);
    this.planificaGuardado();
    return { estado: "guardado", ruta: destino, hash, ficha };
  }

  /**
   * Apunta en el índice un archivo que YA está en su sitio, sin copiarlo ni
   * moverlo. Se usa al pegar dentro de la carpeta de la app: así el móvil no
   * vuelve a mandar esa misma foto como si fuera nueva.
   */
  async registrarExistente(ruta, origen = "pegado") {
    const destino = path.resolve(ruta);
    const info = await fsp.stat(destino);
    if (!info.isFile()) return null;
    const hash = await hashArchivo(destino);
    if (this.porHash.has(hash)) return this.porHash.get(hash);
    const fecha = await fechaReal(destino);
    const ficha = {
      ruta: destino, nombre: path.basename(destino), tamano: info.size,
      fecha: fecha.toISOString(), origen, importado: new Date().toISOString(),
      tipo: esVideo(destino) ? "video" : esFoto(destino) ? "foto" : "otro",
    };
    this.porHash.set(hash, ficha);
    this.porHuella.set(huellaRapida(ficha.nombre, info.size), hash);
    this.planificaGuardado();
    return ficha;
  }

  /** Apunta una transferencia en el historial. */
  apunta(evento) {
    this.historial.push({ cuando: new Date().toISOString(), ...evento });
    if (this.historial.length > MAX_HISTORIAL) this.historial = this.historial.slice(-MAX_HISTORIAL);
    this.planificaGuardado();
  }

  /** Últimos archivos importados, del más nuevo al más viejo. */
  galeria({ limite = 120, desde = 0 } = {}) {
    const todos = [...this.porHash.entries()]
      .map(([hash, f]) => ({ hash, ...f }))
      .sort((a, b) => String(b.importado).localeCompare(String(a.importado)));
    return { total: todos.length, archivos: todos.slice(desde, desde + limite) };
  }

  resumen() {
    let fotos = 0, videos = 0, bytes = 0;
    for (const f of this.porHash.values()) {
      bytes += Number(f.tamano) || 0;
      if (f.tipo === "video") videos++; else fotos++;
    }
    return { fotos, videos, bytes, total: this.porHash.size };
  }
}

const abiertos = new Map();

/** Un almacén por carpeta de destino (se reutiliza entre peticiones). */
export async function abrirAlmacen(carpetaDestino) {
  const clave = path.resolve(carpetaDestino);
  if (!abiertos.has(clave)) abiertos.set(clave, new Almacen(clave).preparar());
  return abiertos.get(clave);
}

export function cerrarAlmacenes() {
  for (const p of abiertos.values()) Promise.resolve(p).then((a) => a.guardaAhora()).catch(() => {});
  abiertos.clear();
}
