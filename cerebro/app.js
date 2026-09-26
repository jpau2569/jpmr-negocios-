/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — la app (estado, pantallas y eventos)
   Navegación por #ancla para que el botón "atrás" del móvil funcione:
   #hoy · #visitas · #nueva-visita · #visita/<id> · #operaciones ·
   #nueva-operacion · #operacion/<id> · #valorar · #valoracion/<id> ·
   #papeles · #papel/<id> (o #papel/nuevo) · #ajustes
   Todo el texto que escribe Pau o un cliente pasa por h() antes de
   pintarse (nada de HTML inyectado).
   ═══════════════════════════════════════════════════════════════════ */

import { carga, copiaSeguridad, guarda, leeCopia, tamanoKb, estadoVacio } from './datos.js';
import { crearIcs } from './calendario.js';
import { creaFirma } from './firma.js';
import { pdfHojaVisita, pdfValoracion } from './documentos.js';
import { HOJA_VISITA_BORRADOR } from './operaciones-datos.js';
import {
  TIPOS_OPERACION, calculaPlazo, eventosOperaciones, faseActual, fasesDe, indiceFase, marcaPapel,
  mensajesPara, mueveFase, nuevaOperacion, papelesDe, pendientesHastaAhora, plazosDe, progreso,
  proximasFechas, tipoOperacion, validaFecha, validaOperacion,
} from './operaciones.js';
import { TIPOS_PAPEL, estadoPapel, eventosPapeles, ordenaPapeles, siguienteVencimiento, tipoPapel, validaPapel } from './papeles.js';
import { FUENTES_COMPARABLE, MIN_COMPARABLES, calculaValoracion, eurosM2 } from './valoracion.js';
import { buscaVisitas, declaracionDe, limpiaVisita, validaVisita } from './visitas.js';
import {
  aISO, cuando, escapaHtml as h, euros, fechaCorta, fechaLarga, horaActual, nombreArchivo, nuevoId, telefonoWhatsapp,
} from './utiles.js';

let estado = carga();
if (!estado.ajustes.textoDeclaracion) estado.ajustes.textoDeclaracion = HOJA_VISITA_BORRADOR.declaracion;
if (!estado.ajustes.textoRgpd) estado.ajustes.textoRgpd = HOJA_VISITA_BORRADOR.rgpd;

const vista = document.getElementById('vista');
let firmaActual = null;
// Hoja de visita a medias: se avisa antes de perderla (pestañas, atrás o recargar).
let visitaSucia = false;
let volviendo = false;
window.addEventListener('beforeunload', (e) => { if (visitaSucia) { e.preventDefault(); e.returnValue = ''; } });

/* ───────────────────────── utilidades de pantalla ───────────────────────── */

function guardar() {
  const r = guarda(estado);
  if (!r.ok) {
    aviso(r.error === 'lleno'
      ? '⚠️ La memoria del navegador está llena. Guarda una copia (Ajustes) y borra visitas antiguas.'
      : '⚠️ No se ha podido guardar: ' + r.error, 7000);
  }
  return r.ok;
}

let temporizadorAviso;
function aviso(texto, ms = 3200) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.remove('oculto');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.add('oculto'), ms);
}

function ir(ancla) {
  if (location.hash === '#' + ancla) pinta();
  else location.hash = ancla;
}

function descarga(bytes, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Comparte el archivo (WhatsApp, correo…) si el móvil lo permite; si no, lo descarga. */
async function comparte(bytes, nombre, tipo, texto) {
  const archivo = new File([bytes], nombre, { type: tipo });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre, text: texto });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  descarga(bytes, nombre, tipo);
  aviso('Descargado. Desde la carpeta de descargas lo puedes mandar por WhatsApp o correo.');
}

const vacio = (icono, texto) => `<div class="vacio"><div class="grande" aria-hidden="true">${icono}</div><p>${texto}</p></div>`;
const chipEstadoPapel = (p) => {
  const e = estadoPapel(p);
  if (e.estado === 'vencido') return `<span class="chip vencido">Vencido ${cuando(p.vence)}</span>`;
  if (e.estado === 'pronto') return `<span class="chip pronto">Vence ${cuando(p.vence)}</span>`;
  return `<span class="chip ok">${fechaCorta(p.vence)}</span>`;
};
const opcion = (valor, texto, elegido) => `<option value="${h(valor)}"${valor === elegido ? ' selected' : ''}>${h(texto)}</option>`;

function marcaPestana(nombre) {
  document.querySelectorAll('.pestanas button').forEach((b) => b.setAttribute('aria-current', b.dataset.ir === nombre ? 'page' : 'false'));
}

/* ─────────────────────────────── router ─────────────────────────────── */

