/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — pantallas (HTML como texto)
   Funciones puras: reciben datos y devuelven HTML. TODO lo que viene de
   fuera pasa por esc(). Sin estilos ni scripts en línea (la CSP lo
   prohíbe): los eventos los engancha app.js.
   ═══════════════════════════════════════════════════════════════════ */

import { escapaHtml as esc } from '../cerebro/utiles.js';
import { CAMPOS_INMUEBLE, CAMPOS_PISO, GRUPOS_PISO, textoCampo } from '../cerebro/campos-piso.js';
import { CAMPOS_MARCA, AVISO_SUPRESION, GRUPOS_TEXTOS, tieneCorchetes } from '../nucleo/marca.js';
import { CAMPOS_CAPTACION, OBLIGATORIOS_CAPTACION, TIPOS, enMadrid, resumenHoja, textoEnvio, enlaceWhatsapp, enlaceCorreo } from '../nucleo/hoja.js';

export { esc };

const marcaObligatorio = (o) => (o ? ' <span class="obligatorio" aria-hidden="true">*</span>' : ' <span class="opcional">(opcional)</span>');

export function campo({ id, etiqueta, tipo = 'text', valor = '', obligatorio = false, max = 200, ayuda = '', extra = '' }) {
  return `<div class="campo">
  <label for="${id}">${esc(etiqueta)}${marcaObligatorio(obligatorio)}</label>
  <input id="${id}" name="${id}" type="${tipo}" value="${esc(valor)}" maxlength="${max}"${obligatorio ? ' required' : ''}${ayuda ? ` aria-describedby="${id}-ayuda"` : ''} ${extra}>
  ${ayuda ? `<p class="ayuda" id="${id}-ayuda">${esc(ayuda)}</p>` : ''}
</div>`;
}

export function area({ id, etiqueta, valor = '', obligatorio = false, max = 600, filas = 3, ayuda = '' }) {
  return `<div class="campo">
  <label for="${id}">${esc(etiqueta)}${marcaObligatorio(obligatorio)}</label>
  <textarea id="${id}" name="${id}" rows="${filas}" maxlength="${max}"${obligatorio ? ' required' : ''}${ayuda ? ` aria-describedby="${id}-ayuda"` : ''}>${esc(valor)}</textarea>
  ${ayuda ? `<p class="ayuda" id="${id}-ayuda">${esc(ayuda)}</p>` : ''}
</div>`;
}

export function desplegable({ id, etiqueta, opciones, valor = '', obligatorio = false, vacia = 'Elige…' }) {
  const ops = opciones.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(valor) ? ' selected' : ''}>${esc(o.t)}</option>`).join('');
  return `<div class="campo">
  <label for="${id}">${esc(etiqueta)}${marcaObligatorio(obligatorio)}</label>
  <select id="${id}" name="${id}"${obligatorio ? ' required' : ''}><option value="">${esc(vacia)}</option>${ops}</select>
</div>`;
}

/* La etiqueta ENVUELVE la casilla: toda la fila (≥ 44 px de alto) se puede
   tocar, no solo el cuadradito. */
export function casilla({ id, etiqueta, marcada = false, obligatorio = false }) {
  return `<div class="casilla">
  <label for="${id}"><input id="${id}" name="${id}" type="checkbox"${marcada ? ' checked' : ''}${obligatorio ? ' required' : ''}><span>${esc(etiqueta)}${obligatorio ? marcaObligatorio(true) : ''}</span></label>
