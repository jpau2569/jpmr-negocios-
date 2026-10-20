/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — modelo de datos, validación y guardado
   Fase 1: todo vive en ESTE aparato (localStorage del navegador). No hay
   servidor ni cuenta: nada sale del móvil salvo la copia que Pau guarda
   o lo que él decide compartir. Por eso no se sincroniza con otros
   aparatos (eso llega en la fase 2 con Supabase; ver README.md).
   El estado se valida al cargar: una copia rota, antigua o manipulada
   nunca rompe una pantalla ni cuela HTML.
   Borrar = mandar a la papelera (campo `borrado`); se vacía a los 30 días
   o a mano, siempre con confirmación.
   ═══════════════════════════════════════════════════════════════════ */

import { aISO, esEmail, esHora, esISO, minutos, normaliza as norm, nuevoId, numeroES, sumaDias, sumaMeses, urlSegura } from './utiles.js';

export const CLAVE = 'olvido_pau_agenda_v1';
export const VERSION_DATOS = 1;
export const DIAS_PAPELERA = 30;

export const COLECCIONES = ['clientes', 'inmuebles', 'eventos', 'tareas', 'notas', 'recursos'];

/* ───────────── catálogos (lo que se ve en los desplegables) ───────────── */

export const TIPOS_CLIENTE = ['comprador', 'vendedor', 'propietario', 'inquilino', 'colaborador', 'otro'];
export const ESTADOS_CLIENTE = ['contacto', 'nuevo', 'contactado', 'seguimiento', 'visita', 'negociacion', 'cerrado', 'archivado'];
export const NOMBRE_ESTADO_CLIENTE = {
  contacto: 'Solo contacto',
  nuevo: 'Nuevo', contactado: 'Contactado', seguimiento: 'Seguimiento', visita: 'Visita',
  negociacion: 'Negociación', cerrado: 'Cerrado', archivado: 'Archivado',
};
export const TIPOS_INTERACCION = { llamada: 'Llamada', whatsapp: 'WhatsApp', email: 'Correo', visita: 'Visita', reunion: 'Reunión', nota: 'Nota' };

export const TIPOS_EVENTO = {
  personal: { nombre: 'Personal', color: '#8b5cf6' },
  reunion: { nombre: 'Reunión', color: '#2f6bff' },
  llamada: { nombre: 'Llamada', color: '#0ea5e9' },
  visita: { nombre: 'Visita a inmueble', color: '#14b8a6' },
  firma: { nombre: 'Firma', color: '#e11d48' },
  seguimiento: { nombre: 'Seguimiento', color: '#f59e0b' },
  recordatorio: { nombre: 'Recordatorio', color: '#64748b' },
};
export const ESTADOS_VISITA = { pendiente: 'Pendiente', realizada: 'Realizada', cancelada: 'Cancelada' };
export const RECORDATORIOS = { 0: 'A la hora', 10: '10 min antes', 30: '30 min antes', 60: '1 hora antes', 1440: '1 día antes' };

