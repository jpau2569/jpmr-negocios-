/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — inmuebles
   Ficha con datos PÚBLICOS (los que salen en «Copiar ficha para
   compartir») y PRIVADOS (dirección exacta, propietario, notas internas,
   próxima acción), marcados con colores distintos. Enlaces a anuncios,
   vídeos, interesados, visitas y posibles compradores.
   Pegar la URL de un anuncio solo la guarda: la app no lee el anuncio
   ni inventa datos. Fotos y documentos privados: fase 2 (almacén con
   cuenta), aquí se guardan como enlaces.
   ═══════════════════════════════════════════════════════════════════ */

import {
  activos, buscaId, CARACTERISTICAS, encajeInmueble, ESTADOS_INMUEBLE, fichaCompartible, nombreCliente, nombreInmueble,
  OPERACIONES, ordenEvento, TIPOS_INMUEBLE, urlIncrustada,
} from './datos.js';
import { botonPapelera, enlacesATexto, enlacesDeTexto, itemCliente, itemEvento, itemInmueble, itemTarea, listaEnlaces, selectorCliente } from './comun.js';
import { cabecera, campo, casillas, copia, etiquetaDemo, h, selector, vacio } from './ui.js';
import { aISO, euros, normaliza, numeroES } from './utiles.js';

const may = (t) => t[0].toUpperCase() + t.slice(1);

function filtraInmuebles(ctx) {
  const f = ctx.filtros.inmuebles || (ctx.filtros.inmuebles = { texto: '', tipo: '', operacion: '', estado: '', min: '', max: '', zona: '', car: '' });
  const pal = normaliza(f.texto).split(' ').filter(Boolean);
  const min = numeroES(f.min); const max = numeroES(f.max);
  const lista = activos(ctx.estado.inmuebles).filter((i) => {
    if (f.tipo && i.tipo !== f.tipo) return false;
    if (f.operacion && i.operacion !== f.operacion) return false;
    if (f.estado && i.estadoComercial !== f.estado) return false;
    if (min != null && (i.precio == null || i.precio < min)) return false;
    if (max != null && (i.precio == null || i.precio > max)) return false;
    if (f.zona && !normaliza(i.zona).includes(normaliza(f.zona))) return false;
    if (f.car && !i.caracteristicas.includes(f.car)) return false;
    const t = normaliza(`${i.referencia} ${i.titulo} ${i.zona} ${i.direccion} ${i.descripcion}`);
    return pal.every((p) => t.includes(p));
  }).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  return { f, lista };
}
const listaInmuebles = (lista) => (lista.length ? `<p class="detalle" style="color:var(--suave);margin-top:0">${lista.length} inmueble${lista.length === 1 ? '' : 's'}</p><ul class="lista">${lista.map((i) => itemInmueble(i, h(ESTADOS_INMUEBLE[i.estadoComercial]))).join('')}</ul>` : vacio('🔍', 'Ningún inmueble coincide con los filtros.'));

