/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — la app (estado, pantallas y eventos)
   La lógica pura está en ../nucleo/ (hoja, marca, PDF) y en vistas.js;
   aquí solo se pinta, se escucha y se habla con /api.
   Sin cobertura se puede firmar igual: la hoja va a la cola (cola.js) y
   se sube sola al volver la red.
   ═══════════════════════════════════════════════════════════════════ */

import { creaFirma } from '../cerebro/firma.js';
import { aISO, horaActual, fechaLarga, rellena } from '../cerebro/utiles.js';
import { CAMPOS_INMUEBLE, nombrePiso } from '../cerebro/campos-piso.js';
import { declaracionDe } from '../cerebro/visitas.js';
import { textoConformidad } from '../cerebro/documentos.js';
import { limpiaHoja, hashHoja, nuevoId, VERSION_HOJA, MAX_FIRMA_BYTES, bytesDeBase64, enMadrid, CAMPOS_CAPTACION } from '../nucleo/hoja.js';
import { pdfDeHoja, nombrePdf } from '../nucleo/pdf-hoja.js';
import { coloresInterfaz, contraste, textoSobre, CAMPOS_MARCA, GRUPOS_TEXTOS } from '../nucleo/marca.js';
import * as cola from './cola.js';
import * as V from './vistas.js';

const CLAVE_YO = 'hojas-firmadas:yo';
const vista = document.getElementById('vista');
const est = {
  yo: leeYoGuardado(),  // { agente, marca, textos, logo, avisos } (sin datos de clientes)
  sesion: null,         // true, false (hay que entrar) o null (sin conexión / no se sabe)
  apagada: '',
  firmas: {},
  ultima: null,         // la última hoja firmada { hoja, registro }
  actual: null,         // la hoja que se está viendo { hoja, registro }
  filtros: {},
  sucio: false,
  rutaActual: '',
  ignorarCambio: false,
};

function leeYoGuardado() {
  try { const y = JSON.parse(localStorage.getItem(CLAVE_YO) || 'null'); return y?.agente ? y : null; } catch { return null; }
}

/* ── Colores de la marca (variables CSS; la CSP no deja estilos en línea) ── */
function aplicaColores(c) {
  const r = document.documentElement.style;
  r.setProperty('--principal', c.principal);
  r.setProperty('--acento', c.acento);
  r.setProperty('--sobre-principal', c.sobrePrincipal);
  r.setProperty('--sobre-acento', c.sobreAcento);
  r.setProperty('--titulos', c.titulos);
}
const meta = document.querySelector('meta[name="marca-colores"]')?.content.split(',') || [];
if (meta.length === 5) aplicaColores({ principal: meta[0], acento: meta[1], sobrePrincipal: meta[2], sobreAcento: meta[3], titulos: meta[4] });

