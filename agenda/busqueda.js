/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — buscador global
   Busca en clientes, inmuebles, eventos, tareas, notas y recursos, sin
   tildes ni mayúsculas, y devuelve los resultados agrupados. Todas las
   palabras tienen que aparecer (así «marta oviedo» afina, no amplía).
   ═══════════════════════════════════════════════════════════════════ */

import { activos, nombreCliente, nombreInmueble, TIPOS_EVENTO, TIPOS_RECURSO } from './datos.js';
import { fechaCorta, normaliza } from './utiles.js';

export const GRUPOS = {
  clientes: { nombre: 'Clientes', icono: '👤', ancla: 'cliente' },
  inmuebles: { nombre: 'Inmuebles', icono: '🏠', ancla: 'inmueble' },
  eventos: { nombre: 'Agenda', icono: '📅', ancla: 'evento' },
  tareas: { nombre: 'Tareas', icono: '✅', ancla: 'tarea' },
  notas: { nombre: 'Notas', icono: '📝', ancla: 'nota' },
  recursos: { nombre: 'Biblioteca', icono: '🔗', ancla: 'recurso' },
};

const TEXTO = {
  clientes: (c) => [nombreCliente(c), c.telefono, c.email, c.zonas, c.procedencia, c.preferencias, c.notas, c.etiquetas.join(' '), c.proximaAccion],
  inmuebles: (i) => [i.referencia, i.titulo, i.tipo, i.zona, i.direccion, i.descripcion, i.notasInternas, i.caracteristicas.join(' ')],
  eventos: (e) => [e.titulo, e.ubicacion, e.descripcion, TIPOS_EVENTO[e.tipo]?.nombre],
  tareas: (t) => [t.titulo, t.descripcion, t.etiquetas.join(' '), t.subtareas.map((s) => s.texto).join(' ')],
  notas: (n) => [n.titulo, n.texto, n.etiquetas.join(' ')],
  recursos: (r) => [r.titulo, r.url, r.descripcion, r.coleccion, r.etiquetas.join(' '), TIPOS_RECURSO[r.tipo]],
};

const TITULO = {
  clientes: (c) => nombreCliente(c),
  inmuebles: (i) => nombreInmueble(i),
  eventos: (e) => e.titulo,
  tareas: (t) => t.titulo,
  notas: (n) => n.titulo || n.texto.split('\n')[0].slice(0, 80) || 'Nota sin título',
  recursos: (r) => r.titulo || r.url,
};
const DETALLE = {
  clientes: (c) => [c.telefono, c.zonas].filter(Boolean).join(' · '),
  inmuebles: (i) => [i.zona, i.precio != null ? i.precio.toLocaleString('es-ES') + ' €' : ''].filter(Boolean).join(' · '),
  eventos: (e) => [fechaCorta(e.fecha), e.inicio].filter(Boolean).join(' '),
  tareas: (t) => (t.fecha ? fechaCorta(t.fecha) : 'Sin fecha') + (t.estado === 'hecha' ? ' · hecha' : ''),
  notas: (n) => fechaCorta(n.actualizado.slice(0, 10)),
  recursos: (r) => r.coleccion || '',
};

/**
 * @param {string} consulta
 * @param {string[]} [grupos] colecciones donde buscar (todas por defecto)
 * @returns {{coleccion:string, resultados:{id:string,titulo:string,detalle:string}[]}[]}
 */
export function buscaGlobal(estado, consulta, grupos = Object.keys(GRUPOS), max = 8) {
  const palabras = normaliza(consulta).split(' ').filter((p) => p.length > 0);
  if (!palabras.length) return [];
  const salida = [];
  for (const col of grupos) {
    const resultados = [];
    for (const r of activos(estado[col])) {
      const texto = normaliza(TEXTO[col](r).filter(Boolean).join(' '));
      if (!palabras.every((p) => texto.includes(p))) continue;
      const titulo = TITULO[col](r);
      const enTitulo = palabras.every((p) => normaliza(titulo).includes(p));
      resultados.push({ id: r.id, titulo, detalle: DETALLE[col](r), demo: r.demo, peso: enTitulo ? 0 : 1 });
    }
    resultados.sort((a, b) => a.peso - b.peso || a.titulo.localeCompare(b.titulo, 'es'));
    if (resultados.length) salida.push({ coleccion: col, total: resultados.length, resultados: resultados.slice(0, max) });
  }
  return salida;
}
