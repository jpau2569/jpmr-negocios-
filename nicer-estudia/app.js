/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — punto de entrada
   Estado, eventos, temporizador de concentración, Profe y PWA.
   Regla de la casa: aquí vive el estado; interfaz.js solo pinta.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, id, mmss, limita, diasEntre, plural } from './utiles.js';
import * as D from './datos.js';
import * as R from './repaso.js';
import * as UI from './interfaz.js';
import * as Q from './cuestionario.js';
import { dibujaEsquema, esquemaDeIA } from './esquema.js';
import { crearAmbiente, AMBIENTES } from './ambiente.js';

/* ── Estado ─────────────────────────────────────────────────────── */
let estado = D.cargar();

const ctx = {
  hoy: aISO(),
  vista: 'hoy',
  sub: 'tarjetas',          // pestaña dentro de Estudiar
  tarjetaActual: null,
  respuestaVisible: false,
  hechasHoy: 0,
  test: null,               // test en marcha
  chat: [],
  propuestas: [],           // tarjetas que ofrece el Profe
  testPropuesto: [],
  esquemaPropuesto: null,
  pensando: false,
  error: null,
  instalable: false
};

const fondo = crearAmbiente();

const $ = (sel) => document.querySelector(sel);
const vista = $('#vista');

function persiste() {
  if (!D.guardar(estado)) {
    avisa('No se ha podido guardar. Si estás en navegación privada, los datos se perderán al cerrar.');
  }
}

/* La primera vez no dejamos la app vacía: sin asignaturas no se puede
   apuntar nada y el primer minuto decide si se vuelve a abrir. */
if (!estado.asignaturas.length && !estado.tareas.length) {
  estado.asignaturas = D.ASIGNATURAS_ESO.map((a) => ({ id: id('as'), nombre: a.nombre, color: a.color, profe: '' }));
  persiste();
}

