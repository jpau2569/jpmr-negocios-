/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — punto de entrada
   Estado, eventos, temporizador de concentración, Profe y PWA.
   Regla de la casa: aquí vive el estado; interfaz.js solo pinta.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, id, mmss, limita, diasEntre, plural, escapa } from './utiles.js';
import * as D from './datos.js';
import * as R from './repaso.js';
import * as UI from './interfaz.js';
import * as Q from './cuestionario.js';
import { dibujaEsquema, esquemaDeIA } from './esquema.js';
import { crearAmbiente, AMBIENTES } from './ambiente.js';
import * as Voz from './voz.js';
import { preparaFotos, ajustesPara, AJUSTES_CHAT, MAX_FOTOS } from './foto.js';
import { icsExamen } from './calendario.js';
import * as L from './lecciones.js';
import * as F from './ficha.js';
import * as B from './bloques.js';

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
  chat: D.cargarChat(),      // la charla con Clara sobrevive a cerrar la app
  propuestas: [],           // tarjetas que ofrece Clara
  testPropuesto: [],
  esquemaPropuesto: null,
  horarioPropuesto: null,   // horario leído de una foto, pendiente de confirmar
  fotosPendientes: [],      // fotos elegidas y reducidas, aún sin mandar (hasta 6)
  preparandoFotos: null,    // «2 de 5» mientras se reducen en el móvil
  borrador: '',             // lo escrito en la caja, para no perderlo al repintar
  leccionAbierta: null,     // lección que se está leyendo en Estudiar → Lecciones
  filtroAsig: '',           // asignatura elegida en la lista de lecciones
  resumiendo: null,         // lección que Clara está resumiendo ahora mismo
  preparandoMaterial: null, // lección a la que Clara le está preparando el material
  preparandoExamen: false,
  fotosLeccion: {},         // fotos de páginas en memoria (no se guardan), por lección
  dictando: false,
  puedeDictar: Voz.puedeDictar(),
  puedeLeer: Voz.puedeLeer(),
  // Con ratón y teclado (PC) se enseñan los atajos; en el móvil no estorban.
  teclado: typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches,
  pensando: false,
  error: null,
  instalable: false
};

let pararDictado = null;

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
    const texto = $('#profe-texto');
    if (texto) texto.value = ctx.borrador;
  }
}

function marcaAviso(sel, valor) {
  const el = $(sel);
  if (!el) return;
  el.textContent = valor > 9 ? '9+' : valor;
  el.classList.toggle('oculto', !valor);
}

