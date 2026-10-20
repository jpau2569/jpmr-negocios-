/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — enviar por WhatsApp
   #enviar            → elegir a quién (clientes, contactos del móvil u
                         otro número), conservando lo que se va a mandar.
   #enviar/<cliente>  → preparar el mensaje: recordatorio de una cita,
                         un piso (solo datos públicos), un vídeo o enlace
                         o un mensaje libre. El texto se puede cambiar.
   Consulta opcional: ?tipo=recordatorio|piso|enlace|libre
                      &evento=<id> &inmueble=<id> &recurso=<id>
   Abrir WhatsApp NO es enviar: el chat se abre con el texto escrito y
   Pau pulsa enviar allí. Solo se apunta en el historial cuando él
   confirma «Ya lo he enviado».
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, ESTADOS_INMUEBLE, esVideo, nombreCliente, nombreInmueble, ordenEvento, TIPOS_EVENTO } from './datos.js';
import { clienteDeContacto, eligeContactosDelMovil, selectorContactosDisponible } from './contactos.js';
import { enlaceWhatsapp, mensajeEnlace, mensajeLibre, mensajePiso, mensajeRecordatorio, resumenEnvio, TIPOS_MENSAJE } from './mensajes.js';
import { cabecera, campo, copia, etiquetaDemo, h, vacio } from './ui.js';
import { aISO, fechaCorta, horaDe, normaliza, telefonoWhatsapp, urlSegura } from './utiles.js';

const CONSULTA = ['tipo', 'evento', 'inmueble', 'recurso'];
const consultaDe = (query) => {
  const q = new URLSearchParams();
  for (const k of CONSULTA) if (query.get(k)) q.set(k, query.get(k));
  const s = q.toString();
  return s ? '?' + s : '';
};

/* ───────────── qué se puede mandar ───────────── */

function citasDe(estado, c, hoy, extra) {
  const lista = activos(estado.eventos).filter((e) => e.cliente === c.id && e.fecha >= hoy && e.estadoVisita !== 'cancelada');
  if (extra && !lista.includes(extra)) lista.push(extra);
  return lista.sort((a, b) => ordenEvento(a).localeCompare(ordenEvento(b)));
}

function pisosPara(estado, c) {
  const peso = (i) => (c.inmuebles.includes(i.id) ? 0 : ['disponible', 'captacion'].includes(i.estadoComercial) ? 1 : 2);
  return activos(estado.inmuebles).sort((a, b) => peso(a) - peso(b) || nombreInmueble(a).localeCompare(nombreInmueble(b), 'es'));
}

/** Vídeos y enlaces: los del cliente primero, luego los vídeos de sus pisos y el resto de la biblioteca. */
function enlacesPara(estado, c) {
  const lista = [];
  const recursos = activos(estado.recursos).filter((r) => r.url);
  const peso = (r) => (r.cliente === c.id ? 0 : r.tipo === 'video' ? 1 : 2);
  for (const r of recursos.sort((a, b) => peso(a) - peso(b))) {
    lista.push({ valor: 'r:' + r.id, nombre: `${r.tipo === 'video' ? '🎬' : '🔗'} ${r.titulo || r.url}`, url: r.url, titulo: r.titulo, video: r.tipo === 'video' || esVideo(r.url) });
  }
  for (const i of activos(estado.inmuebles).filter((x) => c.inmuebles.includes(x.id))) {
    i.videos.forEach((v, n) => lista.push({ valor: `v:${i.id}:${n}`, nombre: `🎬 Vídeo de ${nombreInmueble(i)}`, url: v.url, titulo: v.titulo || `Vídeo de ${i.titulo || i.referencia || 'el inmueble'}`, video: true }));
  }
  return lista.slice(0, 300);
}

/* ───────────── estado de la pantalla ───────────── */