export const TIPOS_INMUEBLE = ['piso', 'casa', 'chalet', 'ático', 'dúplex', 'estudio', 'local', 'oficina', 'nave', 'garaje', 'trastero', 'terreno', 'otro'];
export const OPERACIONES = ['venta', 'alquiler'];
export const ESTADOS_INMUEBLE = { captacion: 'En captación', disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido', alquilado: 'Alquilado', retirado: 'Retirado' };
export const CARACTERISTICAS = ['ascensor', 'garaje', 'trastero', 'terraza', 'balcón', 'jardín', 'piscina', 'calefacción', 'aire acondicionado', 'amueblado', 'exterior', 'reformado', 'para reformar'];
/** Lo que NUNCA sale en la ficha para compartir. */
export const CAMPOS_PRIVADOS_INMUEBLE = ['direccion', 'propietario', 'notasInternas', 'proximaAccion'];

export const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const ESTADOS_TAREA = { pendiente: 'Pendiente', curso: 'En curso', hecha: 'Hecha' };
export const REPETICIONES = { '': 'No se repite', diaria: 'Cada día', semanal: 'Cada semana', mensual: 'Cada mes' };

export const TIPOS_RECURSO = { web: 'Página web', video: 'Vídeo', documento: 'Documento', idea: 'Idea', formacion: 'Formación', ia: 'Herramienta de IA', trabajo: 'Recurso de trabajo', otro: 'Otro' };
export const ESTADOS_RECURSO = { pendiente: 'Pendiente', revisado: 'Revisado', archivado: 'Archivado' };

export const BLOQUES_PANEL = {
  proxima: 'Próxima cita',
  agenda: 'Agenda de hoy',
  prioridades: 'Tres prioridades',
  tareas: 'Tareas pendientes y vencidas',
  seguimientos: 'Clientes que necesitan seguimiento',
  visitas: 'Visitas próximas',
  notas: 'Notas recientes',
  recursos: 'Recursos recientes',
};

export const AJUSTES_BASE = {
  nombre: 'Pau',
  // Va en la firma de los mensajes que prepara la app (WhatsApp, confirmaciones).
  whatsapp: '672 77 57 21',
  tema: 'oscuro', // auto · claro · oscuro (el diseño futurista luce en oscuro)
  bloques: Object.keys(BLOQUES_PANEL).map((id) => ({ id, visible: true })),
  prioridades: ['', '', ''],
  prioridadesFecha: '',
  avisosNavegador: false,
  diasSinSeguimiento: 7,
  ultimaCopia: '',
};

export function estadoVacio() {
  const e = { version: VERSION_DATOS, ajustes: structuredClone(AJUSTES_BASE) };
  for (const c of COLECCIONES) e[c] = [];
  return e;
}

/* ───────────── limpieza: cada campo con su forma y su tope ───────────── */

const txt = (x, n = 200) => (typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, n) : '');
const uno = (x, lista, porDefecto) => (lista.includes(x) ? x : porDefecto);
const bool = (x) => x === true;
const fecha = (x) => (esISO(x) ? x : '');
const hora = (x) => (esHora(x) ? x : '');
const sello = (x) => (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(String(x || '')) ? String(x).slice(0, 30) : '');
const num = (x, max = 1e9) => {
  const v = numeroES(x);
  return v !== null && v >= 0 && v <= max ? v : null;
};
const id = (x) => (typeof x === 'string' && /^[\w-]{1,80}$/.test(x) ? x : '');
const ids = (x) => [...new Set((Array.isArray(x) ? x : []).map(id).filter(Boolean))].slice(0, 200);
export const etiquetas = (x) => {
  const lista = Array.isArray(x) ? x : String(x ?? '').split(',');
  return [...new Set(lista.map((t) => txt(t, 40).trim().replace(/^#/, '')).filter(Boolean))].slice(0, 20);
};
const enlaces = (x) => (Array.isArray(x) ? x : [])
  .map((e) => (typeof e === 'string' ? { url: e, titulo: '' } : e))
  .filter((e) => e && typeof e === 'object')
  .map((e) => ({ url: urlSegura(e.url), titulo: txt(e.titulo, 120) }))
  .filter((e) => e.url).slice(0, 30);

function base(r) {
  const ahora = new Date().toISOString();
  return {
    id: id(r.id) || nuevoId(),
    creado: sello(r.creado) || ahora,
    actualizado: sello(r.actualizado) || sello(r.creado) || ahora,
    borrado: sello(r.borrado),
    demo: bool(r.demo),
  };
}

export const LIMPIA = {
  clientes: (r) => ({
    ...base(r),
    nombre: txt(r.nombre, 80).trim(),
    apellidos: txt(r.apellidos, 120).trim(),
    telefono: txt(r.telefono, 30).trim(),
    email: txt(r.email, 120).trim(),
    tipo: uno(r.tipo, TIPOS_CLIENTE, 'comprador'),
    estado: uno(r.estado, ESTADOS_CLIENTE, 'nuevo'),
    // «Solo contacto»: viene de la agenda del móvil y aún no es un cliente en seguimiento.
    procedencia: txt(r.procedencia, 80),
    preferencias: txt(r.preferencias, 2000),
    presupuestoMin: num(r.presupuestoMin),
    presupuestoMax: num(r.presupuestoMax),
    zonas: txt(r.zonas, 200),
    etiquetas: etiquetas(r.etiquetas),
    inmuebles: ids(r.inmuebles),
    proximaAccion: txt(r.proximaAccion, 200),
    siguienteSeguimiento: fecha(r.siguienteSeguimiento),
    notas: txt(r.notas, 4000),
    historial: (Array.isArray(r.historial) ? r.historial : []).filter((h) => h && typeof h === 'object').map((h) => ({
      id: id(h.id) || nuevoId('h'),
      fecha: fecha(h.fecha) || aISO(),
      hora: hora(h.hora),
      tipo: uno(h.tipo, Object.keys(TIPOS_INTERACCION), 'nota'),
      texto: txt(h.texto, 1000),
    })).slice(0, 500),
  }),
  inmuebles: (r) => ({
    ...base(r),
    referencia: txt(r.referencia, 40).trim(),
    titulo: txt(r.titulo, 120).trim(),
    tipo: uno(r.tipo, TIPOS_INMUEBLE, 'piso'),
    operacion: uno(r.operacion, OPERACIONES, 'venta'),
    estadoComercial: uno(r.estadoComercial, Object.keys(ESTADOS_INMUEBLE), 'disponible'),
    precio: num(r.precio),
    direccion: txt(r.direccion, 200),
    zona: txt(r.zona, 80),
    superficie: num(r.superficie, 100000),
    habitaciones: num(r.habitaciones, 50),
    banos: num(r.banos, 50),
    caracteristicas: (Array.isArray(r.caracteristicas) ? r.caracteristicas : []).filter((c) => CARACTERISTICAS.includes(c)),
    descripcion: txt(r.descripcion, 4000),
    propietario: id(r.propietario),
    enlaces: enlaces(r.enlaces),
    videos: enlaces(r.videos),
    notasInternas: txt(r.notasInternas, 4000),
    proximaAccion: txt(r.proximaAccion, 200),
  }),
  eventos: (r) => {
    const e = {
      ...base(r),
      titulo: txt(r.titulo, 140).trim(),
      tipo: uno(r.tipo, Object.keys(TIPOS_EVENTO), 'reunion'),
      fecha: fecha(r.fecha) || aISO(),
      fechaFin: fecha(r.fechaFin),
      todoElDia: bool(r.todoElDia),
      inicio: hora(r.inicio),
      fin: hora(r.fin),
      ubicacion: txt(r.ubicacion, 200),
      descripcion: txt(r.descripcion, 4000),
      cliente: id(r.cliente),
      inmueble: id(r.inmueble),
      enlaces: enlaces(r.enlaces),
      color: /^#[0-9a-f]{6}$/i.test(String(r.color || '')) ? r.color : '',
      recordatorios: [...new Set((Array.isArray(r.recordatorios) ? r.recordatorios : []).map(Number).filter((n) => String(n) in RECORDATORIOS))],
      estadoVisita: uno(r.estadoVisita, Object.keys(ESTADOS_VISITA), 'pendiente'),
      // Fase 2: identificador del evento en Google Calendar (evita duplicados).
      googleId: txt(r.googleId, 200),
    };
    if (e.todoElDia) { e.inicio = ''; e.fin = ''; }
    if (e.fechaFin && e.fechaFin < e.fecha) e.fechaFin = '';
    return e;
  },
  tareas: (r) => ({
    ...base(r),
    titulo: txt(r.titulo, 160).trim(),
    descripcion: txt(r.descripcion, 4000),
    prioridad: uno(r.prioridad, Object.keys(PRIORIDADES), 'media'),
    fecha: fecha(r.fecha),
    hora: hora(r.hora),
    estado: uno(r.estado, Object.keys(ESTADOS_TAREA), 'pendiente'),
    completada: sello(r.completada),
    subtareas: (Array.isArray(r.subtareas) ? r.subtareas : []).filter((s) => s && typeof s === 'object').map((s) => ({
      id: id(s.id) || nuevoId('s'), texto: txt(s.texto, 200), hecha: bool(s.hecha),
    })).filter((s) => s.texto.trim()).slice(0, 50),
    etiquetas: etiquetas(r.etiquetas),
    repeticion: uno(r.repeticion, Object.keys(REPETICIONES), ''),
    // Día del mes original de una tarea mensual (el 31 vuelve a ser 31 tras febrero).
    diaMes: Number.isInteger(Number(r.diaMes)) && r.diaMes >= 1 && r.diaMes <= 31 ? Number(r.diaMes) : 0,
    cliente: id(r.cliente),
    inmueble: id(r.inmueble),
    enlaces: enlaces(r.enlaces),
  }),
  notas: (r) => ({
    ...base(r),
    titulo: txt(r.titulo, 140),
    texto: txt(r.texto, 20000),
    etiquetas: etiquetas(r.etiquetas),
    fijada: bool(r.fijada),
    cliente: id(r.cliente),
    inmueble: id(r.inmueble),
  }),
  recursos: (r) => ({
    ...base(r),
    titulo: txt(r.titulo, 160).trim(),
    url: urlSegura(r.url),
    tipo: uno(r.tipo, Object.keys(TIPOS_RECURSO), 'web'),
    descripcion: txt(r.descripcion, 2000),
    etiquetas: etiquetas(r.etiquetas),
    coleccion: txt(r.coleccion, 60).trim(),
    favorito: bool(r.favorito),
    estado: uno(r.estado, Object.keys(ESTADOS_RECURSO), 'pendiente'),
    cliente: id(r.cliente),
    inmueble: id(r.inmueble),
    tarea: id(r.tarea),
    evento: id(r.evento),
  }),
};

/** Acepta cualquier cosa y devuelve un estado válido (lo que no encaja se descarta). */
export function normalizaEstado(bruto) {
  const e = estadoVacio();
  if (!bruto || typeof bruto !== 'object') return e;
  const aj = bruto.ajustes && typeof bruto.ajustes === 'object' ? bruto.ajustes : {};
  e.ajustes.nombre = txt(aj.nombre, 40).trim() || AJUSTES_BASE.nombre;
  e.ajustes.whatsapp = typeof aj.whatsapp === 'string' ? txt(aj.whatsapp, 30).trim() : AJUSTES_BASE.whatsapp;
  e.ajustes.tema = uno(aj.tema, ['auto', 'claro', 'oscuro'], AJUSTES_BASE.tema);
  e.ajustes.avisosNavegador = bool(aj.avisosNavegador);
  e.ajustes.ultimaCopia = sello(aj.ultimaCopia);
  e.ajustes.prioridadesFecha = fecha(aj.prioridadesFecha);
  const dias = Number(aj.diasSinSeguimiento);
  e.ajustes.diasSinSeguimiento = Number.isInteger(dias) && dias >= 1 && dias <= 90 ? dias : AJUSTES_BASE.diasSinSeguimiento;
  if (Array.isArray(aj.prioridades)) e.ajustes.prioridades = [0, 1, 2].map((i) => txt(aj.prioridades[i], 140));
  // Bloques del panel: se respeta el orden guardado y se añaden los nuevos al final.
  if (Array.isArray(aj.bloques)) {
    const vistos = new Set();
    const orden = aj.bloques.filter((b) => b && BLOQUES_PANEL[b.id] && !vistos.has(b.id) && vistos.add(b.id))
      .map((b) => ({ id: b.id, visible: b.visible !== false }));
    for (const id of Object.keys(BLOQUES_PANEL)) if (!vistos.has(id)) orden.push({ id, visible: true });
    e.ajustes.bloques = orden;
  }
  for (const c of COLECCIONES) {
    const vistos = new Set();
    e[c] = (Array.isArray(bruto[c]) ? bruto[c] : [])
      .filter((r) => r && typeof r === 'object')
      .map(LIMPIA[c])
      .filter((r) => !vistos.has(r.id) && vistos.add(r.id));
  }
  return e;
}

/* ───────────── validación de formularios (mensajes para Pau) ───────────── */

export function valida(coleccion, r) {
  const err = {};
  if (coleccion === 'clientes') {
    if (!r.nombre?.trim()) err.nombre = 'Escribe al menos el nombre.';
    if (r.email && !esEmail(r.email)) err.email = 'Ese correo no parece válido.';
    if (r.telefono && String(r.telefono).replace(/\D/g, '').length < 9) err.telefono = 'El teléfono necesita al menos 9 cifras.';
    if (r.presupuestoMin != null && r.presupuestoMax != null && r.presupuestoMin > r.presupuestoMax) err.presupuestoMax = 'El máximo es menor que el mínimo.';
  }
  if (coleccion === 'inmuebles') {
    if (!r.titulo?.trim() && !r.referencia?.trim()) err.titulo = 'Pon un título o una referencia.';
  }
  if (coleccion === 'eventos') {
    if (!r.titulo?.trim()) err.titulo = 'El evento necesita un título.';
    if (!esISO(r.fecha)) err.fecha = 'Elige una fecha válida.';
    if (!r.todoElDia) {
      if (!esHora(r.inicio)) err.inicio = 'Pon la hora de inicio (o marca «todo el día»).';
      const finMismoDia = !r.fechaFin || r.fechaFin === r.fecha;
      if (r.fin && esHora(r.inicio) && finMismoDia && minutos(r.fin) <= minutos(r.inicio)) err.fin = 'La hora de fin debe ser posterior al inicio.';
    }
    if (r.fechaFin && r.fechaFin < r.fecha) err.fechaFin = 'La fecha de fin es anterior al inicio.';
  }
  if (coleccion === 'tareas') {
    if (!r.titulo?.trim()) err.titulo = 'La tarea necesita un título.';
    if (r.hora && !r.fecha) err.hora = 'Para poner hora, elige también la fecha.';
    if (r.repeticion && !r.fecha) err.repeticion = 'Para repetir, la tarea necesita fecha.';
  }
  if (coleccion === 'notas') {
    if (!r.titulo?.trim() && !r.texto?.trim()) err.texto = 'La nota está vacía.';
  }
  if (coleccion === 'recursos') {
    if (!r.url && !['idea', 'documento'].includes(r.tipo)) err.url = 'Pega un enlace que empiece por https://';
    if (!r.titulo?.trim() && !r.url) err.titulo = 'Pon un título.';
  }
  return err;
}

/* ───────────── consultas habituales ───────────── */

export const activos = (lista) => lista.filter((r) => !r.borrado);
export const buscaId = (estado, coleccion, id) => (id ? estado[coleccion].find((r) => r.id === id) || null : null);

export const nombreCliente = (c) => (c ? `${c.nombre} ${c.apellidos}`.trim() || 'Sin nombre' : '');
export const nombreInmueble = (i) => (i ? [i.referencia, i.titulo].filter(Boolean).join(' · ') || 'Inmueble sin título' : '');

/** Clave de orden de un evento: fecha + hora (los de todo el día van primero). */
export const ordenEvento = (e) => `${e.fecha} ${e.todoElDia ? '00:00' : e.inicio || '00:00'}`;

/** Eventos que tocan un día (los de varios días aparecen en cada uno). */
export function eventosDelDia(estado, iso) {
  return activos(estado.eventos)
    .filter((e) => e.fecha === iso || (e.fechaFin && e.fecha <= iso && e.fechaFin >= iso))
    .sort((a, b) => ordenEvento(a).localeCompare(ordenEvento(b)));
}

/** Próximos eventos desde ahora (incluye el que está en curso). */
export function proximosEventos(estado, ahora = new Date(), limite = 50) {
  const hoy = aISO(ahora);
  const hhmm = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  return activos(estado.eventos)
    .filter((e) => {
      const finDia = e.fechaFin || e.fecha;
      if (finDia > hoy) return true;
      if (finDia < hoy) return false;
      if (e.todoElDia) return true;
      return (e.fin || e.inicio) >= hhmm;
    })
    .sort((a, b) => ordenEvento(a).localeCompare(ordenEvento(b)))
    .slice(0, limite);
}

export const tareaAbierta = (t) => !t.borrado && t.estado !== 'hecha';
export const tareaVencida = (t, hoy = aISO()) => tareaAbierta(t) && t.fecha && t.fecha < hoy;

/** Clientes con un seguimiento que toca (hoy o antes) o que llevan X días sin contacto. */
export function clientesSinSeguimiento(estado, hoy = aISO()) {
  const dias = estado.ajustes.diasSinSeguimiento;
  return activos(estado.clientes)
    .filter((c) => !['cerrado', 'archivado', 'contacto'].includes(c.estado))
    .map((c) => {
      const ultimo = c.historial.map((h) => h.fecha).sort().at(-1) || c.creado.slice(0, 10);
      if (c.siguienteSeguimiento && c.siguienteSeguimiento <= hoy) {
        return { cliente: c, motivo: c.siguienteSeguimiento < hoy ? `Seguimiento previsto el ${c.siguienteSeguimiento.split('-').reverse().join('/')}` : 'Seguimiento previsto para hoy', urgente: c.siguienteSeguimiento < hoy };
      }
      if (!c.siguienteSeguimiento && ultimo <= sumaDias(hoy, -dias)) {
        return { cliente: c, motivo: `Sin contacto registrado desde el ${ultimo.split('-').reverse().join('/')}`, urgente: false };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.urgente) - Number(a.urgente));
}

/** Posibles duplicados de un cliente: mismo teléfono, mismo correo o mismo nombre completo. */
export function duplicadosCliente(estado, c) {
  const tel = String(c.telefono || '').replace(/\D/g, '').slice(-9);
  const mail = norm(c.email);
  const nombre = norm(`${c.nombre} ${c.apellidos}`);
  return activos(estado.clientes).filter((o) => o.id !== c.id).map((o) => {
    const motivos = [];
    if (tel.length === 9 && String(o.telefono).replace(/\D/g, '').slice(-9) === tel) motivos.push('mismo teléfono');
    if (mail && norm(o.email) === mail) motivos.push('mismo correo');
    if (nombre && norm(`${o.nombre} ${o.apellidos}`) === nombre) motivos.push('mismo nombre');
    return motivos.length ? { cliente: o, motivos } : null;
  }).filter(Boolean);
}

/** URL comparable: sin www, sin barra final, sin parámetros de seguimiento. */
export function urlComparable(url) {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|si$|feature$)/.test(p)) u.searchParams.delete(p);
    const yt = idYoutube(u.href);
    if (yt) return 'youtube:' + yt;
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + (u.search || '')).toLowerCase();
  } catch { return ''; }
}
export function recursoDuplicado(estado, url, idPropio = '') {
  const k = urlComparable(url);
  return k ? estado.recursos.find((r) => r.id !== idPropio && !r.borrado && urlComparable(r.url) === k) || null : null;
}

/* ───────────── vídeos: solo se incrustan plataformas que lo permiten ───────────── */

export function idYoutube(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.)/, '');
    let v = '';
    if (host === 'youtu.be') v = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') v = u.searchParams.get('v') || '';
      else v = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] || '';
    }
    return /^[\w-]{11}$/.test(v) ? v : '';
  } catch { return ''; }
}
export function idVimeo(url) {
  try {
    const u = new URL(url);
    if (!/^(www\.|player\.)?vimeo\.com$/.test(u.hostname)) return '';
    return u.pathname.match(/(?:^|\/)(\d{6,12})(?:$|\/)/)?.[1] || '';
  } catch { return ''; }
}
/** URL de reproductor incrustable o '' (entonces se ofrece «Abrir el original»). */
export function urlIncrustada(url) {
  const yt = idYoutube(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}`;
  const vi = idVimeo(url);
  if (vi) return `https://player.vimeo.com/video/${vi}?dnt=1`;
  return '';
}
export const esVideo = (url) => Boolean(urlIncrustada(url)) || /\.(mp4|webm|mov)(\?|$)/i.test(String(url)) || /(tiktok|instagram)\.com\/.+\/(video|reel)/i.test(String(url));

