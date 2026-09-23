// ============================================================================
//  Escaparate 3D Pro — generador de códigos QR (copia de fotos-faciles/nucleo/qr.mjs)
// ----------------------------------------------------------------------------
//  Es el mismo generador propio, verificado módulo a módulo contra la librería
//  `qrcode`, que usa Fotos Fáciles. Está copiado —y no importado— porque cada
//  cliente se lleva la carpeta escaparate3d-pro/ entera a su despliegue y no
//  puede depender de un programa que solo vive en el ordenador de casa.
//  Si se corrige un fallo en uno de los dos, hay que llevarlo al otro: el test
//  test/escaparate3d-pro.test.mjs comprueba que ambas copias siguen igual.
// ============================================================================

// --- Tabla de bloques de corrección de errores ------------------------------
//  Por versión y nivel: [ecPorBloque, bloquesG1, datosG1, bloquesG2, datosG2]
const BLOQUES = {
  L: [
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
  ],
  M: [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
  ],
  Q: [
    [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17], [24, 6, 19, 2, 20],
  ],
  H: [
    [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13], [28, 6, 15, 2, 16],
  ],
};

// Centros de los patrones de alineación por versión (1 = ninguno).
const ALINEACION = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const BITS_NIVEL = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

// Un centro de alineación que caiga sobre un buscador no se dibuja. Ojo: a partir
// de la versión 7 hay centros que cruzan la línea de sincronía y esos SÍ van.
function pisaBuscador(fila, col, t) {
  return (fila <= 8 && col <= 8) || (fila <= 8 && col >= t - 9) || (fila >= t - 9 && col <= 8);
}

// --- Aritmética en GF(256) para Reed-Solomon --------------------------------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function polinomioGenerador(grado) {
  let poli = [1];
  for (let i = 0; i < grado; i++) {
    const siguiente = new Array(poli.length + 1).fill(0);
    for (let j = 0; j < poli.length; j++) {
      siguiente[j] ^= poli[j];                    // coeficiente × x
      siguiente[j + 1] ^= mul(poli[j], EXP[i]);   // coeficiente × α^i
    }
    poli = siguiente;
  }
  return poli;
}

function correccion(datos, cantidad) {
  const gen = polinomioGenerador(cantidad);
  const resto = new Array(cantidad).fill(0);
  for (const byte of datos) {
    const factor = byte ^ resto[0];
    resto.shift(); resto.push(0);
    if (factor !== 0) for (let i = 0; i < cantidad; i++) resto[i] ^= mul(gen[i + 1], factor);
  }
  return resto;
}

// --- Codificación de los datos ----------------------------------------------
function capacidadDatos(version, nivel) {
  const [, b1, d1, b2, d2] = BLOQUES[nivel][version - 1];
  return b1 * d1 + b2 * d2;
}

function eligeVersion(bytes, nivel) {
  for (let v = 1; v <= 10; v++) {
    const cabecera = 4 + (v < 10 ? 8 : 16);
    if (bytes.length * 8 + cabecera <= capacidadDatos(v, nivel) * 8) return v;
  }
  throw new Error("El texto es demasiado largo para un QR de versión 10 o menor");
}

