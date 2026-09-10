/* Render puro: recibe datos y devuelve HTML. No toca el estado ni la red. */

import { svgTestigo } from './iconos.js';
import { ETIQUETA_GRAVEDAD, ETIQUETA_CONDUCIR, categorias } from './catalogo.js';

/** Escapa texto para que nada de lo que venga de fuera se interprete como HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PUNTO = { critico: '🔴', atencion: '🟠', informativo: '🟡' };

/* ── Tarjeta completa de un testigo ─────────────────────────────────── */
export function tarjetaTestigo(t, { compacta = false } = {}) {
  const parpadeo = t.estado === 'parpadeando';
  const confianza = t.confianza && t.confianza !== 'alta'
    ? `<span class="etiqueta" style="background:rgba(120,140,170,.14);color:var(--texto-tenue)">confianza ${esc(t.confianza)}</span>`
    : '';

  return `
<article class="testigo ${t.gravedad}" data-id="${esc(t.id)}">
  <header>
    <div class="simbolo ${esc(t.color)} ${parpadeo ? 'parpadea' : ''}">${svgTestigo(t, 38)}</div>
    <div>
      <h3>${esc(t.nombre)}</h3>
      <span class="etiqueta">${PUNTO[t.gravedad]} ${esc(ETIQUETA_GRAVEDAD[t.gravedad])}</span>
      ${parpadeo ? '<span class="etiqueta" style="background:rgba(255,90,82,.16);color:var(--rojo)">parpadeando</span>' : ''}
      ${confianza}
    </div>
  </header>
  <div class="cuerpo">
    <p>${esc(t.significado)}</p>
    ${t.observacion ? `<p style="color:var(--texto-suave);font-size:.9rem"><b>En tu foto:</b> ${esc(t.observacion)}</p>` : ''}
    <div class="que-hacer ${t.gravedad}">
      <strong>Qué hacer ahora</strong>
      <span>${esc(t.que_hacer)}</span>
    </div>
    ${compacta ? '' : `
    <h3 style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--texto-tenue);margin-top:14px">Causas más probables</h3>
    <ul>${t.causas.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p style="margin-top:12px;font-size:.86rem;color:var(--texto-tenue)"><b>Cómo es el símbolo:</b> ${esc(t.forma)}</p>`}
  </div>
  <div class="pie">
    <span>Se puede conducir: <b>${esc(ETIQUETA_CONDUCIR[t.conducir])}</b></span>
    <span>Coste orientativo: <b>${esc(t.coste)}</b></span>
  </div>
</article>`;
}

/* ── Fila del catálogo ──────────────────────────────────────────────── */
export function filaCatalogo(t) {
  const cats = categorias();
  return `
<button class="fila" data-id="${esc(t.id)}" type="button">
  <span class="simbolo ${esc(t.color)}">${svgTestigo(t, 28)}</span>
  <span>
    <span class="nombre">${esc(t.nombre)}</span><br>
    <span class="meta">${esc(cats[t.categoria] || t.categoria)} · ${esc(ETIQUETA_GRAVEDAD[t.gravedad])}</span>
  </span>
  <span class="punto ${esc(t.color)}"></span>
</button>`;
}

/* ── Resumen del análisis ───────────────────────────────────────────── */
export function resumenAnalisis(resultado) {
  const criticos = resultado.testigos.filter((t) => t.gravedad === 'critico').length;
  const atencion = resultado.testigos.filter((t) => t.gravedad === 'atencion').length;
  const total = resultado.testigos.length;

  if (!total) {
    return `<div class="tarjeta">
      <h3>No he identificado ningún testigo encendido</h3>
      <p style="color:var(--texto-suave);margin:0">${esc(resultado.mensaje ||
        'Puede que el cuadro estuviera apagado, que la foto no se vea bien o que el símbolo no esté en el catálogo.')}</p>
      ${resultado.consejo_foto ? `<p style="color:var(--texto-suave);margin:10px 0 0"><b>Consejo:</b> ${esc(resultado.consejo_foto)}</p>` : ''}
    </div>`;
  }

  const titulo = criticos
    ? `${criticos} aviso${criticos > 1 ? 's' : ''} crítico${criticos > 1 ? 's' : ''}: para el coche`
    : atencion
      ? `${atencion} aviso${atencion > 1 ? 's' : ''} a revisar`
      : 'Solo avisos informativos';

  return `<div class="tarjeta" style="border-color:${criticos ? 'rgba(255,90,82,.5)' : 'var(--borde)'}">
    <h3>${esc(titulo)}</h3>
    <p style="color:var(--texto-suave);margin:0">He encontrado ${total} testigo${total > 1 ? 's' : ''} encendido${total > 1 ? 's' : ''}.
      ${criticos ? 'Empieza por el primero: es el más grave.' : ''}</p>
    ${resultado.lectura_extra ? `<p style="color:var(--texto-tenue);font-size:.86rem;margin:10px 0 0">${esc(resultado.lectura_extra)}</p>` : ''}
    ${resultado.calidad_foto === 'mala' && resultado.consejo_foto
      ? `<p style="color:var(--amarillo);font-size:.86rem;margin:10px 0 0">⚠️ ${esc(resultado.consejo_foto)}</p>` : ''}
  </div>`;
}

/* ── Testigos que la IA vio pero no supo nombrar ─────────────────────── */
export function bloqueNoIdentificados(lista) {
  if (!lista?.length) return '';
  return `<div class="tarjeta">
    <h3>Otros símbolos que se ven encendidos</h3>
    <p style="color:var(--texto-suave);font-size:.9rem;margin-bottom:8px">
      No están en el catálogo: pueden ser propios de tu marca. Búscalos en el manual del coche.</p>
    <ul style="margin:0;padding-left:20px;color:var(--texto-suave)">
      ${lista.map((n) => `<li>${esc(n.descripcion)} <span style="color:var(--texto-tenue)">(${esc(n.color)})</span></li>`).join('')}
    </ul>
  </div>`;
}

/* ── Historial ──────────────────────────────────────────────────────── */
export function filaHistorial(entrada) {
  const fecha = new Date(entrada.fecha).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const nombres = entrada.testigos?.length
    ? entrada.testigos.map((t) => t.nombre).join(', ')
    : 'Sin testigos identificados';
  const peor = entrada.testigos?.[0]?.gravedad || 'informativo';

  return `<div class="tarjeta entrada-historial" data-id="${esc(entrada.id)}">
    ${entrada.miniatura
      ? `<img class="miniatura" src="${esc(entrada.miniatura)}" alt="">`
      : `<span class="miniatura" style="display:grid;place-items:center">${PUNTO[peor]}</span>`}
    <div style="flex:1;min-width:0">
      <div style="font-size:.75rem;color:var(--texto-tenue)">${esc(fecha)}</div>
      <div style="font-weight:700;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nombres)}</div>
    </div>
    <button class="boton-mini" data-ver="${esc(entrada.id)}" type="button"
      style="background:var(--tarjeta-alta);border:1px solid var(--borde);color:var(--texto);border-radius:10px;padding:8px 11px;cursor:pointer">Ver</button>
    <button data-borrar="${esc(entrada.id)}" type="button" aria-label="Borrar"
      style="background:none;border:none;color:var(--texto-tenue);font-size:1.15rem;cursor:pointer;padding:6px">✕</button>
  </div>`;
}

export const vacio = (icono, titulo, texto) => `
  <div class="vacio">${icono}<h3 style="margin-bottom:6px">${esc(titulo)}</h3><p>${esc(texto)}</p></div>`;