</div>`;
}

/* El código SHA-256 explicado para quien no es informático. */
export function huella(hash) {
  return `<p class="huella"><span>Código de comprobación (SHA-256): sirve para demostrar que la hoja no ha cambiado.</span><br><code>${esc(hash)}</code></p>`;
}

/** Un campo de campos-piso.js con su control adecuado. Prefijo: 'p-' (visita) o 'c-' (captación). */
export function campoPiso(c, prefijo, valor = '', obligatorio = false) {
  const id = `${prefijo}${c.id}`;
  const etiqueta = c.unidad ? `${c.etiqueta} (${c.unidad})` : c.etiqueta;
  if (c.tipo === 'opciones') return desplegable({ id, etiqueta, opciones: c.opciones.map((o) => ({ v: o, t: o })), valor, obligatorio });
  if (c.tipo === 'sino') return desplegable({ id, etiqueta, opciones: [{ v: 'Sí', t: 'Sí' }, { v: 'No', t: 'No' }], valor, obligatorio, vacia: 'Sin indicar' });
  if (c.tipo === 'fecha') return campo({ id, etiqueta, tipo: 'date', valor, obligatorio, max: 10 });
  if (c.tipo === 'numero') return campo({ id, etiqueta, valor, obligatorio, max: 15, extra: 'inputmode="decimal"' });
  const extra = c.id === 'propTelefono' ? 'inputmode="tel" autocomplete="off"' : c.id === 'propEmail' ? 'inputmode="email" autocomplete="off"' : 'autocomplete="off"';
  return campo({ id, etiqueta, tipo: c.id === 'propTelefono' ? 'tel' : c.id === 'propEmail' ? 'email' : 'text', valor, obligatorio, max: c.max || 200, extra });
}

export function avisoBorrador(revisados) {
  return revisados ? '' : '<p class="aviso-borrador" role="note"><strong>BORRADOR:</strong> los textos legales de esta hoja aún no los ha revisado un profesional (gestor o abogado). Se pueden revisar en Ajustes.</p>';
}

export function bloqueFirma(id, etiqueta) {
  return `<div class="firma" id="bloque-firma-${id}">
  <p class="etiqueta-firma" id="etq-firma-${id}">${esc(etiqueta)}${marcaObligatorio(true)}</p>
  <canvas class="lienzo" id="firma-${id}" role="img" aria-labelledby="etq-firma-${id}" aria-describedby="ayuda-firma"></canvas>
  <div class="fila-botones">
    <button type="button" class="boton" data-borrar-firma="${id}">Borrar firma</button>
    <span class="estado-firma" id="estado-firma-${id}">Sin firmar</span>
  </div>
</div>`;
}

const erroresCaja = '<div id="errores" class="errores" tabindex="-1" role="alert" hidden></div>';

/* ── Entrar ──────────────────────────────────────────────────────────── */
export function vistaEntrar({ nombreApp = '', apagada = '' } = {}) {
  if (apagada) return `<section class="tarjeta"><h1>App apagada</h1><p>${esc(apagada)}</p></section>`;
  return `<section class="tarjeta entrar">
  <h1>Entrar</h1>
  <p>Hojas de visita y de captación firmadas con el dedo${nombreApp ? ` · ${esc(nombreApp)}` : ''}.</p>
  <form id="form-entrar" novalidate>
    ${campo({ id: 'usuario', etiqueta: 'Usuario', max: 30, ayuda: 'Si eres el titular, déjalo vacío.', extra: 'autocomplete="username" autocapitalize="none" spellcheck="false"' })}
    ${campo({ id: 'clave', etiqueta: 'Clave', tipo: 'password', obligatorio: true, max: 200, extra: 'autocomplete="current-password"' })}
    <p id="error-entrar" class="error" role="alert"></p>
    <button class="boton principal ancho" type="submit">Entrar</button>
  </form>
</section>`;
}

/* ── Inicio ──────────────────────────────────────────────────────────── */
export function vistaInicio({ agente, avisos = [], sinSesion = false }) {
  return `<h1>Hola, ${esc(agente.nombre)}</h1>
${sinSesion ? '<p class="aviso-borrador" role="note">Tu sesión ha caducado. Puedes seguir firmando sin conexión; para subir las hojas, <a href="#entrar">vuelve a entrar</a>.</p>' : ''}
<div class="acciones-grandes">
  <a class="boton principal grande" href="#visita">Nueva hoja de visita</a>
  <a class="boton principal grande" href="#captacion">Nueva hoja de captación</a>
  <a class="boton grande" href="#hojas">Hojas firmadas</a>
</div>
${avisos.length ? `<section class="tarjeta avisos"><h2>Por revisar</h2><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p><a class="enlace-tactil" href="#ajustes">Ir a Ajustes</a></p></section>` : ''}`;
}

/* ── Hoja de visita ──────────────────────────────────────────────────── */
export function formVisita({ cfg, agente, hoy, hora }) {
  const restoPiso = CAMPOS_INMUEBLE.filter((c) => !['referencia', 'direccion'].includes(c.id));
  const t = cfg.textos;
  return `<h1>Hoja de visita</h1>