function bitsDeDatos(bytes, version, nivel) {
  const bits = [];
  const empuja = (valor, largo) => { for (let i = largo - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  empuja(0b0100, 4);                       // modo byte
  empuja(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) empuja(b, 8);

  const total = capacidadDatos(version, nivel) * 8;
  for (let i = 0; i < 4 && bits.length < total; i++) bits.push(0);   // terminador
  while (bits.length % 8 !== 0) bits.push(0);
  const relleno = [0xec, 0x11];
  for (let i = 0; bits.length < total; i++) empuja(relleno[i % 2], 8);

  const codigos = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codigos.push(byte);
  }
  return codigos;
}

function entrelaza(codigos, version, nivel) {
  const [ec, b1, d1, b2, d2] = BLOQUES[nivel][version - 1];
  const bloques = [];
  let cursor = 0;
  for (let i = 0; i < b1; i++) { bloques.push(codigos.slice(cursor, cursor + d1)); cursor += d1; }
  for (let i = 0; i < b2; i++) { bloques.push(codigos.slice(cursor, cursor + d2)); cursor += d2; }
  const correcciones = bloques.map((b) => correccion(b, ec));

  const salida = [];
  const maxDatos = Math.max(d1, d2);
  for (let i = 0; i < maxDatos; i++) for (const b of bloques) if (i < b.length) salida.push(b[i]);
  for (let i = 0; i < ec; i++) for (const c of correcciones) salida.push(c[i]);
  return salida;
}

// --- Dibujo de la matriz -----------------------------------------------------
function nuevaMatriz(tamano) {
  return { modulos: Array.from({ length: tamano }, () => new Array(tamano).fill(null)), tamano };
}

function patronesFijos(m, version) {
  const t = m.tamano;
  const buscador = (fila, col) => {
    for (let f = -1; f <= 7; f++) for (let c = -1; c <= 7; c++) {
      const y = fila + f, x = col + c;
      if (y < 0 || y >= t || x < 0 || x >= t) continue;
      const borde = f === -1 || f === 7 || c === -1 || c === 7;
      const anillo = f === 0 || f === 6 || c === 0 || c === 6;
      const centro = f >= 2 && f <= 4 && c >= 2 && c <= 4;
      m.modulos[y][x] = borde ? 0 : (anillo || centro ? 1 : 0);
    }
  };
  buscador(0, 0); buscador(0, t - 7); buscador(t - 7, 0);

  for (let i = 8; i < t - 8; i++) {           // patrones de sincronía
    const v = i % 2 === 0 ? 1 : 0;
    if (m.modulos[6][i] === null) m.modulos[6][i] = v;
    if (m.modulos[i][6] === null) m.modulos[i][6] = v;
  }

  for (const fila of ALINEACION[version - 1]) {
    for (const col of ALINEACION[version - 1]) {
      if (pisaBuscador(fila, col, t)) continue;
      for (let f = -2; f <= 2; f++) for (let c = -2; c <= 2; c++) {
        const anillo = Math.abs(f) === 2 || Math.abs(c) === 2 || (f === 0 && c === 0);
        m.modulos[fila + f][col + c] = anillo ? 1 : 0;
      }
    }
  }

  m.modulos[t - 8][8] = 1;                    // módulo siempre oscuro
  for (let i = 0; i < 9; i++) {               // reserva de información de formato
    if (m.modulos[8][i] === null) m.modulos[8][i] = 0;
    if (m.modulos[i][8] === null) m.modulos[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (m.modulos[8][t - 1 - i] === null) m.modulos[8][t - 1 - i] = 0;
    if (m.modulos[t - 1 - i][8] === null) m.modulos[t - 1 - i][8] = 0;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      m.modulos[t - 11 + j][i] = 0; m.modulos[i][t - 11 + j] = 0;
    }
  }
}

function colocaDatos(m, codigos) {
  const t = m.tamano;
  const bits = [];
  for (const byte of codigos) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  let indice = 0, subiendo = true;
  for (let col = t - 1; col > 0; col -= 2) {
    if (col === 6) col--;                      // se salta la columna de sincronía
    for (let paso = 0; paso < t; paso++) {
      const fila = subiendo ? t - 1 - paso : paso;
      for (const c of [col, col - 1]) {
        if (m.modulos[fila][c] !== null) continue;
        m.modulos[fila][c] = indice < bits.length ? bits[indice] : 0;
        indice++;
      }
    }
    subiendo = !subiendo;
  }
}

const MASCARAS = [
  (f, c) => (f + c) % 2 === 0,
  (f) => f % 2 === 0,
  (f, c) => c % 3 === 0,
  (f, c) => (f + c) % 3 === 0,
  (f, c) => (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0,
  (f, c) => ((f * c) % 2) + ((f * c) % 3) === 0,
  (f, c) => (((f * c) % 2) + ((f * c) % 3)) % 2 === 0,
  (f, c) => (((f + c) % 2) + ((f * c) % 3)) % 2 === 0,
];

function esFuncion(version, t, fila, col) {
  if (fila < 9 && col < 9) return true;
  if (fila < 9 && col >= t - 8) return true;
  if (fila >= t - 8 && col < 9) return true;
  if (fila === 6 || col === 6) return true;
  if (version >= 7 && ((fila < 6 && col >= t - 11) || (col < 6 && fila >= t - 11))) return true;
  for (const cf of ALINEACION[version - 1]) for (const cc of ALINEACION[version - 1]) {
    if (pisaBuscador(cf, cc, t)) continue;
    if (Math.abs(fila - cf) <= 2 && Math.abs(col - cc) <= 2) return true;
  }
  return false;
}

function penalizacion(mod) {
  const t = mod.length;
  let total = 0;
  const racha = (lee) => {
    for (let a = 0; a < t; a++) {
      let seguidos = 1;
      for (let b = 1; b < t; b++) {
        if (lee(a, b) === lee(a, b - 1)) seguidos++;
        else { if (seguidos >= 5) total += 3 + (seguidos - 5); seguidos = 1; }
      }
      if (seguidos >= 5) total += 3 + (seguidos - 5);
    }
  };
  racha((f, c) => mod[f][c]);
  racha((c, f) => mod[f][c]);

  for (let f = 0; f < t - 1; f++) for (let c = 0; c < t - 1; c++) {
    const v = mod[f][c];
    if (v === mod[f][c + 1] && v === mod[f + 1][c] && v === mod[f + 1][c + 1]) total += 3;
  }

  const patron = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const inverso = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const busca = (lee) => {
    for (let a = 0; a < t; a++) for (let b = 0; b + 11 <= t; b++) {
      let ok1 = true, ok2 = true;
      for (let k = 0; k < 11; k++) {
        const v = lee(a, b + k);
        if (v !== patron[k]) ok1 = false;
        if (v !== inverso[k]) ok2 = false;
      }
      if (ok1) total += 40;
      if (ok2) total += 40;
    }
  };
  busca((f, c) => mod[f][c]);
  busca((c, f) => mod[f][c]);

  let oscuros = 0;
  for (const fila of mod) for (const v of fila) oscuros += v;
  const porcentaje = (oscuros * 100) / (t * t);
  total += Math.abs(Math.ceil(porcentaje / 5) - 10) * 10;   // desvío respecto al 50 %
  return total;
}

function bch(valor, generador, bits) {
  let d = valor << (bits - 1);
  const largo = (n) => { let l = 0; while (n) { l++; n >>>= 1; } return l; };
  while (largo(d) >= bits) d ^= generador << (largo(d) - bits);
  return d;
}

function informacionFormato(m, nivel, mascara) {
  const t = m.tamano;
  const datos = (BITS_NIVEL[nivel] << 3) | mascara;
  const bits = ((datos << 10) | bch(datos, 0b10100110111, 11)) ^ 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    // Copia vertical, junto al buscador superior izquierdo y al inferior izquierdo.
    if (i < 6) m.modulos[i][8] = bit;
    else if (i < 8) m.modulos[i + 1][8] = bit;
    else m.modulos[t - 15 + i][8] = bit;
    // Copia horizontal, junto al buscador superior derecho y al superior izquierdo.
    if (i < 8) m.modulos[8][t - 1 - i] = bit;
    else m.modulos[8][15 - i - (i < 9 ? 0 : 1)] = bit;
  }
  m.modulos[t - 8][8] = 1;   // módulo siempre oscuro
}

function informacionVersion(m, version) {
  if (version < 7) return;
  const t = m.tamano;
  const bits = (version << 12) | bch(version, 0b1111100100101, 13);
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    m.modulos[Math.floor(i / 3)][t - 11 + (i % 3)] = bit;
    m.modulos[t - 11 + (i % 3)][Math.floor(i / 3)] = bit;
  }
}

