/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — clientes y contactos (CRM ligero)
   Lista con búsqueda y filtros, tablero por estados, ficha con
   historial de interacciones, aviso de posibles duplicados y accesos a
   llamar, escribir un correo o abrir WhatsApp.
   Abrir WhatsApp o el correo NO es enviar: la app no registra nada que
   no haya pasado. Las interacciones las apunta Pau a mano.
   ═══════════════════════════════════════════════════════════════════ */

import {
  activos, buscaId, duplicadosCliente, encajeInmueble, ESTADOS_CLIENTE, NOMBRE_ESTADO_CLIENTE, nombreCliente, nombreInmueble,
  ordenEvento, TIPOS_CLIENTE, TIPOS_INTERACCION,
} from './datos.js';
import { botonPapelera, fechaTexto, itemCliente, itemEvento, itemInmueble, itemTarea } from './comun.js';
import { cabecera, campo, chips, confirma, etiquetaDemo, h, selector, vacio } from './ui.js';
import { aISO, euros, fechaCorta, horaDe, normaliza, numeroES, telefonoLimpio, telefonoWhatsapp } from './utiles.js';

const TIPOS = Object.fromEntries(TIPOS_CLIENTE.map((t) => [t, t[0].toUpperCase() + t.slice(1)]));

function filtraClientes(ctx) {
  const f = ctx.filtros.clientes || (ctx.filtros.clientes = { texto: '', estado: '', tipo: '', etiqueta: '', vista: 'lista' });
  const palabras = normaliza(f.texto).split(' ').filter(Boolean);
  const lista = activos(ctx.estado.clientes).filter((c) => {
    if (f.estado && c.estado !== f.estado) return false;
    if (!f.estado && f.vista === 'lista' && c.estado === 'archivado') return false;
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.etiqueta && !c.etiquetas.includes(f.etiqueta)) return false;
    const texto = normaliza(`${nombreCliente(c)} ${c.telefono} ${c.email} ${c.zonas} ${c.etiquetas.join(' ')}`);
    return palabras.every((p) => texto.includes(p));
  }).sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b), 'es'));
  return { f, lista };
}