function pinta() {
  if (volviendo) { volviendo = false; return; }
  if (visitaSucia && location.hash !== '#nueva-visita') {
    if (!confirm('Tienes una hoja de visita a medias. ¿Salir sin guardarla?')) {
      volviendo = true;
      history.back();
      return;
    }
    visitaSucia = false;
  }
  firmaActual?.destruye();
  firmaActual = null;
  const [ruta, id] = (location.hash.slice(1) || 'hoy').split('/');
  const pantallas = {
    hoy: [pintaHoy, 'hoy'],
    visitas: [pintaVisitas, 'visitas'],
    'nueva-visita': [pintaNuevaVisita, 'visitas'],
    visita: [() => pintaVisita(id), 'visitas'],
    operaciones: [pintaOperaciones, 'operaciones'],
    'nueva-operacion': [pintaNuevaOperacion, 'operaciones'],
    operacion: [() => pintaOperacion(id), 'operaciones'],
    valorar: [pintaValoraciones, 'valorar'],
    valoracion: [() => pintaValoracion(id), 'valorar'],
    papeles: [pintaPapeles, 'papeles'],
    papel: [() => pintaPapel(id), 'papeles'],
    ajustes: [pintaAjustes, ''],
  };
  const [fn, pestana] = pantallas[ruta] || pantallas.hoy;
  marcaPestana(pestana);
  fn();
  vista.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ──────────────────────────────── HOY ──────────────────────────────── */

function pintaHoy() {
  const hoy = aISO();
  const fechas = proximasFechas(estado.operaciones, hoy, 7);
  const papeles = ordenaPapeles(estado.papeles).filter((p) => estadoPapel(p).estado !== 'ok');
  const visitasHoy = estado.visitas.filter((v) => v.fecha === hoy);
  const abiertas = estado.operaciones.filter((o) => !o.cerrada);
  const pendientes = abiertas.reduce((n, o) => n + pendientesHastaAhora(o).length, 0);
  const d = new Date();
  const saludo = d.getHours() < 14 ? 'Buenos días' : d.getHours() < 21 ? 'Buenas tardes' : 'Buenas noches';

  vista.innerHTML = `
    <h1>${saludo}, ${h(estado.ajustes.agente.split(' ')[0] || 'Pau')}</h1>
    <p class="suave">${h(fechaLarga(hoy))}</p>
    <div class="botones">
      <a class="btn principal" href="#nueva-visita">✍️ Nueva visita</a>
      <a class="btn" href="#nueva-operacion">📑 Nueva operación</a>
      <a class="btn" href="#valorar">📊 Valorar un piso</a>
      <a class="btn" href="#papel/nuevo">📁 Añadir papel</a>
    </div>

    <div class="dos">
      <div class="tarjeta"><div class="suave peq">Visitas hoy</div><div style="font-size:26px;font-weight:800">${visitasHoy.length}</div></div>
      <div class="tarjeta"><div class="suave peq">Operaciones en marcha</div><div style="font-size:26px;font-weight:800">${abiertas.length}</div>
        ${pendientes ? `<div class="peq" style="color:var(--aviso)">${pendientes} papeles pendientes</div>` : ''}</div>
    </div>

    <h2>📅 Próximos 7 días</h2>
    ${fechas.length ? fechas.map((f) => `
      <a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#operacion/${h(f.operacion.id)}">
        <div class="entre"><strong>${h(f.nombre)}</strong>
          <span class="chip ${f.faltan < 0 ? 'vencido' : f.faltan <= 2 ? 'pronto' : 'dorado'}">${h(cuando(f.fecha))}${f.hora ? ' · ' + h(f.hora) : ''}</span></div>
        <div class="suave">${h(f.operacion.inmueble)}</div>
      </a>`).join('') : `<p class="suave">Nada con fecha en los próximos 7 días.</p>`}

    <h2>📁 Papeles que vencen</h2>
    ${papeles.length ? papeles.map((p) => `
      <a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#papel/${h(p.id)}">
        <div class="entre"><strong>${tipoPapel(p.tipo).icono} ${h(p.titulo)}</strong>${chipEstadoPapel(p)}</div>
      </a>`).join('') : `<p class="suave">Ningún papel vence pronto. 👌</p>`}
  `;
}

/* ─────────────────────────────── VISITAS ─────────────────────────────── */

function pintaVisitas() {
  vista.innerHTML = `
    <div class="entre"><h1>✍️ Hojas de visita</h1></div>
    <a class="btn principal ancho" href="#nueva-visita">＋ Nueva hoja de visita</a>
    <label for="busca-visita" class="oculto">Buscar</label>
    <input id="busca-visita" type="search" placeholder="Buscar por cliente, inmueble, teléfono o DNI" style="margin-top:12px" />
    <div id="lista-visitas"></div>`;
  const pintaLista = () => {
    const lista = buscaVisitas(estado.visitas, document.getElementById('busca-visita').value);
    document.getElementById('lista-visitas').innerHTML = lista.length
      ? lista.map((v) => `
        <a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#visita/${h(v.id)}">
          <div class="entre"><strong>${h(v.visitante.nombre)}</strong><span class="chip">${h(fechaCorta(v.fecha))} · ${h(v.hora)}</span></div>
          <div class="suave">${h(v.inmueble)}</div>
        </a>`).join('')
      : estado.visitas.length ? `<p class="suave">No hay visitas que coincidan.</p>` : vacio('✍️', 'Aún no hay hojas de visita. La primera la firmas en el móvil en 1 minuto.');
  };
  document.getElementById('busca-visita').addEventListener('input', pintaLista);
  pintaLista();
}

function inmueblesConocidos() {
  const set = new Set();
  estado.operaciones.forEach((o) => o.inmueble && set.add(o.inmueble));
  estado.visitas.forEach((v) => v.inmueble && set.add(v.inmueble));
  estado.valoraciones.forEach((v) => v.inmueble?.direccion && set.add(v.inmueble.direccion));
  return [...set].slice(0, 60);
}

function pintaNuevaVisita() {
  const aj = estado.ajustes;
  vista.innerHTML = `
    <h1>✍️ Nueva hoja de visita</h1>
    ${aj.textosRevisados ? '' : `<div class="aviso">Los textos legales son un <strong>borrador</strong>: revísalos con tu gestor o abogado y márcalos como revisados en <a href="#ajustes">Ajustes</a>. Mientras tanto el PDF lo indica.</div>`}
    <form id="form-visita" novalidate>
      <div class="dos">
        <div><label for="v-fecha">Fecha</label><input id="v-fecha" type="date" value="${aISO()}" required /></div>
        <div><label for="v-hora">Hora</label><input id="v-hora" type="time" value="${horaActual()}" required /></div>
      </div>
      <label for="v-inmueble">Inmueble</label>
      <input id="v-inmueble" type="text" list="inmuebles" placeholder="Referencia o dirección (p. ej. Uría 12, 3ºB)" autocomplete="off" required />
      <datalist id="inmuebles">${inmueblesConocidos().map((i) => `<option value="${h(i)}"></option>`).join('')}</datalist>

      <h2>Visitante</h2>
      <label for="v-nombre">Nombre y apellidos</label>
      <input id="v-nombre" type="text" autocomplete="off" required />
      <div class="dos">
        <div><label for="v-dni">DNI / NIE <span class="opc">(opcional)</span></label><input id="v-dni" type="text" autocomplete="off" /></div>
        <div><label for="v-tel">Teléfono <span class="opc">(opcional)</span></label><input id="v-tel" type="tel" autocomplete="off" /></div>
      </div>
      <label for="v-email">Correo <span class="opc">(opcional)</span></label>
      <input id="v-email" type="email" autocomplete="off" />
      <label for="v-acomp">Acompañantes <span class="opc">(opcional)</span></label>
      <input id="v-acomp" type="text" autocomplete="off" />
      <label for="v-obs">Observaciones <span class="opc">(opcional: qué le gustó, dudas…)</span></label>
      <textarea id="v-obs"></textarea>

      <h2>Lo que firma</h2>
      <div class="tarjeta peq" id="v-declaracion"></div>
      <details><summary>Leer la información de protección de datos</summary><p class="peq">${h(aj.textoRgpd)}</p></details>
      <label class="check"><input id="v-rgpd" type="checkbox" /> <span>He leído la información sobre protección de datos.</span></label>
      <label class="check"><input id="v-ofertas" type="checkbox" /> <span>Quiero recibir información de otros inmuebles. <span class="suave">(opcional)</span></span></label>

      <label>Firma del visitante</label>
      <div class="firma-caja"><canvas id="v-firma" aria-label="Zona para firmar con el dedo"></canvas></div>
      <div class="entre"><span class="suave peq">Firma con el dedo dentro del recuadro.</span>
        <button type="button" class="btn" id="v-limpia" style="min-height:40px">Borrar firma</button></div>

      <div id="v-errores"></div>
      <button type="submit" class="btn principal ancho" style="margin-top:14px">Guardar y crear el PDF</button>
    </form>`;

  const val = (id) => document.getElementById(id).value;
  const borrador = () => ({
    fecha: val('v-fecha'), hora: val('v-hora'), inmueble: val('v-inmueble'),
    visitante: { nombre: val('v-nombre'), dni: val('v-dni'), telefono: val('v-tel'), email: val('v-email') },
  });
  const pintaDeclaracion = () => {
    const b = borrador();
    document.getElementById('v-declaracion').textContent = declaracionDe(
      { ...b, visitante: { ...b.visitante, nombre: b.visitante.nombre || '[nombre]', dni: b.visitante.dni }, inmueble: b.inmueble || '[inmueble]' }, aj);
  };
  ['v-fecha', 'v-hora', 'v-inmueble', 'v-nombre', 'v-dni'].forEach((id) => document.getElementById(id).addEventListener('input', pintaDeclaracion));
  pintaDeclaracion();

  firmaActual = creaFirma(document.getElementById('v-firma'), { alCambiar: (n) => { if (n) visitaSucia = true; } });
  document.getElementById('v-limpia').addEventListener('click', () => firmaActual.limpia());

  const formVisita = document.getElementById('form-visita');
  formVisita.addEventListener('input', () => { visitaSucia = true; });
  let guardando = false;
  formVisita.addEventListener('submit', (e) => {
    e.preventDefault();
    if (guardando) return; // un doble toque no duplica la visita
    if (!firmaActual.vacia() && !firmaActual.suficiente()) {
      document.getElementById('v-errores').innerHTML = '<div class="aviso mal" role="alert">La firma es demasiado corta: pide al visitante que firme de nuevo.</div>';
      return;
    }
    const firma = firmaActual.vacia() ? null : firmaActual.aJpeg(600, 0.7);
    const visita = {
      id: nuevoId('vis'),
      ...borrador(),
      acompanantes: val('v-acomp'),
      observaciones: val('v-obs'),
      aceptaRgpd: document.getElementById('v-rgpd').checked,
      aceptaOfertas: document.getElementById('v-ofertas').checked,
      firma: firma?.dataUrl, firmaAncho: firma?.ancho, firmaAlto: firma?.alto,
      registrada: new Date().toISOString(),
    };
    const v = validaVisita(visita);
    if (!v.ok) {
      document.getElementById('v-errores').innerHTML = `<div class="aviso mal" role="alert">${v.errores.map(h).join('<br>')}</div>`;
      document.getElementById('v-errores').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    guardando = true;
    estado.visitas.push(limpiaVisita(visita));
    if (!guardar()) { estado.visitas.pop(); guardando = false; return; }
    visitaSucia = false;
    aviso('✅ Visita guardada. Ya puedes enviarle el PDF.');
    ir(`visita/${visita.id}`);
  });
}

function pdfDeVisita(v) {
  try {
    return { bytes: pdfHojaVisita(v, estado.ajustes), nombre: `${nombreArchivo(`Hoja-visita-${v.inmueble}-${v.fecha}`)}.pdf` };
  } catch {
    aviso('No puedo crear el PDF: la firma guardada de esta visita está dañada.', 6000);
    return null;
  }
}

function pintaVisita(id) {
  const v = estado.visitas.find((x) => x.id === id);
  if (!v) { vista.innerHTML = vacio('🤷', 'No encuentro esa visita.') + '<a class="btn ancho" href="#visitas">Volver</a>'; return; }
  const tel = telefonoWhatsapp(v.visitante.telefono);
  vista.innerHTML = `
    <a href="#visitas" class="suave">← Hojas de visita</a>
    <h1>${h(v.visitante.nombre)}</h1>
    <div class="tarjeta">
      <p><strong>${h(v.inmueble)}</strong></p>
      <p class="suave">${h(fechaLarga(v.fecha))} a las ${h(v.hora)}</p>
      ${v.visitante.telefono ? `<p>📞 ${h(v.visitante.telefono)}</p>` : ''}
      ${v.visitante.email ? `<p>✉️ ${h(v.visitante.email)}</p>` : ''}
      ${v.observaciones ? `<p class="suave">${h(v.observaciones)}</p>` : ''}
      <p class="peq">${v.aceptaOfertas ? '✅ Acepta recibir otros inmuebles' : '— No quiere recibir otros inmuebles'}</p>
      ${v.firma ? `<img alt="Firma de ${h(v.visitante.nombre)}" src="${h(v.firma)}" style="max-width:100%;border:1px solid var(--linea);border-radius:10px;background:#fff;margin-top:8px" />` : '<div class="aviso mal">La firma de esta visita no se puede leer.</div>'}
    </div>
    <div class="botones">
      <button class="btn principal" id="v-compartir">📤 Enviar el PDF</button>
      <button class="btn" id="v-descargar">⬇️ Descargar PDF</button>
    </div>
    ${tel ? `<a class="btn ancho" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${v.visitante.nombre.split(' ')[0]}, gracias por la visita a ${v.inmueble}. Te mando la hoja de visita firmada. Cualquier duda, aquí estoy. ${estado.ajustes.agente}`)}">💬 Abrir su WhatsApp</a>
      <p class="suave peq">Consejo: pulsa "Enviar el PDF" y elige WhatsApp; así va el documento adjunto.</p>` : ''}
    <button class="btn peligro ancho" id="v-borrar" style="margin-top:22px">Borrar esta visita</button>`;

  document.getElementById('v-compartir').addEventListener('click', () => {
    const pdf = pdfDeVisita(v);
    if (pdf) comparte(pdf.bytes, pdf.nombre, 'application/pdf', `Hoja de visita · ${v.inmueble}`);
  });
  document.getElementById('v-descargar').addEventListener('click', () => {
    const pdf = pdfDeVisita(v);
    if (pdf) descarga(pdf.bytes, pdf.nombre, 'application/pdf');
  });
  document.getElementById('v-borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar esta hoja de visita? No se puede deshacer (si no tienes el PDF guardado).')) return;
    estado.visitas = estado.visitas.filter((x) => x.id !== id);
    guardar();
    ir('visitas');
  });
}

/* ───────────────────────────── OPERACIONES ───────────────────────────── */

function pintaOperaciones() {
  const abiertas = estado.operaciones.filter((o) => !o.cerrada);
  const cerradas = estado.operaciones.filter((o) => o.cerrada);
  const tarjeta = (o) => {
    const p = progreso(o);
    const prox = proximasFechas([o], aISO(), 3650)[0];
    return `
      <a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#operacion/${h(o.id)}">
        <div class="entre"><strong>${h(o.inmueble)}</strong><span class="chip dorado">${h(faseActual(o).titulo)}</span></div>
        <div class="suave peq">${h(tipoOperacion(o.tipo).nombre)}${o.precio ? ' · ' + h(euros(o.precio)) + (o.tipo === 'alquiler' ? '/mes' : '') : ''}</div>
        <div class="barra" aria-hidden="true"><i style="width:${p.porcentaje}%"></i></div>
        <div class="suave peq">${p.hechos}/${p.total} papeles${prox ? ` · Próximo: ${h(prox.nombre)} ${h(cuando(prox.fecha))}` : ''}</div>
      </a>`;
  };
  vista.innerHTML = `
    <h1>📑 Operaciones</h1>
    <div class="botones">
      <a class="btn principal" href="#nueva-operacion">＋ Nueva operación</a>
      <button class="btn" id="op-ics" ${abiertas.length ? '' : 'disabled'}>📅 Fechas al calendario</button>
    </div>
    ${abiertas.length ? abiertas.map(tarjeta).join('') : vacio('📑', 'No hay operaciones en marcha. Crea una cuando firmes una reserva.')}
    ${cerradas.length ? `<details><summary>Cerradas (${cerradas.length})</summary>${cerradas.map(tarjeta).join('')}</details>` : ''}`;
  document.getElementById('op-ics').addEventListener('click', () => exportaCalendarioOperaciones());
}

function exportaCalendarioOperaciones() {
  const eventos = eventosOperaciones(estado.operaciones);
  if (!eventos.length) { aviso('Aún no hay fechas apuntadas en las operaciones.'); return; }
  const ics = crearIcs(eventos, { nombre: 'Operaciones · Cerebro Útil Pau' });
  comparte(new TextEncoder().encode(ics), 'operaciones.ics', 'text/calendar', 'Fechas de mis operaciones');
}

function pintaNuevaOperacion() {
  vista.innerHTML = `
    <a href="#operaciones" class="suave">← Operaciones</a>
    <h1>📑 Nueva operación</h1>
    <form id="form-op" novalidate>
      <label for="o-tipo">Tipo</label>
      <select id="o-tipo">${TIPOS_OPERACION.map((t) => opcion(t.id, t.nombre, 'compraventa')).join('')}</select>
      <label for="o-inmueble">Inmueble</label>
      <input id="o-inmueble" type="text" list="inmuebles" placeholder="Referencia o dirección" required />
      <datalist id="inmuebles">${inmueblesConocidos().map((i) => `<option value="${h(i)}"></option>`).join('')}</datalist>
      <label for="o-precio" id="o-precio-et">Precio <span class="opc">(€, opcional)</span></label>
      <input id="o-precio" type="number" inputmode="numeric" min="0" step="100" />
      <h2 id="o-tit-a">Comprador</h2>
      <label for="o-a-nombre">Nombre</label><input id="o-a-nombre" type="text" />
      <div class="dos"><div><label for="o-a-tel">Teléfono</label><input id="o-a-tel" type="tel" /></div>
        <div><label for="o-a-email">Correo</label><input id="o-a-email" type="email" /></div></div>
      <h2 id="o-tit-b">Vendedor</h2>
      <label for="o-b-nombre">Nombre</label><input id="o-b-nombre" type="text" />
      <div class="dos"><div><label for="o-b-tel">Teléfono</label><input id="o-b-tel" type="tel" /></div>
        <div><label for="o-b-email">Correo</label><input id="o-b-email" type="email" /></div></div>
      <h2>Otros</h2>
      <div class="dos"><div><label for="o-notaria">Notaría <span class="opc">(opcional)</span></label><input id="o-notaria" type="text" /></div>
        <div><label for="o-banco">Banco <span class="opc">(opcional)</span></label><input id="o-banco" type="text" /></div></div>
      <label for="o-notas">Notas <span class="opc">(opcional)</span></label><textarea id="o-notas"></textarea>
      <div id="o-errores"></div>
      <button class="btn principal ancho" type="submit" style="margin-top:14px">Crear operación</button>
    </form>`;
  const tipoSel = document.getElementById('o-tipo');
  const titulos = () => {
    const [a, b] = tipoOperacion(tipoSel.value).partes;
    document.getElementById('o-tit-a').textContent = a[0].toUpperCase() + a.slice(1);
    document.getElementById('o-tit-b').textContent = b[0].toUpperCase() + b.slice(1);
    document.getElementById('o-precio-et').innerHTML = tipoSel.value === 'alquiler' ? 'Renta mensual <span class="opc">(€, opcional)</span>' : 'Precio <span class="opc">(€, opcional)</span>';
  };
  tipoSel.addEventListener('change', titulos);
  const val = (id) => document.getElementById(id).value;
  let creando = false;
  document.getElementById('form-op').addEventListener('submit', (e) => {
    e.preventDefault();
    if (creando) return; // un doble toque no duplica la operación
    const op = nuevaOperacion({
      id: nuevoId('op'), tipo: val('o-tipo'), inmueble: val('o-inmueble'), precio: val('o-precio'),
      parteA: { nombre: val('o-a-nombre'), telefono: val('o-a-tel'), email: val('o-a-email') },
      parteB: { nombre: val('o-b-nombre'), telefono: val('o-b-tel'), email: val('o-b-email') },
      notaria: val('o-notaria'), banco: val('o-banco'), notas: val('o-notas'),
    });
    const v = validaOperacion(op);
    if (!v.ok) { document.getElementById('o-errores').innerHTML = `<div class="aviso mal" role="alert">${v.errores.map(h).join('<br>')}</div>`; return; }
    creando = true;
    estado.operaciones.push(op);
    if (!guardar()) { estado.operaciones.pop(); creando = false; return; }
    ir(`operacion/${op.id}`);
  });
}

function pintaOperacion(id) {
  const op = estado.operaciones.find((x) => x.id === id);
  if (!op) { vista.innerHTML = vacio('🤷', 'No encuentro esa operación.') + '<a class="btn ancho" href="#operaciones">Volver</a>'; return; }
  const fases = fasesDe(op.tipo);
  const iActual = indiceFase(op);
  const p = progreso(op);
  const urgentes = pendientesHastaAhora(op);
  const [a, b] = tipoOperacion(op.tipo).partes;
  const parteHtml = (rol) => {
    const x = op.partes?.[rol] || {};
    if (!x.nombre && !x.telefono && !x.email) return '';
    return `<p><span class="suave">${h(rol[0].toUpperCase() + rol.slice(1))}:</span> <strong>${h(x.nombre || '—')}</strong>
      ${x.telefono ? ` · <a href="tel:${h(x.telefono.replace(/\s/g, ''))}">${h(x.telefono)}</a>` : ''}</p>`;
  };
  const etiquetaCaracter = { obligatorio: ['mal', 'Obligatorio'], habitual: ['dorado', 'Habitual'], 'segun-caso': ['', 'Según el caso'] };
  const mensajes = mensajesPara(op, estado.ajustes);

  vista.innerHTML = `
    <a href="#operaciones" class="suave">← Operaciones</a>
    <h1>${h(op.inmueble)}</h1>
    <p class="suave">${h(tipoOperacion(op.tipo).nombre)}${op.precio ? ' · ' + h(euros(op.precio)) + (op.tipo === 'alquiler' ? '/mes' : '') : ''}${op.cerrada ? ' · <strong>Cerrada</strong>' : ''}</p>
    <div class="tarjeta">
      ${parteHtml(a)}${parteHtml(b)}
      ${op.notaria ? `<p><span class="suave">Notaría:</span> ${h(op.notaria)}</p>` : ''}
      ${op.banco ? `<p><span class="suave">Banco:</span> ${h(op.banco)}</p>` : ''}
    </div>

    <h2>Fase</h2>
    <div class="fases" role="list">${fases.map((f, i) => `<span role="listitem" class="${i < iActual ? 'hecha' : i === iActual ? 'actual' : ''}">${i + 1}. ${h(f.titulo)}</span>`).join('')}</div>
    <p class="peq">${h(faseActual(op).explicacion || '')}</p>
    <div class="botones">
      <button class="btn" id="op-atras" ${iActual === 0 ? 'disabled' : ''}>← Fase anterior</button>
      <button class="btn dorado" id="op-adelante" ${iActual === fases.length - 1 ? 'disabled' : ''}>Siguiente fase →</button>
    </div>

    <h2>Papeles <span class="suave peq">(${p.hechos}/${p.total})</span></h2>
    <div class="barra" aria-hidden="true"><i style="width:${p.porcentaje}%"></i></div>
    ${urgentes.length ? `<div class="aviso">Faltan <strong>${urgentes.length}</strong> papeles de las fases ya alcanzadas.</div>` : `<div class="aviso ok">Todo lo necesario hasta esta fase está listo. 👏</div>`}
    ${fases.map((f, i) => `
      <details ${i === iActual ? 'open' : ''} class="tarjeta">
        <summary>${i + 1}. ${h(f.titulo)} <span class="suave peq" style="margin-left:6px">(${papelesDe(op).filter((x) => x.fase === f.fase && x.hecho).length}/${f.papeles.length})</span></summary>
        ${f.papeles.map((pa) => {
          const hecho = Boolean(op.papeles?.[pa.id]);
          const [cls, txt] = etiquetaCaracter[pa.caracter] || ['', pa.caracter];
          return `<div class="papel ${hecho ? 'hecho' : ''}">
            <input type="checkbox" data-papel="${h(pa.id)}" id="pa-${h(pa.id)}" ${hecho ? 'checked' : ''} />
            <label for="pa-${h(pa.id)}" style="margin:0;font-weight:400">
              <span class="nombre">${h(pa.nombre)}</span>
              <span class="chip ${cls}">${h(txt)}</span> <span class="chip">Aporta: ${h(pa.aporta)}</span>
              ${pa.nota ? `<br><span class="suave peq">${h(pa.nota)}</span>` : ''}
              ${pa.fuente ? `<br><a class="peq" href="${h(pa.fuente)}" target="_blank" rel="noopener">Fuente</a>` : ''}
            </label></div>`;
        }).join('')}
      </details>`).join('')}

    <h2>📅 Fechas clave</h2>
    ${(op.fechas || []).length ? [...op.fechas].sort((x, y) => `${x.fecha}${x.hora}`.localeCompare(`${y.fecha}${y.hora}`)).map((f) => `
      <div class="tarjeta entre">
        <label class="check" style="margin:0"><input type="checkbox" data-fecha-hecha="${h(f.id)}" ${f.hecha ? 'checked' : ''} />
          <span><strong ${f.hecha ? 'style="text-decoration:line-through"' : ''}>${h(f.nombre)}</strong><br>
          <span class="suave peq">${h(fechaCorta(f.fecha))}${f.hora ? ' · ' + h(f.hora) : ''} · ${h(cuando(f.fecha))} · aviso ${h(f.avisoDias)} día(s) antes</span></span></label>
        <button class="btn" data-fecha-borra="${h(f.id)}" aria-label="Borrar fecha" style="min-height:40px">🗑</button>
      </div>`).join('') : '<p class="suave">Sin fechas todavía.</p>'}
    <details class="tarjeta"><summary>＋ Añadir una fecha</summary>
      <form id="form-fecha" novalidate>
        <label for="f-nombre">Qué es</label><input id="f-nombre" type="text" list="nombres-fecha" placeholder="Firma en notaría, fin plazo arras…" />
        <datalist id="nombres-fecha"><option value="Firma de arras"></option><option value="Fin del plazo de arras"></option><option value="Tasación"></option><option value="Entrega de la FEIN"></option><option value="Acta previa en notaría"></option><option value="Firma en notaría"></option><option value="Firma del contrato de alquiler"></option><option value="Entrega de llaves"></option><option value="Pago del ITP (modelo 600)"></option><option value="Plusvalía municipal"></option></datalist>
        <div class="dos"><div><label for="f-fecha">Fecha</label><input id="f-fecha" type="date" /></div>
          <div><label for="f-hora">Hora <span class="opc">(opcional)</span></label><input id="f-hora" type="time" /></div></div>
        <label for="f-aviso">Avisarme (días antes)</label><input id="f-aviso" type="number" min="0" max="60" value="1" />
        <div id="f-errores"></div>
        <button class="btn principal ancho" type="submit" style="margin-top:10px">Añadir fecha</button>
      </form>
    </details>
    ${plazosDe(op).length ? `<details class="tarjeta"><summary>⏱️ Calcular plazos legales</summary>
      <p class="suave peq">Pon la fecha de inicio y te calculo la fecha límite. Los días hábiles no descuentan festivos: compruébalo si cae cerca de uno.</p>
      ${plazosDe(op).map((pl, i) => `<div style="border-top:1px solid var(--linea);padding-top:8px;margin-top:8px">
        <strong>${h(pl.nombre)}</strong><div class="suave peq">${pl.dias} días ${pl.tipoDias === 'habiles' ? 'hábiles' : 'naturales'} desde: ${h(pl.desde)}${pl.fuente ? ` · <a href="${h(pl.fuente)}" target="_blank" rel="noopener">fuente</a>` : ''}</div>
        <div class="fila"><input type="date" class="crece" data-plazo-base="${i}" aria-label="Fecha de inicio de ${h(pl.nombre)}" />
        <button class="btn" data-plazo="${i}">Añadir</button></div></div>`).join('')}
    </details>` : ''}
    <button class="btn ancho" id="op-ics1">📅 Pasar estas fechas al calendario</button>

    <h2>💬 Mensajes preparados</h2>
    ${mensajes.map((m, i) => {
      const d = m.destinatario || {};
      const tel = telefonoWhatsapp(d.telefono);
      return `<details class="tarjeta"><summary>${h(m.titulo)} <span class="chip" style="margin-left:6px">${h(m.para)}</span></summary>
        <pre class="mensaje" id="msg-${i}">${h(m.texto)}</pre>
        <div class="botones">
          <button class="btn" data-copia="${i}">📋 Copiar</button>
          ${tel ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(m.texto)}">💬 WhatsApp</a>` : ''}
          ${d.email ? `<a class="btn" href="mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(op.inmueble)}&body=${encodeURIComponent(m.texto)}">✉️ Correo</a>` : ''}
        </div>
        ${/\[\w+\]/.test(m.texto) ? '<p class="suave peq">Lo que va entre [corchetes] falta en la ficha: complétalo antes de enviar.</p>' : ''}
      </details>`;
    }).join('')}

    <h2>📝 Notas</h2>
    <textarea id="op-notas" aria-label="Notas de la operación">${h(op.notas || '')}</textarea>

    <div class="botones" style="margin-top:22px">
      <button class="btn" id="op-cerrar">${op.cerrada ? '↩️ Reabrir operación' : '✅ Marcar como cerrada'}</button>
      <button class="btn peligro" id="op-borrar">Borrar</button>
    </div>`;

  const actualiza = (nueva, repinta = true) => {
    const i = estado.operaciones.findIndex((x) => x.id === id);
    estado.operaciones[i] = nueva;
    guardar();
    if (repinta) pintaOperacion(id);
  };
  const actual = () => estado.operaciones.find((x) => x.id === id);

  document.getElementById('op-atras').addEventListener('click', () => actualiza(mueveFase(actual(), -1)));
  document.getElementById('op-adelante').addEventListener('click', () => actualiza(mueveFase(actual(), 1)));
  vista.querySelectorAll('[data-papel]').forEach((el) => el.addEventListener('change', () => {
    const abiertos = [...vista.querySelectorAll('details.tarjeta')].map((d) => d.open);
    actualiza(marcaPapel(actual(), el.dataset.papel, el.checked));
    vista.querySelectorAll('details.tarjeta').forEach((d, i) => { if (abiertos[i] !== undefined) d.open = abiertos[i]; });
  }));
  vista.querySelectorAll('[data-fecha-hecha]').forEach((el) => el.addEventListener('change', () => {
    const o = actual();
    actualiza({ ...o, fechas: o.fechas.map((f) => (f.id === el.dataset.fechaHecha ? { ...f, hecha: el.checked } : f)) });
  }));
  vista.querySelectorAll('[data-fecha-borra]').forEach((el) => el.addEventListener('click', () => {
    const o = actual();
    actualiza({ ...o, fechas: o.fechas.filter((f) => f.id !== el.dataset.fechaBorra) });
  }));
  const anadeFecha = (datos) => {
    const v = validaFecha({ ...datos, id: nuevoId('f') });
    if (!v.ok) return v;
    const o = actual();
    actualiza({ ...o, fechas: [...(o.fechas || []), v.fecha] });
    aviso('📅 Fecha añadida. Pásala al calendario para que el móvil te avise.');
    return v;
  };
  document.getElementById('form-fecha').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = anadeFecha({ nombre: document.getElementById('f-nombre').value, fecha: document.getElementById('f-fecha').value, hora: document.getElementById('f-hora').value, avisoDias: document.getElementById('f-aviso').value });
    if (!v.ok) document.getElementById('f-errores').innerHTML = `<div class="aviso mal" role="alert">${v.errores.map(h).join('<br>')}</div>`;
  });
  vista.querySelectorAll('[data-plazo]').forEach((el) => el.addEventListener('click', () => {
    const pl = plazosDe(actual())[Number(el.dataset.plazo)];
    const base = vista.querySelector(`[data-plazo-base="${el.dataset.plazo}"]`).value;
    const fecha = calculaPlazo(pl, base);
    if (!fecha) { aviso('Pon primero la fecha de inicio.'); return; }
    anadeFecha({ nombre: pl.nombre, fecha, avisoDias: 3 });
  }));
  document.getElementById('op-ics1').addEventListener('click', () => {
    const eventos = eventosOperaciones([actual()]);
    if (!eventos.length) { aviso('Esta operación no tiene fechas pendientes.'); return; }
    comparte(new TextEncoder().encode(crearIcs(eventos, { nombre: op.inmueble })), `${nombreArchivo(op.inmueble)}.ics`, 'text/calendar', op.inmueble);
  });
  vista.querySelectorAll('[data-copia]').forEach((el) => el.addEventListener('click', async () => {
    const texto = document.getElementById(`msg-${el.dataset.copia}`).textContent;
    try { await navigator.clipboard.writeText(texto); aviso('📋 Copiado'); } catch { aviso('No se pudo copiar: mantén pulsado el texto para copiarlo.'); }
  }));
  let tNotas;
  document.getElementById('op-notas').addEventListener('input', (e) => {
    clearTimeout(tNotas);
    tNotas = setTimeout(() => actualiza({ ...actual(), notas: e.target.value.slice(0, 1000) }, false), 500);
  });
  document.getElementById('op-cerrar').addEventListener('click', () => actualiza({ ...actual(), cerrada: !actual().cerrada }));
  document.getElementById('op-borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar esta operación con todos sus papeles y fechas?')) return;
    estado.operaciones = estado.operaciones.filter((x) => x.id !== id);
    guardar();
    ir('operaciones');
  });
}

