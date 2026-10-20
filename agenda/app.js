/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — la app (estado, rutas, eventos)
   Navegación por #ancla para que el botón «atrás» del móvil funcione:
   #hoy · #agenda/<vista>/<fecha> · #evento/<id|nuevo> · #tareas/<vista> ·
   #tarea/<id|nuevo> · #clientes · #cliente/<id|nuevo> · #inmuebles ·
   #inmueble/<id|nuevo> · #notas · #nota/<id|nuevo> · #biblioteca ·
   #recurso/<id|nuevo> · #asistente · #ajustes · #papelera · #importar
   Cada pantalla vive en su módulo p-*.js y exporta:
     pantallas  { ruta: (ctx, partes, query) => html | {html, despues} }
     acciones   { nombre: (ctx, elemento, evento) }   ← data-accion / data-cambio
     formularios{ nombre: (ctx, form, datos) }        ← <form data-form>
   ═══════════════════════════════════════════════════════════════════ */

import { BLOQUES_PANEL, carga, guarda, LIMPIA, purgaPapelera, valida } from './datos.js';
import { aplicaTema, aviso, confirma, h, leeFormulario, muestraErrores } from './ui.js';
import { aISO, nuevoId } from './utiles.js';
import { abreAnadir, abreBuscador } from './p-global.js';
import { arrancaRecordatorios } from './recordatorios.js';
import * as pHoy from './p-hoy.js';
import * as pAgenda from './p-agenda.js';
import * as pTareas from './p-tareas.js';
import * as pClientes from './p-clientes.js';
import * as pInmuebles from './p-inmuebles.js';
import * as pNotas from './p-notas.js';
import * as pBiblioteca from './p-biblioteca.js';
import * as pAsistente from './p-asistente.js';
import * as pAjustes from './p-ajustes.js';
import * as pGlobal from './p-global.js';

const MODULOS = [pHoy, pAgenda, pTareas, pClientes, pInmuebles, pNotas, pBiblioteca, pAsistente, pAjustes, pGlobal];
const PANTALLAS = Object.assign({}, ...MODULOS.map((m) => m.pantallas || {}));
const ACCIONES = Object.assign({}, ...MODULOS.map((m) => m.acciones || {}));
const FORMULARIOS = Object.assign({}, ...MODULOS.map((m) => m.formularios || {}));
// Qué sección del menú se marca para cada ruta.
const SECCION = { hoy: 'hoy', agenda: 'agenda', evento: 'agenda', tareas: 'tareas', tarea: 'tareas', clientes: 'clientes', cliente: 'clientes', inmuebles: 'inmuebles', inmueble: 'inmuebles', notas: 'notas', nota: 'notas', biblioteca: 'biblioteca', recurso: 'biblioteca', asistente: 'asistente', ajustes: 'ajustes', papelera: 'ajustes', importar: 'ajustes' };

const leido = carga();
let estado = leido.estado;
const vista = document.getElementById('vista');

/* ───────────── contexto que reciben las pantallas ───────────── */

const ctx = {
  get estado() { return estado; },
  set estado(e) { estado = e; },
  filtros: {},
  sucio: false,
  hoy: () => aISO(),
  aviso,
  confirma,
  ir,
  repinta: () => pinta(),
  guardar,
  /** Valida, limpia y guarda (nuevo o existente). Devuelve {ok, errores, registro}. */
  guardaRegistro(coleccion, datos, { validar = true } = {}) {
    const previo = datos.id ? estado[coleccion].find((r) => r.id === datos.id) : null;
    const registro = LIMPIA[coleccion]({ ...(previo || {}), ...datos, id: previo?.id || datos.id || nuevoId(coleccion[0]), actualizado: new Date().toISOString(), creado: previo?.creado || '' });
    const errores = validar ? valida(coleccion, registro) : {};
    if (Object.keys(errores).length) return { ok: false, errores, registro };
    if (previo) estado[coleccion][estado[coleccion].indexOf(previo)] = registro;
    else estado[coleccion].unshift(registro);
    return { ok: guardar(), errores: {}, registro, nuevo: !previo };
  },
  /** Manda a la papelera con confirmación. Devuelve true si se ha borrado. */
  async aPapelera(coleccion, id, nombre = 'este elemento') {
    const r = estado[coleccion].find((x) => x.id === id);
    if (!r) return false;
    const si = await confirma({ titulo: `¿Mandar ${nombre} a la papelera?`, texto: 'Podrás recuperarlo desde Ajustes → Papelera durante 30 días.', boton: 'Mandar a la papelera', peligro: true });
    if (!si) return false;
    r.borrado = new Date().toISOString();
    guardar();
    aviso('Enviado a la papelera.', { accion: { texto: 'Deshacer', hacer: () => { r.borrado = ''; guardar(); pinta(); } } });
    return true;
  },
};

/* ───────────── guardado ───────────── */

function guardar() {
  const r = guarda(estado);
  if (!r.ok) {
    aviso(r.error === 'lleno'
      ? 'La memoria del navegador está llena: guarda una copia en Ajustes y vacía la papelera.'
      : 'No se ha podido guardar: ' + r.error, { tipo: 'mal', ms: 8000 });
  }
  return r.ok;
}

// Otra pestaña ha guardado: se recargan los datos (salvo que aquí haya algo a medias).
window.addEventListener('storage', (e) => {
  if (e.key !== 'olvido_pau_agenda_v1' || ctx.sucio) return;
  estado = carga().estado;
  pinta();
  aviso('Datos actualizados desde otra pestaña.');
});

/* ───────────── rutas ───────────── */