function clientes(ctx) {
  const { f, lista } = filtraClientes(ctx);
  const etiquetas = [...new Set(activos(ctx.estado.clientes).flatMap((c) => c.etiquetas))].sort();
  const filtros = `<div class="filtros">
    <div class="ancho"><label class="sr" for="f-cli">Buscar clientes</label><input id="f-cli" class="entrada" type="search" placeholder="Buscar por nombre, teléfono, zona…" value="${h(f.texto)}" data-teclear="cliente-filtro" data-campo-filtro="texto" /></div>
    <div><label class="sr" for="f-est">Estado</label><select id="f-est" class="entrada" data-cambio="cliente-filtro" data-campo-filtro="estado"><option value="">Todos los estados</option>${ESTADOS_CLIENTE.map((e) => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${NOMBRE_ESTADO_CLIENTE[e]}</option>`).join('')}</select></div>
    <div><label class="sr" for="f-tip">Tipo</label><select id="f-tip" class="entrada" data-cambio="cliente-filtro" data-campo-filtro="tipo"><option value="">Todos los tipos</option>${TIPOS_CLIENTE.map((t) => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${TIPOS[t]}</option>`).join('')}</select></div>
    ${etiquetas.length ? `<div><label class="sr" for="f-etc">Etiqueta</label><select id="f-etc" class="entrada" data-cambio="cliente-filtro" data-campo-filtro="etiqueta"><option value="">Todas las etiquetas</option>${etiquetas.map((e) => `<option ${f.etiqueta === e ? 'selected' : ''}>${h(e)}</option>`).join('')}</select></div>` : ''}
  </div>
  <div class="pestanas-int"><button data-accion="cliente-vista" data-v="lista" aria-pressed="${f.vista === 'lista'}">☰ Lista</button><button data-accion="cliente-vista" data-v="tablero" aria-pressed="${f.vista === 'tablero'}">▦ Tablero por estados</button></div>`;
  const cab = cabecera('Clientes', '<a class="btn" href="#importar">⇪ Importar CSV</a><a class="btn primario" href="#cliente/nuevo">＋ Cliente</a>');
  if (!activos(ctx.estado.clientes).length) return `${cab}<section class="tarjeta">${vacio('👤', 'Aún no tienes clientes.', '<a class="btn primario" href="#cliente/nuevo">Crear el primero</a>')}</section>`;
  if (f.vista === 'tablero') {
    return `${cab}${filtros}<div class="tablero">${ESTADOS_CLIENTE.map((e) => {
      const col = lista.filter((c) => c.estado === e);
      return `<section aria-label="${NOMBRE_ESTADO_CLIENTE[e]}"><h2><span>${NOMBRE_ESTADO_CLIENTE[e]}</span><span class="chip">${col.length}</span></h2>
        ${col.map((c) => `<div class="tarjeta-mini"><a href="#cliente/${h(c.id)}">${h(nombreCliente(c))}</a>${etiquetaDemo(c)}<br><span class="detalle">${h(TIPOS[c.tipo])}${c.siguienteSeguimiento ? ' · seguir el ' + h(fechaCorta(c.siguienteSeguimiento)) : ''}</span>
          <label class="sr" for="mc-${h(c.id)}">Mover a ${h(nombreCliente(c))}</label><select id="mc-${h(c.id)}" data-cambio="cliente-estado" data-id="${h(c.id)}">${ESTADOS_CLIENTE.map((x) => `<option value="${x}" ${x === c.estado ? 'selected' : ''}>${x === c.estado ? NOMBRE_ESTADO_CLIENTE[x] : 'Mover a: ' + NOMBRE_ESTADO_CLIENTE[x]}</option>`).join('')}</select></div>`).join('') || '<p class="detalle" style="color:var(--suave)">Vacío</p>'}</section>`;
    }).join('')}</div>`;
  }
  return `${cab}${filtros}<section class="tarjeta" id="lista-clientes">${listaClientes(lista)}</section>`;
}
const listaClientes = (lista) => (lista.length ? `<p class="detalle" style="color:var(--suave);margin-top:0">${lista.length} cliente${lista.length === 1 ? '' : 's'}</p><ul class="lista">${lista.map((c) => itemCliente(c, c.zonas ? h(c.zonas) : '')).join('')}</ul>` : vacio('🔍', 'Ningún cliente coincide con la búsqueda.'));

function formularioCliente(ctx, c, nuevo) {
  return `${cabecera(nuevo ? 'Nuevo cliente' : 'Editar cliente', '', nuevo ? 'clientes' : `cliente/${c.id}`)}
  <form class="tarjeta ficha" data-form="cliente" data-vigilar novalidate>
    <input type="hidden" name="id" value="${h(nuevo ? '' : c.id)}" />
    <div class="dos-col">
      ${campo('nombre', 'Nombre', c.nombre, { required: true, maxlength: 80, autocomplete: 'off' })}
      ${campo('apellidos', 'Apellidos', c.apellidos, { maxlength: 120, autocomplete: 'off' })}
      ${campo('telefono', 'Teléfono', c.telefono, { tipo: 'tel', maxlength: 30, inputmode: 'tel', autocomplete: 'off' })}
      ${campo('email', 'Correo', c.email, { tipo: 'email', maxlength: 120, autocomplete: 'off' })}
      ${selector('tipo', 'Tipo', c.tipo, TIPOS)}
      ${selector('estado', 'Estado', c.estado, NOMBRE_ESTADO_CLIENTE)}
      ${campo('procedencia', 'Procedencia', c.procedencia, { maxlength: 80, placeholder: 'Idealista, web, recomendación…' })}
      ${campo('zonas', 'Zonas de interés', c.zonas, { maxlength: 200, placeholder: 'Oviedo centro, Gijón' })}
      ${campo('presupuestoMin', 'Presupuesto mínimo (€)', c.presupuestoMin ?? '', { tipo: 'text', inputmode: 'numeric', placeholder: '150.000' })}
      ${campo('presupuestoMax', 'Presupuesto máximo (€)', c.presupuestoMax ?? '', { tipo: 'text', inputmode: 'numeric', placeholder: '220.000' })}
    </div>
    ${campo('preferencias', 'Preferencias y necesidades', c.preferencias, { tipo: 'textarea', maxlength: 2000 })}
    <div class="dos-col">
      ${campo('proximaAccion', 'Próxima acción', c.proximaAccion, { maxlength: 200, placeholder: 'Llamar para proponer visita' })}
      ${campo('siguienteSeguimiento', 'Fecha del siguiente seguimiento', c.siguienteSeguimiento, { tipo: 'date' })}
    </div>
    ${campo('etiquetas', 'Etiquetas (separadas por comas)', c.etiquetas.join(', '), { maxlength: 300, placeholder: 'inversor, urgente' })}
    ${campo('notas', 'Notas', c.notas, { tipo: 'textarea', maxlength: 4000 })}
    <div class="barra-guardar"><a class="btn secundario" href="#${nuevo ? 'clientes' : 'cliente/' + h(c.id)}">Cancelar</a><button class="btn primario" type="submit">Guardar cliente</button></div>
  </form>`;
}

function cliente(ctx, partes) {
  const [id, modo] = partes;
  if (id === 'nuevo') return formularioCliente(ctx, { nombre: '', apellidos: '', telefono: '', email: '', tipo: 'comprador', estado: 'nuevo', procedencia: '', zonas: '', presupuestoMin: null, presupuestoMax: null, preferencias: '', proximaAccion: '', siguienteSeguimiento: '', etiquetas: [], notas: '' }, true);
  const c = buscaId(ctx.estado, 'clientes', id);
  if (!c || c.borrado) return `${cabecera('Cliente no encontrado', '', 'clientes')}${vacio('🔍', 'Este cliente no existe o está en la papelera.')}`;
  if (modo === 'editar') return formularioCliente(ctx, c, false);
  const hoy = aISO();
  const tel = telefonoLimpio(c.telefono);
  const wa = telefonoWhatsapp(c.telefono);
  const interesado = c.inmuebles.map((i) => buscaId(ctx.estado, 'inmuebles', i)).filter((i) => i && !i.borrado);
  const propios = activos(ctx.estado.inmuebles).filter((i) => i.propietario === c.id);
  const eventos = activos(ctx.estado.eventos).filter((e) => e.cliente === c.id).sort((a, b) => ordenEvento(b).localeCompare(ordenEvento(a)));
  const tareas = activos(ctx.estado.tareas).filter((t) => t.cliente === c.id);
  const notas = activos(ctx.estado.notas).filter((n) => n.cliente === c.id);
  const recursos = activos(ctx.estado.recursos).filter((r) => r.cliente === c.id);
  const dup = duplicadosCliente(ctx.estado, c);
  const sugeridos = ['comprador', 'inquilino'].includes(c.tipo) && (c.presupuestoMax != null || c.zonas)
    ? activos(ctx.estado.inmuebles).filter((i) => !c.inmuebles.includes(i.id) && ['disponible', 'captacion'].includes(i.estadoComercial)).map((i) => ({ i, e: encajeInmueble(c, i) })).filter((x) => x.e.encaja).sort((a, b) => b.e.puntos - a.e.puntos).slice(0, 5)
    : [];
  const presupuesto = [c.presupuestoMin != null && 'desde ' + euros(c.presupuestoMin), c.presupuestoMax != null && 'hasta ' + euros(c.presupuestoMax)].filter(Boolean).join(' ');
  const opcionesInmueble = activos(ctx.estado.inmuebles).filter((i) => !c.inmuebles.includes(i.id));
  return `${cabecera(nombreCliente(c), `<a class="btn" href="#cliente/${h(c.id)}/editar">✏️ Editar</a>`, 'clientes')}
  ${dup.length ? `<p class="nota-atencion"><strong>Posible duplicado:</strong> ${dup.map((d) => `<a href="#cliente/${h(d.cliente.id)}">${h(nombreCliente(d.cliente))}</a> (${h(d.motivos.join(', '))})`).join('; ')}.</p>` : ''}
  <section class="tarjeta">
    <p>${etiquetaDemo(c)} <span class="chip chip-info">${h(NOMBRE_ESTADO_CLIENTE[c.estado])}</span> <span class="chip">${h(TIPOS[c.tipo])}</span> ${chips(c.etiquetas)}</p>
    <div class="contacto">
      ${tel ? `<a class="btn" href="tel:${h(tel)}">📞 Llamar</a>` : ''}
      ${wa ? `<a class="btn" href="https://wa.me/${h(wa)}" target="_blank" rel="noopener noreferrer">💬 Abrir WhatsApp</a>` : ''}
      ${c.email ? `<a class="btn" href="mailto:${h(c.email)}">✉️ Redactar correo</a>` : ''}
    </div>
    ${tel || c.email ? '<p class="detalle" style="color:var(--suave);font-size:.82rem">Abrir la llamada, WhatsApp o el correo no registra nada: cuando hables con el cliente, apúntalo abajo en el historial.</p>' : ''}
    <dl class="datos">
      ${c.telefono ? `<dt>Teléfono</dt><dd>${h(c.telefono)}</dd>` : ''}
      ${c.email ? `<dt>Correo</dt><dd>${h(c.email)}</dd>` : ''}
      ${c.procedencia ? `<dt>Procedencia</dt><dd>${h(c.procedencia)}</dd>` : ''}
      ${presupuesto ? `<dt>Presupuesto</dt><dd>${h(presupuesto)}</dd>` : ''}
      ${c.zonas ? `<dt>Zonas</dt><dd>${h(c.zonas)}</dd>` : ''}
      <dt>Próxima acción</dt><dd>${h(c.proximaAccion || '—')}</dd>
      <dt>Seguimiento</dt><dd class="${c.siguienteSeguimiento && c.siguienteSeguimiento < hoy ? 'vencida' : ''}">${h(fechaTexto(c.siguienteSeguimiento))}</dd>
    </dl>
    ${c.preferencias ? `<p class="texto-ficha">${h(c.preferencias)}</p>` : ''}
    ${c.notas ? `<p class="texto-ficha">${h(c.notas)}</p>` : ''}
    <div class="fila-botones">
      <a class="btn primario" href="#evento/nuevo?cliente=${h(c.id)}&tipo=llamada">📅 Nueva cita</a>
      <a class="btn" href="#evento/nuevo?cliente=${h(c.id)}&tipo=visita">🏠 Programar visita</a>
      <a class="btn" href="#tarea/nuevo?cliente=${h(c.id)}">✅ Nueva tarea</a>
      <a class="btn" href="#nota/nuevo?cliente=${h(c.id)}">📝 Nota</a>
    </div>
  </section>

  <section class="tarjeta"><h2>🕑 Historial de interacciones</h2>
    <form data-form="interaccion" class="ficha" novalidate>
      <input type="hidden" name="cliente" value="${h(c.id)}" />
      <div class="dos-col">${selector('tipo', 'Qué ha pasado', 'llamada', TIPOS_INTERACCION)}${campo('fecha', 'Fecha', hoy, { tipo: 'date' })}</div>
      ${campo('texto', 'Resumen', '', { tipo: 'textarea', rows: 2, maxlength: 1000, placeholder: 'Le he llamado: quiere ver pisos con terraza.' })}
      <button class="btn" type="submit">Apuntar en el historial</button>
    </form>
    ${c.historial.length ? `<ul class="lista historial">${[...c.historial].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).map((x) => `<li><strong>${h(TIPOS_INTERACCION[x.tipo])}</strong> · ${h(fechaCorta(x.fecha))}${x.hora ? ' ' + h(x.hora) : ''}<br>${h(x.texto)} <button class="enlace-btn" data-accion="interaccion-borrar" data-id="${h(c.id)}" data-h="${h(x.id)}" aria-label="Borrar esta interacción">borrar</button></li>`).join('')}</ul>` : '<p class="detalle" style="color:var(--suave)">Sin interacciones apuntadas.</p>'}
  </section>

  <div class="rejilla rejilla-2">
  <section class="tarjeta"><h2>🏠 Inmuebles de interés</h2>
    ${interesado.length ? `<ul class="lista">${interesado.map((i) => itemInmueble(i, '', `<button class="enlace-btn" data-accion="cliente-quitar-inmueble" data-id="${h(c.id)}" data-i="${h(i.id)}" aria-label="Quitar ${h(nombreInmueble(i))} de sus intereses">quitar</button>`)).join('')}</ul>` : '<p class="detalle" style="color:var(--suave)">Ninguno vinculado.</p>'}
    ${opcionesInmueble.length ? `<form data-form="cliente-inmueble" class="fila-botones" style="align-items:end"><input type="hidden" name="cliente" value="${h(c.id)}" /><div class="campo" style="flex:1;margin:0"><label for="vi-${h(c.id)}">Vincular un inmueble</label><select id="vi-${h(c.id)}" name="inmueble">${opcionesInmueble.map((i) => `<option value="${h(i.id)}">${h(nombreInmueble(i))}</option>`).join('')}</select></div><button class="btn" type="submit">Vincular</button></form>` : ''}
    ${sugeridos.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Podrían encajarle <span class="sugerencia">SUGERENCIA</span></h3><ul class="lista">${sugeridos.map(({ i, e }) => itemInmueble(i, h(e.motivos.join(', ')))).join('')}</ul>` : ''}
    ${propios.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Es propietario de</h3><ul class="lista">${propios.map((i) => itemInmueble(i)).join('')}</ul>` : ''}
  </section>
  <section class="tarjeta"><h2>📅 Citas</h2>${eventos.length ? eventos.slice(0, 10).map((e) => itemEvento(ctx.estado, e, { conFecha: true })).join('') : '<p class="detalle" style="color:var(--suave)">Sin citas.</p>'}</section>
  <section class="tarjeta"><h2>✅ Tareas</h2>${tareas.length ? `<ul class="lista">${tareas.map((t) => itemTarea(ctx.estado, t, hoy)).join('')}</ul>` : '<p class="detalle" style="color:var(--suave)">Sin tareas.</p>'}</section>
  <section class="tarjeta"><h2>📝 Notas y documentos</h2>
    ${notas.length ? `<ul class="lista">${notas.map((n) => `<li><a class="elemento" href="#nota/${h(n.id)}">${h(n.titulo || n.texto.slice(0, 60) || 'Nota')}</a></li>`).join('')}</ul>` : ''}
    ${recursos.length ? `<ul class="lista">${recursos.map((r) => `<li><a class="elemento" href="#recurso/${h(r.id)}">🔗 ${h(r.titulo || r.url)}</a></li>`).join('')}</ul>` : ''}
    ${!notas.length && !recursos.length ? '<p class="detalle" style="color:var(--suave)">Nada relacionado.</p>' : ''}
    <a class="btn pequeno" href="#recurso/nuevo?cliente=${h(c.id)}">＋ Enlace o documento</a></section>
  </div>
  <div class="fila-botones">${botonPapelera('clientes', c.id)}</div>`;
}