/* ── Avisos breves ───────────────────────────────────────────────────── */
let temporizadorAviso = 0;
function aviso(texto, ms = 4000) {
  const a = document.getElementById('aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { a.hidden = true; }, ms);
}

/* ── API ─────────────────────────────────────────────────────────────── */
async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo ? { 'content-type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && ruta !== '/api/entrar') est.sesion = false;
  return { ok: r.ok, estado: r.status, ...j };
}
const textoError = (r) => [r.error, ...(r.errores || [])].filter(Boolean).join(' ') || 'No se ha podido hacer.';

async function refrescaYo() {
  try {
    const r = await api('/api/yo');
    if (r.ok) {
      est.yo = { agente: r.agente, marca: r.marca, textos: r.textos, logo: r.logo, avisos: r.avisos || [] };
      est.sesion = true;
      est.apagada = '';
      localStorage.setItem(CLAVE_YO, JSON.stringify(est.yo));
      aplicaColores(coloresInterfaz(r.marca));
      logoCache = null;
    } else if (r.estado === 503 && r.apagada) {
      est.apagada = r.error;
    } else if (r.estado === 401) {
      est.sesion = false;
    }
  } catch {
    est.sesion = null; // sin conexión: se sigue con lo guardado
  }
}

/* ── Red y cola de pendientes ────────────────────────────────────────── */
function pintaRed() {
  document.getElementById('red').textContent = navigator.onLine ? '' : 'Sin conexión';
}

async function pintaPendientes() {
  const caja = document.getElementById('pendientes');
  let items = [];
  try { items = await cola.lista(); } catch { items = []; }
  if (!items.length) { caja.hidden = true; caja.textContent = ''; return items; }
  const n = items.length;
  const errores = items.filter((i) => i.estado === 'error').length;
  let detalle;
  if (!navigator.onLine) detalle = 'Sin conexión: se subirán solas al volver la cobertura.';
  else if (est.sesion === false) detalle = 'Tu sesión ha caducado: <a href="#entrar">entra</a> para subirlas.';
  else detalle = 'Se suben solas.';
  caja.innerHTML = `<span><strong>${n} hoja${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'} de subir</strong>${errores ? ` (${errores} con error)` : ''}. ${detalle}</span>
    ${navigator.onLine && est.sesion !== false ? '<button type="button" class="boton" id="subir-ya">Subir ahora</button>' : ''}
    <a class="boton" href="#hojas">Ver</a>`;
  caja.hidden = false;
  return items;
}

async function intentaSubir() {
  if (!navigator.onLine) { await pintaPendientes(); return; }
  let res;
  try { res = await cola.subePendientes(); } catch { await pintaPendientes(); return; }
  if (res.motivo === 'sesion') est.sesion = false;
  for (const s of res.subidas) {
    if (est.ultima?.hoja.id === s.id) est.ultima.registro = { ...est.ultima.registro, recibida: s.recibida, estado: s.estado };
    if (est.actual?.hoja.id === s.id) est.actual.registro = { ...est.actual.registro, recibida: s.recibida, estado: s.estado };
  }
  if (res.subidas.length) {
    aviso(res.subidas.length === 1 ? 'Hoja subida a la nube.' : `${res.subidas.length} hojas subidas a la nube.`);
    const ruta = location.hash.slice(1);
    if (ruta === 'firmada') pinta();
    else if (ruta.startsWith('local/') && res.subidas.some((s) => ruta === `local/${s.id}`)) location.hash = `hoja/${ruta.slice(6)}`;
    else if (ruta === 'hojas') pinta();
  }
  await pintaPendientes();
}

/* ── Logo y PDF ──────────────────────────────────────────────────────── */
let logoCache = null;
async function logo() {
  const l = est.yo?.logo;
  if (!l || l.modo === 'ninguno') return null;
  if (logoCache) return logoCache;
  try {
    const r = await fetch('/marca/logo.jpg');
    if (r.ok) logoCache = { bytes: new Uint8Array(await r.arrayBuffer()), ancho: l.ancho, alto: l.alto };
  } catch { /* sin logo: el PDF lleva el nombre */ }
  return logoCache;
}

async function pdfActual() {
  const { hoja, registro } = est.actual;
  return { bytes: pdfDeHoja(hoja, registro, { logo: await logo() }), nombre: nombrePdf(hoja) };
}

function descarga(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function accionPdf(accion) {
  if (!est.actual) return;
  const { bytes, nombre } = await pdfActual();
  if (accion === 'compartir') {
    const archivo = new File([bytes], nombre, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: nombre }); } catch (e) { if (e?.name !== 'AbortError') aviso('No se ha podido compartir: se descarga.'); else return; }
      return;
    }
    aviso('Este navegador no comparte archivos: se descarga el PDF.');
  }
  descarga(bytes, nombre);
}

/* ── Firmas ──────────────────────────────────────────────────────────── */
function quitaFirmas() {
  for (const f of Object.values(est.firmas)) f.destruye();
  est.firmas = {};
}

function montaFirmas() {
  quitaFirmas();
  for (const id of ['cliente', 'agente']) {
    const lienzo = document.getElementById(`firma-${id}`);
    if (!lienzo) continue;
    est.firmas[id] = creaFirma(lienzo, {
      alCambiar: (n) => {
        document.getElementById(`estado-firma-${id}`).textContent = n ? 'Firmado' : 'Sin firmar';
        if (n) est.sucio = true;
      },
    });
  }
}

/** JPEG de la firma, ≤ 150 KB (si pesa más, se baja la calidad y luego el tamaño). */
function firmaJpeg(f) {
  for (const [ancho, calidad] of [[600, 0.72], [600, 0.5], [400, 0.5]]) {
    const j = f.aJpeg(ancho, calidad);
    if (bytesDeBase64(j.dataUrl) <= MAX_FIRMA_BYTES) return { dataUrl: j.dataUrl, ancho: j.ancho, alto: j.alto };
  }
  return null;
}

