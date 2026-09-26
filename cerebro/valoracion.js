/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — informe de valoración con comparables
   Regla de oro: NO se inventa ningún precio. El valor sale solo de los
   comparables que mete Pau (anuncios, ventas cerradas, testigos propios),
   y el informe lo dice por escrito. Sin comparables suficientes no hay
   rango: se avisa de cuántos faltan.
   Funciones puras.
   ═══════════════════════════════════════════════════════════════════ */

import { aNumero } from './utiles.js';

export const MIN_COMPARABLES = 3;

export const FUENTES_COMPARABLE = [
  { id: 'anuncio', nombre: 'Anuncio publicado (precio de oferta)', corto: 'Anuncio' },
  { id: 'venta', nombre: 'Venta cerrada (precio real)', corto: 'Venta cerrada' },
  { id: 'propio', nombre: 'Testigo propio de la agencia', corto: 'Testigo propio' },
  { id: 'otro', nombre: 'Otra fuente', corto: 'Otra fuente' },
];

/** Normaliza y valida un comparable. Devuelve { ok, comparable, errores }. */
export function validaComparable(c) {
  const errores = [];
  const precio = aNumero(c?.precio);
  const m2 = aNumero(c?.m2);
  const ajuste = c?.ajuste === '' || c?.ajuste == null ? 0 : aNumero(c.ajuste);
  if (!String(c?.direccion || '').trim()) errores.push('Falta la dirección o referencia del comparable.');
  if (!(precio > 0)) errores.push('El precio debe ser un número mayor que 0.');
  if (!(m2 > 0)) errores.push('Los m² deben ser un número mayor que 0.');
  if (!Number.isFinite(ajuste) || ajuste < -50 || ajuste > 50) errores.push('El ajuste debe estar entre -50 % y +50 %.');
  return {
    ok: errores.length === 0,
    errores,
    comparable: {
      id: c?.id,
      direccion: String(c?.direccion || '').trim().slice(0, 120),
      fuente: FUENTES_COMPARABLE.some((f) => f.id === c?.fuente) ? c.fuente : 'otro',
      precio, m2,
      ajuste: Number.isFinite(ajuste) ? ajuste : 0,
      fecha: String(c?.fecha || '').slice(0, 10),
      notas: String(c?.notas || '').trim().slice(0, 300),
    },
  };
}

/** €/m² de un comparable, aplicando el ajuste manual de Pau (+10 = el sujeto vale un 10 % más por m²). */
export function eurosM2(c) {
  return (c.precio / c.m2) * (1 + (c.ajuste || 0) / 100);
}

/** Percentil con interpolación lineal (p entre 0 y 1) sobre valores ya ordenados. */
export function percentil(ordenados, p) {
  if (!ordenados.length) return NaN;
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ordenados[base + 1] !== undefined ? ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]) : ordenados[base];
}

/**
 * Calcula la valoración. m2Sujeto: superficie del inmueble a valorar.
 * Devuelve { suficiente, faltan, n, porM2: {min, p25, mediana, media, p75, max}, valor: {bajo, central, alto}, validos, descartados }
 */
export function calculaValoracion(comparables, m2Sujeto) {
  const validos = [];
  const descartados = [];
  for (const c of comparables || []) {
    const v = validaComparable(c);
    if (v.ok) validos.push(v.comparable);
    else descartados.push({ comparable: v.comparable, errores: v.errores });
  }
  const m2 = aNumero(m2Sujeto);
  const n = validos.length;
  const faltan = Math.max(0, MIN_COMPARABLES - n);
  const res = { suficiente: n >= MIN_COMPARABLES && m2 > 0, faltan, n, validos, descartados, m2Sujeto: m2 };
  if (!n) return res;
  const valores = validos.map(eurosM2).sort((a, b) => a - b);
  const media = valores.reduce((s, x) => s + x, 0) / n;
  const porM2 = {
    min: valores[0], max: valores[n - 1], media,
    mediana: percentil(valores, 0.5),
    // Con pocos comparables los cuartiles no dicen nada: el rango es mínimo-máximo.
    p25: n >= 4 ? percentil(valores, 0.25) : valores[0],
    p75: n >= 4 ? percentil(valores, 0.75) : valores[n - 1],
  };
  res.porM2 = porM2;
  // Solo con comparables suficientes hay precio: nunca se da un valor con menos.
  if (res.suficiente) {
    const redondea = (x) => Math.round(x / 500) * 500;
    res.valor = { bajo: redondea(porM2.p25 * m2), central: redondea(porM2.mediana * m2), alto: redondea(porM2.p75 * m2) };
  }
  // Dispersión: si el más caro dobla al más barato, los comparables no son homogéneos.
  res.dispersionAlta = n >= 2 && porM2.max > 2 * porM2.min;
  return res;
}

export const METODOLOGIA =
  'Método de comparación: se calcula el precio por metro cuadrado de cada comparable aportado por el agente ' +
  '(aplicando, si lo hay, el ajuste manual indicado en la tabla) y se toma la mediana como valor central. ' +
  'El rango orientativo va del percentil 25 al percentil 75 (o del mínimo al máximo si hay menos de cuatro ' +
  'comparables), multiplicado por la superficie del inmueble y redondeado a 500 €.';

export const AVISO_VALORACION =
  'Este informe es una estimación comercial orientativa elaborada únicamente con los comparables que figuran en él. ' +
  'No es una tasación oficial (las tasaciones con validez hipotecaria solo las emiten sociedades de tasación ' +
  'homologadas por el Banco de España) ni garantiza un precio de venta. Los precios de oferta de anuncios suelen ' +
  'ser superiores a los de cierre.';