function irA(nombre) {
  if (nombre !== ctx.vista) Voz.calla();
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
      $('#dlg-cuerpo').querySelectorAll('[name]').forEach((c) => {
        // Las casillas marcadas se juntan en una lista (lecciones de un
        // examen); los archivos se pasan tal cual (fotos de una lección).
        if (c.type === 'checkbox') {
          datos[c.name] = datos[c.name] || [];
          if (c.checked) datos[c.name].push(c.value);
        } else if (c.type === 'radio') {
          if (c.checked) datos[c.name] = c.value;
        } else if (c.type === 'file') {
          // Las fotos se van juntando en varias tandas (ver «f-fotos» abajo).
          datos[c.name] = c._fotos ? [...c._fotos] : Array.from(c.files || []);
        } else {
          datos[c.name] = c.value;
        }
      });
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
      temas: (d.temas || '').trim().slice(0, 500), nota: null,
      leccionIds: Array.isArray(d.lecciones) ? d.lecciones : []
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
    if (ctx.test.desarrollo.length) { ctx.test.fase = 'desarrollo'; render(); window.scrollTo({ top: 0 }); return; }
    terminaTest();
  },
  'entregar-examen': () => entregaExamen(),
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
      ...R.nuevaTarjeta({ pregunta: d.pregunta, respuesta: d.respuesta, asignaturaId: d.asignatura || null }, ctx.hoy),
      idioma: d.idioma === 'en' ? 'en' : 'es'
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
  'empezar-foco': () => arrancaFoco(estado.ajustes.pomodoro, 'Concentración',
    B.planDeBloques(estado, ctx.hoy, { minutos: estado.ajustes.pomodoro, bloque: estado.ajustes.bloque })),
  // «No me toca / no puedo»: cambia la asignatura del bloque en marcha por la siguiente candidata.
  'cambiar-bloque': () => {
    const i = foco.bloqueActual;
    if (!foco.plan.length || i < 0) return;
    const otra = B.alternativa(estado, ctx.hoy, foco.plan, i);
    if (!otra) { foco.aguante.textContent = 'No hay otra asignatura pendiente hoy: sigue con esta.'; return; }
    foco.plan[i] = { ...otra, inicio: foco.plan[i].inicio, fin: foco.plan[i].fin };
    pintaBloque(false);
  },
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
  /* En el móvil la copia se comparte (WhatsApp, correo, Drive) para
     abrirla en el PC; donde no se pueda compartir un archivo, se descarga. */
  exportar: async () => {
    const nombre = `nicer-estudia-${ctx.hoy}.json`;
    const archivo = new File([D.exportar(estado)], nombre, { type: 'application/json' });
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: 'Copia de Nicer Estudia' }); return; } catch (e) {
        if (e?.name === 'AbortError') return; // lo canceló él
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(archivo);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  importar: async () => {
    const d = await pide({ titulo: 'Abrir una copia', html: UI.formImportar(), aceptar: 'Abrir' });
    if (!d) return;
    let texto = (d.copia || '').trim();
    if (d.archivo?.[0]) {
      try { texto = await d.archivo[0].text(); } catch { return avisa('No he podido leer ese archivo.'); }
    }
    if (!texto) return;
    const r = D.importar(texto);
    if (!r.ok) return avisa(`Ese archivo no es una copia de Nicer Estudia (${r.error}).`);
    const ok = await confirma(`La copia trae: ${D.resumenDatos(r.estado)}.<br /><br />`
      + `Sustituye lo que hay ahora en este aparato: ${D.resumenDatos(estado)}.`);
    if (!ok) return;
    estado = r.estado;
    persiste(); render();
    avisa('Copia abierta. Ya tienes aquí todo lo de la copia.');
  },
  'ir-tarjetas': () => { ctx.sub = 'tarjetas'; irA('estudiar'); },
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
    Voz.calla();
    ctx.chat = [];
    D.guardarChat([]);
    ctx.horarioPropuesto = null;
    ctx.fotosPendientes = [];
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
        ...R.nuevaTarjeta({ pregunta: p.pregunta, respuesta: p.respuesta, asignaturaId: asig?.id || null, origen: 'ia' }, ctx.hoy),
        idioma: p.idioma === 'en' ? 'en' : 'es'
      });
    }
    const cuantas = ctx.propuestas.length;
    ctx.propuestas = [];
    persiste();
    ctx.sub = 'tarjetas';
    irA('estudiar');
    avisa(`${plural(cuantas, 'tarjeta añadida', 'tarjetas añadidas')}. Ya te tocan hoy.`);
  },
  'descartar-tarjetas': () => { ctx.propuestas = []; render(); },

  /* Clara: sugerencias, foto, voz y horario */
  sugerencia: (el) => {
    const s = UI.SUGERENCIAS.find((x) => x.id === el.dataset.id);
    if (!s) return;
    ctx.borrador = s.rellena;
    render();
    if (s.foto) acciones['elegir-foto']();
    else enfocaCaja();
  },
  'elegir-foto': () => {
    if (ctx.preparandoFotos) return;
    if (ctx.fotosPendientes.length >= MAX_FOTOS) {
      ctx.error = `Como mucho ${MAX_FOTOS} fotos por mensaje. Manda estas y luego sigues.`;
      return render();
    }
    $('#foto-input')?.click();
  },
  'quitar-foto': (el) => {
    const i = Number(el.dataset.i);
    ctx.fotosPendientes = Number.isInteger(i) ? ctx.fotosPendientes.filter((_, j) => j !== i) : [];
    render();
  },
  dictar: () => {
    if (ctx.dictando) { pararDictado?.(); return; }
    Voz.calla();
    const antes = ctx.borrador ? ctx.borrador.trim() + ' ' : '';
    pararDictado = Voz.dicta({
      alTexto: (t) => {
        ctx.borrador = antes + t;
        const caja = $('#profe-texto');
        if (caja) caja.value = ctx.borrador;
      },
      alTerminar: () => { ctx.dictando = false; pararDictado = null; render(); enfocaCaja(); },
      alError: (motivo) => { ctx.error = motivo; }
    });
    if (!pararDictado) { avisa('Este navegador no deja dictar. Prueba con Chrome.'); return; }
    ctx.dictando = true;
    ctx.error = null;
    render();
  },
  escuchar: (el) => {
    const m = ctx.chat[Number(el.dataset.i)];
    if (m) Voz.lee(m.texto, Voz.idiomaDe(m.texto));
  },
  'escuchar-tarjeta': () => {
    const t = ctx.tarjetaActual;
    if (!t) return;
    Voz.lee(ctx.respuestaVisible ? `${t.pregunta}. ${t.respuesta}` : t.pregunta, t.idioma);
  },
  'aplicar-horario': () => {
    if (!ctx.horarioPropuesto) return;
    const r = D.aplicaHorario(estado, ctx.horarioPropuesto);
    estado = r.estado;
    ctx.horarioPropuesto = null;
    persiste();
    render();
    avisa(`Horario puesto: ${plural(r.clases, 'clase', 'clases')}.`
      + (r.creadas.length ? ` He añadido ${r.creadas.join(', ')} a tus asignaturas.` : '')
      + ' Desde mañana, la mochila ya sabe qué toca.');
  },
  'descartar-horario': () => {
    ctx.horarioPropuesto = null;
    ctx.borrador = 'El horario no está bien: ';
    render();
    enfocaCaja();
  },
  'calendario-examen': (el) => llevaAlCalendario(el.dataset.id),

  /* Libros */
  'nuevo-libro': async () => {
    const d = await pide({ titulo: 'Añadir un libro', html: UI.formLibro(estado) });
    if (!d || !d.titulo?.trim()) return;
    estado.libros.push({
      id: id('li'), titulo: d.titulo.trim().slice(0, 120),
      asignaturaId: d.asignatura || null, editorial: (d.editorial || '').trim().slice(0, 60)
    });
    persiste(); render();
  },
  'borrar-libro': async (el) => {
    if (!(await confirma('¿Borrar este libro? Sus lecciones se quedan, pero sin libro.'))) return;
    estado.libros = estado.libros.filter((l) => l.id !== el.dataset.id);
    estado = D.normaliza(estado);
    persiste(); render();
  },

  /* Lecciones */
  'filtro-asig': (el) => { ctx.filtroAsig = el.dataset.id || ''; render(); },
  'nueva-leccion': () => editaLeccion(null),
  'editar-leccion': (el) => editaLeccion(estado.lecciones.find((l) => l.id === el.dataset.id)),
  'abrir-leccion': (el) => {
    ctx.leccionAbierta = el.dataset.id;
    ctx.sub = 'lecciones';
    irA('estudiar'); // también desde «Hoy»
  },
  'cerrar-leccion': () => { ctx.leccionAbierta = null; Voz.calla(); render(); },
  'borrar-leccion': async (el) => {
    if (!(await confirma('¿Borrar esta lección y sus apuntes?'))) return;
    estado.lecciones = estado.lecciones.filter((l) => l.id !== el.dataset.id);
    estado = D.normaliza(estado); // la quita también de los exámenes
    delete ctx.fotosLeccion[el.dataset.id];
    ctx.leccionAbierta = null;
    persiste(); render();
  },
  'resumir-leccion': (el) => resumeLeccion(el.dataset.id),
  'escuchar-resumen': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    if (l?.resumen) Voz.lee(l.resumen, Voz.idiomaDe(l.resumen));
  },
  'tarjetas-leccion': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    if (!l) return;
    const idioma = Voz.idiomaDe(l.conceptos.map((c) => c.definicion).join(' '));
    // No se duplican: si ya hay una tarjeta con la misma pregunta, se salta.
    const existentes = new Set(estado.tarjetas.map((t) => t.pregunta));
    const nuevas = L.tarjetasDeLeccion(l, ctx.hoy, idioma).filter((t) => !existentes.has(t.pregunta));
    for (const t of nuevas) estado.tarjetas.push({ id: id('tj'), ...t });
    persiste();
    avisa(nuevas.length
      ? `${plural(nuevas.length, 'tarjeta añadida', 'tarjetas añadidas')} al repaso. Ya te tocan hoy.`
      : 'Las tarjetas de esta lección ya estaban en tu repaso.');
    render();
  },
  'esquema-leccion': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    const esquema = l && L.esquemaDeLeccion(l);
    if (!esquema) return;
    estado.esquemas.push({ id: id('es'), asignaturaId: l.asignaturaId, ...esquema, fecha: ctx.hoy });
    persiste();
    ctx.leccionAbierta = null;
    ctx.sub = 'esquemas';
    render();
    window.scrollTo({ top: 0 });
  },
  'examen-leccion': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    if (!l) return;
    preparaExamen({
      titulo: l.titulo,
      asignaturaId: l.asignaturaId,
      lecciones: [l],
      origen: { accion: 'examen-leccion', id: l.id }
    });
  },
  /* Material de estudio: explicación, infografía, ejemplos, ejercicios y
     mini test. Se prepara una vez y queda guardado en la lección. */
  'material-leccion': (el) => preparaMaterial(el.dataset.id),
  'minitest-leccion': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    const preguntas = L.minitestDeLeccion(l);
    if (!preguntas.length) return avisa('Esta lección aún no tiene mini test. Dale a «Preparar material».');
    empiezaTest(preguntas, `Mini test · ${l.titulo}`, { asignaturaId: l.asignaturaId, origen: { accion: 'minitest-leccion', id: l.id } });
  },
  'ficha-leccion': (el) => {
    const l = estado.lecciones.find((x) => x.id === el.dataset.id);
    if (!l?.material) return;
    eligeYDescargaFicha({
      titulo: l.titulo,
      subtitulo: [D.nombreAsignatura(estado, l.asignaturaId), estado.alumno.curso].filter(Boolean).join(' · '),
      partes: [{ titulo: l.titulo, material: l.material }]
    });
  },
  'ficha-examen': (el) => {
    const e = estado.examenes.find((x) => x.id === el.dataset.id);
    if (!e) return;
    const conMaterial = L.leccionesDeExamen(estado, e).filter((l) => l.material);
    if (!conMaterial.length) return avisa('Ninguna lección de este examen tiene material todavía. Ábrelas y dale a «Preparar material».');
    eligeYDescargaFicha({
      titulo: `Examen: ${e.titulo}`,
      subtitulo: [D.nombreAsignatura(estado, e.asignaturaId), `examen el ${e.fecha.split('-').reverse().join('/')}`].join(' · '),
      partes: conMaterial.map((l) => ({ titulo: l.titulo, material: l.material }))
    });
  },
  'minitest-dia': () => {
    const m = L.miniTestDelDia(estado, ctx.hoy);
    if (m.preguntas.length < L.MIN_MINITEST) return avisa('Para el mini test del día hace falta material en tus lecciones. Abre una y dale a «Preparar material».');
    empiezaTest(m.preguntas, m.titulo, { origen: { accion: 'minitest-dia', id: '' } });
  },
  'ficha-minitest-dia': () => {
    const m = L.miniTestDelDia(estado, ctx.hoy);
    if (!m.preguntas.length) return;
    eligeYDescargaFicha({
      titulo: m.titulo,
      subtitulo: m.lecciones.join(' · '),
      partes: [{ titulo: m.titulo, material: { minitest: m.preguntas } }],
      soloTest: true
    });
  },
  'examen-prueba': (el) => {
    const e = estado.examenes.find((x) => x.id === el.dataset.id);
    if (!e) return;
    preparaExamen({
      titulo: e.titulo,
      asignaturaId: e.asignaturaId,
      temas: e.temas,
      lecciones: L.leccionesDeExamen(estado, e),
      origen: { accion: 'examen-prueba', id: e.id }
    });
  }
};

