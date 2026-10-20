/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — Asistente de Pau
   Fase 3: el asistente con IA está PENDIENTE DE CONFIGURAR. No hay
   respuestas simuladas que parezcan de IA.
   Mientras, ofrece consultas que se calculan en este aparato con reglas
   fijas (sin IA y sin mandar datos a nadie). Cada respuesta enseña en
   qué registros se basa, separa datos de sugerencias y pide permiso
   antes de crear nada.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, clientesSinSeguimiento, encajeInmueble, eventosDelDia, LIMPIA, nombreCliente, nombreInmueble, proximosEventos, tareaAbierta, TIPOS_EVENTO } from './datos.js';
import { itemCliente, itemEvento, itemInmueble, itemTarea } from './comun.js';
import { casillasPendientes } from './p-notas.js';
import { cabecera, campo, confirma, copia, h, selector } from './ui.js';
import { aISO, fechaLarga, numeroES, sumaDias, telefonoWhatsapp } from './utiles.js';

const CONSULTAS = {
  dia: 'Resume mi día',
  seguimiento: 'Clientes sin seguimiento',
  manana: 'Propuesta de tareas para mañana',
  visita: 'Mensaje para confirmar una visita',
  presupuesto: 'Inmuebles para un presupuesto',
  nota: 'Convertir una nota en tareas',
};

const fuentes = (lista) => (lista.length ? `<p class="fuentes">Basado en: ${lista.join(' · ')}</p>` : '<p class="fuentes">No hay registros que encajen.</p>');

function resumenDia(ctx) {
  const hoy = aISO();
  const ev = eventosDelDia(ctx.estado, hoy);
  const abiertas = activos(ctx.estado.tareas).filter(tareaAbierta);
  const vencidas = abiertas.filter((t) => t.fecha && t.fecha < hoy);
  const deHoy = abiertas.filter((t) => t.fecha === hoy);
  const seg = clientesSinSeguimiento(ctx.estado, hoy);
  const visitas = ev.filter((e) => e.tipo === 'visita');
  const siguiente = proximosEventos(ctx.estado, new Date(), 1)[0];
  return `<div class="respuesta">
    <p><strong>${h(fechaLarga(hoy))}.</strong> Tienes <strong>${ev.length}</strong> cita${ev.length === 1 ? '' : 's'} (${visitas.length} visita${visitas.length === 1 ? '' : 's'}), <strong>${deHoy.length}</strong> tarea${deHoy.length === 1 ? '' : 's'} para hoy, <strong>${vencidas.length}</strong> vencida${vencidas.length === 1 ? '' : 's'} y <strong>${seg.length}</strong> cliente${seg.length === 1 ? '' : 's'} a seguir.</p>
    ${siguiente ? `<p>Lo siguiente: <a href="#evento/${h(siguiente.id)}">${h(siguiente.titulo)}</a> (${h(siguiente.todoElDia ? 'todo el día' : siguiente.inicio)}${siguiente.fecha !== hoy ? ', ' + h(fechaLarga(siguiente.fecha)) : ''}).</p>` : ''}
    ${ev.map((e) => itemEvento(ctx.estado, e)).join('')}
    ${[...vencidas, ...deHoy].length ? `<ul class="lista">${[...vencidas, ...deHoy].map((t) => itemTarea(ctx.estado, t, hoy)).join('')}</ul>` : ''}
    ${fuentes([`${ev.length} citas de hoy`, `${vencidas.length + deHoy.length} tareas`, `${seg.length} clientes`])}</div>`;
}

function seguimiento(ctx) {
  const lista = clientesSinSeguimiento(ctx.estado);
  return `<div class="respuesta">${lista.length ? `<p>${lista.length} cliente${lista.length === 1 ? '' : 's'} necesitan seguimiento (sin contacto en ${ctx.estado.ajustes.diasSinSeguimiento} días o con el seguimiento vencido):</p><ul class="lista">${lista.map((s) => itemCliente(s.cliente, h(s.motivo))).join('')}</ul>` : '<p>Ningún cliente necesita seguimiento ahora mismo.</p>'}
    ${fuentes(lista.map((s) => h(nombreCliente(s.cliente))))}
    <p class="fuentes">El plazo de días se cambia en Ajustes.</p></div>`;
}