function estadoEnvio(ctx, c, query) {
  const clave = `${c.id}${consultaDe(query)}`;
  let st = ctx.filtros.enviar;
  if (st && st.clave === clave) return st;
  const tipo = TIPOS_MENSAJE[query.get('tipo')] ? query.get('tipo') : query.get('evento') ? 'recordatorio' : query.get('inmueble') ? 'piso' : query.get('recurso') ? 'enlace' : 'recordatorio';
  st = ctx.filtros.enviar = { clave, cliente: c.id, tipo, evento: query.get('evento') || '', inmueble: query.get('inmueble') || '', enlace: query.get('recurso') ? 'r:' + query.get('recurso') : '', url: '', texto: '' };
  completa(ctx, c, st);
  return st;
}

/** Elige lo primero que haya si no hay nada elegido y redacta el texto. */
function completa(ctx, c, st) {
  const hoy = aISO();
  if (st.tipo === 'recordatorio' && !buscaId(ctx.estado, 'eventos', st.evento)) st.evento = citasDe(ctx.estado, c, hoy)[0]?.id || '';
  if (st.tipo === 'piso' && !buscaId(ctx.estado, 'inmuebles', st.inmueble)) st.inmueble = pisosPara(ctx.estado, c)[0]?.id || '';
  if (st.tipo === 'enlace' && !st.url && !enlacesPara(ctx.estado, c).some((x) => x.valor === st.enlace)) st.enlace = enlacesPara(ctx.estado, c)[0]?.valor || '';
  st.texto = redacta(ctx, c, st);
}

function enlaceElegido(ctx, c, st) {
  if (st.url) return { url: st.url, titulo: '', video: esVideo(st.url) };
  return enlacesPara(ctx.estado, c).find((x) => x.valor === st.enlace) || null;
}

function redacta(ctx, c, st) {
  const ajustes = ctx.estado.ajustes;
  if (st.tipo === 'recordatorio') {
    const e = buscaId(ctx.estado, 'eventos', st.evento);
    return e ? mensajeRecordatorio({ evento: e, cliente: c, inmueble: buscaId(ctx.estado, 'inmuebles', e.inmueble), ajustes }) : '';
  }
  if (st.tipo === 'piso') {
    const i = buscaId(ctx.estado, 'inmuebles', st.inmueble);
    return i ? mensajePiso({ inmueble: i, cliente: c, ajustes }) : '';
  }
  if (st.tipo === 'enlace') {
    const x = enlaceElegido(ctx, c, st);
    return x ? mensajeEnlace({ ...x, cliente: c, ajustes }) : '';
  }
  return mensajeLibre({ cliente: c, ajustes });
}

/* ───────────── pantallas ───────────── */

