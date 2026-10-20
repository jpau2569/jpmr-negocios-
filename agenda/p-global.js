/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — buscador global y botón «Añadir»
   · Buscador (Ctrl+K, «/» o la lupa): resultados agrupados y filtro por
     tipo; se navega con el teclado (Tab / Intro).
   · Añadir: captura rápida en lenguaje natural + accesos directos.
     La frase se convierte en una PROPUESTA editable con la fecha exacta
     escrita en palabras; si hay dudas de cliente o inmueble, hay que
     elegir antes de guardar.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, LIMPIA, nombreCliente, nombreInmueble, TIPOS_EVENTO, valida } from './datos.js';
import { buscaGlobal, GRUPOS } from './busqueda.js';
import { interpreta } from './captura.js';
import { abreDialogo, campo, h, muestraErrores, selector } from './ui.js';
import { fechaLarga, nuevoId } from './utiles.js';

/* ───────────── buscador ───────────── */

export function abreBuscador(ctx) {
  const filtro = new Set(Object.keys(GRUPOS));
  const d = abreDialogo(`<div>
    <h2>Buscar</h2>
    <label class="sr" for="buscar-global">Buscar en toda la agenda</label>
    <input id="buscar-global" class="entrada" type="search" placeholder="Clientes, inmuebles, citas, tareas, notas, enlaces…" autocomplete="off" />
    <div class="pestanas-int" style="margin:.6rem 0 0">${Object.entries(GRUPOS).map(([k, g]) => `<button type="button" data-g="${k}" aria-pressed="true">${g.icono} ${g.nombre}</button>`).join('')}</div>
    <div class="resultados" id="resultados-busqueda" aria-live="polite"><p class="detalle" style="color:var(--suave)">Escribe para buscar. Atajo: Ctrl+K o «/».</p></div>
    <div class="botones"><button type="button" class="btn secundario" data-cerrar>Cerrar</button></div></div>`, { clase: 'buscador', etiqueta: 'Buscar' });
  const input = d.querySelector('input');
  const caja = d.querySelector('#resultados-busqueda');
  const pinta = () => {
    const q = input.value;
    if (!q.trim()) { caja.innerHTML = '<p class="detalle" style="color:var(--suave)">Escribe para buscar. Atajo: Ctrl+K o «/».</p>'; return; }
    const grupos = buscaGlobal(ctx.estado, q, [...filtro]);
    caja.innerHTML = grupos.length ? grupos.map((g) => `<h3>${GRUPOS[g.coleccion].icono} ${GRUPOS[g.coleccion].nombre} (${g.total})</h3><ul class="lista">${g.resultados.map((r) => `<li><a class="elemento" href="#${GRUPOS[g.coleccion].ancla}/${h(r.id)}"><span class="cuerpo"><span class="titulo">${h(r.titulo)}</span>${r.demo ? ' <span class="chip chip-demo">EJEMPLO</span>' : ''}<br><span class="detalle">${h(r.detalle)}</span></span></a></li>`).join('')}</ul>`).join('')
      : `<p>No hay resultados para «${h(q)}».</p>`;
  };
  input.addEventListener('input', pinta);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); caja.querySelector('a')?.click(); } });
  d.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
    if (filtro.has(b.dataset.g) && filtro.size > 1) filtro.delete(b.dataset.g); else filtro.add(b.dataset.g);
    b.setAttribute('aria-pressed', filtro.has(b.dataset.g));
    pinta();
  }));
  caja.addEventListener('click', (e) => { if (e.target.closest('a')) d.close(); });
  d.querySelector('[data-cerrar]').onclick = () => d.close();
  input.focus();
}

/* ───────────── añadir y captura rápida ───────────── */

