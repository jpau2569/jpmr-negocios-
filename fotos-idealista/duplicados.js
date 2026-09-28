// ============================================================================
//  Fotos para Idealista — fotos repetidas (funciones puras)
// ----------------------------------------------------------------------------
//  Compara los dHash de todas las fotos y agrupa las que se parecen. De cada
//  grupo propone quedarse con la más nítida (y, si empatan, la de más
//  resolución). Solo propone: Pau decide en la pantalla.
// ============================================================================

import { hammingDHash, UMBRAL_PARECIDAS } from "./catalogo.js";

/**
 * Parejas de fotos parecidas.
 * @param {string[]} hashes  dHash de cada foto
 * @returns {{a:number, b:number, distancia:number}[]}
 */
export function parejasParecidas(hashes, umbral = UMBRAL_PARECIDAS) {
  const parejas = [];
  for (let a = 0; a < hashes.length; a++) {
    for (let b = a + 1; b < hashes.length; b++) {
      const distancia = hammingDHash(hashes[a], hashes[b]);
      if (distancia <= umbral) parejas.push({ a, b, distancia });
    }
  }
  return parejas;
}

/** Agrupa las parejas en grupos conectados (si A≈B y B≈C, van juntas). */
export function agrupar(parejas, total) {
  const padre = Array.from({ length: total }, (_, i) => i);
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (const { a, b } of parejas) padre[raiz(a)] = raiz(b);
  const grupos = new Map();
  for (let i = 0; i < total; i++) {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(i);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/**
 * ¿Es `a` mejor que `b`? Nitidez primero (si difieren más de un 10 %) y
 * después resolución.
 */
function mejor(a, b) {
  const na = a.nitidez || 0, nb = b.nitidez || 0;
  const tope = Math.max(na, nb);
  if (tope > 0 && Math.abs(na - nb) / tope > 0.1) return na > nb;
  const pa = (a.ancho || 0) * (a.alto || 0), pb = (b.ancho || 0) * (b.alto || 0);
  if (pa !== pb) return pa > pb;
  return na >= nb;
}

/**
 * Propuesta de qué quitar.
 * @param {{hash:string, nitidez?:number, ancho?:number, alto?:number}[]} fotos
 * @returns {{grupo:number[], quedarse:number, quitar:number[]}[]} índices de `fotos`
 */
export function propuestaDuplicados(fotos, umbral = UMBRAL_PARECIDAS) {
  const lista = Array.isArray(fotos) ? fotos : [];
  const grupos = agrupar(parejasParecidas(lista.map((f) => f.hash), umbral), lista.length);
  return grupos.map((grupo) => {
    let quedarse = grupo[0];
    for (const i of grupo.slice(1)) if (mejor(lista[i], lista[quedarse])) quedarse = i;
    return { grupo, quedarse, quitar: grupo.filter((i) => i !== quedarse) };
  });
}