/* ── Lecciones ──────────────────────────────────────────────────── */
async function editaLeccion(leccion) {
  const d = await pide({
    titulo: leccion ? 'Editar lección' : 'Nueva lección',
    html: UI.formLeccion(estado, leccion),
    aceptar: leccion ? 'Guardar' : 'Guardar y resumir'
  });
  if (!d) return;
  const fotos = (d.fotos || []).slice(0, L.MAX_FOTOS_LECCION);
  const texto = (d.texto || '').trim().slice(0, L.MAX_TEXTO_LECCION);
  if (!leccion && !texto && !fotos.length) {
    return avisa('Mete el texto de la lección o haz fotos a las páginas del libro.');
  }
  const datos = {
    titulo: (d.titulo || '').trim().slice(0, 120) || `Lección del ${ctx.hoy}`,
    asignaturaId: d.asignatura || null,
    libroId: d.libro || null,
    texto
  };
  let actual = leccion;
  if (actual) {
    Object.assign(actual, datos);
  } else {
    actual = { id: id('le'), ...datos, resumen: '', apuntes: [], conceptos: [], fecha: ctx.hoy, resumida: null };
    estado.lecciones.push(actual);
  }
  estado = D.normaliza(estado);
  persiste();
  ctx.sub = 'lecciones';
  ctx.leccionAbierta = actual.id;

  if (fotos.length) {
    // De una en una y enseñando por dónde va: en paralelo se comía la
    // memoria del móvil y la app se quedaba congelada.
    ctx.preparandoFotos = `0 de ${fotos.length}`;
    render();
    const r = await preparaFotos(fotos, {
      ajustes: ajustesPara(fotos.length),
      alProgreso: (hechas, total) => { ctx.preparandoFotos = `${Math.min(hechas + 1, total)} de ${total}`; render(); }
    });
    ctx.preparandoFotos = null;
    if (!r.fotos.length) {
      render();
      return avisa(`No he podido abrir las fotos: ${r.motivo}`);
    }
    ctx.fotosLeccion[actual.id] = r.fotos;
    if (r.fallidas) avisa(`${plural(r.fallidas, 'foto no se ha podido abrir', 'fotos no se han podido abrir')} (${r.motivo}). Sigo con las otras ${r.fotos.length}.`);
  }
  render();
  window.scrollTo({ top: 0 });
  // Una lección nueva se resume sola: es para lo que la ha metido.
  if (!leccion || fotos.length) resumeLeccion(actual.id);
}

