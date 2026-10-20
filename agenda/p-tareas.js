/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — tareas
   Vistas Hoy, Esta semana, Vencidas, Sin fecha, Completadas y Tablero.
   Prioridad, fecha y hora, subtareas, etiquetas, repetición (al marcar
   como hecha se crea la siguiente), cliente, inmueble y enlaces.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, ESTADOS_TAREA, PRIORIDADES, REPETICIONES, siguienteRepeticion } from './datos.js';
import { botonPapelera, enlacesATexto, enlacesDeTexto, itemTarea, listaEnlaces, relaciones, selectorCliente, selectorInmueble } from './comun.js';
import { cabecera, campo, chips, etiquetaDemo, h, selector, vacio } from './ui.js';
import { aISO, cuando, esISO, fechaCorta, fechaLarga, lunesDe, sumaDias } from './utiles.js';

const VISTAS = { hoy: 'Hoy', semana: 'Esta semana', vencidas: 'Vencidas', sinfecha: 'Sin fecha', hechas: 'Completadas', todas: 'Todas', tablero: 'Tablero' };
const PESO = { alta: 0, media: 1, baja: 2 };
const orden = (a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora || '99').localeCompare(b.hora || '99') || PESO[a.prioridad] - PESO[b.prioridad];

function filtra(lista, vista, hoy) {
  const abiertas = lista.filter((t) => t.estado !== 'hecha');
  const domingo = sumaDias(lunesDe(hoy), 6);
  switch (vista) {
    case 'hoy': return abiertas.filter((t) => t.fecha && t.fecha <= hoy).sort(orden);
    case 'semana': return abiertas.filter((t) => t.fecha && t.fecha >= hoy && t.fecha <= domingo).sort(orden);
    case 'vencidas': return abiertas.filter((t) => t.fecha && t.fecha < hoy).sort(orden);
    case 'sinfecha': return abiertas.filter((t) => !t.fecha).sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad]);
    case 'hechas': return lista.filter((t) => t.estado === 'hecha').sort((a, b) => b.completada.localeCompare(a.completada));
    default: return abiertas.sort(orden);
  }
}

function tareas(ctx, partes) {
  const vista = VISTAS[partes[0]] ? partes[0] : 'hoy';
  const hoy = aISO();
  const todas = activos(ctx.estado.tareas);
  const etiqueta = ctx.filtros.tareaEtiqueta || '';
  const lista = etiqueta ? todas.filter((t) => t.etiquetas.includes(etiqueta)) : todas;
  const etiquetasTodas = [...new Set(todas.flatMap((t) => t.etiquetas))].sort();
  const cuenta = (v) => filtra(lista, v, hoy).length;
  const pestanas = `<div class="pestanas-int">${Object.entries(VISTAS).map(([k, t]) => `<a href="#tareas/${k}" ${k === vista ? 'aria-current="page"' : ''}>${t}${['hoy', 'vencidas'].includes(k) && cuenta(k) ? ` (${cuenta(k)})` : ''}</a>`).join('')}</div>`;
  const filtro = etiquetasTodas.length ? `<div class="filtros"><div class="ancho"><label class="sr" for="f-etq">Filtrar por etiqueta</label><select id="f-etq" class="entrada" data-cambio="tarea-etiqueta"><option value="">Todas las etiquetas</option>${etiquetasTodas.map((e) => `<option ${e === etiqueta ? 'selected' : ''}>${h(e)}</option>`).join('')}</select></div></div>` : '';
  const cab = cabecera('Tareas', '<a class="btn primario" href="#tarea/nuevo">＋ Tarea</a>');
  if (vista === 'tablero') {
    return `${cab}${pestanas}${filtro}<div class="tablero">${Object.entries(ESTADOS_TAREA).map(([k, nombre]) => {
      const col = lista.filter((t) => t.estado === k).sort(orden).slice(0, k === 'hecha' ? 30 : 200);
      return `<section aria-label="${h(nombre)}"><h2><span>${h(nombre)}</span><span class="chip">${lista.filter((t) => t.estado === k).length}</span></h2>
        ${col.map((t) => `<div class="tarjeta-mini"><a href="#tarea/${h(t.id)}">${h(t.titulo)}</a>${etiquetaDemo(t)}<br><span class="detalle">${h(t.fecha ? cuando(t.fecha, hoy) : 'Sin fecha')} · ${h(PRIORIDADES[t.prioridad])}</span>
          <label class="sr" for="m-${h(t.id)}">Mover «${h(t.titulo)}»</label><select id="m-${h(t.id)}" data-cambio="tarea-mover" data-id="${h(t.id)}">${Object.entries(ESTADOS_TAREA).map(([v, n]) => `<option value="${v}" ${v === t.estado ? 'selected' : ''}>${v === t.estado ? n : 'Mover a: ' + n}</option>`).join('')}</select></div>`).join('') || '<p class="detalle" style="color:var(--suave)">Vacío</p>'}</section>`;
    }).join('')}</div>`;
  }
  const res = filtra(lista, vista, hoy);
  const textosVacio = { hoy: 'Nada pendiente para hoy. 🎉', semana: 'Nada más para esta semana.', vencidas: 'No tienes tareas vencidas.', sinfecha: 'Todas tus tareas tienen fecha.', hechas: 'Aún no has completado tareas.', todas: 'No hay tareas abiertas.' };
  return `${cab}${pestanas}${filtro}<section class="tarjeta">${res.length ? `<ul class="lista">${res.map((t) => itemTarea(ctx.estado, t, hoy)).join('')}</ul>` : vacio('✅', textosVacio[vista], '<a class="btn" href="#tarea/nuevo">Nueva tarea</a>')}</section>`;
}