/* ── Formularios de hoja ─────────────────────────────────────────────── */
const valor = (id) => document.getElementById(id)?.value ?? '';
const marcada = (id) => Boolean(document.getElementById(id)?.checked);

function datosVisita() {
  const piso = {};
  for (const c of CAMPOS_INMUEBLE) piso[c.id] = valor(`p-${c.id}`);
  return {
    fecha: valor('v-fecha'),
    hora: valor('v-hora'),
    visitante: { nombre: valor('v-nombre'), dni: valor('v-dni'), telefono: valor('v-telefono'), email: valor('v-email') },
    acompanantes: valor('v-acompanantes'),
    observaciones: valor('v-observaciones'),
    aceptaRgpd: marcada('v-rgpd'),
    aceptaOfertas: marcada('v-ofertas'),
    piso,
  };
}

function datosCaptacion(fechaCaptacion) {
  const piso = {};
  for (const c of CAMPOS_CAPTACION) if (c.id !== 'fechaCaptacion') piso[c.id] = valor(`c-${c.id}`);
  if (piso.lugarFirma !== 'Fuera de la oficina') piso.comercializarYa = '';
  piso.fechaCaptacion = fechaCaptacion;
  return { piso, notas: valor('c-notas') };
}

function textosDe(tipo) {
  const t = est.yo.textos;
  return tipo === 'visita'
    ? { declaracion: t.declaracion, rgpd: t.rgpdVisita, revisados: t.visitaRevisados }
    : { conformidad: t.conformidad, rgpd: t.rgpdCaptacion, desistimiento: t.desistimiento, revisados: t.captacionRevisados };
}

/* Texto legal con los datos puestos, en vivo (las mismas funciones que el PDF). */
function actualizaTextoLegal(tipo) {
  const m = est.yo.marca;
  const agente = est.yo.agente.nombre;
  if (tipo === 'visita') {
    const d = datosVisita();
    const el = document.getElementById('texto-declaracion');
    if (el) el.textContent = declaracionDe({ visitante: d.visitante, inmueble: nombrePiso(d.piso), fecha: d.fecha, hora: d.hora }, { textoDeclaracion: est.yo.textos.declaracion, empresa: m.nombreComercial, agente });
    return;
  }
  const hoy = enMadrid(new Date().toISOString()).iso;
  const d = datosCaptacion(hoy);
  const el = document.getElementById('texto-conformidad');
  if (el) el.textContent = textoConformidad(d.piso, { textoCaptacion: est.yo.textos.conformidad, empresa: m.nombreComercial, agente }, hoy);
  const fuera = d.piso.lugarFirma === 'Fuera de la oficina';
  const caja = document.getElementById('caja-desistimiento');
  if (caja) caja.hidden = !fuera;
  const des = document.getElementById('texto-desistimiento');
  if (des) des.textContent = rellena(est.yo.textos.desistimiento, { empresa: m.nombreComercial });
}

function muestraErrores(lista) {
  const caja = document.getElementById('errores');
  if (!caja) { aviso(lista.join(' ')); return; }
  caja.innerHTML = `<p><strong>Falta algo para poder firmar:</strong></p><ul>${lista.map((e) => `<li>${V.esc(e)}</li>`).join('')}</ul>`;
  caja.hidden = false;
  caja.focus();
}