/** Tipo de recurso que sugiere una URL. */
export function tipoSugerido(url) {
  if (esVideo(url)) return 'video';
  if (/\.(pdf|docx?|xlsx?|pptx?|odt)(\?|$)/i.test(url)) return 'documento';
  if (/(chatgpt|claude\.ai|openai|anthropic|gemini\.google|perplexity|huggingface|midjourney)/i.test(url)) return 'ia';
  return 'web';
}

/* ───────────── inmuebles ───────────── */

/** Coincidencia sencilla y explicada cliente ↔ inmueble (sin inventar nada). */
export function encajeInmueble(cliente, inm) {
  const motivos = [];
  let puntos = 0;
  if (inm.precio != null) {
    if (cliente.presupuestoMax != null && inm.precio > cliente.presupuestoMax) return { encaja: false, motivos: ['supera el presupuesto máximo'] };
    if (cliente.presupuestoMin != null && inm.precio < cliente.presupuestoMin * 0.7) motivos.push('muy por debajo del presupuesto');
    else if (cliente.presupuestoMax != null) { puntos += 2; motivos.push('dentro de presupuesto'); }
  }
  const zonas = norm(cliente.zonas).split(/[,;/]| y /).map((z) => z.trim()).filter(Boolean);
  if (zonas.length && inm.zona) {
    if (zonas.some((z) => norm(inm.zona).includes(z) || z.includes(norm(inm.zona)))) { puntos += 2; motivos.push('en su zona'); }
    else motivos.push('fuera de sus zonas');
  }
  const quiere = cliente.tipo === 'inquilino' ? 'alquiler' : cliente.tipo === 'comprador' ? 'venta' : '';
  if (quiere && inm.operacion !== quiere) return { encaja: false, motivos: [`es de ${inm.operacion}`] };
  return { encaja: puntos > 0, puntos, motivos };
}