async function resumeLeccion(idLeccion) {
  const l = estado.lecciones.find((x) => x.id === idLeccion);
  if (!l || ctx.resumiendo) return;
  const fotos = ctx.fotosLeccion[l.id] || [];
  if (!l.texto && !fotos.length) return;
  ctx.resumiendo = l.id;
  render();
  try {
    const datos = await llamaClara('leccion', {
      leccion: {
        titulo: l.titulo,
        asignatura: D.nombreAsignatura(estado, l.asignaturaId),
        libro: D.libro(estado, l.libroId)?.titulo || '',
        texto: l.texto
      },
      imagenes: fotos.map((f) => ({ media_type: f.media_type, data: f.data }))
    });
    const material = L.leccionDeIA(datos.leccion);
    if (!material) throw new Error(datos.reply || 'Clara no ha devuelto los apuntes.');
    const guardada = estado.lecciones.find((x) => x.id === idLeccion);
    if (guardada) {
      Object.assign(guardada, material, { resumida: ctx.hoy });
      delete ctx.fotosLeccion[idLeccion]; // ya cumplieron su función
      marcaActividad();
      persiste();
      celebra();
    }
  } catch (e) {
    avisa(`No he podido resumir la lección: ${e.message} Puedes volver a intentarlo desde la propia lección.`);
  } finally {
    ctx.resumiendo = null;
    render();
  }
}

/* Examen de prueba: Clara lo prepara con el contenido de las lecciones. Sin
   conexión, cae a un test con sus tarjetas de esa asignatura, que es mejor
   que nada y no depende de nadie. */
async function preparaExamen({ titulo, asignaturaId, temas = '', lecciones = [], origen }) {
  if (ctx.preparandoExamen) return;
  ctx.preparandoExamen = true;
  ctx.leccionAbierta = null;
  ctx.vista = 'estudiar';
  ctx.sub = 'test';
  ctx.test = { titulo, preguntas: [], respuestas: [], desarrollo: [], respuestasDes: [], i: 0, fase: 'corrigiendo', preparando: true };
  render();
  try {
    const datos = await llamaClara('examen', {
      examen: { titulo, asignatura: D.nombreAsignatura(estado, asignaturaId), temas },
      contenido: L.contenidoDeLecciones(lecciones)
    });
    const examen = L.examenDeIA(datos.examen, asignaturaId);
    if (!examen) throw new Error('Clara no ha devuelto el examen.');
    empiezaTest(examen.test, `Examen de prueba · ${titulo}`, { desarrollo: examen.desarrollo, origen, asignaturaId });
    if (!lecciones.length) avisa('Este examen está hecho con lo que se da en 2º de ESO de ese tema, no con tus apuntes. Mete las lecciones para que se parezca más al de verdad.');
  } catch (e) {
    const propias = estado.tarjetas.filter((t) => !asignaturaId || t.asignaturaId === asignaturaId);
    const preguntas = Q.generaDesdeTarjetas(propias.length >= Q.MIN_TARJETAS ? propias : estado.tarjetas, { cuantas: 8 });
    if (preguntas.length) {
      empiezaTest(preguntas, `Test de repaso · ${titulo}`, { origen });
      avisa(`Clara no ha podido preparar el examen (${e.message}). Te pongo un test con tus tarjetas mientras tanto.`);
    } else {
      ctx.test = null;
      render();
      avisa(`Clara no ha podido preparar el examen: ${e.message}`);
    }
  } finally {
    ctx.preparandoExamen = false;
  }
}

/* Las respuestas de desarrollo las corrige Clara con los criterios que ella
   misma puso. Si no hay conexión, se enseña qué debía incluir cada una. */
async function entregaExamen() {
  const t = ctx.test;
  if (!t || t.fase !== 'desarrollo') return;
  t.fase = 'corrigiendo';
  render();
  let correccion = null;
  try {
    const datos = await llamaClara('corregir', {
      preguntas: t.desarrollo.map((p, i) => ({ pregunta: p.pregunta, criterios: p.criterios, respuesta: t.respuestasDes[i] || '' }))
    });
    correccion = L.correccionDeIA(datos.correccion, t.desarrollo.length);
  } catch { /* se queda sin corrección: el resultado lo explica */ }
  terminaTest(correccion);
}

