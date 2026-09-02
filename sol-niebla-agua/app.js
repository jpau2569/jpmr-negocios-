/* ═══════════════════════════════════════════════════════════════════
   SOL NIEBLA Y AGUA — punto de entrada
   Aquí vive el estado de la app y la conexión entre capas. Nada más.

     utiles.js    → herramientas sin estado
     datos.js     → de dónde salen los números (proveedores y caché)
     indice.js    → el Índice Sol Niebla y Agua y sus lecturas
     interfaz.js  → render puro, sin estado global
     app.js       → estado, eventos, ajustes y PWA   ← este archivo

   ───────────────────────────────────────────────────────────────────
   ¿DÓNDE SE PONE LA CLAVE DE AEMET?
   No aquí. Va en el servidor, como variable de entorno `AEMET_API_KEY`
   (en Vercel: Settings → Environment Variables), y la lee `api/tiempo.js`.

   Motivo: una clave en el navegador la ve cualquiera que abra el código,
   y además AEMET no permite llamadas directas desde una web (no envía
   cabeceras CORS), así que ni funcionaría. `api/tiempo.js` hace de puente.

   Sin clave la app sigue funcionando: usa Open-Meteo y lo dice en el
   sello de la cabecera. Se elige el origen en Ajustes.
   ═══════════════════════════════════════════════════════════════════ */

import { $, $$ } from './utiles.js';
import { CONFIG, cargarDatos, guardaCache, leeCache, borraCache } from './datos.js';
import { MODOS, evaluar } from './indice.js';
import { pintar, pintarHeroError, enfocar, ciudadEnfocada } from './interfaz.js';

/* ── Orígenes que se ofrecen en Ajustes ───────────────────────────── */
const FUENTES = [
  { id:'auto',      nombre:'Automático',
    nota:'AEMET si está disponible, luego Open-Meteo y, sin red, simulados. Recomendado.' },
  { id:'api',       nombre:'AEMET + modelo',
    nota:'Observación real de la estación más cercana sobre la previsión horaria. Necesita el backend desplegado.' },
  { id:'openmeteo', nombre:'Open-Meteo directo',
    nota:'Del navegador a Open-Meteo, sin pasar por el backend.' },
  { id:'mock',      nombre:'Simulados',
    nota:'Escenarios plausibles de Asturias, sin red. Útil para probar los cuatro modos.' }
];

/* ── Estado ───────────────────────────────────────────────────────── */
const Estado = {
  modo: lee('sna.modo', 'paseo'),
  tema: lee('sna.tema', 'auto'),
  fuente: lee('sna.fuente', 'auto'),
  ciudadFoco: lee('sna.ciudad', 'oviedo'),
  datos: null, evaluacion: null, sal: 0, cargando: false
};

function lee(k, def){ try { return localStorage.getItem(k) ?? def; } catch { return def; } }
function guarda(k, v){ try { localStorage.setItem(k, v); } catch {} }

/* ── Avisos ───────────────────────────────────────────────────────── */
function brindis(txt){
  const el = $('#brindis');
  el.textContent = txt;
  el.setAttribute('data-visible', '');
  clearTimeout(brindis._t);
  brindis._t = setTimeout(() => el.removeAttribute('data-visible'), 2600);
}

/** Cinta fija mientras no hay red: la app sigue, pero con datos viejos. */
function avisoRed(){
  $('#aviso-red').hidden = navigator.onLine;
}

/* ── Aplicar preferencias ─────────────────────────────────────────── */
function aplicaTema(){
  document.documentElement.dataset.tema = Estado.tema;
  const oscuro = Estado.tema === 'oscuro'
    || (Estado.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach(m => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = oscuro ? '#0b0d10' : '#f4f3ef';
  document.head.appendChild(m);
  $$('#op-tema .opcion').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === Estado.tema)));
}

function aplicaModo(){
  const modos = Object.keys(MODOS);
  $$('.modo').forEach(b => b.setAttribute('aria-selected', String(b.dataset.modo === Estado.modo)));
  $('#modos-indicador').style.transform = `translateX(${modos.indexOf(Estado.modo) * 100}%)`;
  $('#modo-nota').textContent = MODOS[Estado.modo].nota;
}

function aplicaFuente(){
  CONFIG.proveedor = Estado.fuente;
  $$('#op-fuente .opcion').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fuente === Estado.fuente)));
  // La nota no repite lo que ya dice el botón elegido: resuelve la duda
  // que de verdad surge aquí, que es dónde vive la clave de AEMET.
  $('#nota-fuente').textContent = Estado.fuente === 'mock'
    ? 'Nada sale del móvil: los datos se generan aquí mismo.'
    : 'La clave de AEMET vive en el servidor (AEMET_API_KEY), nunca en el móvil.';
}

