/* Genera los iconos PNG de la app a partir de la marca, sin dependencias.
   Rasteriza con antialiasing por distancia y codifica el PNG con zlib.
   Uso:  node herramientas/generar-iconos.mjs                              */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAESTRO = 1024;                       // se rasteriza grande y se reduce

const COLOR = {
  papel:  [0xf4, 0xf3, 0xef],
  tinta:  [0x0d, 0x0f, 0x12],
  sol:    [0xc8, 0x79, 0x0f],
  niebla: [0x79, 0x85, 0x8f],
  agua:   [0x1a, 0x6a, 0x90]
};

/* ── Lienzo ─────────────────────────────────────────────────────────── */
const lienzo = n => ({ n, px: new Float64Array(n * n * 4) });

/** Mezcla un color sobre el lienzo con cobertura 0-1. */
function pinta(l, x, y, [r, g, b], cobertura){
  if (cobertura <= 0) return;
  const i = (y * l.n + x) * 4, a = Math.min(1, cobertura);
  l.px[i]   = l.px[i]   * (1 - a) + r * a;
  l.px[i+1] = l.px[i+1] * (1 - a) + g * a;
  l.px[i+2] = l.px[i+2] * (1 - a) + b * a;
  l.px[i+3] = l.px[i+3] * (1 - a) + 255 * a;
}

const suave = d => Math.min(1, Math.max(0, .5 - d));   // antialiasing de 1 px

/** Dibuja con una función de distancia con signo, sólo dentro de su caja. */
function forma(l, sdf, color, recorte = null, caja = null){
  const x0 = caja ? Math.max(0, Math.floor(caja[0])) : 0;
  const y0 = caja ? Math.max(0, Math.floor(caja[1])) : 0;
  const x1 = caja ? Math.min(l.n, Math.ceil(caja[2])) : l.n;
  const y1 = caja ? Math.min(l.n, Math.ceil(caja[3])) : l.n;
  for (let y = y0; y < y1; y++){
    for (let x = x0; x < x1; x++){
      let c = suave(sdf(x + .5, y + .5));
      if (c <= 0) continue;
      if (recorte) c *= Math.min(1, Math.max(0, .5 + recorte(x + .5, y + .5)));
      pinta(l, x, y, color, c);
    }
  }
}

