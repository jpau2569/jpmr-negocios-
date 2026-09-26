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

/* Textos del informe preparados por NURIA (septiembre de 2026), sobre el
   método de comparación de la Orden ECO/805/2003 (que para una tasación
   oficial exige al menos 6 comparables). Aquí: con 3-5 hay cifra, pero se
   marca como muestra reducida. */
export const COMPARABLES_RECOMENDADOS = 6;

const PLANTILLA_METODOLOGIA = "Este informe estima un rango de precio a partir de {n} inmuebles comparables de la misma zona y de características parecidas, sacados de {origen}. Para cada comparable se calcula el precio por metro cuadrado. Ordenados de menor a mayor, se toman la mediana (el valor central, que no se deja arrastrar por un anuncio muy caro o muy barato), el percentil 25 (una cuarta parte de los comparables está por debajo) y el percentil 75 (una cuarta parte está por encima). Así, la mitad central del mercado queda entre {p25} y {p75} €/m², con una mediana de {mediana} €/m². Multiplicados por la superficie de {superficie} m² de este inmueble, dan un rango orientativo de {rangoMin} a {rangoMax} €, con un valor central de {valorCentral} €. {ajusteTexto} Los comparables que son anuncios reflejan precios pedidos, no precios de venta. El precio medio de la zona según los portales se muestra solo como contexto y no entra en el cálculo.";

const ORIGENES = { anuncio: 'anuncios publicados', venta: 'ventas cerradas', propio: 'testigos propios de la agencia', otro: 'otras fuentes' };
const fmt = (n) => Math.round(n).toLocaleString('es-ES').replace(/(^|[^\d])(\d{4})(?=[^\d]|$)/g, (_, p, d) => `${p}${d[0]}.${d.slice(1)}`);

/** Texto de «Cómo se ha calculado» con las cifras de este informe. */
export function textoMetodologia(calculo) {
  if (!calculo?.suficiente || !calculo.valor) return METODOLOGIA;
  const origenes = [...new Set(calculo.validos.map((c) => ORIGENES[c.fuente] || ORIGENES.otro))];
  const origen = origenes.length > 1 ? `${origenes.slice(0, -1).join(', ')} y ${origenes.at(-1)}` : origenes[0];
  const conAjuste = calculo.validos.some((c) => c.ajuste);
  return PLANTILLA_METODOLOGIA.replace(/\{(\w+)\}/g, (_, k) => ({
    n: String(calculo.n), origen, p25: fmt(calculo.porM2.p25), p75: fmt(calculo.porM2.p75), mediana: fmt(calculo.porM2.mediana),
    superficie: fmt(calculo.m2Sujeto), rangoMin: fmt(calculo.valor.bajo), rangoMax: fmt(calculo.valor.alto), valorCentral: fmt(calculo.valor.central),
    ajusteTexto: conAjuste ? 'En algunos comparables el agente ha aplicado un ajuste (columna «Ajuste») porque este inmueble se diferencia de ellos en algún aspecto.' : '',
  }[k] ?? ''))
    .replace('Así, la mitad central del mercado queda entre', calculo.n < 4 ? 'Con menos de cuatro comparables no hay cuartiles que valgan, así que se usa el rango completo, del mínimo al máximo: entre' : 'Así, la mitad central del mercado queda entre')
    .replace(/\s{2,}/g, ' ');
}

export const METODOLOGIA =
  'Método de comparación: se calcula el precio por metro cuadrado de cada comparable aportado por el agente ' +
  '(aplicando, si lo hay, el ajuste manual indicado en la tabla) y se toma la mediana como valor central. ' +
  'El rango orientativo va del percentil 25 al percentil 75 (o del mínimo al máximo si hay menos de cuatro ' +
  'comparables), multiplicado por la superficie del inmueble y redondeado a 500 €.';

export const AVISO_VALORACION = "Este documento es una estimación comercial de la agencia, basada en inmuebles comparables. No es una tasación oficial: no la ha hecho una sociedad de tasación homologada ni sigue la Orden ECO/805/2003. No sirve para pedir una hipoteca ni para trámites oficiales. Los precios de los anuncios son precios pedidos; el precio final de venta suele ser más bajo porque se negocia, y la diferencia depende de la zona, del estado del inmueble y del momento del mercado. El valor final lo fija lo que un comprador esté dispuesto a pagar; la agencia no garantiza vender a ningún precio concreto.";