/** Texto de la ficha para compartir: solo campos públicos, lo que falta no se inventa. */
export function fichaCompartible(inm) {
  const l = [];
  l.push(`🏠 ${inm.titulo || `${inm.tipo} en ${inm.operacion}`}${inm.referencia ? ` (Ref. ${inm.referencia})` : ''}`);
  if (inm.zona) l.push(`📍 ${inm.zona}`);
  if (inm.precio != null) l.push(`💶 ${inm.precio.toLocaleString('es-ES')} €${inm.operacion === 'alquiler' ? '/mes' : ''}`);
  const datos = [inm.superficie != null && `${inm.superficie} m²`, inm.habitaciones != null && `${inm.habitaciones} hab.`, inm.banos != null && `${inm.banos} baños`].filter(Boolean);
  if (datos.length) l.push(`📐 ${datos.join(' · ')}`);
  if (inm.caracteristicas.length) l.push(`✅ ${inm.caracteristicas.join(', ')}`);
  if (inm.descripcion) l.push('', inm.descripcion);
  const anuncio = inm.enlaces[0]?.url;
  if (anuncio) l.push('', `Anuncio: ${anuncio}`);
  const video = inm.videos[0]?.url;
  if (video) l.push(`Vídeo: ${video}`);
  return l.join('\n');
}

