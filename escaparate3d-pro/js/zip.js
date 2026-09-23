// ============================================================================
//  Escaparate 3D Pro — ZIP mínimo (sin librerías)
// ----------------------------------------------------------------------------
//  Lo usa "Construir Total" para descargar el paquete completo de un cliente:
//  los archivos del producto + su config/negocio.json + el README de despliegue,
//  listos para subir a Vercel o a un hosting. Guarda los ficheros SIN comprimir
//  (método "store"), que es válido en cualquier descompresor y cabe en 80 líneas
//  en vez de meter una dependencia de 200 KB.
// ============================================================================

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[i] = c >>> 0;
  }
  return tabla;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fecha y hora en el formato MS-DOS que usa el ZIP.
function fechaDos(d = new Date()) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, fecha };
}

function escribir(vista, offset, valores) {
  let o = offset;
  for (const [tam, valor] of valores) {
    if (tam === 2) { vista.setUint16(o, valor, true); o += 2; }
    else { vista.setUint32(o, valor, true); o += 4; }
  }
  return o;
}

/**
 * @param {{nombre: string, contenido: string|Uint8Array}[]} archivos
 * @returns {Blob} ZIP listo para descargar
 */
export function crearZip(archivos, fecha = new Date()) {
  const codificador = new TextEncoder();
  const { hora, fecha: dosFecha } = fechaDos(fecha);
  const entradas = archivos.map((a) => {
    const datos = typeof a.contenido === "string" ? codificador.encode(a.contenido) : a.contenido;
    return { nombre: codificador.encode(a.nombre), datos, crc: crc32(datos) };
  });

  const trozos = [];
  let offset = 0;
  const centrales = [];

  for (const e of entradas) {
    const cabecera = new Uint8Array(30 + e.nombre.length);
    const v = new DataView(cabecera.buffer);
    escribir(v, 0, [[4, 0x04034b50], [2, 20], [2, 0x0800], [2, 0], [2, hora], [2, dosFecha],
      [4, e.crc], [4, e.datos.length], [4, e.datos.length], [2, e.nombre.length], [2, 0]]);
    cabecera.set(e.nombre, 30);
    trozos.push(cabecera, e.datos);
    centrales.push({ ...e, offset });
    offset += cabecera.length + e.datos.length;
  }

  const inicioDirectorio = offset;
  for (const e of centrales) {
    const central = new Uint8Array(46 + e.nombre.length);
    const v = new DataView(central.buffer);
    escribir(v, 0, [[4, 0x02014b50], [2, 20], [2, 20], [2, 0x0800], [2, 0], [2, hora], [2, dosFecha],
      [4, e.crc], [4, e.datos.length], [4, e.datos.length], [2, e.nombre.length],
      [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, e.offset]]);
    central.set(e.nombre, 46);
    trozos.push(central);
    offset += central.length;
  }

  const fin = new Uint8Array(22);
  escribir(new DataView(fin.buffer), 0, [[4, 0x06054b50], [2, 0], [2, 0],
    [2, centrales.length], [2, centrales.length], [4, offset - inicioDirectorio], [4, inicioDirectorio], [2, 0]]);
  trozos.push(fin);

  return new Blob(trozos, { type: "application/zip" });
}

export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