export const pantallas = { clientes, cliente };

export const formularios = {
  async cliente(ctx, form, d) {
    const datos = { ...d, etiquetas: d.etiquetas };
    for (const k of ['presupuestoMin', 'presupuestoMax']) {
      if (String(d[k] || '').trim() && numeroES(d[k]) === null) return { errores: { [k]: 'Escribe solo la cifra, por ejemplo 180.000' } };
      if (!String(d[k] || '').trim()) datos[k] = null;
    }
    const previo = d.id ? buscaId(ctx.estado, 'clientes', d.id) : null;
    // Aviso de duplicados solo al crear (al editar se ve en la ficha).
    if (!previo) {
      const prueba = { ...datos, id: '' };
      const dup = duplicadosCliente(ctx.estado, prueba);
      if (dup.length) {
        const seguir = await confirma({
          titulo: 'Puede que ya tengas este cliente',
          detalle: `<ul>${dup.map((x) => `<li>${h(nombreCliente(x.cliente))} — ${h(x.motivos.join(', '))}</li>`).join('')}</ul>`,
          boton: 'Crear de todas formas',
        });
        if (!seguir) return;
      }
    }
    const r = ctx.guardaRegistro('clientes', datos);
    if (!r.ok) return { errores: r.errores };
    ctx.sucio = false;
    ctx.aviso(r.nuevo ? 'Cliente creado.' : 'Cliente guardado.');
    ctx.ir(`cliente/${r.registro.id}`);
  },
  interaccion(ctx, form, d) {
    const c = buscaId(ctx.estado, 'clientes', d.cliente);
    if (!c) return;
    if (!d.texto.trim()) return { errores: { texto: 'Escribe qué ha pasado.' } };
    c.historial.unshift({ id: 'h_' + Date.now().toString(36), fecha: d.fecha || aISO(), hora: d.fecha === aISO() ? horaDe() : '', tipo: d.tipo, texto: d.texto.trim().slice(0, 1000) });
    if (c.estado === 'nuevo') c.estado = 'contactado';
    // Si el seguimiento previsto ya ha pasado, queda cumplido con esta interacción.
    if (c.siguienteSeguimiento && c.siguienteSeguimiento <= (d.fecha || aISO())) c.siguienteSeguimiento = '';
    c.actualizado = new Date().toISOString();
    ctx.guardar();
    ctx.aviso('Apuntado en el historial.');
    ctx.repinta();
  },
  'cliente-inmueble'(ctx, form, d) {
    const c = buscaId(ctx.estado, 'clientes', d.cliente);
    if (!c || !d.inmueble || c.inmuebles.includes(d.inmueble)) return;
    c.inmuebles.push(d.inmueble);
    ctx.guardar();
    ctx.aviso('Inmueble vinculado.');
    ctx.repinta();
  },
};

