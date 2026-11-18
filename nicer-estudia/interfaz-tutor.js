/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — interfaz de Vago Yo (tutor) y del panel familiar
   Render puro, como interfaz.js: recibe (estado, ctx) y devuelve HTML.
   El estado del tutor vive en ctx.tutor (app.js). Todo lo que escribe el
   alumno pasa por escapa().
   ═══════════════════════════════════════════════════════════════════ */

import { escapa, fechaHumana } from './utiles.js';
import * as V from './vagoyo.js';

const ICONO_ESTADO = { si: '✅', no: '⛔', simulado: '🧪' };

function cabecera(t) {
  return `<div class="tutor-cab">
    <button class="mini fantasma" data-accion="tutor-ir" data-pantalla="inicio" aria-label="Volver al inicio de Vago Yo">←</button>
    <div class="tutor-titulo"><strong>Vago Yo</strong><span>${escapa(t)}</span></div>
  </div>`;
}

const DEMO = `<div class="aviso-caja tutor-demo" role="note">
  <strong>Demostración.</strong> Sin IA ni internet: las explicaciones están preparadas y la lectura
  de fotos es de ejemplo. Corregir tus pasos sí es de verdad.
</div>`;

function chipsAsignatura(actual) {
  return `<div class="chips" role="group" aria-label="Asignatura">
    ${V.ASIGNATURAS.map((a) => `<button class="chip${a.id === actual ? ' chip--activo' : ''}"
      data-accion="tutor-asignatura" data-id="${a.id}" aria-pressed="${a.id === actual}">${a.emoji} ${escapa(a.nombre)}</button>`).join('')}
  </div>`;
}

/* Foto de ejemplo dibujada: hoja de cuaderno con letra a mano. El signo
   dudoso se pinta flojo a propósito. */
