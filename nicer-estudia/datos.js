/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — datos
   Todo vive en el dispositivo (localStorage). No hay cuenta, no hay
   servidor y no sale ni un dato del móvil: es la agenda de un menor.
   Este módulo guarda, valida y consulta; no pinta nada.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, sumaDias, diasEntre, diaSemana, id, esISO, limita, horaAMinutos, normalizaTexto } from './utiles.js';

export const CLAVE = 'nicer-estudia:v1';
export const VERSION_DATOS = 1;

/* Asignaturas de arranque para 1º-2º de ESO. Es una lista EDITABLE de
   partida, no el horario oficial del Colegio Lastra: en cuanto Nicer tenga
   el suyo, se cambia en Ajustes. */
export const ASIGNATURAS_ESO = [
  { nombre: 'Matemáticas', color: '#1a6a90' },
  { nombre: 'Lengua Castellana', color: '#b4472c' },
  { nombre: 'Inglés', color: '#5b3fa8' },
  { nombre: 'Geografía e Historia', color: '#8a6a1f' },
  { nombre: 'Biología y Geología', color: '#2f7d4f' },
  { nombre: 'Física y Química', color: '#0f6f7a' },
  { nombre: 'Tecnología y Digitalización', color: '#4a5568' },
  { nombre: 'Educación Física', color: '#c2410c' },
  { nombre: 'Educación Plástica y Visual', color: '#a03060' },
  { nombre: 'Música', color: '#6d4c9f' },
  { nombre: 'Tutoría', color: '#57606a' }
];

export const TIPOS_TAREA = ['deber', 'trabajo', 'leer', 'estudiar'];

export function estadoInicial() {
  return {
    version: VERSION_DATOS,
    alumno: { nombre: 'Nicer', curso: '1º ESO', centro: 'Colegio Lastra · Mieres' },
    ajustes: {
      pomodoro: 25,          // minutos de concentración
      descanso: 5,
      objetivoDiario: 45,    // minutos de estudio al día
      tarjetasPorDia: 20,    // tope de repaso diario, para que nunca agobie
      profeIA: true,
      sonido: true
    },
    asignaturas: [],
    horario: {},             // { '1'..'7': [{ id, asignaturaId, hora }] }
    tareas: [],
    examenes: [],
    tarjetas: [],
    sesiones: [],            // { fecha, minutos, asignaturaId }
    notas: [],               // { id, asignaturaId, titulo, valor, fecha }
    racha: { dias: 0, mejor: 0, ultimoDia: null },
    creado: aISO()
  };
}

/* ── Validación ─────────────────────────────────────────────────────
   Los datos vienen de localStorage o de un fichero de copia que puede
   estar viejo o tocado a mano. Se normaliza todo antes de usarlo: si un
   campo no cuadra, se corrige en vez de romper la app. */
