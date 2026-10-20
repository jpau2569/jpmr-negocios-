/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — biblioteca de enlaces, vídeos y documentos
   Pegar un enlace y guardarlo en un toque, con aviso de duplicados.
   Vídeos de YouTube y Vimeo se pueden ver dentro (solo al pulsar
   «Reproducir aquí»: antes no se carga nada de esas plataformas); el
   resto se abre en el original. No se descargan vídeos ni se inventan
   resúmenes: la descripción la escribe Pau.
   Vista previa con imagen de cualquier web: necesita servidor (fase 2);
   hoy se enseña el dominio y, en YouTube, la miniatura pública.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, buscaId, ESTADOS_RECURSO, idYoutube, recursoDuplicado, tipoSugerido, TIPOS_RECURSO } from './datos.js';
import { botonPapelera, relaciones, selectorCliente, selectorInmueble } from './comun.js';
import { bloqueVideo } from './p-inmuebles.js';
import { cabecera, campo, casilla, chips, confirma, etiquetaDemo, h, selector, vacio } from './ui.js';
import { dominio, fechaCorta, normaliza, urlSegura } from './utiles.js';

function tituloDeUrl(url) {
  try {
    const u = new URL(url);
    const ruta = decodeURIComponent(u.pathname).split('/').filter(Boolean).pop() || '';
    const limpio = ruta.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
    return limpio && !/^\d+$/.test(limpio) && limpio.length > 3 ? `${limpio[0].toUpperCase()}${limpio.slice(1)} · ${dominio(url)}` : dominio(url);
  } catch { return ''; }
}

function miniatura(r) {
  const yt = idYoutube(r.url);
  return yt ? `<img class="miniatura" src="https://i.ytimg.com/vi/${h(yt)}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" />` : '';
}

function filtra(ctx) {
  const f = ctx.filtros.biblio || (ctx.filtros.biblio = { texto: '', tipo: '', coleccion: '', estado: '', favoritos: false });
  const pal = normaliza(f.texto).split(' ').filter(Boolean);
  const lista = activos(ctx.estado.recursos).filter((r) => {
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.coleccion && r.coleccion !== f.coleccion) return false;
    if (f.estado ? r.estado !== f.estado : r.estado === 'archivado') return false;
    if (f.favoritos && !r.favorito) return false;
    return pal.every((p) => normaliza(`${r.titulo} ${r.url} ${r.descripcion} ${r.coleccion} ${r.etiquetas.join(' ')}`).includes(p));
  }).sort((a, b) => Number(b.favorito) - Number(a.favorito) || b.creado.localeCompare(a.creado));
  return { f, lista };
}

const tarjetaRecurso = (r) => `<article class="tarjeta recurso-tarjeta">
  ${miniatura(r)}
  <div style="display:flex;gap:.4rem;align-items:start">
    <a href="#recurso/${h(r.id)}" style="flex:1;font-weight:700;color:var(--texto);text-decoration:none">${h(r.titulo || r.url || 'Sin título')}</a>
    <button class="estrella" data-accion="recurso-favorito" data-id="${h(r.id)}" aria-pressed="${r.favorito}" aria-label="${r.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}">${r.favorito ? '⭐' : '☆'}</button>
  </div>
  <span class="detalle" style="color:var(--suave);font-size:.85rem">${h(TIPOS_RECURSO[r.tipo])}${r.url ? ' · ' + h(dominio(r.url)) : ''}${r.coleccion ? ' · 📁 ' + h(r.coleccion) : ''} · ${h(ESTADOS_RECURSO[r.estado])}${etiquetaDemo(r)}</span>
  ${r.etiquetas.length ? `<span>${chips(r.etiquetas)}</span>` : ''}
  <div class="fila-botones" style="margin-top:.3rem">${r.url ? `<a class="btn pequeno" href="${h(r.url)}" target="_blank" rel="noopener noreferrer">↗ Abrir</a>` : ''}<a class="btn pequeno" href="#recurso/${h(r.id)}">Ver ficha</a></div>
</article>`;