function formularioTarea(ctx, t, nuevo) {
  return `${cabecera(nuevo ? 'Nueva tarea' : 'Editar tarea', '', nuevo ? 'tareas' : `tarea/${t.id}`)}
  <form class="tarjeta ficha" data-form="tarea" data-vigilar novalidate>
    <input type="hidden" name="id" value="${h(nuevo ? '' : t.id)}" />
    ${campo('titulo', 'Título', t.titulo, { required: true, maxlength: 160, placeholder: 'Pedir nota simple del piso de Uría' })}
    <div class="dos-col">
      ${campo('fecha', 'Fecha límite', t.fecha, { tipo: 'date' })}
      ${campo('hora', 'Hora (opcional)', t.hora, { tipo: 'time', step: 300 })}
      ${selector('prioridad', 'Prioridad', t.prioridad, PRIORIDADES)}
      ${selector('estado', 'Estado', t.estado, ESTADOS_TAREA)}
      ${selector('repeticion', 'Repetición', t.repeticion, REPETICIONES, { ayuda: 'Al marcarla como hecha se crea la siguiente.' })}
      ${campo('etiquetas', 'Etiquetas (separadas por comas)', t.etiquetas.join(', '), { maxlength: 300 })}
    </div>
    ${campo('descripcion', 'Descripción', t.descripcion, { tipo: 'textarea', maxlength: 4000 })}
    ${campo('subtareas', 'Subtareas (una por línea; empieza con [x] las hechas)', t.subtareas.map((s) => `${s.hecha ? '[x] ' : ''}${s.texto}`).join('\n'), { tipo: 'textarea', rows: 3 })}
    <div class="dos-col">${selectorCliente(ctx.estado, t.cliente)}${selectorInmueble(ctx.estado, t.inmueble)}</div>
    ${campo('enlaces', 'Enlaces o documentos (uno por línea)', enlacesATexto(t.enlaces), { tipo: 'textarea', rows: 2, placeholder: 'https://… título opcional' })}
    <div class="barra-guardar"><a class="btn secundario" href="#${nuevo ? 'tareas' : 'tarea/' + h(t.id)}">Cancelar</a><button class="btn primario" type="submit">Guardar tarea</button></div>
  </form>`;
}

function tarea(ctx, partes, query) {
  const [id, modo] = partes;
  if (id === 'nuevo') {
    return formularioTarea(ctx, { titulo: query.get('titulo') || '', fecha: esISO(query.get('fecha')) ? query.get('fecha') : '', hora: '', prioridad: 'media', estado: 'pendiente', repeticion: '', etiquetas: [], descripcion: '', subtareas: [], cliente: query.get('cliente') || '', inmueble: query.get('inmueble') || '', enlaces: [] }, true);
  }
  const t = buscaId(ctx.estado, 'tareas', id);
  if (!t || t.borrado) return `${cabecera('Tarea no encontrada', '', 'tareas')}${vacio('🔍', 'Esta tarea no existe o está en la papelera.')}`;
  if (modo === 'editar') return formularioTarea(ctx, t, false);
  const hoy = aISO();
  const vencida = t.estado !== 'hecha' && t.fecha && t.fecha < hoy;
  return `${cabecera(t.titulo, `<a class="btn" href="#tarea/${h(t.id)}/editar">✏️ Editar</a>`, 'tareas')}
    <section class="tarjeta">
      <p>${etiquetaDemo(t)} <span class="chip ${t.estado === 'hecha' ? 'chip-ok' : 'chip-info'}">${h(ESTADOS_TAREA[t.estado])}</span> <span class="chip">Prioridad ${h(PRIORIDADES[t.prioridad].toLowerCase())}</span> ${t.repeticion ? `<span class="chip">🔁 ${h(REPETICIONES[t.repeticion])}</span>` : ''} ${vencida ? '<span class="chip chip-mal">Vencida</span>' : ''}</p>
      <dl class="datos"><dt>Fecha</dt><dd>${t.fecha ? h(fechaLarga(t.fecha)) + (t.hora ? ' · ' + h(t.hora) : '') : 'Sin fecha'}</dd>
      ${t.completada ? `<dt>Hecha</dt><dd>${h(fechaCorta(t.completada.slice(0, 10)))}</dd>` : ''}</dl>
      ${relaciones(ctx.estado, t)}
      ${t.etiquetas.length ? `<p>${chips(t.etiquetas)}</p>` : ''}
      ${t.descripcion ? `<p class="texto-ficha">${h(t.descripcion)}</p>` : ''}
      ${t.subtareas.length ? `<h2 style="margin-top:1rem">Subtareas</h2><ul class="lista">${t.subtareas.map((s) => `<li><label class="casilla"><input type="checkbox" data-cambio="subtarea" data-id="${h(t.id)}" data-s="${h(s.id)}" ${s.hecha ? 'checked' : ''} /> <span>${h(s.texto)}</span></label></li>`).join('')}</ul>` : ''}
      ${listaEnlaces(t.enlaces)}
      <div class="fila-botones">
        <button class="btn ${t.estado === 'hecha' ? '' : 'primario'}" data-accion="tarea-alternar" data-id="${h(t.id)}">${t.estado === 'hecha' ? '↩ Volver a pendiente' : '✔ Marcar como hecha'}</button>
        ${t.fecha ? `<a class="btn" href="#agenda/dia/${t.fecha}">📅 Ver ese día</a>` : ''}
        ${botonPapelera('tareas', t.id)}
      </div>
    </section>`;
}

