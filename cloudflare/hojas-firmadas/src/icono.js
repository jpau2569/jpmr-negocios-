// ============================================================================
//  Icono de la app (PNG) con los colores de la marca — sin librerías
// ----------------------------------------------------------------------------
//  Cada inmobiliaria tiene su copia y sus colores, así que el icono que se
//  instala en el móvil se dibuja aquí: fondo del color principal, una hoja
//  blanca con renglones y una firma del color de acento. Todo dentro del
//  80 % central, para que valga también como icono «maskable» (Android lo
//  recorta en círculo o en gota).
//  PNG RGB de 8 bits; la compresión zlib la hace CompressionStream('deflate'),
//  que existe en Workers, en los navegadores y en Node 18+.
// ============================================================================
import { rgbDeHex } from "../public/static/cerebro/documentos.js";

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const t = new TextEncoder().encode(tipo);
  const salida = new Uint8Array(12 + datos.length);
  const v = new DataView(salida.buffer);
  v.setUint32(0, datos.length);
  salida.set(t, 4);
  salida.set(datos, 8);
  const conTipo = new Uint8Array(4 + datos.length);
  conTipo.set(t, 0);
  conTipo.set(datos, 4);
  v.setUint32(8 + datos.length, crc32(conTipo));
  return salida;
}

async function zlib(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Píxeles RGB (Uint8Array ancho*alto*3) → PNG. */
export async function codificaPng(ancho, alto, rgb) {
  const filas = new Uint8Array(alto * (ancho * 3 + 1));
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 3 + 1)] = 0; // filtro «ninguno»
    filas.set(rgb.subarray(y * ancho * 3, (y + 1) * ancho * 3), y * (ancho * 3 + 1) + 1);
  }
  const cabecera = new Uint8Array(13);
  const v = new DataView(cabecera.buffer);
  v.setUint32(0, ancho);
  v.setUint32(4, alto);
  cabecera.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, sin entrelazar
  const partes = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", cabecera),
    trozo("IDAT", await zlib(filas)),
    trozo("IEND", new Uint8Array(0)),
  ];
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) { total.set(p, pos); pos += p.length; }
  return total;
}

/** Dibuja el icono (con suavizado 2×2) y devuelve el PNG. */
export async function iconoPng(tam, colorPrincipal, colorAcento) {
  const fondo = rgbDeHex(colorPrincipal) || [16, 32, 58];
  const acento = rgbDeHex(colorAcento) || [201, 162, 39];
  const BLANCO = [255, 255, 255];
  const RENGLON = [200, 205, 214];
  const N = tam;
  // Hoja: de 0,29 a 0,71 en x y de 0,18 a 0,80 en y, con esquinas redondeadas.
  const hx0 = 0.29 * N, hx1 = 0.71 * N, hy0 = 0.18 * N, hy1 = 0.8 * N, radio = 0.035 * N;
  const grueso = 0.022 * N;
  const renglones = [0.3, 0.38, 0.46].map((f) => f * N);
  const firma = (x) => 0.64 * N + 0.045 * N * Math.sin(((x - 0.34 * N) / (0.32 * N)) * Math.PI * 3) * (1 - (x - 0.34 * N) / (0.5 * N));
  const dentroHoja = (x, y) => {
    if (x < hx0 || x > hx1 || y < hy0 || y > hy1) return false;
    const cx = Math.min(Math.max(x, hx0 + radio), hx1 - radio);
    const cy = Math.min(Math.max(y, hy0 + radio), hy1 - radio);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radio ** 2;
  };
  const colorEn = (x, y) => {
    if (!dentroHoja(x, y)) return fondo;
    if (x >= 0.34 * N && x <= 0.66 * N) {
      if (Math.abs(y - firma(x)) <= 0.016 * N) return acento;
      if (y >= 0.715 * N && y <= 0.715 * N + 0.008 * N) return RENGLON;
    }
    if (x >= 0.35 * N && x <= 0.65 * N && renglones.some((r) => y >= r && y <= r + grueso * 0.6)) return RENGLON;
    return BLANCO;
  };
  const rgb = new Uint8Array(N * N * 3);
  const muestras = [0.25, 0.75];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0;
      for (const sy of muestras) for (const sx of muestras) {
        const c = colorEn(x + sx, y + sy);
        r += c[0]; g += c[1]; b += c[2];
      }
      const i = (y * N + x) * 3;
      rgb[i] = r / 4; rgb[i + 1] = g / 4; rgb[i + 2] = b / 4;
    }
  }
  return codificaPng(N, N, rgb);
}