function eleccion(ctx, c, st) {
  const hoy = aISO();
  if (st.tipo === 'recordatorio') {
    const extra = buscaId(ctx.estado, 'eventos', st.evento);
    const citas = citasDe(ctx.estado, c, hoy, extra && !extra.borrado ? extra : null);
    if (!citas.length) return `<p class="nota-info">${h(c.nombre)} no tiene citas próximas. <a href="#evento/nuevo?cliente=${h(c.id)}">Crea una</a> o escribe un mensaje libre.</p>`;
    return `<div class="campo"><label for="enviar-cual">¿Qué cita?</label><select id="enviar-cual" class="entrada" data-cambio="enviar-elige" data-que="evento">
      ${citas.map((e) => `<option value="${h(e.id)}" ${e.id === st.evento ? 'selected' : ''}>${h(fechaCorta(e.fecha))}${e.inicio ? ' ' + h(e.inicio) : ''} · ${h(TIPOS_EVENTO[e.tipo].nombre)} · ${h(e.titulo)}</option>`).join('')}</select></div>`;
  }
  if (st.tipo === 'piso') {
    const pisos = pisosPara(ctx.estado, c);
    if (!pisos.length) return '<p class="nota-info">Aún no tienes inmuebles. <a href="#inmueble/nuevo">Crea uno</a>.</p>';
    const i = buscaId(ctx.estado, 'inmuebles', st.inmueble);
    return `<div class="campo"><label for="enviar-cual">¿Qué inmueble?</label><select id="enviar-cual" class="entrada" data-cambio="enviar-elige" data-que="inmueble">
      ${pisos.map((x) => `<option value="${h(x.id)}" ${x.id === st.inmueble ? 'selected' : ''}>${c.inmuebles.includes(x.id) ? '★ ' : ''}${h(nombreInmueble(x))} · ${h(ESTADOS_INMUEBLE[x.estadoComercial])}</option>`).join('')}</select>
      <p class="ayuda">★ = ya le interesa. Solo van los datos públicos: nunca la dirección exacta, el propietario ni tus notas.</p></div>
      ${i && !['disponible', 'captacion'].includes(i.estadoComercial) ? `<p class="nota-atencion">Este inmueble está «${h(ESTADOS_INMUEBLE[i.estadoComercial])}».</p>` : ''}
      ${i && !i.enlaces.length && !i.videos.length ? `<p class="detalle" style="color:var(--suave);font-size:.85rem">Este inmueble no tiene enlace al anuncio ni vídeo: <a href="#inmueble/${h(i.id)}/editar">añádelos</a> para que vayan en el mensaje.</p>` : ''}`;
  }
  if (st.tipo === 'enlace') {
    const lista = enlacesPara(ctx.estado, c);
    return `${lista.length ? `<div class="campo"><label for="enviar-cual">De tu biblioteca</label><select id="enviar-cual" class="entrada" data-cambio="enviar-elige" data-que="enlace">
      <option value="" ${!st.enlace ? 'selected' : ''}>— Usar el enlace de abajo —</option>
      ${lista.map((x) => `<option value="${h(x.valor)}" ${x.valor === st.enlace && !st.url ? 'selected' : ''}>${h(x.nombre)}</option>`).join('')}</select></div>` : ''}
      ${campo('enviar-url', lista.length ? 'O pega un enlace' : 'Pega el enlace del vídeo o la página', st.url, { tipo: 'url', inputmode: 'url', placeholder: 'https://…', 'data-cambio': 'enviar-url', maxlength: 2000 })}`;
  }
  return '';
}

function enviar(ctx, partes, query) {
  const [id] = partes;
  if (!id) return aQuien(ctx, query);
  const c = buscaId(ctx.estado, 'clientes', id);
  if (!c || c.borrado) return `${cabecera('Cliente no encontrado', '', 'clientes')}${vacio('🔍', 'Este cliente no existe o está en la papelera.')}`;
  const wa = telefonoWhatsapp(c.telefono);
  const st = estadoEnvio(ctx, c, query);
  const enlace = enlaceWhatsapp(c.telefono, st.texto);
  return `${cabecera(`WhatsApp a ${nombreCliente(c)}`, `<a class="btn" href="#enviar${h(consultaDe(query))}">Cambiar persona</a>`, `cliente/${c.id}`)}
  <section class="tarjeta">
    <p>${etiquetaDemo(c)} ${wa ? `📱 ${h(c.telefono)}` : ''}</p>
    ${wa ? '' : `<p class="nota-atencion">${c.telefono ? `El teléfono «${h(c.telefono)}» no sirve para WhatsApp.` : 'No tiene teléfono.'} <a href="#cliente/${h(c.id)}/editar">Añádelo en su ficha</a> para poder abrir el chat. Mientras, puedes copiar el texto.</p>`}
    <div class="pestanas-int" role="group" aria-label="Qué quieres mandar">${Object.entries(TIPOS_MENSAJE).map(([t, n]) => `<button data-accion="enviar-tipo" data-t="${t}" aria-pressed="${st.tipo === t}">${n}</button>`).join('')}</div>
    ${eleccion(ctx, c, st)}
    <div class="campo"><label for="enviar-texto">Mensaje <span class="ayuda" style="display:inline">(puedes cambiarlo antes de abrir WhatsApp)</span></label>
      <textarea id="enviar-texto" class="entrada" rows="10" maxlength="3000" data-teclear="enviar-texto">${h(st.texto)}</textarea></div>
    <div class="fila-botones">
      ${wa ? `<a id="enviar-wa" class="btn primario" href="${h(enlace)}" target="_blank" rel="noopener noreferrer">💬 Abrir WhatsApp con el mensaje</a>` : ''}
      <button class="btn" data-accion="enviar-copiar">📋 Copiar texto</button>
    </div>
    <p class="detalle" style="color:var(--suave);font-size:.85rem">Se abre el chat de ${h(c.nombre || 'esta persona')} con el texto escrito: <strong>lo envías tú en WhatsApp</strong>. La app no manda nada por su cuenta.</p>
    <div class="fila-botones" style="margin-top:.6rem"><button class="btn" data-accion="enviar-hecho">✅ Ya lo he enviado: apuntar en su historial</button></div>
  </section>`;
}

