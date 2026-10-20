/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — piezas de interfaz
   Escapes, campos de formulario con su <label>, diálogos de
   confirmación accesibles (<dialog>: Esc cierra, el foco no se escapa)
   y avisos que lee el lector de pantalla (aria-live).
   Regla: todo texto que viene de Pau o de un cliente pasa por h().
   ═══════════════════════════════════════════════════════════════════ */

import { escapaHtml } from './utiles.js';

export const h = escapaHtml;

let cuentaCampos = 0;
const idCampo = (nombre) => `c-${nombre}-${++cuentaCampos}`;

/** Atributos extra: {required:true, min:0} → ' required min="0"' */
function atributos(extra = {}) {
  return Object.entries(extra).map(([k, v]) => (v === true ? ` ${k}` : v === false || v == null ? '' : ` ${k}="${h(v)}"`)).join('');
}

/** Campo de texto, número, fecha, hora, correo… con su etiqueta y su hueco de error. */
export function campo(nombre, etiqueta, valor = '', { tipo = 'text', ayuda = '', ...extra } = {}) {
  const id = idCampo(nombre);
  const v = valor == null ? '' : valor;
  const control = tipo === 'textarea'
    ? `<textarea id="${id}" name="${h(nombre)}"${atributos({ rows: 3, ...extra })}>${h(v)}</textarea>`
    : `<input id="${id}" name="${h(nombre)}" type="${tipo}" value="${h(v)}"${atributos(extra)} />`;
  return `<div class="campo" data-campo="${h(nombre)}"><label for="${id}">${h(etiqueta)}${extra.required ? ' <span class="obligatorio" aria-hidden="true">*</span>' : ''}</label>${control}${ayuda ? `<p class="ayuda">${h(ayuda)}</p>` : ''}<p class="error" role="alert" hidden></p></div>`;
}

/** Desplegable. opciones: {valor: 'texto'} o [['valor','texto']]. */
export function selector(nombre, etiqueta, valor, opciones, { vacio = '', ayuda = '', ...extra } = {}) {
  const id = idCampo(nombre);
  const lista = Array.isArray(opciones) ? opciones : Object.entries(opciones);
  const ops = (vacio ? `<option value="">${h(vacio)}</option>` : '') +
    lista.map(([v, t]) => `<option value="${h(v)}"${String(v) === String(valor ?? '') ? ' selected' : ''}>${h(t)}</option>`).join('');
  return `<div class="campo" data-campo="${h(nombre)}"><label for="${id}">${h(etiqueta)}</label><select id="${id}" name="${h(nombre)}"${atributos(extra)}>${ops}</select>${ayuda ? `<p class="ayuda">${h(ayuda)}</p>` : ''}<p class="error" role="alert" hidden></p></div>`;
}

export function casilla(nombre, etiqueta, marcada = false, valor = 'si') {
  return `<label class="casilla"><input type="checkbox" name="${h(nombre)}" value="${h(valor)}"${marcada ? ' checked' : ''} /> <span>${h(etiqueta)}</span></label>`;
}

/** Grupo de casillas con leyenda (fieldset). */
export function casillas(nombre, leyenda, opciones, marcadas = []) {
  const lista = Array.isArray(opciones) ? opciones.map((o) => (Array.isArray(o) ? o : [o, o])) : Object.entries(opciones);
  return `<fieldset class="campo casillas" data-campo="${h(nombre)}"><legend>${h(leyenda)}</legend>${lista.map(([v, t]) => casilla(nombre, t, marcadas.map(String).includes(String(v)), v)).join('')}</fieldset>`;
}

/** Lee un formulario: los campos repetidos (casillas) salen como lista. */
export function leeFormulario(form) {
  const datos = {};
  const fd = new FormData(form);
  for (const k of new Set(fd.keys())) {
    const todos = fd.getAll(k);
    const multiple = form.querySelectorAll(`[name="${CSS.escape(k)}"]`).length > 1 || form.querySelector(`[name="${CSS.escape(k)}"]`)?.type === 'checkbox';
    datos[k] = multiple ? todos.map(String) : String(todos[0]);
  }
  return datos;
}

