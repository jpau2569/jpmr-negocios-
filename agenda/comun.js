/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — piezas que comparten varias pantallas
   Elementos de lista (evento, tarea, cliente…), selectores de cliente e
   inmueble, enlaces a registros relacionados y lista de enlaces.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, ESTADOS_TAREA, nombreCliente, nombreInmueble, NOMBRE_ESTADO_CLIENTE, PRIORIDADES, TIPOS_EVENTO } from './datos.js';
import { etiquetaDemo, h, selector } from './ui.js';
import { cuando, dominio, fechaCorta } from './utiles.js';

export const colorEvento = (e) => e.color || TIPOS_EVENTO[e.tipo]?.color || '#2f6bff';

export function horaEvento(e) {
  if (e.todoElDia) return 'Todo el día';
  return e.fin ? `${e.inicio}–${e.fin}` : e.inicio;
}

/** Fila de evento enlazada a su ficha. */
export function itemEvento(estado, e, { conFecha = false } = {}) {
  const c = buscaId(estado, 'clientes', e.cliente);
  const i = buscaId(estado, 'inmuebles', e.inmueble);
  const detalle = [TIPOS_EVENTO[e.tipo]?.nombre, c && nombreCliente(c), i && nombreInmueble(i), e.ubicacion].filter(Boolean).join(' · ');
  const estadoVisita = e.tipo === 'visita' && e.estadoVisita !== 'pendiente' ? ` <span class="chip ${e.estadoVisita === 'realizada' ? 'chip-ok' : 'chip-mal'}">${e.estadoVisita === 'realizada' ? 'Realizada' : 'Cancelada'}</span>` : '';
  return `<a class="evento" href="#evento/${h(e.id)}">
    <span class="barra" style="background:${h(colorEvento(e))}" aria-hidden="true"></span>
    <span class="hora">${conFecha ? `${h(cuando(e.fecha))}<br>` : ''}${h(horaEvento(e))}</span>
    <span class="cuerpo"><span class="titulo">${h(e.titulo)}</span>${etiquetaDemo(e)}${estadoVisita}<br><span class="detalle">${h(detalle)}</span></span>
  </a>`;
}

/** Fila de tarea con su casilla de hecho. */
export function itemTarea(estado, t, hoy) {
  const vencida = t.estado !== 'hecha' && t.fecha && t.fecha < hoy;
  const subt = t.subtareas.length ? ` · ${t.subtareas.filter((s) => s.hecha).length}/${t.subtareas.length} subtareas` : '';
  const c = buscaId(estado, 'clientes', t.cliente);
  const i = buscaId(estado, 'inmuebles', t.inmueble);
  const rel = [c && nombreCliente(c), i && nombreInmueble(i)].filter(Boolean).join(' · ');
  return `<li class="elemento ${t.estado === 'hecha' ? 'hecha' : ''}">
    <input type="checkbox" class="check" data-cambio="tarea-hecha" data-id="${h(t.id)}" ${t.estado === 'hecha' ? 'checked' : ''} aria-label="Marcar «${h(t.titulo)}» como hecha" />
    <a class="cuerpo" href="#tarea/${h(t.id)}" style="color:inherit;text-decoration:none">
      <span class="titulo">${h(t.titulo)}</span>${etiquetaDemo(t)}
      <br><span class="detalle"><span class="${vencida ? 'vencida' : ''}">${vencida ? 'Vencida · ' : ''}${h(t.fecha ? cuando(t.fecha, hoy) : 'Sin fecha')}${t.hora ? ' ' + h(t.hora) : ''}</span> · ${h(PRIORIDADES[t.prioridad])}${t.estado === 'curso' ? ' · ' + ESTADOS_TAREA.curso : ''}${h(subt)}${t.repeticion ? ' · 🔁' : ''}${rel ? ' · ' + h(rel) : ''}</span>
    </a>
  </li>`;
}

export function itemCliente(c, extra = '', despues = '') {
  return `<li><a class="elemento" href="#cliente/${h(c.id)}">
    <span class="cuerpo"><span class="titulo">${h(nombreCliente(c))}</span>${etiquetaDemo(c)}
    <br><span class="detalle">${h(NOMBRE_ESTADO_CLIENTE[c.estado])} · ${h(c.tipo)}${c.telefono ? ' · ' + h(c.telefono) : ''}${extra ? ' · ' + extra : ''}</span></span>
    <span aria-hidden="true">›</span></a>${despues}</li>`;
}