/* ── Material de estudio y fichas ───────────────────────────────── */

/** Clara prepara el material en dos mitades a la vez (teoría y práctica):
    así cada una tarda la mitad. Si una falla, se guarda la otra. */
async function preparaMaterial(idLeccion) {
  const l = estado.lecciones.find((x) => x.id === idLeccion);
  if (!l || ctx.preparandoMaterial) return;
  if (!l.resumen && !l.apuntes?.length && !l.texto) return avisa('Primero mete el texto o las fotos de la lección y deja que Clara la resuma.');
  ctx.preparandoMaterial = l.id;
  render();
  const base = {
    leccion: { titulo: l.titulo, asignatura: D.nombreAsignatura(estado, l.asignaturaId) },
    contenido: L.textoDeLeccion(l)
  };
  const [teoria, practica] = await Promise.allSettled([
    llamaClara('material', { ...base, parte: 'teoria' }, 85000),
    llamaClara('material', { ...base, parte: 'practica' }, 85000)
  ]);
  ctx.preparandoMaterial = null;
  const material = L.materialDeIA(
    teoria.status === 'fulfilled' ? teoria.value.material : null,
    practica.status === 'fulfilled' ? practica.value.material : null,
    ctx.hoy
  );
  const guardada = estado.lecciones.find((x) => x.id === idLeccion);
  if (material && guardada) {
    // Si solo llegó una mitad y ya había material, se conserva lo de la otra.
    guardada.material = L.normalizaMaterial({ ...(guardada.material || {}), ...Object.fromEntries(
      Object.entries(material).filter(([, v]) => (Array.isArray(v) ? v.length : v))) });
    marcaActividad();
    persiste();
    celebra();
  }
  render();
  const fallo = [teoria, practica].find((r) => r.status === 'rejected');
  if (!material) avisa(`Clara no ha podido preparar el material: ${fallo?.reason?.message || 'no ha devuelto nada'} Inténtalo otra vez.`);
  else if (fallo) avisa(`He preparado una parte del material, pero la otra ha fallado (${fallo.reason?.message || 'error'}). Dale otra vez a «Rehacer material» para completarlo.`);
}

/** Pregunta qué meter en la ficha y en qué formato, y la descarga. */
async function eligeYDescargaFicha({ titulo, subtitulo, partes, soloTest = false }) {
  const html = UI.formFicha(partes, { soloTest });
  const d = await pide({ titulo: 'Descargar ficha', html, aceptar: 'Descargar' });
  if (!d) return;
  const elegidas = new Set(d.incluir || []);
  const incluir = Object.fromEntries(F.SECCIONES.map((x) => [x.id, soloTest ? true : elegidas.has(x.id)]));
  if (soloTest) incluir.soluciones = elegidas.has('soluciones');
  const piezas = F.piezasDeFicha({
    titulo, subtitulo,
    fecha: ctx.hoy.split('-').reverse().join('/'),
    partes, incluir, hueco: (d.hueco || []).length > 0
  });
  if (piezas.length < 2) return avisa('Marca al menos una parte para la ficha.');
  try {
    const word = d.formato === 'docx';
    const bytes = word ? F.fichaDocx(piezas) : F.fichaPdf(piezas);
    const tipo = word ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
    descargaArchivo(new Blob([bytes], { type: tipo }), F.nombreArchivo(titulo, word ? 'docx' : 'pdf'));
    marcaActividad();
  } catch (e) {
    avisa(`No he podido crear la ficha: ${e.message}`);
  }
}

function descargaArchivo(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ── Llamada a Clara ────────────────────────────────────────────
   Una sola puerta para todo (chat, lección, examen y corrección):
   - tiempo máximo, para que la pantalla nunca se quede colgada;
   - un reintento automático si el fallo es pasajero (red que se corta,
     servidor saturado), que es lo que hacía que «se bloqueara cada poco»;
   - mensajes que un chaval entiende en vez de «Error 504». */
const REINTENTABLES = new Set([429, 500, 502, 503]);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function errorClara(mensaje, reintentar = false) {
  const e = new Error(mensaje);
  e.reintentar = reintentar;
  return e;
}

async function unaLlamada(cuerpo, espera) {
  const corte = new AbortController();
  const alarma = setTimeout(() => corte.abort(), espera);
  try {
    let res;
    try {
      res = await fetch('/api/profe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: corte.signal,
        body: cuerpo
      });
    } catch (e) {
      if (e.name === 'AbortError') throw errorClara('Ha tardado demasiado. Vuelve a probar (con menos fotos irá más rápido).');
      if (!navigator.onLine) throw errorClara('No hay conexión.');
      throw errorClara('Se ha cortado la conexión.', true);
    }
    const datos = await res.json().catch(() => ({}));
    if (res.ok) return datos;
    if (res.status === 413) throw errorClara('Las fotos pesan demasiado juntas. Quita alguna y vuelve a probar.');
    if (res.status === 504) throw errorClara('Clara ha tardado demasiado en leerlo todo. Prueba con menos fotos a la vez.');
    throw errorClara(datos.error || `Error ${res.status}.`, REINTENTABLES.has(res.status));
  } finally {
    clearTimeout(alarma);
  }
}

async function llamaClara(modo, cuerpo, espera = 85000) {
  const json = JSON.stringify({
    modo, ...cuerpo,
    curso: estado.alumno.curso,
    nombre: estado.alumno.nombre,
    asignaturas: estado.asignaturas.map((x) => x.nombre)
  });
  let ultimo;
  for (let intento = 0; intento < 2; intento++) {
    if (intento) await pausa(2500);
    try {
      return await unaLlamada(json, espera);
    } catch (e) {
      ultimo = e;
      if (!e.reintentar) break;
    }
  }
  throw ultimo;
}

