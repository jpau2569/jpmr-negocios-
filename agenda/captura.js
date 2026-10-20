/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — captura rápida en lenguaje natural
   «Llamar a Marta mañana a las 10 por el piso de Oviedo» → una PROPUESTA
   editable: qué es (tarea o evento), la fecha exacta, la hora, y los
   clientes e inmuebles que podrían ser. No guarda nada: Pau revisa la
   fecha interpretada y elige el contacto si hay dudas.
   Sin IA: reglas propias en español, para que funcione sin conexión y
   sin mandar los datos de nadie a ningún proveedor.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, nombreCliente, nombreInmueble } from './datos.js';
import { aISO, deISO, esISO, normaliza, sumaDias } from './utiles.js';

const DIAS_SEMANA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MESES_N = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const NUMEROS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const TIPOS_INMUEBLE_RE = '(?:piso|casa|chalet|atico|duplex|estudio|local|oficina|nave|garaje|trastero|terreno|bajo|inmueble|apartamento)';

/** Quita un trozo del texto (en la versión normalizada y en la original, misma longitud). */
function recorta(estado, inicio, fin) {
  estado.n = estado.n.slice(0, inicio) + ' '.repeat(fin - inicio) + estado.n.slice(fin);
  estado.o = estado.o.slice(0, inicio) + ' '.repeat(fin - inicio) + estado.o.slice(fin);
}
function busca(estado, re) {
  const m = re.exec(estado.n);
  if (m) recorta(estado, m.index, m.index + m[0].length);
  return m;
}

/** Fecha real o '' (el 31 de abril no existe). */
function fechaValida(a, m, d) {
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return esISO(iso) ? iso : '';
}