const conWhatsapp = (c) => Boolean(telefonoWhatsapp(c.telefono));

function listaDestinos(ctx, query, texto = '') {
  const palabras = normaliza(texto).split(' ').filter(Boolean);
  const todos = activos(ctx.estado.clientes).filter((c) => c.estado !== 'archivado' || palabras.length);
  const inm = query.get('inmueble'); const ev = buscaId(ctx.estado, 'eventos', query.get('evento'));
  const sugerido = (c) => (ev && ev.cliente === c.id) || (inm && c.inmuebles.includes(inm));
  const lista = todos.filter((c) => {
    if (!palabras.length) return sugerido(c) || c.estado !== 'contacto';
    const t = normaliza(`${nombreCliente(c)} ${c.telefono} ${c.email} ${c.etiquetas.join(' ')}`);
    return palabras.every((p) => t.includes(p));
  }).sort((a, b) => Number(sugerido(b)) - Number(sugerido(a)) || Number(conWhatsapp(b)) - Number(conWhatsapp(a)) || nombreCliente(a).localeCompare(nombreCliente(b), 'es'));
  if (!lista.length) return vacio('🔍', palabras.length ? 'Nadie coincide. Prueba con otra parte del nombre o el teléfono.' : 'Aún no tienes clientes. Elige un contacto del móvil o escribe un número.');
  const q = consultaDe(query);
  return `<ul class="lista">${lista.slice(0, 60).map((c) => `<li><a class="elemento" href="#enviar/${h(c.id)}${h(q)}">
    <span class="cuerpo"><span class="titulo">${h(nombreCliente(c))}</span>${etiquetaDemo(c)}${sugerido(c) ? ' <span class="chip chip-info">sugerido</span>' : ''}
    <br><span class="detalle">${conWhatsapp(c) ? '💬 ' + h(c.telefono) : '<span class="vencida">sin WhatsApp</span>'}</span></span><span aria-hidden="true">›</span></a></li>`).join('')}</ul>
    ${lista.length > 60 ? `<p class="detalle" style="color:var(--suave)">Se muestran 60 de ${lista.length}: afina la búsqueda.</p>` : ''}`;
}