/* ───────────── tareas que se repiten ───────────── */

/** Al completar una tarea con repetición, devuelve la siguiente (o null). */
export function siguienteRepeticion(t, hoy = aISO()) {
  if (!t.repeticion || !t.fecha) return null;
  const dia = t.diaMes || Number(t.fecha.slice(8, 10));
  const mensual = (f) => {
    const s = sumaMeses(f.slice(0, 8) + '01', 1);
    const ultimo = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 0).getDate();
    return s.slice(0, 8) + String(Math.min(dia, ultimo)).padStart(2, '0');
  };
  const paso = { diaria: (f) => sumaDias(f, 1), semanal: (f) => sumaDias(f, 7), mensual }[t.repeticion];
  let f = paso(t.fecha);
  while (f < hoy) f = paso(f);
  return LIMPIA.tareas({
    ...t, id: nuevoId('t'), fecha: f, diaMes: t.repeticion === 'mensual' ? dia : 0, estado: 'pendiente', completada: '', creado: '', actualizado: '',
    subtareas: t.subtareas.map((s) => ({ ...s, id: nuevoId('s'), hecha: false })),
  });
}
/* ───────────── papelera ───────────── */

/** Borra de verdad lo que lleva más de 30 días en la papelera y limpia referencias. */
export function purgaPapelera(estado, ahora = new Date()) {
  const limite = new Date(ahora.getTime() - DIAS_PAPELERA * 86400000).toISOString();
  let n = 0;
  for (const c of COLECCIONES) {
    const antes = estado[c].length;
    const quitados = estado[c].filter((r) => r.borrado && r.borrado < limite).map((r) => r.id);
    if (quitados.length) { estado[c] = estado[c].filter((r) => !quitados.includes(r.id)); quitaReferencias(estado, quitados); }
    n += antes - estado[c].length;
  }
  return n;
}

