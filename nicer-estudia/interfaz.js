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
  const plan = R.planDelDia({ tareas, examenes, tarjetasHoy: cola.length, minutosHechos: minutos, objetivo }, hoy);
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
        ${p.tipo === 'repaso' ? '<button class="mini principal" data-accion="ir" data-vista="estudiar">Repasar</button>' : ''}
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
    <button class="mini fantasma" style="margin-top:10px" data-accion="ver-plan" data-id="${e.id}">Ver plan completo</button>
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
  { id: 'tarjetas', nombre: 'Tarjetas' },
  { id: 'test', nombre: 'Test' },
  { id: 'esquemas', nombre: 'Esquemas' },
  { id: 'apuntes', nombre: 'Apuntes' }
];

export function vistaEstudiar(estado, ctx) {
  const sub = SUBS.some((x) => x.id === ctx.sub) ? ctx.sub : 'tarjetas';
  const contadores = {
    tarjetas: R.colaDeHoy(estado.tarjetas, ctx.hoy, estado.ajustes.tarjetasPorDia).length,
    test: 0,
    esquemas: (estado.esquemas || []).length,
    apuntes: (estado.apuntes || []).length
  };

  const pestanas = `<div class="pestanas" role="tablist">
    ${SUBS.map((x) => `<button role="tab" data-accion="sub" data-sub="${x.id}"
      ${x.id === sub ? 'aria-selected="true"' : ''}>${x.nombre}${contadores[x.id] ? ` <span class="cuenta">${contadores[x.id]}</span>` : ''}</button>`).join('')}
  </div>`;

  const pintor = { tarjetas: subTarjetas, test: subTest, esquemas: subEsquemas, apuntes: subApuntes }[sub];
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
          </div>
          ${respuestaVisible
            ? `<div class="fila" style="margin-top:10px">
                <button class="peligro" data-accion="fallo">No la sabía</button>
                <button class="principal" data-accion="acierto">La sabía</button>
              </div>`
            : '<button class="principal ancho grande" style="margin-top:10px" data-accion="ver-respuesta">Ver la respuesta</button>'}`
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

/* ── Test (idea tomada de Cuestia, pero con SUS tarjetas y sin cuenta) ── */
function subTest(estado, ctx) {
  const t = ctx.test;
  const historial = (estado.tests || []).slice(-5).reverse();

  if (t && t.terminado) {
    const { resultado } = t;
    return `<section class="seccion">
      <div class="tarjeta flash">
        <div class="pastilla ${resultado.nota >= 5 ? 'verde' : 'roja'}" style="align-self:center">Nota ${resultado.nota}</div>
        <div class="pregunta">${resultado.aciertos} de ${resultado.total} bien</div>
        <p style="color:var(--tinta-2);font-size:.92rem">${escapa(Q.comentario(resultado))}</p>
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
      <div class="fila" style="margin-top:10px">
        <button data-accion="cerrar-test">Cerrar</button>
        <button class="principal" data-accion="test-tarjetas">Otro test</button>
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
    <header><h2>Apuntes</h2><span class="extra">${apuntes.length}</span></header>
    <button class="principal ancho" data-accion="nuevo-apunte">+ Escribir un apunte</button>
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
          Aquí van los apuntes que quieras tener siempre a mano: lo que dictó el profe,
          lo que entra en el examen, cómo se hace ese tipo de ejercicio.<br /><br />
          Luego, con un botón, el Profe los convierte en tarjetas.
        </div>`}
  </section>`;
}

/* ── Vista: PROFE ───────────────────────────────────────────────── */

export function vistaProfe(estado, ctx) {
  const { chat, pensando, error, propuestas } = ctx;
  return `
  <section class="seccion">
    <header><h2>Profe</h2><span class="extra">${escapa(estado.alumno.curso)}</span></header>
    <div class="tarjeta" style="padding:12px">
      <div class="chat" id="chat">
        ${chat.length ? chat.map((m) => `<div class="burbuja ${m.rol === 'user' ? 'yo' : 'profe'}">${escapa(m.texto)}</div>`).join('')
          : `<div class="burbuja profe">Hola, ${escapa(estado.alumno.nombre)}. Soy tu profe de guardia.

Pregúntame lo que no entiendas de clase y te lo explico paso a paso. Si son deberes, no te doy la solución hecha: te llevo hasta ella.

Y te preparo material del tema que me digas:
· «hazme tarjetas de la célula»
· «ponme un test del tema 2»
· «hazme un esquema de la Edad Media»</div>`}
        ${pensando ? '<div class="burbuja profe"><span class="escribiendo"><i></i><i></i><i></i></span></div>' : ''}
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
      <div style="margin-top:12px">
        <textarea id="profe-texto" placeholder="Ej.: no entiendo las ecuaciones de primer grado" rows="2"></textarea>
        <div class="fila" style="margin-top:8px">
          <button class="fantasma" data-accion="limpiar-chat">Borrar</button>
          <button class="principal" data-accion="preguntar"${pensando ? ' disabled' : ''}>Preguntar</button>
        </div>
      </div>
    </div>
    <p style="font-size:.78rem;color:var(--tinta-2);margin-top:8px">
      El Profe usa internet. Si no hay conexión, el resto de la app sigue funcionando igual.
    </p>
  </section>`;
}

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
        Los datos viven solo en este dispositivo. Si cambias de móvil o borras el navegador, se pierden:
        descarga una copia de vez en cuando.
      </p>
      <div class="fila" style="margin-top:10px">
        <button data-accion="exportar">Descargar copia</button>
        <button data-accion="importar">Restaurar copia</button>
      </div>
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
    <textarea id="f-temas" name="temas" placeholder="Páginas, temas, apuntes…"></textarea></div>`;

export const formTarjeta = (estado) => `
  <div class="campo"><label for="f-preg">Pregunta</label>
    <textarea id="f-preg" name="pregunta" placeholder="Ej.: ¿qué es una célula procariota?"></textarea></div>
  <div class="campo"><label for="f-resp">Respuesta</label>
    <textarea id="f-resp" name="respuesta" placeholder="Corta y en tus palabras"></textarea></div>
  <div class="campo"><label for="f-asig">Asignatura</label>${selectorAsignatura(estado)}</div>`;

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
  <div class="campo"><label for="f-copia">Pega aquí el contenido del archivo de copia</label>
    <textarea id="f-copia" name="copia" rows="8" placeholder='{"version":1,…}'></textarea></div>
  <p style="font-size:.82rem;color:var(--tinta-2)">Esto sustituye todos los datos actuales.</p>`;

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
