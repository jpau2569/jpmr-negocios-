// ============================================================================
//  ZIP mínimo, sin dependencias: escritor en streaming y lector seguro.
//  Límites asumidos y declarados: sin ZIP64 (cada archivo y el total < 4 GB,
//  hasta 65 535 entradas), solo métodos «almacenado» y «deflate», sin cifrado.
//  El lector valida nombres (sin «..», sin rutas absolutas), CRC y tamaños, y
//  corta si una entrada se hincha más de lo que declara (zip bomb).
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import zlib from "node:zlib";
import { once } from "node:events";
import { ErrorApp } from "./util.mjs";

const SIG_LOCAL = 0x04034b50;
const SIG_DESC = 0x08074b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_FIN = 0x06054b50;
const MAX32 = 0xffffffff;
const sinZip64 = () => new ErrorApp(500, "zip_grande", "La copia supera los 4 GB que admite este formato. Haz copias de los archivos pesados por separado.");

function marcaDos(d) {
  return {
    hora: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    fecha: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

/** Nombre permitido dentro de un ZIP (sirve para escribir y para leer). */
export function nombreSeguro(nombre) {
  if (typeof nombre !== "string" || !nombre || nombre.length > 255) return false;
  if (/[\u0000-\u001f\\:]/.test(nombre) || nombre.startsWith("/")) return false;
  return nombre.replace(/\/$/, "").split("/").every((s) => s && s !== "." && s !== "..");
}

export class EscritorZip {
  constructor(ruta) { this.ruta = ruta; this.fd = null; this.pos = 0; this.entradas = []; }
  async abrir() { this.fd = await fsp.open(this.ruta, "w"); return this; }
  async #escribir(buf) { await this.fd.write(buf, 0, buf.length, this.pos); this.pos += buf.length; }

  #cabecera(nombre, { descriptor, hora, fecha, crc = 0, csize = 0, usize = 0 }) {
    const n = Buffer.from(nombre, "utf8");
    const b = Buffer.alloc(30 + n.length);
    b.writeUInt32LE(SIG_LOCAL, 0); b.writeUInt16LE(20, 4); b.writeUInt16LE(descriptor ? 0x0808 : 0x0800, 6); b.writeUInt16LE(8, 8);
    b.writeUInt16LE(hora, 10); b.writeUInt16LE(fecha, 12); b.writeUInt32LE(crc, 14); b.writeUInt32LE(csize, 18); b.writeUInt32LE(usize, 22);
    b.writeUInt16LE(n.length, 26); b.writeUInt16LE(0, 28); n.copy(b, 30);
    return { b, n };
  }

  async anadirBuffer(nombre, datos, fecha = new Date()) {
    if (!nombreSeguro(nombre)) throw new ErrorApp(500, "zip_nombre", `Nombre no válido en el ZIP: ${nombre}`);
    const comprimido = zlib.deflateRawSync(datos, { level: 6 });
    const crc = zlib.crc32(datos);
    const m = marcaDos(fecha);
    const offset = this.pos;
    if (offset > MAX32 || comprimido.length > MAX32) throw sinZip64();
    const { b, n } = this.#cabecera(nombre, { descriptor: false, ...m, crc, csize: comprimido.length, usize: datos.length });
    await this.#escribir(b);
    await this.#escribir(comprimido);
    this.entradas.push({ n, crc, csize: comprimido.length, usize: datos.length, offset, flags: 0x0800, ...m });
  }

  async anadirArchivo(nombre, rutaDisco) {
    if (!nombreSeguro(nombre)) throw new ErrorApp(500, "zip_nombre", `Nombre no válido en el ZIP: ${nombre}`);
    const st = await fsp.stat(rutaDisco);
    const m = marcaDos(st.mtime);
    const offset = this.pos;
    if (offset > MAX32 || st.size > MAX32) throw sinZip64();
    const { b, n } = this.#cabecera(nombre, { descriptor: true, ...m });
    await this.#escribir(b);
    let crc = 0, usize = 0, csize = 0;
    const def = zlib.createDeflateRaw({ level: 6 });
    const consumo = (async () => { for await (const trozo of def) { await this.#escribir(trozo); csize += trozo.length; } })();
    try {
      for await (const trozo of fs.createReadStream(rutaDisco)) {
        crc = zlib.crc32(trozo, crc);
        usize += trozo.length;
        if (!def.write(trozo)) await once(def, "drain");
      }
      def.end();
      await consumo;
    } catch (e) { def.destroy(); consumo.catch(() => {}); throw e; }
    if (csize > MAX32 || usize > MAX32) throw sinZip64();
    const d = Buffer.alloc(16);
    d.writeUInt32LE(SIG_DESC, 0); d.writeUInt32LE(crc, 4); d.writeUInt32LE(csize, 8); d.writeUInt32LE(usize, 12);
    await this.#escribir(d);
    this.entradas.push({ n, crc, csize, usize, offset, flags: 0x0808, ...m });
  }

  async cerrar() {
    const inicioCentral = this.pos;
    if (this.entradas.length > 0xffff) throw sinZip64();
    for (const e of this.entradas) {
      const b = Buffer.alloc(46 + e.n.length);
      b.writeUInt32LE(SIG_CENTRAL, 0); b.writeUInt16LE(20, 4); b.writeUInt16LE(20, 6); b.writeUInt16LE(e.flags, 8); b.writeUInt16LE(8, 10);
      b.writeUInt16LE(e.hora, 12); b.writeUInt16LE(e.fecha, 14); b.writeUInt32LE(e.crc, 16); b.writeUInt32LE(e.csize, 20); b.writeUInt32LE(e.usize, 24);
      b.writeUInt16LE(e.n.length, 28); b.writeUInt32LE(e.offset, 42); e.n.copy(b, 46);
      await this.#escribir(b);
    }
    const tamCentral = this.pos - inicioCentral;
    if (inicioCentral > MAX32 || this.pos > MAX32) throw sinZip64();
    const f = Buffer.alloc(22);
    f.writeUInt32LE(SIG_FIN, 0); f.writeUInt16LE(this.entradas.length, 8); f.writeUInt16LE(this.entradas.length, 10);
    f.writeUInt32LE(tamCentral, 12); f.writeUInt32LE(inicioCentral, 16);
    await this.#escribir(f);
    await this.fd.sync();
    await this.fd.close();
    this.fd = null;
  }
  async abortar() { try { await this.fd?.close(); } catch { /* ya cerrado */ } }
}

// ------------------------------------------------------------------ lector ----
export async function leerZip(ruta, { maxEntradas = 20000 } = {}) {
  const fd = await fsp.open(ruta, "r");
  try {
    const { size } = await fd.stat();
    if (size < 22) throw new ErrorApp(422, "zip_invalido", "El archivo no es una copia válida (demasiado pequeño).");
    const cola = Buffer.alloc(Math.min(size, 22 + 65535));
    await fd.read(cola, 0, cola.length, size - cola.length);
    let pos = -1;
    for (let i = cola.length - 22; i >= 0; i--) if (cola.readUInt32LE(i) === SIG_FIN) { pos = i; break; }
    if (pos < 0) throw new ErrorApp(422, "zip_invalido", "El archivo no es una copia válida (no parece un ZIP completo; ¿se cortó la descarga?).");
    const total = cola.readUInt16LE(pos + 10);
    const tamCentral = cola.readUInt32LE(pos + 12);
    const inicioCentral = cola.readUInt32LE(pos + 16);
    if (total > maxEntradas || inicioCentral + tamCentral > size) throw new ErrorApp(422, "zip_invalido", "La copia está dañada (directorio fuera de rango).");
    const central = Buffer.alloc(tamCentral);
    await fd.read(central, 0, tamCentral, inicioCentral);
    const entradas = [];
    let o = 0;
    for (let i = 0; i < total; i++) {
      if (o + 46 > central.length || central.readUInt32LE(o) !== SIG_CENTRAL) throw new ErrorApp(422, "zip_invalido", "La copia está dañada (directorio ilegible).");
      const flags = central.readUInt16LE(o + 8);
      const metodo = central.readUInt16LE(o + 10);
      const crc = central.readUInt32LE(o + 16);
      const csize = central.readUInt32LE(o + 20);
      const usize = central.readUInt32LE(o + 24);
      const ln = central.readUInt16LE(o + 28), le = central.readUInt16LE(o + 30), lc = central.readUInt16LE(o + 32);
      const offset = central.readUInt32LE(o + 42);
      const nombre = central.subarray(o + 46, o + 46 + ln).toString((flags & 0x0800) ? "utf8" : "latin1");
      entradas.push({ nombre, flags, metodo, crc, csize, usize, offset });
      o += 46 + ln + le + lc;
    }
    return { entradas, size };
  } finally { await fd.close(); }
}

/**
 * Descomprime una entrada en streaming comprobando CRC y tamaño.
 * Si `destino` es null solo verifica y devuelve el SHA-256 (para validar sin escribir).
 */
export async function extraerEntrada(ruta, e, destino, { crypto } = {}) {
  if (e.flags & 1) throw new ErrorApp(422, "zip_cifrado", "La copia está cifrada; este programa no la admite.");
  if (![0, 8].includes(e.metodo)) throw new ErrorApp(422, "zip_metodo", "La copia usa una compresión no admitida.");
  if (!nombreSeguro(e.nombre)) throw new ErrorApp(422, "zip_nombre", `La copia contiene un nombre no permitido: ${e.nombre}`);
  const fd = await fsp.open(ruta, "r");
  let inicio;
  try {
    const cab = Buffer.alloc(30);
    await fd.read(cab, 0, 30, e.offset);
    if (cab.readUInt32LE(0) !== SIG_LOCAL) throw new ErrorApp(422, "zip_invalido", "La copia está dañada (cabecera de archivo ilegible).");
    inicio = e.offset + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
  } finally { await fd.close(); }

  const lector = e.csize === 0 ? null : fs.createReadStream(ruta, { start: inicio, end: inicio + e.csize - 1 });
  const hash = crypto ? crypto.createHash("sha256") : null;
  // `destino`: ruta de archivo, un Writable (p. ej. para leer en memoria) o null (solo verificar).
  const salida = typeof destino === "string" ? fs.createWriteStream(destino) : destino || null;
  let crc = 0, bytes = 0;
  const trozos = lector ? (e.metodo === 8 ? lector.pipe(zlib.createInflateRaw()) : lector) : [];
  try {
    for await (const t of trozos) {
      bytes += t.length;
      if (bytes > e.usize) throw new ErrorApp(422, "zip_bomba", "La copia contiene un archivo mayor de lo que declara; se descarta por seguridad.");
      crc = zlib.crc32(t, crc);
      hash?.update(t);
      if (salida && !salida.write(t)) await once(salida, "drain");
    }
    if (bytes !== e.usize || crc !== e.crc) {
      throw new ErrorApp(422, "zip_corrupto", `La copia está dañada: «${e.nombre}» no coincide con su suma de comprobación.`);
    }
    if (salida) { salida.end(); await once(salida, "finish"); }
  } catch (err) {
    salida?.destroy();
    lector?.destroy();
    if (err instanceof ErrorApp) throw err;
    throw new ErrorApp(422, "zip_corrupto", `La copia está dañada o incompleta (${err.code || err.message}).`);
  }
  return { bytes, sha256: hash ? hash.digest("hex") : null };
}