const sdfCirculo = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const sdfRectRedondo = (cx, cy, w, h, r) => (x, y) => {
  const dx = Math.abs(x - cx) - (w / 2 - r), dy = Math.abs(y - cy) - (h / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
/** Trazo redondeado a lo largo de una curva muestreada. */
const sdfTrazo = (puntos, grosor) => (x, y) => {
  let min = Infinity;
  for (let i = 0; i < puntos.length - 1; i++){
    const [ax, ay] = puntos[i], [bx, by] = puntos[i + 1];
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
    const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
    if (d < min) min = d;
  }
  return min - grosor / 2;
};

/* ── La marca: sol cortado por bandas de niebla sobre el agua ────────── */
function dibujaMarca(l, { fondo = null, escala = 1, tinte = null } = {}){
  const u = l.n / 512;                                  // unidad de diseño
  const cx = l.n / 2, cy = l.n / 2;
  const E = (v) => v * u * escala;
  const px = (v) => cx + E(v - 256);
  const py = (v) => cy + E(v - 256);

  if (fondo) forma(l, sdfRectRedondo(cx, cy, l.n, l.n, l.n * 0.22), fondo);

  const cSol    = tinte ?? COLOR.sol;
  const cNiebla = tinte ?? COLOR.niebla;
  const cAgua   = tinte ?? COLOR.agua;

  // El sol se recorta con las dos bandas de niebla (mismo efecto que el SVG)
  // Las bandas cortan el sol y son algo más altas que las barras grises,
  // así queda un hilo de papel entre el naranja y el gris.
  const banda1 = [py(216), py(246)], banda2 = [py(272), py(302)];
  const dentro = (y, [a0, b0]) => Math.min(y - a0, b0 - y);   // > 0 si está dentro
  const recorte = (x, y) => -Math.max(dentro(y, banda1), dentro(y, banda2));
  const caja = (cx0, cy0, w, h) => [cx0 - w/2 - 2, cy0 - h/2 - 2, cx0 + w/2 + 2, cy0 + h/2 + 2];
  forma(l, sdfCirculo(px(256), py(222), E(106)), cSol, recorte,
    caja(px(256), py(222), E(212), E(212)));
  forma(l, sdfRectRedondo(px(256), py(229), E(324), E(18), E(9)), cNiebla, null,
    caja(px(256), py(229), E(324), E(18)));
  forma(l, sdfRectRedondo(px(256), py(285), E(220), E(18), E(9)), cNiebla, null,
    caja(px(256), py(285), E(220), E(18)));

  // Onda: dos arcos, muestreados como polilínea
  const onda = [];
  for (let t = 0; t <= 1.0001; t += 1 / 96){
    const x = 104 + t * 304;
    const y = 402 - Math.sin(t * Math.PI * 2) * 26;
    onda.push([px(x), py(y)]);
  }
  forma(l, sdfTrazo(onda, E(22)), cAgua, null,
    [px(104) - E(16), py(402 - 26) - E(16), px(408) + E(16), py(402 + 26) + E(16)]);
}

/* ── Reducción por área y codificación PNG ───────────────────────────── */
function reduce(l, destino){
  const f = l.n / destino, out = Buffer.alloc(destino * destino * 4);
  for (let y = 0; y < destino; y++){
    for (let x = 0; x < destino; x++){
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = Math.floor(y * f); sy < (y + 1) * f; sy++){
        for (let sx = Math.floor(x * f); sx < (x + 1) * f; sx++){
          const i = (sy * l.n + sx) * 4;
          r += l.px[i]; g += l.px[i+1]; b += l.px[i+2]; a += l.px[i+3]; n++;
        }
      }
      const o = (y * destino + x) * 4;
      out[o] = Math.round(r/n); out[o+1] = Math.round(g/n);
      out[o+2] = Math.round(b/n); out[o+3] = Math.round(a/n);
    }
  }
  return out;
}

const crc32 = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){ let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return buf => { let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();

function trozo(tipo, datos){
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(rgba, lado){
  const filas = Buffer.alloc((lado * 4 + 1) * lado);
  for (let y = 0; y < lado; y++){
    filas[y * (lado * 4 + 1)] = 0;                       // filtro "none"
    rgba.copy(filas, y * (lado * 4 + 1) + 1, y * lado * 4, (y + 1) * lado * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/* ── Piezas a generar ────────────────────────────────────────────────── */
const piezas = [
  { archivo:'icono-192.png',  lado:192, fondo:COLOR.papel, escala:1    },
  { archivo:'icono-512.png',  lado:512, fondo:COLOR.papel, escala:1    },
  { archivo:'icono-180.png',  lado:180, fondo:COLOR.papel, escala:1    },  // apple-touch-icon
  // Maskable: la marca se encoge a la zona segura (el sistema recorta el borde)
  { archivo:'icono-maskable-512.png', lado:512, fondo:COLOR.papel, escala:.62, cuadrado:true },
  { archivo:'icono-maskable-192.png', lado:192, fondo:COLOR.papel, escala:.62, cuadrado:true }
];

for (const p of piezas){
  const l = lienzo(MAESTRO);
  if (p.cuadrado) forma(l, () => -1e9, p.fondo);          // fondo a sangre
  dibujaMarca(l, { fondo: p.cuadrado ? null : p.fondo, escala: p.escala });
  writeFileSync(join(SALIDA, p.archivo), png(reduce(l, p.lado), p.lado));
  console.log('✓', p.archivo, `${p.lado}×${p.lado}`);
}