${avisoBorrador(t.visitaRevisados)}
<form id="form-hoja" data-tipo="visita" novalidate>
${erroresCaja}
<p class="ayuda"><span aria-hidden="true">*</span> obligatorio</p>
<fieldset><legend>Visitante</legend>
  ${campo({ id: 'v-nombre', etiqueta: 'Nombre y apellidos', obligatorio: true, max: 80, extra: 'autocomplete="off"' })}
  ${campo({ id: 'v-dni', etiqueta: 'DNI / NIE', max: 20, extra: 'autocomplete="off" autocapitalize="characters"' })}
  ${campo({ id: 'v-telefono', etiqueta: 'Teléfono', tipo: 'tel', obligatorio: true, max: 20, extra: 'inputmode="tel" autocomplete="off"' })}
  ${campo({ id: 'v-email', etiqueta: 'Correo', tipo: 'email', max: 80, extra: 'inputmode="email" autocomplete="off"' })}
</fieldset>
<fieldset><legend>Inmueble</legend>
  <p class="ayuda">Referencia o dirección: al menos una de las dos.</p>
  ${campoPiso(CAMPOS_PISO.find((c) => c.id === 'referencia'), 'p-')}
  ${campoPiso(CAMPOS_PISO.find((c) => c.id === 'direccion'), 'p-')}
  <details class="mas"><summary>Más datos del piso (opcional)</summary>
    <div class="rejilla">${restoPiso.map((c) => campoPiso(c, 'p-')).join('')}</div>
  </details>
</fieldset>
<fieldset><legend>Visita</legend>
  <div class="rejilla">
  ${campo({ id: 'v-fecha', etiqueta: 'Fecha', tipo: 'date', valor: hoy, obligatorio: true, max: 10 })}
  ${campo({ id: 'v-hora', etiqueta: 'Hora', tipo: 'time', valor: hora, obligatorio: true, max: 5 })}
  </div>
  ${campo({ id: 'v-acompanantes', etiqueta: 'Acompañantes', max: 120 })}
  ${area({ id: 'v-observaciones', etiqueta: 'Observaciones', max: 600 })}
</fieldset>
<section class="legal" aria-labelledby="t-legal"><h2 id="t-legal">Lo que firma el visitante</h2>
  <p id="texto-declaracion" class="texto-legal">${esc(t.declaracion)}</p>
  <details><summary>Información de protección de datos</summary><p class="texto-legal">${esc(t.rgpdVisita)}</p></details>
  ${casilla({ id: 'v-rgpd', etiqueta: 'El visitante declara haber leído la información sobre protección de datos.', obligatorio: true })}
  ${casilla({ id: 'v-ofertas', etiqueta: 'Acepta recibir información de otros inmuebles.' })}
</section>
<section class="firmas" aria-labelledby="t-firmas"><h2 id="t-firmas">Firmas</h2>
  <p class="ayuda" id="ayuda-firma">Firma con el dedo dentro del recuadro. Si sale mal, pulsa «Borrar firma».</p>
  ${bloqueFirma('cliente', 'Firma del visitante')}
  ${bloqueFirma('agente', `Firma del agente (${agente.nombre})`)}
</section>
<button type="submit" class="boton principal grande ancho">Firmar y guardar</button>
</form>`;
}

/* ── Hoja de captación ───────────────────────────────────────────────── */
export function formCaptacion({ cfg, agente }) {
  const t = cfg.textos;
  const deGrupo = (g) => CAMPOS_CAPTACION.filter((c) => c.grupo === g && !['fechaCaptacion', 'comercializarYa'].includes(c.id));
  const campos = (g) => deGrupo(g).map((c) => campoPiso(c, 'c-', '', OBLIGATORIOS_CAPTACION.includes(c.id))).join('');
  const comercializar = CAMPOS_PISO.find((c) => c.id === 'comercializarYa');
  const extras = GRUPOS_PISO.filter((g) => ['caracteristicas', 'equipamiento', 'costes'].includes(g.id));
  return `<h1>Hoja de captación</h1>
${avisoBorrador(t.captacionRevisados)}
<form id="form-hoja" data-tipo="captacion" novalidate>
${erroresCaja}
<p class="ayuda"><span aria-hidden="true">*</span> obligatorio</p>
<fieldset><legend>Propietario</legend>${campos('propietario')}</fieldset>
<fieldset><legend>El inmueble</legend>
  <p class="ayuda">Referencia o dirección: al menos una de las dos.</p>
  <div class="rejilla">${campos('inmueble')}</div>
  ${extras.map((g) => `<details class="mas"><summary>${esc(g.titulo)} (opcional)</summary><div class="rejilla">${campos(g.id)}</div></details>`).join('')}
