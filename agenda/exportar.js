/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — exportar e importar
   · CSV con «;» y BOM (Excel en español lo abre bien) de clientes,
     tareas e inmuebles. Exportar NO es una copia completa: para eso
     está la copia de seguridad .json (datos.js).
   · Calendario .ics con la zona Europe/Madrid (Google Calendar, Apple y
     Outlook lo importan).
   · Importar clientes desde CSV: se lee, se proponen las columnas, se
     enseña la vista previa con los errores y duplicados, y solo entonces
     se guarda.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, ESTADOS_CLIENTE, LIMPIA, nombreCliente, TIPOS_CLIENTE, TIPOS_EVENTO, valida } from './datos.js';
import { normaliza } from './utiles.js';

/* ───────────── CSV ───────────── */

const celda = (v) => {
  let s = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  // Evita fórmulas al abrirlo en Excel (=, +, -, @ al principio).
  // Un teléfono «+34…» o un número negativo no son fórmulas y se dejan tal cual.
  if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s]+$)/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (cabecera, filas) => '\ufeff' + [cabecera, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');

export function csvClientes(estado) {
  return csv(
    ['Nombre', 'Apellidos', 'Teléfono', 'Correo', 'Tipo', 'Estado', 'Procedencia', 'Presupuesto mínimo', 'Presupuesto máximo', 'Zonas', 'Etiquetas', 'Próxima acción', 'Siguiente seguimiento', 'Preferencias', 'Notas'],
    activos(estado.clientes).map((c) => [c.nombre, c.apellidos, c.telefono, c.email, c.tipo, c.estado, c.procedencia, c.presupuestoMin, c.presupuestoMax, c.zonas, c.etiquetas, c.proximaAccion, c.siguienteSeguimiento.split('-').reverse().join('/'), c.preferencias, c.notas]),
  );
}
export function csvTareas(estado) {
  const nombre = (col, id, f) => f(estado[col].find((r) => r.id === id));
  return csv(
    ['Título', 'Estado', 'Prioridad', 'Fecha', 'Hora', 'Repetición', 'Etiquetas', 'Cliente', 'Inmueble', 'Subtareas', 'Descripción'],
    activos(estado.tareas).map((t) => [t.titulo, t.estado, t.prioridad, t.fecha.split('-').reverse().join('/'), t.hora, t.repeticion, t.etiquetas,
      nombre('clientes', t.cliente, nombreCliente), nombre('inmuebles', t.inmueble, (i) => i?.referencia || i?.titulo || ''),
      t.subtareas.map((s) => `${s.hecha ? '[x]' : '[ ]'} ${s.texto}`).join(' | '), t.descripcion]),
  );
}
export function csvInmuebles(estado) {
  return csv(
    ['Referencia', 'Título', 'Tipo', 'Operación', 'Estado', 'Precio', 'Zona', 'Dirección', 'Superficie m²', 'Habitaciones', 'Baños', 'Características', 'Propietario', 'Anuncios', 'Vídeos', 'Descripción'],
    activos(estado.inmuebles).map((i) => [i.referencia, i.titulo, i.tipo, i.operacion, i.estadoComercial, i.precio, i.zona, i.direccion, i.superficie, i.habitaciones, i.banos, i.caracteristicas,
      nombreCliente(estado.clientes.find((c) => c.id === i.propietario)), i.enlaces.map((e) => e.url).join(' '), i.videos.map((e) => e.url).join(' '), i.descripcion]),
  );
}

/** Lee CSV con «;» o «,» (lo detecta), comillas y saltos de línea dentro de comillas. */
export function leeCsv(texto) {
  const t = String(texto ?? '').replace(/^\ufeff/, '');
  const primera = t.split(/\r?\n/)[0] || '';
  const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return { separador: sep, cabecera: (filas[0] || []).map((x) => x.trim()), filas: filas.slice(1) };
}

/** Campos de cliente a los que se puede asignar una columna, con los nombres habituales. */
export const CAMPOS_IMPORTABLES = {
  nombre: { nombre: 'Nombre', pistas: ['nombre', 'name', 'first name', 'nombre completo', 'cliente', 'contacto'] },
  apellidos: { nombre: 'Apellidos', pistas: ['apellidos', 'apellido', 'last name', 'surname'] },
  telefono: { nombre: 'Teléfono', pistas: ['telefono', 'movil', 'tel', 'phone', 'celular', 'telefono 1', 'mobile'] },
  email: { nombre: 'Correo', pistas: ['email', 'correo', 'e-mail', 'mail', 'correo electronico'] },
  tipo: { nombre: 'Tipo', pistas: ['tipo', 'perfil'] },
  estado: { nombre: 'Estado', pistas: ['estado', 'fase'] },
  procedencia: { nombre: 'Procedencia', pistas: ['procedencia', 'origen', 'fuente', 'source'] },
  zonas: { nombre: 'Zonas', pistas: ['zona', 'zonas', 'barrio', 'localidad', 'poblacion', 'ciudad'] },
  presupuestoMin: { nombre: 'Presupuesto mínimo', pistas: ['presupuesto minimo', 'precio minimo', 'min'] },
  presupuestoMax: { nombre: 'Presupuesto máximo', pistas: ['presupuesto maximo', 'presupuesto', 'precio maximo', 'max'] },
  etiquetas: { nombre: 'Etiquetas', pistas: ['etiquetas', 'tags', 'grupo'] },
  preferencias: { nombre: 'Preferencias', pistas: ['preferencias', 'busca', 'necesidades'] },
  notas: { nombre: 'Notas', pistas: ['notas', 'observaciones', 'comentarios', 'notes'] },
};

/** Propone qué columna va a cada campo (Pau lo puede cambiar). índice o -1. */
export function proponeMapeo(cabecera) {
  const cab = cabecera.map(normaliza);
  const usado = new Set();
  const mapeo = {};
  for (const [campo, def] of Object.entries(CAMPOS_IMPORTABLES)) {
    let i = cab.findIndex((c, k) => !usado.has(k) && def.pistas.includes(c));
    if (i < 0) i = cab.findIndex((c, k) => !usado.has(k) && def.pistas.some((p) => p.length > 3 && c.includes(p)));
    mapeo[campo] = i;
    if (i >= 0) usado.add(i);
  }
  return mapeo;
}

/** Vista previa de un CSV: cada fila con el cliente que saldría, sus errores y sus duplicados. */
export function previaImportacion(estado, filas, mapeo) {
  const brutos = filas.map((fila) => {
    const bruto = {};
    for (const [campo, i] of Object.entries(mapeo)) if (i >= 0) bruto[campo] = (fila[i] ?? '').trim();
    if (bruto.tipo) bruto.tipo = TIPOS_CLIENTE.find((t) => normaliza(bruto.tipo).startsWith(t.slice(0, 5))) || 'otro';
    if (bruto.estado) bruto.estado = ESTADOS_CLIENTE.find((t) => normaliza(bruto.estado).startsWith(t.slice(0, 5))) || 'nuevo';
    if (bruto.nombre && !bruto.apellidos && mapeo.apellidos < 0 && bruto.nombre.includes(' ')) {
      const [nom, ...resto] = bruto.nombre.split(' ');
      bruto.nombre = nom; bruto.apellidos = resto.join(' ');
    }
    return bruto;
  });
  return previaClientes(estado, brutos, 2);
}

/**
 * Vista previa de una lista de clientes (CSV, .vcf o selector del móvil).
 * Duplicados por teléfono (9 últimas cifras), correo o nombre completo, contra
 * la agenda y contra las filas anteriores del mismo archivo. Con índices: miles
 * de contactos se revisan al momento.
 */
export function previaClientes(estado, brutos, primeraFila = 1) {
  const porTel = new Map(); const porMail = new Map(); const porNombre = new Map();
  const apunta = (c) => {
    const tel = String(c.telefono || '').replace(/\D/g, '').slice(-9);
    if (tel.length === 9 && !porTel.has(tel)) porTel.set(tel, c);
    const mail = normaliza(c.email);
    if (mail && !porMail.has(mail)) porMail.set(mail, c);
    const nom = normaliza(`${c.nombre} ${c.apellidos}`);
    if (nom && !porNombre.has(nom)) porNombre.set(nom, c);
  };
  activos(estado.clientes).forEach(apunta);
  return brutos.map((bruto, n) => {
    const cliente = LIMPIA.clientes({ ...bruto, demo: false });
    const errores = Object.values(valida('clientes', cliente));
    const encontrados = new Map();
    const tel = cliente.telefono.replace(/\D/g, '').slice(-9);
    if (tel.length === 9 && porTel.has(tel)) encontrados.set(porTel.get(tel), [...(encontrados.get(porTel.get(tel)) || []), 'mismo teléfono']);
    const mail = normaliza(cliente.email);
    if (mail && porMail.has(mail)) encontrados.set(porMail.get(mail), [...(encontrados.get(porMail.get(mail)) || []), 'mismo correo']);
    const nom = normaliza(`${cliente.nombre} ${cliente.apellidos}`);
    if (nom && porNombre.has(nom)) encontrados.set(porNombre.get(nom), [...(encontrados.get(porNombre.get(nom)) || []), 'mismo nombre']);
    const duplicados = [...encontrados].map(([c, motivos]) => `${nombreCliente(c)} (${motivos.join(', ')})`);
    if (!errores.length) apunta(cliente);
    return { fila: n + primeraFila, cliente, errores, duplicados, importar: !errores.length && !duplicados.length };
  });
}

/* ───────────── calendario .ics ───────────── */

const escIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Líneas de más de 75 octetos se parten (RFC 5545). */
function plegar(linea) {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes = [];
  let actual = '';
  for (const ch of linea) {
    if (new TextEncoder().encode(actual + ch).length > (partes.length ? 74 : 75)) { partes.push(actual); actual = ''; }
    actual += ch;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}
const fechaIcs = (iso) => iso.replace(/-/g, '');
const horaIcs = (h) => h.replace(':', '') + '00';
const masUnDia = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
function masHora(h) { const [a, b] = h.split(':').map(Number); const t = Math.min(23 * 60 + 59, a * 60 + b + 60); return `${String(Math.floor(t / 60)).padStart(2, '0')}${String(t % 60).padStart(2, '0')}00`; }

// Hora de Madrid: CET (+01) en invierno y CEST (+02) del último domingo de marzo al último de octubre.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Madrid',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

export function icsEventos(estado, ahora = new Date()) {
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Olvido de Pau Agenda//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Olvido de Pau Agenda', 'X-WR-TIMEZONE:Europe/Madrid', ...VTIMEZONE];
  for (const e of activos(estado.eventos)) {
    l.push('BEGIN:VEVENT', `UID:${e.id}@olvido-de-pau-agenda`, `DTSTAMP:${sello}`);
    if (e.todoElDia) {
      l.push(`DTSTART;VALUE=DATE:${fechaIcs(e.fecha)}`, `DTEND;VALUE=DATE:${masUnDia(e.fechaFin || e.fecha)}`);
    } else {
      l.push(`DTSTART;TZID=Europe/Madrid:${fechaIcs(e.fecha)}T${horaIcs(e.inicio)}`);
      l.push(`DTEND;TZID=Europe/Madrid:${fechaIcs(e.fechaFin || e.fecha)}T${e.fin ? horaIcs(e.fin) : masHora(e.inicio)}`);
    }
    l.push(`SUMMARY:${escIcs(e.titulo)}`, `CATEGORIES:${escIcs(TIPOS_EVENTO[e.tipo]?.nombre || e.tipo)}`);
    if (e.ubicacion) l.push(`LOCATION:${escIcs(e.ubicacion)}`);
    if (e.descripcion) l.push(`DESCRIPTION:${escIcs(e.descripcion)}`);
    for (const m of e.recordatorios) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(e.titulo)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    l.push('END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.map(plegar).join('\r\n') + '\r\n';
}