function enfocaCaja() {
  const caja = $('#profe-texto');
  if (!caja) return;
  caja.focus();
  caja.setSelectionRange(caja.value.length, caja.value.length);
}

/* El .ics se comparte como archivo cuando el móvil sabe (así se abre directo
   en el calendario); si no, se descarga. */
async function llevaAlCalendario(idExamen) {
  const examen = estado.examenes.find((x) => x.id === idExamen);
  if (!examen) return;
  const ics = icsExamen({
    examen,
    plan: R.planExamen(examen, ctx.hoy),
    asignatura: D.nombreAsignatura(estado, examen.asignaturaId),
    sello: new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  });
  const nombre = `examen-${examen.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.ics`;
  const archivo = new File([ics], nombre, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: examen.titulo }); return; } catch { /* cancelado: se descarga */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  avisa('Descargado. Ábrelo y dale a «Añadir» en tu calendario: te avisará la tarde antes del examen y cada día del plan a las 17:00.');
}

/* ── Test ───────────────────────────────────────────────────────── */
function empiezaTest(preguntas, titulo, { desarrollo = [], origen = null, asignaturaId = null } = {}) {
  ctx.test = {
    titulo,
    preguntas,
    respuestas: preguntas.map(() => null),
    desarrollo,
    respuestasDes: desarrollo.map(() => ''),
    correccion: null,
    origen,
    asignaturaId,
    i: 0,
    // Un examen sin parte tipo test empieza directamente por el desarrollo.
    fase: preguntas.length ? 'test' : 'desarrollo',
    terminado: false,
    resultado: null
  };
  ctx.vista = 'estudiar';
  ctx.sub = 'test';
  render();
  window.scrollTo({ top: 0 });
}

/* Al terminar, lo fallado no se queda en un número: vuelve al repaso. Esa es
   la diferencia entre un test que entretiene y uno que sirve. */
function terminaTest(correccion = null) {
  const t = ctx.test;
  if (!t) return;
  const resultado = Q.corrige(t.preguntas, t.respuestas);
  if (t.desarrollo.length) {
    // Con desarrollo corregido, la nota es la del examen entero; si Clara no
    // pudo corregir, la nota es solo la del test (y la pantalla lo dice).
    if (correccion) resultado.nota = L.notaFinal(resultado, t.desarrollo, correccion.map((c) => c.nota));
    t.correccion = correccion;
    // Lo que se hizo mal en el desarrollo también vuelve al repaso.
    (correccion || []).forEach((c, i) => {
      if (c.nota < 5 && c.modelo) {
        estado.tarjetas.push({
          id: id('tj'),
          ...R.nuevaTarjeta({ pregunta: t.desarrollo[i].pregunta, respuesta: c.modelo, asignaturaId: t.asignaturaId, origen: 'ia' }, ctx.hoy)
        });
      }
    });
  }
  t.resultado = resultado;
  t.fase = 'terminado';
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
    asignaturaId: t.asignaturaId || t.preguntas[0]?.asignaturaId || null,
    titulo: t.titulo,
    aciertos: resultado.aciertos,
    total: resultado.total,
    nota: resultado.nota,
    fecha: ctx.hoy
  });

  ctx.hechasHoy += resultado.total + t.desarrollo.length;
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
  estado[grupo][campo] = el.type === 'number' || el.dataset.numero ? Number(el.value) : el.value;
  estado = D.normaliza(estado);
  persiste();
  render();
});

/* ── Modo concentración ─────────────────────────────────────────── */
const foco = {
  el: $('#foco'), reloj: $('#foco-reloj'), barra: $('#foco-barra'), que: $('#foco-que'),
  planta: $('#foco-planta'), aguante: $('#foco-aguante'), ambientes: $('#foco-ambientes'),
  total: 0, restan: 0, tic: null, pausado: false, descanso: false, salidas: 0,
  bloque: $('#foco-bloque'), plan: [], bloqueActual: -1, avisoHasta: 0
};

/* Los ambientes se eligen desde la propia pantalla de concentración: si hay
   que salir a Ajustes para cambiar la lluvia, no se cambia nunca. */
function pintaAmbientes() {
  foco.ambientes.innerHTML = AMBIENTES.map((a) => `<button class="chip${estado.ajustes.ambiente === a.id ? ' chip--activo' : ''}"
    data-accion="elegir-ambiente" data-id="${a.id}">${a.emoji}</button>`).join('');
}

function arrancaFoco(minutos, etiqueta, plan = []) {
  foco.plan = plan.map((b) => ({ ...b }));
  foco.bloqueActual = -1;
  foco.avisoHasta = 0;
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
  if (!foco.descanso && foco.plan.length) {
    const hecho = foco.total - foco.restan;
    const i = foco.plan.findIndex((b) => hecho < b.fin * 60);
    const indice = i === -1 ? foco.plan.length - 1 : i;
    if (indice !== foco.bloqueActual) {
      const esCambio = foco.bloqueActual !== -1;
      foco.bloqueActual = indice;
      pintaBloque(esCambio);
    } else {
      actualizaSiguiente();
    }
  } else {
    foco.bloque.hidden = true;
  }
}

/* El bloque en marcha: qué asignatura, por qué y qué hacer. Al cambiar de
   bloque suena, vibra y se ve un aviso grande unos segundos. */