/** Propuestas para mañana: cada una dice de dónde sale. No se crea nada sin confirmar. */
export function propuestasManana(estado, hoy = aISO()) {
  const manana = sumaDias(hoy, 1);
  const propuestas = [];
  const abiertas = activos(estado.tareas).filter(tareaAbierta);
  for (const t of abiertas.filter((x) => x.fecha && x.fecha < manana)) propuestas.push({ titulo: t.titulo, motivo: t.fecha < hoy ? 'tarea vencida: moverla a mañana' : 'tarea de hoy sin terminar', moverId: t.id });
  for (const s of clientesSinSeguimiento(estado, manana).slice(0, 5)) propuestas.push({ titulo: `Llamar a ${nombreCliente(s.cliente)}`, motivo: s.motivo, cliente: s.cliente.id });
  for (const e of eventosDelDia(estado, manana).filter((x) => ['visita', 'firma'].includes(x.tipo))) {
    propuestas.push({ titulo: `Confirmar: ${e.titulo}`, motivo: `${TIPOS_EVENTO[e.tipo].nombre} mañana a las ${e.inicio || 'hora sin fijar'}`, cliente: e.cliente, inmueble: e.inmueble });
  }
  return propuestas;
}

function manana(ctx) {
  const lista = propuestasManana(ctx.estado);
  if (!lista.length) return '<div class="respuesta"><p>No veo nada que preparar para mañana con los datos que tienes.</p></div>';
  ctx.filtros.propuestas = lista;
  return `<form class="respuesta" data-form="asistente-manana">
    <p><span class="sugerencia">SUGERENCIA</span> Estas tareas saldrían de tus datos. Marca las que quieras crear para mañana:</p>
    ${lista.map((p, i) => `<label class="casilla" style="display:flex;align-items:flex-start"><input type="checkbox" name="p" value="${i}" checked /> <span><strong>${h(p.titulo)}</strong><br><span class="detalle">${h(p.motivo)}</span></span></label>`).join('')}
    <p class="fuentes">Las tareas vencidas no se duplican: se mueven a mañana.</p>
    <button class="btn primario" type="submit">Revisar y crear</button></form>`;
}

function visita(ctx, query) {
  const visitas = proximosEventos(ctx.estado, new Date(), 200).filter((e) => e.tipo === 'visita' && e.estadoVisita === 'pendiente');
  if (!visitas.length) return '<div class="respuesta"><p>No tienes visitas pendientes.</p></div>';
  const id = query.get('v') || visitas[0].id;
  const e = buscaId(ctx.estado, 'eventos', id) || visitas[0];
  const c = buscaId(ctx.estado, 'clientes', e.cliente);
  const i = buscaId(ctx.estado, 'inmuebles', e.inmueble);
  const texto = `Hola${c ? ' ' + c.nombre : ''}, te escribo para confirmar la visita${i ? ` al ${i.tipo}${i.zona ? ' de ' + i.zona : ''}${i.referencia ? ` (ref. ${i.referencia})` : ''}` : ''} el ${fechaLarga(e.fecha)} a las ${e.inicio}${e.ubicacion ? ` en ${e.ubicacion}` : ''}. ¿Te viene bien? Un saludo, ${ctx.estado.ajustes.nombre}${ctx.estado.ajustes.whatsapp ? ` · WhatsApp ${ctx.estado.ajustes.whatsapp}` : ''}.`;
  const wa = c ? telefonoWhatsapp(c.telefono) : '';
  ctx.filtros.textoVisita = texto;
  return `<div class="respuesta">
    ${selector('v', 'Visita', e.id, visitas.map((x) => [x.id, `${x.fecha.split('-').reverse().join('/')} ${x.inicio} · ${x.titulo}`]), { 'data-cambio': 'asistente-visita' })}
    <p><span class="sugerencia">PLANTILLA</span> Revisa el texto antes de mandarlo:</p>
    <p class="texto-ficha">${h(texto)}</p>
    <div class="fila-botones"><button class="btn" data-accion="asistente-copiar">📋 Copiar</button>
    ${wa ? `<a class="btn primario" href="https://wa.me/${h(wa)}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener noreferrer">💬 Abrir en WhatsApp</a>` : '<span class="detalle">El cliente no tiene teléfono para WhatsApp.</span>'}</div>
    <p class="fuentes">Abrir WhatsApp no envía nada: lo envías tú desde allí. Basado en: <a href="#evento/${h(e.id)}">${h(e.titulo)}</a>${c ? ` · <a href="#cliente/${h(c.id)}">${h(nombreCliente(c))}</a>` : ''}${i ? ` · <a href="#inmueble/${h(i.id)}">${h(nombreInmueble(i))}</a>` : ''}</p></div>`;
}