/* ───────────────────────────── VALORACIONES ───────────────────────────── */

function pintaValoraciones() {
  const vacias = (v) => !v.inmueble?.direccion && !v.inmueble?.m2 && !(v.comparables || []).length && !v.propietario && !v.comentario;
  if (estado.valoraciones.some(vacias)) { estado.valoraciones = estado.valoraciones.filter((v) => !vacias(v)); guardar(); }
  const lista = [...estado.valoraciones].sort((a, b) => String(b.creada).localeCompare(String(a.creada)));
  vista.innerHTML = `
    <h1>📊 Valoraciones</h1>
    <p class="suave">Metes los pisos comparables que conoces y te preparo el informe con tu marca para el propietario. Sin inventar precios.</p>
    <button class="btn principal ancho" id="val-nueva">＋ Nueva valoración</button>
    ${lista.length ? lista.map((v) => {
      const c = calculaValoracion(v.comparables, v.inmueble?.m2);
      return `<a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#valoracion/${h(v.id)}">
        <div class="entre"><strong>${h(v.inmueble?.direccion || 'Sin dirección')}</strong><span class="chip">${h(fechaCorta(v.creada))}</span></div>
        <div class="suave peq">${c.suficiente && c.valor ? `${h(euros(c.valor.bajo))} – ${h(euros(c.valor.alto))}` : `${c.n} comparables · faltan datos`}</div></a>`;
    }).join('') : vacio('📊', 'Ninguna valoración todavía.')}`;
  document.getElementById('val-nueva').addEventListener('click', () => {
    const v = { id: nuevoId('val'), creada: aISO(), inmueble: {}, propietario: '', comentario: '', comparables: [] };
    estado.valoraciones.push(v);
    guardar();
    ir(`valoracion/${v.id}`);
  });
}