</fieldset>
<fieldset><legend>Condiciones del encargo</legend>
  <p class="ayuda">Escribe las condiciones tal como se acuerden: la app no pone ningún valor por su cuenta.</p>
  ${campos('encargo')}
  <div id="caja-desistimiento" class="desistimiento" hidden>
    <h3>Firmado fuera de la oficina: derecho de desistimiento</h3>
    <p class="texto-legal" id="texto-desistimiento">${esc(t.desistimiento)}</p>
    ${campoPiso(comercializar, 'c-')}
  </div>
  ${area({ id: 'c-notas', etiqueta: 'Observaciones', max: 2000 })}
</fieldset>
<section class="legal" aria-labelledby="t-legal"><h2 id="t-legal">Lo que firma el propietario</h2>
  <p id="texto-conformidad" class="texto-legal">${esc(t.conformidad)}</p>
  <details><summary>Información de protección de datos</summary><p class="texto-legal">${esc(t.rgpdCaptacion)}</p></details>
</section>
<section class="firmas" aria-labelledby="t-firmas"><h2 id="t-firmas">Firmas</h2>
  <p class="ayuda" id="ayuda-firma">Firma con el dedo dentro del recuadro. Si sale mal, pulsa «Borrar firma».</p>
  ${bloqueFirma('cliente', 'Firma del propietario')}
  ${bloqueFirma('agente', `Firma del agente (${agente.nombre})`)}
</section>
<button type="submit" class="boton principal grande ancho">Firmar y guardar</button>
</form>`;
}

/* ── Enviar ──────────────────────────────────────────────────────────── */
export function accionesEnvio(hoja, marca) {
  const r = resumenHoja(hoja);
  const mensaje = textoEnvio(hoja, marca);
  const asunto = `${TIPOS[hoja.tipo]} firmada${r.referencia ? ` · ${r.referencia}` : ''} · ${marca?.nombreComercial || hoja.marca.nombreComercial}`;
  return `<div class="acciones-envio">
  <button type="button" class="boton principal" data-accion="compartir">Compartir PDF</button>
  <button type="button" class="boton" data-accion="descargar">Descargar PDF</button>
  <a class="boton" href="${esc(enlaceWhatsapp(r.telefono, mensaje))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
  <a class="boton" href="${esc(enlaceCorreo(r.email, asunto, mensaje))}">Correo</a>
</div>
<p class="ayuda">WhatsApp y el correo se abren con el texto preparado: el PDF lo adjuntas tú (con «Compartir PDF» se elige la app directamente). Al cliente no se le envía nada solo.</p>`;
}

export function vistaFirmada({ hoja, registro, marca }) {
  const pendiente = !registro.recibida;
  const r = enMadrid(registro.recibida);
  return `<section class="tarjeta hecha">
  <h1>Hoja firmada</h1>
  <p class="estado-subida ${pendiente ? 'pendiente' : 'subida'}" id="estado-subida">${pendiente
    ? 'Guardada en este móvil. <strong>Pendiente de subir</strong>: se subirá sola cuando haya conexión.'
    : `Guardada en la nube el ${esc(r.fecha)} a las ${esc(r.hora)}.`}</p>
  ${huella(registro.hash)}
  ${accionesEnvio(hoja, marca)}
  <div class="fila-botones">
    <a class="boton" href="#${hoja.tipo}">Otra hoja de ${hoja.tipo === 'visita' ? 'visita' : 'captación'}</a>
    <a class="boton" href="#inicio">Inicio</a>
  </div>