/* ── Hoja de ajustes ──────────────────────────────────────────────── */
function montarAjustes(){
  $('#op-fuente').innerHTML = FUENTES.map(f =>
    `<button type="button" class="opcion" role="radio" aria-checked="false" data-fuente="${f.id}">
      ${f.nombre}<small>${f.nota}</small></button>`).join('');
  $('#version-app').textContent = `Sol Niebla y Agua ${CONFIG.version}`;

  $('#op-tema').addEventListener('click', e => {
    const b = e.target.closest('.opcion'); if (!b) return;
    Estado.tema = b.dataset.tema; guarda('sna.tema', Estado.tema); aplicaTema();
  });
  $('#op-fuente').addEventListener('click', e => {
    const b = e.target.closest('.opcion'); if (!b || b.dataset.fuente === Estado.fuente) return;
    Estado.fuente = b.dataset.fuente; guarda('sna.fuente', Estado.fuente);
    aplicaFuente(); refrescar({ manual:true });
  });
  $('#btn-limpiar').addEventListener('click', async () => {
    borraCache();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    brindis('Caché vaciada');
    refrescar({ manual:true });
  });

  $('#btn-ajustes').addEventListener('click', () => hoja(true));
  $('#btn-cerrar-ajustes').addEventListener('click', () => hoja(false));
  $('#velo').addEventListener('click', () => hoja(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ajustes').hidden) hoja(false); });
}

function hoja(abrir){
  const h = $('#ajustes'), v = $('#velo');
  if (abrir){
    h.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { h.dataset.abierto = ''; v.dataset.abierto = ''; });
    h.querySelector('.opcion')?.focus();
  } else {
    delete h.dataset.abierto; delete v.dataset.abierto;
    setTimeout(() => { h.hidden = true; v.hidden = true; }, 340);
    $('#btn-ajustes').focus();
  }
}

/* ── Carga y repintado ────────────────────────────────────────────── */
const contexto = () => ({
  ciudadFoco: Estado.ciudadFoco,
  cargando: Estado.cargando,
  alRefrescar: () => refrescar({ manual:true }),
  alEnfocar: (id, desplaza) => {
    Estado.ciudadFoco = id;
    guarda('sna.ciudad', id);
    enfocar(id, desplaza);
  }
});

function repinta(){
  if (!Estado.datos) return;
  Estado.evaluacion = evaluar(Estado.datos, Estado.modo);
  pintar(Estado.evaluacion, contexto());
  Estado.ciudadFoco = ciudadEnfocada();
}

async function refrescar({ manual = false } = {}){
  if (Estado.cargando) return;
  Estado.cargando = true;
  $('#btn-refrescar')?.setAttribute('data-cargando', '');
  try {
    if (manual) Estado.sal++;
    Estado.datos = await cargarDatos(Estado.sal);
    guardaCache(Estado.datos);
    repinta();
    if (manual) brindis(Estado.datos.origen === 'mock' ? 'Datos simulados actualizados' : 'Datos actualizados');
  } catch (err){
    console.error('[SNA]', err);
    if (Estado.datos) brindis(navigator.onLine ? 'No se han podido actualizar los datos' : 'Sin conexión: datos guardados');
    else pintarHeroError(navigator.onLine
      ? 'No se han podido obtener los datos. Reintenta o cambia el origen a "Simulados" en Ajustes.'
      : 'Sin conexión y sin datos guardados. Conéctate o elige "Simulados" en Ajustes.');
  } finally {
    Estado.cargando = false;
    $('#btn-refrescar')?.removeAttribute('data-cargando');
  }
}

/* ── Arranque ─────────────────────────────────────────────────────── */
function arrancar(){
  // Accesos directos del manifiesto: app.html?modo=carretera
  const modoUrl = new URLSearchParams(location.search).get('modo');
  if (modoUrl && MODOS[modoUrl]){ Estado.modo = modoUrl; guarda('sna.modo', modoUrl); }

  montarAjustes();
  aplicaTema();
  aplicaModo();
  aplicaFuente();
  avisoRed();

  // Pintado inmediato desde caché mientras llegan los datos frescos
  const cache = leeCache();
  if (cache){ Estado.datos = cache; repinta(); }

  $('#modos').addEventListener('click', e => {
    const b = e.target.closest('.modo');
    if (!b || b.dataset.modo === Estado.modo) return;
    Estado.modo = b.dataset.modo;
    guarda('sna.modo', Estado.modo);
    aplicaModo();
    repinta();
  });

  $('#modos').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const modos = Object.keys(MODOS);
    const i = (modos.indexOf(Estado.modo) + (e.key === 'ArrowRight' ? 1 : -1) + modos.length) % modos.length;
    const b = $(`.modo[data-modo="${modos[i]}"]`);
    b.click(); b.focus();
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicaTema);

  // Estados de red: al volver la conexión, refresco solo si hace falta
  addEventListener('offline', () => { avisoRed(); brindis('Sin conexión'); });
  addEventListener('online', () => {
    avisoRed();
    if (Date.now() - (Estado.datos?.instante?.getTime() ?? 0) > 10 * 60e3) refrescar();
  });

  // Al volver a la app tras un rato, los datos se refrescan solos
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible'
      && Date.now() - (Estado.datos?.instante?.getTime() ?? 0) > 15 * 60e3) refrescar();
  });

  refrescar().finally(() => {
    setTimeout(() => {
      const s = $('#splash');
      s.dataset.fuera = '';
      setTimeout(() => s.remove(), 500);
    }, cache ? 250 : 560);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
else arrancar();

if ('serviceWorker' in navigator){
  addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('[SNA] SW:', e));
  });
}