/** Tras borrar definitivamente, ningún registro apunta a ids que ya no existen. */
export function quitaReferencias(estado, quitados) {
  const fuera = new Set(quitados);
  const limpia = (v) => (fuera.has(v) ? '' : v);
  for (const c of estado.clientes) c.inmuebles = c.inmuebles.filter((i) => !fuera.has(i));
  for (const i of estado.inmuebles) i.propietario = limpia(i.propietario);
  for (const col of ['eventos', 'tareas', 'notas', 'recursos']) {
    for (const r of estado[col]) {
      r.cliente = limpia(r.cliente);
      r.inmueble = limpia(r.inmueble);
      if (col === 'recursos') { r.tarea = limpia(r.tarea); r.evento = limpia(r.evento); }
    }
  }
}

/* ───────────── guardado en el navegador ───────────── */

export function carga(almacen = globalThis.localStorage) {
  try {
    const bruto = almacen?.getItem(CLAVE);
    if (!bruto) return { estado: estadoVacio(), nuevo: true, error: '' };
    return { estado: normalizaEstado(JSON.parse(bruto)), nuevo: false, error: '' };
  } catch (err) {
    return { estado: estadoVacio(), nuevo: false, error: 'No se han podido leer los datos guardados: ' + (err?.message || err) };
  }
}