function pintaBloque(esCambio) {
  const b = foco.plan[foco.bloqueActual];
  if (!b) return;
  const total = foco.plan.length;
  foco.que.textContent = `Bloque ${foco.bloqueActual + 1} de ${total}`;
  if (esCambio) {
    pitido();
    try { navigator.vibrate?.([250, 120, 250]); } catch { /* sin vibración */ }
    foco.avisoHasta = Date.now() + 8000;
  }
  const aviso = Date.now() < foco.avisoHasta;
  foco.bloque.hidden = false;
  foco.bloque.className = `bloque-foco${aviso ? ' cambio' : ''}`;
  foco.bloque.innerHTML = `
    ${aviso ? '<div class="cambio-titulo">🔁 ¡Cambio de asignatura!</div>' : ''}
    <div class="bloque-asig"><span class="punto" style="background:${escapa(D.colorAsignatura(estado, b.asignaturaId))}"></span> ${escapa(b.nombre)}</div>
    <div class="bloque-por">${escapa(b.motivo)}</div>
    <div class="bloque-que">👉 ${escapa(b.accion)}</div>
    <div class="bloque-pie"><span id="foco-siguiente"></span>
      <button class="mini fantasma" data-accion="cambiar-bloque">🔀 Otra asignatura</button></div>`;
  actualizaSiguiente();
  if (aviso) setTimeout(() => { if (Date.now() >= foco.avisoHasta && !foco.el.hidden) pintaBloque(false); }, 8100);
}

function actualizaSiguiente() {
  const el = $('#foco-siguiente');
  if (!el) return;
  const sig = foco.plan[foco.bloqueActual + 1];
  const hecho = foco.total - foco.restan;
  el.textContent = sig ? `Luego ${sig.nombre} en ${mmss(Math.max(0, foco.plan[foco.bloqueActual].fin * 60 - hecho))}` : 'Último bloque';
}