function inmuebles(ctx) {
  const cab = cabecera('Inmuebles', '<a class="btn primario" href="#inmueble/nuevo">＋ Inmueble</a>');
  if (!activos(ctx.estado.inmuebles).length) return `${cab}<section class="tarjeta">${vacio('🏠', 'Aún no tienes inmuebles.', '<a class="btn primario" href="#inmueble/nuevo">Crear el primero</a>')}</section>`;
  const { f, lista } = filtraInmuebles(ctx);
  const sel = (campoF, etiqueta, opciones) => `<div><label class="sr" for="fi-${campoF}">${etiqueta}</label><select id="fi-${campoF}" class="entrada" data-cambio="inmueble-filtro" data-campo-filtro="${campoF}"><option value="">${etiqueta}</option>${Object.entries(opciones).map(([v, t]) => `<option value="${h(v)}" ${f[campoF] === v ? 'selected' : ''}>${h(t)}</option>`).join('')}</select></div>`;
  const ent = (campoF, etiqueta) => `<div><label class="sr" for="fi-${campoF}">${etiqueta}</label><input id="fi-${campoF}" class="entrada" placeholder="${etiqueta}" value="${h(f[campoF])}" data-teclear="inmueble-filtro" data-campo-filtro="${campoF}" ${campoF === 'min' || campoF === 'max' ? 'inputmode="numeric"' : ''} /></div>`;
  return `${cab}<div class="filtros">
      <div class="ancho"><label class="sr" for="fi-texto">Buscar inmuebles</label><input id="fi-texto" type="search" class="entrada" placeholder="Referencia, título, calle…" value="${h(f.texto)}" data-teclear="inmueble-filtro" data-campo-filtro="texto" /></div>
      ${sel('operacion', 'Venta o alquiler', Object.fromEntries(OPERACIONES.map((o) => [o, may(o)])))}
      ${sel('tipo', 'Todos los tipos', Object.fromEntries(TIPOS_INMUEBLE.map((t) => [t, may(t)])))}
      ${sel('estado', 'Todos los estados', ESTADOS_INMUEBLE)}
      ${sel('car', 'Característica', Object.fromEntries(CARACTERISTICAS.map((c) => [c, may(c)])))}
      ${ent('zona', 'Zona')}${ent('min', 'Precio mín. €')}${ent('max', 'Precio máx. €')}
    </div><section class="tarjeta" id="lista-inmuebles">${listaInmuebles(lista)}</section>`;
}

function formularioInmueble(ctx, i, nuevo) {
  return `${cabecera(nuevo ? 'Nuevo inmueble' : 'Editar inmueble', '', nuevo ? 'inmuebles' : `inmueble/${i.id}`)}
  <form class="tarjeta ficha" data-form="inmueble" data-vigilar novalidate>
    <input type="hidden" name="id" value="${h(nuevo ? '' : i.id)}" />
    <p class="seccion-form">Datos que se pueden compartir</p>
    <div class="publico">
      <div class="dos-col">
        ${campo('referencia', 'Referencia interna', i.referencia, { maxlength: 40, placeholder: 'OV-0123' })}
        ${campo('titulo', 'Título', i.titulo, { maxlength: 120, placeholder: 'Piso exterior con ascensor en el centro' })}
        ${selector('tipo', 'Tipo de inmueble', i.tipo, Object.fromEntries(TIPOS_INMUEBLE.map((t) => [t, may(t)])))}
        ${selector('operacion', 'Operación', i.operacion, Object.fromEntries(OPERACIONES.map((o) => [o, may(o)])))}
        ${selector('estadoComercial', 'Estado comercial', i.estadoComercial, ESTADOS_INMUEBLE)}
        ${campo('precio', 'Precio (€)', i.precio ?? '', { inputmode: 'numeric', placeholder: '195.000', ayuda: 'En alquiler, al mes.' })}
        ${campo('zona', 'Zona o barrio', i.zona, { maxlength: 80, placeholder: 'Oviedo, Centro' })}
        ${campo('superficie', 'Superficie (m²)', i.superficie ?? '', { inputmode: 'decimal' })}
        ${campo('habitaciones', 'Habitaciones', i.habitaciones ?? '', { inputmode: 'numeric' })}
        ${campo('banos', 'Baños', i.banos ?? '', { inputmode: 'numeric' })}
      </div>
      ${casillas('caracteristicas', 'Características', CARACTERISTICAS.map((c) => [c, may(c)]), i.caracteristicas)}
      ${campo('descripcion', 'Descripción', i.descripcion, { tipo: 'textarea', maxlength: 4000 })}
      ${campo('enlaces', 'Enlaces a anuncios (uno por línea)', enlacesATexto(i.enlaces), { tipo: 'textarea', rows: 2, placeholder: 'https://www.idealista.com/inmueble/… Idealista', ayuda: 'Solo se guarda el enlace: la app no lee el anuncio ni copia sus datos.' })}
      ${campo('videos', 'Vídeos y recorridos virtuales (uno por línea)', enlacesATexto(i.videos), { tipo: 'textarea', rows: 2, placeholder: 'https://youtu.be/… Recorrido' })}
    </div>
    <p class="seccion-form">Datos privados (nunca salen en la ficha para compartir)</p>
    <div class="privado">
      ${campo('direccion', 'Dirección exacta', i.direccion, { maxlength: 200 })}
      ${selectorCliente(ctx.estado, i.propietario, 'Propietario', 'propietario')}
      ${campo('proximaAccion', 'Próxima acción', i.proximaAccion, { maxlength: 200 })}
      ${campo('notasInternas', 'Notas internas', i.notasInternas, { tipo: 'textarea', maxlength: 4000 })}
    </div>
    <p class="nota-info">📷 Fotos y documentos privados: llegan en la fase 2 con almacén seguro. Mientras, guarda aquí los enlaces (Drive, Dropbox…).</p>
    <div class="barra-guardar"><a class="btn secundario" href="#${nuevo ? 'inmuebles' : 'inmueble/' + h(i.id)}">Cancelar</a><button class="btn primario" type="submit">Guardar inmueble</button></div>
  </form>`;
}