export function itemInmueble(i, extra = '', despues = '') {
  const precio = i.precio != null ? i.precio.toLocaleString('es-ES') + ' €' + (i.operacion === 'alquiler' ? '/mes' : '') : 'sin precio';
  return `<li><a class="elemento" href="#inmueble/${h(i.id)}">
    <span class="cuerpo"><span class="titulo">${h(nombreInmueble(i))}</span>${etiquetaDemo(i)}
    <br><span class="detalle">${h(i.tipo)} · ${h(i.operacion)} · ${h(precio)}${i.zona ? ' · ' + h(i.zona) : ''}${extra ? ' · ' + extra : ''}</span></span>
    <span aria-hidden="true">›</span></a>${despues}</li>`;
}

/** Desplegables de relación (cliente / inmueble) para cualquier formulario. */
export function selectorCliente(estado, valor, etiqueta = 'Cliente relacionado', nombre = 'cliente') {
  const ops = activos(estado.clientes).sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b), 'es')).map((c) => [c.id, nombreCliente(c) + (c.demo ? ' (ejemplo)' : '')]);
  return selector(nombre, etiqueta, valor, ops, { vacio: '— Ninguno —' });
}
export function selectorInmueble(estado, valor, etiqueta = 'Inmueble relacionado', nombre = 'inmueble') {
  const ops = activos(estado.inmuebles).map((i) => [i.id, nombreInmueble(i) + (i.demo ? ' (ejemplo)' : '')]);
  return selector(nombre, etiqueta, valor, ops, { vacio: '— Ninguno —' });
}

/** «Cliente: Marta · Inmueble: DEMO-01» con enlaces. */
export function relaciones(estado, r) {
  const partes = [];
  const c = buscaId(estado, 'clientes', r.cliente);
  const i = buscaId(estado, 'inmuebles', r.inmueble);
  if (c) partes.push(`👤 <a href="#cliente/${h(c.id)}">${h(nombreCliente(c))}</a>${c.borrado ? ' (en la papelera)' : ''}`);
  if (i) partes.push(`🏠 <a href="#inmueble/${h(i.id)}">${h(nombreInmueble(i))}</a>${i.borrado ? ' (en la papelera)' : ''}`);
  if (r.tarea) { const t = buscaId(estado, 'tareas', r.tarea); if (t) partes.push(`✅ <a href="#tarea/${h(t.id)}">${h(t.titulo)}</a>`); }
  if (r.evento) { const e = buscaId(estado, 'eventos', r.evento); if (e) partes.push(`📅 <a href="#evento/${h(e.id)}">${h(e.titulo)}</a>`); }
  return partes.length ? `<p class="detalle">${partes.join(' · ')}</p>` : '';
}

/** Lista de enlaces que se abren en otra pestaña (sin pasar datos de la app). */
export function listaEnlaces(enlaces) {
  if (!enlaces.length) return '';
  return `<ul class="lista">${enlaces.map((e) => `<li><a class="elemento" href="${h(e.url)}" target="_blank" rel="noopener noreferrer"><span class="cuerpo"><span class="titulo">${h(e.titulo || dominio(e.url))}</span><br><span class="detalle">${h(e.url)}</span></span><span aria-hidden="true">↗</span></a></li>`).join('')}</ul>`;
}
/** Enlaces escritos uno por línea («https://… título opcional»). */
export const enlacesDeTexto = (texto) => String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [url, ...resto] = l.split(/\s+/);
  return { url, titulo: resto.join(' ') };
});
export const enlacesATexto = (enlaces) => enlaces.map((e) => `${e.url}${e.titulo ? ' ' + e.titulo : ''}`).join('\n');

export const fechaTexto = (iso) => (iso ? fechaCorta(iso) : '—');

/** Botón para mandar a la papelera. */
export const botonPapelera = (coleccion, id) => `<button type="button" class="btn peligro" data-accion="papelera" data-coleccion="${h(coleccion)}" data-id="${h(id)}">🗑 Papelera</button>`;
