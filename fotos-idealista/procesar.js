// ============================================================================
//  Fotos para Idealista — tratamiento de la imagen (funciones puras)
// ----------------------------------------------------------------------------
//  Trabajan sobre los píxeles RGBA de un ImageData (o cualquier objeto
//  {data, width, height}), así que se prueban en Node sin navegador.
//
//  El retoque es SUAVE y fiel: no añade ni borra nada de la foto, solo
//  corrige niveles, un poco de brillo, contraste y color, y enfoca un pelo.
// ============================================================================

export const RETOQUE = {
  recorte: 0.003,      // autocontraste: ignora el 0,3 % más oscuro y el 0,3 % más claro
  maxNegro: 24,        // … pero nunca estira más de esto (retoque ligero)
  minBlanco: 228,
  brillo: 0.05,        // +5 %
  contraste: 0.06,     // +6 %
  saturacion: 0.04,    // +4 %
  enfoque: 0.35,       // cantidad de máscara de enfoque
  umbralEnfoque: 3,    // no enfoca diferencias menores (ruido)
};

/** Medidas finales sin ampliar nunca: el lado largo como mucho `ladoMax`. */
export function medidasSalida(ancho, alto, ladoMax) {
  const w = Math.max(1, Math.round(ancho)), h = Math.max(1, Math.round(alto));
  const escala = Math.min(1, ladoMax / Math.max(w, h));
  return { ancho: Math.max(1, Math.round(w * escala)), alto: Math.max(1, Math.round(h * escala)) };
}

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Histograma de 256 niveles de la luminancia. */
export function histogramaLuminancia(data) {
  const h = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) h[luma(data[i], data[i + 1], data[i + 2]) | 0]++;
  return h;
}

/** Niveles negro/blanco recortando una fracción en cada extremo. */
export function nivelesAutocontraste(hist, recorte = RETOQUE.recorte) {
  let total = 0;
  for (const v of hist) total += v;
  const corte = total * recorte;
  let negro = 0, acum = 0;
  while (negro < 255 && acum + hist[negro] <= corte) acum += hist[negro++];
  let blanco = 255; acum = 0;
  while (blanco > 0 && acum + hist[blanco] <= corte) acum += hist[blanco--];
  return { negro, blanco };
}

/**
 * Tabla de 256 entradas con autocontraste ligero + brillo + contraste.
 * La misma tabla para R, G y B, así que no cambia los colores.
 */
export function tablaRetoque(hist, op = RETOQUE) {
  let { negro, blanco } = nivelesAutocontraste(hist, op.recorte);
  negro = Math.min(negro, op.maxNegro);
  blanco = Math.max(blanco, op.minBlanco);
  if (blanco - negro < 32) { negro = 0; blanco = 255; }   // foto casi plana: no forzar
  const tabla = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = ((v - negro) * 255) / (blanco - negro);
    x = Math.min(255, Math.max(0, x));
    x += op.brillo * (255 - x);                            // aclara sin quemar los blancos
    x = (x - 128) * (1 + op.contraste) + 128;
    tabla[v] = Math.round(x);
  }
  return tabla;
}

/** Aplica tabla + saturación sobre los píxeles (modifica `data`). */
export function aplicarTablaYSaturacion(data, tabla, saturacion = RETOQUE.saturacion) {
  const k = 1 + saturacion;
  for (let i = 0; i < data.length; i += 4) {
    const r = tabla[data[i]], g = tabla[data[i + 1]], b = tabla[data[i + 2]];
    const l = luma(r, g, b);
    data[i] = l + (r - l) * k;
    data[i + 1] = l + (g - l) * k;
    data[i + 2] = l + (b - l) * k;
  }
  return data;
}

/**
 * Máscara de enfoque suave (desenfoque de caja 3×3, separable). Modifica
 * `data` (Uint8ClampedArray, así que los valores quedan en 0-255).
 */
export function enfocar(data, ancho, alto, cantidad = RETOQUE.enfoque, umbral = RETOQUE.umbralEnfoque) {
  if (ancho < 3 || alto < 3 || cantidad <= 0) return data;
  const n = ancho * alto;
  const tmp = new Uint16Array(n);
  for (let c = 0; c < 3; c++) {
    // Horizontal: suma de 3 vecinos.
    for (let y = 0; y < alto; y++) {
      const fila = y * ancho;
      for (let x = 0; x < ancho; x++) {
        const xi = x > 0 ? x - 1 : x, xd = x < ancho - 1 ? x + 1 : x;
        tmp[fila + x] = data[(fila + xi) * 4 + c] + data[(fila + x) * 4 + c] + data[(fila + xd) * 4 + c];
      }
    }
    // Vertical sobre la suma, y aplicar.
    for (let y = 0; y < alto; y++) {
      const arriba = (y > 0 ? y - 1 : y) * ancho, fila = y * ancho, abajo = (y < alto - 1 ? y + 1 : y) * ancho;
      for (let x = 0; x < ancho; x++) {
        const media = (tmp[arriba + x] + tmp[fila + x] + tmp[abajo + x]) / 9;
        const p = (fila + x) * 4 + c;
        const dif = data[p] - media;
        if (dif > umbral || dif < -umbral) data[p] = data[p] + dif * cantidad;
      }
    }
  }
  return data;
}

/** Retoque completo sobre un ImageData (lo modifica y lo devuelve). */
export function retocar(imagen, op = RETOQUE) {
  const tabla = tablaRetoque(histogramaLuminancia(imagen.data), op);
  aplicarTablaYSaturacion(imagen.data, tabla, op.saturacion);
  enfocar(imagen.data, imagen.width, imagen.height, op.enfoque, op.umbralEnfoque);
  return imagen;
}

/** Píxeles RGBA → array de gris (0-255). */
export function aGris(data) {
  const g = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) g[j] = luma(data[i], data[i + 1], data[i + 2]);
  return g;
}

/**
 * Nitidez: varianza del laplaciano sobre el gris. Más alto = más nítida.
 * Se calcula sobre una copia pequeña (~256 px) para comparar fotos entre sí.
 */
export function nitidez(gris, ancho, alto) {
  if (ancho < 3 || alto < 3) return 0;
  let suma = 0, suma2 = 0, n = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const lap = gris[i - 1] + gris[i + 1] + gris[i - ancho] + gris[i + ancho] - 4 * gris[i];
      suma += lap; suma2 += lap * lap; n++;
    }
  }
  const media = suma / n;
  return Math.round((suma2 / n - media * media) * 10) / 10;
}

/**
 * ¿Es un HEIC/HEIF? Mira el tipo, la extensión y, sobre todo, la cabecera
 * real ("ftypheic", "ftypmif1"…), porque Windows a veces no da el tipo.
 * @param {Uint8Array} cabecera  primeros 12 bytes (o más)
 */
export function esHeic(cabecera, nombre = "", tipo = "") {
  if (/^image\/hei[cf]/i.test(tipo)) return true;
  if (/\.hei[cf]$/i.test(nombre)) return true;
  if (!cabecera || cabecera.length < 12) return false;
  const txt = String.fromCharCode(...cabecera.slice(4, 12));
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(txt);
}

/** ¿Tiene el JPEG un bloque EXIF (APP1 «Exif»)? Sirve para comprobar la salida. */
export function tieneExif(bytes) {
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marca = bytes[p + 1];
    if (marca === 0xda || marca === 0xd9) break;           // empiezan los datos de imagen
    const largo = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marca === 0xe1 && String.fromCharCode(...bytes.slice(p + 4, p + 8)) === "Exif") return true;
    p += 2 + largo;
  }
  return false;
}