function pintaValoracion(id) {
  const val = estado.valoraciones.find((x) => x.id === id);
  if (!val) { vista.innerHTML = vacio('🤷', 'No encuentro esa valoración.') + '<a class="btn ancho" href="#valorar">Volver</a>'; return; }
  const s = val.inmueble || {};
  const campo = (clave, etiqueta, tipo = 'text', extra = '') =>
    `<div><label for="vi-${clave}">${etiqueta}</label><input id="vi-${clave}" data-inm="${clave}" type="${tipo}" value="${h(s[clave] ?? '')}" ${extra} /></div>`;
  vista.innerHTML = `
    <a href="#valorar" class="suave">← Valoraciones</a>
    <h1>📊 Valoración</h1>
    <h2>El inmueble</h2>
    ${campo('direccion', 'Dirección o referencia')}
    <div class="dos">${campo('zona', 'Zona / barrio')}${campo('m2', 'Superficie (m²)', 'number', 'inputmode="decimal" min="1"')}</div>
    <div class="dos">${campo('habitaciones', 'Habitaciones', 'text', 'inputmode="numeric"')}${campo('banos', 'Baños', 'text', 'inputmode="numeric"')}</div>
    <div class="dos">${campo('planta', 'Planta / ascensor')}${campo('estado', 'Estado')}</div>
    ${campo('extras', 'Extras (garaje, trastero, terraza…)')}
    <label for="vi-prop">Propietario <span class="opc">(para la portada, opcional)</span></label>
    <input id="vi-prop" type="text" value="${h(val.propietario || '')}" />

    <h2>Comparables <span class="suave peq">(mínimo ${MIN_COMPARABLES})</span></h2>
    <p class="suave peq">Pisos parecidos de la zona: anuncios, ventas cerradas o testigos tuyos. El "ajuste" es opcional: +10 si el tuyo vale un 10 % más por m² que ese comparable (mejor planta, reformado…), −10 si vale menos.</p>
    <div id="comparables"></div>
    <button class="btn ancho" id="val-anade">＋ Añadir comparable</button>

    <h2>Resultado</h2>
    <div id="val-resultado"></div>
    <label for="vi-coment">Comentario para el propietario <span class="opc">(opcional)</span></label>
    <textarea id="vi-coment">${h(val.comentario || '')}</textarea>
    <div class="botones">
      <button class="btn principal" id="val-pdf">📤 Enviar informe PDF</button>
      <button class="btn" id="val-descarga">⬇️ Descargar PDF</button>
    </div>
    <button class="btn peligro ancho" id="val-borrar" style="margin-top:18px">Borrar valoración</button>`;

  const actual = () => estado.valoraciones.find((x) => x.id === id);
  let tGuarda;
  const guardaLuego = () => { clearTimeout(tGuarda); tGuarda = setTimeout(guardar, 400); };

  const pintaComparables = () => {
    const v = actual();
    document.getElementById('comparables').innerHTML = v.comparables.length ? v.comparables.map((c, i) => `
      <div class="tarjeta" data-comp="${i}">
        <div class="entre"><strong>Comparable ${i + 1}</strong><button class="btn" data-comp-borra="${i}" aria-label="Quitar comparable ${i + 1}" style="min-height:40px">🗑</button></div>
        <label for="c-${i}-dir">Dirección / referencia</label><input id="c-${i}-dir" data-c="direccion" value="${h(c.direccion || '')}" />
        <label for="c-${i}-fuente">Fuente</label><select id="c-${i}-fuente" data-c="fuente">${FUENTES_COMPARABLE.map((f) => opcion(f.id, f.nombre, c.fuente || 'anuncio')).join('')}</select>
        <div class="dos"><div><label for="c-${i}-precio">Precio (€)</label><input id="c-${i}-precio" data-c="precio" type="number" inputmode="numeric" min="0" value="${h(c.precio ?? '')}" /></div>
          <div><label for="c-${i}-m2">m²</label><input id="c-${i}-m2" data-c="m2" type="number" inputmode="decimal" min="0" value="${h(c.m2 ?? '')}" /></div></div>
        <div class="dos"><div><label for="c-${i}-aj">Ajuste % <span class="opc">(opcional)</span></label><input id="c-${i}-aj" data-c="ajuste" type="number" inputmode="decimal" min="-50" max="50" value="${h(c.ajuste ?? '')}" /></div>
          <div><label>€/m²</label><div class="suave" data-c-m2="${i}" style="min-height:46px;display:flex;align-items:center"></div></div></div>
      </div>`).join('') : '<p class="suave">Aún no hay comparables.</p>';
    pintaResultado();
  };

  const pintaResultado = () => {
    const v = actual();
    const c = calculaValoracion(v.comparables, v.inmueble?.m2);
    v.comparables.forEach((cmp, i) => {
      const el = vista.querySelector(`[data-c-m2="${i}"]`);
      const ok = c.validos.find((x) => x.id === cmp.id);
      if (el) el.textContent = ok ? euros(eurosM2(ok)) : '—';
    });
    const r = document.getElementById('val-resultado');
    if (c.suficiente && c.valor) {
      r.innerHTML = `<div class="resultado"><div class="suave">Rango orientativo</div>
        <div class="rango">${h(euros(c.valor.bajo))} – ${h(euros(c.valor.alto))}</div>
        <div class="suave peq">Central ${h(euros(c.valor.central))} · ${h(euros(c.porM2.mediana))}/m² (mediana de ${c.n})</div></div>
        ${c.dispersionAlta ? '<div class="aviso">Los comparables son muy distintos entre sí (uno dobla al otro en €/m²). Revisa si son de verdad parecidos.</div>' : ''}
        ${c.descartados.length ? `<p class="suave peq">${c.descartados.length} comparable(s) sin datos completos no cuentan.</p>` : ''}`;
    } else {
      const faltaM2 = !(Number(v.inmueble?.m2) > 0);
      r.innerHTML = `<div class="aviso">Para dar un rango necesito ${c.faltan ? `<strong>${c.faltan} comparable(s) más</strong> con precio y m²` : ''}${c.faltan && faltaM2 ? ' y ' : ''}${faltaM2 ? '<strong>la superficie</strong> del inmueble' : ''}.</div>`;
    }
    document.getElementById('val-pdf').disabled = !c.suficiente;
    document.getElementById('val-descarga').disabled = !c.suficiente;
  };

  vista.querySelectorAll('[data-inm]').forEach((el) => el.addEventListener('input', () => {
    const v = actual();
    v.inmueble = { ...v.inmueble, [el.dataset.inm]: el.dataset.inm === 'm2' ? (el.value === '' ? '' : Number(el.value)) : el.value.slice(0, 120) };
    pintaResultado();
    guardaLuego();
  }));
  document.getElementById('vi-prop').addEventListener('input', (e) => { actual().propietario = e.target.value.slice(0, 80); guardaLuego(); });
  document.getElementById('vi-coment').addEventListener('input', (e) => { actual().comentario = e.target.value.slice(0, 1500); guardaLuego(); });
  document.getElementById('comparables').addEventListener('input', (e) => {
    const caja = e.target.closest('[data-comp]');
    if (!caja || !e.target.dataset.c) return;
    const c = actual().comparables[Number(caja.dataset.comp)];
    const k = e.target.dataset.c;
    c[k] = ['precio', 'm2', 'ajuste'].includes(k) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value.slice(0, 120);
    pintaResultado();
    guardaLuego();
  });
  document.getElementById('comparables').addEventListener('click', (e) => {
    const b = e.target.closest('[data-comp-borra]');
    if (!b) return;
    actual().comparables.splice(Number(b.dataset.compBorra), 1);
    guardar();
    pintaComparables();
  });
  document.getElementById('val-anade').addEventListener('click', () => {
    actual().comparables.push({ id: nuevoId('c'), direccion: '', fuente: 'anuncio', precio: '', m2: '', ajuste: '' });
    guardar();
    pintaComparables();
    const n = actual().comparables.length - 1;
    document.getElementById(`c-${n}-dir`)?.focus();
  });
  const generaPdf = () => {
    const v = actual();
    const c = calculaValoracion(v.comparables, v.inmueble?.m2);
    return { bytes: pdfValoracion(v, c, estado.ajustes, aISO()), nombre: `${nombreArchivo(`Valoracion-${v.inmueble?.direccion || 'inmueble'}`)}.pdf` };
  };
  document.getElementById('val-pdf').addEventListener('click', () => { const { bytes, nombre } = generaPdf(); comparte(bytes, nombre, 'application/pdf', 'Informe de valoración'); });
  document.getElementById('val-descarga').addEventListener('click', () => { const { bytes, nombre } = generaPdf(); descarga(bytes, nombre, 'application/pdf'); });
  document.getElementById('val-borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar esta valoración?')) return;
    estado.valoraciones = estado.valoraciones.filter((x) => x.id !== id);
    guardar();
    ir('valorar');
  });
  pintaComparables();
}

