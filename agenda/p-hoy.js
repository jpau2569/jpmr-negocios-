/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — Mi día (pantalla de inicio)
   Al abrir: próxima cita, agenda de hoy, tres prioridades, tareas
   pendientes y vencidas, clientes a los que llamar, visitas próximas,
   notas y recursos recientes. Los bloques se reordenan u ocultan en
   «Personalizar» y el orden se guarda.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, BLOQUES_PANEL, buscaId, clientesSinSeguimiento, eventosDelDia, nombreCliente, proximosEventos, tareaAbierta, TIPOS_RECURSO } from './datos.js';
import { itemCliente, itemEvento, itemTarea } from './comun.js';
import { etiquetaDemo, h, vacio } from './ui.js';
import { cuando, dominio, fechaCorta, fechaLarga, sumaDias } from './utiles.js';

function saludo(nombre, ahora) {
  const hora = ahora.getHours();
  return `${hora < 6 ? 'Buenas noches' : hora < 14 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches'}, ${nombre}`;
}

const BLOQUE = {
  proxima(ctx, hoy, ahora) {
    const e = proximosEventos(ctx.estado, ahora, 1)[0];
    if (!e) return `<section class="tarjeta inclina"><h2>⏭ Próxima cita</h2>${vacio('🗓', 'No tienes citas próximas.', '<button class="btn primario" data-accion="ir" data-a="evento/nuevo">Nueva cita</button>')}</section>`;
    const c = buscaId(ctx.estado, 'clientes', e.cliente);
    return `<section class="tarjeta inclina"><h2>⏭ Próxima cita</h2>
      <a class="proxima" href="#evento/${h(e.id)}" style="text-decoration:none;color:inherit">
        <span class="hora-grande">${h(e.todoElDia ? '—' : e.inicio)}</span>
        <span><strong>${h(e.titulo)}</strong>${etiquetaDemo(e)}<br>
        <span class="detalle">${h(cuando(e.fecha, hoy))}${e.todoElDia ? ' · todo el día' : ''}${c ? ' · 👤 ' + h(nombreCliente(c)) : ''}${e.ubicacion ? ' · 📍 ' + h(e.ubicacion) : ''}</span></span>
      </a></section>`;
  },
  agenda(ctx, hoy) {
    const ev = eventosDelDia(ctx.estado, hoy);
    return `<section class="tarjeta inclina"><h2>📅 Agenda de hoy <a class="mas" href="#agenda/dia/${hoy}">Ver día</a></h2>
      ${ev.length ? ev.map((e) => itemEvento(ctx.estado, e)).join('') : vacio('☕', 'Hoy no tienes nada en la agenda.')}</section>`;
  },
  prioridades(ctx, hoy) {
    const aj = ctx.estado.ajustes;
    const antiguas = aj.prioridadesFecha && aj.prioridadesFecha !== hoy && aj.prioridades.some(Boolean);
    return `<section class="tarjeta inclina"><h2>🎯 Tres prioridades</h2>
      ${antiguas ? `<p class="nota-atencion">Son las del <strong>${h(fechaCorta(aj.prioridadesFecha))}</strong>. ¿Siguen valiendo? <button class="enlace-btn" data-accion="prioridades-vaciar">Empezar de cero hoy</button></p>` : ''}
      ${[0, 1, 2].map((i) => `<div class="prioridad-fila"><span class="num" aria-hidden="true">${i + 1}</span><label class="sr" for="prio-${i}">Prioridad ${i + 1}</label><input id="prio-${i}" class="entrada" data-teclear="prioridad" data-i="${i}" value="${h(aj.prioridades[i])}" placeholder="¿Qué es lo más importante hoy?" maxlength="140" /></div>`).join('')}
      <p class="ayuda" style="color:var(--suave);font-size:.85rem;margin:0">Se guardan solas mientras escribes.</p></section>`;
  },
  tareas(ctx, hoy) {
    const abiertas = activos(ctx.estado.tareas).filter(tareaAbierta);
    const vencidas = abiertas.filter((t) => t.fecha && t.fecha < hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const deHoy = abiertas.filter((t) => t.fecha === hoy).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
    const lista = [...vencidas, ...deHoy];
    return `<section class="tarjeta inclina"><h2>✅ Tareas de hoy${vencidas.length ? ` <span class="chip chip-mal">${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}</span>` : ''} <a class="mas" href="#tareas/hoy">Todas</a></h2>
      ${lista.length ? `<ul class="lista">${lista.slice(0, 8).map((t) => itemTarea(ctx.estado, t, hoy)).join('')}</ul>${lista.length > 8 ? `<p><a href="#tareas/hoy">y ${lista.length - 8} más…</a></p>` : ''}` : vacio('🎉', 'Nada pendiente para hoy.', '<button class="btn" data-accion="ir" data-a="tarea/nuevo">Nueva tarea</button>')}</section>`;
  },
  seguimientos(ctx, hoy) {
    const lista = clientesSinSeguimiento(ctx.estado, hoy);
    return `<section class="tarjeta inclina"><h2>📞 Clientes a seguir <a class="mas" href="#clientes">Clientes</a></h2>
      ${lista.length ? `<ul class="lista">${lista.slice(0, 6).map((s) => itemCliente(s.cliente, `<span class="${s.urgente ? 'vencida' : ''}">${h(s.motivo)}</span>`)).join('')}</ul>` : vacio('👌', 'Ningún cliente pendiente de seguimiento.')}</section>`;
  },
  visitas(ctx, hoy, ahora) {
    const lista = proximosEventos(ctx.estado, ahora, 200).filter((e) => e.tipo === 'visita' && e.estadoVisita === 'pendiente' && e.fecha <= sumaDias(hoy, 14)).slice(0, 6);
    return `<section class="tarjeta inclina"><h2>🏠 Visitas próximas</h2>
      ${lista.length ? lista.map((e) => itemEvento(ctx.estado, e, { conFecha: true })).join('') : vacio('🔑', 'No hay visitas en los próximos 14 días.', '<button class="btn" data-accion="ir" data-a="evento/nuevo?tipo=visita">Programar visita</button>')}</section>`;
  },
  notas(ctx) {
    const lista = activos(ctx.estado.notas).sort((a, b) => Number(b.fijada) - Number(a.fijada) || b.actualizado.localeCompare(a.actualizado)).slice(0, 4);
    return `<section class="tarjeta inclina"><h2>📝 Notas recientes <a class="mas" href="#notas">Notas</a></h2>
      ${lista.length ? `<ul class="lista">${lista.map((n) => `<li><a class="elemento" href="#nota/${h(n.id)}"><span class="cuerpo"><span class="titulo">${n.fijada ? '📌 ' : ''}${h(n.titulo || n.texto.split('\n')[0] || 'Nota sin título')}</span>${etiquetaDemo(n)}<br><span class="detalle">${h(fechaCorta(n.actualizado.slice(0, 10)))}</span></span></a></li>`).join('')}</ul>` : vacio('🗒', 'Aún no tienes notas.')}</section>`;
  },
  recursos(ctx) {
    const lista = activos(ctx.estado.recursos).filter((r) => r.estado !== 'archivado').sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 4);
    return `<section class="tarjeta inclina"><h2>🔗 Recursos recientes <a class="mas" href="#biblioteca">Biblioteca</a></h2>
      ${lista.length ? `<ul class="lista">${lista.map((r) => `<li><a class="elemento" href="#recurso/${h(r.id)}"><span class="cuerpo"><span class="titulo">${r.favorito ? '⭐ ' : ''}${h(r.titulo || r.url)}</span>${etiquetaDemo(r)}<br><span class="detalle">${h(TIPOS_RECURSO[r.tipo])}${r.url ? ' · ' + h(dominio(r.url)) : ''}</span></span></a></li>`).join('')}</ul>` : vacio('📚', 'Guarda enlaces, vídeos e ideas en la Biblioteca.')}</section>`;
  },
};