let temporizador;
export const acciones = {
  'cliente-filtro'(ctx, el) {
    const f = ctx.filtros.clientes;
    f[el.dataset.campoFiltro] = el.value;
    if (el.dataset.campoFiltro !== 'texto') { ctx.repinta(); return; }
    // Al escribir solo se repinta la lista (el cuadro de búsqueda no pierde el foco).
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const caja = document.getElementById('lista-clientes');
      if (caja) caja.innerHTML = listaClientes(filtraClientes(ctx).lista);
    }, 120);
  },
  'cliente-vista'(ctx, el) { filtraClientes(ctx); ctx.filtros.clientes.vista = el.dataset.v; ctx.repinta(); },
  'cliente-estado'(ctx, el) {
    const c = buscaId(ctx.estado, 'clientes', el.dataset.id);
    if (!c) return;
    c.estado = el.value;
    c.actualizado = new Date().toISOString();
    ctx.guardar();
    ctx.aviso(`${nombreCliente(c)} → ${NOMBRE_ESTADO_CLIENTE[c.estado]}`);
    ctx.repinta();
  },
  async 'interaccion-borrar'(ctx, el) {
    const c = buscaId(ctx.estado, 'clientes', el.dataset.id);
    if (!c) return;
    if (!(await confirma({ titulo: '¿Borrar esta interacción del historial?', texto: 'No se puede deshacer.', boton: 'Borrar', peligro: true }))) return;
    c.historial = c.historial.filter((x) => x.id !== el.dataset.h);
    ctx.guardar();
    ctx.repinta();
  },
  async 'cliente-quitar-inmueble'(ctx, el) {
    const c = buscaId(ctx.estado, 'clientes', el.dataset.id);
    if (!c) return;
    if (!(await confirma({ titulo: '¿Quitar este inmueble de sus intereses?', texto: 'El inmueble no se borra; solo deja de estar vinculado.', boton: 'Quitar' }))) return;
    c.inmuebles = c.inmuebles.filter((i) => i !== el.dataset.i);
    ctx.guardar();
    ctx.repinta();
  },
};