/** Devuelve { tamano, modulos } con 1 = oscuro, 0 = claro. */
export function matriz(texto, { nivel = "M", forzarMascara = null } = {}) {
  if (!BLOQUES[nivel]) throw new Error(`Nivel de corrección desconocido: ${nivel}`);
  // Única diferencia con la copia de Fotos Fáciles: TextEncoder en vez de
  // Buffer, porque en el navegador no existe Buffer. El resultado es idéntico
  // y el test lo comprueba comparando las dos implementaciones byte a byte.
  const bytes = [...new TextEncoder().encode(String(texto))];
  const version = eligeVersion(bytes, nivel);
  const codigos = entrelaza(bitsDeDatos(bytes, version, nivel), version, nivel);

  const base = nuevaMatriz(version * 4 + 17);
  patronesFijos(base, version);
  colocaDatos(base, codigos);

  let mejor = null;
  for (let mascara = 0; mascara < 8; mascara++) {
    if (forzarMascara !== null && mascara !== forzarMascara) continue;
    const copia = { tamano: base.tamano, modulos: base.modulos.map((f) => f.slice()) };
    for (let f = 0; f < copia.tamano; f++) for (let c = 0; c < copia.tamano; c++) {
      if (!esFuncion(version, copia.tamano, f, c) && MASCARAS[mascara](f, c)) copia.modulos[f][c] ^= 1;
    }
    informacionFormato(copia, nivel, mascara);
    informacionVersion(copia, version);
    const puntos = penalizacion(copia.modulos);
    if (!mejor || puntos < mejor.puntos) mejor = { puntos, matriz: copia };
  }
  return { tamano: mejor.matriz.tamano, modulos: mejor.matriz.modulos, version, nivel };
}

/** QR como SVG (una sola ruta: pesa poco y escala sin pixelarse). */
export function svg(texto, { nivel = "M", margen = 2, claro = "#ffffff", oscuro = "#000000" } = {}) {
  const { tamano, modulos } = matriz(texto, { nivel });
  const lado = tamano + margen * 2;
  let ruta = "";
  for (let f = 0; f < tamano; f++) for (let c = 0; c < tamano; c++) {
    if (modulos[f][c]) ruta += `M${c + margen} ${f + margen}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="Código QR para conectar el móvil">` +
    `<rect width="${lado}" height="${lado}" fill="${claro}"/><path d="${ruta}" fill="${oscuro}"/></svg>`;
}

/** QR para el terminal: media altura por línea para que quepa en la ventana. */
export function ascii(texto, { nivel = "M", margen = 2 } = {}) {
  const { tamano, modulos } = matriz(texto, { nivel });
  const lee = (f, c) => (f < 0 || f >= tamano || c < 0 || c >= tamano ? 0 : modulos[f][c]);
  const lineas = [];
  for (let f = -margen; f < tamano + margen; f += 2) {
    let linea = "";
    for (let c = -margen; c < tamano + margen; c++) {
      const arriba = lee(f, c), abajo = lee(f + 1, c);
      linea += arriba && abajo ? "█" : arriba ? "▀" : abajo ? "▄" : " ";
    }
    lineas.push(linea);
  }
  return lineas.join("\n");
}