</section>`;
}

/* ── Lista de hojas ──────────────────────────────────────────────────── */
export function vistaHojas({ filtros = {}, filas = null, total = 0, pendientes = [], otrasPendientes = 0, error = '', titular = false, soloSuyas = false }) {
  const f = filtros;
  const tipos = [{ v: 'visita', t: 'Hojas de visita' }, { v: 'captacion', t: 'Hojas de captación' }];
  // De las hojas pendientes de OTRO usuario de este móvil solo se dice cuántas hay.
  const otras = otrasPendientes ? `<p class="aviso-borrador" role="note">${otrasPendientes} hoja${otrasPendientes === 1 ? '' : 's'} pendiente${otrasPendientes === 1 ? '' : 's'} de otro usuario en este móvil. ${titular ? 'Se suben con tu sesión.' : 'Se suben cuando entre él.'}</p>` : '';
  const pend = otras + (pendientes.length ? `<section class="tarjeta pendientes-lista" aria-labelledby="t-pend"><h2 id="t-pend">En este móvil, sin subir (${pendientes.length})</h2><ul class="lista-hojas">${pendientes.map((p) => {
    const r = resumenHoja(p.hoja);
    const fm = enMadrid(p.hoja.firmadaEn);
    return `<li><a class="hoja-fila" href="#local/${esc(p.id)}"><span class="etiqueta ${p.estado === 'error' ? 'mal' : 'espera'}">${p.estado === 'error' ? 'Error al subir' : 'Pendiente'}</span><strong>${esc(r.nombre)}</strong><span>${esc(TIPOS[p.hoja.tipo])} · ${esc(r.referencia || r.inmueble)}</span><span class="suave">${esc(fm.fecha)} ${esc(fm.hora)}</span>${p.mensaje ? `<span class="error">${esc(p.mensaje)}</span>` : ''}</a></li>`;
  }).join('')}</ul></section>` : '');
  const lista = filas === null ? '' : filas.length === 0 ? '<p>No hay hojas con esos filtros.</p>' : `<p class="suave">${filas.length === 200 ? 'Las 200 más recientes' : `${filas.length} hoja${filas.length === 1 ? '' : 's'}`} de ${total} en total.</p>
<ul class="lista-hojas">${filas.map((h) => {
    const fm = enMadrid(h.firmada);
    return `<li><a class="hoja-fila" href="#hoja/${esc(h.id)}"><span class="etiqueta ${h.estado === 'anulada' ? 'mal' : 'bien'}">${h.estado === 'anulada' ? 'Anulada' : 'Firmada'}</span><strong>${esc(h.nombre)}</strong><span>${esc(TIPOS[h.tipo] || h.tipo)} · ${esc(h.referencia || h.inmueble)}</span><span class="suave">${esc(fm.fecha)} ${esc(fm.hora)} · ${esc(h.agente)}</span></a></li>`;
  }).join('')}</ul>`;
  return `<h1>Hojas firmadas</h1>
${soloSuyas ? '<p class="suave">Ves solo las hojas que has firmado tú.</p>' : ''}
${pend}
<form id="form-filtros" class="tarjeta filtros" role="search">
  <h2>Buscar</h2>
  <div class="rejilla">
  ${desplegable({ id: 'f-tipo', etiqueta: 'Tipo', opciones: tipos, valor: f.tipo || '', vacia: 'Todas' })}
  ${campo({ id: 'f-ref', etiqueta: 'Referencia', valor: f.ref || '', max: 40 })}
  ${campo({ id: 'f-nombre', etiqueta: 'Nombre', valor: f.nombre || '', max: 60 })}
  ${campo({ id: 'f-desde', etiqueta: 'Desde el día', tipo: 'date', valor: f.desde || '', max: 10 })}
  ${campo({ id: 'f-hasta', etiqueta: 'Hasta el día', tipo: 'date', valor: f.hasta || '', max: 10 })}
  </div>
  <div class="fila-botones"><button class="boton principal" type="submit">Buscar</button><button class="boton" type="button" id="f-limpiar">Quitar filtros</button></div>