function aQuien(ctx, query) {
  const que = (() => {
    const i = buscaId(ctx.estado, 'inmuebles', query.get('inmueble'));
    if (i) return `el inmueble <strong>${h(nombreInmueble(i))}</strong>`;
    const e = buscaId(ctx.estado, 'eventos', query.get('evento'));
    if (e) return `un recordatorio de <strong>${h(e.titulo)}</strong> (${h(fechaCorta(e.fecha))})`;
    const r = buscaId(ctx.estado, 'recursos', query.get('recurso'));
    if (r) return `<strong>${h(r.titulo || r.url)}</strong>`;
    return '';
  })();
  const picker = selectorContactosDisponible();
  ctx.filtros.enviarQuery = consultaDe(query);
  return `${cabecera('Enviar por WhatsApp', '', 'clientes')}
  <section class="tarjeta"><h2>¿A quién se lo mandas?</h2>
    ${que ? `<p>Vas a mandar ${que}.</p>` : ''}
    <div class="campo"><label class="sr" for="enviar-buscar">Buscar cliente o contacto</label><input id="enviar-buscar" class="entrada" type="search" placeholder="Buscar por nombre o teléfono (también los contactos del móvil)…" data-teclear="enviar-buscar" /></div>
    ${picker ? '<div class="fila-botones"><button class="btn" data-accion="enviar-movil">📇 Elegir un contacto del móvil</button></div>' : ''}
    <div id="enviar-lista">${listaDestinos(ctx, query)}</div>
  </section>
  <form class="tarjeta ficha" data-form="enviar-nuevo" novalidate><h2>A otro número</h2>
    <div class="dos-col">${campo('nombre', 'Nombre', '', { maxlength: 80, autocomplete: 'off', required: true })}${campo('telefono', 'Teléfono', '', { tipo: 'tel', inputmode: 'tel', maxlength: 30, autocomplete: 'off', required: true })}</div>
    <p class="detalle" style="color:var(--suave);font-size:.85rem">Se guarda como «Solo contacto» para que quede apuntado a quién se lo mandaste.</p>
    <button class="btn" type="submit">Seguir</button>
  </form>`;
}

export const pantallas = { enviar };

/* ───────────── acciones ───────────── */

const actual = (ctx) => {
  const st = ctx.filtros.enviar;
  const c = st && buscaId(ctx.estado, 'clientes', st.cliente);
  return c ? { st, c } : null;
};

/** Mismo número de WhatsApp → mismo contacto (no se duplica). */
const porTelefono = (ctx, tel) => {
  const n = telefonoWhatsapp(tel);
  return n ? activos(ctx.estado.clientes).find((c) => telefonoWhatsapp(c.telefono) === n) : null;
};

function irA(ctx, c) { ctx.ir(`enviar/${c.id}${ctx.filtros.enviarQuery || ''}`); }

