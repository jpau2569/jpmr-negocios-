/* ═══════════════════════════════════════════════════════════════════
   DOSIER DE VALORACIÓN 3D — cálculo puro (sin DOM)
   Reutiliza el método de Cerebro (cerebro/valoracion.js): mediana y
   cuartiles del €/m² de los comparables. Aquí solo se traduce a lo que
   necesita el dosier: posición del precio publicado, torres 3D y avisos.
   Regla de oro heredada: no se inventa ningún precio; todo sale de los
   comparables del JSON, y mientras `validado` no sea true el dosier
   se muestra como BORRADOR.
   ═══════════════════════════════════════════════════════════════════ */

import { calculaValoracion, eurosM2, COMPARABLES_RECOMENDADOS, textoMetodologia, AVISO_VALORACION } from '../cerebro/valoracion.js';

export { AVISO_VALORACION, COMPARABLES_RECOMENDADOS };

/** 180000 → "180.000" (el punto de millar también en 4 cifras, que es-ES no pone). */
export const miles = (n) => Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const euros = (n) => `${miles(n)} €`;

/** Fecha ISO → "29 de septiembre de 2026" (sin depender del huso). */
export function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`;
}

/**
 * Construye todo lo que pinta el dosier a partir del JSON del inmueble.
 * Devuelve { calculo, publicado, torres, avisos, ... }.
 */
export function construirDosier(datos) {
  const inm = datos?.inmueble || {};
  const m2 = Number(inm.m2Construidos);
  const precio = Number(inm.precioPublicado);
  const calculo = calculaValoracion(datos?.comparables || [], m2);

  const eurM2Publicado = m2 > 0 && precio > 0 ? precio / m2 : NaN;
  const avisos = [];
  if (!datos?.validado) {
    avisos.push({ nivel: 'borrador', texto: 'BORRADOR: pendiente de que el agente valide los comparables y sus ajustes antes de enviarlo.' });
  }
  if (!calculo.suficiente) {
    avisos.push({ nivel: 'alto', texto: `No hay comparables suficientes para dar un rango: faltan ${calculo.faltan}.` });
  } else if (calculo.n < COMPARABLES_RECOMENDADOS) {
    avisos.push({ nivel: 'medio', texto: `Muestra reducida: ${calculo.n} comparables (lo recomendable son ${COMPARABLES_RECOMENDADOS} o más).` });
  }
  if (calculo.dispersionAlta) {
    avisos.push({ nivel: 'medio', texto: 'Los comparables son muy distintos entre sí: el rango es menos fiable.' });
  }
  if (!inm.certificadoEnergetico) {
    avisos.push({ nivel: 'info', texto: 'Falta el certificado energético (obligatorio para publicar y vender).' });
  }

  // Bajada de precio, si consta el precio anterior.
  const anterior = Number(inm.precioAnterior);
  const bajada = anterior > precio && precio > 0
    ? { anterior, diferencia: anterior - precio, porcentaje: ((anterior - precio) / anterior) * 100 }
    : null;

  // Dónde cae el precio publicado respecto al rango.
  let posicion = null;
  if (calculo.suficiente && calculo.valor && precio > 0) {
    const { bajo, central, alto } = calculo.valor;
    const lugar = precio < bajo ? 'debajo' : precio > alto ? 'encima' : 'dentro';
    posicion = {
      lugar,
      diferenciaConBajo: precio - bajo,
      diferenciaConCentral: precio - central,
      porcentajeConCentral: ((precio - central) / central) * 100,
    };
  }

  // Torres del skyline 3D: €/m² ajustado (sólida) y €/m² sin ajustar (contorno).
  const torres = [];
  if (calculo.n) {
    const ordenadas = [...calculo.validos].sort((a, b) => eurosM2(a) - eurosM2(b));
    for (const c of ordenadas) {
      const original = (datos.comparables || []).find((x) => x.id === c.id) || {};
      torres.push({
        id: c.id, tipo: 'comparable', etiqueta: original.id || c.direccion,
        eurM2: eurosM2(c), eurM2SinAjuste: c.precio / c.m2, ajuste: c.ajuste,
        precio: c.precio, m2: c.m2, detalle: original.ficha || '', motivo: original.motivoAjuste || '',
      });
    }
  }
  if (Number.isFinite(eurM2Publicado)) {
    torres.push({ id: 'publicado', tipo: 'publicado', etiqueta: 'Su piso · publicado', corta: 'Publicado', eurM2: eurM2Publicado, precio, m2 });
  }
  if (calculo.suficiente) {
    torres.push({ id: 'central', tipo: 'central', etiqueta: 'Su piso · valor central', corta: 'Valor central', eurM2: calculo.porM2.mediana, precio: calculo.valor.central, m2 });
  }

  return {
    calculo, eurM2Publicado, posicion, bajada, torres, avisos,
    // La plantilla de Cerebro menciona un precio medio de zona que este dosier no muestra: se quita esa frase.
    metodologia: calculo.suficiente ? textoMetodologia(calculo).replace(/\s*El precio medio de la zona[^.]*\./, '') : '',
    borrador: !datos?.validado,
  };
}