/** Pinta los errores debajo de cada campo y lleva el foco al primero. */
export function muestraErrores(form, errores) {
  form.querySelectorAll('.error').forEach((p) => { p.hidden = true; p.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
  let primero = null;
  for (const [campoNombre, texto] of Object.entries(errores)) {
    const caja = form.querySelector(`[data-campo="${CSS.escape(campoNombre)}"]`);
    if (!caja) continue;
    const p = caja.querySelector('.error');
    p.textContent = texto;
    p.hidden = false;
    const control = caja.querySelector('input, select, textarea');
    control?.setAttribute('aria-invalid', 'true');
    primero ||= control;
  }
  primero?.focus();
  return !primero && !Object.keys(errores).length;
}

/* ───────────── avisos ───────────── */

let temporizador;
export function aviso(texto, { tipo = 'ok', ms = 3500, accion = null } = {}) {
  const el = document.getElementById('aviso');
  if (!el) return;
  el.className = `aviso aviso-${tipo}`;
  el.innerHTML = `<span>${h(texto)}</span>${accion ? `<button type="button" class="enlace-btn">${h(accion.texto)}</button>` : ''}`;
  if (accion) el.querySelector('button').onclick = () => { el.classList.add('oculto'); accion.hacer(); };
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.add('oculto'), accion ? Math.max(ms, 6000) : ms);
}

/* ───────────── diálogos ───────────── */

/** Abre un <dialog> modal con el HTML dado. Devuelve el elemento (se borra al cerrarse). */
export function abreDialogo(html, { clase = '', etiqueta = 'Ventana' } = {}) {
  const d = document.createElement('dialog');
  d.className = `dialogo ${clase}`;
  d.setAttribute('aria-label', etiqueta);
  d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
  // Pulsar fuera del cuadro lo cierra.
  d.addEventListener('click', (e) => { if (e.target === d) d.close('fuera'); });
  d.showModal();
  return d;
}

/** Confirmación: resuelve true/false. Con `escribir`, hay que teclear esa palabra. */
export function confirma({ titulo, texto = '', boton = 'Confirmar', peligro = false, escribir = '', detalle = '' }) {
  return new Promise((ok) => {
    const d = abreDialogo(`
      <form method="dialog" class="confirmar">
        <h2>${h(titulo)}</h2>
        ${texto ? `<p>${h(texto)}</p>` : ''}
        ${detalle}
        ${escribir ? campo('palabra', `Escribe ${escribir} para confirmar`, '', { autocomplete: 'off' }) : ''}
        <div class="botones">
          <button value="no" class="btn secundario">Cancelar</button>
          <button value="si" class="btn ${peligro ? 'peligro' : 'primario'}"${escribir ? ' disabled' : ''}>${h(boton)}</button>
        </div>
      </form>`, { etiqueta: titulo });
    if (escribir) {
      const input = d.querySelector('input');
      const btn = d.querySelector('button[value="si"]');
      input.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== escribir.toUpperCase(); });
      input.focus();
    } else d.querySelector(`button[value="${peligro ? 'no' : 'si'}"]`).focus();
    d.addEventListener('close', () => ok(d.returnValue === 'si'));
  });
}

/* ───────────── descargas ───────────── */

export function descarga(contenido, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copia(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch {
    const t = document.createElement('textarea');
    t.value = texto; document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* sin portapapeles */ }
    t.remove();
    return ok;
  }
}

/** Cabecera de pantalla con título y botones a la derecha. */
export const cabecera = (titulo, derecha = '', atras = '') =>
  `<div class="titulo-pantalla">${atras ? `<a class="atras" href="#${h(atras)}" aria-label="Volver">‹</a>` : ''}<h1>${h(titulo)}</h1><div class="acciones-titulo">${derecha}</div></div>`;

export const vacio = (icono, texto, boton = '') => `<div class="vacio"><div class="vacio-ico" aria-hidden="true">${icono}</div><p>${h(texto)}</p>${boton}</div>`;

export const etiquetaDemo = (r) => (r?.demo ? ' <span class="chip chip-demo" title="Dato ficticio de ejemplo">EJEMPLO</span>' : '');
export const chips = (lista) => lista.map((t) => `<span class="chip">#${h(t)}</span>`).join(' ');

/** Tema claro/oscuro; «auto» sigue al sistema. */
export function aplicaTema(tema) {
  if (tema === 'claro' || tema === 'oscuro') document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
}