function presupuesto(ctx, query) {
  const min = numeroES(query.get('min')); const max = numeroES(query.get('max'));
  const zona = query.get('zona') || ''; const op = query.get('op') || 'venta';
  const form = `<form data-form="asistente-presupuesto" class="dos-col" novalidate>
    ${campo('min', 'Desde (€)', query.get('min') || '', { inputmode: 'numeric' })}${campo('max', 'Hasta (€)', query.get('max') || '', { inputmode: 'numeric' })}
    ${campo('zona', 'Zona (opcional)', zona)}${selector('op', 'Operación', op, { venta: 'Venta', alquiler: 'Alquiler' })}
    <div><button class="btn primario" type="submit">Buscar en mi cartera</button></div></form>`;
  if (!query.has('max') && !query.has('min')) return `<div class="respuesta">${form}</div>`;
  const cliente = { presupuestoMin: min, presupuestoMax: max, zonas: zona, tipo: op === 'alquiler' ? 'inquilino' : 'comprador' };
  const lista = activos(ctx.estado.inmuebles).filter((i) => ['disponible', 'captacion'].includes(i.estadoComercial)).map((i) => ({ i, e: encajeInmueble(cliente, i) }))
    .filter((x) => x.e.encaja || (!zona && x.i.precio != null && (max == null || x.i.precio <= max) && (min == null || x.i.precio >= min) && x.i.operacion === op))
    .sort((a, b) => (a.i.precio ?? 0) - (b.i.precio ?? 0));
  return `<div class="respuesta">${form}${lista.length ? `<ul class="lista">${lista.map(({ i, e }) => itemInmueble(i, h(e.motivos.join(', ')))).join('')}</ul>` : '<p>No hay inmuebles disponibles de tu cartera que encajen. No me invento ninguno.</p>'}
    ${fuentes(lista.map(({ i }) => h(nombreInmueble(i))))}<p class="fuentes">Solo inmuebles disponibles o en captación con precio dentro del rango.</p></div>`;
}

function nota(ctx, query) {
  const notas = activos(ctx.estado.notas).filter((n) => casillasPendientes(n.texto).length);
  if (!notas.length) return '<div class="respuesta"><p>Ninguna nota tiene casillas «- [ ]» pendientes. Escribe una lista de casillas en una nota y vuelve.</p></div>';
  const n = buscaId(ctx.estado, 'notas', query.get('n')) || notas[0];
  return `<div class="respuesta">${selector('n', 'Nota', n.id, notas.map((x) => [x.id, x.titulo || x.texto.slice(0, 40)]), { 'data-cambio': 'asistente-nota' })}
    <ul>${casillasPendientes(n.texto).map((t) => `<li>${h(t)}</li>`).join('')}</ul>
    <button class="btn primario" data-accion="nota-a-tareas" data-id="${h(n.id)}">Revisar y crear tareas</button>
    ${fuentes([`<a href="#nota/${h(n.id)}">${h(n.titulo || 'nota')}</a>`])}</div>`;
}