const rejilla = (lista) => (lista.length ? `<div class="biblioteca">${lista.map(tarjetaRecurso).join('')}</div>` : vacio('🔍', 'Ningún recurso coincide con los filtros.'));

function biblioteca(ctx) {
  const { f, lista } = filtra(ctx);
  const colecciones = [...new Set(activos(ctx.estado.recursos).map((r) => r.coleccion).filter(Boolean))].sort();
  return `${cabecera('Biblioteca', '<a class="btn primario" href="#recurso/nuevo">＋ Recurso</a>')}
    <form class="tarjeta" data-form="pegar-enlace" novalidate>
      <h2>🔗 Guardar un enlace rápido</h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <div class="campo" data-campo="url" style="flex:1;min-width:200px;margin:0"><label class="sr" for="pegar-url">Enlace</label><input id="pegar-url" name="url" class="entrada" type="url" inputmode="url" placeholder="Pega aquí un enlace https://…" autocomplete="off" /><p class="error" role="alert" hidden></p></div>
        <button class="btn primario" type="submit">Guardar</button>
      </div>
      <p class="ayuda" style="color:var(--suave);font-size:.85rem;margin:.4rem 0 0">Detecta si es un vídeo y avisa si ya lo tenías. Luego puedes ponerle título, carpeta y etiquetas.</p>
    </form>
    ${activos(ctx.estado.recursos).length ? `<div class="filtros">
      <div class="ancho"><label class="sr" for="fb-t">Buscar</label><input id="fb-t" type="search" class="entrada" placeholder="Buscar en la biblioteca…" value="${h(f.texto)}" data-teclear="biblio-filtro" data-campo-filtro="texto" /></div>
      <div><label class="sr" for="fb-tipo">Tipo</label><select id="fb-tipo" class="entrada" data-cambio="biblio-filtro" data-campo-filtro="tipo"><option value="">Todos los tipos</option>${Object.entries(TIPOS_RECURSO).map(([k, t]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="sr" for="fb-col">Colección</label><select id="fb-col" class="entrada" data-cambio="biblio-filtro" data-campo-filtro="coleccion"><option value="">Todas las carpetas</option>${colecciones.map((c) => `<option ${f.coleccion === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></div>
      <div><label class="sr" for="fb-est">Estado</label><select id="fb-est" class="entrada" data-cambio="biblio-filtro" data-campo-filtro="estado"><option value="">Sin archivados</option>${Object.entries(ESTADOS_RECURSO).map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="casilla"><input type="checkbox" data-cambio="biblio-favoritos" ${f.favoritos ? 'checked' : ''} /> <span>⭐ Solo favoritos</span></label></div>
    </div><div id="rejilla-biblio">${rejilla(lista)}</div>` : `<section class="tarjeta">${vacio('📚', 'Tu biblioteca está vacía. Pega arriba tu primer enlace.')}</section>`}`;
}

function formularioRecurso(ctx, r, nuevo) {
  return `${cabecera(nuevo ? 'Nuevo recurso' : 'Editar recurso', '', nuevo ? 'biblioteca' : `recurso/${r.id}`)}
  <form class="tarjeta ficha" data-form="recurso" data-vigilar novalidate>
    <input type="hidden" name="id" value="${h(nuevo ? '' : r.id)}" />
    ${campo('url', 'Enlace (URL)', r.url, { tipo: 'url', inputmode: 'url', placeholder: 'https://…', ayuda: 'Para ideas o documentos sin enlace puedes dejarlo vacío.' })}
    ${campo('titulo', 'Título', r.titulo, { maxlength: 160 })}
    <div class="dos-col">
      ${selector('tipo', 'Tipo', r.tipo, TIPOS_RECURSO)}
      ${selector('estado', 'Estado', r.estado, ESTADOS_RECURSO)}
      ${campo('coleccion', 'Carpeta o colección', r.coleccion, { maxlength: 60, list: 'colecciones', placeholder: 'Formación, Captación…' })}
      ${campo('etiquetas', 'Etiquetas (separadas por comas)', r.etiquetas.join(', '), { maxlength: 300 })}
    </div>
    <datalist id="colecciones">${[...new Set(activos(ctx.estado.recursos).map((x) => x.coleccion).filter(Boolean))].map((c) => `<option value="${h(c)}"></option>`).join('')}</datalist>
    ${campo('descripcion', 'Descripción o notas', r.descripcion, { tipo: 'textarea', maxlength: 2000, ayuda: 'La escribes tú: la app no resume vídeos ni páginas.' })}
    ${casilla('favorito', '⭐ Favorito', r.favorito)}
    <p class="seccion-form">Relacionar con (opcional)</p>
    <div class="dos-col">${selectorCliente(ctx.estado, r.cliente)}${selectorInmueble(ctx.estado, r.inmueble)}
      ${selector('tarea', 'Tarea', r.tarea, activos(ctx.estado.tareas).filter((t) => t.estado !== 'hecha' || t.id === r.tarea).map((t) => [t.id, t.titulo]), { vacio: '— Ninguna —' })}
      ${selector('evento', 'Cita', r.evento, activos(ctx.estado.eventos).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 100).map((e) => [e.id, `${fechaCorta(e.fecha)} · ${e.titulo}`]), { vacio: '— Ninguna —' })}
    </div>
    <div class="barra-guardar"><a class="btn secundario" href="#${nuevo ? 'biblioteca' : 'recurso/' + h(r.id)}">Cancelar</a><button class="btn primario" type="submit">Guardar recurso</button></div>
  </form>`;
}

function recurso(ctx, partes, query) {
  const [id, modo] = partes;
  if (id === 'nuevo') {
    const url = urlSegura(query.get('url'));
    return formularioRecurso(ctx, { url, titulo: url ? tituloDeUrl(url) : '', tipo: TIPOS_RECURSO[query.get('tipo')] ? query.get('tipo') : url ? tipoSugerido(url) : 'web', estado: 'pendiente', coleccion: '', etiquetas: [], descripcion: '', favorito: false, cliente: query.get('cliente') || '', inmueble: query.get('inmueble') || '', tarea: '', evento: '' }, true);
  }
  const r = buscaId(ctx.estado, 'recursos', id);
  if (!r || r.borrado) return `${cabecera('Recurso no encontrado', '', 'biblioteca')}${vacio('🔍', 'Este recurso no existe o está en la papelera.')}`;
  if (modo === 'editar') return formularioRecurso(ctx, r, false);
  return `${cabecera(r.titulo || 'Recurso', `<a class="btn" href="#recurso/${h(r.id)}/editar">✏️ Editar</a>`, 'biblioteca')}
    <section class="tarjeta">
      <p>${etiquetaDemo(r)} <span class="chip chip-info">${h(TIPOS_RECURSO[r.tipo])}</span> <span class="chip">${h(ESTADOS_RECURSO[r.estado])}</span> ${r.coleccion ? `<span class="chip">📁 ${h(r.coleccion)}</span>` : ''} ${chips(r.etiquetas)}</p>
      ${r.tipo === 'video' && r.url ? bloqueVideo({ url: r.url, titulo: r.titulo }) : miniatura(r)}
      ${r.url ? `<p style="margin:.8rem 0"><a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">${h(r.url)}</a></p>` : ''}
      ${r.descripcion ? `<p class="texto-ficha">${h(r.descripcion)}</p>` : ''}
      ${relaciones(ctx.estado, r)}
      <p class="detalle" style="color:var(--suave);font-size:.85rem">Guardado el ${h(fechaCorta(r.creado.slice(0, 10)))}</p>
      <div class="fila-botones">
        ${r.url ? `<a class="btn primario" href="${h(r.url)}" target="_blank" rel="noopener noreferrer">↗ Abrir el original</a>` : ''}
        <button class="btn" data-accion="recurso-favorito" data-id="${h(r.id)}">${r.favorito ? '⭐ Quitar favorito' : '☆ Favorito'}</button>
        ${r.estado !== 'revisado' ? `<button class="btn" data-accion="recurso-estado" data-id="${h(r.id)}" data-estado="revisado">✔ Marcar revisado</button>` : ''}
        ${r.estado !== 'archivado' ? `<button class="btn" data-accion="recurso-estado" data-id="${h(r.id)}" data-estado="archivado">🗄 Archivar</button>` : `<button class="btn" data-accion="recurso-estado" data-id="${h(r.id)}" data-estado="pendiente">↩ Desarchivar</button>`}
        ${botonPapelera('recursos', r.id)}
      </div>
    </section>`;
}

/** ¿Ya existe? Pregunta qué hacer. Devuelve 'guardar' | 'abrir' | 'cancelar'. */
async function compruebaDuplicado(ctx, url, idPropio) {
  const dup = recursoDuplicado(ctx.estado, url, idPropio);
  if (!dup) return 'guardar';
  const seguir = await confirma({ titulo: 'Este enlace ya está en tu biblioteca', texto: `Lo guardaste como «${dup.titulo || dup.url}» el ${fechaCorta(dup.creado.slice(0, 10))}.`, boton: 'Guardar otra vez' });
  if (seguir) return 'guardar';
  ctx.ir(`recurso/${dup.id}`);
  return 'abrir';
}

export const pantallas = { biblioteca, recurso };

export const formularios = {
  async 'pegar-enlace'(ctx, form, d) {
    const url = urlSegura(d.url);
    if (!url) return { errores: { url: 'Pega un enlace válido (https://…).' } };
    if ((await compruebaDuplicado(ctx, url)) !== 'guardar') return;
    const r = ctx.guardaRegistro('recursos', { url, titulo: tituloDeUrl(url), tipo: tipoSugerido(url), estado: 'pendiente' });
    if (!r.ok) return { errores: r.errores };
    ctx.aviso(r.registro.tipo === 'video' ? 'Vídeo guardado.' : 'Enlace guardado.', { accion: { texto: 'Completar ficha', hacer: () => ctx.ir(`recurso/${r.registro.id}/editar`) } });
    ctx.repinta();
  },
  async recurso(ctx, form, d) {
    const url = d.url.trim() ? urlSegura(d.url) : '';
    if (d.url.trim() && !url) return { errores: { url: 'Ese enlace no es válido: tiene que empezar por https:// o http://' } };
    if (url && (await compruebaDuplicado(ctx, url, d.id)) !== 'guardar') return;
    const r = ctx.guardaRegistro('recursos', { ...d, url, favorito: [].concat(d.favorito || []).includes('si'), titulo: d.titulo.trim() || (url ? tituloDeUrl(url) : '') });
    if (!r.ok) return { errores: r.errores };
    ctx.sucio = false;
    ctx.aviso(r.nuevo ? 'Recurso guardado.' : 'Cambios guardados.');
    ctx.ir(`recurso/${r.registro.id}`);
  },
};

let temporizador;
export const acciones = {
  'biblio-filtro'(ctx, el) {
    ctx.filtros.biblio[el.dataset.campoFiltro] = el.value;
    if (el.tagName === 'SELECT') { ctx.repinta(); return; }
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { const c = document.getElementById('rejilla-biblio'); if (c) c.innerHTML = rejilla(filtra(ctx).lista); }, 150);
  },
  'biblio-favoritos'(ctx, el) { filtra(ctx); ctx.filtros.biblio.favoritos = el.checked; ctx.repinta(); },
  'recurso-favorito'(ctx, el) {
    const r = buscaId(ctx.estado, 'recursos', el.dataset.id);
    if (!r) return;
    r.favorito = !r.favorito;
    r.actualizado = new Date().toISOString();
    ctx.guardar();
    ctx.repinta();
  },
  'recurso-estado'(ctx, el) {
    const r = buscaId(ctx.estado, 'recursos', el.dataset.id);
    if (!r) return;
    r.estado = el.dataset.estado;
    r.actualizado = new Date().toISOString();
    ctx.guardar();
    ctx.aviso(`Marcado como ${r.estado}.`);
    ctx.repinta();
  },
};