function partesRuta() {
  const [ruta, consulta = ''] = decodeURIComponent(location.hash.replace(/^#/, '')).split('?');
  const partes = ruta.split('/').filter(Boolean);
  return { nombre: partes[0] || 'hoy', partes: partes.slice(1), query: new URLSearchParams(consulta) };
}

let rutaActual = location.hash;
function ir(ancla) {
  if (location.hash === '#' + ancla) pinta();
  else location.hash = ancla;
}

function pinta({ foco = false } = {}) {
  const { nombre, partes, query } = partesRuta();
  if (nombre === 'anadir') { history.replaceState(null, '', '#hoy'); rutaActual = '#hoy'; pinta(); abreAnadir(ctx); return; }
  const pantalla = PANTALLAS[nombre] || PANTALLAS.hoy;
  let res;
  try {
    res = pantalla(ctx, partes, query);
  } catch (err) {
    console.error(err);
    res = `<div class="tarjeta"><h1>Algo ha fallado en esta pantalla</h1><p>Tus datos no se han tocado. Vuelve a <a href="#hoy">Mi día</a> o recarga la página.</p></div>`;
  }
  const { html, despues } = typeof res === 'string' ? { html: res } : res;
  const scroll = window.scrollY;
  vista.innerHTML = html;
  ctx.sucio = false;
  despues?.(vista);
  const seccion = SECCION[nombre] || 'hoy';
  document.querySelectorAll('[data-seccion]').forEach((a) => {
    if (a.dataset.seccion === seccion) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  cierraMenu();
  if (foco) { window.scrollTo(0, 0); vista.focus({ preventScroll: true }); } else window.scrollTo(0, scroll);
}

window.addEventListener('hashchange', async () => {
  if (ctx.sucio) {
    const destino = location.hash;
    history.replaceState(null, '', rutaActual || '#hoy');
    const salir = await confirma({ titulo: 'Tienes cambios sin guardar', texto: 'Si sales ahora, se perderán.', boton: 'Salir sin guardar', peligro: true });
    if (!salir) return;
    ctx.sucio = false;
    history.pushState(null, '', destino);
  }
  rutaActual = location.hash;
  // Un buscador o diálogo abierto no debe tapar la pantalla nueva.
  document.querySelectorAll('dialog[open]').forEach((d) => d.close('navegar'));
  pinta({ foco: true });
});
window.addEventListener('beforeunload', (e) => { if (ctx.sucio) { e.preventDefault(); e.returnValue = ''; } });

/* ───────────── eventos (delegados) ───────────── */

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const nombre = el.dataset.accion;
  if (nombre === 'menu') { alternaMenu(); return; }
  if (nombre === 'buscar') { abreBuscador(ctx); return; }
  if (nombre === 'anadir') { abreAnadir(ctx); return; }
  const fn = ACCIONES[nombre];
  if (!fn) return;
  e.preventDefault();
  await fn(ctx, el, e);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-cambio]');
  if (el && ACCIONES[el.dataset.cambio]) ACCIONES[el.dataset.cambio](ctx, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-teclear]');
  if (el && ACCIONES[el.dataset.teclear]) ACCIONES[el.dataset.teclear](ctx, el, e);
  if (e.target.closest('form[data-vigilar]')) ctx.sucio = true;
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = FORMULARIOS[form.dataset.form];
  if (!fn) return;
  const r = await fn(ctx, form, leeFormulario(form));
  if (r && r.errores) muestraErrores(form, r.errores);
});

// Ctrl+K o «/» abren el buscador; Esc cierra el menú.
document.addEventListener('keydown', (e) => {
  const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !escribiendo)) {
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    abreBuscador(ctx);
  }
  if (e.key === 'Escape') cierraMenu();
});

/* ───────────── menú lateral (móvil) ───────────── */

const lateral = document.getElementById('lateral');
let velo = null;
function alternaMenu() { lateral.classList.contains('abierto') ? cierraMenu() : abreMenu(); }
function abreMenu() {
  lateral.classList.add('abierto');
  document.querySelector('[data-accion="menu"]').setAttribute('aria-expanded', 'true');
  velo = document.createElement('div');
  velo.className = 'velo';
  velo.onclick = cierraMenu;
  document.body.appendChild(velo);
  lateral.querySelector('a')?.focus();
}
function cierraMenu() {
  lateral.classList.remove('abierto');
  document.querySelector('[data-accion="menu"]')?.setAttribute('aria-expanded', 'false');
  velo?.remove();
  velo = null;
}

/* ───────────── conexión, tema y arranque ───────────── */

function pintaRed() { document.getElementById('estado-red').classList.toggle('oculto', navigator.onLine); }
window.addEventListener('online', () => { pintaRed(); aviso('Vuelve a haber conexión.'); });
window.addEventListener('offline', () => { pintaRed(); aviso('Sin conexión: la agenda sigue funcionando con los datos de este aparato.', { ms: 6000 }); });
pintaRed();

aplicaTema(estado.ajustes.tema);

if (leido.error) aviso(leido.error, { tipo: 'mal', ms: 10000 });
if (purgaPapelera(estado)) guardar();
if (!estado.ajustes.bloques.length) estado.ajustes.bloques = Object.keys(BLOQUES_PANEL).map((id) => ({ id, visible: true }));

pinta({ foco: false });
arrancaRecordatorios(ctx);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('service-worker.js').catch(() => { /* sin modo sin conexión, la app funciona igual */ });
}
// Los navegadores pueden borrar el almacenamiento si falta espacio; se pide que no lo hagan.
navigator.storage?.persist?.().catch(() => {});

// Para las pruebas automáticas y para depurar desde la consola (no expone nada fuera del aparato).
window.__agenda = { ctx, h, acciones: [...Object.keys(ACCIONES), 'menu', 'buscar', 'anadir'], formularios: Object.keys(FORMULARIOS) };
