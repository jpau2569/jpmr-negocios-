/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — estado, eventos y PWA
   ═══════════════════════════════════════════════════════════════════════ */

import { cargarCatalogo, buscar, porId, categorias, testigos } from './catalogo.js';
import { prepararFoto } from './camara.js';
import { analizarFoto, preguntar } from './vision.js';
import {
  leerHistorial, guardarEnHistorial, borrarEntrada, vaciarHistorial,
  leerVehiculo, guardarVehiculo,
} from './historial.js';
import {
  tarjetaTestigo, filaCatalogo, resumenAnalisis, bloqueNoIdentificados,
  filaHistorial, vacio, esc,
} from './interfaz.js';
import { svgTestigo } from './iconos.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const estado = {
  vista: 'inicio',
  categoria: 'todas',
  consulta: '',
  ultimo: null,        // último análisis mostrado
  chat: [],
};

/* ── Navegación entre vistas ────────────────────────────────────────── */
function ir(vista) {
  estado.vista = vista;
  $$('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${vista}`));
  $$('.barra button').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
  $$('.barra button').forEach((b) => b.setAttribute('aria-current', b.dataset.vista === vista ? 'page' : 'false'));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (vista === 'historial') pintarHistorial();
}

/* ── Análisis de la foto ────────────────────────────────────────────── */
async function analizar(archivo) {
  let foto;
  try {
    foto = await prepararFoto(archivo);
  } catch (e) {
    mostrarError(e.message);
    return;
  }

  ir('resultado');
  $('#resultado-contenido').innerHTML = `
    <div class="analizando">
      <div class="escaner"><img src="${esc(foto.dataURL)}" alt="Foto del cuadro de mandos"></div>
      <h2 style="font-size:1.15rem">Chivato está mirando tu cuadro<span class="puntos"></span></h2>
      <p style="color:var(--texto-suave)">Comparando con ${testigos().length} testigos del catálogo.</p>
    </div>`;

  try {
    const resultado = await analizarFoto(foto.base64, foto.mime, leerVehiculo());
    estado.ultimo = { ...resultado, miniatura: foto.miniatura };
    estado.chat = [];
    pintarResultado(estado.ultimo);
    guardarEnHistorial({
      miniatura: foto.miniatura,
      testigos: resultado.testigos.map((t) => ({ id: t.id, nombre: t.nombre, gravedad: t.gravedad })),
    });
  } catch (e) {
    $('#resultado-contenido').innerHTML = `
      <div class="error">${esc(e.message)}</div>
      <div class="tarjeta">
        <h3>Mientras tanto, búscalo tú</h3>
        <p style="color:var(--texto-suave);margin-bottom:12px">El catálogo de ${testigos().length} testigos funciona sin conexión:
          busca por el color y la forma del símbolo que ves.</p>
        <button class="boton-secundario" data-ir="catalogo" type="button">Abrir el catálogo de símbolos</button>
      </div>`;
  }
}

function pintarResultado(resultado) {
  const cuerpo = resultado.testigos.map((t) => tarjetaTestigo(t)).join('');
  $('#resultado-contenido').innerHTML = `
    ${resumenAnalisis(resultado)}
    ${cuerpo}
    ${bloqueNoIdentificados(resultado.no_identificados)}
    ${resultado.testigos.length ? bloqueChat() : ''}
    <button class="boton-secundario" data-ir="inicio" type="button">Analizar otra foto</button>
    <div class="aviso-legal" style="margin-top:16px">
      <span>⚠️</span>
      <span><strong>Chivato AI es orientativo</strong> y no sustituye el diagnóstico de un profesional.
      Ante un testigo rojo, detén el vehículo en un lugar seguro.</span>
    </div>`;
  pintarChat();
}

/* ── Chat de seguimiento ────────────────────────────────────────────── */
const SUGERENCIAS = [
  '¿Puedo llegar a casa así?',
  '¿Cuánto me puede costar?',
  '¿Es urgente o puede esperar?',
  '¿Qué le digo al mecánico?',
];

const bloqueChat = () => `
  <div class="tarjeta" id="bloque-chat">
    <h3>Pregúntale a Chivato</h3>
    <p style="color:var(--texto-suave);font-size:.9rem">Dudas sobre lo que acabas de ver, en lenguaje normal.</p>
    <div class="chat" id="chat"></div>
    <div class="sugerencias" id="sugerencias">
      ${SUGERENCIAS.map((s) => `<button type="button" data-pregunta="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <form class="escribir" id="form-chat">
      <input id="entrada-chat" placeholder="Escribe tu pregunta…" autocomplete="off" aria-label="Tu pregunta">
      <button type="submit" aria-label="Enviar">↑</button>
    </form>
  </div>`;

function pintarChat() {
  const caja = $('#chat');
  if (!caja) return;
  caja.innerHTML = estado.chat
    .map((m) => `<div class="burbuja ${m.mia ? 'mia' : 'suya'}">${esc(m.texto)}</div>`)
    .join('');
  const sug = $('#sugerencias');
  if (sug) sug.classList.toggle('oculto', estado.chat.length > 0);
}

async function enviarPregunta(texto) {
  const pregunta = String(texto || '').trim();
  if (!pregunta || !estado.ultimo) return;

  estado.chat.push({ mia: true, texto: pregunta });
  estado.chat.push({ mia: false, texto: 'Pensando…' });
  pintarChat();

  try {
    const ids = estado.ultimo.testigos.map((t) => t.id);
    const { respuesta } = await preguntar(pregunta, ids, leerVehiculo());
    estado.chat[estado.chat.length - 1] = { mia: false, texto: respuesta };
  } catch (e) {
    estado.chat[estado.chat.length - 1] = { mia: false, texto: e.message };
  }
  pintarChat();
}

/* ── Catálogo ───────────────────────────────────────────────────────── */
function pintarCatalogo() {
  const lista = buscar(estado.consulta, estado.categoria);
  $('#lista-catalogo').innerHTML = lista.length
    ? lista.map(filaCatalogo).join('')
    : vacio('🔍', 'Sin resultados', 'Prueba con el color ("rojo"), con la forma ("termómetro") o con el nombre del sistema ("frenos").');
  $('#cuenta-catalogo').textContent =
    `${lista.length} de ${testigos().length} testigos`;
}

function pintarFiltros() {
  const cats = categorias();
  const usadas = [...new Set(testigos().map((t) => t.categoria))];
  $('#filtros').innerHTML = [
    `<button type="button" data-categoria="todas" class="activo">Todos</button>`,
    ...usadas.map((c) => `<button type="button" data-categoria="${esc(c)}">${esc(cats[c] || c)}</button>`),
  ].join('');
}

function verFicha(id) {
  const t = porId(id);
  if (!t) return;
  $('#ficha-contenido').innerHTML = tarjetaTestigo(t) + `
    <button class="boton-secundario" data-ir="catalogo" type="button">Volver al catálogo</button>`;
  ir('ficha');
}

/* ── Historial ──────────────────────────────────────────────────────── */
function pintarHistorial() {
  const lista = leerHistorial();
  $('#lista-historial').innerHTML = lista.length
    ? lista.map(filaHistorial).join('')
    : vacio('🕓', 'Todavía no hay análisis', 'Aquí se guardan tus fotos analizadas, solo en este dispositivo.');
  $('#vaciar-historial').classList.toggle('oculto', !lista.length);
}

function verEntradaHistorial(id) {
  const entrada = leerHistorial().find((e) => e.id === id);
  if (!entrada) return;
  const fichas = (entrada.testigos || []).map((t) => porId(t.id)).filter(Boolean);
  $('#ficha-contenido').innerHTML = `
    <div class="tarjeta">
      <h3>Análisis del ${esc(new Date(entrada.fecha).toLocaleString('es-ES'))}</h3>
      <p style="color:var(--texto-suave);margin:0">${fichas.length
        ? `${fichas.length} testigo${fichas.length > 1 ? 's' : ''} identificado${fichas.length > 1 ? 's' : ''}.`
        : 'No se identificó ningún testigo.'}</p>
    </div>
    ${fichas.map((t) => tarjetaTestigo(t)).join('')}
    <button class="boton-secundario" data-ir="historial" type="button">Volver al historial</button>`;
  ir('ficha');
}

/* ── Errores ────────────────────────────────────────────────────────── */
function mostrarError(mensaje) {
  const caja = $('#error-inicio');
  caja.textContent = mensaje;
  caja.classList.remove('oculto');
  setTimeout(() => caja.classList.add('oculto'), 6000);
}

/* ── Compartir el resultado ─────────────────────────────────────────── */
async function compartir() {
  if (!estado.ultimo?.testigos?.length) return;
  const texto = ['Chivato AI — testigos detectados en mi cuadro de mandos:', '']
    .concat(estado.ultimo.testigos.map((t) =>
      `• ${t.nombre} (${t.gravedad}). ${t.que_hacer}`))
    .concat(['', 'Análisis orientativo generado con Chivato AI.'])
    .join('\n');
  try {
    if (navigator.share) await navigator.share({ title: 'Chivato AI', text: texto });
    else {
      await navigator.clipboard.writeText(texto);
      mostrarError('Resultado copiado al portapapeles.');
    }
  } catch { /* el usuario ha cancelado */ }
}

/* ── Arranque ───────────────────────────────────────────────────────── */
async function iniciar() {
  try {
    await cargarCatalogo();
  } catch {
    document.body.innerHTML = '<div class="contenedor"><div class="error" style="margin-top:40px">' +
      'No se ha podido cargar el catálogo de testigos. Recarga la página.</div></div>';
    return;
  }

  pintarFiltros();
  pintarCatalogo();
  pintarHistorial();

  // Datos del vehículo guardados
  const v = leerVehiculo();
  $('#coche-marca').value = v.marca || '';
  $('#coche-modelo').value = v.modelo || '';
  $('#coche-ano').value = v.ano || '';
  $('#coche-combustible').value = v.combustible || '';

  // Botones de foto
  $('#archivo-camara').addEventListener('change', (e) => {
    if (e.target.files?.[0]) analizar(e.target.files[0]);
    e.target.value = '';
  });
  $('#archivo-galeria').addEventListener('change', (e) => {
    if (e.target.files?.[0]) analizar(e.target.files[0]);
    e.target.value = '';
  });

  // Buscador y filtros
  $('#buscar').addEventListener('input', (e) => { estado.consulta = e.target.value; pintarCatalogo(); });
  $('#limpiar-busqueda').addEventListener('click', () => {
    estado.consulta = ''; $('#buscar').value = ''; pintarCatalogo(); $('#buscar').focus();
  });
  $('#filtros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-categoria]');
    if (!b) return;
    estado.categoria = b.dataset.categoria;
    $$('#filtros button').forEach((x) => x.classList.toggle('activo', x === b));
    pintarCatalogo();
  });

  // Vehículo
  $('#form-coche').addEventListener('submit', (e) => {
    e.preventDefault();
    guardarVehiculo({
      marca: $('#coche-marca').value.trim(),
      modelo: $('#coche-modelo').value.trim(),
      ano: $('#coche-ano').value.trim(),
      combustible: $('#coche-combustible').value,
    });
    $('#guardado-coche').classList.remove('oculto');
    setTimeout(() => $('#guardado-coche').classList.add('oculto'), 2500);
  });

  // Historial
  $('#vaciar-historial').addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de este dispositivo?')) { vaciarHistorial(); pintarHistorial(); }
  });

  // Delegación general de clics
  document.addEventListener('click', (e) => {
    const irA = e.target.closest('[data-ir]');
    if (irA) { ir(irA.dataset.ir); return; }

    const nav = e.target.closest('.barra button');
    if (nav) { ir(nav.dataset.vista); return; }

    const fila = e.target.closest('.fila[data-id]');
    if (fila) { verFicha(fila.dataset.id); return; }

    const ver = e.target.closest('[data-ver]');
    if (ver) { verEntradaHistorial(ver.dataset.ver); return; }

    const borrar = e.target.closest('[data-borrar]');
    if (borrar) { borrarEntrada(borrar.dataset.borrar); pintarHistorial(); return; }

    const sugerencia = e.target.closest('[data-pregunta]');
    if (sugerencia) { enviarPregunta(sugerencia.dataset.pregunta); return; }

    if (e.target.closest('#compartir')) compartir();
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-chat') return;
    e.preventDefault();
    const campo = $('#entrada-chat');
    enviarPregunta(campo.value);
    campo.value = '';
  });

  // Estado de la conexión
  const pintarConexion = () => {
    const chip = $('#estado-red');
    chip.textContent = navigator.onLine ? 'Listo' : 'Sin conexión';
    chip.classList.toggle('sin-red', !navigator.onLine);
  };
  window.addEventListener('online', pintarConexion);
  window.addEventListener('offline', pintarConexion);
  pintarConexion();

  // Símbolos de muestra en la portada
  $('#muestra-simbolos').innerHTML = ['freno-circulo', 'motor', 'aceitera', 'bateria', 'tpms', 'termometro']
    .map((icono) => `<span class="simbolo ${icono === 'motor' || icono === 'tpms' ? 'ambar' : 'rojo'}"
      style="width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#05090f;border:1px solid var(--borde)">
      ${svgTestigo({ icono }, 24)}</span>`).join('');

  // Contenido inicial de la pestaña Resultado
  $('#resultado-contenido').innerHTML = vacio('📷',
    'Aún no has analizado ninguna foto',
    'Ve a la pestaña Foto y saca una imagen del cuadro de mandos con el contacto puesto.') +
    '<button class="boton-secundario" data-ir="inicio" type="button">Hacer una foto</button>';

  // Accesos directos del manifiesto: ?vista=catalogo, ?vista=historial
  const pedida = new URLSearchParams(location.search).get('vista');
  if (['inicio', 'catalogo', 'historial'].includes(pedida)) ir(pedida);

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => { /* http:// sin https: no pasa nada */ });
  }
}

let instalacion = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  instalacion = e;
  document.getElementById('instalar')?.classList.remove('oculto');
});
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#instalar')) return;
  if (!instalacion) return;
  instalacion.prompt();
  await instalacion.userChoice;
  instalacion = null;
  document.getElementById('instalar')?.classList.add('oculto');
});

iniciar();