/* ─────────────────────────────── PAPELES ─────────────────────────────── */

function pintaPapeles() {
  const lista = ordenaPapeles(estado.papeles);
  vista.innerHTML = `
    <h1>📁 Mis papeles</h1>
    <p class="suave">ITV, seguros, IBI, DNI… Te aviso en el calendario antes de que caduquen.</p>
    <div class="botones">
      <a class="btn principal" href="#papel/nuevo">＋ Añadir papel</a>
      <button class="btn" id="pa-ics" ${lista.length ? '' : 'disabled'}>📅 Avisos al calendario</button>
    </div>
    ${lista.length ? lista.map((p) => `
      <a class="tarjeta" style="display:block;text-decoration:none;color:inherit" href="#papel/${h(p.id)}">
        <div class="entre"><strong>${tipoPapel(p.tipo).icono} ${h(p.titulo)}</strong>${chipEstadoPapel(p)}</div>
        <div class="suave peq">${h(tipoPapel(p.tipo).nombre)} · vence el ${h(fechaCorta(p.vence))}</div>
      </a>`).join('') : vacio('📁', 'Añade tu primer papel. Con una foto te leo la fecha.')}`;
  document.getElementById('pa-ics').addEventListener('click', () => {
    const ics = crearIcs(eventosPapeles(estado.papeles), { nombre: 'Mis papeles · Cerebro Útil Pau' });
    comparte(new TextEncoder().encode(ics), 'mis-papeles.ics', 'text/calendar', 'Vencimientos de mis papeles');
  });
}