export function abreAnadir(ctx) {
  const d = abreDialogo(`<div>
    <h2>Añadir</h2>
    <form id="form-captura" novalidate>
      <label for="captura-texto"><strong>Escríbelo como lo dirías</strong></label>
      <div style="display:flex;gap:.5rem;margin-top:.3rem;flex-wrap:wrap">
        <input id="captura-texto" class="entrada" style="flex:1;min-width:200px" placeholder="Llamar a Marta mañana a las 10 por el piso de Oviedo" autocomplete="off" maxlength="300" />
        <button class="btn primario" type="submit">Organizar</button>
      </div>
      <p class="ayuda" style="color:var(--suave);font-size:.85rem;margin:.3rem 0 0">Te enseño la fecha y la hora que he entendido antes de guardar nada.</p>
    </form>
    <p class="seccion-form">O elige qué crear</p>
    <div class="acciones-rapidas">
      ${[['evento/nuevo', '📅 Cita'], ['evento/nuevo?tipo=visita', '🏠 Visita'], ['tarea/nuevo', '✅ Tarea'], ['cliente/nuevo', '👤 Cliente'], ['inmueble/nuevo', '🏘 Inmueble'], ['recurso/nuevo', '🔗 Enlace'], ['recurso/nuevo?tipo=video', '🎬 Vídeo'], ['nota/nuevo', '📝 Nota']].map(([a, t]) => `<a class="accion-rapida" href="#${a}">${t}</a>`).join('')}
    </div>
    <div class="botones"><button type="button" class="btn secundario" data-cerrar>Cerrar</button></div></div>`, { etiqueta: 'Añadir' });
  d.querySelector('[data-cerrar]').onclick = () => d.close();
  d.querySelectorAll('a.accion-rapida').forEach((a) => a.addEventListener('click', () => d.close()));
  d.querySelector('#form-captura').addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = d.querySelector('#captura-texto').value.trim();
    if (!texto) { d.querySelector('#captura-texto').focus(); return; }
    d.close();
    abrePropuesta(ctx, texto);
  });
  d.querySelector('#captura-texto').focus();
}

function frasePropuesta(p) {
  if (!p.fecha) return 'Sin fecha: elige una o se guardará como tarea sin fecha.';
  return `${fechaLarga(p.fecha)}${p.hora ? ` a las ${p.hora}` : ''}`;
}

