// ============================================================================
//  Pruebas de OLVIDO DE PAU AGENDA (lógica pura, sin navegador)
//  Ejecutar con: node test/agenda.test.mjs
// ============================================================================

import {
  aISO, cuando, esISO, euros, fechaCorta, fechaLarga, lunesDe, numeroES, sumaMeses, telefonoWhatsapp, urlSegura,
} from '../agenda/utiles.js';
import {
  activos, carga, clientesSinSeguimiento, copiaSeguridad, datosEjemplo, duplicadosCliente, encajeInmueble, estadoVacio, eventosDelDia,
  fichaCompartible, guarda, idYoutube, leeCopia, LIMPIA, normalizaEstado, proximosEventos, purgaPapelera, recursoDuplicado,
  siguienteRepeticion, tipoSugerido, urlIncrustada, valida,
} from '../agenda/datos.js';
import { interpreta } from '../agenda/captura.js';
import { buscaGlobal } from '../agenda/busqueda.js';
import { csvClientes, icsEventos, leeCsv, previaImportacion, proponeMapeo } from '../agenda/exportar.js';
import { clienteDeContacto, leeVcard } from '../agenda/contactos.js';
import { previaClientes } from '../agenda/exportar.js';
import { cuentaAtras, recordatoriosPendientes } from '../agenda/recordatorios.js';

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = '') {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n📅 Utilidades');
check('aISO usa la hora local', aISO(new Date(2026, 9, 20, 23, 59)) === '2026-10-20');
check('esISO rechaza 30 de febrero', !esISO('2026-02-30') && esISO('2028-02-29'));
check('fechaCorta DD/MM/AAAA', fechaCorta('2026-10-05') === '05/10/2026');
check('fechaLarga en español', fechaLarga('2026-10-20') === 'martes, 20 de octubre de 2026');
check('cuando: Hoy/Mañana/Ayer', cuando('2026-10-20', '2026-10-20') === 'Hoy' && cuando('2026-10-21', '2026-10-20') === 'Mañana' && cuando('2026-10-19', '2026-10-20') === 'Ayer');
check('lunesDe: la semana empieza en lunes', lunesDe('2026-10-25') === '2026-10-19' && lunesDe('2026-10-19') === '2026-10-19');
check('sumaMeses no salta de mes', sumaMeses('2026-01-31', 1) === '2026-02-28');
check('numeroES lee 245.000 y 1.250,50', numeroES('245.000') === 245000 && numeroES('1.250,50') === 1250.5 && numeroES('abc') === null);
check('euros', euros(195000).replace(/\s/g, ' ') === '195.000 €');
check('urlSegura bloquea javascript:', urlSegura('javascript:alert(1)') === '' && urlSegura('ejemplo.com/a') === 'https://ejemplo.com/a');
check('WhatsApp pone el 34 a un móvil', telefonoWhatsapp('600 11 22 33') === '34600112233' && telefonoWhatsapp('+34 600112233') === '34600112233' && telefonoWhatsapp('12') === '');

console.log('\n🗃 Datos');
const roto = normalizaEstado({ clientes: [{ id: '<img onerror=x>', nombre: 'A' }, { id: 'c1', nombre: 'B', tipo: 'pirata', presupuestoMax: '200.000' }, 'basura', null], eventos: [{ id: 'e1', titulo: 'X', fecha: '2026-13-01', inicio: '25:00' }] });
check('normaliza: ids raros se cambian por uno nuevo', roto.clientes.length === 2 && !roto.clientes.some((c) => c.id.includes('<')));
check('normaliza: tipo desconocido → comprador; presupuesto leído', roto.clientes[1].tipo === 'comprador' && roto.clientes[1].presupuestoMax === 200000);
check('normaliza: fecha y hora inválidas se limpian', esISO(roto.eventos[0].fecha) && roto.eventos[0].inicio === '');
check('normaliza: estado vacío con lo que sea', igual(Object.keys(normalizaEstado('nada')), Object.keys(estadoVacio())));
check('valida cliente sin nombre', 'nombre' in valida('clientes', LIMPIA.clientes({})));
check('valida correo malo', 'email' in valida('clientes', LIMPIA.clientes({ nombre: 'A', email: 'no-es' })));
check('valida evento: fin antes de inicio', 'fin' in valida('eventos', LIMPIA.eventos({ titulo: 'a', fecha: '2026-10-20', inicio: '10:00', fin: '09:00' })));
check('valida evento: todo el día no pide hora', !Object.keys(valida('eventos', LIMPIA.eventos({ titulo: 'a', fecha: '2026-10-20', todoElDia: true }))).length);
check('valida tarea: repetir sin fecha', 'repeticion' in valida('tareas', LIMPIA.tareas({ titulo: 'a', repeticion: 'semanal' })));
check('valida recurso web sin enlace', 'url' in valida('recursos', LIMPIA.recursos({ titulo: 'a', tipo: 'web' })));

const demo = datosEjemplo('2026-10-20');
check('ejemplo: todo marcado como demo', ['clientes', 'inmuebles', 'eventos', 'tareas', 'notas', 'recursos'].every((c) => demo[c].length && demo[c].every((r) => r.demo)));
check('duplicados por teléfono', duplicadosCliente(demo, { nombre: 'Otra', telefono: '+34 600 000 001' }).some((d) => d.motivos.includes('mismo teléfono')));
check('duplicados por nombre sin tildes', duplicadosCliente(demo, { nombre: 'marta', apellidos: 'ejemplo ruiz' }).length === 1);
check('seguimiento: Marta hoy, Andrés por días sin contacto', igual(clientesSinSeguimiento(demo, '2026-10-20').map((s) => s.cliente.id).sort(), ['demo_c1', 'demo_c2']));
check('eventos del día', eventosDelDia(demo, '2026-10-21').map((e) => e.id).join() === 'demo_e1');
check('próximos eventos excluyen los pasados', proximosEventos(demo, new Date(2026, 9, 20, 18, 30)).map((e) => e.id).join() === 'demo_e1');
check('próximos incluye el que está en curso', proximosEventos(demo, new Date(2026, 9, 20, 17, 30))[0].id === 'demo_e2');
const multi = normalizaEstado({ eventos: [{ id: 'm', titulo: 'Feria', fecha: '2026-10-20', fechaFin: '2026-10-22', todoElDia: true }] });
check('evento de varios días aparece en cada día', eventosDelDia(multi, '2026-10-21').length === 1 && !eventosDelDia(multi, '2026-10-23').length);

const sig = siguienteRepeticion(LIMPIA.tareas({ titulo: 'Informe', fecha: '2026-10-01', repeticion: 'semanal', subtareas: [{ texto: 'a', hecha: true }] }), '2026-10-20');
const mes31 = LIMPIA.tareas({ titulo: 'Cuota', fecha: '2027-01-31', repeticion: 'mensual' });
const feb = siguienteRepeticion(mes31, '2027-01-31');
const mar = siguienteRepeticion(feb, '2027-02-28');
check('mensual del día 31: 28/02 y vuelve al 31/03', feb.fecha === '2027-02-28' && mar.fecha === '2027-03-31');
check('repetición: la siguiente no cae en el pasado', sig.fecha === '2026-10-22' && sig.estado === 'pendiente' && !sig.subtareas[0].hecha);

check('YouTube: watch, youtu.be y shorts', idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3') === 'dQw4w9WgXcQ' && idYoutube('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && idYoutube('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
check('incrustar: YouTube por nocookie, Vimeo, el resto no', urlIncrustada('https://youtu.be/dQw4w9WgXcQ').startsWith('https://www.youtube-nocookie.com/embed/') && urlIncrustada('https://vimeo.com/123456789').includes('player.vimeo.com') && urlIncrustada('https://www.tiktok.com/@a/video/1') === '');
check('tipo sugerido', tipoSugerido('https://youtu.be/dQw4w9WgXcQ') === 'video' && tipoSugerido('https://x.com/a.pdf') === 'documento');
const conVideo = normalizaEstado({ recursos: [{ id: 'r', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=x', tipo: 'video' }] });
check('duplicado: el mismo vídeo con otra forma de enlace', recursoDuplicado(conVideo, 'https://youtu.be/dQw4w9WgXcQ?si=abc')?.id === 'r');
check('duplicado: www y barra final', recursoDuplicado(normalizaEstado({ recursos: [{ id: 'w', url: 'https://www.ejemplo.com/a/' }] }), 'https://ejemplo.com/a')?.id === 'w');

const ficha = fichaCompartible(demo.inmuebles[0]);
check('ficha para compartir sin datos privados', ficha.includes('195.000') && !ficha.includes('Ficticia') && !ficha.includes('Andrés'));
check('encaje: dentro de presupuesto y zona', encajeInmueble(demo.clientes[0], demo.inmuebles[0]).encaja);
check('encaje: supera el presupuesto', !encajeInmueble({ ...demo.clientes[0], presupuestoMax: 100000 }, demo.inmuebles[0]).encaja);

const papel = normalizaEstado(structuredClone(demo));
papel.inmuebles[0].borrado = '2026-01-01T00:00:00.000Z';
const n = purgaPapelera(papel, new Date('2026-10-20T10:00:00Z'));
check('papelera: se vacía a los 30 días y limpia referencias', n === 1 && !papel.clientes[0].inmuebles.length && papel.eventos[0].inmueble === '');

const mem = new Map();
const almacen = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
guarda(demo, almacen);
check('guardar y cargar devuelve lo mismo', igual(carga(almacen).estado, demo));
check('carga de algo roto no rompe', carga({ getItem: () => '{roto' }).error.length > 0);
const lleno = guarda(demo, { setItem() { const e = new Error('x'); e.name = 'QuotaExceededError'; throw e; } });
check('memoria llena se avisa', !lleno.ok && lleno.error === 'lleno');
const copia = leeCopia(copiaSeguridad(demo));
check('copia de seguridad: se lee y cuenta', copia.ok && copia.cuentas.clientes === 2);
check('copia de otra app se rechaza', !leeCopia('{"datos":{}}').ok && !leeCopia('no json').ok);

console.log('\n💬 Captura rápida');
const ahora = new Date(2026, 9, 20, 9, 0); // martes
const p1 = interpreta('Llamar a Marta mañana a las 10 por el piso de Oviedo', demo, ahora);
check('frase de ejemplo: cita de llamada mañana 10:00', p1.tipo === 'evento' && p1.tipoEvento === 'llamada' && p1.fecha === '2026-10-21' && p1.hora === '10:00');
check('frase de ejemplo: Marta y el piso de Oviedo', p1.clientes[0]?.id === 'demo_c1' && p1.inmuebles[0]?.id === 'demo_i1' && !p1.dudas.length);
check('frase de ejemplo: título sin la fecha', p1.titulo === 'Llamar a Marta por el piso de Oviedo');
const p2 = interpreta('Visita con Andrés el viernes a las 5 de la tarde', demo, ahora);
check('viernes a las 5 de la tarde', p2.fecha === '2026-10-23' && p2.hora === '17:00' && p2.tipoEvento === 'visita');
const p3 = interpreta('Firma en notaría el 25/10 a las 12:30', demo, ahora);
check('25/10 a las 12:30', p3.fecha === '2026-10-25' && p3.hora === '12:30' && p3.tipoEvento === 'firma');
const p4 = interpreta('reunión el 3 de enero a las 9 y media', demo, ahora);
check('3 de enero pasa al año siguiente', p4.fecha === '2027-01-03' && p4.hora === '09:30');
const p5 = interpreta('Llamar a Luis a las 4', demo, ahora);
check('a las 4 sin franja → 16:00 con aviso', p5.hora === '16:00' && p5.dudas.some((d) => d.includes('16:00')) && p5.dudas.some((d) => d.includes('Luis')));
const p6 = interpreta('Comprar tóner', demo, ahora);
check('sin fecha ni hora → tarea sin fecha', p6.tipo === 'tarea' && p6.fecha === '' && p6.hora === '');
const dosMartas = normalizaEstado({ clientes: [{ id: 'a', nombre: 'Marta', apellidos: 'Uno' }, { id: 'b', nombre: 'Marta', apellidos: 'Dos' }] });
check('dos Martas → duda para elegir', interpreta('llamar a Marta hoy', dosMartas, ahora).dudas.some((d) => d.includes('elige')));
check('31/04 no existe', interpreta('cita el 31/04 a las 10', demo, ahora).dudas.some((d) => d.includes('no es una fecha')));
check('«a las 10 de la mañana» no es mañana', (() => { const x = interpreta('Llamar a Marta el viernes a las 10 de la mañana', demo, ahora); return x.fecha === '2026-10-23' && x.hora === '10:00'; })());
check('«por la mañana» tampoco', interpreta('Visita con Marta el jueves por la mañana a las 12', demo, ahora).fecha === '2026-10-22');
check('25 de octubre a las 11 de la mañana', (() => { const x = interpreta('firma el 25 de octubre a las 11 de la mañana', demo, ahora); return x.fecha === '2026-10-25' && x.hora === '11:00'; })());
check('«mañana por la mañana» sí es mañana', interpreta('llamar a Marta mañana por la mañana', demo, ahora).fecha === '2026-10-21');
check('a las 0 y a la una menos cuarto de la tarde', interpreta('cita a las 0', demo, ahora).hora === '00:00' && interpreta('cita a la una menos cuarto de la tarde', demo, ahora).hora === '12:45' && interpreta('cita a las 12 de la noche', demo, ahora).hora === '00:00');
check('hoy es martes y digo el martes → el de la semana que viene', interpreta('ver a Marta el martes', demo, ahora).fecha === '2026-10-27');

console.log('\n🔍 Buscador');
const g = buscaGlobal(demo, 'oviedo');
check('busca en varios grupos', g.some((x) => x.coleccion === 'clientes') && g.some((x) => x.coleccion === 'inmuebles'));
check('todas las palabras y sin tildes', buscaGlobal(demo, 'ANDRES prueba')[0]?.resultados[0]?.id === 'demo_c2' && !buscaGlobal(demo, 'andres oviedo').length);
check('respeta el filtro de grupos', buscaGlobal(demo, 'oviedo', ['tareas']).every((x) => x.coleccion === 'tareas'));

console.log('\n📤 Exportar e importar');
const conFormula = normalizaEstado({ clientes: [{ id: 'f', nombre: '=HYPERLINK("x")', notas: 'a;b\nc' }] });
const textoCsv = csvClientes(conFormula);
check('CSV con BOM y «;»', textoCsv.startsWith('﻿Nombre;'));
check('CSV deja los teléfonos +34 sin apóstrofo', csvClientes(normalizaEstado({ clientes: [{ id: 'p', nombre: 'A', telefono: '+34 600 111 222' }] })).includes(';+34 600 111 222;'));
check('CSV desactiva fórmulas', textoCsv.includes(`"'=HYPERLINK(""x"")"`));
const leido = leeCsv('﻿Nombre;Teléfono;Correo\n"Pérez; Ana";600111222;ana@x.es\n\nLuis;600333444;\n');
check('leeCsv: comillas, «;» dentro y filas vacías', leido.filas.length === 2 && leido.filas[0][0] === 'Pérez; Ana' && leido.separador === ';');
check('leeCsv con comas', leeCsv('name,phone\nAna,1').separador === ',');
const mapeo = proponeMapeo(['Nombre completo', 'Móvil', 'E-mail', 'Observaciones']);
check('propone columnas', mapeo.nombre === 0 && mapeo.telefono === 1 && mapeo.email === 2 && mapeo.notas === 3);
const previa = previaImportacion(demo, [['Marta Ejemplo Ruiz', '600000001', '', ''], ['Ana López', '611', '', ''], ['Pepe Gil', '622333444', '', ''], ['Pepe Gil', '622333444', '', '']], mapeo);
check('previa: duplicado con la agenda', previa[0].duplicados.length && !previa[0].importar);
check('previa: teléfono corto es error', previa[1].errores.length && !previa[1].importar);
check('previa: separa nombre y apellidos', previa[2].cliente.nombre === 'Pepe' && previa[2].cliente.apellidos === 'Gil' && previa[2].importar);
check('previa: duplicado dentro del propio CSV', previa[3].duplicados.length > 0);
const ics = icsEventos(normalizaEstado({ eventos: [{ id: 'e', titulo: 'Visita, piso; 3º', fecha: '2026-10-25', inicio: '10:00', recordatorios: [30] }, { id: 't', titulo: 'Puente', fecha: '2026-12-07', fechaFin: '2026-12-08', todoElDia: true }] }), new Date('2026-10-20T10:00:00Z'));
check('ICS con zona de Madrid', ics.includes('DTSTART;TZID=Europe/Madrid:20261025T100000') && ics.includes('DTEND;TZID=Europe/Madrid:20261025T110000') && ics.includes('BEGIN:VTIMEZONE'));
check('ICS escapa comas y punto y coma', ics.includes('SUMMARY:Visita\\, piso\\; 3º'));
check('ICS: todo el día con fin exclusivo y alarma', ics.includes('DTEND;VALUE=DATE:20261209') && ics.includes('TRIGGER:-PT30M'));
check('ICS: líneas ≤ 75 octetos y CRLF', ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));

console.log('\n📇 Contactos del móvil (.vcf)');
const vcf = [
  'BEGIN:VCARD', 'VERSION:2.1', 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Garc=C3=ADa;Mar=C3=ADa;;;', 'TEL;HOME:985 11 22 33', 'TEL;CELL:+34 655 44 33 22', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:Luis Pérez', 'TEL;TYPE=CELL:600000001', 'EMAIL:luis@x.es', 'NOTE:Fontanero\\, de confianza', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:<script>x</script>', 'END:VCARD',
].join('\r\n');
const lv = leeVcard(vcf);
check('lee vCard 2.1 con tildes en quoted-printable', lv.contactos[0].nombre === 'María' && lv.contactos[0].apellidos === 'García');
check('vCard 3.0: nombre, correo y nota', lv.contactos[1].nombre === 'Luis' && lv.contactos[1].apellidos === 'Pérez' && lv.contactos[1].nota === 'Fontanero, de confianza');
check('sin teléfono ni nombre útil se limpia el HTML', !JSON.stringify(lv.contactos).includes('<script>'));
const cm = clienteDeContacto(lv.contactos[0], 'Agenda del móvil');
check('el móvil va primero (para WhatsApp) y el fijo a notas', cm.telefono === '+34 655 44 33 22' && cm.notas.includes('985 11 22 33') && cm.estado === 'contacto');
const pv = previaClientes(demo, lv.contactos.map((c) => clienteDeContacto(c, 'x')));
check('vista previa: Luis coincide por teléfono con Marta de ejemplo', pv[1].duplicados.some((d) => d.includes('mismo teléfono')) && !pv[1].importar && pv[0].importar);
const muchos = Array.from({ length: 3000 }, (_, i) => ({ nombre: 'C' + i, telefono: String(600000000 + i) }));
const t0 = Date.now();
const pm = previaClientes(demo, muchos);
check('3.000 contactos se revisan en menos de 1 s', Date.now() - t0 < 1000 && pm.length === 3000, `${Date.now() - t0} ms`);
check('los «Solo contacto» no piden seguimiento', !clientesSinSeguimiento(normalizaEstado({ clientes: [{ id: 'k', nombre: 'K', estado: 'contacto', creado: '2020-01-01T00:00:00.000Z' }] })).length);

console.log('\n🔔 Recordatorios');
const rec = normalizaEstado({ eventos: [{ id: 'r', titulo: 'Firma', fecha: '2026-10-20', inicio: '12:00', recordatorios: [30, 1440] }] });
check('un solo aviso por cita aunque venzan dos', recordatoriosPendientes(rec, new Date(2026, 9, 20, 11, 35)).length === 1 && recordatoriosPendientes(rec, new Date(2026, 9, 20, 11, 35))[0].faltan === 25);
check('el del día antes salta solo', recordatoriosPendientes(rec, new Date(2026, 9, 20, 11, 0))[0]?.claves.length === 1);
check('abierta tarde: dice que ya ha empezado', recordatoriosPendientes(rec, new Date(2026, 9, 20, 12, 40))[0].faltan === -40 && cuentaAtras(-40).includes('ya ha empezado') && cuentaAtras(70) === ' · en 1 h 10 min');
check('no se repite', recordatoriosPendientes(rec, new Date(2026, 9, 20, 11, 35), { 'r|2026-10-20|12:00|30': 1, 'r|2026-10-20|12:00|1440': 1 }).length === 0);
check('ni los de la papelera', recordatoriosPendientes({ eventos: [{ ...rec.eventos[0], borrado: 'x' }] }, new Date(2026, 9, 20, 11, 35)).length === 0);
check('activos ignora la papelera', activos([{ borrado: '' }, { borrado: 'x' }]).length === 1);

console.log(`\n${fallados ? '❌' : '✅'} ${pasados} comprobaciones correctas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