function asistente(ctx, partes, query) {
  const consulta = CONSULTAS[partes[0]] ? partes[0] : '';
  const respuesta = { dia: resumenDia, seguimiento, manana, visita: (c) => visita(c, query), presupuesto: (c) => presupuesto(c, query), nota: (c) => nota(c, query) }[consulta];
  return `${cabecera('Asistente de Pau')}
    <section class="tarjeta">
      <p class="estado-conexion"><span class="punto" style="background:var(--atencion)"></span> Asistente con IA: pendiente de configuración (fase 3)</p>
      <p class="detalle" style="color:var(--suave)">Cuando se configure, irá por un servidor propio (la clave nunca estará en el navegador), solo con los registros que elijas y pidiendo confirmación antes de crear, cambiar, borrar o enviar nada. Se podrá apagar sin perder nada de la agenda.</p>
    </section>
    <section class="tarjeta"><h2>🧮 Consultas sobre tus datos <span class="chip">sin IA · en este aparato</span></h2>
      <div class="pestanas-int">${Object.entries(CONSULTAS).map(([k, t]) => `<a href="#asistente/${k}" ${k === consulta ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</div>
      ${respuesta ? respuesta(ctx) : '<p>Elige una consulta. Las respuestas salen solo de lo que tienes guardado y te dicen en qué registros se basan.</p>'}
    </section>`;
}

export const pantallas = { asistente };

export const formularios = {
  'asistente-presupuesto'(ctx, form, d) {
    const q = new URLSearchParams(Object.entries(d).filter(([, v]) => v));
    if (!q.has('min') && !q.has('max')) return { errores: { max: 'Pon al menos un precio máximo o mínimo.' } };
    ctx.ir(`asistente/presupuesto?${q}`);
  },
  async 'asistente-manana'(ctx, form) {
    const elegidas = [...form.querySelectorAll('input[name="p"]:checked')].map((x) => ctx.filtros.propuestas[Number(x.value)]);
    if (!elegidas.length) return;
    const manana = sumaDias(aISO(), 1);
    const si = await confirma({
      titulo: `¿Crear o mover ${elegidas.length} tarea${elegidas.length === 1 ? '' : 's'} a mañana?`,
      detalle: `<ul>${elegidas.map((p) => `<li>${p.moverId ? 'Mover' : 'Crear'}: ${h(p.titulo)}</li>`).join('')}</ul>`,
      boton: 'Sí, hacerlo',
    });
    if (!si) return;
    for (const p of elegidas) {
      if (p.moverId) { const t = buscaId(ctx.estado, 'tareas', p.moverId); if (t) { t.fecha = manana; t.actualizado = new Date().toISOString(); } }
      else ctx.estado.tareas.unshift(LIMPIA.tareas({ titulo: p.titulo, fecha: manana, cliente: p.cliente || '', inmueble: p.inmueble || '', descripcion: `Propuesta del asistente: ${p.motivo}.` }));
    }
    ctx.guardar();
    ctx.aviso('Hecho. Las tienes en Tareas → Esta semana.');
    ctx.ir('tareas/semana');
  },
};

export const acciones = {
  'asistente-visita'(ctx, el) { ctx.ir(`asistente/visita?v=${encodeURIComponent(el.value)}`); },
  'asistente-nota'(ctx, el) { ctx.ir(`asistente/nota?n=${encodeURIComponent(el.value)}`); },
  async 'asistente-copiar'(ctx) { ctx.aviso((await copia(ctx.filtros.textoVisita || '')) ? 'Texto copiado.' : 'No se ha podido copiar.'); },
};
