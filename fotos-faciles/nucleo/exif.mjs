// ============================================================================
//  Fotos Fáciles — lectura de metadatos sin dependencias
// ----------------------------------------------------------------------------
//  Dos cosas importan aquí:
//   1) La FECHA REAL de la foto (cuándo se disparó), no la de la copia. Es lo
//      que hace que las carpetas por día tengan sentido.
//   2) La MINIATURA que el propio iPhone/Android ya deja incrustada en el EXIF:
//      permite pintar la galería al instante sin redimensionar nada ni instalar
//      librerías de imagen.
//  Se leen JPEG (EXIF), MP4/MOV (caja `mvhd`) y HEIC (caja `exif`).
// ============================================================================
import fs from "node:fs/promises";
import { extension, esVideo } from "./util.mjs";

const LIMITE_CABECERA = 512 * 1024;   // con esto sobra para el bloque EXIF

async function leeTrozo(ruta, desde, largo) {
  const fd = await fs.open(ruta, "r");
  try {
    const buffer = Buffer.alloc(largo);
    const { bytesRead } = await fd.read(buffer, 0, largo, desde);
    return buffer.subarray(0, bytesRead);
  } finally { await fd.close(); }
}

// --- EXIF dentro de un JPEG --------------------------------------------------

/** Localiza el bloque `Exif\0\0` de un JPEG. Devuelve su desplazamiento o -1. */
function buscaBloqueExif(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return -1;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marca = buf[i + 1];
    if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
    if (marca === 0xda || marca === 0xd9) return -1;          // empiezan los datos
    const largo = buf.readUInt16BE(i + 2);
    if (marca === 0xe1 && buf.subarray(i + 4, i + 10).toString("latin1") === "Exif\0\0") return i + 10;
    i += 2 + largo;
  }
  return -1;
}

function fechaExif(texto) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(texto || "").trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d) ? null : d;
}

/**
 * Lee un bloque TIFF/EXIF ya localizado.
 * Devuelve { fecha, orientacion, miniatura: { desde, largo } }.
 */