async function firmaYGuarda(tipo) {
  const errores = [];
  const fc = est.firmas.cliente;
  const fa = est.firmas.agente;
  const quien = tipo === 'visita' ? 'del visitante' : 'del propietario';
  if (!fc?.suficiente()) errores.push(`Falta la firma ${quien} (o es demasiado corta).`);
  if (!fa?.suficiente()) errores.push('Falta la firma del agente (o es demasiado corta).');
  const firmadaEn = new Date().toISOString();
  const bruto = {
    v: VERSION_HOJA,
    id: nuevoId(),
    tipo,
    firmadaEn,
    agente: { id: est.yo.agente.id, nombre: est.yo.agente.nombre },
    marca: est.yo.marca,
    textos: textosDe(tipo),
    datos: tipo === 'visita' ? datosVisita() : datosCaptacion(enMadrid(firmadaEn).iso),
    firmas: {
      cliente: fc?.suficiente() ? firmaJpeg(fc) : null,
      agente: fa?.suficiente() ? firmaJpeg(fa) : null,
    },
  };
  const r = limpiaHoja(bruto);
  const todos = [...new Set([...errores, ...r.errores.filter((e) => !/^Falta la firma/.test(e) || !errores.length)])];
  if (todos.length) { muestraErrores(todos); return; }
  const hoja = r.hoja;
  const hash = await hashHoja(hoja);
  try {
    await cola.guarda({ id: hoja.id, hoja, hash, creada: firmadaEn, estado: 'pendiente', mensaje: '' });
  } catch {
    muestraErrores(['No se ha podido guardar en este móvil (¿almacenamiento lleno o modo privado?). No cierres esta pantalla: descarga el PDF.']);
    est.ultima = { hoja, registro: { hash, recibida: '' } };
    return;
  }
  est.sucio = false;
  est.ultima = { hoja, registro: { hash, recibida: '', estado: 'firmada' } };
  location.hash = 'firmada';
  intentaSubir();
}

/* ── Pantallas ───────────────────────────────────────────────────────── */
function marcaPestana(ruta) {
  const nav = document.getElementById('pestanas');
  nav.hidden = !est.yo;
  for (const a of nav.querySelectorAll('a')) {
    const activa = ruta.startsWith(a.dataset.pestana) || (a.dataset.pestana === 'hojas' && /^(hoja|local)\//.test(ruta));
    if (activa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function enfoca() {
  window.scrollTo(0, 0);
  vista.focus({ preventScroll: true });
}

async function pinta() {
  const ruta = location.hash.slice(1) || 'inicio';
  est.rutaActual = ruta;
  quitaFirmas();
  marcaPestana(ruta);
  if (est.apagada) { vista.innerHTML = V.vistaEntrar({ apagada: est.apagada }); return; }
  const necesitaRed = ruta === 'hojas' || ruta.startsWith('hoja/') || ruta === 'ajustes';
  if (!est.yo || ruta === 'entrar' || (necesitaRed && est.sesion === false)) return pintaEntrar();

  if (ruta === 'visita' || ruta === 'captacion') {
    const ahora = new Date();
    vista.innerHTML = ruta === 'visita'
      ? V.formVisita({ cfg: est.yo, agente: est.yo.agente, hoy: aISO(ahora), hora: horaActual(ahora) })
      : V.formCaptacion({ cfg: est.yo, agente: est.yo.agente });
    montaFirmas();
    const form = document.getElementById('form-hoja');
    form.addEventListener('input', () => { est.sucio = true; actualizaTextoLegal(ruta); });
    form.addEventListener('change', () => actualizaTextoLegal(ruta));
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-borrar-firma]');
      if (b) est.firmas[b.dataset.borrarFirma]?.limpia();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); firmaYGuarda(ruta); });
    actualizaTextoLegal(ruta);
    est.sucio = false;
    return enfoca();
  }
  if (ruta === 'firmada') {
    if (!est.ultima) { location.hash = 'inicio'; return; }
    est.actual = est.ultima;
    vista.innerHTML = V.vistaFirmada({ ...est.ultima, marca: est.yo.marca });
    return enfoca();
  }
  if (ruta === 'hojas') return pintaHojas();
  if (ruta.startsWith('hoja/')) return pintaDetalle(ruta.slice(5));
  if (ruta.startsWith('local/')) return pintaLocal(ruta.slice(6));
  if (ruta === 'ajustes') return pintaAjustes();
  vista.innerHTML = V.vistaInicio({ agente: est.yo.agente, avisos: est.yo.avisos || [], sinSesion: est.sesion === false });
  return enfoca();
}

function pintaEntrar() {
  document.getElementById('pestanas').hidden = true;
  vista.innerHTML = V.vistaEntrar({ nombreApp: est.yo?.marca?.nombreComercial || '' });
  const form = document.getElementById('form-entrar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = document.getElementById('error-entrar');
    error.textContent = '';
    if (!valor('clave')) { error.textContent = 'Escribe la clave.'; return; }
    try {
      const r = await api('/api/entrar', { metodo: 'POST', cuerpo: { usuario: valor('usuario').trim(), clave: valor('clave') } });
      if (!r.ok) { error.textContent = textoError(r); return; }
    } catch {
      error.textContent = 'Sin conexión: para entrar hace falta internet (solo la primera vez y cuando caduca la sesión).';
      return;
    }
    await refrescaYo();
    location.hash = 'inicio';
    if (location.hash === '#inicio') pinta();
    intentaSubir();
  });
  enfoca();
}