function comprimeFoto(file, max = 1600, calidad = 0.82) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', calidad).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la foto.')); };
    img.src = url;
  });
}

function pintaPapel(id) {
  const nuevo = id === 'nuevo';
  const p = nuevo ? { tipo: 'itv', titulo: '', vence: '', avisoDias: 30, notas: '' } : estado.papeles.find((x) => x.id === id);
  if (!p) { vista.innerHTML = vacio('🤷', 'No encuentro ese papel.') + '<a class="btn ancho" href="#papeles">Volver</a>'; return; }
  const siguiente = nuevo ? '' : siguienteVencimiento(p);
  vista.innerHTML = `
    <a href="#papeles" class="suave">← Mis papeles</a>
    <h1>${nuevo ? '＋ Nuevo papel' : `${tipoPapel(p.tipo).icono} ${h(p.titulo)}`}</h1>
    ${nuevo ? '' : `<p>${chipEstadoPapel(p)}</p>`}
    <div class="tarjeta">
      <strong>📷 Leer con una foto</strong>
      <p class="suave peq">Haz una foto al documento y Clara te rellena el tipo y la fecha. Revísalo siempre antes de guardar.</p>
      <label class="btn ancho" for="pa-foto" style="margin:8px 0 0">Hacer o elegir foto</label>
      <input id="pa-foto" type="file" accept="image/*" capture="environment" class="oculto" />
      <div id="pa-lectura"></div>
    </div>
    <form id="form-papel" novalidate>
      <label for="pa-tipo">Tipo</label>
      <select id="pa-tipo">${TIPOS_PAPEL.map((t) => opcion(t.id, `${t.icono} ${t.nombre}`, p.tipo)).join('')}</select>
      <label for="pa-titulo">Nombre</label><input id="pa-titulo" type="text" value="${h(p.titulo)}" placeholder="Ej.: ITV del León 1234ABC" />
      <div class="dos"><div><label for="pa-vence">Vence el</label><input id="pa-vence" type="date" value="${h(p.vence)}" /></div>
        <div><label for="pa-aviso">Avisar (días antes)</label><input id="pa-aviso" type="number" min="0" max="365" value="${h(p.avisoDias)}" /></div></div>
      <label for="pa-notas">Notas <span class="opc">(compañía, nº de póliza…)</span></label><textarea id="pa-notas">${h(p.notas)}</textarea>
      <div id="pa-errores"></div>
      <button class="btn principal ancho" type="submit" style="margin-top:14px">Guardar</button>
    </form>
    ${siguiente ? `<button class="btn dorado ancho" id="pa-renovado" style="margin-top:10px">🔄 Ya lo he renovado (pasar al ${h(fechaCorta(siguiente))})</button>` : ''}
    ${nuevo ? '' : '<button class="btn peligro ancho" id="pa-borrar" style="margin-top:18px">Borrar</button>'}`;

  document.getElementById('pa-tipo').addEventListener('change', (e) => {
    if (nuevo) document.getElementById('pa-aviso').value = tipoPapel(e.target.value).aviso;
  });
  let guardandoPapel = false;
  document.getElementById('form-papel').addEventListener('submit', (e) => {
    e.preventDefault();
    if (guardandoPapel) return;
    const v = validaPapel({
      id: nuevo ? nuevoId('pa') : id,
      tipo: document.getElementById('pa-tipo').value, titulo: document.getElementById('pa-titulo').value,
      vence: document.getElementById('pa-vence').value, avisoDias: document.getElementById('pa-aviso').value,
      notas: document.getElementById('pa-notas').value,
    });
    if (!v.ok) { document.getElementById('pa-errores').innerHTML = `<div class="aviso mal" role="alert">${v.errores.map(h).join('<br>')}</div>`; return; }
    guardandoPapel = true;
    if (nuevo) estado.papeles.push(v.papel);
    else estado.papeles = estado.papeles.map((x) => (x.id === id ? v.papel : x));
    if (!guardar()) { guardandoPapel = false; return; }
    aviso('✅ Guardado. Pulsa "Avisos al calendario" para que el móvil te avise.');
    ir('papeles');
  });
  document.getElementById('pa-renovado')?.addEventListener('click', () => {
    estado.papeles = estado.papeles.map((x) => (x.id === id ? { ...x, vence: siguiente } : x));
    guardar();
    aviso('🔄 Actualizado. Recuerda volver a pasar los avisos al calendario.');
    pintaPapel(id);
  });
  document.getElementById('pa-borrar')?.addEventListener('click', () => {
    if (!confirm('¿Borrar este papel?')) return;
    estado.papeles = estado.papeles.filter((x) => x.id !== id);
    guardar();
    ir('papeles');
  });
  document.getElementById('pa-foto').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const caja = document.getElementById('pa-lectura');
    caja.innerHTML = '<p class="suave">⏳ Leyendo el documento…</p>';
    try {
      const data = await comprimeFoto(file);
      const r = await fetch('/api/cerebro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'leer-documento', imagen: { media_type: 'image/jpeg', data }, clave: estado.ajustes.claveSync }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || `El servidor respondió ${r.status}.`);
      const l = j.lectura;
      if (!l.legible) { caja.innerHTML = '<div class="aviso">No se lee bien. Prueba con más luz y el documento entero en la foto.</div>'; return; }
      document.getElementById('pa-tipo').value = l.tipo;
      if (l.titulo) document.getElementById('pa-titulo').value = l.titulo;
      if (l.vence) document.getElementById('pa-vence').value = l.vence;
      if (l.notas) document.getElementById('pa-notas').value = l.notas;
      if (nuevo) document.getElementById('pa-aviso').value = tipoPapel(l.tipo).aviso;
      caja.innerHTML = `<div class="aviso ok">He rellenado lo que he leído. <strong>Revísalo</strong> antes de guardar.
        ${l.vence ? '' : '<br>No he encontrado la fecha de vencimiento escrita: ponla tú.'}
        ${l.otras_fechas.length ? `<br><span class="peq">Otras fechas: ${l.otras_fechas.map((f) => `${h(f.que)} ${h(fechaCorta(f.fecha))}`).join(' · ')}</span>` : ''}</div>`;
    } catch (err) {
      caja.innerHTML = `<div class="aviso mal">${h(err.message || 'No se pudo leer la foto.')} Puedes apuntarlo a mano.</div>`;
    }
  });
}