export function normaliza(bruto) {
  const base = estadoInicial();
  if (!bruto || typeof bruto !== 'object') return base;

  const alumno = { ...base.alumno, ...(bruto.alumno || {}) };
  const ajustes = {
    pomodoro: limita(bruto.ajustes?.pomodoro ?? base.ajustes.pomodoro, 5, 60),
    descanso: limita(bruto.ajustes?.descanso ?? base.ajustes.descanso, 1, 30),
    objetivoDiario: limita(bruto.ajustes?.objetivoDiario ?? base.ajustes.objetivoDiario, 10, 240),
    tarjetasPorDia: limita(bruto.ajustes?.tarjetasPorDia ?? base.ajustes.tarjetasPorDia, 5, 100),
    profeIA: bruto.ajustes?.profeIA !== false,
    sonido: bruto.ajustes?.sonido !== false
  };

  const asignaturas = lista(bruto.asignaturas).map((a) => ({
    id: a.id || id('as'),
    nombre: String(a.nombre || 'Sin nombre').slice(0, 60),
    color: /^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : '#57606a',
    profe: String(a.profe || '').slice(0, 60)
  }));
  const validas = new Set(asignaturas.map((a) => a.id));
  const deAsignatura = (v) => (validas.has(v) ? v : null);

  const horario = {};
  for (let d = 1; d <= 7; d++) {
    horario[d] = lista(bruto.horario?.[d]).map((c) => ({
      id: c.id || id('cl'),
      asignaturaId: deAsignatura(c.asignaturaId),
      hora: horaAMinutos(c.hora) === null ? '' : c.hora
    })).filter((c) => c.asignaturaId)
      .sort((a, b) => (horaAMinutos(a.hora) ?? 9999) - (horaAMinutos(b.hora) ?? 9999));
  }

  const tareas = lista(bruto.tareas).map((t) => ({
    id: t.id || id('ta'),
    asignaturaId: deAsignatura(t.asignaturaId),
    titulo: String(t.titulo || '').slice(0, 200),
    tipo: TIPOS_TAREA.includes(t.tipo) ? t.tipo : 'deber',
    para: esISO(t.para) ? t.para : aISO(),
    hecha: Boolean(t.hecha),
    hechaEl: esISO(t.hechaEl) ? t.hechaEl : null,
    creada: esISO(t.creada) ? t.creada : aISO()
  })).filter((t) => t.titulo);

  const examenes = lista(bruto.examenes).map((e) => ({
    id: e.id || id('ex'),
    asignaturaId: deAsignatura(e.asignaturaId),
    titulo: String(e.titulo || 'Examen').slice(0, 120),
    fecha: esISO(e.fecha) ? e.fecha : aISO(),
    temas: String(e.temas || '').slice(0, 500),
    nota: e.nota === null || e.nota === undefined || e.nota === '' ? null : limita(e.nota, 0, 10)
  }));

  const tarjetas = lista(bruto.tarjetas).map((c) => ({
    id: c.id || id('tj'),
    asignaturaId: deAsignatura(c.asignaturaId),
    pregunta: String(c.pregunta || '').slice(0, 400),
    respuesta: String(c.respuesta || '').slice(0, 800),
    caja: limita(c.caja ?? 0, 0, 6),
    proximo: esISO(c.proximo) ? c.proximo : aISO(),
    aciertos: Math.max(0, Number(c.aciertos) || 0),
    fallos: Math.max(0, Number(c.fallos) || 0),
    origen: c.origen === 'ia' ? 'ia' : 'mano',
    creada: esISO(c.creada) ? c.creada : aISO()
  })).filter((c) => c.pregunta && c.respuesta);

  const sesiones = lista(bruto.sesiones)
    .filter((s) => esISO(s.fecha))
    .map((s) => ({
      fecha: s.fecha,
      minutos: limita(s.minutos, 0, 600),
      asignaturaId: deAsignatura(s.asignaturaId)
    }));

  const notas = lista(bruto.notas).map((n) => ({
    id: n.id || id('nt'),
    asignaturaId: deAsignatura(n.asignaturaId),
    titulo: String(n.titulo || 'Nota').slice(0, 120),
    valor: limita(n.valor, 0, 10),
    fecha: esISO(n.fecha) ? n.fecha : aISO()
  })).filter((n) => n.asignaturaId);

  const racha = {
    dias: Math.max(0, Number(bruto.racha?.dias) || 0),
    mejor: Math.max(0, Number(bruto.racha?.mejor) || 0),
    ultimoDia: esISO(bruto.racha?.ultimoDia) ? bruto.racha.ultimoDia : null
  };
  racha.mejor = Math.max(racha.mejor, racha.dias);

  return {
    version: VERSION_DATOS,
    alumno, ajustes, asignaturas, horario, tareas, examenes, tarjetas,
    sesiones, notas, racha,
    creado: esISO(bruto.creado) ? bruto.creado : base.creado
  };
}

const lista = (v) => (Array.isArray(v) ? v : []);

/* ── Almacenamiento ─────────────────────────────────────────────────
   Todo acceso va envuelto: en modo incógnito de iOS localStorage lanza
   excepción al escribir, y la app tiene que seguir funcionando en memoria. */
function almacen() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch { return null; }
}

export function cargar() {
  const a = almacen();
  if (!a) return estadoInicial();
  try {
    const crudo = a.getItem(CLAVE);
    if (!crudo) return estadoInicial();
    return normaliza(JSON.parse(crudo));
  } catch {
    return estadoInicial();
  }
}