function leeFecha(t, hoy, dudas) {
  let m;
  if ((m = busca(t, /\bpasado manana\b/))) return sumaDias(hoy, 2);
  if ((m = busca(t, /\bmanana\b(?!\s+por)/)) || (m = busca(t, /\bmanana(?=\s+por)/))) return sumaDias(hoy, 1);
  if ((m = busca(t, /\b(?:hoy|esta (?:tarde|noche))\b/))) return hoy;
  if ((m = busca(t, /\bdentro de (\d{1,2}|\w+) dias?\b/))) {
    const n = Number(m[1]) || NUMEROS[m[1]];
    if (n) return sumaDias(hoy, n);
  }
  if ((m = busca(t, /\b(?:la )?semana (?:que viene|proxima)\b|\bla proxima semana\b/))) {
    const dia = (deISO(hoy).getDay() + 6) % 7;
    dudas.push('«La semana que viene» lo he puesto el lunes; cambia el día si era otro.');
    return sumaDias(hoy, 7 - dia);
  }
  // 25/10, 25-10-2026, 25/10/26
  if ((m = busca(t, /\b(?:el |dia )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    const d = Number(m[1]); const mes = Number(m[2]);
    let a = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : deISO(hoy).getFullYear();
    let f = fechaValida(a, mes, d);
    if (f && !m[3] && f < hoy) f = fechaValida(a + 1, mes, d);
    if (f) return f;
    dudas.push(`«${m[0].trim()}» no es una fecha que exista.`);
  }
  // 25 de octubre (de 2026)
  if ((m = busca(t, /\b(?:el )?(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/))) {
    const a = m[3] ? Number(m[3]) : deISO(hoy).getFullYear();
    let f = fechaValida(a, MESES_N[m[2]], Number(m[1]));
    if (f && !m[3] && f < hoy) f = fechaValida(a + 1, MESES_N[m[2]], Number(m[1]));
    if (f) return f;
    dudas.push(`El ${m[1]} de ${m[2]} no existe.`);
  }
  // el lunes, este viernes, el próximo martes
  if ((m = busca(t, /\b(?:el |este |esta |el proximo |el que viene )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?: que viene| proximo)?\b/))) {
    const objetivo = DIAS_SEMANA[m[1]];
    const actual = deISO(hoy).getDay();
    let n = (objetivo - actual + 7) % 7;
    if (n === 0) { n = 7; dudas.push(`Hoy ya es ${m[1]}: lo he puesto el de la semana que viene.`); }
    return sumaDias(hoy, n);
  }
  // el 25 (de este mes o del siguiente)
  if ((m = busca(t, /\bel (?:dia )?(\d{1,2})\b(?! de la)(?!:)/))) {
    const h = deISO(hoy);
    let f = fechaValida(h.getFullYear(), h.getMonth() + 1, Number(m[1]));
    if (f && f < hoy) {
      const sig = new Date(h.getFullYear(), h.getMonth() + 1, 1);
      f = fechaValida(sig.getFullYear(), sig.getMonth() + 1, Number(m[1]));
    }
    if (f) return f;
  }
  return '';
}

function leeHora(t, dudas) {
  let m;
  if ((m = busca(t, /\ba(?:l)? mediodia\b/))) return '12:00';
  const re = /\b(?:a las?|sobre las?|hacia las?|desde las?|a eso de las?)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:[:.h](\d{2}))?\s*(?:h\b|horas?\b)?\s*(y media|y cuarto|menos cuarto)?\s*(de la manana|de la tarde|de la noche|de la madrugada|am|pm)?/;
  m = busca(t, re) || busca(t, /\b(\d{1,2})[:.](\d{2})\b()()/) || busca(t, /\b(\d{1,2})\s*h\b()()()/);
  if (!m) {
    if (/\bpor la (manana|tarde)\b/.test(t.n)) dudas.push('Has dicho la franja pero no la hora: elígela antes de guardar.');
    return '';
  }
  let h = Number(m[1]) || NUMEROS[m[1]];
  let min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'y media') min = 30;
  if (m[3] === 'y cuarto') min = 15;
  if (m[3] === 'menos cuarto') { h -= 1; min = 45; }
  const franja = m[4] || '';
  if (/tarde|noche|pm/.test(franja) && h < 12) h += 12;
  if (/madrugada/.test(franja) && h === 12) h = 0;
  if (!franja && h >= 1 && h <= 7) {
    h += 12;
    dudas.push(`He entendido las ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}; si era por la mañana, cámbialo.`);
  }
  if (h > 23 || min > 59) { dudas.push('La hora no es válida: escríbela a mano.'); return ''; }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function leeTipo(n) {
  if (/\b(llamar|llama|llamada|telefonear)\b/.test(n)) return 'llamada';
  if (/\b(visita|visitar|ensenar|ver el|ver la|ver piso)\b/.test(n)) return 'visita';
  if (/\b(firma|firmar|notaria|escritura|arras)\b/.test(n)) return 'firma';
  if (/\b(reunion|reunirme|quedar|cita con|cafe con|comida con)\b/.test(n)) return 'reunion';
  if (/\b(seguimiento|recontactar)\b/.test(n)) return 'seguimiento';
  if (/\b(recuerdame|recordar|recordatorio|no olvidar)\b/.test(n)) return 'recordatorio';
  return '';
}

/** Personas mencionadas: «a Marta», «con Marta López», «de Juan». Devuelve palabras con mayúscula. */
function leePersonas(original) {
  const salida = [];
  const re = /\b(?:a|con|para|al cliente|a la cliente)\s+((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)?)/g;
  let m;
  while ((m = re.exec(original))) salida.push(m[1]);
  return salida;
}

function candidatosCliente(estado, personas) {
  if (!personas.length) return [];
  const clientes = activos(estado.clientes);
  const res = [];
  for (const p of personas) {
    const palabras = normaliza(p).split(' ');
    for (const c of clientes) {
      const nombre = normaliza(c.nombre);
      const completo = normaliza(nombreCliente(c));
      let puntos = 0;
      if (palabras[0] === nombre.split(' ')[0]) puntos += 2;
      if (palabras.length > 1 && completo.includes(palabras[1])) puntos += 2;
      if (puntos && !res.some((r) => r.id === c.id)) res.push({ id: c.id, nombre: nombreCliente(c), puntos });
    }
  }
  return res.sort((a, b) => b.puntos - a.puntos).slice(0, 6);
}

function candidatosInmueble(estado, n) {
  const inm = activos(estado.inmuebles);
  const res = [];
  // Referencia escrita tal cual (DEMO-01, OU-2026-0001, «ref 123»).
  for (const i of inm) {
    const ref = normaliza(i.referencia);
    if (ref && ref.length >= 3 && n.includes(ref)) res.push({ id: i.id, nombre: nombreInmueble(i), puntos: 5 });
  }
  const m = new RegExp(`\\b${TIPOS_INMUEBLE_RE}\\s+(?:de|en|del|de la)\\s+([a-z0-9ñ ]{3,40})`).exec(n);
  const lugar = m ? m[1].split(/\b(?:por|a las?|para|con|manana|hoy|el|que)\b/)[0].trim() : '';
  if (lugar) {
    for (const i of inm) {
      const donde = normaliza(`${i.zona} ${i.titulo} ${i.direccion}`);
      if (donde.includes(lugar) && !res.some((r) => r.id === i.id)) res.push({ id: i.id, nombre: nombreInmueble(i), puntos: 3 });
    }
  }
  return { lista: res.sort((a, b) => b.puntos - a.puntos).slice(0, 6), lugar };
}

/**
 * Convierte una frase en una propuesta editable (no guarda nada).
 * @returns {{tipo:'evento'|'tarea', tipoEvento:string, titulo:string, fecha:string, hora:string,
 *   clientes:Array, inmuebles:Array, personas:string[], lugar:string, dudas:string[]}}
 */
export function interpreta(texto, estado, ahora = new Date()) {
  const original = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const hoy = aISO(ahora);
  const dudas = [];
  // Misma longitud en las dos versiones: normalizar solo quita tildes (1 carácter → 1).
  const t = { o: original, n: original.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() };
  if (t.n.length !== t.o.length) t.n = original.toLowerCase();
  const nCompleto = t.n;
  const fecha = leeFecha(t, hoy, dudas);
  const hora = leeHora(t, dudas);
  const tipoEvento = leeTipo(nCompleto);
  const { lista: inmuebles, lugar } = candidatosInmueble(estado, nCompleto);
  const personas = leePersonas(original).filter((p) => !lugar.includes(normaliza(p)));
  const clientes = candidatosCliente(estado, personas);

  if (personas.length && !clientes.length) dudas.push(`No tengo ningún cliente llamado «${personas[0]}»: guárdalo sin cliente o créalo antes.`);
  if (clientes.length > 1 && clientes[0].puntos === clientes[1].puntos) dudas.push(`Hay ${clientes.length} clientes que podrían ser «${personas[0]}»: elige uno.`);
  if (lugar && !inmuebles.length) dudas.push(`No encuentro ningún inmueble en «${lugar}».`);
  if (inmuebles.length > 1) dudas.push('Hay varios inmuebles posibles: elige el correcto.');
  if (fecha && fecha < hoy) dudas.push('La fecha que he entendido ya ha pasado.');

  // Lo que queda tras quitar fecha y hora, sin preposiciones colgando al final.
  const titulo = t.o.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim()
    .replace(/(?:\s+(?:el|la|a|de|del|para|sobre|y))+$/i, '').replace(/[,.;\s]+$/, '');
  const tipo = hora ? 'evento' : 'tarea';
  return {
    tipo,
    tipoEvento: tipoEvento || (hora ? 'reunion' : ''),
    titulo: titulo ? titulo[0].toUpperCase() + titulo.slice(1) : original,
    fecha,
    hora,
    clientes,
    inmuebles,
    personas,
    lugar,
    dudas,
  };
}
