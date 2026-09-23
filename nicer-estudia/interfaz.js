/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — interfaz
   Render puro: recibe el estado y un contexto, devuelve HTML. No guarda
   nada, no conoce a app.js y no toca localStorage. Todos los botones se
   marcan con data-accion y app.js los escucha por delegación.
   ═══════════════════════════════════════════════════════════════════ */

import { escapa, fechaHumana, fechaCorta, cuentaAtras, minutosATexto, plural, recorta, DIAS, DIAS_CORTOS, aISO } from './utiles.js';
import * as D from './datos.js';
import * as R from './repaso.js';
import * as Q from './cuestionario.js';
import { dibujaEsquema } from './esquema.js';
import { AMBIENTES } from './ambiente.js';
import * as L from './lecciones.js';

const pct = (n) => `${Math.round(n * 100)}%`;

/* ── Piezas pequeñas ────────────────────────────────────────────── */

function anillo(hechos, objetivo) {
  const p = Math.min(1, objetivo ? hechos / objetivo : 0);
  const r = 32, c = 2 * Math.PI * r;
  return `<div class="anillo">
    <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
      <circle cx="37" cy="37" r="${r}" fill="none" stroke="var(--borde)" stroke-width="7" />
      <circle cx="37" cy="37" r="${r}" fill="none" stroke="var(--azul)" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}"
        stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" />
    </svg>
    <div class="centro">
      <div class="num">${Math.round(hechos)}</div>
      <div class="uni">de ${objetivo}</div>
    </div>
    <span class="oculto">${pct(p)} del objetivo de hoy</span>
  </div>`;
}

const puntoColor = (estado, asignaturaId) =>
  `<span class="punto" style="background:${escapa(D.colorAsignatura(estado, asignaturaId))}"></span>`;

/* El compañero: una planta que crece con la racha. No es un adorno — es el
   único marcador que un chaval mira todos los días sin que se lo pidan. Se
   seca si se rompe la racha, y vuelve a brotar al día siguiente de volver. */
export const ETAPAS = [
  { desde: 0, nombre: 'Semilla', frase: 'Estudia hoy y brota.' },
  { desde: 1, nombre: 'Brote', frase: 'Ha salido. No la dejes ahora.' },
  { desde: 3, nombre: 'Planta', frase: 'Tres días seguidos. Esto ya es un hábito.' },
  { desde: 7, nombre: 'En flor', frase: 'Una semana entera. Muy pocos llegan aquí.' },
  { desde: 14, nombre: 'Árbol', frase: 'Dos semanas. Esto ya no lo tira nadie.' }
];

export const etapaDe = (dias) => [...ETAPAS].reverse().find((e) => dias >= e.desde) || ETAPAS[0];