/* ── Render ─────────────────────────────────────────────────────── */
function render() {
  ctx.hoy = aISO();

  if (ctx.vista === 'estudiar' && ctx.sub === 'tarjetas') {
    const cola = R.colaDeHoy(estado.tarjetas, ctx.hoy, estado.ajustes.tarjetasPorDia);
    ctx.tarjetaActual = cola[0] || null;
    if (!ctx.tarjetaActual) ctx.respuestaVisible = false;
  }

  const pintores = {
    hoy: UI.vistaHoy, agenda: UI.vistaAgenda, estudiar: UI.vistaEstudiar,
    profe: UI.vistaProfe, yo: UI.vistaYo
  };
  vista.innerHTML = (pintores[ctx.vista] || UI.vistaHoy)(estado, ctx);

  document.querySelectorAll('#nav button').forEach((b) => {
    if (b.dataset.vista === ctx.vista) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  const racha = R.rachaVigente(estado.racha, ctx.hoy);
  $('#racha').querySelector('span').textContent = racha;
  $('#racha').style.opacity = racha ? '1' : '.45';
  $('#sub-cabecera').textContent = `${estado.alumno.curso} · ${estado.alumno.centro}`;

  const n = UI.contadores(estado, ctx.hoy);
  marcaAviso('#aviso-agenda', n.agenda);
  marcaAviso('#aviso-repaso', n.repaso);

  if (ctx.vista === 'profe') {
    const caja = $('#chat');
    if (caja) caja.scrollTop = caja.scrollHeight;
  }
}

function marcaAviso(sel, valor) {
  const el = $(sel);
  if (!el) return;
  el.textContent = valor > 9 ? '9+' : valor;
  el.classList.toggle('oculto', !valor);
}

function irA(nombre) {
  ctx.vista = nombre;
  ctx.respuestaVisible = false;
  render();
  vista.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ── Diálogo genérico ───────────────────────────────────────────── */
const dlg = $('#dlg');

function pide({ titulo, html, aceptar = 'Guardar' }) {
  return new Promise((resuelve) => {
    $('#dlg-titulo').textContent = titulo;
    $('#dlg-cuerpo').innerHTML = html;
    $('#dlg-aceptar').textContent = aceptar;

    const cierra = (valor) => {
      $('#dlg-aceptar').removeEventListener('click', ok);
      $('#dlg-cancelar').removeEventListener('click', no);
      dlg.removeEventListener('cancel', no);
      dlg.close();
      resuelve(valor);
    };
    const ok = () => {
      const datos = {};
      $('#dlg-cuerpo').querySelectorAll('[name]').forEach((c) => { datos[c.name] = c.value; });
      cierra(datos);
    };
    const no = (e) => { e?.preventDefault?.(); cierra(null); };

    $('#dlg-aceptar').addEventListener('click', ok);
    $('#dlg-cancelar').addEventListener('click', no);
    dlg.addEventListener('cancel', no);
    dlg.showModal();
    const primero = $('#dlg-cuerpo').querySelector('input,textarea,select');
    if (primero && !matchMedia('(pointer: coarse)').matches) primero.focus();
  });
}

function avisa(texto) {
  return pide({ titulo: 'Aviso', html: `<p>${texto}</p>`, aceptar: 'Vale' });
}

async function confirma(texto) {
  const r = await pide({ titulo: '¿Seguro?', html: `<p>${texto}</p>`, aceptar: 'Sí, hazlo' });
  return r !== null;
}

/* ── Acciones ───────────────────────────────────────────────────── */
const acciones = {
  ir: (el) => irA(el.dataset.vista),

  /* Agenda */
  'nueva-tarea': async () => {
    const d = await pide({ titulo: 'Apuntar deberes', html: UI.formTarea(estado, ctx.hoy) });
    if (!d || !d.titulo?.trim()) return;
    estado.tareas.push({
      id: id('ta'), titulo: d.titulo.trim().slice(0, 200),
      asignaturaId: d.asignatura || null, tipo: 'deber',
      prioridad: d.prioridad === 'alta' ? 'alta' : 'normal',
      repetir: D.REPETICIONES.includes(d.repetir) ? d.repetir : 'no',
      para: d.para || ctx.hoy, hecha: false, hechaEl: null, creada: ctx.hoy
    });
    persiste(); render();
  },
  'alternar-tarea': (el) => {
    const t = estado.tareas.find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.hecha = !t.hecha;
    t.hechaEl = t.hecha ? ctx.hoy : null;
    if (t.hecha) {
      celebra();
      // Si se repite, la siguiente nace en cuanto se marca esta.
      const siguiente = D.repiteTarea(t, ctx.hoy);
      if (siguiente && !estado.tareas.some((x) => !x.hecha && x.titulo === t.titulo && x.para === siguiente.para)) {
        estado.tareas.push(siguiente);
      }
    }
    persiste(); render();
  },
  'borrar-tarea': async (el) => {
    if (!(await confirma('¿Borrar estos deberes?'))) return;
    estado.tareas = estado.tareas.filter((x) => x.id !== el.dataset.id);
    persiste(); render();
  },
  'nuevo-examen': async () => {
    const d = await pide({ titulo: 'Apuntar examen', html: UI.formExamen(estado, ctx.hoy) });
    if (!d || !d.fecha) return;
    estado.examenes.push({
      id: id('ex'), titulo: (d.titulo || 'Examen').trim().slice(0, 120),
      asignaturaId: d.asignatura || null, fecha: d.fecha,
      temas: (d.temas || '').trim().slice(0, 500), nota: null
    });
    persiste(); render();
  },
  'ver-plan': async (el) => {
    const e = estado.examenes.find((x) => x.id === el.dataset.id);
    if (!e) return;
    await pide({ titulo: 'Plan de estudio', html: UI.vistaPlan(estado, e, ctx.hoy), aceptar: 'Entendido' });
  },

  sub: (el) => {
    ctx.sub = el.dataset.sub;
    ctx.respuestaVisible = false;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  /* Test */
  'test-tarjetas': () => {
    const preguntas = Q.generaDesdeTarjetas(estado.tarjetas, { cuantas: 8 });
    if (!preguntas.length) return avisa('Necesitas al menos cuatro tarjetas para que el test tenga sentido.');
    empiezaTest(preguntas, 'Test de tus tarjetas');
  },
  'empezar-test-ia': () => {
    if (!ctx.testPropuesto.length) return;
    const preguntas = ctx.testPropuesto;
    ctx.testPropuesto = [];
    empiezaTest(preguntas, 'Test del Profe');
    irA('estudiar');
  },
  'descartar-test': () => { ctx.testPropuesto = []; render(); },
  responder: (el) => {
    if (!ctx.test || ctx.test.terminado) return;
    const elegida = Number(el.dataset.i);
    if (ctx.test.respuestas[ctx.test.i] !== null) return;
    ctx.test.respuestas[ctx.test.i] = elegida;
    if (elegida === ctx.test.preguntas[ctx.test.i].correcta) celebra();
    else tono(220, 0.18);
    render();
  },
  'siguiente-pregunta': () => {
    if (!ctx.test) return;
    if (ctx.test.i + 1 < ctx.test.preguntas.length) { ctx.test.i += 1; render(); return; }
    terminaTest();
  },
  'cerrar-test': () => { ctx.test = null; render(); },

  /* Esquemas */
  'guardar-esquema': () => {
    const propuesto = ctx.esquemaPropuesto;
    if (!propuesto) return;
    const asig = propuesto.asignatura ? D.buscaAsignatura(estado, propuesto.asignatura) : null;
    estado.esquemas.push({
      id: id('es'), asignaturaId: asig?.id || null,
      titulo: propuesto.titulo, ramas: propuesto.ramas, fecha: ctx.hoy
    });
    ctx.esquemaPropuesto = null;
    persiste();
    ctx.sub = 'esquemas';
    irA('estudiar');
  },
  'descartar-esquema': () => { ctx.esquemaPropuesto = null; render(); },
  'borrar-esquema': async (el) => {
    if (!(await confirma('¿Borrar este esquema?'))) return;
    estado.esquemas = estado.esquemas.filter((e) => e.id !== el.dataset.id);
    persiste(); render();
  },
  'ver-esquema': async (el) => {
    const e = estado.esquemas.find((x) => x.id === el.dataset.id);
    if (!e) return;
    const { svg } = dibujaEsquema(e, { color: D.colorAsignatura(estado, e.asignaturaId) });
    await pide({
      titulo: e.titulo,
      html: `<div class="lienzo-esquema lienzo-esquema--grande">${svg}</div>
        <p style="font-size:.82rem;color:var(--tinta-2);margin-top:8px">Desliza a los lados para verlo entero.</p>`,
      aceptar: 'Cerrar'
    });
  },
  'descargar-esquema': (el) => descargaEsquema(el.dataset.id),

  /* Apuntes */
  'nuevo-apunte': async () => {
    const d = await pide({ titulo: 'Nuevo apunte', html: UI.formApunte(estado) });
    if (!d || !(d.texto || '').trim()) return;
    estado.apuntes.push({
      id: id('ap'), asignaturaId: d.asignatura || null,
      titulo: (d.titulo || 'Apunte').trim().slice(0, 120),
      texto: d.texto.trim().slice(0, 20000), fecha: ctx.hoy
    });
    persiste(); render();
  },
  'editar-apunte': async (el) => {
    const n = estado.apuntes.find((x) => x.id === el.dataset.id);
    if (!n) return;
    const d = await pide({ titulo: 'Apunte', html: UI.formApunte(estado, n) });
    if (!d) return;
    n.titulo = (d.titulo || 'Apunte').trim().slice(0, 120);
    n.texto = (d.texto || '').trim().slice(0, 20000);
    n.asignaturaId = d.asignatura || null;
    persiste(); render();
  },
  'borrar-apunte': async (el) => {
    if (!(await confirma('¿Borrar este apunte?'))) return;
    estado.apuntes = estado.apuntes.filter((x) => x.id !== el.dataset.id);
    persiste(); render();
  },
  'tarjetas-de-apunte': (el) => {
    const n = estado.apuntes.find((x) => x.id === el.dataset.id);
    if (!n) return;
    irA('profe');
    const caja = $('#profe-texto');
    if (caja) {
      caja.value = `Hazme tarjetas de este apunte de ${D.nombreAsignatura(estado, n.asignaturaId)} `
        + `titulado "${n.titulo}":\n\n${n.texto.slice(0, 3000)}`;
    }
    preguntaAlProfe();
  },

  /* Ambiente de fondo */
  'elegir-ambiente': (el) => {
    estado.ajustes.ambiente = el.dataset.id;
    persiste();
    if (!foco.el.hidden || el.dataset.id === 'ninguno') aplicaAmbiente();
    else fondo.reproducir(el.dataset.id, estado.ajustes.volumen); // una probadita al elegirlo
    render();
    if (foco.el.hidden && el.dataset.id !== 'ninguno') setTimeout(() => { if (foco.el.hidden) fondo.parar(); }, 4000);
  },

  /* Repaso */
  'nueva-tarjeta': async () => {
    const d = await pide({ titulo: 'Nueva tarjeta', html: UI.formTarjeta(estado) });
    if (!d || !d.pregunta?.trim() || !d.respuesta?.trim()) return;
    estado.tarjetas.push({
      id: id('tj'),
      ...R.nuevaTarjeta({ pregunta: d.pregunta, respuesta: d.respuesta, asignaturaId: d.asignatura || null }, ctx.hoy)
    });
    persiste(); render();
  },
  'ver-respuesta': () => { ctx.respuestaVisible = true; render(); },
  acierto: () => resuelveTarjeta(true),
  fallo: () => resuelveTarjeta(false),
  'borrar-tarjeta': async (el) => {
    if (!(await confirma('¿Borrar esta tarjeta?'))) return;
    estado.tarjetas = estado.tarjetas.filter((x) => x.id !== el.dataset.id);
    persiste(); render();
  },

  /* Concentración */
  'empezar-foco': () => arrancaFoco(estado.ajustes.pomodoro, 'Concentración'),
  'empezar-cinco': () => arrancaFoco(5, 'Solo 5 minutos'),

  /* Yo */
  'nueva-asignatura': async () => {
    const d = await pide({ titulo: 'Nueva asignatura', html: UI.formAsignatura() });
    if (!d || !d.nombre?.trim()) return;
    estado.asignaturas.push({ id: id('as'), nombre: d.nombre.trim().slice(0, 60), color: d.color || '#57606a', profe: '' });
    persiste(); render();
  },
  'asignaturas-eso': () => {
    estado.asignaturas = D.ASIGNATURAS_ESO.map((a) => ({ id: id('as'), nombre: a.nombre, color: a.color, profe: '' }));
    persiste(); render();
  },
  'borrar-asignatura': async (el) => {
    if (!(await confirma('Se borra la asignatura. Los deberes y tarjetas que tenía se quedan como «General».'))) return;
    estado.asignaturas = estado.asignaturas.filter((a) => a.id !== el.dataset.id);
    estado = D.normaliza(estado); // limpia las referencias que se quedan huérfanas
    persiste(); render();
  },
  'nueva-clase': async (el) => {
    const dia = Number(el.dataset.dia);
    const d = await pide({ titulo: 'Añadir clase', html: UI.formClase(estado, dia) });
    if (!d || !d.asignatura) return;
    estado.horario[dia] = [...(estado.horario[dia] || []), { id: id('cl'), asignaturaId: d.asignatura, hora: d.hora || '' }];
    estado = D.normaliza(estado); // deja el día ordenado por hora
    persiste(); render();
  },
  'borrar-clase': (el) => {
    const dia = Number(el.dataset.dia);
    estado.horario[dia] = (estado.horario[dia] || []).filter((c) => c.id !== el.dataset.id);
    persiste(); render();
  },
  'nueva-nota': async () => {
    const d = await pide({ titulo: 'Apuntar nota', html: UI.formNota(estado, ctx.hoy) });
    if (!d || !d.asignatura || d.valor === '') return;
    estado.notas.push({
      id: id('nt'), asignaturaId: d.asignatura, titulo: (d.titulo || 'Nota').slice(0, 120),
      valor: limita(d.valor, 0, 10), fecha: d.fecha || ctx.hoy
    });
    persiste(); render();
  },
  parte: async () => {
    const texto = UI.textoParteSemanal(estado, ctx.hoy);
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* cancelado */ }
    }
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    await pide({
      titulo: 'Parte de la semana',
      html: `<pre style="white-space:pre-wrap;font:inherit;margin:0 0 12px">${texto.replace(/</g, '&lt;')}</pre>
        <a class="boton principal ancho" href="${url}" target="_blank" rel="noopener">Abrir en WhatsApp</a>`,
      aceptar: 'Cerrar'
    });
  },
  exportar: () => {
    const blob = new Blob([D.exportar(estado)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nicer-estudia-${ctx.hoy}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  importar: async () => {
    const d = await pide({ titulo: 'Restaurar copia', html: UI.formImportar(), aceptar: 'Restaurar' });
    if (!d || !d.copia?.trim()) return;
    const r = D.importar(d.copia);
    if (!r.ok) return avisa(`No se pudo leer la copia: ${r.error}`);
    estado = r.estado;
    persiste(); render();
    avisa('Copia restaurada.');
  },
  'borrar-todo': async () => {
    if (!(await confirma('Se borra TODO: deberes, exámenes, tarjetas, notas y horario. No hay vuelta atrás.'))) return;
    estado = D.estadoInicial();
    estado.asignaturas = D.ASIGNATURAS_ESO.map((a) => ({ id: id('as'), nombre: a.nombre, color: a.color, profe: '' }));
    persiste(); render();
  },
  instalar: async () => {
    if (!instalacion) return;
    instalacion.prompt();
    await instalacion.userChoice.catch(() => {});
    instalacion = null;
    ctx.instalable = false;
    render();
  },

  /* Profe */
  preguntar: () => preguntaAlProfe(),
  'limpiar-chat': () => {
    ctx.chat = [];
    ctx.propuestas = [];
    ctx.testPropuesto = [];
    ctx.esquemaPropuesto = null;
    ctx.error = null;
    render();
  },
  'guardar-tarjetas': () => {
    for (const p of ctx.propuestas) {
      const asig = p.asignatura ? D.buscaAsignatura(estado, p.asignatura) : null;
      estado.tarjetas.push({
        id: id('tj'),
        ...R.nuevaTarjeta({ pregunta: p.pregunta, respuesta: p.respuesta, asignaturaId: asig?.id || null, origen: 'ia' }, ctx.hoy)
      });
    }
    const cuantas = ctx.propuestas.length;
    ctx.propuestas = [];
    persiste();
    ctx.sub = 'tarjetas';
    irA('estudiar');
    avisa(`${plural(cuantas, 'tarjeta añadida', 'tarjetas añadidas')}. Ya te tocan hoy.`);
  },
  'descartar-tarjetas': () => { ctx.propuestas = []; render(); }
};

/* ── Test ───────────────────────────────────────────────────────── */
function empiezaTest(preguntas, titulo) {
  ctx.test = {
    titulo,
    preguntas,
    respuestas: preguntas.map(() => null),
    i: 0,
    terminado: false,
    resultado: null
  };
  ctx.sub = 'test';
  render();
}

/* Al terminar, lo fallado no se queda en un número: vuelve al repaso. Esa es
   la diferencia entre un test que entretiene y uno que sirve. */
function terminaTest() {
  const t = ctx.test;
  if (!t) return;
  const resultado = Q.corrige(t.preguntas, t.respuestas);
  t.resultado = resultado;
  t.terminado = true;

  for (const fallada of resultado.falladas) {
    const i = estado.tarjetas.findIndex((c) => c.id === fallada.tarjetaId);
    if (i >= 0) estado.tarjetas[i] = R.repasada(estado.tarjetas[i], false, ctx.hoy);
    else if (fallada.tarjetaId === null) {
      // Pregunta del Profe: se convierte en tarjeta para no perder el fallo.
      estado.tarjetas.push({
        id: id('tj'),
        ...R.nuevaTarjeta({
          pregunta: fallada.pregunta,
          respuesta: fallada.opciones[fallada.correcta],
          asignaturaId: fallada.asignaturaId || null,
          origen: 'ia'
        }, ctx.hoy)
      });
    }
  }

  estado.tests.push({
    id: id('te'),
    asignaturaId: t.preguntas[0]?.asignaturaId || null,
    titulo: t.titulo,
    aciertos: resultado.aciertos,
    total: resultado.total,
    nota: resultado.nota,
    fecha: ctx.hoy
  });

  ctx.hechasHoy += resultado.total;
  marcaActividad();
  if (resultado.nota >= 5) { tono(660, 0.12); tono(880, 0.18, 0.12); }
  persiste();
  render();
}

/* ── Esquemas ───────────────────────────────────────────────────── */
/* El SVG se pasa a PNG con un canvas: así se puede guardar en la galería y
   mandarlo por WhatsApp, que es lo que va a hacer de verdad. */
function descargaEsquema(idEsquema) {
  const e = estado.esquemas.find((x) => x.id === idEsquema);
  if (!e) return;
  const { svg, ancho, alto } = dibujaEsquema(e, { color: D.colorAsignatura(estado, e.asignaturaId) });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const pincel = lienzo.getContext('2d');
    pincel.fillStyle = '#ffffff';
    pincel.fillRect(0, 0, ancho, alto);
    pincel.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    lienzo.toBlob((png) => {
      if (!png) return avisa('No se ha podido crear la imagen en este navegador.');
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(png);
      enlace.download = `esquema-${e.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 4000);
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    avisa('No se ha podido crear la imagen en este navegador.');
  };
  img.src = url;
}

/* ── Sonido de fondo ────────────────────────────────────────────── */
function aplicaAmbiente() {
  const id = estado.ajustes.ambiente;
  if (foco.el.hidden || id === 'ninguno' || !estado.ajustes.sonido) fondo.parar();
  else fondo.reproducir(id, estado.ajustes.volumen);
}

function resuelveTarjeta(acierto) {
  const actual = ctx.tarjetaActual;
  if (!actual) return;
  const i = estado.tarjetas.findIndex((t) => t.id === actual.id);
  if (i < 0) return;
  estado.tarjetas[i] = R.repasada(estado.tarjetas[i], acierto, ctx.hoy);
  ctx.hechasHoy += 1;
  ctx.respuestaVisible = false;
  marcaActividad();
  if (acierto) celebra();
  persiste(); render();
}

/* Cuenta el día para la racha en cuanto hay trabajo de verdad hecho. */
function marcaActividad() {
  const minutos = D.minutosDelDia(estado, ctx.hoy);
  if (minutos >= R.MINIMO_RACHA || ctx.hechasHoy >= 3) {
    estado.racha = R.actualizaRacha(estado.racha, ctx.hoy);
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const fn = acciones[el.dataset.accion];
  if (!fn) return;
  ev.preventDefault();
  fn(el);
});

$('#nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-vista]');
  if (b) irA(b.dataset.vista);
});

/* Ajustes: se guardan al salir del campo, sin botón de guardar. */
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-ajuste]');
  if (!el) return;
  const [grupo, campo] = el.dataset.ajuste.split('.');
  estado[grupo][campo] = el.type === 'number' ? Number(el.value) : el.value;
  estado = D.normaliza(estado);
  persiste();
  render();
});

/* ── Modo concentración ─────────────────────────────────────────── */
const foco = {
  el: $('#foco'), reloj: $('#foco-reloj'), barra: $('#foco-barra'), que: $('#foco-que'),
  planta: $('#foco-planta'), aguante: $('#foco-aguante'), ambientes: $('#foco-ambientes'),
  total: 0, restan: 0, tic: null, pausado: false, descanso: false, salidas: 0
};

/* Los ambientes se eligen desde la propia pantalla de concentración: si hay
   que salir a Ajustes para cambiar la lluvia, no se cambia nunca. */
function pintaAmbientes() {
  foco.ambientes.innerHTML = AMBIENTES.map((a) => `<button class="chip${estado.ajustes.ambiente === a.id ? ' chip--activo' : ''}"
    data-accion="elegir-ambiente" data-id="${a.id}">${a.emoji}</button>`).join('');
}

function arrancaFoco(minutos, etiqueta) {
  foco.total = Math.max(1, minutos) * 60;
  foco.restan = foco.total;
  foco.pausado = false;
  foco.descanso = false;
  foco.salidas = 0;
  foco.que.textContent = etiqueta;
  foco.el.classList.remove('descanso');
  foco.el.hidden = false;
  foco.planta.innerHTML = UI.mascota(R.rachaVigente(estado.racha, ctx.hoy), 84);
  foco.aguante.textContent = 'Deja el móvil en la mesa. Si sales de la app, se nota.';
  pintaAmbientes();
  aplicaAmbiente();
  $('#foco-pausa').textContent = 'Pausa';
  pintaFoco();
  clearInterval(foco.tic);
  foco.tic = setInterval(latido, 1000);
  document.body.style.overflow = 'hidden';
}

function latido() {
  if (foco.pausado) return;
  foco.restan -= 1;
  if (foco.restan <= 0) {
    pitido();
    if (foco.descanso) return cierraFoco();
    return terminaFoco(true);
  }
  pintaFoco();
}

function pintaFoco() {
  foco.reloj.textContent = mmss(foco.restan);
  foco.barra.style.width = `${Math.round(((foco.total - foco.restan) / foco.total) * 100)}%`;
}

/** Guarda los minutos hechos (completos o no) y ofrece el descanso. */
function terminaFoco(completo) {
  const minutos = Math.round((foco.total - foco.restan) / 60);
  clearInterval(foco.tic);
  if (minutos >= 1) {
    estado.sesiones.push({ fecha: ctx.hoy, minutos, asignaturaId: null, salidas: foco.salidas });
    marcaActividad();
    persiste();
  }
  if (completo && estado.ajustes.descanso > 0) {
    foco.descanso = true;
    foco.total = estado.ajustes.descanso * 60;
    foco.restan = foco.total;
    foco.que.textContent = 'Descanso: levántate y bebe agua';
    foco.el.classList.add('descanso');
    pintaFoco();
    foco.tic = setInterval(latido, 1000);
    render();
    return;
  }
  cierraFoco();
}

function cierraFoco() {
  clearInterval(foco.tic);
  foco.el.hidden = true;
  foco.el.classList.remove('descanso');
  document.body.style.overflow = '';
  fondo.parar();
  render();
}

$('#foco-pausa').addEventListener('click', () => {
  foco.pausado = !foco.pausado;
  $('#foco-pausa').textContent = foco.pausado ? 'Seguir' : 'Pausa';
});
$('#foco-fin').addEventListener('click', () => terminaFoco(false));
$('#foco-salir').addEventListener('click', () => { clearInterval(foco.tic); cierraFoco(); });

/* El móvil suspende los temporizadores al bloquear la pantalla: al volver,
   se recalcula el tiempo real transcurrido en vez de fiarse del intervalo. */
let salidaFoco = null;
document.addEventListener('visibilitychange', () => {
  if (foco.el.hidden) return;
  if (document.hidden) {
    salidaFoco = Date.now();
    if (!foco.pausado && !foco.descanso) {
      foco.salidas += 1;
      // Sin bloquear nada (una web no puede), pero contándolo: saber que se
      // nota es justo lo que hace que la próxima vez no se salga.
      foco.aguante.textContent = foco.salidas === 1
        ? 'Has salido una vez. Vuelve, que ibas bien.'
        : `Has salido ${foco.salidas} veces de la app.`;
    }
    return;
  }
  if (salidaFoco && !foco.pausado) {
    foco.restan = Math.max(0, foco.restan - Math.round((Date.now() - salidaFoco) / 1000));
    pintaFoco();
    if (foco.restan <= 0) { pitido(); foco.descanso ? cierraFoco() : terminaFoco(true); }
  }
  salidaFoco = null;
});

/* ── Sonidos ────────────────────────────────────────────────────── */
let audio = null;
function tono(frecuencia, duracion = 0.16, retraso = 0) {
  if (!estado.ajustes.sonido) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    vol.gain.setValueAtTime(0.0001, audio.currentTime + retraso);
    vol.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + retraso + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + retraso + duracion);
    osc.connect(vol).connect(audio.destination);
    osc.start(audio.currentTime + retraso);
    osc.stop(audio.currentTime + retraso + duracion + 0.02);
  } catch { /* sin audio, la app sigue igual */ }
}
const pitido = () => { tono(660); tono(880, 0.2, 0.18); };
const celebra = () => tono(880, 0.09);

/* ── Profe ──────────────────────────────────────────────────────── */
async function preguntaAlProfe() {
  const caja = $('#profe-texto');
  const texto = (caja?.value || '').trim();
  if (!texto || ctx.pensando) return;

  ctx.chat.push({ rol: 'user', texto });
  ctx.pensando = true;
  ctx.error = null;
  ctx.propuestas = [];
  ctx.testPropuesto = [];
  ctx.esquemaPropuesto = null;
  render();

  try {
    const res = await fetch('/api/profe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensajes: ctx.chat.slice(-16).map((m) => ({ role: m.rol, content: m.texto })),
        curso: estado.alumno.curso,
        nombre: estado.alumno.nombre,
        asignaturas: estado.asignaturas.map((a) => a.nombre)
      })
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
    ctx.chat.push({ rol: 'profe', texto: datos.reply || 'No he sabido responder a eso.' });
    ctx.propuestas = Array.isArray(datos.tarjetas) ? datos.tarjetas.slice(0, 20) : [];
    const asigTest = datos.esquema?.asignatura ? D.buscaAsignatura(estado, datos.esquema.asignatura) : null;
    ctx.testPropuesto = Q.preguntasDeIA(datos.test, asigTest?.id || null);
    ctx.esquemaPropuesto = datos.esquema
      ? (() => {
          const validado = esquemaDeIA(datos.esquema);
          return validado ? { ...validado, asignatura: datos.esquema.asignatura || '' } : null;
        })()
      : null;
  } catch (e) {
    ctx.error = navigator.onLine
      ? `El Profe no ha podido responder: ${e.message}`
      : 'Sin conexión. El Profe necesita internet; el resto de la app funciona igual.';
  } finally {
    ctx.pensando = false;
    render();
  }
}

/* Enter envía, Mayús+Enter hace salto de línea. */
document.addEventListener('keydown', (ev) => {
  if (ev.target?.id === 'profe-texto' && ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    preguntaAlProfe();
  }
});

/* ── PWA ────────────────────────────────────────────────────────── */
let instalacion = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  instalacion = ev;
  ctx.instalable = true;
  if (ctx.vista === 'yo') render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

/* Si la app se queda abierta de un día para otro, al volver se repinta con
   la fecha nueva: si no, "hoy" seguiría siendo ayer. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && aISO() !== ctx.hoy) {
    ctx.hechasHoy = 0;
    render();
  }
});

/* Si se saltó días, la racha ya no vale: se guarda rota para no mentir. */
if (estado.racha.ultimoDia && diasEntre(estado.racha.ultimoDia, ctx.hoy) > 1) {
  estado.racha = { ...estado.racha, dias: 0 };
  persiste();
}

const inicial = new URLSearchParams(location.search).get('vista');
// 'repaso' era el nombre viejo de la pestaña: los accesos directos que ya
// estén instalados en el móvil tienen que seguir funcionando.
const equivalencias = { repaso: 'estudiar' };
const pedida = equivalencias[inicial] || inicial;
if (pedida && ['hoy', 'agenda', 'estudiar', 'profe', 'yo'].includes(pedida)) ctx.vista = pedida;

render();
