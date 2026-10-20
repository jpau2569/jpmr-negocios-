/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — notas
   Texto con formato sencillo que se escribe con el teclado del móvil:
   «- » lista, «- [ ] » casilla, «**negrita**», «# título» y enlaces
   que se detectan solos. Guardado automático mientras se escribe.
   Fijar, etiquetas, cliente e inmueble. «Convertir casillas en tareas»
   enseña antes qué tareas va a crear.
   Adjuntos de archivo: fase 2 (almacén privado); hoy, enlaces.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, LIMPIA, nombreCliente } from './datos.js';
import { botonPapelera, relaciones, selectorCliente, selectorInmueble } from './comun.js';
import { abreDialogo, cabecera, campo, chips, etiquetaDemo, h, vacio } from './ui.js';
import { fechaCorta, normaliza, nuevoId } from './utiles.js';

/** Formato sencillo → HTML seguro (se escapa primero, luego se aplican las marcas). */
export function notaAHtml(texto, { casillasActivas = false } = {}) {
  const lineas = String(texto || '').split('\n');
  let html = '';
  let enLista = false;
  const inline = (t) => h(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  lineas.forEach((l, n) => {
    const casillaM = l.match(/^\s*[-*]\s*\[( |x|X)\]\s?(.*)$/);
    const listaM = !casillaM && l.match(/^\s*[-*•]\s+(.*)$/);
    if ((casillaM || listaM) && !enLista) { html += '<ul>'; enLista = true; }
    if (!casillaM && !listaM && enLista) { html += '</ul>'; enLista = false; }
    if (casillaM) {
      const hecha = casillaM[1].toLowerCase() === 'x';
      html += `<li class="tarea-nota"><label class="casilla"><input type="checkbox" ${hecha ? 'checked' : ''} ${casillasActivas ? `data-cambio="nota-casilla" data-linea="${n}"` : 'disabled'} /> <span${hecha ? ' style="text-decoration:line-through;color:var(--suave)"' : ''}>${inline(casillaM[2])}</span></label></li>`;
    } else if (listaM) html += `<li>${inline(listaM[1])}</li>`;
    else if (/^#{1,3}\s/.test(l)) html += `<h3 style="margin:.6rem 0 .2rem">${inline(l.replace(/^#{1,3}\s/, ''))}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  });
  if (enLista) html += '</ul>';
  return html;
}

/** Casillas sin marcar de una nota (para convertirlas en tareas). */
export const casillasPendientes = (texto) => String(texto || '').split('\n').map((l) => l.match(/^\s*[-*]\s*\[ \]\s?(.+)$/)?.[1]?.trim()).filter(Boolean);

function notas(ctx) {
  const f = ctx.filtros.notas || (ctx.filtros.notas = { texto: '', etiqueta: '' });
  const todas = activos(ctx.estado.notas);
  const etiquetas = [...new Set(todas.flatMap((n) => n.etiquetas))].sort();
  const pal = normaliza(f.texto).split(' ').filter(Boolean);
  const lista = todas.filter((n) => (!f.etiqueta || n.etiquetas.includes(f.etiqueta)) && pal.every((p) => normaliza(`${n.titulo} ${n.texto} ${n.etiquetas.join(' ')}`).includes(p)))
    .sort((a, b) => Number(b.fijada) - Number(a.fijada) || b.actualizado.localeCompare(a.actualizado));
  const cab = cabecera('Notas', '<a class="btn primario" href="#nota/nuevo">＋ Nota</a>');
  if (!todas.length) return `${cab}<section class="tarjeta">${vacio('📝', 'Aún no tienes notas.', '<a class="btn primario" href="#nota/nuevo">Escribir la primera</a>')}</section>`;
  return `${cab}<div class="filtros">
      <div class="ancho"><label class="sr" for="fn-t">Buscar notas</label><input id="fn-t" type="search" class="entrada" placeholder="Buscar en las notas…" value="${h(f.texto)}" data-cambio="nota-filtro" data-campo-filtro="texto" /></div>
      ${etiquetas.length ? `<div><label class="sr" for="fn-e">Etiqueta</label><select id="fn-e" class="entrada" data-cambio="nota-filtro" data-campo-filtro="etiqueta"><option value="">Todas las etiquetas</option>${etiquetas.map((e) => `<option ${e === f.etiqueta ? 'selected' : ''}>${h(e)}</option>`).join('')}</select></div>` : ''}
    </div>
    ${lista.length ? `<div class="notas-rejilla">${lista.map((n) => `<a class="tarjeta" href="#nota/${h(n.id)}" style="text-decoration:none;color:inherit;display:block">
      <strong>${n.fijada ? '📌 ' : ''}${h(n.titulo || 'Nota sin título')}</strong>${etiquetaDemo(n)}
      <div class="nota-resumen">${h(n.texto.slice(0, 300))}</div>
      <span class="detalle" style="color:var(--suave);font-size:.82rem">${h(fechaCorta(n.actualizado.slice(0, 10)))} ${chips(n.etiquetas)}</span></a>`).join('')}</div>` : vacio('🔍', 'Ninguna nota coincide.')}`;
}

function nota(ctx, partes, query) {
  const [id] = partes;
  const n = id === 'nuevo'
    ? { id: '', titulo: '', texto: '', etiquetas: [], fijada: false, cliente: query.get('cliente') || '', inmueble: query.get('inmueble') || '', demo: false }
    : buscaId(ctx.estado, 'notas', id);
  if (!n || n.borrado) return `${cabecera('Nota no encontrada', '', 'notas')}${vacio('🔍', 'Esta nota no existe o está en la papelera.')}`;
  const modo = ctx.filtros.notaModo === 'ver' && n.id ? 'ver' : 'escribir';
  const pendientes = casillasPendientes(n.texto).length;
  return {
    html: `${cabecera(n.id ? 'Nota' : 'Nueva nota', `<span class="estado-guardado" id="estado-nota" aria-live="polite">${n.id ? 'Guardada' : 'Se guarda sola al escribir'}</span>`, 'notas')}
    <div class="pestanas-int"><button data-accion="nota-modo" data-m="escribir" aria-pressed="${modo === 'escribir'}">✏️ Escribir</button><button data-accion="nota-modo" data-m="ver" aria-pressed="${modo === 'ver'}" ${n.id ? '' : 'disabled'}>👁 Ver</button></div>
    <form class="tarjeta ficha nota-editor" data-nota="${h(n.id)}" onsubmit="return false">
      ${modo === 'ver' ? `<h2>${h(n.titulo || 'Nota sin título')}${etiquetaDemo(n)}</h2><div class="nota-vista">${notaAHtml(n.texto, { casillasActivas: true }) || '<p class="detalle">Vacía.</p>'}</div>` : `
      ${campo('titulo', 'Título', n.titulo, { maxlength: 140, placeholder: 'Título (opcional)' })}
      <div class="barra-formato" role="toolbar" aria-label="Formato">
        <button type="button" class="btn pequeno" data-accion="nota-formato" data-f="lista">• Lista</button>
        <button type="button" class="btn pequeno" data-accion="nota-formato" data-f="casilla">☐ Casilla</button>
        <button type="button" class="btn pequeno" data-accion="nota-formato" data-f="negrita"><strong>N</strong> Negrita</button>
        <button type="button" class="btn pequeno" data-accion="nota-formato" data-f="titulo"># Título</button>
      </div>
      ${campo('texto', 'Texto', n.texto, { tipo: 'textarea', maxlength: 20000, placeholder: 'Escribe… «- [ ] » crea una casilla.' })}`}
      <div class="dos-col">
        ${campo('etiquetas', 'Etiquetas (separadas por comas)', n.etiquetas.join(', '), { maxlength: 300 })}
        <label class="casilla" style="margin-top:1.6rem"><input type="checkbox" name="fijada" ${n.fijada ? 'checked' : ''} /> <span>📌 Fijar como importante</span></label>
        ${selectorCliente(ctx.estado, n.cliente)}${selectorInmueble(ctx.estado, n.inmueble)}
      </div>
      ${n.id ? relaciones(ctx.estado, n) : ''}
      <div class="fila-botones">
        ${pendientes ? `<button type="button" class="btn" data-accion="nota-a-tareas" data-id="${h(n.id)}">✅ Convertir ${pendientes} casilla${pendientes > 1 ? 's' : ''} en tareas</button>` : ''}
        ${n.id ? botonPapelera('notas', n.id) : ''}
      </div>
    </form>`,
    despues(vista) {
      const form = vista.querySelector('form[data-nota]');
      form.addEventListener('input', () => programaGuardado(ctx, form));
      form.addEventListener('change', (e) => { if (!e.target.closest('[data-cambio]')) programaGuardado(ctx, form, 0); });
    },
  };
}

/* ───────────── guardado automático ───────────── */

let temporizador = null;
let pendiente = null;
function programaGuardado(ctx, form, ms = 600) {
  const marca = document.getElementById('estado-nota');
  if (marca) marca.textContent = 'Guardando…';
  pendiente = () => guardaNota(ctx, form);
  clearTimeout(temporizador);
  temporizador = setTimeout(vuelca, ms);
}
function vuelca() {
  clearTimeout(temporizador);
  temporizador = null;
  const fn = pendiente;
  pendiente = null;
  fn?.();
}
// Antes de cambiar de pantalla o cerrar, se guarda lo que quede.
window.addEventListener('hashchange', vuelca);
window.addEventListener('pagehide', vuelca);

function guardaNota(ctx, form) {
  const val = (n) => form.querySelector(`[name="${n}"]`);
  const id = form.dataset.nota;
  const previo = id ? buscaId(ctx.estado, 'notas', id) : null;
  const datos = {
    ...(previo || {}),
    id: id || nuevoId('n'),
    titulo: val('titulo') ? val('titulo').value : previo?.titulo || '',
    texto: val('texto') ? val('texto').value : previo?.texto || '',
    etiquetas: val('etiquetas').value,
    fijada: val('fijada').checked,
    cliente: val('cliente').value,
    inmueble: val('inmueble').value,
  };
  if (!previo && !datos.titulo.trim() && !datos.texto.trim()) { setMarca('Se guarda sola al escribir'); return; }
  const r = ctx.guardaRegistro('notas', datos, { validar: false });
  if (!previo) {
    form.dataset.nota = r.registro.id;
    history.replaceState(null, '', `#nota/${r.registro.id}`);
    form.querySelector('[data-accion="nota-modo"][data-m="ver"]')?.removeAttribute('disabled');
    document.querySelector('[data-accion="nota-modo"][data-m="ver"]')?.removeAttribute('disabled');
  }
  setMarca(r.ok ? `Guardada ✓ ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'No se ha podido guardar');
}
const setMarca = (t) => { const m = document.getElementById('estado-nota'); if (m) m.textContent = t; };

export const pantallas = { notas, nota };

export const acciones = {
  'nota-filtro'(ctx, el) { ctx.filtros.notas[el.dataset.campoFiltro] = el.value; ctx.repinta(); },
  'nota-modo'(ctx, el) { vuelca(); ctx.filtros.notaModo = el.dataset.m; ctx.repinta(); },
  'nota-formato'(ctx, el) {
    const ta = el.form.querySelector('textarea[name="texto"]');
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const inicioLinea = value.lastIndexOf('\n', a - 1) + 1;
    let nuevo; let cursor;
    if (el.dataset.f === 'negrita') {
      const sel = value.slice(a, b) || 'texto';
      nuevo = value.slice(0, a) + `**${sel}**` + value.slice(b);
      cursor = a + sel.length + 4;
    } else {
      const prefijo = { lista: '- ', casilla: '- [ ] ', titulo: '# ' }[el.dataset.f];
      nuevo = value.slice(0, inicioLinea) + prefijo + value.slice(inicioLinea);
      cursor = b + prefijo.length;
    }
    ta.value = nuevo;
    ta.focus();
    ta.setSelectionRange(cursor, cursor);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  },
  'nota-casilla'(ctx, el) {
    const form = el.closest('form[data-nota]');
    const n = buscaId(ctx.estado, 'notas', form.dataset.nota);
    if (!n) return;
    const lineas = n.texto.split('\n');
    const i = Number(el.dataset.linea);
    lineas[i] = lineas[i].replace(/\[( |x|X)\]/, el.checked ? '[x]' : '[ ]');
    n.texto = lineas.join('\n');
    n.actualizado = new Date().toISOString();
    ctx.guardar();
    ctx.repinta();
  },
  'nota-a-tareas'(ctx, el) {
    vuelca();
    const n = buscaId(ctx.estado, 'notas', el.dataset.id || el.closest('form[data-nota]')?.dataset.nota);
    if (!n) return;
    const items = casillasPendientes(n.texto);
    const c = buscaId(ctx.estado, 'clientes', n.cliente);
    const d = abreDialogo(`<form method="dialog" class="confirmar">
      <h2>Crear tareas desde la nota</h2>
      <p>Se crearán estas tareas${c ? ` vinculadas a ${h(nombreCliente(c))}` : ''}. Desmarca las que no quieras:</p>
      ${items.map((t, i) => `<label class="casilla" style="display:flex"><input type="checkbox" name="t" value="${i}" checked /> <span>${h(t)}</span></label>`).join('')}
      ${campo('fecha', 'Fecha límite para todas (opcional)', '', { tipo: 'date' })}
      <div class="botones"><button value="no" class="btn secundario">Cancelar</button><button value="si" class="btn primario">Crear tareas</button></div></form>`, { etiqueta: 'Crear tareas desde la nota' });
    d.addEventListener('close', () => {
      if (d.returnValue !== 'si') return;
      const elegidas = [...d.querySelectorAll('input[name="t"]:checked')].map((x) => items[Number(x.value)]);
      const fecha = d.querySelector('input[name="fecha"]').value;
      for (const titulo of elegidas) ctx.estado.tareas.unshift(LIMPIA.tareas({ titulo, fecha, cliente: n.cliente, inmueble: n.inmueble, descripcion: `Desde la nota «${n.titulo || 'sin título'}».`, demo: false }));
      ctx.guardar();
      ctx.aviso(`${elegidas.length} tarea${elegidas.length === 1 ? '' : 's'} creada${elegidas.length === 1 ? '' : 's'}.`, { accion: { texto: 'Ver tareas', hacer: () => ctx.ir(fecha ? `tareas/todas` : 'tareas/sinfecha') } });
    });
  },
};