export function mascota(dias, tamano = 96) {
  const nivel = ETAPAS.findIndex((e) => e === etapaDe(dias));
  const hojas = [];
  if (nivel >= 1) hojas.push('<path d="M32 42c-9 0-14-6-14-12 8-2 14 3 14 12z" fill="var(--verde)"/>');
  if (nivel >= 2) hojas.push('<path d="M32 34c9 0 14-6 14-13-8-2-14 4-14 13z" fill="var(--verde)"/>');
  if (nivel >= 3) hojas.push('<circle cx="32" cy="16" r="7" fill="var(--ambar)"/><circle cx="32" cy="16" r="3" fill="var(--papel)"/>');
  if (nivel >= 4) hojas.push('<path d="M32 26c-11-1-17-8-17-16 10-3 17 5 17 16z" fill="var(--verde)" opacity=".75"/>');
  const altura = [46, 42, 34, 24, 20][nivel];
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 52V${altura}" stroke="var(--verde)" stroke-width="3.5" stroke-linecap="round" fill="none"${dias ? '' : ' opacity=".35"'}/>
    ${dias ? hojas.join('') : '<circle cx="32" cy="46" r="5" fill="var(--tinta-2)" opacity=".5"/>'}
    <path d="M20 52h24l-3 9a2 2 0 0 1-2 2H25a2 2 0 0 1-2-2z" fill="var(--ambar)" opacity=".9"/>
  </svg>`;
}

function pastillaFecha(dias) {
  if (dias < 0) return `<span class="pastilla roja">Atrasado ${Math.abs(dias)} d</span>`;
  if (dias === 0) return '<span class="pastilla ambar">Para hoy</span>';
  if (dias === 1) return '<span class="pastilla">Mañana</span>';
  return `<span class="pastilla gris">En ${dias} días</span>`;
}

function selectorAsignatura(estado, seleccionada = '', nombre = 'asignatura') {
  const opciones = estado.asignaturas
    .map((a) => `<option value="${a.id}"${a.id === seleccionada ? ' selected' : ''}>${escapa(a.nombre)}</option>`)
    .join('');
  return `<select name="${nombre}"><option value="">— Sin asignatura —</option>${opciones}</select>`;
}

const tarea = (estado, t) => `
  <li class="tarea${t.hecha ? ' hecha' : ''}">
    <button class="marca" data-accion="alternar-tarea" data-id="${t.id}"
      aria-label="${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}">${t.hecha ? '✓' : ''}</button>
    <div class="cuerpo">
      <div class="qué">${escapa(t.titulo)}</div>
      <div class="meta">
        ${puntoColor(estado, t.asignaturaId)}
        <span style="font-size:.8rem;color:var(--tinta-2)">${escapa(D.nombreAsignatura(estado, t.asignaturaId))}</span>
        ${t.hecha ? '<span class="pastilla verde">Hecha</span>' : pastillaFecha(t.dias ?? 0)}
        ${t.prioridad === 'alta' && !t.hecha ? '<span class="pastilla roja">Prioridad</span>' : ''}
        ${t.repetir && t.repetir !== 'no' ? `<span class="pastilla gris">${t.repetir === 'diaria' ? 'Cada día' : 'Cada semana'}</span>` : ''}
      </div>
    </div>
    <button class="borrar" data-accion="borrar-tarea" data-id="${t.id}" aria-label="Borrar">✕</button>
  </li>`;

/* ── Vista: HOY ─────────────────────────────────────────────────── */

export function vistaHoy(estado, ctx) {
  const { hoy } = ctx;
  const tareas = D.pendientes(estado, hoy);
  const examenes = D.examenesProximos(estado, hoy);
  const cola = R.colaDeHoy(estado.tarjetas, hoy, estado.ajustes.tarjetasPorDia);
  const minutos = D.minutosDelDia(estado, hoy);
  const objetivo = estado.ajustes.objetivoDiario;
  const leccionesPendientes = (estado.lecciones || [])
    .filter((l) => !l.resumida && l.texto)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const plan = R.planDelDia({ tareas, examenes, tarjetasHoy: cola.length, minutosHechos: minutos, objetivo, leccionesPendientes }, hoy);
  const m = D.mochila(estado, hoy);

  const saludo = minutos >= objetivo
    ? '¡Objetivo de hoy cumplido!'
    : minutos > 0 ? 'Vas por buen camino' : `Hola, ${escapa(estado.alumno.nombre)}`;

  const frase = minutos >= objetivo
    ? 'Lo que hagas ahora ya es de propina.'
    : plan.length
      ? 'Esto es lo que toca. Nada más.'
      : 'Hoy no hay nada urgente. Buen momento para adelantar.';

  return `
  <section class="seccion">
    <div class="tarjeta hero">
      ${anillo(minutos, objetivo)}
      <div class="texto">
        <div class="saludo">${saludo}</div>
        <div class="frase">${frase}</div>
        <div style="margin-top:6px;font-size:.82rem;color:var(--tinta-2)">
          ${minutosATexto(minutos)} de estudio hoy · ${DIAS[new Date().getDay()]}
        </div>
      </div>
    </div>
    <button class="principal ancho grande" data-accion="empezar-foco" style="margin-top:10px">
      ▶ Empezar ${estado.ajustes.pomodoro} minutos
    </button>
    <button class="fantasma ancho mini" data-accion="empezar-cinco" style="margin-top:6px">
      ¿No te apetece? Prueba solo 5 minutos
    </button>
  </section>

  <section class="seccion">
    <header><h2>Qué toca ahora</h2><span class="extra">${plural(plan.length, 'cosa', 'cosas')}</span></header>
    ${plan.length ? `<div class="plan">${plan.map((p) => `
      <div class="paso ${p.tipo}">
        <div class="cuerpo">
          <div class="qué">${escapa(p.titulo)}</div>
          <div class="por">${escapa(p.aviso)}</div>
        </div>
        ${p.tipo === 'repaso' ? '<button class="mini principal" data-accion="ir-tarjetas">Repasar</button>' : ''}
        ${p.tipo === 'leccion' ? `<button class="mini principal" data-accion="abrir-leccion" data-id="${p.ref}">Abrir</button>` : ''}
        ${p.tipo === 'examen' && (examenes.find((e) => e.id === p.ref)?.dias ?? 99) <= 3
          ? `<button class="mini principal" data-accion="examen-prueba" data-id="${p.ref}">🧪 Prueba</button>` : ''}
        ${p.tipo === 'tarea' || p.tipo === 'atrasada' ? `<button class="mini" data-accion="alternar-tarea" data-id="${p.ref}">Hecha</button>` : ''}
      </div>`).join('')}</div>`
      : '<div class="vacio">Nada pendiente. Si tienes deberes, apúntalos en Agenda.</div>'}
  </section>

  ${examenes.length ? `
  <section class="seccion">
    <header><h2>Próximo examen</h2></header>
    ${tarjetaExamen(estado, examenes[0], hoy)}
  </section>` : ''}

  <section class="seccion">
    <header><h2>Mochila para ${fechaHumana(m.dia, hoy)}</h2></header>
    <div class="tarjeta">
      ${m.clases.length || m.entregas.length || m.examenes.length ? `
        <ul class="mochila">
          ${m.clases.map((c) => `<li>${puntoColor(estado, c.asignaturaId)}
            <span>${escapa(D.nombreAsignatura(estado, c.asignaturaId))}</span>
            ${c.hora ? `<span style="margin-left:auto;color:var(--tinta-2);font-size:.82rem">${escapa(c.hora)}</span>` : ''}</li>`).join('')}
          ${m.entregas.map((t) => `<li>📌 <span>Entregar: ${escapa(t.titulo)}</span></li>`).join('')}
          ${m.examenes.map((e) => `<li>📝 <span>Examen: ${escapa(e.titulo)}</span></li>`).join('')}
        </ul>`
        : '<div class="vacio" style="border:0;padding:4px">Pon tu horario en Yo → Horario y aquí verás qué meter en la mochila.</div>'}
    </div>
  </section>`;
}

function tarjetaExamen(estado, e, hoy) {
  const foco = R.focoDeHoy(e, hoy);
  return `<div class="tarjeta">
    <div style="display:flex;align-items:center;gap:8px">
      ${puntoColor(estado, e.asignaturaId)}
      <strong>${escapa(e.titulo)}</strong>
      <span class="pastilla ${e.dias <= 2 ? 'roja' : 'ambar'}" style="margin-left:auto">${cuentaAtras(e.fecha, hoy)}</span>
    </div>
    <div style="color:var(--tinta-2);font-size:.84rem;margin-top:4px">
      ${escapa(D.nombreAsignatura(estado, e.asignaturaId))} · ${fechaHumana(e.fecha, hoy)}
    </div>
    ${e.temas ? `<div style="margin-top:8px;font-size:.9rem">${escapa(e.temas)}</div>` : ''}
    ${foco ? `<div class="aviso-caja" style="margin-top:10px">
      <strong>${escapa(foco.foco)}</strong> · ${escapa(foco.detalle)}
    </div>` : ''}
    <div class="fila" style="margin-top:10px">
      <button class="mini fantasma" data-accion="ver-plan" data-id="${e.id}">Ver plan completo</button>
      <button class="mini" data-accion="calendario-examen" data-id="${e.id}">📅 Avisos en el móvil</button>
    </div>
    <button class="principal ancho" style="margin-top:8px" data-accion="examen-prueba" data-id="${e.id}">
      🧪 Examen de prueba${(e.leccionIds || []).length ? ` · ${plural(e.leccionIds.length, 'lección', 'lecciones')}` : ''}
    </button>
  </div>`;
}

/* ── Vista: AGENDA ──────────────────────────────────────────────── */

export function vistaAgenda(estado, ctx) {
  const { hoy } = ctx;
  const pendientes = D.pendientes(estado, hoy);
  const hechas = estado.tareas.filter((t) => t.hecha).slice(-6).reverse();
  const examenes = D.examenesProximos(estado, hoy, 60);

  return `
  <section class="seccion">
    <header><h2>Deberes y trabajos</h2><span class="extra">${plural(pendientes.length, 'pendiente', 'pendientes')}</span></header>
    <button class="principal ancho" data-accion="nueva-tarea">+ Apuntar deberes</button>
    ${pendientes.length ? `<div class="tarjeta" style="margin-top:10px"><ul>${pendientes.map((t) => tarea(estado, t)).join('')}</ul></div>`
      : '<div class="vacio" style="margin-top:10px">Nada pendiente. Apunta los deberes nada más salir de clase: es cuando te acuerdas.</div>'}
    ${hechas.length ? `<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--tinta-2);font-size:.86rem">Ya hechas (${hechas.length})</summary>
      <div class="tarjeta" style="margin-top:8px"><ul>${hechas.map((t) => tarea(estado, t)).join('')}</ul></div></details>` : ''}
  </section>

  <section class="seccion">
    <header><h2>Exámenes</h2><span class="extra">${examenes.length}</span></header>
    <button class="ancho" data-accion="nuevo-examen">+ Apuntar examen</button>
    ${examenes.length ? examenes.map((e) => `<div style="margin-top:10px">${tarjetaExamen(estado, e, hoy)}</div>`).join('')
      : '<div class="vacio" style="margin-top:10px">Sin exámenes apuntados. En cuanto sepas la fecha, ponla: la app te reparte el estudio sola.</div>'}
  </section>`;
}

export function vistaPlan(estado, examen, hoy) {
  const plan = R.planExamen(examen, hoy);
  return `<p style="color:var(--tinta-2);font-size:.88rem;margin-bottom:10px">
      ${escapa(examen.titulo)} · ${fechaHumana(examen.fecha, hoy)} · ${cuentaAtras(examen.fecha, hoy)}
    </p>
    ${plan.map((p) => `<div class="paso ${p.hecho ? 'libre' : 'examen'}" style="margin-bottom:8px">
      <div class="cuerpo">
        <div class="qué">${escapa(p.foco)} <span class="pastilla gris">${fechaHumana(p.fecha, hoy)}</span></div>
        <div class="por">${escapa(p.detalle)}</div>
      </div>
    </div>`).join('')}
    <p style="font-size:.84rem;color:var(--tinta-2)">Estudiar en varios días cortos se recuerda mucho mejor que una noche entera.</p>`;
}

/* ── Vista: ESTUDIAR ────────────────────────────────────────────
   Cuatro materiales, una sola pestaña: tarjetas para memorizar, test para
   comprobar, esquema para entender el conjunto y apuntes de donde sale
   todo lo demás. */

const SUBS = [
  { id: 'lecciones', nombre: 'Lecciones' },
  { id: 'tarjetas', nombre: 'Tarjetas' },
  { id: 'test', nombre: 'Test' },
  { id: 'esquemas', nombre: 'Esquemas' }
];

export function vistaEstudiar(estado, ctx) {
  // 'apuntes' era una pestaña propia: ahora las notas sueltas van en Lecciones.
  const pedida = ctx.sub === 'apuntes' ? 'lecciones' : ctx.sub;
  const sub = SUBS.some((x) => x.id === pedida) ? pedida : 'tarjetas';
  const contadores = {
    tarjetas: R.colaDeHoy(estado.tarjetas, ctx.hoy, estado.ajustes.tarjetasPorDia).length,
    test: 0,
    esquemas: (estado.esquemas || []).length,
    lecciones: (estado.lecciones || []).length
  };

  const pestanas = `<div class="pestanas" role="tablist">
    ${SUBS.map((x) => `<button role="tab" data-accion="sub" data-sub="${x.id}"
      ${x.id === sub ? 'aria-selected="true"' : ''}>${x.nombre}${contadores[x.id] ? ` <span class="cuenta">${contadores[x.id]}</span>` : ''}</button>`).join('')}
  </div>`;

  const pintor = { lecciones: subLecciones, tarjetas: subTarjetas, test: subTest, esquemas: subEsquemas }[sub];
  return pestanas + pintor(estado, ctx);
}

function subTarjetas(estado, ctx) {
  const { hoy, tarjetaActual, respuestaVisible, hechasHoy } = ctx;
  const cola = R.colaDeHoy(estado.tarjetas, hoy, estado.ajustes.tarjetasPorDia);
  const prevision = R.previsionRepaso(estado.tarjetas, hoy);
  const total = estado.tarjetas.length;

  const cuerpo = !total
    ? `<div class="vacio">
        Todavía no hay tarjetas.<br /><br />
        Una tarjeta es una pregunta y su respuesta. Al hacerte la pregunta a ti mismo
        (en vez de releer) se te queda mucho mejor.
      </div>`
    : !cola.length
      ? `<div class="tarjeta flash">
          <div class="pregunta">Repaso de hoy terminado ✅</div>
          <p style="color:var(--tinta-2);font-size:.9rem">Vuelve mañana: la app te dirá exactamente qué toca.</p>
          <button class="mini fantasma" data-accion="sub" data-sub="test">Ponte a prueba con un test</button>
        </div>`
      : tarjetaActual
        ? `<div class="tarjeta flash">
            <div class="pastilla gris" style="align-self:center">${escapa(D.nombreAsignatura(estado, tarjetaActual.asignaturaId))} · caja ${tarjetaActual.caja}</div>
            <div class="pregunta">${escapa(tarjetaActual.pregunta)}</div>
            ${respuestaVisible ? `<div class="respuesta">${escapa(tarjetaActual.respuesta)}</div>` : ''}
            ${ctx.puedeLeer ? `<button class="mini fantasma" style="align-self:center" data-accion="escuchar-tarjeta"
              aria-label="Escuchar">🔊 ${tarjetaActual.idioma === 'en' ? 'Listen' : 'Escuchar'}</button>` : ''}
          </div>
          ${respuestaVisible
            ? `<div class="fila" style="margin-top:10px">
                <button class="peligro" data-accion="fallo">No la sabía</button>
                <button class="principal" data-accion="acierto">La sabía</button>
              </div>`
            : '<button class="principal ancho grande" style="margin-top:10px" data-accion="ver-respuesta">Ver la respuesta</button>'}
          ${ctx.teclado ? '<p class="atajos">Teclado: <kbd>espacio</kbd> ver respuesta · <kbd>1</kbd> no la sabía · <kbd>2</kbd> la sabía</p>' : ''}`
        : '';

  return `
  <section class="seccion">
    <header><h2>Repaso de hoy</h2><span class="extra">${hechasHoy} de ${hechasHoy + cola.length}</span></header>
    <div class="barra-progreso" style="margin-bottom:10px">
      <i style="width:${pct(hechasHoy / Math.max(1, hechasHoy + cola.length))}"></i>
    </div>
    ${cuerpo}
  </section>

  <section class="seccion">
    <header><h2>Tus tarjetas</h2><span class="extra">${total}</span></header>
    <div class="fila">
      <button class="principal" data-accion="nueva-tarjeta">+ Nueva tarjeta</button>
      <button data-accion="ir" data-vista="profe">Crearlas con el Profe</button>
    </div>
    ${total ? `<div class="tarjeta" style="margin-top:10px">
      <ul class="mochila">${prevision.map((p) => `<li>
        ${p.fecha === hoy ? '<strong>Hoy</strong>' : escapa(fechaHumana(p.fecha, hoy))}
        <span style="margin-left:auto;color:var(--tinta-2)">${plural(p.cuantas, 'tarjeta', 'tarjetas')}</span>
      </li>`).join('')}</ul>
    </div>
    <details style="margin-top:10px"><summary style="cursor:pointer;color:var(--tinta-2);font-size:.86rem">Ver y borrar tarjetas</summary>
      <div class="tarjeta" style="margin-top:8px"><ul>
        ${estado.tarjetas.slice().reverse().map((c) => `<li class="tarea">
          <div class="cuerpo">
            <div class="qué">${escapa(c.pregunta)}</div>
            <div class="meta">${puntoColor(estado, c.asignaturaId)}
              <span style="font-size:.8rem;color:var(--tinta-2)">${escapa(D.nombreAsignatura(estado, c.asignaturaId))} · caja ${c.caja} · ${escapa(fechaHumana(c.proximo, hoy))}</span>
            </div>
          </div>
          <button class="borrar" data-accion="borrar-tarjeta" data-id="${c.id}" aria-label="Borrar">✕</button>
        </li>`).join('')}
      </ul></div>
    </details>` : ''}`;
}

/* ── Lecciones y libros ───────────────────────────────────────────
   Sus apuntes de todas las materias, ordenados como en la mochila:
   asignatura → libro → lección. */

function estadoLeccion(l, ctx) {
  if (ctx.resumiendo === l.id) return '<span class="pastilla ambar">Clara la está leyendo…</span>';
  return l.resumida
    ? '<span class="pastilla verde">✓ Resumida</span>'
    : '<span class="pastilla gris">Sin resumir</span>';
}

function subLecciones(estado, ctx) {
  if (ctx.leccionAbierta) {
    const abierta = (estado.lecciones || []).find((l) => l.id === ctx.leccionAbierta);
    if (abierta) return vistaLeccion(estado, abierta, ctx);
  }
  const filtro = ctx.filtroAsig || '';
  const grupos = D.leccionesPorAsignatura(estado, filtro || null);
  const conLecciones = new Set((estado.lecciones || []).map((l) => l.asignaturaId).filter(Boolean));
  const libros = estado.libros || [];

  return `<section class="seccion">
    <header><h2>Mis lecciones</h2><span class="extra">${plural((estado.lecciones || []).length, 'lección', 'lecciones')}</span></header>
    <button class="principal ancho grande" data-accion="nueva-leccion">📖 Meter la lección que estoy estudiando</button>
    <p style="font-size:.82rem;color:var(--tinta-2);margin-top:6px">
      Escríbela, pégala o hazle fotos a las páginas del libro. Clara te hace el resumen, los apuntes
      y los conceptos clave, y de ahí salen tarjetas, esquema y examen de prueba.
    </p>
    ${conLecciones.size > 1 ? `<div class="chips" style="margin-top:10px">
      <button class="chip${!filtro ? ' chip--activo' : ''}" data-accion="filtro-asig" data-id="">Todas</button>
      ${estado.asignaturas.filter((a) => conLecciones.has(a.id)).map((a) => `<button class="chip${filtro === a.id ? ' chip--activo' : ''}"
        data-accion="filtro-asig" data-id="${a.id}">${escapa(a.nombre)}</button>`).join('')}
    </div>` : ''}
    ${grupos.length ? grupos.map((g) => `<div class="grupo-materia">
      <h3>${g.asignatura ? `${puntoColor(estado, g.asignatura.id)} ${escapa(g.asignatura.nombre)}` : 'Sin asignatura'}</h3>
      ${g.lecciones.map((l) => `<div class="tarjeta leccion-fila">
        <div class="cuerpo">
          <div class="qué">${escapa(l.titulo)}</div>
          <div class="meta">
            ${l.libroId ? `<span style="font-size:.8rem;color:var(--tinta-2)">📘 ${escapa(D.libro(estado, l.libroId)?.titulo || '')}</span>` : ''}
            ${estadoLeccion(l, ctx)}
          </div>
        </div>
        <button class="mini principal" data-accion="abrir-leccion" data-id="${l.id}">Abrir</button>
      </div>`).join('')}
    </div>`).join('')
      : `<div class="vacio" style="margin-top:10px">Todavía no has metido ninguna lección.<br /><br />
          Empieza por la que tengas más cerca del examen.</div>`}
  </section>

  <section class="seccion">
    <header><h2>Mis libros</h2><span class="extra">${plural(libros.length, 'libro', 'libros')}</span></header>
    <div class="tarjeta">
      ${libros.length ? `<ul class="mochila">${estado.asignaturas
        .map((a) => ({ a, suyos: libros.filter((l) => l.asignaturaId === a.id) }))
        .concat([{ a: null, suyos: libros.filter((l) => !l.asignaturaId) }])
        .filter((x) => x.suyos.length)
        .map(({ a, suyos }) => suyos.map((l) => `<li>
          ${a ? puntoColor(estado, a.id) : '<span class="punto" style="background:var(--borde)"></span>'}
          <span><strong>${escapa(l.titulo)}</strong>
            <span style="color:var(--tinta-2);font-size:.82rem"> · ${escapa(a?.nombre || 'Sin asignatura')}${l.editorial ? ` · ${escapa(l.editorial)}` : ''}</span></span>
          <button class="borrar" style="margin-left:auto" data-accion="borrar-libro" data-id="${l.id}" aria-label="Borrar libro">✕</button>
        </li>`).join('')).join('')}</ul>`
        : '<p style="color:var(--tinta-2);font-size:.88rem">Apunta tus libros de texto: así cada lección sabe de qué libro sale.</p>'}
      <button class="mini" style="margin-top:10px" data-accion="nuevo-libro">+ Añadir un libro</button>
      <p style="font-size:.8rem;color:var(--tinta-2);margin-top:8px">¿Te falta una asignatura? Añádela en Yo → Asignaturas.</p>
    </div>
  </section>

  ${subApuntes(estado, ctx)}`;
}

function vistaLeccion(estado, l, ctx) {
  const asignatura = D.asignatura(estado, l.asignaturaId);
  const libroL = D.libro(estado, l.libroId);
  const resumiendo = ctx.resumiendo === l.id;
  const fotosEnMemoria = (ctx.fotosLeccion?.[l.id] || []).length;
  const puedeResumir = Boolean(l.texto) || fotosEnMemoria > 0;

  return `<section class="seccion">
    <button class="mini fantasma" data-accion="cerrar-leccion">← Mis lecciones</button>
    <div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px">
        ${asignatura ? puntoColor(estado, asignatura.id) : ''}
        <span style="font-size:.84rem;color:var(--tinta-2)">${escapa(asignatura?.nombre || 'Sin asignatura')}${libroL ? ` · 📘 ${escapa(libroL.titulo)}` : ''}</span>
      </div>
      <h2 style="font-size:1.2rem;margin-top:6px">${escapa(l.titulo)}</h2>
      <div style="margin-top:6px">${estadoLeccion(l, ctx)}</div>
    </div>

    ${resumiendo ? `<div class="tarjeta flash" style="margin-top:10px">
        <span class="escribiendo" style="align-self:center"><i></i><i></i><i></i></span>
        <p>Clara está leyendo tu lección y haciéndote los apuntes.<br />Tarda unos segundos.</p>
      </div>`
      : !l.resumida ? `<div class="tarjeta" style="margin-top:10px">
        <p style="font-size:.92rem">${puedeResumir
          ? 'Lista para que Clara te haga el resumen, los apuntes y los conceptos clave.'
          : 'No queda el texto ni las fotos de esta lección. Ábrela en «Editar» y vuelve a meter el texto o las fotos.'}</p>
        <button class="principal ancho grande" style="margin-top:10px" data-accion="resumir-leccion" data-id="${l.id}"${puedeResumir ? '' : ' disabled'}>
          ✨ Resumir y hacer apuntes
        </button>
        ${fotosEnMemoria ? `<p style="font-size:.8rem;color:var(--tinta-2);margin-top:6px">${plural(fotosEnMemoria, 'foto lista', 'fotos listas')} para mandar.</p>` : ''}
      </div>` : ''}

    ${l.resumen ? `<div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px"><h3>Resumen</h3>
        ${ctx.puedeLeer ? `<button class="mini fantasma" style="margin-left:auto" data-accion="escuchar-resumen" data-id="${l.id}">🔊 Escuchar</button>` : ''}
      </div>
      <p class="texto-leccion">${escapa(l.resumen)}</p>
    </div>` : ''}

    ${l.apuntes?.length ? `<div class="tarjeta" style="margin-top:10px">
      <h3>Apuntes</h3>
      ${l.apuntes.map((a) => `<div class="apartado">
        <div class="apartado-titulo">${escapa(a.titulo)}</div>
        <ul>${a.puntos.map((p) => `<li>${escapa(p)}</li>`).join('')}</ul>
      </div>`).join('')}
    </div>` : ''}

    ${l.conceptos?.length ? `<div class="tarjeta" style="margin-top:10px">
      <h3>Conceptos clave</h3>
      <dl class="conceptos">${l.conceptos.map((c) => `<dt>${escapa(c.termino)}</dt><dd>${escapa(c.definicion)}</dd>`).join('')}</dl>
    </div>` : ''}

    ${l.resumida ? `<div class="acciones-leccion">
      <button class="principal" data-accion="examen-leccion" data-id="${l.id}">🧪 Examen de prueba</button>
      ${l.conceptos?.length ? `<button data-accion="tarjetas-leccion" data-id="${l.id}">🃏 ${plural(l.conceptos.length, 'tarjeta', 'tarjetas')} de repaso</button>` : ''}
      ${l.apuntes?.length ? `<button data-accion="esquema-leccion" data-id="${l.id}">🗺️ Esquema</button>` : ''}
    </div>` : ''}

    ${l.texto ? `<details style="margin-top:12px"><summary style="cursor:pointer;color:var(--tinta-2);font-size:.86rem">Texto original</summary>
      <div class="tarjeta texto-leccion" style="margin-top:8px">${escapa(l.texto)}</div></details>` : ''}

    <div class="fila" style="margin-top:12px">
      <button class="mini" data-accion="editar-leccion" data-id="${l.id}">✏️ Editar</button>
      ${l.resumida && puedeResumir ? `<button class="mini" data-accion="resumir-leccion" data-id="${l.id}">🔁 Volver a resumir</button>` : ''}
      <button class="mini peligro" data-accion="borrar-leccion" data-id="${l.id}">Borrar</button>
    </div>
  </section>`;
}

/* ── Test (idea tomada de Cuestia, pero con SUS tarjetas y sin cuenta) ── */
function subTest(estado, ctx) {
  const t = ctx.test;
  const historial = (estado.tests || []).slice(-5).reverse();

  if (t && t.fase === 'corrigiendo') {
    return `<section class="seccion"><div class="tarjeta flash">
      <span class="escribiendo" style="align-self:center"><i></i><i></i><i></i></span>
      <p>${t.preparando ? 'Clara está preparando tu examen de prueba con tus lecciones…' : 'Clara está corrigiendo tus respuestas…'}</p>
    </div></section>`;
  }

  if (t && t.fase === 'desarrollo') {
    return `<section class="seccion">
      <header><h2>Preguntas de desarrollo</h2><span class="extra">${escapa(t.titulo)}</span></header>
      <p style="font-size:.86rem;color:var(--tinta-2);margin-bottom:10px">
        Contesta con tus palabras, como en el examen. No hace falta que sea perfecto: Clara te dirá qué falta.
      </p>
      ${t.desarrollo.map((p, i) => `<div class="tarjeta" style="margin-top:10px">
        <div style="font-weight:650">${i + 1}. ${escapa(p.pregunta)}
          <span class="pastilla gris">${plural(p.puntos, 'punto', 'puntos')}</span></div>
        <textarea class="respuesta-desarrollo" data-i="${i}" rows="5" placeholder="Tu respuesta…" style="margin-top:8px">${escapa(t.respuestasDes[i] || '')}</textarea>
      </div>`).join('')}
      <button class="principal ancho grande" style="margin-top:12px" data-accion="entregar-examen">Entregar el examen</button>
      <button class="fantasma ancho mini" style="margin-top:8px" data-accion="cerrar-test">Dejarlo para luego</button>
    </section>`;
  }

  if (t && t.terminado) {
    const { resultado } = t;
    const conDesarrollo = t.desarrollo?.length > 0;
    return `<section class="seccion">
      <div class="tarjeta flash">
        <div class="pastilla ${resultado.nota >= 5 ? 'verde' : 'roja'}" style="align-self:center">Nota ${resultado.nota}</div>
        <div class="pregunta">${conDesarrollo
          ? `Test: ${resultado.aciertos} de ${resultado.total} bien`
          : `${resultado.aciertos} de ${resultado.total} bien`}</div>
        <p style="color:var(--tinta-2);font-size:.92rem">${escapa(Q.comentario(resultado))}</p>
        ${conDesarrollo && !t.correccion ? `<p style="font-size:.84rem;color:var(--ambar)">
          Clara no ha podido corregir el desarrollo (¿sin conexión?). La nota es solo del test; abajo tienes qué debía incluir cada respuesta.</p>` : ''}
        ${resultado.falladas.length ? `<p style="font-size:.86rem;color:var(--tinta-2)">
          Lo que fallaste vuelve al repaso de mañana automáticamente.</p>` : ''}
      </div>
      ${resultado.falladas.length ? `<div class="tarjeta" style="margin-top:10px">
        <h3 style="margin-bottom:8px">Lo que se te escapó</h3>
        <ul class="mochila">${resultado.falladas.map((p) => `<li style="display:block">
          <div style="font-weight:600">${escapa(p.pregunta)}</div>
          <div style="color:var(--verde);font-size:.88rem">${escapa(p.opciones[p.correcta])}</div>
        </li>`).join('')}</ul>
      </div>` : ''}
      ${conDesarrollo ? `<div class="tarjeta" style="margin-top:10px">
        <h3 style="margin-bottom:8px">Desarrollo</h3>
        ${t.desarrollo.map((p, i) => {
          const c = t.correccion?.[i];
          return `<div class="apartado">
            <div class="apartado-titulo">${i + 1}. ${escapa(p.pregunta)}
              ${c ? `<span class="pastilla ${c.nota >= 5 ? 'verde' : 'roja'}">${c.nota}</span>` : ''}</div>
            <div style="font-size:.86rem;color:var(--tinta-2);white-space:pre-wrap">Tu respuesta: ${escapa(t.respuestasDes[i] || '(en blanco)')}</div>
            ${c ? `${c.bien ? `<div style="font-size:.88rem;margin-top:4px">👍 ${escapa(c.bien)}</div>` : ''}
              ${c.mejorar ? `<div style="font-size:.88rem;margin-top:2px">🔧 ${escapa(c.mejorar)}</div>` : ''}
              ${c.modelo ? `<div class="modelo">Respuesta de 10: ${escapa(c.modelo)}</div>` : ''}`
              : p.criterios ? `<div class="modelo">Debía incluir: ${escapa(p.criterios)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="fila" style="margin-top:10px">
        <button data-accion="cerrar-test">Cerrar</button>
        ${t.origen ? `<button class="principal" data-accion="${t.origen.accion}" data-id="${t.origen.id}">Otro examen</button>`
          : '<button class="principal" data-accion="test-tarjetas">Otro test</button>'}
      </div>
    </section>`;
  }

  if (t) {
    const p = t.preguntas[t.i];
    const elegida = t.respuestas[t.i];
    const contestada = elegida !== undefined && elegida !== null;
    return `<section class="seccion">
      <header><h2>Pregunta ${t.i + 1} de ${t.preguntas.length}</h2>
        <span class="extra">${escapa(t.titulo)}</span></header>
      <div class="barra-progreso" style="margin-bottom:10px"><i style="width:${pct(t.i / t.preguntas.length)}"></i></div>
      <div class="tarjeta">
        <div class="pregunta" style="font-size:1.08rem;font-weight:650">${escapa(p.pregunta)}</div>
        <div style="display:grid;gap:8px;margin-top:14px">
          ${p.opciones.map((o, i) => {
            let clase = '';
            if (contestada && i === p.correcta) clase = ' opcion--bien';
            else if (contestada && i === elegida) clase = ' opcion--mal';
            return `<button class="opcion${clase}" data-accion="responder" data-i="${i}"${contestada ? ' disabled' : ''}>${escapa(o)}</button>`;
          }).join('')}
        </div>
      </div>
      ${ctx.teclado ? '<p class="atajos">Teclado: <kbd>1</kbd>-<kbd>4</kbd> eligen · <kbd>Enter</kbd> siguiente</p>' : ''}
      ${contestada ? `<button class="principal ancho" style="margin-top:10px" data-accion="siguiente-pregunta">
        ${t.i + 1 < t.preguntas.length ? 'Siguiente' : 'Ver la nota'}</button>` : ''}
      <button class="fantasma ancho mini" style="margin-top:8px" data-accion="cerrar-test">Dejarlo para luego</button>
    </section>`;
  }

  const suficientes = estado.tarjetas.length >= Q.MIN_TARJETAS;
  return `<section class="seccion">
    <header><h2>Ponte a prueba</h2></header>
    <div class="tarjeta">
      <p style="font-size:.92rem;color:var(--tinta-2)">
        Un test te dice si de verdad te lo sabes. Releer engaña; elegir entre cuatro opciones, no.
      </p>
      <button class="principal ancho grande" style="margin-top:12px" data-accion="test-tarjetas"${suficientes ? '' : ' disabled'}>
        Test con mis tarjetas
      </button>
      ${suficientes ? '<p style="font-size:.8rem;color:var(--tinta-2);margin-top:6px">Funciona sin conexión.</p>'
        : `<p style="font-size:.84rem;color:var(--tinta-2);margin-top:6px">
            Te hacen falta ${Q.MIN_TARJETAS} tarjetas para que las opciones falsas tengan sentido. Llevas ${estado.tarjetas.length}.</p>`}
      <button class="ancho" style="margin-top:10px" data-accion="ir" data-vista="profe">Pedirle un test al Profe</button>
    </div>
  </section>

  ${historial.length ? `<section class="seccion">
    <header><h2>Tus últimos tests</h2></header>
    <div class="tarjeta"><ul class="mochila">
      ${historial.map((h) => `<li>
        ${puntoColor(estado, h.asignaturaId)}
        <span>${escapa(h.titulo)}</span>
        <span style="margin-left:auto;color:var(--tinta-2);font-size:.8rem">${escapa(fechaHumana(h.fecha, ctx.hoy))}</span>
        <span class="pastilla ${h.nota >= 5 ? 'verde' : 'roja'}">${h.nota}</span>
      </li>`).join('')}
    </ul></div>
  </section>` : ''}`;
}

/* ── Esquemas (la idea de Visme, en versión útil para un examen) ── */
function subEsquemas(estado, ctx) {
  const esquemas = (estado.esquemas || []).slice().reverse();
  return `<section class="seccion">
    <header><h2>Esquemas</h2><span class="extra">${esquemas.length}</span></header>
    <div class="tarjeta">
      <p style="font-size:.92rem;color:var(--tinta-2)">
        Ver el tema entero de un vistazo antes de memorizar: así las tarjetas tienen de dónde colgarse.
        Pídeselo al Profe («hazme un esquema de…») y aquí lo tendrás para verlo y descargarlo.
      </p>
      <button class="principal ancho" style="margin-top:10px" data-accion="ir" data-vista="profe">Pedir un esquema</button>
    </div>
    ${esquemas.map((e) => `<div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px">
        ${puntoColor(estado, e.asignaturaId)}
        <strong>${escapa(e.titulo)}</strong>
        <span style="margin-left:auto;color:var(--tinta-2);font-size:.8rem">${escapa(fechaHumana(e.fecha, ctx.hoy))}</span>
      </div>
      <div class="lienzo-esquema">${dibujaEsquema(e, { color: D.colorAsignatura(estado, e.asignaturaId) }).svg}</div>
      <div class="fila" style="margin-top:10px">
        <button class="mini principal" data-accion="ver-esquema" data-id="${e.id}">Verlo grande</button>
        <button class="mini" data-accion="descargar-esquema" data-id="${e.id}">Descargar PNG</button>
        <button class="mini peligro" data-accion="borrar-esquema" data-id="${e.id}">Borrar</button>
      </div>
    </div>`).join('')}
  </section>`;
}

/* ── Apuntes (lo de Notion que de verdad usa un alumno de ESO) ── */
function subApuntes(estado, ctx) {
  const apuntes = D.apuntesDe(estado);
  return `<section class="seccion">
    <header><h2>Notas sueltas</h2><span class="extra">${apuntes.length}</span></header>
    <button class="ancho" data-accion="nuevo-apunte">+ Escribir una nota</button>
    ${apuntes.length ? apuntes.map((n) => `<div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px">
        ${puntoColor(estado, n.asignaturaId)}
        <strong>${escapa(n.titulo)}</strong>
        <span style="margin-left:auto;color:var(--tinta-2);font-size:.8rem">${escapa(fechaHumana(n.fecha, ctx.hoy))}</span>
      </div>
      <p style="margin-top:8px;font-size:.9rem;color:var(--tinta-2);white-space:pre-wrap">${escapa(recorta(n.texto, 220))}</p>
      <div class="fila" style="margin-top:10px">
        <button class="mini" data-accion="editar-apunte" data-id="${n.id}">Abrir</button>
        <button class="mini principal" data-accion="tarjetas-de-apunte" data-id="${n.id}">Hacer tarjetas</button>
        <button class="mini peligro" data-accion="borrar-apunte" data-id="${n.id}">Borrar</button>
      </div>
    </div>`).join('')
      : `<div class="vacio" style="margin-top:10px">
          Lo que quieras tener a mano y no es una lección: lo que dictó el profe,
          cómo se hace un tipo de ejercicio, un aviso del tutor…
        </div>`}
  </section>`;
}

/* ── Vista: PROFE ───────────────────────────────────────────────── */

/* ── Vista: CLARA ──────────────────────────────────────────────
   La pestaña de dudas es Clara, la misma asistente de su padre con el
   sombrero de profesora. Se le puede escribir, hablar o mandar una foto. */

const DIAS_HORARIO = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const SUGERENCIAS = [
  { id: 'duda', texto: '🤔 No entiendo algo', rellena: 'No entiendo ' },
  { id: 'ejercicio', texto: '📷 Foto de un ejercicio', foto: true, rellena: '¿Me ayudas con este ejercicio? No me des la solución, explícame cómo se hace.' },
  { id: 'horario', texto: '🗓️ Foto de mi horario', foto: true, rellena: 'Esta es la foto de mi horario de clases. ¿Me lo pones en la app?' },
  { id: 'test', texto: '🧪 Ponme un test', rellena: 'Ponme un test del tema ' },
  { id: 'esquema', texto: '🗺️ Hazme un esquema', rellena: 'Hazme un esquema de ' },
  { id: 'trabajo', texto: '🔍 Busca info para un trabajo', rellena: 'Tengo que hacer un trabajo sobre ' },
  { id: 'ingles', texto: '🇬🇧 Practicar inglés', rellena: "Let's practise English. Ask me simple questions about my day and correct my mistakes." }
];

function burbujaClara(m, i, ctx) {
  // Sin saltos de línea en la plantilla: la burbuja respeta los espacios
  // (white-space: pre-wrap) y cada salto dejaba un hueco en blanco.
  const pie = [
    m.buscado ? '<span class="pastilla gris">🔍 Ha buscado en internet</span>' : '',
    ctx.puedeLeer ? `<button class="mini fantasma" data-accion="escuchar" data-i="${i}" aria-label="Escuchar la respuesta">🔊 Escuchar</button>` : ''
  ].join('');
  return `<div class="burbuja profe">${escapa(m.texto)}${pie ? `<div class="pie-burbuja">${pie}</div>` : ''}</div>`;
}

function burbujaAlumno(m) {
  const foto = m.miniatura
    ? `<img class="foto-chat" src="${m.miniatura}" alt="Foto enviada" />`
    : m.foto ? '<span class="pastilla gris">📷 Foto</span>' : '';
  return `<div class="burbuja yo">${foto}${m.texto ? escapa(m.texto) : ''}</div>`;
}

function propuestaHorario(horario) {
  const dias = Object.entries(horario.dias || {}).filter(([, l]) => l.length);
  return `<div class="aviso-caja" style="margin-top:12px">
    <strong>He leído tu horario.</strong> Revísalo antes de ponerlo:
    <div class="horario-leido">
      ${dias.map(([d, lista]) => `<div><strong>${DIAS_HORARIO[d] || d}</strong>
        ${lista.map((c) => `<div>${c.hora ? `<span class="hora">${escapa(c.hora)}</span> ` : ''}${escapa(c.asignatura)}</div>`).join('')}
      </div>`).join('')}
    </div>
    <p style="font-size:.8rem;color:var(--tinta-2);margin-top:6px">Solo cambia los días que salen en la foto.</p>
    <div class="fila" style="margin-top:8px">
      <button class="mini fantasma" data-accion="descartar-horario">No está bien</button>
      <button class="mini principal" data-accion="aplicar-horario">Poner este horario</button>
    </div>
  </div>`;
}

export function vistaClara(estado, ctx) {
  const { chat, pensando, error, propuestas, fotoPendiente, dictando } = ctx;
  return `
  <section class="seccion">
    <div class="tarjeta cabeza-clara">
      <img class="avatar" src="clara.jpg" alt="Clara" width="52" height="52" />
      <div>
        <div class="nombre">Clara</div>
        <div class="rol">Tu profe · ${escapa(estado.alumno.curso)}</div>
      </div>
      ${chat.length ? '<button class="mini fantasma" style="margin-left:auto" data-accion="limpiar-chat">Nueva charla</button>' : ''}
    </div>

    <div class="tarjeta" style="padding:12px;margin-top:10px">
      <div class="chat" id="chat">
        ${chat.length ? chat.map((m, i) => (m.rol === 'user' ? burbujaAlumno(m) : burbujaClara(m, i, ctx))).join('')
          : `<div class="burbuja profe">¡Hola, ${escapa(estado.alumno.nombre)}! Soy Clara, tu profe.

Pregúntame lo que no entiendas y te lo explico paso a paso, las veces que haga falta. Si son deberes, no te doy la solución hecha: te llevo hasta ella.

Puedes escribirme, hablarme 🎤 o mandarme una foto 📷 del ejercicio, del libro o de tu horario.</div>
          <div class="chips" style="margin-top:4px">
            ${SUGERENCIAS.map((x) => `<button class="chip" data-accion="sugerencia" data-id="${x.id}">${x.texto}</button>`).join('')}
          </div>`}
        ${pensando ? `<div class="burbuja profe"><span class="escribiendo"><i></i><i></i><i></i></span>
          ${pensando === 'foto' ? ' <span style="font-size:.82rem;color:var(--tinta-2)">Mirando la foto…</span>' : ''}</div>` : ''}
        ${error ? `<div class="burbuja error">${escapa(error)}</div>` : ''}
      </div>
      ${propuestas?.length ? `<div class="aviso-caja" style="margin-top:12px">
        <strong>${plural(propuestas.length, 'tarjeta lista', 'tarjetas listas')}</strong> a partir de lo que has preguntado.
        <div class="fila" style="margin-top:8px">
          <button class="mini fantasma" data-accion="descartar-tarjetas">No, gracias</button>
          <button class="mini principal" data-accion="guardar-tarjetas">Añadirlas al repaso</button>
        </div>
      </div>` : ''}
      ${ctx.testPropuesto?.length ? `<div class="aviso-caja" style="margin-top:12px">
        <strong>Test de ${plural(ctx.testPropuesto.length, 'pregunta', 'preguntas')}</strong> preparado.
        <div class="fila" style="margin-top:8px">
          <button class="mini fantasma" data-accion="descartar-test">Ahora no</button>
          <button class="mini principal" data-accion="empezar-test-ia">Hacerlo ya</button>
        </div>
      </div>` : ''}
      ${ctx.esquemaPropuesto ? `<div class="aviso-caja" style="margin-top:12px">
        <strong>Esquema de ${escapa(ctx.esquemaPropuesto.titulo)}</strong> listo para guardar.
        <div class="fila" style="margin-top:8px">
          <button class="mini fantasma" data-accion="descartar-esquema">Ahora no</button>
          <button class="mini principal" data-accion="guardar-esquema">Guardarlo</button>
        </div>
      </div>` : ''}
      ${ctx.horarioPropuesto ? propuestaHorario(ctx.horarioPropuesto) : ''}

      <div class="caja-escribir">
        ${fotoPendiente ? `<div class="foto-pendiente">
          <img src="${fotoPendiente.miniatura}" alt="Foto para Clara" />
          <span>Foto lista para mandar</span>
          <button class="borrar" data-accion="quitar-foto" aria-label="Quitar la foto">✕</button>
        </div>` : ''}
        <textarea id="profe-texto" rows="2" placeholder="${dictando ? 'Te escucho…' : 'Escribe tu duda, o dale al micro'}"></textarea>
        <div class="fila fila-escribir">
          <button class="icono" data-accion="elegir-foto" aria-label="Mandar una foto" title="Mandar una foto">📷</button>
          ${ctx.puedeDictar ? `<button class="icono${dictando ? ' grabando' : ''}" data-accion="dictar"
            aria-label="${dictando ? 'Parar de escuchar' : 'Hablar en vez de escribir'}" title="Hablar">🎤</button>` : ''}
          <button class="principal" data-accion="preguntar"${pensando ? ' disabled' : ''}>Enviar</button>
        </div>
        <input type="file" id="foto-input" accept="image/*" hidden />
      </div>
    </div>
    <p style="font-size:.78rem;color:var(--tinta-2);margin-top:8px">
      Clara necesita internet; el resto de la app funciona sin él. Las fotos se reducen en el móvil y
      solo se le mandan a Clara para contestarte: la app no las guarda.
    </p>
  </section>`;
}

/** Nombre antiguo, para no romper nada que lo use. */
export const vistaProfe = vistaClara;

/* ── Vista: YO ──────────────────────────────────────────────────── */

export function vistaYo(estado, ctx) {
  const { hoy, instalable } = ctx;
  const total = R.puntos(estado);
  const niv = R.nivel(total);
  const semana = R.parteSemanal(estado, hoy);
  const racha = R.rachaVigente(estado.racha, hoy);
  const etapa = etapaDe(racha);
  const tests = D.progresoTests(estado, hoy);
  const { porAsignatura, general } = D.medias(estado);
  const dias = D.minutosPorDia(estado, hoy, 7);
  const maximo = Math.max(30, ...dias.map((d) => d.minutos));

  return `
  <section class="seccion">
    <div class="tarjeta hero">
      ${mascota(racha)}
      <div class="texto">
        <div class="saludo" style="font-size:1.05rem">${escapa(etapa.nombre)}</div>
        <div class="frase">${escapa(etapa.frase)}</div>
        <div style="margin-top:6px;font-size:.82rem;color:var(--tinta-2)">
          ${racha ? plural(racha, 'día seguido', 'días seguidos') : 'Racha rota'} · récord ${plural(estado.racha.mejor || 0, 'día', 'días')}
        </div>
      </div>
    </div>
  </section>

  <section class="seccion">
    <div class="tarjeta">
      <div style="display:flex;align-items:center;gap:10px">
        <strong>${escapa(niv.nombre)}</strong>
        <span class="pastilla" style="margin-left:auto">${total} puntos</span>
      </div>
      <div class="barra-progreso" style="margin-top:8px"><i style="width:${pct(niv.progreso)}"></i></div>
      <p style="font-size:.82rem;color:var(--tinta-2);margin-top:6px">
        ${niv.siguiente ? `Faltan ${niv.faltan} puntos para <strong>${escapa(niv.siguiente)}</strong>.` : 'Nivel máximo. Impresionante.'}
      </p>
    </div>
  </section>

  <section class="seccion">
    <header><h2>Esta semana</h2></header>
    <div class="rejilla">
      <div class="dato"><div class="n">${minutosATexto(semana.minutos)}</div><div class="e">Estudiando</div></div>
      <div class="dato"><div class="n">${semana.diasActivos}/7</div><div class="e">Días activos</div></div>
      <div class="dato"><div class="n">${semana.tareasHechas}</div><div class="e">Deberes hechos</div></div>
      <div class="dato"><div class="n">${semana.atrasadas}</div><div class="e">Atrasados</div></div>
    </div>
    <div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:flex-end;gap:6px;height:70px">
        ${dias.map((d) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <div style="width:100%;border-radius:5px 5px 0 0;background:${d.minutos ? 'var(--azul)' : 'var(--borde)'};height:${Math.max(4, (d.minutos / maximo) * 54)}px"></div>
          <span style="font-size:.66rem;color:var(--tinta-2)">${DIAS_CORTOS[new Date(d.fecha.slice(0, 4), Number(d.fecha.slice(5, 7)) - 1, Number(d.fecha.slice(8, 10))).getDay()]}</span>
        </div>`).join('')}
      </div>
    </div>
    ${tests.hechos ? `<div class="tarjeta" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <span>Media de tus tests</span>
        <span class="pastilla ${(tests.media ?? tests.mediaTotal) >= 5 ? 'verde' : 'roja'}" style="margin-left:auto">
          ${(tests.media ?? tests.mediaTotal).toFixed(1)}
        </span>
      </div>
      <p style="font-size:.8rem;color:var(--tinta-2);margin-top:4px">
        ${tests.semana ? `${plural(tests.semana, 'test esta semana', 'tests esta semana')} · ${plural(tests.hechos, 'test en total', 'tests en total')}`
          : `Sin tests esta semana · ${plural(tests.hechos, 'test en total', 'tests en total')}`}
      </p>
    </div>` : ''}
    <button class="ancho" style="margin-top:10px" data-accion="parte">Enviar parte de la semana a papá</button>
  </section>

  <section class="seccion">
    <header><h2>Notas</h2><span class="extra">${general !== null ? `media ${general.toFixed(2)}` : 'sin notas'}</span></header>
    <button class="ancho" data-accion="nueva-nota">+ Apuntar una nota</button>
    ${porAsignatura.some((p) => p.cuantas) ? `<div class="tarjeta" style="margin-top:10px"><ul class="mochila">
      ${porAsignatura.filter((p) => p.cuantas).map((p) => `<li>
        ${puntoColor(estado, p.asignatura.id)} <span>${escapa(p.asignatura.nombre)}</span>
        <span style="margin-left:auto" class="pastilla ${p.media >= 5 ? 'verde' : 'roja'}">${p.media.toFixed(2)}</span>
      </li>`).join('')}
    </ul></div>` : ''}
  </section>

  <section class="seccion">
    <header><h2>Asignaturas</h2><span class="extra">${estado.asignaturas.length}</span></header>
    <div class="tarjeta">
      <ul class="mochila">
        ${estado.asignaturas.map((a) => `<li>
          ${puntoColor(estado, a.id)} <span>${escapa(a.nombre)}</span>
          <button class="borrar" style="margin-left:auto" data-accion="borrar-asignatura" data-id="${a.id}" aria-label="Borrar">✕</button>
        </li>`).join('') || '<li style="color:var(--tinta-2)">Ninguna todavía.</li>'}
      </ul>
      <div class="fila" style="margin-top:10px">
        <button class="mini" data-accion="nueva-asignatura">+ Añadir</button>
        ${estado.asignaturas.length ? '' : '<button class="mini principal" data-accion="asignaturas-eso">Poner las de ESO</button>'}
      </div>
    </div>
  </section>

  <section class="seccion">
    <header><h2>Horario</h2></header>
    <div class="tarjeta">
      ${[1, 2, 3, 4, 5].map((d) => `<div class="horario-dia">
        <h3>${DIAS[d]}</h3>
        ${(estado.horario[d] || []).map((c) => `<div class="clase">
          ${puntoColor(estado, c.asignaturaId)}
          <span class="hora">${escapa(c.hora || '—')}</span>
          <span>${escapa(D.nombreAsignatura(estado, c.asignaturaId))}</span>
          <button class="borrar" style="margin-left:auto" data-accion="borrar-clase" data-dia="${d}" data-id="${c.id}" aria-label="Borrar">✕</button>
        </div>`).join('') || '<p style="color:var(--tinta-2);font-size:.85rem">Sin clases puestas.</p>'}
        <button class="mini fantasma" style="margin-top:6px" data-accion="nueva-clase" data-dia="${d}">+ Clase</button>
      </div>`).join('')}
    </div>
  </section>

  <section class="seccion">
    <header><h2>Ajustes</h2></header>
    <div class="tarjeta">
      <div class="campo"><label for="aj-nombre">Nombre</label>
        <input id="aj-nombre" data-ajuste="alumno.nombre" value="${escapa(estado.alumno.nombre)}" /></div>
      <div class="campo"><label for="aj-curso">Curso</label>
        <input id="aj-curso" data-ajuste="alumno.curso" value="${escapa(estado.alumno.curso)}" /></div>
      <div class="fila" style="margin-top:10px">
        <div class="campo" style="margin:0"><label for="aj-pomo">Concentración (min)</label>
          <input id="aj-pomo" type="number" min="5" max="60" data-ajuste="ajustes.pomodoro" value="${estado.ajustes.pomodoro}" /></div>
        <div class="campo" style="margin:0"><label for="aj-desc">Descanso (min)</label>
          <input id="aj-desc" type="number" min="1" max="30" data-ajuste="ajustes.descanso" value="${estado.ajustes.descanso}" /></div>
      </div>
      <div class="campo" style="margin-top:12px">
        <label>Sonido de fondo mientras estudias</label>
        <div class="chips">
          ${AMBIENTES.map((a) => `<button class="chip${estado.ajustes.ambiente === a.id ? ' chip--activo' : ''}"
            data-accion="elegir-ambiente" data-id="${a.id}">${a.emoji} ${a.nombre}</button>`).join('')}
        </div>
        <label for="aj-vol" style="margin-top:10px">Volumen</label>
        <input id="aj-vol" type="range" min="0" max="1" step="0.05" data-ajuste="ajustes.volumen" value="${estado.ajustes.volumen}" />
      </div>
      <div class="fila" style="margin-top:10px">
        <div class="campo" style="margin:0"><label for="aj-obj">Objetivo diario (min)</label>
          <input id="aj-obj" type="number" min="10" max="240" step="5" data-ajuste="ajustes.objetivoDiario" value="${estado.ajustes.objetivoDiario}" /></div>
        <div class="campo" style="margin:0"><label for="aj-tar">Tarjetas al día</label>
          <input id="aj-tar" type="number" min="5" max="100" step="5" data-ajuste="ajustes.tarjetasPorDia" value="${estado.ajustes.tarjetasPorDia}" /></div>
      </div>
    </div>
  </section>

  <section class="seccion">
    <header><h2>Copia de seguridad</h2></header>
    <div class="tarjeta">
      <p style="font-size:.86rem;color:var(--tinta-2)">
        Tus datos viven solo en este aparato: el móvil y el PC tienen cada uno los suyos.
        Con la copia los pasas de uno a otro, y si cambias de móvil no pierdes nada.
      </p>
      <p style="font-size:.84rem;margin-top:8px">Aquí tienes: <strong>${escapa(D.resumenDatos(estado))}</strong>.</p>
      <div class="fila" style="margin-top:10px">
        <button data-accion="exportar">📤 Guardar / enviar copia</button>
        <button data-accion="importar">📥 Abrir una copia</button>
      </div>
      <details style="margin-top:10px"><summary style="cursor:pointer;color:var(--tinta-2);font-size:.84rem">¿Cómo paso mis datos al PC (o al móvil)?</summary>
        <ol style="font-size:.86rem;padding-left:20px;margin:8px 0 0;line-height:1.6">
          <li>En el aparato que tiene los datos: <strong>Guardar / enviar copia</strong> y mándatela (WhatsApp, correo o Drive).</li>
          <li>En el otro, abre la app → Yo → <strong>Abrir una copia</strong> y elige ese archivo.</li>
        </ol>
      </details>
      ${instalable ? '<button class="principal ancho" style="margin-top:10px" data-accion="instalar">Instalar en la pantalla de inicio</button>' : ''}
      <button class="peligro ancho" style="margin-top:10px" data-accion="borrar-todo">Borrar todo y empezar de cero</button>
    </div>
  </section>`;
}

/* ── Formularios de los diálogos ────────────────────────────────── */

export const formTarea = (estado, hoy) => `
  <div class="campo"><label for="f-titulo">¿Qué hay que hacer?</label>
    <input id="f-titulo" name="titulo" placeholder="Ej.: ejercicios 3 y 4 de la página 45" /></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-para">¿Para cuándo?</label>
    <input id="f-para" name="para" type="date" value="${hoy}" /></div>
  <div class="fila" style="margin-top:10px">
    <div class="campo" style="margin:0"><label for="f-prio">Prioridad</label>
      <select id="f-prio" name="prioridad">
        <option value="normal">Normal</option>
        <option value="alta">Alta — esto primero</option>
      </select></div>
    <div class="campo" style="margin:0"><label for="f-rep">¿Se repite?</label>
      <select id="f-rep" name="repetir">
        <option value="no">No</option>
        <option value="diaria">Cada día</option>
        <option value="semanal">Cada semana</option>
      </select></div>
  </div>`;

export const formExamen = (estado, hoy) => `
  <div class="campo"><label for="f-titulo">¿De qué es el examen?</label>
    <input id="f-titulo" name="titulo" placeholder="Ej.: Tema 2, células" /></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-fecha">Día del examen</label>
    <input id="f-fecha" name="fecha" type="date" value="${hoy}" /></div>
  <div class="campo"><label for="f-temas">¿Qué entra? (opcional)</label>
    <textarea id="f-temas" name="temas" placeholder="Páginas, temas, apuntes…"></textarea></div>
  ${(estado.lecciones || []).length ? `<div class="campo"><label>Lecciones que entran (para el examen de prueba)</label>
    <div class="lista-marcar">${D.leccionesPorAsignatura(estado).map((g) => g.lecciones.map((l) => `<label class="marcar">
      <input type="checkbox" name="lecciones" value="${l.id}" />
      <span>${escapa(l.titulo)} <small>· ${escapa(g.asignatura?.nombre || 'Sin asignatura')}</small></span>
    </label>`).join('')).join('')}</div></div>` : ''}`;

export const formLibro = (estado) => `
  <div class="campo"><label for="f-titulo">Título del libro</label>
    <input id="f-titulo" name="titulo" placeholder="Ej.: Física y Química 2º ESO" /></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-editorial">Editorial (opcional)</label>
    <input id="f-editorial" name="editorial" placeholder="Ej.: Anaya, SM, Santillana…" /></div>`;

export function formLeccion(estado, leccion = null) {
  const libros = estado.libros || [];
  return `
  <div class="campo"><label for="f-titulo">¿Qué lección es?</label>
    <input id="f-titulo" name="titulo" value="${escapa(leccion?.titulo || '')}" placeholder="Ej.: Tema 3 — Las fuerzas" /></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado, leccion?.asignaturaId || '')}</div>
  <div class="campo"><label for="f-libro">Libro</label>
    <select id="f-libro" name="libro"><option value="">— Sin libro —</option>
      ${libros.map((l) => `<option value="${l.id}"${l.id === leccion?.libroId ? ' selected' : ''}>${escapa(l.titulo)} · ${escapa(D.nombreAsignatura(estado, l.asignaturaId))}</option>`).join('')}
    </select></div>
  <div class="campo"><label for="f-fotos">📷 Fotos de las páginas (hasta ${L.MAX_FOTOS_LECCION})</label>
    <input id="f-fotos" name="fotos" type="file" accept="image/*" multiple /></div>
  <div class="campo"><label for="f-texto">…o escribe / pega el texto de la lección</label>
    <textarea id="f-texto" name="texto" rows="8" placeholder="Puedes pegar el tema entero, o lo que has copiado en clase">${escapa(leccion?.texto || '')}</textarea></div>
  <p style="font-size:.8rem;color:var(--tinta-2)">Las fotos se reducen en el móvil y solo se mandan a Clara para hacer los apuntes; no se guardan.</p>`;
}

export const formTarjeta = (estado) => `
  <div class="campo"><label for="f-preg">Pregunta</label>
    <textarea id="f-preg" name="pregunta" placeholder="Ej.: ¿qué es una célula procariota?"></textarea></div>
  <div class="campo"><label for="f-resp">Respuesta</label>
    <textarea id="f-resp" name="respuesta" placeholder="Corta y en tus palabras"></textarea></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-idioma">Idioma (para oírla en voz alta)</label>
    <select id="f-idioma" name="idioma">
      <option value="es">Español</option>
      <option value="en">Inglés</option>
    </select></div>`;

export const formAsignatura = () => `
  <div class="campo"><label for="f-nombre">Nombre</label>
    <input id="f-nombre" name="nombre" placeholder="Ej.: Matemáticas" /></div>
  <div class="campo"><label for="f-color">Color</label>
    <input id="f-color" name="color" type="color" value="#12628a" style="height:48px" /></div>`;

export const formClase = (estado, dia) => `
  <p style="color:var(--tinta-2);font-size:.86rem;margin-bottom:10px">Clase del ${DIAS[dia]}</p>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-hora">Hora (opcional)</label>
    <input id="f-hora" name="hora" type="time" /></div>`;

export const formNota = (estado, hoy) => `
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>
  <div class="campo"><label for="f-titulo">¿De qué? </label>
    <input id="f-titulo" name="titulo" placeholder="Ej.: examen tema 1" /></div>
  <div class="campo"><label for="f-valor">Nota (0 a 10)</label>
    <input id="f-valor" name="valor" type="number" min="0" max="10" step="0.05" /></div>
  <div class="campo"><label for="f-fecha">Fecha</label>
    <input id="f-fecha" name="fecha" type="date" value="${hoy}" /></div>`;

export const formApunte = (estado, apunte = null) => `
  <div class="campo"><label for="f-titulo">Título</label>
    <input id="f-titulo" name="titulo" value="${escapa(apunte?.titulo || '')}" placeholder="Ej.: Tema 2 — la célula" /></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado, apunte?.asignaturaId || '')}</div>
  <div class="campo"><label for="f-texto">Apunte</label>
    <textarea id="f-texto" name="texto" rows="10" placeholder="Lo que dictó el profe, lo que entra en el examen, cómo se hace ese ejercicio…">${escapa(apunte?.texto || '')}</textarea></div>`;

export const formImportar = () => `
  <div class="campo"><label for="f-archivo">Elige el archivo de copia (nicer-estudia-….json)</label>
    <input id="f-archivo" name="archivo" type="file" accept=".json,application/json" /></div>
  <details><summary style="cursor:pointer;color:var(--tinta-2);font-size:.84rem">…o pega el contenido</summary>
    <div class="campo" style="margin-top:8px">
      <textarea id="f-copia" name="copia" rows="6" placeholder='{"version":3,…}'></textarea></div>
  </details>
  <p style="font-size:.82rem;color:var(--tinta-2);margin-top:8px">Antes de cambiar nada te digo qué trae la copia.</p>`;

/* ── Texto del parte semanal (para WhatsApp) ────────────────────── */

export function textoParteSemanal(estado, hoy = aISO()) {
  const s = R.parteSemanal(estado, hoy);
  const proximos = s.examenes
    .map((e) => `  · ${e.titulo} (${D.nombreAsignatura(estado, e.asignaturaId)}) — ${cuentaAtras(e.fecha, hoy)}`)
    .join('\n');
  return [
    `📚 Parte de la semana de ${estado.alumno.nombre}`,
    `(${fechaCorta(s.desde)} → ${fechaCorta(hoy)})`,
    '',
    `⏱️ Tiempo de estudio: ${minutosATexto(s.minutos)} en ${plural(s.diasActivos, 'día', 'días')}`,
    `✅ Deberes hechos: ${s.tareasHechas}`,
    `📌 Pendientes ahora: ${s.pendientes}${s.atrasadas ? ` (${s.atrasadas} atrasados)` : ''}`,
    `🃏 Tarjetas nuevas de repaso: ${s.tarjetasNuevas}`,
    proximos ? `\n📝 Exámenes a la vista:\n${proximos}` : '\n📝 Sin exámenes en las próximas dos semanas.'
  ].join('\n');
}

/* ── Avisos de la barra inferior ────────────────────────────────── */

export function contadores(estado, hoy = aISO()) {
  return {
    agenda: D.pendientes(estado, hoy).filter((t) => t.dias <= 0).length,
    repaso: R.colaDeHoy(estado.tarjetas, hoy, estado.ajustes.tarjetasPorDia).length
  };
}