/** Marca una tarea como hecha o pendiente; si se repite, crea la siguiente. */
export function marcaTarea(ctx, t, hecha) {
  t.estado = hecha ? 'hecha' : 'pendiente';
  t.completada = hecha ? new Date().toISOString() : '';
  t.actualizado = new Date().toISOString();
  let mensaje = hecha ? 'Tarea hecha. ✔' : 'Tarea pendiente otra vez.';
  if (hecha && t.repeticion) {
    const ya = ctx.estado.tareas.some((o) => !o.borrado && o.id !== t.id && o.titulo === t.titulo && o.estado !== 'hecha' && o.fecha > t.fecha);
    const sig = ya ? null : siguienteRepeticion(t, aISO());
    if (sig) { ctx.estado.tareas.unshift(sig); mensaje += ` La siguiente queda para el ${fechaCorta(sig.fecha)}.`; }
  }
  ctx.guardar();
  ctx.aviso(mensaje);
}

export const pantallas = { tareas, tarea };

export const formularios = {
  tarea(ctx, form, d) {
    const enlaces = enlacesDeTexto(d.enlaces);
    const mal = enlaces.find((x) => !/^https?:\/\//i.test(x.url));
    if (mal) return { errores: { enlaces: `Este enlace no es válido: ${mal.url}` } };
    const previo = d.id ? buscaId(ctx.estado, 'tareas', d.id) : null;
    const subtareas = String(d.subtareas || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
      const hecha = /^\[x\]\s*/i.test(l);
      const texto = l.replace(/^\[[x ]?\]\s*/i, '');
      const ant = previo?.subtareas.find((s) => s.texto === texto) || previo?.subtareas[i];
      return { id: ant?.id, texto, hecha };
    });
    const pasaAHecha = d.estado === 'hecha' && previo?.estado !== 'hecha';
    const r = ctx.guardaRegistro('tareas', { ...d, enlaces, subtareas, etiquetas: d.etiquetas, completada: d.estado === 'hecha' ? previo?.completada || new Date().toISOString() : '' });
    if (!r.ok) return { errores: r.errores };
    if (pasaAHecha && r.registro.repeticion) { r.registro.estado = 'pendiente'; marcaTarea(ctx, r.registro, true); }
    else ctx.aviso(r.nuevo ? `Tarea creada${r.registro.fecha ? ' para el ' + fechaCorta(r.registro.fecha) : ''}.` : 'Tarea guardada.');
    ctx.sucio = false;
    ctx.ir(`tarea/${r.registro.id}`);
  },
};

export const acciones = {
  'tarea-hecha'(ctx, el) {
    const t = buscaId(ctx.estado, 'tareas', el.dataset.id);
    if (!t) return;
    marcaTarea(ctx, t, el.checked);
    ctx.repinta();
  },
  'tarea-alternar'(ctx, el) {
    const t = buscaId(ctx.estado, 'tareas', el.dataset.id);
    if (!t) return;
    marcaTarea(ctx, t, t.estado !== 'hecha');
    ctx.repinta();
  },
  'tarea-mover'(ctx, el) {
    const t = buscaId(ctx.estado, 'tareas', el.dataset.id);
    if (!t) return;
    if (el.value === 'hecha') marcaTarea(ctx, t, true);
    else { t.estado = el.value; t.completada = ''; t.actualizado = new Date().toISOString(); ctx.guardar(); }
    ctx.repinta();
  },
  'tarea-etiqueta'(ctx, el) { ctx.filtros.tareaEtiqueta = el.value; ctx.repinta(); },
  subtarea(ctx, el) {
    const t = buscaId(ctx.estado, 'tareas', el.dataset.id);
    const s = t?.subtareas.find((x) => x.id === el.dataset.s);
    if (!s) return;
    s.hecha = el.checked;
    t.actualizado = new Date().toISOString();
    ctx.guardar();
    if (t.subtareas.every((x) => x.hecha) && t.estado !== 'hecha') ctx.aviso('Todas las subtareas hechas. ¿Marcas la tarea como hecha?', { accion: { texto: 'Marcar', hacer: () => { marcaTarea(ctx, t, true); ctx.repinta(); } } });
  },
};
