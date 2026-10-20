/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — agenda interna
   Vistas día, semana (empieza en lunes), mes y lista de próximos.
   Eventos con tipo, horas o día completo, varios días, ubicación,
   cliente, inmueble, enlaces, color y recordatorios (avisos dentro de
   la app mientras está abierta: ver recordatorios.js).
   Google Calendar: pendiente de conectar (fase 2). La repetición de
   eventos llegará con esa sincronización; hoy no existe y no se ofrece.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, ESTADOS_VISITA, eventosDelDia, nombreCliente, nombreInmueble, proximosEventos, RECORDATORIOS, tareaAbierta, TIPOS_EVENTO } from './datos.js';
import { botonPapelera, colorEvento, enlacesATexto, enlacesDeTexto, horaEvento, itemEvento, itemTarea, listaEnlaces, relaciones, selectorCliente, selectorInmueble } from './comun.js';
import { icsEventos } from './exportar.js';
import { cabecera, campo, casilla, casillas, descarga, etiquetaDemo, h, selector, vacio } from './ui.js';
import { aISO, cuando, DIAS_CORTOS, deISO, deMinutos, esISO, fechaCorta, fechaLarga, lunesDe, MESES, nombreArchivo, sumaDias, sumaMeses } from './utiles.js';

const VISTAS = { dia: 'Día', semana: 'Semana', mes: 'Mes', lista: 'Próximos' };