export function abrePropuesta(ctx, texto) {
  const p = interpreta(texto, ctx.estado);
  const dudaCliente = p.clientes.length > 1 && p.clientes[0].puntos === p.clientes[1].puntos;
  const dudaInmueble = p.inmuebles.length > 1;
  const opsCliente = [
    ...(dudaCliente ? [['?', '— Elige uno —']] : []),
    ['', '— Ninguno —'],
    ...p.clientes.map((c) => [c.id, `★ ${c.nombre}`]),
    ...activos(ctx.estado.clientes).filter((c) => !p.clientes.some((x) => x.id === c.id)).map((c) => [c.id, nombreCliente(c)]),
  ];
  const opsInmueble = [
    ...(dudaInmueble ? [['?', '— Elige uno —']] : []),
    ['', '— Ninguno —'],
    ...p.inmuebles.map((i) => [i.id, `★ ${i.nombre}`]),
    ...activos(ctx.estado.inmuebles).filter((i) => !p.inmuebles.some((x) => x.id === i.id)).map((i) => [i.id, nombreInmueble(i)]),
  ];
  const tipos = Object.fromEntries(Object.entries(TIPOS_EVENTO).map(([k, v]) => [k, v.nombre]));
  const d = abreDialogo(`<form class="ficha" novalidate id="form-propuesta">
    <h2>Propuesta</h2>
    <p class="detalle" style="color:var(--suave);margin-top:0">Has escrito: «${h(texto)}»</p>
    <p class="nota-info" id="interpretado"><strong>He entendido:</strong> <span>${h(frasePropuesta(p))}</span></p>
    ${p.dudas.length ? `<div class="nota-atencion"><strong>Revisa:</strong><ul style="margin:.3rem 0 0;padding-left:1.1rem">${p.dudas.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>` : ''}
    <fieldset class="campo casillas"><legend>Guardar como</legend>
      <label class="casilla"><input type="radio" name="que" value="evento" ${p.tipo === 'evento' ? 'checked' : ''} /> <span>📅 Cita en la agenda</span></label>
      <label class="casilla"><input type="radio" name="que" value="tarea" ${p.tipo === 'tarea' ? 'checked' : ''} /> <span>✅ Tarea</span></label>
    </fieldset>
    ${campo('titulo', 'Título', p.titulo, { required: true, maxlength: 160 })}
    <div class="dos-col">
      ${campo('fecha', 'Fecha', p.fecha, { tipo: 'date' })}
      ${campo('hora', 'Hora', p.hora, { tipo: 'time', step: 300 })}
    </div>
    <div class="solo-evento ${p.tipo === 'evento' ? '' : 'oculto'}">${selector('tipo', 'Tipo de cita', p.tipoEvento || 'reunion', tipos)}</div>
    <div class="dos-col">
      ${selector('cliente', 'Cliente', dudaCliente ? '?' : p.clientes[0]?.id || '', opsCliente)}
      ${selector('inmueble', 'Inmueble', dudaInmueble ? '?' : p.inmuebles[0]?.id || '', opsInmueble)}
    </div>
    <div class="botones"><button type="button" class="btn secundario" data-cerrar>Cancelar</button><button type="submit" class="btn primario">Guardar</button></div>
  </form>`, { etiqueta: 'Propuesta de captura rápida' });
  const form = d.querySelector('form');
  const actualiza = () => {
    const que = form.querySelector('[name="que"]:checked').value;
    form.querySelector('.solo-evento').classList.toggle('oculto', que !== 'evento');
    const f = form.fecha.value; const hr = form.hora.value;
    form.querySelector('#interpretado span').textContent = frasePropuesta({ fecha: f, hora: hr });
  };
  form.addEventListener('change', actualiza);
  form.addEventListener('input', actualiza);
  d.querySelector('[data-cerrar]').onclick = () => d.close();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const que = form.querySelector('[name="que"]:checked').value;
    const datos = { titulo: form.titulo.value, fecha: form.fecha.value, cliente: form.cliente.value, inmueble: form.inmueble.value };
    const errores = {};
    if (datos.cliente === '?') errores.cliente = 'Elige el cliente (o «Ninguno»).';
    if (datos.inmueble === '?') errores.inmueble = 'Elige el inmueble (o «Ninguno»).';
    let col; let registro;
    if (que === 'evento') {
      col = 'eventos';
      if (!datos.fecha) errores.fecha = 'Una cita necesita fecha.';
      if (!form.hora.value) errores.hora = 'Pon la hora (o guárdalo como tarea).';
      registro = LIMPIA.eventos({ ...datos, id: nuevoId('e'), tipo: form.tipo.value, inicio: form.hora.value, recordatorios: [30] });
    } else {
      col = 'tareas';
      registro = LIMPIA.tareas({ ...datos, id: nuevoId('t'), hora: form.hora.value });
    }
    Object.assign(errores, valida(col, registro));
    if (errores.inicio) { errores.hora = errores.inicio; delete errores.inicio; }
    if (!muestraErrores(form, errores)) return;
    ctx.estado[col].unshift(registro);
    // Una visita apunta al cliente como interesado en ese inmueble (como en el formulario normal).
    if (col === 'eventos' && registro.tipo === 'visita' && registro.cliente && registro.inmueble) {
      const c = buscaId(ctx.estado, 'clientes', registro.cliente);
      if (c && !c.inmuebles.includes(registro.inmueble)) c.inmuebles.push(registro.inmueble);
    }
    ctx.guardar();
    d.close();
    ctx.aviso(`${col === 'eventos' ? 'Cita' : 'Tarea'} guardada${registro.fecha ? ' para el ' + fechaLarga(registro.fecha) : ''}.`);
    ctx.ir(`${col === 'eventos' ? 'evento' : 'tarea'}/${registro.id}`);
  });
  form.titulo.focus();
}

export const acciones = {
  captura: (ctx) => abreAnadir(ctx),
};