let temporizador;
export const acciones = {
  'enviar-tipo'(ctx, el) {
    const a = actual(ctx);
    if (!a) return;
    a.st.tipo = el.dataset.t;
    completa(ctx, a.c, a.st);
    ctx.repinta();
  },
  'enviar-elige'(ctx, el) {
    const a = actual(ctx);
    if (!a) return;
    a.st[el.dataset.que] = el.value;
    if (el.dataset.que === 'enlace') a.st.url = '';
    a.st.texto = redacta(ctx, a.c, a.st);
    ctx.repinta();
  },
  'enviar-url'(ctx, el) {
    const a = actual(ctx);
    if (!a) return;
    const url = urlSegura(el.value.trim());
    if (el.value.trim() && !url) { ctx.aviso('Ese enlace no es válido: tiene que empezar por https://', { tipo: 'mal' }); return; }
    a.st.url = url;
    if (url) a.st.enlace = '';
    a.st.texto = redacta(ctx, a.c, a.st);
    ctx.repinta();
  },
  // Al escribir no se repinta (no se pierde el cursor): solo cambia el enlace del botón.
  'enviar-texto'(ctx, el) {
    const a = actual(ctx);
    if (!a) return;
    a.st.texto = el.value;
    const boton = document.getElementById('enviar-wa');
    if (boton) boton.href = enlaceWhatsapp(a.c.telefono, a.st.texto);
  },
  async 'enviar-copiar'(ctx) {
    const a = actual(ctx);
    if (!a || !a.st.texto.trim()) { ctx.aviso('No hay texto que copiar.', { tipo: 'mal' }); return; }
    ctx.aviso((await copia(a.st.texto)) ? 'Texto copiado.' : 'No se ha podido copiar.', { tipo: 'ok' });
  },
  'enviar-hecho'(ctx) {
    const a = actual(ctx);
    if (!a) return;
    const { st, c } = a;
    if (!st.texto.trim()) { ctx.aviso('El mensaje está vacío.', { tipo: 'mal' }); return; }
    const x = st.tipo === 'enlace' ? enlaceElegido(ctx, c, st) : null;
    const inmueble = st.tipo === 'piso' ? buscaId(ctx.estado, 'inmuebles', st.inmueble) : null;
    const texto = resumenEnvio({ tipo: st.tipo, evento: st.tipo === 'recordatorio' ? buscaId(ctx.estado, 'eventos', st.evento) : null, inmueble, url: x?.url, titulo: x?.titulo, texto: st.texto });
    const hoy = aISO();
    c.historial.unshift({ id: 'h_' + Date.now().toString(36), fecha: hoy, hora: horaDe(), tipo: 'whatsapp', texto: texto.slice(0, 1000) });
    // Si le mandas un piso, queda entre sus inmuebles de interés.
    if (inmueble && !c.inmuebles.includes(inmueble.id)) c.inmuebles.push(inmueble.id);
    if (c.estado === 'nuevo') c.estado = 'contactado';
    if (c.siguienteSeguimiento && c.siguienteSeguimiento <= hoy) c.siguienteSeguimiento = '';
    c.actualizado = new Date().toISOString();
    ctx.filtros.enviar = null;
    ctx.guardar();
    ctx.aviso('Apuntado en su historial.');
    ctx.ir(`cliente/${c.id}`);
  },
  'enviar-buscar'(ctx, el) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const caja = document.getElementById('enviar-lista');
      const q = new URLSearchParams((ctx.filtros.enviarQuery || '').slice(1));
      if (caja) caja.innerHTML = listaDestinos(ctx, q, el.value);
    }, 120);
  },
  async 'enviar-movil'(ctx) {
    let elegidos;
    try { elegidos = await eligeContactosDelMovil(); } catch (err) {
      ctx.aviso(err?.name === 'InvalidStateError' ? 'El selector ya estaba abierto.' : 'No se ha podido abrir la agenda del móvil.', { tipo: 'mal', ms: 6000 });
      return;
    }
    const contacto = elegidos.find((x) => x.telefonos.some((t) => telefonoWhatsapp(t)));
    if (!contacto) { ctx.aviso(elegidos.length ? 'Ese contacto no tiene un móvil válido para WhatsApp.' : 'No has elegido ningún contacto.', { tipo: 'mal' }); return; }
    const datos = clienteDeContacto({ ...contacto, telefonos: [contacto.telefonos.find((t) => telefonoWhatsapp(t)), ...contacto.telefonos].filter((t, n, l) => t && l.indexOf(t) === n) }, 'Agenda del móvil');
    const ya = porTelefono(ctx, datos.telefono);
    if (ya) { irA(ctx, ya); return; }
    const r = ctx.guardaRegistro('clientes', datos);
    if (!r.ok) { ctx.aviso('No se ha podido guardar el contacto.', { tipo: 'mal' }); return; }
    ctx.aviso(`${nombreCliente(r.registro)} guardado como «Solo contacto».`);
    irA(ctx, r.registro);
  },
};

export const formularios = {
  'enviar-nuevo'(ctx, form, d) {
    const errores = {};
    if (!d.nombre.trim()) errores.nombre = 'Escribe el nombre.';
    if (!telefonoWhatsapp(d.telefono)) errores.telefono = 'Escribe un móvil válido (9 cifras, o con el prefijo del país).';
    if (Object.keys(errores).length) return { errores };
    const ya = porTelefono(ctx, d.telefono);
    if (ya) { ctx.aviso(`Ese número ya es de ${nombreCliente(ya)}.`); irA(ctx, ya); return; }
    const [nombre, ...resto] = d.nombre.trim().split(/\s+/);
    const r = ctx.guardaRegistro('clientes', { nombre, apellidos: resto.join(' '), telefono: d.telefono.trim(), tipo: 'otro', estado: 'contacto', procedencia: 'WhatsApp desde la agenda' });
    if (!r.ok) return { errores: r.errores };
    irA(ctx, r.registro);
  },
};