/** Guarda los minutos hechos (completos o no) y ofrece el descanso. */
function terminaFoco(completo) {
  const minutos = Math.round((foco.total - foco.restan) / 60);
  clearInterval(foco.tic);
  if (minutos >= 1 && foco.plan.length && !foco.descanso) {
    // Con bloques, cada asignatura se apunta sus minutos (sirve para ver a qué dedica el tiempo).
    const hecho = foco.total - foco.restan;
    foco.plan.forEach((b, k) => {
      const m = Math.round(Math.max(0, Math.min(hecho, b.fin * 60) - b.inicio * 60) / 60);
      if (m >= 1) estado.sesiones.push({ fecha: ctx.hoy, minutos: m, asignaturaId: b.asignaturaId, salidas: k === 0 ? foco.salidas : 0 });
    });
    marcaActividad();
    persiste();
  } else if (minutos >= 1) {
    estado.sesiones.push({ fecha: ctx.hoy, minutos, asignaturaId: null, salidas: foco.salidas });
    marcaActividad();
    persiste();
  }
  if (completo && estado.ajustes.descanso > 0) {
    foco.descanso = true;
    foco.total = estado.ajustes.descanso * 60;
    foco.restan = foco.total;
    foco.que.textContent = 'Descanso: levántate y bebe agua';
    foco.bloque.hidden = true;
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

/* ── Clara ──────────────────────────────────────────────────────── */
async function preguntaAlProfe() {
  const caja = $('#profe-texto');
  const fotos = ctx.fotosPendientes;
  const texto = ((caja?.value ?? ctx.borrador) || '').trim()
    || (fotos.length ? (fotos.length === 1 ? 'Mira esta foto.' : `Mira estas ${fotos.length} fotos.`) : '');
  if (!texto || ctx.pensando || ctx.preparandoFotos) return;

  pararDictado?.();
  Voz.calla();
  ctx.chat.push({
    rol: 'user', texto,
    foto: fotos.length > 0, fotos: fotos.length,
    miniaturas: fotos.map((f) => f.miniatura)
  });
  const automatico = /^Mira (esta foto|estas \d+ fotos)\.$/.test(texto);
  ctx.borrador = '';
  ctx.fotosPendientes = [];
  ctx.pensando = fotos.length ? 'foto' : true;
  ctx.error = null;
  ctx.propuestas = [];
  ctx.testPropuesto = [];
  ctx.esquemaPropuesto = null;
  ctx.horarioPropuesto = null;
  render();

  try {
    // Las fotos anteriores no se reenvían (gastan mucho): Clara ya las
    // describió en su respuesta, así que basta con decir que las hubo.
    const datos = await llamaClara('chat', {
      mensajes: D.historialParaClara(ctx.chat),
      imagenes: fotos.map((f) => ({ media_type: f.media_type, data: f.data }))
    }, fotos.length ? 85000 : 70000);
    ctx.chat.push({ rol: 'profe', texto: datos.reply || 'No he sabido responder a eso.', buscado: datos.busquedas > 0 });
    ctx.propuestas = Array.isArray(datos.tarjetas) ? datos.tarjetas.slice(0, 20) : [];
    const asigTest = datos.esquema?.asignatura ? D.buscaAsignatura(estado, datos.esquema.asignatura) : null;
    ctx.testPropuesto = Q.preguntasDeIA(datos.test, asigTest?.id || null);
    ctx.esquemaPropuesto = datos.esquema
      ? (() => {
          const validado = esquemaDeIA(datos.esquema);
          return validado ? { ...validado, asignatura: datos.esquema.asignatura || '' } : null;
        })()
      : null;
    ctx.horarioPropuesto = datos.horario?.dias ? datos.horario : null;
  } catch (e) {
    ctx.error = navigator.onLine
      ? `Clara no ha podido responder: ${e.message}`
      : 'Sin conexión. Clara necesita internet; el resto de la app funciona igual.';
    // Si falla, las fotos y el texto no se pierden: vuelven a la caja.
    ctx.chat.pop();
    ctx.borrador = automatico ? '' : texto;
    ctx.fotosPendientes = fotos;
  } finally {
    ctx.pensando = false;
    D.guardarChat(ctx.chat);
    render();
  }
}

document.addEventListener('input', (ev) => {
  if (ev.target?.id === 'profe-texto') ctx.borrador = ev.target.value;
  if (ev.target?.classList?.contains('respuesta-desarrollo') && ctx.test) {
    ctx.test.respuestasDes[Number(ev.target.dataset.i)] = ev.target.value;
  }
});

/* Fotos para Clara: se pueden elegir varias de golpe (galería) o ir
   añadiendo de una en una (cámara), hasta 6. Se reducen en el móvil de una
   en una y la pantalla dice por dónde va. */
document.addEventListener('change', async (ev) => {
  if (ev.target?.id !== 'foto-input') return;
  const hueco = MAX_FOTOS - ctx.fotosPendientes.length;
  const archivos = Array.from(ev.target.files || []);
  ev.target.value = ''; // para poder elegir la misma foto otra vez
  if (!archivos.length || ctx.preparandoFotos) return;
  const elegidas = archivos.slice(0, Math.max(0, hueco));
  ctx.error = null;
  ctx.preparandoFotos = `1 de ${elegidas.length}`;
  render();
  const r = await preparaFotos(elegidas, {
    ajustes: AJUSTES_CHAT,
    alProgreso: (hechas, total) => {
      if (hechas >= total) return;
      ctx.preparandoFotos = `${hechas + 1} de ${total}`;
      const marca = $('#preparando-fotos');
      if (marca) marca.textContent = `Preparando foto ${ctx.preparandoFotos}…`;
    }
  });
  ctx.preparandoFotos = null;
  ctx.fotosPendientes = [...ctx.fotosPendientes, ...r.fotos].slice(0, MAX_FOTOS);
  const avisos = [];
  if (archivos.length > elegidas.length) avisos.push(`Solo caben ${MAX_FOTOS} fotos por mensaje; he cogido las ${elegidas.length} primeras.`);
  if (r.fallidas) avisos.push(`${r.fallidas === 1 ? 'Una foto no se ha podido abrir' : `${r.fallidas} fotos no se han podido abrir`}: ${r.motivo}`);
  ctx.error = avisos.join(' ') || null;
  render();
  enfocaCaja();
});

/* Fotos de las páginas de una lección (en el diálogo): cada vez que elige,
   se SUMAN a las que ya había en vez de sustituirlas. Así puede hacerlas
   con la cámara de una en una. */
document.addEventListener('change', (ev) => {
  const campo = ev.target;
  if (campo?.id !== 'f-fotos') return;
  const max = L.MAX_FOTOS_LECCION;
  const antes = campo._fotos || [];
  const nuevas = Array.from(campo.files || []);
  campo._fotos = [...antes, ...nuevas].slice(0, max);
  campo.value = '';
  pintaFotosLeccion(campo, antes.length + nuevas.length > max);
});

function pintaFotosLeccion(campo, sobran = false) {
  const lista = $('#f-fotos-lista');
  if (!lista) return;
  const fotos = campo._fotos || [];
  lista.innerHTML = fotos.length
    ? `<div class="chips">${fotos.map((_, i) => `<span class="chip chip-foto">📄 Página ${i + 1}
        <button type="button" class="borrar-foto" data-quita-pagina="${i}" aria-label="Quitar la página ${i + 1}">✕</button></span>`).join('')}</div>
       <p class="nota-fotos">${fotos.length} de ${L.MAX_FOTOS_LECCION}${fotos.length < L.MAX_FOTOS_LECCION ? ' · puedes añadir más (también de una en una con la cámara)' : ''}${sobran ? ` · solo caben ${L.MAX_FOTOS_LECCION}, he cogido las primeras` : ''}</p>`
    : '';
  const lleno = fotos.length >= L.MAX_FOTOS_LECCION;
  campo.disabled = lleno;
  const etiqueta = $('#f-fotos-boton');
  if (etiqueta) {
    etiqueta.textContent = lleno ? `✅ ${L.MAX_FOTOS_LECCION} páginas listas` : fotos.length ? '➕ Añadir más páginas' : '📷 Hacer o elegir fotos';
    etiqueta.classList.toggle('lleno', lleno);
  }
}

document.addEventListener('click', (ev) => {
  const boton = ev.target?.closest?.('[data-quita-pagina]');
  if (!boton) return;
  ev.preventDefault();
  const campo = $('#f-fotos');
  if (!campo?._fotos) return;
  const i = Number(boton.dataset.quitaPagina);
  campo._fotos = campo._fotos.filter((_, j) => j !== i);
  pintaFotosLeccion(campo);
});

/* Atajos en el PC: la lógica vive en repaso.js (atajoTeclado). */
document.addEventListener('keydown', (ev) => {
  if (dlg.open || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.target?.closest?.('input, textarea, select')) return;
  const orden = R.atajoTeclado(ev.key, {
    vista: ctx.vista, sub: ctx.sub, tarjeta: ctx.tarjetaActual,
    respuestaVisible: ctx.respuestaVisible, test: ctx.test
  });
  if (!orden) return;
  ev.preventDefault();
  const [accion, valor] = orden.split(':');
  acciones[accion]?.({ dataset: { i: valor } });
});

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

/* Sin esto, Chrome y Safari pueden borrar los datos de una web si el móvil
   anda justo de espacio. Con él, solo se borran si él lo decide. */
if (navigator.storage?.persist) {
  navigator.storage.persisted?.().then((ya) => { if (!ya) navigator.storage.persist().catch(() => {}); }).catch(() => {});
}

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