async function pintaHojas() {
  const pendientes = await cola.lista().catch(() => []);
  const f = est.filtros;
  vista.innerHTML = V.vistaHojas({ filtros: f, filas: null, pendientes, titular: est.yo.agente.titular });
  const enlazar = () => {
    document.getElementById('form-filtros').addEventListener('submit', (e) => {
      e.preventDefault();
      est.filtros = { tipo: valor('f-tipo'), ref: valor('f-ref').trim(), nombre: valor('f-nombre').trim(), desde: valor('f-desde'), hasta: valor('f-hasta') };
      pintaHojas();
    });
    document.getElementById('f-limpiar').addEventListener('click', () => { est.filtros = {}; pintaHojas(); });
  };
  enlazar();
  enfoca();
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
  try {
    const r = await api(`/api/hojas?${q}`);
    if (location.hash !== '#hojas') return;
    if (r.estado === 401) return pinta();
    vista.innerHTML = V.vistaHojas({ filtros: f, filas: r.ok ? r.hojas : null, total: r.total || 0, pendientes, error: r.ok ? '' : textoError(r), titular: est.yo.agente.titular });
  } catch {
    if (location.hash !== '#hojas') return;
    vista.innerHTML = V.vistaHojas({ filtros: f, filas: null, pendientes, error: 'Sin conexión: la lista de la nube necesita internet. Arriba tienes lo que está en este móvil.', titular: est.yo.agente.titular });
  }
  enlazar();
}

async function pintaDetalle(id) {
  vista.innerHTML = '<p class="cargando">Cargando…</p>';
  let r;
  try { r = await api(`/api/hojas/${encodeURIComponent(id)}`); } catch {
    vista.innerHTML = '<p class="error" role="alert">Sin conexión: para ver una hoja de la nube hace falta internet.</p><p><a href="#hojas">← Volver</a></p>';
    return;
  }
  if (r.estado === 401) return pinta();
  if (!r.ok) { vista.innerHTML = `<p class="error" role="alert">${V.esc(textoError(r))}</p><p><a href="#hojas">← Volver</a></p>`; return; }
  est.actual = { hoja: r.hoja, registro: r.registro };
  vista.innerHTML = V.vistaDetalle({ hoja: r.hoja, registro: r.registro, titular: est.yo.agente.titular, marca: est.yo.marca });
  document.getElementById('form-anular')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = valor('motivo').trim();
    if (motivo.length < 5) { aviso('Escribe el motivo de la anulación.'); document.getElementById('motivo').focus(); return; }
    const res = await api(`/api/hojas/${id}/anular`, { metodo: 'POST', cuerpo: { motivo } }).catch(() => ({ ok: false, error: 'Sin conexión.' }));
    if (!res.ok) { aviso(textoError(res), 6000); return; }
    aviso('Hoja anulada. Queda constancia en el registro.');
    pintaDetalle(id);
  });
  document.getElementById('form-borrar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (valor('confirmacion').trim() !== 'BORRAR') { aviso('Escribe BORRAR para confirmar.'); document.getElementById('confirmacion').focus(); return; }
    if (!confirm('¿Borrar definitivamente los datos y las firmas de esta hoja? No se puede deshacer.')) return;
    const res = await api(`/api/hojas/${id}/borrar`, { metodo: 'POST', cuerpo: { confirmacion: 'BORRAR' } }).catch(() => ({ ok: false, error: 'Sin conexión.' }));
    if (!res.ok) { aviso(textoError(res), 6000); return; }
    est.actual = null;
    aviso('Datos borrados. En el registro solo queda que existió y cuándo se borró.', 6000);
    location.hash = 'hojas';
  });
  enfoca();
}