function navegacion(vistaActual, fecha, titulo, anterior, siguiente) {
  return `${cabecera('Agenda', `<a class="btn primario" href="#evento/nuevo?fecha=${fecha}">＋ Evento</a>`)}
    <div class="pestanas-int" role="tablist" aria-label="Vista de la agenda">${Object.entries(VISTAS).map(([k, t]) => `<a href="#agenda/${k}/${fecha}" ${k === vistaActual ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</div>
    ${vistaActual === 'lista' ? '' : `<div class="nav-fecha">
      <strong>${h(titulo)}</strong>
      <a class="btn pequeno" href="#agenda/${vistaActual}/${anterior}" aria-label="Anterior">‹</a>
      <a class="btn pequeno" href="#agenda/${vistaActual}/${aISO()}">Hoy</a>
      <a class="btn pequeno" href="#agenda/${vistaActual}/${siguiente}" aria-label="Siguiente">›</a>
      <label class="sr" for="ir-fecha">Ir a una fecha</label><input id="ir-fecha" type="date" class="entrada" style="width:auto;min-height:36px" value="${fecha}" data-cambio="agenda-fecha" data-vista="${vistaActual}" />
    </div>`}`;
}

function vistaDia(ctx, fecha) {
  const ev = eventosDelDia(ctx.estado, fecha);
  const tareas = activos(ctx.estado.tareas).filter((t) => t.fecha === fecha).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
  return `${navegacion('dia', fecha, fechaLarga(fecha), sumaDias(fecha, -1), sumaDias(fecha, 1))}
    <section class="tarjeta"><h2>Citas</h2>${ev.length ? ev.map((e) => itemEvento(ctx.estado, e)).join('') : vacio('🗓', 'Sin citas este día.', `<a class="btn" href="#evento/nuevo?fecha=${fecha}">Añadir una cita</a>`)}</section>
    <section class="tarjeta"><h2>Tareas del día <a class="mas" href="#tarea/nuevo?fecha=${fecha}">＋ Tarea</a></h2>${tareas.length ? `<ul class="lista">${tareas.map((t) => itemTarea(ctx.estado, t, aISO())).join('')}</ul>` : vacio('✅', 'Sin tareas con esta fecha.')}</section>`;
}

function vistaSemana(ctx, fecha) {
  const lunes = lunesDe(fecha);
  const hoy = aISO();
  const dias = Array.from({ length: 7 }, (_, i) => sumaDias(lunes, i));
  const fin = dias[6];
  const titulo = `${fechaCorta(lunes)} – ${fechaCorta(fin)}`;
  return `${navegacion('semana', fecha, titulo, sumaDias(lunes, -7), sumaDias(lunes, 7))}
    <div class="semana">${dias.map((d) => {
      const ev = eventosDelDia(ctx.estado, d);
      const nTareas = activos(ctx.estado.tareas).filter((t) => t.fecha === d && tareaAbierta(t)).length;
      return `<section class="dia-semana ${d === hoy ? 'hoy' : ''}"><h3><a href="#agenda/dia/${d}">${h(cuando(d, hoy))}${['Hoy', 'Mañana', 'Ayer'].includes(cuando(d, hoy)) ? ' · ' + fechaCorta(d).slice(0, 5) : ''}</a></h3>
        ${ev.map((e) => itemEvento(ctx.estado, e)).join('') || '<p class="detalle" style="color:var(--suave);margin:0;font-size:.85rem">—</p>'}
        ${nTareas ? `<a class="detalle" href="#agenda/dia/${d}">✅ ${nTareas} tarea${nTareas > 1 ? 's' : ''}</a>` : ''}</section>`;
    }).join('')}</div>`;
}

function vistaMes(ctx, fecha) {
  const d = deISO(fecha);
  const primero = aISO(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const inicio = lunesDe(primero);
  const hoy = aISO();
  const mes = d.getMonth();
  const celdas = Array.from({ length: 42 }, (_, i) => sumaDias(inicio, i));
  // Si la última fila es entera del mes siguiente, no se pinta.
  const filas = deISO(celdas[35]).getMonth() !== mes ? 35 : 42;
  return `${navegacion('mes', fecha, `${MESES[mes]} ${d.getFullYear()}`, sumaMeses(primero, -1), sumaMeses(primero, 1))}
    <div class="mes" role="grid" aria-label="Mes">${DIAS_CORTOS.map((x) => `<div class="cab" aria-hidden="true">${x}</div>`).join('')}
    ${celdas.slice(0, filas).map((c) => {
      const ev = eventosDelDia(ctx.estado, c);
      const nT = activos(ctx.estado.tareas).filter((t) => t.fecha === c && tareaAbierta(t)).length;
      const etiqueta = `${fechaLarga(c)}: ${ev.length} cita${ev.length === 1 ? '' : 's'}${nT ? `, ${nT} tarea${nT > 1 ? 's' : ''}` : ''}`;
      return `<a href="#agenda/dia/${c}" class="${deISO(c).getMonth() !== mes ? 'fuera' : ''} ${c === hoy ? 'hoy' : ''}" aria-label="${h(etiqueta)}">
        <span>${deISO(c).getDate()}</span>
        ${ev.slice(0, 2).map((e) => `<span class="titulo-mini">${h(e.todoElDia ? '' : e.inicio + ' ')}${h(e.titulo)}</span>`).join('')}
        <span class="puntos">${ev.slice(0, 5).map((e) => `<span class="punto" style="background:${h(colorEvento(e))}"></span>`).join('')}${nT ? '<span class="punto" style="background:var(--suave)"></span>' : ''}</span></a>`;
    }).join('')}</div>
    <p class="detalle" style="color:var(--suave);font-size:.85rem">Toca un día para ver sus citas y tareas. Puntos de color: citas; gris: tareas.</p>`;
}

function vistaLista(ctx) {
  const ev = proximosEventos(ctx.estado, new Date(), 80);
  const hoy = aISO();
  let ultimo = '';
  const filas = ev.map((e) => {
    const cab = e.fecha !== ultimo ? `<h3 style="font-size:.95rem;margin:1rem 0 .4rem;text-transform:capitalize">${h(cuando(e.fecha, hoy))} · ${h(fechaLarga(e.fecha))}</h3>` : '';
    ultimo = e.fecha;
    return cab + itemEvento(ctx.estado, e);
  }).join('');
  return `${navegacion('lista', hoy)}<section class="tarjeta">${filas || vacio('🗓', 'No hay eventos próximos.', `<a class="btn primario" href="#evento/nuevo">Nueva cita</a>`)}</section>`;
}

function agenda(ctx, partes) {
  const vista = VISTAS[partes[0]] ? partes[0] : ctx.filtros.agendaVista || 'dia';
  ctx.filtros.agendaVista = vista;
  const fecha = esISO(partes[1]) ? partes[1] : aISO();
  return { dia: vistaDia, semana: vistaSemana, mes: vistaMes, lista: vistaLista }[vista](ctx, fecha);
}

/* ───────────── ficha y formulario ───────────── */

function formularioEvento(ctx, e, nuevo) {
  const tipos = Object.fromEntries(Object.entries(TIPOS_EVENTO).map(([k, v]) => [k, v.nombre]));
  return `${cabecera(nuevo ? 'Nueva cita' : 'Editar cita', '', nuevo ? 'agenda' : `evento/${e.id}`)}
  <form class="tarjeta ficha" data-form="evento" data-vigilar novalidate>
    <input type="hidden" name="id" value="${h(nuevo ? '' : e.id)}" />
    ${campo('titulo', 'Título', e.titulo, { required: true, maxlength: 140, placeholder: 'Visita con Marta al piso de Uría' })}
    <div class="dos-col">
      ${selector('tipo', 'Tipo', e.tipo, tipos, { 'data-cambio': 'evento-tipo' })}
      ${campo('fecha', 'Fecha', e.fecha, { tipo: 'date', required: true })}
    </div>
    ${casilla('todoElDia', 'Todo el día', e.todoElDia)}
    <div class="dos-col horas ${e.todoElDia ? 'oculto' : ''}">
      ${campo('inicio', 'Hora de inicio', e.inicio, { tipo: 'time', step: 300 })}
      ${campo('fin', 'Hora de fin', e.fin, { tipo: 'time', step: 300, ayuda: 'Opcional. Si no la pones, se cuenta una hora.' })}
    </div>
    ${campo('fechaFin', 'Termina otro día (opcional)', e.fechaFin, { tipo: 'date', ayuda: 'Solo para eventos de varios días.' })}
    ${campo('ubicacion', 'Ubicación', e.ubicacion, { maxlength: 200, placeholder: 'Calle, número, ciudad' })}
    <div class="dos-col">${selectorCliente(ctx.estado, e.cliente)}${selectorInmueble(ctx.estado, e.inmueble)}</div>
    <div class="estado-visita ${e.tipo === 'visita' ? '' : 'oculto'}">${selector('estadoVisita', 'Estado de la visita', e.estadoVisita, ESTADOS_VISITA)}</div>
    ${campo('descripcion', 'Descripción', e.descripcion, { tipo: 'textarea', maxlength: 4000 })}
    ${campo('enlaces', 'Enlaces o documentos (uno por línea)', enlacesATexto(e.enlaces), { tipo: 'textarea', rows: 2, placeholder: 'https://… título opcional' })}
    ${casillas('recordatorios', 'Recordatorios', RECORDATORIOS, e.recordatorios)}
    <p class="ayuda" style="color:var(--suave);font-size:.85rem;margin:-.4rem 0 .8rem">Los recordatorios avisan dentro de la app mientras está abierta. Para avisos con el móvil bloqueado, descarga la cita en .ics y añádela a tu calendario.</p>
    ${selector('color', 'Color', e.color, [['', 'El del tipo'], ['#2f6bff', 'Azul'], ['#14b8a6', 'Turquesa'], ['#8b5cf6', 'Violeta'], ['#e11d48', 'Rojo'], ['#f59e0b', 'Ámbar'], ['#16a34a', 'Verde'], ['#64748b', 'Gris']])}
    <div class="barra-guardar"><a class="btn secundario" href="#${nuevo ? 'agenda' : 'evento/' + h(e.id)}">Cancelar</a><button class="btn primario" type="submit">Guardar cita</button></div>
  </form>`;
}

function evento(ctx, partes, query) {
  const [id, modo] = partes;
  if (id === 'nuevo') {
    const fecha = esISO(query.get('fecha')) ? query.get('fecha') : aISO();
    const inicio = query.get('hora') || (fecha === aISO() ? deMinutos(Math.ceil((new Date().getHours() * 60 + new Date().getMinutes() + 1) / 30) * 30) : '10:00');
    const base = { titulo: query.get('titulo') || '', tipo: TIPOS_EVENTO[query.get('tipo')] ? query.get('tipo') : 'reunion', fecha, inicio: inicio === '23:59' ? '' : inicio, fin: '', todoElDia: false, fechaFin: '', ubicacion: '', cliente: query.get('cliente') || '', inmueble: query.get('inmueble') || '', descripcion: '', enlaces: [], recordatorios: [30], estadoVisita: 'pendiente', color: '' };
    if (base.inmueble && !base.ubicacion) {
      const i = buscaId(ctx.estado, 'inmuebles', base.inmueble);
      if (i) base.ubicacion = [i.direccion, i.zona].filter(Boolean).join(', ');
    }
    if (!base.titulo && base.tipo === 'visita') {
      const c = buscaId(ctx.estado, 'clientes', base.cliente);
      const i = buscaId(ctx.estado, 'inmuebles', base.inmueble);
      base.titulo = ['Visita', c && `con ${nombreCliente(c)}`, i && `a ${i.titulo || i.referencia}`].filter(Boolean).join(' ');
    }
    return formularioEvento(ctx, base, true);
  }
  const e = buscaId(ctx.estado, 'eventos', id);
  if (!e || e.borrado) return `${cabecera('Cita no encontrada', '', 'agenda')}${vacio('🔍', 'Esta cita no existe o está en la papelera.')}`;
  if (modo === 'editar') return formularioEvento(ctx, e, false);
  const mapa = e.ubicacion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.ubicacion)}` : '';
  const visita = e.tipo === 'visita';
  return `${cabecera(e.titulo, `<a class="btn" href="#evento/${h(e.id)}/editar">✏️ Editar</a>`, `agenda/dia/${e.fecha}`)}
    <section class="tarjeta">
      <p><span class="punto" style="background:${h(colorEvento(e))}"></span> <strong>${h(TIPOS_EVENTO[e.tipo].nombre)}</strong>${etiquetaDemo(e)}${visita ? ` · <span class="chip ${e.estadoVisita === 'realizada' ? 'chip-ok' : e.estadoVisita === 'cancelada' ? 'chip-mal' : 'chip-info'}">${h(ESTADOS_VISITA[e.estadoVisita])}</span>` : ''}</p>
      <dl class="datos">
        <dt>Cuándo</dt><dd>${h(fechaLarga(e.fecha))}${e.fechaFin ? ' → ' + h(fechaLarga(e.fechaFin)) : ''}<br>${h(horaEvento(e))}</dd>
        ${e.ubicacion ? `<dt>Dónde</dt><dd>${h(e.ubicacion)}</dd>` : ''}
        ${e.recordatorios.length ? `<dt>Avisos</dt><dd>${e.recordatorios.map((m) => h(RECORDATORIOS[m])).join(', ')}</dd>` : ''}
      </dl>
      ${relaciones(ctx.estado, e)}
      ${e.descripcion ? `<p class="texto-ficha">${h(e.descripcion)}</p>` : ''}
      ${listaEnlaces(e.enlaces)}
      <div class="fila-botones">
        ${visita && e.estadoVisita === 'pendiente' ? `<button class="btn primario" data-accion="visita-estado" data-id="${h(e.id)}" data-estado="realizada">✔ Visita realizada</button><button class="btn" data-accion="visita-estado" data-id="${h(e.id)}" data-estado="cancelada">✖ Cancelada</button>` : ''}
        ${mapa ? `<a class="btn" href="${h(mapa)}" target="_blank" rel="noopener noreferrer">🗺 Abrir en el mapa</a>` : ''}
        <button class="btn" data-accion="evento-ics" data-id="${h(e.id)}">📲 Añadir a mi calendario (.ics)</button>
        <button class="btn" data-accion="evento-duplicar" data-id="${h(e.id)}">⧉ Duplicar</button>
        ${botonPapelera('eventos', e.id)}
      </div>
      <p class="detalle" style="color:var(--suave);font-size:.85rem;margin-top:.8rem">Google Calendar: pendiente de conectar. Esta cita solo existe en este aparato.</p>
    </section>`;
}

export const pantallas = { agenda, evento };

export const formularios = {
  evento(ctx, form, d) {
    const datos = {
      ...d,
      todoElDia: d.todoElDia?.includes?.('si') || d.todoElDia === 'si',
      enlaces: enlacesDeTexto(d.enlaces),
      recordatorios: [].concat(d.recordatorios || []).map(Number),
    };
    const invalidos = datos.enlaces.filter((x) => !/^https?:\/\//i.test(x.url));
    if (invalidos.length) return { errores: { enlaces: `Este enlace no es válido: ${invalidos[0].url}` } };
    if (!datos.fechaFin) datos.fechaFin = '';
    const r = ctx.guardaRegistro('eventos', datos);
    if (!r.ok) return { errores: r.errores };
    let extra = '';
    // Una visita apunta al cliente como interesado en ese inmueble.
    if (r.registro.tipo === 'visita' && r.registro.cliente && r.registro.inmueble) {
      const c = buscaId(ctx.estado, 'clientes', r.registro.cliente);
      if (c && !c.inmuebles.includes(r.registro.inmueble)) { c.inmuebles.push(r.registro.inmueble); ctx.guardar(); extra = ' El cliente queda como interesado en el inmueble.'; }
    }
    ctx.sucio = false;
    ctx.aviso((r.nuevo ? 'Cita creada.' : 'Cita guardada.') + extra);
    ctx.ir(`evento/${r.registro.id}`);
  },
};

export const acciones = {
  'agenda-fecha'(ctx, el) { if (esISO(el.value)) ctx.ir(`agenda/${el.dataset.vista}/${el.value}`); },
  'evento-tipo'(ctx, el) { el.form.querySelector('.estado-visita')?.classList.toggle('oculto', el.value !== 'visita'); },
  async papelera(ctx, el) {
    const nombres = { eventos: 'esta cita', tareas: 'esta tarea', clientes: 'este cliente', inmuebles: 'este inmueble', notas: 'esta nota', recursos: 'este recurso' };
    const ok = await ctx.aPapelera(el.dataset.coleccion, el.dataset.id, nombres[el.dataset.coleccion]);
    if (ok) ctx.ir({ eventos: 'agenda', tareas: 'tareas', clientes: 'clientes', inmuebles: 'inmuebles', notas: 'notas', recursos: 'biblioteca' }[el.dataset.coleccion]);
  },
  async 'visita-estado'(ctx, el) {
    const e = buscaId(ctx.estado, 'eventos', el.dataset.id);
    if (!e) return;
    const realizada = el.dataset.estado === 'realizada';
    const si = await ctx.confirma({
      titulo: realizada ? '¿Marcar la visita como realizada?' : '¿Marcar la visita como cancelada?',
      texto: realizada && e.cliente ? 'Se anotará en el historial del cliente que la visita se hizo (lo confirmas tú; la app no lo sabe por sí sola).' : '',
      boton: realizada ? 'Sí, se hizo' : 'Sí, cancelada',
    });
    if (!si) return;
    e.estadoVisita = el.dataset.estado;
    e.actualizado = new Date().toISOString();
    const c = buscaId(ctx.estado, 'clientes', e.cliente);
    if (realizada && c) {
      const i = buscaId(ctx.estado, 'inmuebles', e.inmueble);
      c.historial.unshift({ id: 'h_' + Date.now().toString(36), fecha: e.fecha, hora: e.inicio, tipo: 'visita', texto: `Visita realizada${i ? ' a ' + nombreInmueble(i) : ''}.` });
      if (['nuevo', 'contactado', 'seguimiento'].includes(c.estado)) c.estado = 'visita';
    }
    ctx.guardar();
    ctx.aviso(realizada ? 'Visita marcada como realizada.' : 'Visita cancelada.');
    ctx.repinta();
  },
  'evento-ics'(ctx, el) {
    const e = buscaId(ctx.estado, 'eventos', el.dataset.id);
    if (!e) return;
    descarga(icsEventos({ eventos: [e] }), `${nombreArchivo(e.titulo)}.ics`, 'text/calendar');
    ctx.aviso('Archivo .ics descargado: ábrelo para añadir la cita a tu calendario.');
  },
  'evento-duplicar'(ctx, el) {
    const e = buscaId(ctx.estado, 'eventos', el.dataset.id);
    if (!e) return;
    const q = new URLSearchParams({ fecha: e.fecha, hora: e.inicio, tipo: e.tipo, titulo: e.titulo, cliente: e.cliente, inmueble: e.inmueble });
    ctx.ir(`evento/nuevo?${q}`);
  },
};

// «Todo el día» oculta las horas (el cambio llega como 'change' de una casilla sin data-cambio).
document.addEventListener('change', (ev) => {
  if (ev.target.name === 'todoElDia' && ev.target.form?.dataset.form === 'evento') {
    ev.target.form.querySelector('.horas')?.classList.toggle('oculto', ev.target.checked);
  }
});