/* ─────────────────────────────── AJUSTES ─────────────────────────────── */

function pintaAjustes() {
  const aj = estado.ajustes;
  const campo = (clave, etiqueta, tipo = 'text') =>
    `<label for="aj-${clave}">${etiqueta}</label><input id="aj-${clave}" data-aj="${clave}" type="${tipo}" value="${h(aj[clave])}" />`;
  vista.innerHTML = `
    <h1>⚙️ Ajustes</h1>
    <h2>Tus datos (salen en los PDF)</h2>
    ${campo('agente', 'Tu nombre')}${campo('empresa', 'Empresa')}${campo('ciudad', 'Ciudad')}
    <div class="dos"><div>${campo('telefono', 'Teléfono', 'tel')}</div><div>${campo('whatsapp', 'WhatsApp', 'tel')}</div></div>
    ${campo('email', 'Correo', 'email')}${campo('web', 'Web')}

    <h2>Textos legales de la hoja de visita</h2>
    <div class="aviso ${aj.textosRevisados ? 'ok' : ''}">${aj.textosRevisados
      ? 'Marcados como revisados por un profesional. Si los cambias, vuelve a revisarlos.'
      : 'Son un <strong>borrador</strong> preparado por NURIA con el contenido mínimo del RGPD (art. 13). Completa lo que va entre [corchetes] (razón social, NIF, dirección, correo) y revísalos con tu gestor o abogado.'}</div>
    <label for="aj-decl">Declaración que firma el visitante</label>
    <textarea id="aj-decl" data-aj="textoDeclaracion" style="min-height:120px">${h(aj.textoDeclaracion)}</textarea>
    <p class="suave peq">Puedes usar {visitante}, {dni}, {inmueble}, {fecha}, {hora}, {agente} y {empresa}.</p>
    <label for="aj-rgpd">Información de protección de datos</label>
    <textarea id="aj-rgpd" data-aj="textoRgpd" style="min-height:180px">${h(aj.textoRgpd)}</textarea>
    <label class="check"><input id="aj-revisados" type="checkbox" ${aj.textosRevisados ? 'checked' : ''} /> <span>Un profesional (gestor o abogado) ha revisado estos textos.</span></label>
    <button class="btn" id="aj-borrador">Volver al borrador original</button>

    <h2>Leer documentos con foto</h2>
    <label for="aj-clave">Clave de sincronización <span class="opc">(la misma de la 🧠 de Clara)</span></label>
    <input id="aj-clave" data-aj="claveSync" type="password" autocomplete="off" value="${h(aj.claveSync)}" />
    <p class="suave peq">Solo se usa para que nadie más pueda gastar tu saldo de IA. Se queda en este móvil.</p>

    <h2>Copia de seguridad</h2>
    <p class="suave peq">Todo vive en este dispositivo (${tamanoKb(estado)} KB usados). Guarda una copia de vez en cuando y ábrela en otro móvil o PC para pasar los datos.</p>
    <div class="botones">
      <button class="btn principal" id="aj-copia">💾 Guardar copia</button>
      <label class="btn" for="aj-abrir" style="margin:0">📂 Abrir una copia</label>
      <input id="aj-abrir" type="file" accept="application/json,.json" class="oculto" />
    </div>
    <button class="btn peligro ancho" id="aj-borrar-todo" style="margin-top:22px">Borrar todos los datos de este dispositivo</button>
    <p class="suave peq" style="margin-top:18px">Cerebro Útil Pau · hecho por Clara con NURIA, IYAN y NICER.</p>`;

  let t;
  vista.querySelectorAll('[data-aj]').forEach((el) => el.addEventListener('input', () => {
    estado.ajustes[el.dataset.aj] = el.value.slice(0, 4000);
    if (['textoDeclaracion', 'textoRgpd'].includes(el.dataset.aj) && estado.ajustes.textosRevisados) {
      estado.ajustes.textosRevisados = false;
      document.getElementById('aj-revisados').checked = false;
    }
    clearTimeout(t);
    t = setTimeout(guardar, 400);
  }));
  document.getElementById('aj-revisados').addEventListener('change', (e) => {
    if (e.target.checked && /\[[^\]]+\]/.test(estado.ajustes.textoRgpd + estado.ajustes.textoDeclaracion)) {
      e.target.checked = false;
      aviso('Aún quedan datos entre [corchetes] por completar en los textos.', 5000);
      return;
    }
    estado.ajustes.textosRevisados = e.target.checked;
    guardar();
    pintaAjustes();
  });
  document.getElementById('aj-borrador').addEventListener('click', () => {
    if (!confirm('¿Sustituir los textos por el borrador original?')) return;
    Object.assign(estado.ajustes, { textoDeclaracion: HOJA_VISITA_BORRADOR.declaracion, textoRgpd: HOJA_VISITA_BORRADOR.rgpd, textosRevisados: false });
    guardar();
    pintaAjustes();
  });
  document.getElementById('aj-copia').addEventListener('click', () => {
    const copia = { ...estado, ajustes: { ...estado.ajustes, claveSync: '' } };
    comparte(new TextEncoder().encode(copiaSeguridad(copia)), `cerebro-copia-${aISO()}.json`, 'application/json', 'Copia de Cerebro Útil Pau');
  });
  document.getElementById('aj-abrir').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = leeCopia(await file.text());
    if (!r.ok) { aviso(r.error, 5000); return; }
    if (!confirm(`Esta copia trae ${r.resumen}. ¿Sustituir lo que hay en este dispositivo?`)) return;
    const clave = estado.ajustes.claveSync;
    estado = r.estado;
    estado.ajustes.claveSync = clave; // la clave es de este dispositivo, nunca la de la copia
    guardar();
    aviso('✅ Copia abierta.');
    pintaAjustes();
  });
  document.getElementById('aj-borrar-todo').addEventListener('click', () => {
    if (!confirm('¿Borrar TODAS las visitas, operaciones, valoraciones y papeles de este dispositivo?')) return;
    if (!confirm('Última confirmación: esto no se puede deshacer. ¿Tienes una copia guardada?')) return;
    estado = estadoVacio();
    estado.ajustes.textoDeclaracion = HOJA_VISITA_BORRADOR.declaracion;
    estado.ajustes.textoRgpd = HOJA_VISITA_BORRADOR.rgpd;
    guardar();
    ir('hoy');
  });
}

/* ─────────────────────────────── arranque ─────────────────────────────── */

document.querySelectorAll('.pestanas button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));
document.getElementById('btn-ajustes').addEventListener('click', () => ir('ajustes'));
window.addEventListener('hashchange', pinta);
const pedida = new URLSearchParams(location.search).get('vista');
if (pedida && !location.hash) location.hash = pedida;
else pinta();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
// Pide que el navegador no borre los datos por falta de espacio.
navigator.storage?.persist?.().catch(() => {});