function hoyPantalla(ctx, partes) {
  const ahora = new Date();
  const hoy = ctx.hoy();
  const aj = ctx.estado.ajustes;
  const personalizar = partes[0] === 'personalizar';
  const nada = !['clientes', 'eventos', 'tareas', 'notas', 'recursos', 'inmuebles'].some((c) => activos(ctx.estado[c]).length);
  const pendientesHoy = activos(ctx.estado.tareas).filter((t) => tareaAbierta(t) && t.fecha && t.fecha <= hoy).length;
  const citasHoy = eventosDelDia(ctx.estado, hoy).length;
  const vencidas = activos(ctx.estado.tareas).filter((t) => tareaAbierta(t) && t.fecha && t.fecha < hoy).length;
  const seguir = clientesSinSeguimiento(ctx.estado, hoy).length;
  const kpi = (n, texto, ancla, alerta = false) => `<a class="kpi${alerta && n ? ' alerta' : ''}" href="#${ancla}"><strong>${n}</strong><span>${h(texto)}</span></a>`;
  const cabecera = `<section class="tarjeta saludo inclina">
      <div class="texto-saludo">
        <h1>${h(saludo(aj.nombre, ahora))}</h1>
        <p><a href="#agenda/dia/${hoy}">${h(fechaLarga(hoy))}</a></p>
        <div class="kpis">
          ${kpi(citasHoy, citasHoy === 1 ? 'cita hoy' : 'citas hoy', `agenda/dia/${hoy}`)}
          ${kpi(pendientesHoy, pendientesHoy === 1 ? 'tarea para hoy' : 'tareas para hoy', 'tareas/hoy')}
          ${kpi(vencidas, vencidas === 1 ? 'vencida' : 'vencidas', 'tareas/vencidas', true)}
          ${kpi(seguir, 'a seguir', 'clientes', true)}
        </div>
      </div>
      <div class="escenario-logo" aria-hidden="true"><div class="logo3d"><img src="logo-jp.webp" alt="" width="1200" height="675" /></div></div>
    </section>
    <section class="tarjeta inclina"><h2>⚡ Acciones rápidas</h2>
      <div class="acciones-rapidas">
        <button class="accion-rapida" data-accion="ir" data-a="enviar">📨 Enviar WhatsApp</button>
        <button class="accion-rapida" data-accion="captura">💬 Escribir y organizar</button>
        <button class="accion-rapida" data-accion="ir" data-a="evento/nuevo">📅 Nueva cita</button>
        <button class="accion-rapida" data-accion="ir" data-a="tarea/nuevo">✅ Nueva tarea</button>
        <button class="accion-rapida" data-accion="ir" data-a="cliente/nuevo">👤 Nuevo cliente</button>
        <button class="accion-rapida" data-accion="ir" data-a="inmueble/nuevo">🏠 Nuevo inmueble</button>
        <button class="accion-rapida" data-accion="ir" data-a="recurso/nuevo">🔗 Guardar enlace</button>
        <button class="accion-rapida" data-accion="ir" data-a="recurso/nuevo?tipo=video">🎬 Guardar vídeo</button>
        <button class="accion-rapida" data-accion="ir" data-a="nota/nuevo">📝 Crear nota</button>
      </div></section>`;
  const bienvenida = nada ? `<section class="tarjeta inclina"><h2>👋 Empieza aquí</h2>
      <p>La agenda está vacía. Todo lo que guardes se queda <strong>en este aparato</strong> (no hay cuenta ni sincronización todavía).</p>
      <div class="fila-botones"><button class="btn primario" data-accion="ir" data-a="cliente/nuevo">Crear mi primer cliente</button>
      <button class="btn" data-accion="cargar-ejemplo">Probar con datos de ejemplo</button></div>
      <p class="detalle" style="color:var(--suave);font-size:.88rem">Los datos de ejemplo son ficticios, van marcados como EJEMPLO y se quitan de una vez en Ajustes.</p></section>` : '';
  if (personalizar) {
    return `${cabeceraPersonalizar()}<section class="tarjeta inclina"><h2>Orden y bloques visibles</h2>
      ${aj.bloques.map((b, i) => `<div class="bloque-orden"><label class="casilla"><input type="checkbox" data-cambio="bloque-visible" data-id="${h(b.id)}" ${b.visible ? 'checked' : ''} /> <span>${h(BLOQUES_PANEL[b.id])}</span></label>
        <span></span>
        <button class="btn pequeno" data-accion="bloque-mover" data-id="${h(b.id)}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${h(BLOQUES_PANEL[b.id])}">↑</button>
        <button class="btn pequeno" data-accion="bloque-mover" data-id="${h(b.id)}" data-d="1" ${i === aj.bloques.length - 1 ? 'disabled' : ''} aria-label="Bajar ${h(BLOQUES_PANEL[b.id])}">↓</button></div>`).join('')}
      <div class="fila-botones"><a class="btn primario" href="#hoy">Listo</a><button class="btn" data-accion="bloques-reset">Volver al orden original</button></div></section>`;
  }
  const bloques = aj.bloques.filter((b) => b.visible).map((b) => BLOQUE[b.id](ctx, hoy, ahora)).join('');
  return `${cabecera}${bienvenida}<div class="rejilla rejilla-2">${bloques}</div>
    <p style="text-align:center;margin-top:1rem"><a class="btn pequeno" href="#hoy/personalizar">⚙️ Personalizar el panel</a></p>`;
}
const cabeceraPersonalizar = () => '<div class="titulo-pantalla"><a class="atras" href="#hoy" aria-label="Volver">‹</a><h1>Personalizar Mi día</h1></div>';