export function leeTiff(buf, base) {
  const salida = { fecha: null, orientacion: 1, miniatura: null };
  if (base < 0 || base + 8 > buf.length) return salida;
  const orden = buf.subarray(base, base + 2).toString("latin1");
  if (orden !== "II" && orden !== "MM") return salida;
  const ge = orden === "II";
  const u16 = (p) => (ge ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const u32 = (p) => (ge ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
  if (u16(base + 2) !== 42) return salida;

  const TAMANOS = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const campos = (posIfd) => {
    const lista = [];
    if (posIfd + 2 > buf.length) return lista;
    const total = u16(posIfd);
    for (let i = 0; i < total; i++) {
      const p = posIfd + 2 + i * 12;
      if (p + 12 > buf.length) break;
      const etiqueta = u16(p), tipo = u16(p + 2), cuenta = u32(p + 4);
      const bytes = (TAMANOS[tipo] || 1) * cuenta;
      const valorPos = bytes <= 4 ? p + 8 : base + u32(p + 8);
      lista.push({ etiqueta, tipo, cuenta, valorPos, bytes });
    }
    const siguiente = posIfd + 2 + total * 12;
    return Object.assign(lista, { siguiente: siguiente + 4 <= buf.length ? u32(siguiente) : 0 });
  };
  const texto = (c) => (c.valorPos + c.bytes <= buf.length
    ? buf.subarray(c.valorPos, c.valorPos + c.bytes).toString("latin1").replace(/\0.*$/, "")
    : "");

  const ifd0 = campos(base + u32(base + 4));
  let posExif = 0;
  for (const c of ifd0) {
    if (c.etiqueta === 0x0112 && c.valorPos + 2 <= buf.length) salida.orientacion = u16(c.valorPos) || 1;
    if (c.etiqueta === 0x8769) posExif = u32(c.valorPos);
    if (c.etiqueta === 0x0132 && !salida.fecha) salida.fecha = fechaExif(texto(c));
  }
  if (posExif) {
    for (const c of campos(base + posExif)) {
      // 0x9003 DateTimeOriginal manda sobre 0x9004 (fecha de digitalización).
      if (c.etiqueta === 0x9003) salida.fecha = fechaExif(texto(c)) || salida.fecha;
      else if (c.etiqueta === 0x9004 && !salida.fecha) salida.fecha = fechaExif(texto(c));
    }
  }
  // IFD1: ahí vive la miniatura que ya generó la cámara.
  if (ifd0.siguiente) {
    let desde = 0, largo = 0;
    for (const c of campos(base + ifd0.siguiente)) {
      if (c.etiqueta === 0x0201) desde = u32(c.valorPos);
      if (c.etiqueta === 0x0202) largo = u32(c.valorPos);
    }
    if (desde && largo) salida.miniatura = { desde: base + desde, largo };
  }
  return salida;
}

// --- Cajas ISO-BMFF (MP4, MOV, HEIC) ----------------------------------------

/** Recorre las cajas de nivel superior y devuelve las que interesan. */
function recorreCajas(buf, desde, hasta, visita, profundidad = 0) {
  let p = desde;
  while (p + 8 <= hasta) {
    let largo = buf.readUInt32BE(p);
    const tipo = buf.subarray(p + 4, p + 8).toString("latin1");
    let cabecera = 8;
    if (largo === 1) {
      if (p + 16 > hasta) break;
      largo = Number(buf.readBigUInt64BE(p + 8));
      cabecera = 16;
    } else if (largo === 0) largo = hasta - p;
    if (largo < cabecera) break;
    if (visita(tipo, p + cabecera, Math.min(p + largo, hasta), profundidad) === false) return false;
    p += largo;
  }
  return true;
}

const CONTENEDORAS = new Set(["moov", "trak", "mdia", "meta", "iprp", "ipco"]);

/** Fecha de creación de un MP4/MOV a partir de la caja `mvhd`. */
export function fechaIsoBmff(buf) {
  let fecha = null;
  const visita = (tipo, ini, fin, prof) => {
    if (tipo === "mvhd" || tipo === "mdhd") {
      const version = buf[ini];
      let segundos = null;
      if (version === 0 && ini + 12 <= fin) segundos = buf.readUInt32BE(ini + 4);
      else if (version === 1 && ini + 20 <= fin) segundos = Number(buf.readBigUInt64BE(ini + 4));
      // El reloj de QuickTime empieza el 1-1-1904; 0 significa "sin fecha".
      if (segundos && segundos > 0) {
        const d = new Date((segundos - 2082844800) * 1000);
        if (!isNaN(d) && d.getFullYear() > 1970 && d.getFullYear() < 2100) fecha = fecha || d;
      }
      return fecha ? false : true;
    }
    if (CONTENEDORAS.has(tipo) && prof < 4) return recorreCajas(buf, ini, fin, visita, prof + 1);
    return true;
  };
  recorreCajas(buf, 0, buf.length, visita);
  return fecha;
}

/** Bloque EXIF incrustado en un HEIC (el iPhone lo guarda en una caja `Exif`). */
function exifEnHeic(buf) {
  const marca = buf.indexOf(Buffer.from("Exif\0\0", "latin1"));
  if (marca === -1) return -1;
  return marca + 6;
}

// --- API pública -------------------------------------------------------------

/**
 * Metadatos útiles de una foto o vídeo del disco.
 * `como` sirve para archivos temporales (una subida a medias se llama
 * `abc.parcial`, pero por dentro es el JPEG del iPhone).
 * Nunca lanza: si el archivo no trae nada, devuelve todo a null.
 */
export async function metadatos(ruta, { como = null } = {}) {
  const vacio = { fecha: null, orientacion: 1, miniatura: null };
  try {
    const nombre = como || ruta;
    const ext = extension(nombre);
    const buf = await leeTrozo(ruta, 0, LIMITE_CABECERA);
    if (!buf.length) return vacio;
    if (ext === ".jpg" || ext === ".jpeg") return leeTiff(buf, buscaBloqueExif(buf));
    if (ext === ".tif" || ext === ".tiff" || ext === ".dng") return leeTiff(buf, 0);
    if (ext === ".heic" || ext === ".heif" || ext === ".avif") return leeTiff(buf, exifEnHeic(buf));
    if (esVideo(nombre)) return { ...vacio, fecha: fechaIsoBmff(buf) };
    return vacio;
  } catch { return vacio; }
}

/** Fecha real del disparo; si no hay metadatos, la de modificación del archivo. */
export async function fechaReal(ruta, respaldo = null, como = null) {
  const { fecha } = await metadatos(ruta, { como });
  if (fecha) return fecha;
  if (respaldo instanceof Date && !isNaN(respaldo)) return respaldo;
  try { return (await fs.stat(ruta)).mtime; } catch { return new Date(); }
}

/** Miniatura incrustada (JPEG) o null si el archivo no trae ninguna. */
export async function miniaturaIncrustada(ruta, como = null) {
  try {
    const { miniatura } = await metadatos(ruta, { como });
    if (!miniatura || miniatura.largo <= 0 || miniatura.largo > 4 * 1024 * 1024) return null;
    const trozo = await leeTrozo(ruta, miniatura.desde, miniatura.largo);
    if (trozo.length < 4 || trozo[0] !== 0xff || trozo[1] !== 0xd8) return null;
    return trozo;
  } catch { return null; }
}