export function guarda(estado, almacen = globalThis.localStorage) {
  try {
    almacen.setItem(CLAVE, JSON.stringify(estado));
    return { ok: true };
  } catch (err) {
    const lleno = err?.name === 'QuotaExceededError' || /quota/i.test(String(err?.message));
    return { ok: false, error: lleno ? 'lleno' : String(err?.message || err) };
  }
}

export const tamanoKb = (estado) => Math.round(new Blob([JSON.stringify(estado)]).size / 1024);

/* ───────────── copia de seguridad ───────────── */

export function copiaSeguridad(estado, ahora = new Date()) {
  return JSON.stringify({ app: 'olvido-de-pau-agenda', version: VERSION_DATOS, fecha: ahora.toISOString(), datos: estado }, null, 1);
}

/** Lee una copia y dice qué trae antes de sustituir nada. */
export function leeCopia(texto) {
  let j;
  try { j = JSON.parse(texto); } catch { return { ok: false, error: 'El archivo no es una copia válida (no es JSON).' }; }
  if (!j || j.app !== 'olvido-de-pau-agenda' || !j.datos) return { ok: false, error: 'Este archivo no es una copia de OLVIDO DE PAU AGENDA.' };
  const estado = normalizaEstado(j.datos);
  const cuentas = Object.fromEntries(COLECCIONES.map((c) => [c, activos(estado[c]).length]));
  return { ok: true, estado, fecha: sello(j.fecha), cuentas };
}