export const pantallas = { hoy: hoyPantalla };

let temporizador;
export const acciones = {
  ir: (ctx, el) => ctx.ir(el.dataset.a),
  prioridad(ctx, el) {
    const aj = ctx.estado.ajustes;
    aj.prioridades[Number(el.dataset.i)] = el.value.slice(0, 140);
    aj.prioridadesFecha = ctx.hoy();
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ctx.guardar(), 300);
  },
  'prioridades-vaciar'(ctx) {
    ctx.estado.ajustes.prioridades = ['', '', ''];
    ctx.estado.ajustes.prioridadesFecha = ctx.hoy();
    ctx.guardar();
    ctx.repinta();
  },
  'bloque-visible'(ctx, el) {
    const b = ctx.estado.ajustes.bloques.find((x) => x.id === el.dataset.id);
    if (b) { b.visible = el.checked; ctx.guardar(); }
  },
  'bloque-mover'(ctx, el) {
    const lista = ctx.estado.ajustes.bloques;
    const i = lista.findIndex((x) => x.id === el.dataset.id);
    const j = i + Number(el.dataset.d);
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    ctx.guardar();
    ctx.repinta();
    document.querySelector(`[data-accion="bloque-mover"][data-id="${el.dataset.id}"][data-d="${el.dataset.d}"]:not([disabled])`)?.focus();
  },
  'bloques-reset'(ctx) {
    ctx.estado.ajustes.bloques = Object.keys(BLOQUES_PANEL).map((id) => ({ id, visible: true }));
    ctx.guardar();
    ctx.repinta();
  },
};