async function pintaLocal(id) {
  const item = await cola.lee(id).catch(() => null);
  if (!item) { location.hash = `hoja/${id}`; return; }
  est.actual = { hoja: item.hoja, registro: { hash: item.hash, recibida: '', estado: 'firmada' } };
  vista.innerHTML = (item.mensaje ? `<p class="error" role="alert">No se ha podido subir: ${V.esc(item.mensaje)}</p>` : '')
    + V.vistaDetalle({ hoja: item.hoja, registro: est.actual.registro, local: true, marca: est.yo.marca });
  enfoca();
}

/* ── Ajustes ─────────────────────────────────────────────────────────── */
function pintaMuestra() {
  const p = valor('m-colorPrincipal');
  const a = valor('m-colorAcento');
  const boton = document.getElementById('muestra-boton');
  const acento = document.getElementById('muestra-acento');
  if (!boton) return;
  const sp = textoSobre(p);
  const sa = textoSobre(a);
  boton.style.background = p; boton.style.color = sp;
  acento.style.background = a; acento.style.color = sa;
  const c1 = contraste(p, sp);
  const c2 = contraste(a, sa);
  const bien = (c) => (c >= 4.5 ? 'se lee bien' : 'poco contraste');
  document.getElementById('muestra-contraste').textContent =
    `Texto sobre el color principal: ${c1.toFixed(1).replace('.', ',')}:1 (${bien(c1)}). Sobre el acento: ${c2.toFixed(1).replace('.', ',')}:1 (${bien(c2)}). La app elige sola texto blanco o negro.`;
}

