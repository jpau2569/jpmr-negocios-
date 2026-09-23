/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — generador de iconos de la PWA
   -----------------------------------------------------------------------
   Toma la imagen maestra de la marca (`marca/logo-1024.png`) y saca de ella
   todos los tamaños que piden Android, iOS y el navegador. Sin dependencias
   (`sharp` no hace falta): descodifica el PNG con zlib, reduce con filtro de
   caja y vuelve a codificar.

   Uso:  node chivato/herramientas/generar-iconos.mjs
         node chivato/herramientas/generar-iconos.mjs marca/logo-original.png

   Los "maskable" llevan el logo encogido al 82 % sobre el fondo de la propia
   imagen, porque Android recorta el icono en círculo y se comería las
   esquinas del cuadrado de cristal.
   ═══════════════════════════════════════════════════════════════════════ */

import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── Descodificar PNG (8 bits, RGB o RGBA, sin entrelazar) ─────────────── */
function leerPNG(ruta) {
  const b = readFileSync(ruta);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${ruta} no es un PNG.`);

  let ancho = 0, alto = 0, canales = 0, trozos = [];
  for (let o = 8; o < b.length;) {
    const largo = b.readUInt32BE(o);
    const tipo = b.subarray(o + 4, o + 8).toString('ascii');
    const datos = b.subarray(o + 8, o + 8 + largo);
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      if (datos[8] !== 8) throw new Error('Solo se admiten PNG de 8 bits por canal.');
      if (datos[9] !== 2 && datos[9] !== 6) throw new Error('Solo se admiten PNG en color RGB o RGBA.');
      if (datos[12] !== 0) throw new Error('Solo se admiten PNG sin entrelazar.');
      canales = datos[9] === 6 ? 4 : 3;
    } else if (tipo === 'IDAT') {
      trozos.push(datos);
    } else if (tipo === 'IEND') break;
    o += 12 + largo;
  }

  const crudo = inflateSync(Buffer.concat(trozos));
  const linea = ancho * canales;
  const px = Buffer.alloc(ancho * alto * 4);
  const previa = Buffer.alloc(linea);
  const actual = Buffer.alloc(linea);

  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (linea + 1)];
    crudo.copy(actual, 0, y * (linea + 1) + 1, y * (linea + 1) + 1 + linea);
    for (let i = 0; i < linea; i++) {
      const a = i >= canales ? actual[i - canales] : 0;   // izquierda
      const c = i >= canales ? previa[i - canales] : 0;   // diagonal
      const p = previa[i];                                // arriba
      let v = actual[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += p;
      else if (filtro === 3) v += (a + p) >> 1;
      else if (filtro === 4) {
        const q = a + p - c;
        const da = Math.abs(q - a), db = Math.abs(q - p), dc = Math.abs(q - c);
        v += (da <= db && da <= dc) ? a : (db <= dc ? p : c);
      }
      actual[i] = v & 0xff;
    }
    for (let x = 0; x < ancho; x++) {
      const s = x * canales, d = (y * ancho + x) * 4;
      px[d] = actual[s]; px[d + 1] = actual[s + 1]; px[d + 2] = actual[s + 2];
      px[d + 3] = canales === 4 ? actual[s + 3] : 255;
    }
    actual.copy(previa);
  }
  return { ancho, alto, px };
}

/* ── Codificar PNG RGBA ────────────────────────────────────────────────── */
function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const suma = Buffer.alloc(4); suma.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
}
function escribirPNG(ruta, { ancho, alto, px }) {
  /* Filtrado adaptativo: se prueban los cinco filtros de la norma y se queda
     el de menor suma de valores absolutos. En un logo con degradados eso
     divide el peso del PNG por tres frente a guardarlo sin filtrar. */
  const linea = ancho * 4;
  const crudo = Buffer.alloc(alto * (linea + 1));
  const previa = Buffer.alloc(linea);
  const prueba = Buffer.alloc(linea);
  for (let y = 0; y < alto; y++) {
    const fila = px.subarray(y * linea, (y + 1) * linea);
    let mejorTipo = 0, mejorCoste = Infinity, mejor = null;
    for (let tipo = 0; tipo <= 4; tipo++) {
      let coste = 0;
      for (let i = 0; i < linea; i++) {
        const a = i >= 4 ? fila[i - 4] : 0;
        const b = previa[i];
        const c = i >= 4 ? previa[i - 4] : 0;
        let v;
        if (tipo === 0) v = fila[i];
        else if (tipo === 1) v = fila[i] - a;
        else if (tipo === 2) v = fila[i] - b;
        else if (tipo === 3) v = fila[i] - ((a + b) >> 1);
        else {
          const q = a + b - c;
          const da = Math.abs(q - a), db = Math.abs(q - b), dc = Math.abs(q - c);
          v = fila[i] - ((da <= db && da <= dc) ? a : (db <= dc ? b : c));
        }
        v &= 0xff;
        prueba[i] = v;
        coste += v < 128 ? v : 256 - v;
      }
      if (coste < mejorCoste) { mejorCoste = coste; mejorTipo = tipo; mejor = Buffer.from(prueba); }
    }
    crudo[y * (linea + 1)] = mejorTipo;
    mejor.copy(crudo, y * (linea + 1) + 1);
    fila.copy(previa);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(ruta, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]));
}

/* ── Reducir con filtro de caja (promedio del área de origen) ──────────── */
function reducir(img, destino) {
  const px = Buffer.alloc(destino * destino * 4);
  const escalaX = img.ancho / destino, escalaY = img.alto / destino;
  for (let y = 0; y < destino; y++) {
    const y0 = Math.floor(y * escalaY), y1 = Math.max(y0 + 1, Math.floor((y + 1) * escalaY));
    for (let x = 0; x < destino; x++) {
      const x0 = Math.floor(x * escalaX), x1 = Math.max(x0 + 1, Math.floor((x + 1) * escalaX));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * img.ancho + sx) * 4;
          r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; a += img.px[i + 3]; n++;
        }
      }
      const d = (y * destino + x) * 4;
      px[d] = r / n; px[d + 1] = g / n; px[d + 2] = b / n; px[d + 3] = a / n;
    }
  }
  return { ancho: destino, alto: destino, px };
}

/* ── Versión "maskable": logo encogido sobre el fondo de la propia imagen ─ */
function conMargen(img, proporcion = 0.82) {
  const n = img.ancho;
  const fondo = [img.px[0], img.px[1], img.px[2]]; // esquina superior izquierda
  const dentro = Math.round(n * proporcion);
  const pequeno = reducir(img, dentro);
  const px = Buffer.alloc(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    px[i * 4] = fondo[0]; px[i * 4 + 1] = fondo[1]; px[i * 4 + 2] = fondo[2]; px[i * 4 + 3] = 255;
  }
  const desp = Math.round((n - dentro) / 2);
  for (let y = 0; y < dentro; y++) {
    pequeno.px.copy(px, ((y + desp) * n + desp) * 4, y * dentro * 4, (y + 1) * dentro * 4);
  }
  return { ancho: n, alto: n, px };
}

/* ── Programa ──────────────────────────────────────────────────────────── */
const origen = resolve(RAIZ, process.argv[2] || 'marca/logo-1024.png');
const maestro = leerPNG(origen);
console.log(`Maestro: ${origen} (${maestro.ancho}×${maestro.alto})`);

const NORMALES = [512, 192, 180, 96, 32];
for (const n of NORMALES) {
  const salida = join(RAIZ, `icono-${n}.png`);
  escribirPNG(salida, reducir(maestro, n));
  console.log(`  ✓ icono-${n}.png`);
}
for (const n of [512, 192]) {
  const salida = join(RAIZ, `icono-maskable-${n}.png`);
  escribirPNG(salida, conMargen(reducir(maestro, n)));
  console.log(`  ✓ icono-maskable-${n}.png`);
}
if (process.argv[3] === '--maestro') {
  escribirPNG(join(RAIZ, 'marca/logo-1024.png'), reducir(maestro, 1024));
  console.log('  ✓ marca/logo-1024.png');
}