export function dibujoFoto(foto, { pequena = false } = {}) {
  const ancho = 320, alto = foto.lineas.length > 1 ? 190 : 150;
  const renglones = Array.from({ length: 7 }, (_, i) => `<line x1="0" x2="${ancho}" y1="${30 + i * 24}" y2="${30 + i * 24}" stroke="#b9cbe0" stroke-width="1"/>`).join('');
  const letra = 'font-family="Segoe Print, Bradley Hand, Comic Sans MS, cursive" fill="#1d2f6f"';
  let y = 50;
  const lineas = foto.lineas.map((l) => {
    const corto = l.length > 44 ? l.slice(0, 44) + '…' : l;
    const out = `<text x="22" y="${y}" font-size="${l.length > 44 ? 11 : 15}" ${letra}>${escapa(corto)}</text>`;
    y += 26;
    return out;
  }).join('');
  let x = 40;
  const piezas = foto.piezas.map((p) => {
    if (p.duda) {
      const s = `<text x="${x}" y="${y + 8}" font-size="26" ${letra} opacity=".28">–</text>
        <circle cx="${x + 8}" cy="${y}" r="13" fill="none" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      x += 22;
      return s;
    }
    const s = `<text x="${x}" y="${y + 8}" font-size="26" ${letra}>${escapa(p.t.trim())}</text>`;
    x += p.t.trim().length * 13 + 8;
    return s;
  }).join('');
  return `<svg class="foto-demo${pequena ? ' foto-demo--peque' : ''}" viewBox="0 0 ${ancho} ${alto}" role="img"
    aria-label="Foto de ejemplo: ${escapa(foto.titulo)}">
    <rect width="${ancho}" height="${alto}" rx="10" fill="#fdfcf7"/>
    ${renglones}
    <line x1="14" x2="14" y1="0" y2="${alto}" stroke="#e7a1a1" stroke-width="1.2"/>
    ${lineas}${piezas}
  </svg>`;
}

/* ── Pantallas ──────────────────────────────────────────────────── */

function inicio(estado, ctx, t) {
  const recuperable = t.sesion && !t.sesion.resuelto;
  const pendientes = V.repasosPendientes(t.progreso, ctx.hoy).filter((r) => r.toca).length;
  return `
  <section class="seccion">
    <div class="tarjeta tutor-hola">
      <div class="tutor-avatar" aria-hidden="true">VY</div>
      <div>
        <div class="saludo">Vago Yo</div>
        <div class="frase">El vago soy yo: te doy el siguiente paso y lo haces tú.</div>
      </div>
    </div>
    ${DEMO}
  </section>
  <section class="seccion">
    <header><h2>Asignatura</h2></header>
    ${chipsAsignatura(t.asignatura)}
  </section>
  <section class="seccion">
    ${recuperable ? `<button class="principal ancho grande" data-accion="tutor-ir" data-pantalla="ejercicio" style="margin-bottom:10px">
      ↩ Seguir donde lo dejé <span class="tutor-sub">${escapa(t.sesion.ejercicio.enunciado.slice(0, 40))}</span></button>` : ''}
    <div class="rejilla tutor-acciones">
      <button class="tutor-boton" data-accion="tutor-ir" data-pantalla="subir"><span aria-hidden="true">📷</span>Subir ejercicio</button>
      <button class="tutor-boton" data-accion="tutor-ir" data-pantalla="explicar"><span aria-hidden="true">💡</span>Explícame</button>
      <button class="tutor-boton" data-accion="tutor-ir" data-pantalla="repasar"><span aria-hidden="true">🔁</span>Repasar${pendientes ? ` <span class="pastilla ambar">${pendientes}</span>` : ''}</button>
      <button class="tutor-boton" data-accion="tutor-ir" data-pantalla="hablar"><span aria-hidden="true">🎙️</span>Hablar</button>
    </div>
  </section>
  <section class="seccion">
    <details class="tarjeta tutor-capacidades">
      <summary>Qué funciona ahora y qué no</summary>
      <ul>${V.capacidades({ enLinea: ctx.enLinea, puedeDictar: ctx.puedeDictar, puedeLeer: ctx.puedeLeer }).map((c) =>
        `<li><span aria-hidden="true">${ICONO_ESTADO[c.estado]}</span><div><strong>${escapa(c.nombre)}</strong><br>${escapa(c.texto)}</div></li>`).join('')}</ul>
    </details>
    <button class="fantasma ancho mini" data-accion="ir" data-vista="familia" style="margin-top:8px">👪 Qué ve tu familia</button>
  </section>`;
}

function subir(estado, ctx, t) {
  if (t.asignatura !== 'mates') {
    return cabecera('Subir ejercicio') + `<section class="seccion">
      <div class="tarjeta">
        <p>En la demo, las fotos de ejemplo son de <strong>Matemáticas</strong>. Leer tus propias fotos llegará más adelante.</p>
        <p>Para ${escapa(V.nombreAsignatura(t.asignatura))} tengo un ejercicio de práctica preparado.</p>
        <button class="principal ancho" data-accion="tutor-practicar">Ponme el ejercicio</button>
        <button class="fantasma ancho" data-accion="tutor-asignatura" data-id="mates" style="margin-top:8px">Cambiar a Matemáticas</button>
      </div></section>`;
  }
  return cabecera('Subir ejercicio') + `
  <section class="seccion">
    <header><h2>Elige una foto de ejemplo</h2></header>
    ${V.FOTOS_DEMO.map((f) => `<button class="tarjeta tutor-foto" data-accion="tutor-foto" data-id="${f.id}">
      ${dibujoFoto(f, { pequena: true })}
      <span><strong>${escapa(f.titulo)}</strong><br><small>${escapa(f.origen)}</small></span>
    </button>`).join('')}
    <p class="tutor-nota">Son fotos inventadas para probar. La lectura del texto está preparada, no la hace una IA.</p>
  </section>
  <section class="seccion">
    <header><h2>O escríbelo tú</h2></header>
    <div class="tarjeta">
      <label for="tutor-enunciado">Copia la ecuación tal cual (ej.: 4(x + 3) = 20)</label>
      <input id="tutor-enunciado" autocomplete="off" inputmode="text" maxlength="60" value="${escapa(t.enunciadoEscrito || '')}" />
      ${t.errorEnunciado ? `<p class="tutor-error" role="alert">${escapa(t.errorEnunciado)}</p>` : ''}
      <button class="principal ancho" data-accion="tutor-enunciado" style="margin-top:8px">Usar este enunciado</button>
    </div>
  </section>`;
}

function confirmar(estado, ctx, t) {
  const l = t.lectura;
  const foto = V.FOTOS_DEMO.find((f) => f.id === l.fotoId);
  const paso = V.ejercicioDeLectura(l);
  const leido = l.piezas.map((p, i) => (p.duda
    ? `<mark class="tutor-duda">${escapa(l.elecciones[i] ?? '?')}</mark>`
    : escapa(p.t))).join('');
  return cabecera('Comprobar lo leído') + `
  <section class="seccion">
    <div class="tarjeta">
      ${dibujoFoto(foto)}
      <p class="tutor-nota">${escapa(l.origen)} · lectura de ejemplo, no real</p>
      <div class="tutor-leido">
        ${l.lineas.map((x) => `<div>${escapa(x)}</div>`).join('')}
        <div class="tutor-ecuacion">${leido}</div>
      </div>
    </div>
    ${l.aviso ? `<div class="aviso-caja" style="margin-top:10px" role="note">⚠️ ${escapa(l.aviso)}</div>` : ''}
  </section>
  <section class="seccion">
    ${paso.tipo === 'pregunta' ? `
      <div class="tarjeta tutor-pregunta" role="group" aria-labelledby="tutor-preg">
        <p id="tutor-preg"><strong>${escapa(paso.pregunta)}</strong></p>
        <p class="tutor-nota">${escapa(paso.motivo)} Prefiero preguntarte antes que inventármelo.</p>
        <div class="fila">${paso.opciones.map((o) => `<button class="grande" data-accion="tutor-elegir" data-i="${paso.indice}" data-op="${escapa(o)}">${escapa(o === '−' ? '− menos' : o === '+' ? '+ más' : o)}</button>`).join('')}</div>
      </div>` : paso.tipo === 'ejercicio' ? `
      <div class="tarjeta">
        <p><strong>¿Pone esto?</strong> ${escapa(paso.ejercicio.enunciado)}</p>
        <button class="principal ancho" data-accion="tutor-confirmar">Sí, es esto</button>
        <button class="fantasma ancho" data-accion="tutor-ir" data-pantalla="subir" style="margin-top:8px">No, lo escribo yo</button>
      </div>` : `<div class="aviso-caja">${escapa(paso.mensaje)}</div>`}
  </section>`;
}

function bloqueCorreccion(c) {
  if (!c) return '';
  if (c.estado === 'bien') {
    return `<div class="tutor-feedback bien" role="status">
      <strong>✔ ${escapa(c.acierto || 'Correcto')}</strong>${c.mensaje ? `<p>${escapa(c.mensaje)}</p>` : ''}</div>`;
  }
  return `<div class="tutor-feedback ${c.estado === 'error' ? 'mal' : 'medio'}" role="status">
    ${c.acierto ? `<p class="tutor-acierto">👍 ${escapa(c.acierto)}</p>` : ''}
    <p>${escapa(c.mensaje)}</p>
    ${c.pista ? `<p class="tutor-pista">💡 ${escapa(c.pista)}</p>` : ''}
    ${c.estado === 'error' || c.estado === 'casi' || c.estado === 'incompleto' ? '<p class="tutor-nota">Rehaz ese paso y vuelve a comprobar.</p>' : ''}
  </div>`;
}

function registroHecho(t, ctx) {
  const r = t.registro;
  const h = t.progreso[r.habilidad];
  return `<div class="tarjeta tutor-registro">
    <p><strong>Apuntado:</strong> ${escapa(V.HABILIDADES[r.habilidad].nombre)}</p>
    <p>${r.autonomo ? '🟢 Sin ayuda en este ejercicio' : `🟡 Con ayuda (${r.ayudas === 1 ? 'una pista o explicación' : `${r.ayudas} pistas o explicaciones`})`}
      · estado: <strong>${escapa(V.ESTADOS[h.estado])}</strong></p>
    <p>🔁 Próximo repaso: <strong>${escapa(fechaHumana(h.repaso.fecha, ctx.hoy))}</strong>. ${escapa(h.repaso.motivo)}</p>
    <p class="tutor-nota">Tu familia ve solo esto: la habilidad, si fue con ayuda y el próximo repaso. No ve lo que escribes.</p>
    <div class="fila">
      <button class="principal" data-accion="tutor-otro">Otro del mismo tipo</button>
      <button data-accion="tutor-posponer" data-id="${r.habilidad}">Posponer repaso</button>
    </div>
    <button class="fantasma ancho mini" data-accion="ir" data-vista="familia" style="margin-top:8px">👪 Ver qué ve tu familia</button>
  </div>`;
}

function ejercicio(estado, ctx, t) {
  const s = t.sesion;
  if (!s) return cabecera('Ejercicio') + '<div class="vacio">No hay ningún ejercicio abierto.</div>';
  const ej = s.ejercicio;
  const resuelto = s.resuelto;
  const entrada = ej.tipo === 'opcion'
    ? `<div class="fila" role="group" aria-label="Respuesta">${ej.opciones.map((o) =>
      `<button data-accion="tutor-opcion" data-op="${escapa(o)}"${resuelto ? ' disabled' : ''}>${escapa(o)}</button>`).join('')}</div>`
    : `<label for="tutor-intento">${ej.tipo === 'ecuacion' ? 'Tus pasos, uno por línea' : 'Tu respuesta'}</label>
       <textarea id="tutor-intento" rows="${ej.tipo === 'ecuacion' ? 4 : 2}" autocomplete="off" autocapitalize="off" spellcheck="false"
        ${resuelto ? 'disabled' : ''}>${escapa(t.borrador || '')}</textarea>`;
  return cabecera(V.nombreAsignatura(ej.asignatura)) + `
  <section class="seccion">
    <div class="tarjeta">
      ${ej.origen ? `<p class="tutor-nota">${escapa(ej.origen)}${ej.simulada ? ' · lectura de ejemplo' : ''}</p>` : ''}
      ${s.esRepaso ? '<p class="tutor-nota">🔁 Repaso</p>' : ''}
      <p class="tutor-enunciado">${escapa(ej.enunciado)}</p>
      ${ej.instruccion ? `<p class="tutor-nota">${escapa(ej.instruccion)}</p>` : ''}
      ${entrada}
      ${!resuelto ? `<div class="fila" style="margin-top:8px">
        ${ej.tipo !== 'opcion' ? '<button class="principal" data-accion="tutor-comprobar">Comprobar</button>' : ''}
        <button data-accion="tutor-pista">💡 Pista</button>
      </div>
      <div class="fila" style="margin-top:6px">
        <button class="fantasma mini" data-accion="tutor-otra">No entiendo</button>
        ${ctx.puedeLeer ? '<button class="fantasma mini" data-accion="tutor-leer">🔊 Léemelo</button>' : ''}
      </div>` : ''}
    </div>
    ${bloqueCorreccion(t.correccion)}
    ${t.ayuda ? `<div class="tarjeta tutor-ayuda" style="margin-top:10px"><p>${escapa(t.ayuda)}</p></div>` : ''}
    ${t.correccion?.sugerirOtra && !t.ejemplo && !resuelto ? `<div class="aviso-caja" style="margin-top:10px">
      Parece que te has atascado. Probemos otra explicación o mira un ejemplo resuelto.
      <div class="fila" style="margin-top:8px"><button class="mini" data-accion="tutor-otra">Otra explicación</button>
      <button class="mini" data-accion="tutor-ejemplo">Ver ejemplo</button></div></div>` : ''}
    ${t.ejemplo ? `<div class="tarjeta tutor-ejemplo" style="margin-top:10px">
      <p><strong>Ejemplo resuelto:</strong> ${escapa(t.ejemplo.enunciado)}</p>
      <ol>${t.ejemplo.pasos.map((p) => `<li>${escapa(p)}</li>`).join('')}</ol>
      ${t.ejemplo.comprobacion ? `<p class="tutor-nota">${escapa(t.ejemplo.comprobacion)}</p>` : ''}
      <p class="tutor-nota">Ahora el tuyo, sin copiar: cambia los números y sigue los mismos pasos.</p>
    </div>` : ''}
    ${resuelto && t.registro ? registroHecho(t, ctx) : ''}
  </section>`;
}

function explicar(estado, ctx, t) {
  const L = V.LECCIONES[t.asignatura];
  const e = t.explicar;
  const acc = L.accion;
  const elegida = e.elegida;
  return cabecera(`Explícame · ${V.nombreAsignatura(t.asignatura)}`) + `
  <section class="seccion">
    ${chipsAsignatura(t.asignatura)}
  </section>
  <section class="seccion">
    <div class="tarjeta tutor-leccion">
      <p class="tutor-nota">${escapa(L.objetivo)}</p>
      <p><strong>${escapa(L.idea)}</strong></p>
      <p class="tutor-ejemplo-linea">${escapa(L.ejemplo)}</p>
      ${e.otra ? `<div class="tutor-ayuda"><p>🔄 ${escapa(L.otra)}</p></div>` : ''}
      <div class="fila" style="margin-top:8px">
        ${!e.otra ? '<button class="fantasma mini" data-accion="tutor-explicar-otra">Otra explicación</button>' : ''}
        ${ctx.puedeLeer ? '<button class="fantasma mini" data-accion="tutor-leer">🔊 Léemelo</button>' : ''}
      </div>
    </div>
    <div class="tarjeta" style="margin-top:10px">
      <p><strong>Tu turno:</strong> ${escapa(acc.pregunta)}</p>
      <div class="tutor-opciones">${acc.opciones.map((o, i) => {
        const cls = elegida === null ? '' : i === acc.correcta ? ' opcion--bien' : i === elegida ? ' opcion--mal' : '';
        return `<button class="opcion${cls}" data-accion="tutor-explicar-elige" data-i="${i}"${elegida !== null ? ' disabled' : ''}>${escapa(o)}</button>`;
      }).join('')}</div>
      ${elegida !== null ? `<p class="tutor-nota" role="status">${elegida === acc.correcta ? '✔ Eso es.' : 'No es esa.'} ${escapa(acc.porque)}</p>
        ${elegida !== acc.correcta && !e.otra ? '<button class="mini" data-accion="tutor-explicar-otra">Explícamelo de otra forma</button>' : ''}` : ''}
    </div>
    ${elegida !== null ? `<div class="tarjeta" style="margin-top:10px">
      <p><strong>${escapa(L.sinMirar.pregunta)}</strong></p>
      ${e.revelado ? `<p>${escapa(L.sinMirar.respuesta)}</p><p class="tutor-nota">En una frase: ${escapa(L.resumen)}</p>
        <button class="principal ancho" data-accion="tutor-practicar">Quiero practicar</button>`
        : '<p class="tutor-nota">Piénsalo o dilo en voz alta antes de mirar.</p><button data-accion="tutor-revelar">Ver respuesta</button>'}
    </div>` : ''}
  </section>`;
}

function repasar(estado, ctx, t) {
  const lista = V.repasosPendientes(t.progreso, ctx.hoy);
  return cabecera('Repasar') + `<section class="seccion">
    ${lista.length ? lista.map((r) => `<div class="tarjeta">
      <p><strong>${escapa(r.nombre)}</strong> · ${escapa(V.nombreAsignatura(r.asignatura))}</p>
      <p>${escapa(V.ESTADOS[r.estado])} · repaso ${escapa(fechaHumana(r.repaso.fecha, ctx.hoy))}</p>
      <p class="tutor-nota">${escapa(r.repaso.motivo)}</p>
      <div class="fila">
        <button class="${r.toca ? 'principal' : ''}" data-accion="tutor-repasar" data-id="${r.id}">Practicar ahora</button>
        ${t.progreso[r.id].aplazado
          ? `<button data-accion="tutor-deshacer" data-id="${r.id}">Deshacer</button>`
          : `<button data-accion="tutor-posponer" data-id="${r.id}">Posponer</button>`}
      </div>
    </div>`).join('') : `<div class="vacio">Aún no hay nada que repasar en Vago Yo: haz un ejercicio y te digo cuándo volver.</div>`}
    <button class="fantasma ancho" data-accion="ir-tarjetas" style="margin-top:10px">Ir a mis tarjetas</button>
    <p class="tutor-nota">En la demo, este progreso se queda en memoria: si cierras la app, se borra.</p>
  </section>`;
}

function hablar(estado, ctx, t) {
  const h = t.hablar;
  const puede = ctx.puedeDictar && ctx.enLinea;
  return cabecera('Hablar') + `<section class="seccion">
    <div class="tarjeta">
      ${puede ? `<button class="${t.grabando ? 'peligro' : 'principal'} ancho grande" data-accion="tutor-dictar" aria-pressed="${t.grabando}">
          ${t.grabando ? '<span class="tutor-rec" aria-hidden="true"></span> Grabando… pulsa para parar' : '🎙️ Pulsa para hablar'}</button>
        <p class="tutor-nota">El micro solo escucha mientras está en rojo. El audio no se guarda.</p>`
        : `<p class="aviso-caja">${ctx.puedeDictar ? 'Sin conexión el dictado no funciona.' : 'Este navegador no deja dictar.'} Escribe aquí debajo.</p>`}
      <label for="tutor-habla" style="margin-top:8px">Revisa lo que has dicho antes de enviarlo</label>
      <textarea id="tutor-habla" rows="2">${escapa(h.texto)}</textarea>
      <button class="ancho" data-accion="tutor-enviar-habla" style="margin-top:8px">Enviar</button>
      <p class="tutor-nota">Prueba: «no entiendo», «otra explicación», «léemelo», «pausa», «quiero practicar», «no puedo más».</p>
    </div>
    ${h.respuesta ? `<div class="tarjeta tutor-ayuda" style="margin-top:10px" role="status"><p>${escapa(h.respuesta)}</p>
      ${h.boton ? `<button class="principal" data-accion="${h.boton.accion}" ${h.boton.pantalla ? `data-pantalla="${h.boton.pantalla}"` : ''} ${h.boton.vista ? `data-vista="${h.boton.vista}"` : ''}>${escapa(h.boton.texto)}</button>` : ''}
    </div>` : ''}
  </section>`;
}

function pausa() {
  return cabecera('Pausa') + `<section class="seccion"><div class="tarjeta" style="text-align:center">
    <p style="font-size:2rem" aria-hidden="true">☕</p>
    <p><strong>Pausa.</strong> Cinco minutos lejos de la pantalla: agua, estirarte, mirar por la ventana.</p>
    <p class="tutor-nota">Cuando vuelvas, tendrás «Seguir donde lo dejé». No se alarga nada solo.</p>
    <button class="principal ancho" data-accion="tutor-ir" data-pantalla="inicio">He vuelto</button>
  </div></section>`;
}

export function vistaTutor(estado, ctx) {
  const t = ctx.tutor;
  const pintor = { inicio, subir, confirmar, ejercicio, explicar, repasar, hablar, pausa }[t.pantalla] || inicio;
  return `<div class="tutor">${pintor(estado, ctx, t)}</div>`;
}

/* ── Panel familiar ────────────────────────────────────────────── */

export function vistaFamilia(estado, ctx) {
  const t = ctx.tutor;
  const r = V.resumenFamiliar(t.progreso, ctx.hoy);
  return `<div class="tutor">
  <div class="tutor-cab">
    <button class="mini fantasma" data-accion="ir" data-vista="tutor" aria-label="Volver a Vago Yo">←</button>
    <div class="tutor-titulo"><strong>Panel de la familia</strong><span>Resumen de la semana</span></div>
  </div>
  <section class="seccion">
    <div class="aviso-caja" role="note">
      <strong>Demostración en este móvil.</strong> Con cuentas (fase 2), la familia lo verá en su propio
      móvil y los permisos se comprobarán en el servidor. Aquí no hay conversaciones, fotos ni audios: el tutor no los guarda.
    </div>
    ${t.ficticio ? '<p class="tutor-nota" style="margin-top:8px">🧪 Datos ficticios de ejemplo.</p>' : ''}
  </section>
  <section class="seccion">
    <div class="tarjeta tutor-resumen">
      <p class="tutor-et">Un avance</p><p>${escapa(r.avance)}</p>
      ${r.dificultad ? `<p class="tutor-et">Una dificultad</p><p>${escapa(r.dificultad)}</p>` : ''}
      ${r.accion ? `<p class="tutor-et">Diez minutos con vosotros</p><p>${escapa(r.accion)}</p>` : ''}
      ${r.proximo ? `<p class="tutor-et">Próximo repaso</p><p>${escapa(r.proximo.habilidad)}, ${escapa(fechaHumana(r.proximo.fecha, ctx.hoy))}. ${escapa(r.proximo.motivo)}</p>` : ''}
    </div>
    ${r.vacio ? '<button class="ancho" data-accion="tutor-ficticio" style="margin-top:10px">Ver con una semana de ejemplo (ficticia)</button>' : ''}
  </section>
  <section class="seccion">
    <header><h2>Qué se comparte</h2></header>
    <div class="tarjeta">
      <ul class="tutor-lista">
        <li>✅ Qué habilidad practicó, si fue solo o con ayuda y el próximo repaso.</li>
        <li>⛔ Lo que escribe o dice al tutor, sus fotos y audios: no se enseñan.</li>
        <li>⛔ Minutos, rachas o número de ejercicios no son una nota de aprendizaje.</li>
        <li>🔕 Avisos fuera de la app: desactivados.</li>
        <li>🔒 Supervisor: nadie tiene acceso. Invitar, limitar y revocar llega en la fase 2.</li>
      </ul>
    </div>
  </section></div>`;
}

/* Tarjeta de entrada en Hoy. */
export function entradaTutor(ctx) {
  const n = V.repasosPendientes(ctx.tutor.progreso, ctx.hoy).filter((r) => r.toca).length;
  return `<section class="seccion">
    <button class="tarjeta tutor-entrada" data-accion="ir" data-vista="tutor">
      <span class="tutor-avatar" aria-hidden="true">VY</span>
      <span><strong>Vago Yo · tu tutor</strong><br><small>Sube un ejercicio, pide una pista o repasa.${n ? ` ${n} repaso${n > 1 ? 's' : ''} para hoy.` : ''}</small></span>
    </button>
  </section>`;
}