function inmueble(ctx, partes, query) {
  const [id, modo] = partes;
  if (id === 'nuevo') {
    const url = query.get('url') || '';
    return formularioInmueble(ctx, { referencia: '', titulo: '', tipo: 'piso', operacion: 'venta', estadoComercial: 'disponible', precio: null, zona: '', superficie: null, habitaciones: null, banos: null, caracteristicas: [], descripcion: '', enlaces: url ? [{ url, titulo: '' }] : [], videos: [], direccion: '', propietario: query.get('propietario') || '', proximaAccion: '', notasInternas: '' }, true);
  }
  const i = buscaId(ctx.estado, 'inmuebles', id);
  if (!i || i.borrado) return `${cabecera('Inmueble no encontrado', '', 'inmuebles')}${vacio('🔍', 'Este inmueble no existe o está en la papelera.')}`;
  if (modo === 'editar') return formularioInmueble(ctx, i, false);
  const hoy = aISO();
  const prop = buscaId(ctx.estado, 'clientes', i.propietario);
  const interesados = activos(ctx.estado.clientes).filter((c) => c.inmuebles.includes(i.id));
  const visitas = activos(ctx.estado.eventos).filter((e) => e.inmueble === i.id && e.tipo === 'visita').sort((a, b) => ordenEvento(b).localeCompare(ordenEvento(a)));
  const pendientes = visitas.filter((e) => e.estadoVisita === 'pendiente' && e.fecha >= hoy);
  const hechas = visitas.filter((e) => e.estadoVisita === 'realizada');
  const otrosEventos = activos(ctx.estado.eventos).filter((e) => e.inmueble === i.id && e.tipo !== 'visita');
  const tareas = activos(ctx.estado.tareas).filter((t) => t.inmueble === i.id);
  const posibles = activos(ctx.estado.clientes).filter((c) => !c.inmuebles.includes(i.id) && ['comprador', 'inquilino'].includes(c.tipo) && !['cerrado', 'archivado'].includes(c.estado))
    .map((c) => ({ c, e: encajeInmueble(c, i) })).filter((x) => x.e.encaja).sort((a, b) => b.e.puntos - a.e.puntos).slice(0, 6);
  const datos = [i.superficie != null && `${i.superficie} m²`, i.habitaciones != null && `${i.habitaciones} hab.`, i.banos != null && `${i.banos} baños`].filter(Boolean).join(' · ');
  const opcionesCliente = activos(ctx.estado.clientes).filter((c) => !c.inmuebles.includes(i.id));
  return `${cabecera(nombreInmueble(i), `<a class="btn" href="#inmueble/${h(i.id)}/editar">✏️ Editar</a>`, 'inmuebles')}
  <section class="tarjeta publico">
    <h2>Ficha <span class="chip chip-ok">se puede compartir</span></h2>
    <p>${etiquetaDemo(i)} <span class="chip chip-info">${h(ESTADOS_INMUEBLE[i.estadoComercial])}</span> <span class="chip">${h(may(i.tipo))} en ${h(i.operacion)}</span></p>
    <dl class="datos">
      <dt>Precio</dt><dd>${i.precio != null ? h(euros(i.precio)) + (i.operacion === 'alquiler' ? '/mes' : '') : 'Sin precio'}</dd>
      ${i.zona ? `<dt>Zona</dt><dd>${h(i.zona)}</dd>` : ''}
      ${datos ? `<dt>Datos</dt><dd>${h(datos)}</dd>` : ''}
      ${i.caracteristicas.length ? `<dt>Tiene</dt><dd>${h(i.caracteristicas.join(', '))}</dd>` : ''}
    </dl>
    ${i.descripcion ? `<p class="texto-ficha">${h(i.descripcion)}</p>` : ''}
    ${i.enlaces.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Anuncios</h3>${listaEnlaces(i.enlaces)}` : ''}
    ${i.videos.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Vídeos</h3>${i.videos.map((v) => bloqueVideo(v)).join('')}` : ''}
    <div class="fila-botones"><button class="btn" data-accion="inmueble-compartir" data-id="${h(i.id)}">📋 Copiar ficha para compartir</button></div>
  </section>
  <section class="tarjeta privado">
    <h2>Datos privados <span class="chip chip-demo">solo para ti</span></h2>
    <dl class="datos">
      <dt>Dirección</dt><dd>${h(i.direccion || '—')}</dd>
      <dt>Propietario</dt><dd>${prop ? `<a href="#cliente/${h(prop.id)}">${h(nombreCliente(prop))}</a>` : '—'}</dd>
      <dt>Próxima acción</dt><dd>${h(i.proximaAccion || '—')}</dd>
    </dl>
    ${i.notasInternas ? `<p class="texto-ficha">${h(i.notasInternas)}</p>` : ''}
  </section>
  <div class="rejilla rejilla-2">
  <section class="tarjeta"><h2>👥 Clientes interesados</h2>
    ${interesados.length ? `<ul class="lista">${interesados.map((c) => itemCliente(c)).join('')}</ul>` : '<p class="detalle" style="color:var(--suave)">Nadie vinculado todavía.</p>'}
    ${opcionesCliente.length ? `<form data-form="inmueble-interesado" class="fila-botones" style="align-items:end"><input type="hidden" name="inmueble" value="${h(i.id)}" /><div class="campo" style="flex:1;margin:0"><label for="ii-${h(i.id)}">Añadir interesado</label><select id="ii-${h(i.id)}" name="cliente">${opcionesCliente.map((c) => `<option value="${h(c.id)}">${h(nombreCliente(c))}</option>`).join('')}</select></div><button class="btn" type="submit">Añadir</button></form>` : ''}
    ${posibles.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Podría interesar a <span class="sugerencia">SUGERENCIA</span></h3><ul class="lista">${posibles.map(({ c, e }) => itemCliente(c, h(e.motivos.join(', ')))).join('')}</ul>` : ''}
  </section>
  <section class="tarjeta"><h2>🔑 Visitas <a class="mas" href="#evento/nuevo?tipo=visita&inmueble=${h(i.id)}">＋ Programar</a></h2>
    <p class="detalle" style="color:var(--suave)">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'} · ${hechas.length} realizada${hechas.length === 1 ? '' : 's'}</p>
    ${visitas.length ? visitas.slice(0, 12).map((e) => itemEvento(ctx.estado, e, { conFecha: true })).join('') : vacio('🔑', 'Sin visitas.')}
    ${otrosEventos.length ? `<h3 style="font-size:.95rem;margin:1rem 0 .3rem">Otras citas</h3>${otrosEventos.map((e) => itemEvento(ctx.estado, e, { conFecha: true })).join('')}` : ''}
  </section>
  <section class="tarjeta"><h2>✅ Tareas <a class="mas" href="#tarea/nuevo?inmueble=${h(i.id)}">＋ Tarea</a></h2>${tareas.length ? `<ul class="lista">${tareas.map((t) => itemTarea(ctx.estado, t, hoy)).join('')}</ul>` : '<p class="detalle" style="color:var(--suave)">Sin tareas.</p>'}</section>
  </div>
  <div class="fila-botones">${botonPapelera('inmuebles', i.id)}</div>`;
}

/** Vídeo: se incrusta solo si la plataforma lo permite y Pau lo pide (no se carga nada de terceros antes). */
export function bloqueVideo(v) {
  const incrustada = urlIncrustada(v.url);
  return `<div class="tarjeta-mini">
    <strong>${h(v.titulo || 'Vídeo')}</strong>
    <div class="fila-botones">
      ${incrustada ? `<button class="btn primario pequeno" data-accion="video-reproducir" data-src="${h(incrustada)}">▶ Reproducir aquí</button>` : ''}
      <a class="btn pequeno" href="${h(v.url)}" target="_blank" rel="noopener noreferrer">↗ Abrir el original</a>
    </div>
    ${incrustada ? '' : '<p class="detalle" style="color:var(--suave);font-size:.82rem;margin:.3rem 0 0">Esta plataforma no permite verlo dentro de la app.</p>'}
    <div class="hueco-video"></div></div>`;
}

export const pantallas = { inmuebles, inmueble };

export const formularios = {
  inmueble(ctx, form, d) {
    const enlaces = enlacesDeTexto(d.enlaces);
    const videos = enlacesDeTexto(d.videos);
    const mal = [...enlaces, ...videos].find((x) => !/^https?:\/\//i.test(x.url));
    if (mal) return { errores: { [enlaces.includes(mal) ? 'enlaces' : 'videos']: `Este enlace no es válido: ${mal.url}` } };
    for (const k of ['precio', 'superficie', 'habitaciones', 'banos']) {
      if (String(d[k] || '').trim() && numeroES(d[k]) === null) return { errores: { [k]: 'Escribe solo la cifra.' } };
    }
    const datos = { ...d, enlaces, videos, caracteristicas: [].concat(d.caracteristicas || []) };
    for (const k of ['precio', 'superficie', 'habitaciones', 'banos']) if (!String(d[k] || '').trim()) datos[k] = null;
    // Referencia repetida: se avisa (dos inmuebles con la misma referencia confunden).
    const ref = normaliza(d.referencia);
    if (ref && activos(ctx.estado.inmuebles).some((o) => o.id !== d.id && normaliza(o.referencia) === ref)) return { errores: { referencia: 'Ya tienes otro inmueble con esta referencia.' } };
    const r = ctx.guardaRegistro('inmuebles', datos);
    if (!r.ok) return { errores: r.errores };
    ctx.sucio = false;
    ctx.aviso(r.nuevo ? 'Inmueble creado.' : 'Inmueble guardado.');
    ctx.ir(`inmueble/${r.registro.id}`);
  },
  'inmueble-interesado'(ctx, form, d) {
    const c = buscaId(ctx.estado, 'clientes', d.cliente);
    if (!c || c.inmuebles.includes(d.inmueble)) return;
    c.inmuebles.push(d.inmueble);
    ctx.guardar();
    ctx.aviso(`${nombreCliente(c)} queda como interesado.`);
    ctx.repinta();
  },
};

let temporizador;
export const acciones = {
  'inmueble-filtro'(ctx, el) {
    ctx.filtros.inmuebles[el.dataset.campoFiltro] = el.value;
    if (el.tagName === 'SELECT') { ctx.repinta(); return; }
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const caja = document.getElementById('lista-inmuebles');
      if (caja) caja.innerHTML = listaInmuebles(filtraInmuebles(ctx).lista);
    }, 150);
  },
  async 'inmueble-compartir'(ctx, el) {
    const i = buscaId(ctx.estado, 'inmuebles', el.dataset.id);
    if (!i) return;
    const texto = fichaCompartible(i);
    const ok = await copia(texto);
    ctx.aviso(ok ? 'Ficha copiada (sin dirección exacta ni datos del propietario). Pégala donde quieras.' : 'No se ha podido copiar. Selecciona el texto a mano.', { tipo: ok ? 'ok' : 'mal', ms: 5000 });
    if (!ok) ctx.confirma({ titulo: 'Ficha para compartir', detalle: `<pre class="texto-ficha">${h(texto)}</pre>`, boton: 'Cerrar' });
  },
  'video-reproducir'(ctx, el) {
    const hueco = el.closest('.tarjeta-mini, .tarjeta').querySelector('.hueco-video');
    hueco.innerHTML = `<div class="video" style="margin-top:.6rem"><iframe src="${h(el.dataset.src)}" title="Reproductor de vídeo" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
    el.remove();
  },
};