/** Reduce el logo en el móvil: JPEG sobre blanco, ≤ 800×400 px y < 200 KB. */
async function reduceLogo(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    let escala = Math.min(1, 800 / img.naturalWidth, 400 / img.naturalHeight);
    for (let intento = 0; intento < 6; intento++) {
      const c = document.createElement('canvas');
      c.width = Math.max(16, Math.round(img.naturalWidth * escala));
      c.height = Math.max(16, Math.round(img.naturalHeight * escala));
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      for (const calidad of [0.88, 0.75, 0.6]) {
        const dataUrl = c.toDataURL('image/jpeg', calidad);
        if (bytesDeBase64(dataUrl) < 200 * 1024) return { dataUrl, ancho: c.width, alto: c.height };
      }
      escala *= 0.7;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function guardaAjuste(ruta, cuerpo, okId, mensaje) {
  let r;
  try { r = await api(ruta, { metodo: 'POST', cuerpo }); } catch { aviso('Sin conexión: los ajustes necesitan internet.'); return false; }
  if (!r.ok) { aviso(textoError(r), 7000); return false; }
  await refrescaYo();
  await pintaAjustes();
  const ok = okId && document.getElementById(okId);
  if (ok) ok.textContent = mensaje;
  else aviso(mensaje);
  return true;
}

async function pintaAjustes() {
  const yo = est.yo;
  let agentes = [];
  let registro = [];
  if (yo.agente.titular) {
    try {
      const [a, r] = await Promise.all([api('/api/agentes'), api('/api/registro')]);
      if (a.estado === 401) return pinta();
      agentes = a.agentes || [];
      registro = r.registro || [];
    } catch { /* sin conexión: se ve lo que hay */ }
  }
  if (location.hash !== '#ajustes') return;
  vista.innerHTML = V.vistaAjustes({ agente: yo.agente, marca: yo.marca, textos: yo.textos, logo: yo.logo, agentes, registro, avisos: yo.avisos || [] });
  document.getElementById('salir').addEventListener('click', async () => {
    const pend = (await cola.lista().catch(() => [])).length;
    if (pend && !confirm(`Tienes ${pend} hoja(s) sin subir. Se quedan en este móvil hasta que vuelvas a entrar. ¿Salir?`)) return;
    await api('/api/salir', { metodo: 'POST', cuerpo: {} }).catch(() => {});
    localStorage.removeItem(CLAVE_YO);
    est.yo = null;
    est.sesion = false;
    location.hash = 'entrar';
  });
  if (!yo.agente.titular) return enfoca();

  ['m-colorPrincipal', 'm-colorAcento'].forEach((id) => document.getElementById(id).addEventListener('input', pintaMuestra));
  pintaMuestra();
  document.getElementById('form-marca').addEventListener('submit', (e) => {
    e.preventDefault();
    const marca = Object.fromEntries(CAMPOS_MARCA.map((c) => [c.id, valor(`m-${c.id}`)]));
    guardaAjuste('/api/ajustes/marca', { marca }, 'marca-ok', 'Marca guardada. Recarga la app para ver el nombre y el icono nuevos.');
  });
  document.getElementById('logo-archivo').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const reducido = await reduceLogo(archivo).catch(() => null);
    if (!reducido) { aviso('No se ha podido leer o reducir esa imagen.'); return; }
    guardaAjuste('/api/ajustes/logo', reducido, 'logo-ok', 'Logo guardado.');
  });
  document.getElementById('logo-quitar').addEventListener('click', () => guardaAjuste('/api/ajustes/logo', { quitar: true }, 'logo-ok', 'Logo quitado.'));
  document.getElementById('logo-defecto').addEventListener('click', () => guardaAjuste('/api/ajustes/logo', { defecto: true }, 'logo-ok', 'Vuelve el logo de serie.'));
  vista.querySelectorAll('.form-textos').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    const textos = Object.fromEntries(GRUPOS_TEXTOS[f.dataset.grupo].map((k) => [k, valor(`t-${k}`)]));
    guardaAjuste('/api/ajustes/textos', { textos }, null, 'Textos guardados.');
  }));
  vista.querySelectorAll('[data-revisados]').forEach((b) => b.addEventListener('click', () => {
    const valorNuevo = b.dataset.valor === 'si';
    if (valorNuevo && !confirm('¿Confirmas que un profesional (gestor o abogado) ha revisado estos textos?')) return;
    guardaAjuste('/api/ajustes/revisados', { grupo: b.dataset.revisados, valor: valorNuevo }, null, valorNuevo ? 'Marcados como revisados.' : 'Vuelven a ser BORRADOR.');
  }));
  vista.querySelectorAll('[data-borrador]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Sustituir estos textos por el borrador original?')) return;
    guardaAjuste('/api/ajustes/borrador', { grupo: b.dataset.borrador }, null, 'Textos restaurados al borrador.');
  }));
  document.getElementById('form-agente').addEventListener('submit', (e) => {
    e.preventDefault();
    guardaAjuste('/api/agentes', { nombre: valor('a-nombre'), usuario: valor('a-usuario').trim().toLowerCase(), clave: valor('a-clave') }, 'agente-ok', 'Agente añadido.');
  });
  vista.querySelectorAll('[data-clave-agente]').forEach((b) => b.addEventListener('click', () => {
    const clave = prompt('Nueva clave para este agente (10 caracteres o más). Díctasela en persona, no por WhatsApp.');
    if (clave) guardaAjuste(`/api/agentes/${b.dataset.claveAgente}/clave`, { clave }, null, 'Clave cambiada: se cierran sus sesiones abiertas.');
  }));
  vista.querySelectorAll('[data-baja-agente]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('¿Dar de baja a este agente? No podrá entrar; sus hojas se conservan.')) guardaAjuste(`/api/agentes/${b.dataset.bajaAgente}/baja`, {}, null, 'Agente dado de baja.');
  }));
  return enfoca();
}

/* ── Navegación (con aviso si hay una hoja a medias) ─────────────────── */
window.addEventListener('hashchange', () => {
  if (est.ignorarCambio) { est.ignorarCambio = false; return; }
  const anterior = est.rutaActual;
  if (est.sucio && (anterior === 'visita' || anterior === 'captacion')) {
    if (!confirm('Hay una hoja a medias sin firmar. ¿Salir y perderla?')) {
      est.ignorarCambio = true;
      location.hash = anterior;
      return;
    }
    est.sucio = false;
  }
  pinta();
});
window.addEventListener('beforeunload', (e) => { if (est.sucio) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('online', () => { pintaRed(); intentaSubir(); });
window.addEventListener('offline', () => { pintaRed(); pintaPendientes(); });
document.addEventListener('click', (e) => {
  if (e.target.closest('#subir-ya')) intentaSubir();
  const accion = e.target.closest('[data-accion]');
  if (accion) accionPdf(accion.dataset.accion).catch(() => aviso('No se ha podido preparar el PDF.'));
});
setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) intentaSubir(); }, 60_000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

/* ── Arranque ────────────────────────────────────────────────────────── */
pintaRed();
await refrescaYo();
await pinta();
await pintaPendientes();
intentaSubir();
