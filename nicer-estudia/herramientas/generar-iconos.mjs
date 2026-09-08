/* Genera los iconos PNG de Nicer Estudia sin dependencias.
   Rasteriza en grande (supermuestreo) y reduce, que es lo que da el suavizado.
   Uso:  node nicer-estudia/herramientas/generar-iconos.mjs                  */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = 1024;              // lienzo maestro
const MUESTREO = 3;          // 3×3 muestras por píxel del maestro

const COLOR = {
  fondo: [0x0f, 0x4c, 0x6b],
  papel: [0xf6, 0xf5, 0xf2],
  linea: [0x9d, 0xb7, 0xc6],
  chispa: [0xf0, 0xb2, 0x55]
};

/* ── Formas: funciones que dicen si un punto está dentro ─────────── */
const rectRedondo = (x0, y0, x1, y1, r) => (x, y) => {
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  return dx * dx + dy * dy <= r * r;
};

/* Punto en polígono por cruces (regla par-impar). */
const poligono = (puntos) => (x, y) => {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const [xi, yi] = puntos[i];
    const [xj, yj] = puntos[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

const estrella = (cx, cy, radio) => {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radio : radio * 0.34;
    p.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
  }
  return poligono(p);
};

/* ── Composición de la marca ─────────────────────────────────────── */
function capas(escala = 1) {
  const c = (v) => N / 2 + (v - N / 2) * escala; // escala respecto al centro
  const P = (pts) => pts.map(([x, y]) => [c(x), c(y)]);

  return [
    // Libro abierto: dos páginas con el lomo en el centro.
    { dentro: poligono(P([[190, 396], [498, 344], [498, 726], [190, 726]])), color: COLOR.papel },
    { dentro: poligono(P([[834, 396], [526, 344], [526, 726], [834, 726]])), color: COLOR.papel },
    // Renglones, solo insinuados: a 48 px ya no se ven, pero a 512 dan vida.
    { dentro: poligono(P([[240, 470], [450, 434], [450, 466], [240, 502]])), color: COLOR.linea },
    { dentro: poligono(P([[240, 560], [450, 524], [450, 556], [240, 592]])), color: COLOR.linea },
    { dentro: poligono(P([[574, 434], [784, 470], [784, 502], [574, 466]])), color: COLOR.linea },
    { dentro: poligono(P([[574, 524], [784, 560], [784, 592], [574, 556]])), color: COLOR.linea },
    // La chispa: la idea que se enciende.
    { dentro: estrella(c(760), c(250), 118 * escala), color: COLOR.chispa }
  ];
}

/* ── Rasterizado ─────────────────────────────────────────────────── */
function pinta({ maskable = false } = {}) {
  const px = new Uint8Array(N * N * 4);
  const fondo = maskable
    ? rectRedondo(0, 0, N - 1, N - 1, 0)          // el sistema recorta él mismo
    : rectRedondo(0, 0, N - 1, N - 1, N * 0.22);
  const dibujo = capas(maskable ? 0.72 : 1);
  const paso = 1 / MUESTREO;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < MUESTREO; sy++) {
        for (let sx = 0; sx < MUESTREO; sx++) {
          const mx = x + (sx + 0.5) * paso;
          const my = y + (sy + 0.5) * paso;
          let color = null;
          if (fondo(mx, my)) color = COLOR.fondo;
          for (const capa of dibujo) if (capa.dentro(mx, my)) color = capa.color;
          if (color) { r += color[0]; g += color[1]; b += color[2]; a += 255; }
        }
      }
      const muestras = MUESTREO * MUESTREO;
      const i = (y * N + x) * 4;
      const opacas = a / 255;
      px[i] = opacas ? Math.round(r / opacas) : 0;
      px[i + 1] = opacas ? Math.round(g / opacas) : 0;
      px[i + 2] = opacas ? Math.round(b / opacas) : 0;
      px[i + 3] = Math.round(a / muestras);
    }
  }
  return px;
}

/** Reduce por media de bloques: es lo que suaviza los bordes. */
function reduce(px, destino) {
  const salida = new Uint8Array(destino * destino * 4);
  const bloque = N / destino;
  for (let y = 0; y < destino; y++) {
    for (let x = 0; x < destino; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let by = Math.floor(y * bloque); by < Math.floor((y + 1) * bloque); by++) {
        for (let bx = Math.floor(x * bloque); bx < Math.floor((x + 1) * bloque); bx++) {
          const i = (by * N + bx) * 4;
          const alfa = px[i + 3] / 255;
          r += px[i] * alfa; g += px[i + 1] * alfa; b += px[i + 2] * alfa; a += px[i + 3];
          n++;
        }
      }
      const i = (y * destino + x) * 4;
      const suma = a / 255;
      salida[i] = suma ? Math.round(r / suma) : 0;
      salida[i + 1] = suma ? Math.round(g / suma) : 0;
      salida[i + 2] = suma ? Math.round(b / suma) : 0;
      salida[i + 3] = Math.round(a / n);
    }
  }
  return salida;
}

/* ── Codificación PNG ────────────────────────────────────────────── */
const crc32 = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const byte of buf) c = tabla[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(px, lado) {
  const filas = Buffer.alloc(lado * (lado * 4 + 1));
  for (let y = 0; y < lado; y++) {
    filas[y * (lado * 4 + 1)] = 0; // filtro "none"
    Buffer.from(px.buffer, y * lado * 4, lado * 4).copy(filas, y * (lado * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/* ── Salida ──────────────────────────────────────────────────────── */
const normal = pinta();
const mascara = pinta({ maskable: true });

for (const lado of [512, 192, 180]) {
  writeFileSync(join(SALIDA, `icono-${lado}.png`), png(reduce(normal, lado), lado));
  console.log(`icono-${lado}.png`);
}
for (const lado of [512, 192]) {
  writeFileSync(join(SALIDA, `icono-maskable-${lado}.png`), png(reduce(mascara, lado), lado));
  console.log(`icono-maskable-${lado}.png`);
}