export function guardar(estado) {
  const a = almacen();
  if (!a) return false;
  try {
    a.setItem(CLAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false; // cuota llena o almacenamiento bloqueado
  }
}

export const exportar = (estado) => JSON.stringify(estado, null, 2);

/** Importa una copia de seguridad. Devuelve `{ ok, estado, error }`. */
export function importar(texto) {
  try {
    const datos = JSON.parse(texto);
    if (!datos || typeof datos !== 'object') throw new Error('El archivo no contiene datos de la app.');
    return { ok: true, estado: normaliza(datos) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ── Consultas derivadas ────────────────────────────────────────────
   Funciones puras: reciben el estado y devuelven lo que la pantalla
   necesita. Aquí no se modifica nada. */

export const asignatura = (estado, asignaturaId) =>
  estado.asignaturas.find((a) => a.id === asignaturaId) || null;

export const nombreAsignatura = (estado, asignaturaId) =>
  asignatura(estado, asignaturaId)?.nombre || 'General';

export const colorAsignatura = (estado, asignaturaId) =>
  asignatura(estado, asignaturaId)?.color || '#57606a';

/** Tareas pendientes ordenadas por urgencia (lo atrasado primero). */
export function pendientes(estado, hoy = aISO()) {
  return estado.tareas
    .filter((t) => !t.hecha)
    .sort((a, b) => a.para.localeCompare(b.para) || a.creada.localeCompare(b.creada))
    .map((t) => ({ ...t, dias: diasEntre(hoy, t.para) }));
}

/** Lo de hoy: lo que vence hoy y todo lo que se quedó atrás. */
export const paraHoy = (estado, hoy = aISO()) =>
  pendientes(estado, hoy).filter((t) => t.dias <= 0);

export const atrasadas = (estado, hoy = aISO()) =>
  pendientes(estado, hoy).filter((t) => t.dias < 0);

export function examenesProximos(estado, hoy = aISO(), dias = 21) {
  return estado.examenes
    .filter((e) => diasEntre(hoy, e.fecha) >= 0 && diasEntre(hoy, e.fecha) <= dias)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((e) => ({ ...e, dias: diasEntre(hoy, e.fecha) }));
}

export const clasesDe = (estado, iso) => estado.horario?.[diaSemana(iso)] || [];

/** La mochila de mañana: asignaturas del día siguiente lectivo + lo que hay
    que entregar ese día. Es el olvido más caro y el más fácil de evitar. */
export function mochila(estado, hoy = aISO()) {
  const manana = sumaDias(hoy, 1);
  let dia = manana;
  for (let i = 0; i < 4 && clasesDe(estado, dia).length === 0; i++) dia = sumaDias(dia, 1);
  // Si no hay horario puesto todavía, no inventamos un día raro: es mañana.
  if (clasesDe(estado, dia).length === 0) dia = manana;
  const clases = clasesDe(estado, dia);
  const entregas = estado.tareas.filter((t) => !t.hecha && t.para === dia);
  const examenes = estado.examenes.filter((e) => e.fecha === dia);
  return { dia, clases, entregas, examenes };
}

export const minutosDelDia = (estado, iso) =>
  estado.sesiones.filter((s) => s.fecha === iso).reduce((t, s) => t + s.minutos, 0);

export function minutosPorDia(estado, hasta = aISO(), dias = 7) {
  const salida = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = sumaDias(hasta, -i);
    salida.push({ fecha, minutos: minutosDelDia(estado, fecha) });
  }
  return salida;
}

/** Media por asignatura y media general (solo con notas puestas). */
export function medias(estado) {
  const porAsignatura = estado.asignaturas.map((a) => {
    const suyas = estado.notas.filter((n) => n.asignaturaId === a.id);
    const media = suyas.length
      ? suyas.reduce((t, n) => t + n.valor, 0) / suyas.length
      : null;
    return { asignatura: a, cuantas: suyas.length, media };
  });
  const conNota = porAsignatura.filter((p) => p.media !== null);
  const general = conNota.length
    ? conNota.reduce((t, p) => t + p.media, 0) / conNota.length
    : null;
  return { porAsignatura, general };
}

/** Busca una asignatura por nombre aproximado (lo usa el Profe IA al crear
    tarjetas: dice "Biología" y hay que dar con "Biología y Geología"). */
export function buscaAsignatura(estado, texto) {
  const objetivo = normalizaTexto(texto);
  if (!objetivo) return null;
  return estado.asignaturas.find((a) => normalizaTexto(a.nombre) === objetivo)
    || estado.asignaturas.find((a) => normalizaTexto(a.nombre).startsWith(objetivo.slice(0, 4)))
    || estado.asignaturas.find((a) => normalizaTexto(a.nombre).includes(objetivo))
    || null;
}
