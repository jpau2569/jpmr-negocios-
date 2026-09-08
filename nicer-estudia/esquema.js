/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — esquemas visuales
   Convierte un tema en un mapa: título en el centro y ramas a los lados.
   Se dibuja como SVG (sin librerías) para poder verlo en la app, guardarlo
   y descargarlo en PNG para pegarlo en los apuntes o mandarlo por WhatsApp.

   Ver el tema entero de un vistazo antes de memorizar es lo que hace que
   luego las tarjetas tengan de dónde colgarse.

   Función pura: entra un objeto, sale una cadena de SVG. Se puede probar.
   ═══════════════════════════════════════════════════════════════════ */

import { escapa } from './utiles.js';

const ANCHO = 1240;
const ANCHO_RAMA = 400;
const MARGEN = 36;
const ALTO_LINEA = 26;
const PAPEL = '#ffffff';
const TINTA = '#14171d';
const TINTA_2 = '#4a5361';

/** Parte un texto en líneas que caben, porque el SVG no sabe hacerlo solo. */
export function parteTexto(texto, maximo = 42) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    if (!actual) actual = palabra;
    else if ((actual + ' ' + palabra).length <= maximo) actual += ' ' + palabra;
    else { lineas.push(actual); actual = palabra; }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

const altoRama = (rama) => {
  const titulo = parteTexto(rama.titulo, 34).length * 24;
  const puntos = rama.puntos.reduce((t, p) => t + parteTexto(p, 40).length * ALTO_LINEA, 0);
  return 26 + titulo + puntos + 16;
};

/**
 * Devuelve `{ svg, ancho, alto }`. Las ramas se reparten a izquierda y
 * derecha, y el nodo central se coloca a la altura del centro real del
 * dibujo, no a ojo.
 */
export function dibujaEsquema(esquema, { color = '#12628a' } = {}) {
  const ramas = (esquema?.ramas || []).slice(0, 8);

  // Se reparten por altura, no de una en una: alternando, tres ramas dejaban
  // un lado con el doble de papel que el otro.
  const izquierda = [];
  const derecha = [];
  let pesoIzq = 0;
  let pesoDer = 0;
  for (const rama of ramas) {
    const alto = altoRama(rama);
    if (pesoIzq <= pesoDer) { izquierda.push(rama); pesoIzq += alto; }
    else { derecha.push(rama); pesoDer += alto; }
  }

  const coloca = (lista, x) => {
    let y = MARGEN + 40;
    return lista.map((rama) => {
      const alto = altoRama(rama);
      const caja = { rama, x, y, alto };
      y += alto + 22;
      return caja;
    });
  };

  const cajasIzq = coloca(izquierda, MARGEN);
  const cajasDer = coloca(derecha, ANCHO - MARGEN - ANCHO_RAMA);
  const fin = (cajas) => (cajas.length ? cajas.at(-1).y + cajas.at(-1).alto : MARGEN + 40);
  const alto = Math.max(fin(cajasIzq), fin(cajasDer)) + MARGEN + 30;

  const cx = ANCHO / 2;
  const cy = alto / 2;
  const lineasTitulo = parteTexto(esquema?.titulo || 'Esquema', 22);
  const altoCentro = 34 + lineasTitulo.length * 30;
  const anchoCentro = 280;

  const piezas = [];
  piezas.push(`<rect width="${ANCHO}" height="${alto}" fill="${PAPEL}"/>`);

  // Conectores primero, para que las cajas queden por encima.
  for (const caja of [...cajasIzq, ...cajasDer]) {
    const alaIzquierda = caja.x < cx;
    const desdeX = alaIzquierda ? cx - anchoCentro / 2 : cx + anchoCentro / 2;
    const hastaX = alaIzquierda ? caja.x + ANCHO_RAMA : caja.x;
    const hastaY = caja.y + 26;
    const medio = (desdeX + hastaX) / 2;
    piezas.push(`<path d="M${desdeX} ${cy} C${medio} ${cy} ${medio} ${hastaY} ${hastaX} ${hastaY}" `
      + `fill="none" stroke="${color}" stroke-width="2.5" opacity=".5"/>`);
  }

  // Ramas.
  for (const { rama, x, y, alto: altoCaja } of [...cajasIzq, ...cajasDer]) {
    piezas.push(`<rect x="${x}" y="${y}" width="${ANCHO_RAMA}" height="${altoCaja}" rx="14" `
      + `fill="#f6f5f2" stroke="${color}" stroke-width="2"/>`);
    let ty = y + 34;
    for (const linea of parteTexto(rama.titulo, 34)) {
      piezas.push(`<text x="${x + 20}" y="${ty}" font-family="system-ui,sans-serif" font-size="21" `
        + `font-weight="700" fill="${TINTA}">${escapa(linea)}</text>`);
      ty += 24;
    }
    ty += 6;
    for (const punto of rama.puntos) {
      for (const [i, linea] of parteTexto(punto, 40).entries()) {
        piezas.push(`<text x="${x + (i ? 34 : 20)}" y="${ty}" font-family="system-ui,sans-serif" `
          + `font-size="17" fill="${TINTA_2}">${escapa(i ? linea : '• ' + linea)}</text>`);
        ty += ALTO_LINEA;
      }
    }
  }

  // Nodo central, encima de todo.
  piezas.push(`<rect x="${cx - anchoCentro / 2}" y="${cy - altoCentro / 2}" width="${anchoCentro}" `
    + `height="${altoCentro}" rx="18" fill="${color}"/>`);
  let ty = cy - altoCentro / 2 + 40;
  for (const linea of lineasTitulo) {
    piezas.push(`<text x="${cx}" y="${ty}" text-anchor="middle" font-family="system-ui,sans-serif" `
      + `font-size="24" font-weight="700" fill="${PAPEL}">${escapa(linea)}</text>`);
    ty += 30;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${alto}" `
    + `width="${ANCHO}" height="${alto}" role="img" aria-label="Esquema de ${escapa(esquema?.titulo || '')}">`
    + piezas.join('') + '</svg>';

  return { svg, ancho: ANCHO, alto };
}

/** Valida un esquema venido del Profe antes de guardarlo. */
export function esquemaDeIA(bruto) {
  const ramas = (Array.isArray(bruto?.ramas) ? bruto.ramas : [])
    .slice(0, 8)
    .map((r) => ({
      titulo: String(r?.titulo || '').trim().slice(0, 80),
      puntos: (Array.isArray(r?.puntos) ? r.puntos : [])
        .slice(0, 6)
        .map((p) => String(p).trim().slice(0, 120))
        .filter(Boolean)
    }))
    .filter((r) => r.titulo);
  if (!ramas.length) return null;
  return { titulo: String(bruto?.titulo || 'Esquema').trim().slice(0, 120), ramas };
}