</form>
${titular ? '<p><a class="boton" href="/api/exportar" download>Descargar todo en Excel (CSV)</a></p>' : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<div id="resultados">${lista}</div>`;
}

/* ── Detalle ─────────────────────────────────────────────────────────── */
export function vistaDetalle({ hoja, registro, titular = false, local = false, marca }) {
  const r = resumenHoja(hoja);
  const fm = enMadrid(hoja.firmadaEn);
  const rec = enMadrid(registro.recibida);
  const filas = [
    ['Tipo', TIPOS[hoja.tipo]],
    ['Estado', local ? 'Pendiente de subir (solo en este móvil)' : registro.estado === 'anulada' ? 'ANULADA' : 'Firmada'],
    ['Firmada en el móvil', `${fm.fecha} ${fm.hora}`],
    ['Registrada en la nube', registro.recibida ? `${rec.fecha} ${rec.hora}` : 'Todavía no'],
    ['Agente', hoja.agente.nombre],
    [hoja.tipo === 'captacion' ? 'Propietario' : 'Visitante', r.nombre],
    ['DNI / NIE', r.dni],
    ['Teléfono', r.telefono],
    ['Correo', r.email],
    ['Inmueble', r.inmueble],
    hoja.tipo === 'visita' ? ['Visita', `${hoja.datos.fecha.split('-').reverse().join('/')} ${hoja.datos.hora}`] : ['Encargo', [hoja.datos.piso.tipoEncargo, hoja.datos.piso.honorarios, hoja.datos.piso.duracion].filter(Boolean).join(' · ')],
  ];
  if (!local && typeof registro.textosAlDia === 'boolean') {
    filas.push(
      ['Textos legales', registro.textosAlDia ? 'Los mismos que había en Ajustes al subirla' : 'DISTINTOS de los que había en Ajustes al subirla (se firmó con otra versión)'],
      ['Marca', registro.marcaAlDia ? 'La misma que había en Ajustes al subirla' : 'DISTINTA de la que había en Ajustes al subirla (se firmó con otra versión)'],
    );
  }
  if (registro.estado === 'anulada') {
    const a = enMadrid(registro.anulada);
    filas.push(['Anulada', `${a.fecha} ${a.hora} por ${registro.anuladaPor || ''}`], ['Motivo', registro.motivo]);
  }
  const distinta = !local && (registro.textosAlDia === false || registro.marcaAlDia === false)
    ? `<p class="aviso-borrador" role="note"><strong>Ojo:</strong> esta hoja se firmó con ${[registro.textosAlDia === false && 'unos textos legales', registro.marcaAlDia === false && 'una marca'].filter(Boolean).join(' y ')} distint${registro.textosAlDia === false ? 'os' : 'a'} de los de Ajustes cuando se subió (por ejemplo, firmada sin conexión antes de un cambio). El PDF enseña lo que se firmó de verdad.</p>`
    : '';
  const anular = titular && !local && registro.estado !== 'anulada' ? `<section class="tarjeta" aria-labelledby="t-anular"><h2 id="t-anular">Anular</h2>
  <p>Una hoja firmada no se puede cambiar. Si hay un error, se anula con un motivo y se firma otra. La hoja anulada se conserva y queda constancia.</p>
  <form id="form-anular" novalidate>${area({ id: 'motivo', etiqueta: 'Motivo de la anulación', obligatorio: true, max: 300, filas: 2 })}
  <button class="boton peligro" type="submit">Anular esta hoja</button></form></section>` : '';
  const borrar = titular && !local ? `<section class="tarjeta" aria-labelledby="t-borrar"><h2 id="t-borrar">Borrar datos (derecho de supresión)</h2>
  <p class="aviso-borrador" role="note">${esc(AVISO_SUPRESION)}</p>
  <form id="form-borrar" novalidate>${campo({ id: 'confirmacion', etiqueta: 'Para confirmar, escribe BORRAR', obligatorio: true, max: 10, extra: 'autocomplete="off" autocapitalize="characters"' })}
  <button class="boton peligro" type="submit">Borrar datos de esta hoja</button></form></section>` : '';
  return `<p><a class="enlace-tactil" href="#hojas">← Volver a la lista</a></p>
<h1>${esc(TIPOS[hoja.tipo])}</h1>
${registro.estado === 'anulada' ? '<p class="aviso-borrador" role="note"><strong>ANULADA.</strong> Se conserva como constancia; el PDF lo indica al pie.</p>' : ''}
${distinta}
<dl class="datos">${filas.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
${huella(registro.hash)}
${accionesEnvio(hoja, marca)}
${anular}
${borrar}`;
}

/* ── Ajustes ─────────────────────────────────────────────────────────── */
const ETIQUETAS_TEXTOS = {
  declaracion: 'Hoja de visita: declaración que firma el visitante',
  rgpdVisita: 'Hoja de visita: protección de datos',
  conformidad: 'Hoja de captación: conformidad del propietario',
  rgpdCaptacion: 'Hoja de captación: protección de datos',
  desistimiento: 'Hoja de captación: desistimiento (si se firma fuera de la oficina)',
};

export function vistaAjustes({ agente, marca, textos, logo, agentes = [], registro = [], avisos = [], permisos = { agentesSoloSuyas: true } }) {
  const salir = '<section class="tarjeta"><h2>Sesión</h2><p>Si sales, se cierra tu sesión en todos los móviles donde la tengas abierta. Las hojas que estén sin subir siguen en este móvil hasta que vuelvas a entrar.</p><button class="boton" type="button" id="salir">Salir</button></section>';
  if (!agente.titular) {
    return `<h1>Ajustes</h1><p>Has entrado como <strong>${esc(agente.nombre)}</strong>. La marca, los textos legales y los agentes los cambia el titular.</p>${salir}`;
  }
  const marcaForm = `<form id="form-marca" class="tarjeta" novalidate>
  <h2>Marca de la inmobiliaria</h2>
  <p class="ayuda">Esto es lo que cambia de una inmobiliaria a otra. Sale en la app, en el icono y en todos los PDF. Lo que no sepas déjalo como [PENDIENTE: …]; no inventes datos legales.</p>
  ${CAMPOS_MARCA.filter((c) => !c.color).map((c) => campo({ id: `m-${c.id}`, etiqueta: c.etiqueta, valor: marca[c.id], obligatorio: Boolean(c.obligatorio), max: c.max }) + (tieneCorchetes(marca[c.id]) ? '<p class="pendiente-dato">Pendiente de completar.</p>' : '')).join('')}
  <div class="rejilla">
  ${CAMPOS_MARCA.filter((c) => c.color).map((c) => `<div class="campo"><label for="m-${c.id}">${esc(c.etiqueta)}</label><input id="m-${c.id}" name="m-${c.id}" type="color" value="${esc(marca[c.id])}"></div>`).join('')}
  </div>
  <div class="muestra" id="muestra"><span class="muestra-boton" id="muestra-boton">Botón de ejemplo</span><span class="muestra-acento" id="muestra-acento">Acento</span><p id="muestra-contraste" class="ayuda" aria-live="polite"></p></div>
  <button class="boton principal" type="submit">Guardar la marca</button>
  <p class="ok" id="marca-ok" role="status" aria-live="polite"></p>
</form>`;
  const logoTxt = { defecto: 'Logo de serie (Asesoría Castresana).', propio: 'Logo propio.', ninguno: 'Sin logo: los PDF llevan el nombre comercial.' }[logo.modo];
  const logoForm = `<section class="tarjeta" aria-labelledby="t-logo"><h2 id="t-logo">Logo</h2>
  <p>${esc(logoTxt)}</p>
  ${logo.modo !== 'ninguno' ? '<p class="logo-muestra"><img src="/marca/logo.jpg" alt="Logo actual" id="logo-actual"></p>' : ''}
  <div class="campo"><label for="logo-archivo">Subir un logo nuevo (JPG o PNG; la app lo reduce a menos de 200 KB)</label><input id="logo-archivo" type="file" accept="image/jpeg,image/png,image/webp"></div>
  <div class="fila-botones"><button class="boton" type="button" id="logo-quitar">Quitar logo</button><button class="boton" type="button" id="logo-defecto">Volver al logo de serie</button></div>
  <p class="ok" id="logo-ok" role="status" aria-live="polite"></p>
</section>`;
  const grupoTextos = (grupo, titulo) => `<form class="tarjeta form-textos" data-grupo="${grupo}" novalidate>
  <h2>${esc(titulo)}</h2>
  <p class="${textos[`${grupo}Revisados`] ? 'ok' : 'aviso-borrador'}">${textos[`${grupo}Revisados`] ? 'Revisados por un profesional.' : 'BORRADOR: pendientes de revisar con un profesional.'}</p>
  ${GRUPOS_TEXTOS[grupo].map((k) => area({ id: `t-${k}`, etiqueta: ETIQUETAS_TEXTOS[k], valor: textos[k], max: 6000, filas: 6 })).join('')}
  <p class="ayuda">Los {marcadores} se rellenan solos al firmar. Lo que está entre [corchetes] hay que completarlo; mientras quede alguno no se puede marcar como revisado. Si cambias un texto, vuelve a ser BORRADOR.</p>
  <div class="fila-botones">
    <button class="boton principal" type="submit">Guardar textos</button>
    <button class="boton" type="button" data-revisados="${grupo}" data-valor="${textos[`${grupo}Revisados`] ? 'no' : 'si'}">${textos[`${grupo}Revisados`] ? 'Quitar «revisados»' : 'Revisados por un profesional'}</button>
    <button class="boton" type="button" data-borrador="${grupo}">Volver al borrador</button>
  </div>
  <p class="ok" role="status" aria-live="polite"></p>
</form>`;
  const listaAgentes = agentes.length ? `<ul class="lista-simple">${agentes.map((a) => `<li><strong>${esc(a.nombre)}</strong> <span class="suave">usuario: ${esc(a.usuario)}${a.activo ? '' : ' · de baja'}</span>${a.activo ? `<div class="fila-botones"><button class="boton" type="button" data-clave-agente="${a.id}">Cambiar clave</button><button class="boton peligro" type="button" data-baja-agente="${a.id}">Dar de baja</button></div>` : ''}</li>`).join('')}</ul>` : '<p>Solo entras tú (el titular). Puedes añadir agentes con su propia clave.</p>';
  const agentesForm = `<section class="tarjeta" aria-labelledby="t-agentes"><h2 id="t-agentes">Agentes</h2>
  <p class="ayuda">Cada agente entra con su usuario y su clave, y sus hojas dicen quién las firmó. La clave se guarda cifrada (no se puede ver, solo cambiar). Un agente de baja no puede entrar, pero sus hojas se conservan.</p>
  <form id="form-permisos" novalidate>
    <h3>Lo que ven los agentes</h3>
    ${casilla({ id: 'p-soloSuyas', etiqueta: 'Los agentes solo ven sus hojas', marcada: permisos.agentesSoloSuyas !== false })}
    <p class="ayuda">Si lo quitas, cada agente podrá ver (no anular ni borrar) las hojas de todos, con los datos de los clientes.</p>
    <button class="boton" type="submit">Guardar</button>
    <p class="ok" id="permisos-ok" role="status" aria-live="polite"></p>
  </form>
  ${listaAgentes}
  <form id="form-agente" novalidate>
    <h3>Añadir agente</h3>
    ${campo({ id: 'a-nombre', etiqueta: 'Nombre (sale en las hojas)', obligatorio: true, max: 80, extra: 'autocomplete="off"' })}
    ${campo({ id: 'a-usuario', etiqueta: 'Usuario (por ejemplo, ana.garcia)', obligatorio: true, max: 30, extra: 'autocomplete="off" autocapitalize="none" spellcheck="false"' })}
    ${campo({ id: 'a-clave', etiqueta: 'Clave (10 caracteres o más)', tipo: 'password', obligatorio: true, max: 200, extra: 'autocomplete="new-password"' })}
    <button class="boton principal" type="submit">Añadir agente</button>
    <p class="ok" id="agente-ok" role="status" aria-live="polite"></p>
  </form>
</section>`;
  const reg = `<section class="tarjeta" aria-labelledby="t-registro"><h2 id="t-registro">Registro de anulaciones y borrados</h2>
  ${registro.length ? `<ul class="lista-simple">${registro.map((x) => { const e = enMadrid(x.cuando); return `<li>${esc(e.fecha)} ${esc(e.hora)} · ${x.accion === 'borrada' ? 'Borrada (supresión)' : 'Anulada'} · ${esc(TIPOS[x.tipo] || x.tipo)} · ${esc(x.quien)}${x.detalle ? ` · ${esc(x.detalle)}` : ''} <span class="suave">(${esc(x.hoja.slice(0, 8))})</span></li>`; }).join('')}</ul>` : '<p>Nada todavía.</p>'}
</section>`;
  return `<h1>Ajustes</h1>
${avisos.length ? `<section class="tarjeta avisos"><h2>Por revisar</h2><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
${marcaForm}
${logoForm}
${grupoTextos('visita', 'Textos legales de la hoja de visita')}
${grupoTextos('captacion', 'Textos legales de la hoja de captación')}
${agentesForm}
<section class="tarjeta"><h2>Exportar</h2><p><a class="boton" href="/api/exportar" download>Descargar todas las hojas en Excel (CSV)</a></p><p class="ayuda">Sin firmas: nombre, contacto, inmueble, fechas, estado, si los textos y la marca eran los de Ajustes y el código de comprobación de cada hoja.</p></section>
${reg}
${salir}`;
}

/** Texto de un valor de campos-piso para el resumen (re-exportado para app.js). */
export { textoCampo };