/* ───────────── datos de ejemplo (ficticios y marcados) ───────────── */

export function datosEjemplo(hoy = aISO()) {
  const d = (n) => sumaDias(hoy, n);
  const c1 = { id: 'demo_c1', nombre: 'Marta', apellidos: 'Ejemplo Ruiz', telefono: '600000001', email: 'marta@ejemplo.test', tipo: 'comprador', estado: 'seguimiento', procedencia: 'Portal (ejemplo)', presupuestoMin: 150000, presupuestoMax: 220000, zonas: 'Oviedo, Centro', preferencias: '3 habitaciones, ascensor.', etiquetas: ['ejemplo'], siguienteSeguimiento: d(0), proximaAccion: 'Llamar para proponer visita' };
  const c2 = { id: 'demo_c2', nombre: 'Andrés', apellidos: 'Prueba Gómez', telefono: '600000002', tipo: 'propietario', estado: 'contactado', procedencia: 'Recomendación (ejemplo)', etiquetas: ['ejemplo'], historial: [{ fecha: d(-12), tipo: 'llamada', texto: 'Primera llamada (ejemplo).' }] };
  const i1 = { id: 'demo_i1', referencia: 'DEMO-01', titulo: 'Piso de ejemplo en Oviedo centro', tipo: 'piso', operacion: 'venta', estadoComercial: 'disponible', precio: 195000, zona: 'Oviedo, Centro', direccion: 'Calle Ficticia 1 (ejemplo)', superficie: 90, habitaciones: 3, banos: 2, caracteristicas: ['ascensor', 'exterior'], propietario: 'demo_c2', descripcion: 'Inmueble ficticio para probar la app.' };
  c1.inmuebles = ['demo_i1'];
  return normalizaEstado({
    clientes: [c1, c2].map((x) => ({ ...x, demo: true })),
    inmuebles: [{ ...i1, demo: true }],
    eventos: [
      { id: 'demo_e1', titulo: 'Visita piso de ejemplo', tipo: 'visita', fecha: d(1), inicio: '10:00', fin: '10:45', ubicacion: 'Oviedo (ejemplo)', cliente: 'demo_c1', inmueble: 'demo_i1', recordatorios: [60], demo: true },
      { id: 'demo_e2', titulo: 'Reunión de equipo (ejemplo)', tipo: 'reunion', fecha: d(0), inicio: '17:00', fin: '18:00', demo: true },
    ],
    tareas: [
      { id: 'demo_t1', titulo: 'Preparar nota simple (ejemplo)', prioridad: 'alta', fecha: d(-1), inmueble: 'demo_i1', demo: true },
      { id: 'demo_t2', titulo: 'Revisar anuncios de la semana (ejemplo)', prioridad: 'media', fecha: d(0), subtareas: [{ texto: 'Idealista' }, { texto: 'Fotocasa' }], demo: true },
    ],
    notas: [{ id: 'demo_n1', titulo: 'Ideas para captación (ejemplo)', texto: '- [ ] Buzoneo en el barrio\n- [ ] Vídeo de valoración gratuita\nNota ficticia.', fijada: true, demo: true }],
    recursos: [{ id: 'demo_r1', titulo: 'Web de ejemplo', url: 'https://example.com/', tipo: 'web', coleccion: 'Ejemplos', demo: true }],
  });
}
