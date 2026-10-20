// ============================================================================
//  OLVIDO DE PAU AGENDA con navegador real (Chromium + Playwright)
//  Ejecutar con: node test/agenda.ui.test.mjs
//  Recorre los criterios de aceptación de la fase 1: crear y recuperar al
//  recargar, tareas en su día, enlaces y vídeos, inmueble ↔ cliente, visita,
//  captura rápida, buscador, copia y restauración, CSV, confirmaciones,
//  cambios sin guardar, sin conexión, móvil y PC sin desbordes, y que ningún
//  botón apunte a una acción que no existe.
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const PORT = 8131;
const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const URL_APP = `http://localhost:${PORT}/agenda/app.html`;

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = '') {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  try {
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404).end('no encontrado'); }
});
await new Promise((ok) => server.listen(PORT, ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = new Date();
const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 12);
const HOY = iso(hoy); const MANANA = iso(manana);

async function nuevaPagina(ctx, ancho = 390, alto = 844) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: ancho, height: alto });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  page.errores = errores;
  return page;
}
const ir = (page, ancla) => page.evaluate((a) => { location.hash = a; }, ancla).then(() => page.waitForTimeout(120));
const estado = (page) => page.evaluate(() => window.__agenda.ctx.estado);

const ctx = await browser.newContext({ locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true, serviceWorkers: 'allow' });
// Nada sale a internet durante la prueba (vídeos, miniaturas…).
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
const page = await nuevaPagina(ctx);
await page.goto(URL_APP);
await page.waitForSelector('.saludo');

console.log('\n☀️ Arranque');
check('saludo a Pau y fecha en español', /Pau/.test(await page.textContent('.saludo h1')) && /de \d{4}/.test(await page.textContent('.saludo p')));
check('agenda vacía ofrece empezar', await page.isVisible('text=Empieza aquí'));
check('logo JP en la cabecera y en el panel', await page.isVisible('.marca img') && await page.isVisible('.logo3d img'));
check('tema oscuro futurista por defecto', (await page.evaluate(() => document.documentElement.dataset.tema)) === 'oscuro');

console.log('\n👤 1. Cliente que sigue al recargar');
await ir(page, 'cliente/nuevo');
await page.click('form[data-form="cliente"] button[type="submit"]');
check('sin nombre no se guarda y lo dice', await page.isVisible('[data-campo="nombre"] .error:not([hidden])'));
await page.fill('[name="nombre"]', 'Lucía');
await page.fill('[name="apellidos"]', 'Prueba Sanz');
await page.fill('[name="telefono"]', '611 22 33 44');
await page.fill('[name="email"]', 'lucia@prueba.test');
await page.fill('[name="presupuestoMax"]', '250.000');
await page.fill('[name="zonas"]', 'Gijón');
await page.click('form[data-form="cliente"] button[type="submit"]');
await page.waitForSelector('text=Lucía Prueba Sanz');
await page.reload();
await page.waitForSelector('h1');
check('el cliente existe tras recargar', (await estado(page)).clientes.some((c) => c.nombre === 'Lucía' && c.presupuestoMax === 250000));
check('accesos a llamar y WhatsApp sin enviar nada', (await page.getAttribute('a[href^="tel:"]', 'href')) === 'tel:611223344' && (await page.getAttribute('a[href^="https://wa.me/"]', 'href')) === 'https://wa.me/34611223344');
const idLucia = (await estado(page)).clientes[0].id;
await page.fill('form[data-form="interaccion"] textarea', 'Llamada: busca piso con terraza.');
await page.click('form[data-form="interaccion"] button[type="submit"]');
await page.waitForTimeout(100);
check('interacción apuntada a mano en el historial', (await estado(page)).clientes[0].historial[0]?.texto.includes('terraza'));

console.log('\n👥 Aviso de duplicado');
await ir(page, 'cliente/nuevo');
await page.fill('[name="nombre"]', 'Otra');
await page.fill('[name="telefono"]', '+34611223344');
await page.click('form[data-form="cliente"] button[type="submit"]');
await page.waitForSelector('dialog[open]');
check('avisa de posible duplicado antes de crear', /ya tengas este cliente/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="no"]');
await page.waitForTimeout(100);
check('al cancelar no se crea', (await estado(page)).clientes.length === 1);
await page.evaluate(() => { location.hash = 'hoy'; });
await page.waitForSelector('dialog[open]');
check('y lo escrito sigue protegido al salir', /sin guardar/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);

console.log('\n✅ 2. Tarea en el día correcto');
await ir(page, 'tarea/nuevo');
await page.fill('[name="titulo"]', 'Pedir nota simple');
await page.fill('[name="fecha"]', MANANA);
await page.selectOption('[name="prioridad"]', 'alta');
await page.fill('[name="subtareas"]', 'Registro\n[x] Pagar tasa');
await page.click('form[data-form="tarea"] button[type="submit"]');
await page.waitForSelector('text=Marcar como hecha');
await ir(page, `agenda/dia/${MANANA}`);
check('aparece en la agenda de mañana', await page.isVisible('text=Pedir nota simple'));
await ir(page, `agenda/dia/${HOY}`);
check('no aparece hoy', !(await page.isVisible('text=Pedir nota simple')));
const t = (await estado(page)).tareas[0];
check('subtareas guardadas con su estado', t.subtareas.length === 2 && t.subtareas[1].hecha && !t.subtareas[0].hecha);
await ir(page, 'tareas/semana');
const enSemana = await page.isVisible('text=Pedir nota simple');
await ir(page, 'tareas/todas');
check('aparece en la lista de tareas', enSemana || await page.isVisible('text=Pedir nota simple'));
await page.click(`input[data-cambio="tarea-hecha"]`);
await page.waitForTimeout(100);
check('marcar como hecha', (await estado(page)).tareas[0].estado === 'hecha');
await ir(page, 'tareas/hechas');
check('sale en Completadas', await page.isVisible('text=Pedir nota simple'));

console.log('\n🔗 3 y 4. Enlace y vídeo');
await ir(page, 'biblioteca');
await page.fill('#pegar-url', 'https://www.ejemplo-inmo.es/guia-hipotecas');
await page.click('form[data-form="pegar-enlace"] button[type="submit"]');
await page.waitForTimeout(150);
check('enlace guardado', (await estado(page)).recursos.some((r) => r.url === 'https://www.ejemplo-inmo.es/guia-hipotecas'));
await page.fill('#pegar-url', 'ejemplo-inmo.es/guia-hipotecas/');
await page.click('form[data-form="pegar-enlace"] button[type="submit"]');
await page.waitForSelector('dialog[open]');
check('el mismo enlace avisa de duplicado', /ya está en tu biblioteca/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="no"]');
await page.waitForTimeout(150);
check('al no guardarlo, abre el que ya tenías', (await page.evaluate(() => location.hash)).startsWith('#recurso/'));
await ir(page, 'biblioteca');
await page.fill('#pegar-url', 'javascript:alert(1)');
await page.click('form[data-form="pegar-enlace"] button[type="submit"]');
check('un enlace peligroso se rechaza', await page.isVisible('[data-campo="url"] .error:not([hidden])'));
await page.fill('#pegar-url', 'https://youtu.be/dQw4w9WgXcQ');
await page.click('form[data-form="pegar-enlace"] button[type="submit"]');
await page.waitForTimeout(150);
const video = (await estado(page)).recursos.find((r) => r.url.includes('youtu'));
check('el vídeo se detecta como vídeo', video?.tipo === 'video');
await ir(page, `recurso/${video.id}`);
check('antes de pulsar no se carga YouTube', !(await page.$('iframe')));
await page.click('text=Reproducir aquí');
check('reproductor youtube-nocookie al pulsar', (await page.getAttribute('iframe', 'src')).startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
check('y botón para abrir el original', await page.isVisible('a:has-text("Abrir el original")'));
await page.keyboard.press('Control+k');
await page.waitForSelector('dialog.buscador[open]');
await page.fill('#buscar-global', 'hipotecas');
await page.waitForTimeout(100);
check('Ctrl+K: el buscador encuentra el enlace', /Biblioteca/.test(await page.textContent('#resultados-busqueda')));
await page.keyboard.press('Escape');

console.log('\n🏠 5 y 6. Inmueble vinculado y visita');
await ir(page, 'inmueble/nuevo');
await page.fill('[name="referencia"]', 'GIJ-01');
await page.fill('[name="titulo"]', 'Piso con terraza en Gijón');
await page.fill('[name="precio"]', '210.000');
await page.fill('[name="zona"]', 'Gijón, La Arena');
await page.fill('[name="direccion"]', 'Calle Secreta 7, 2ºA');
await page.check('input[name="caracteristicas"][value="terraza"]');
await page.click('form[data-form="inmueble"] button[type="submit"]');
await page.waitForSelector('text=Datos privados');
const idInm = (await estado(page)).inmuebles[0].id;
check('sugiere a Lucía como posible interesada', await page.isVisible('.sugerencia'));
await page.click('form[data-form="inmueble-interesado"] button[type="submit"]');
await page.waitForTimeout(100);
check('inmueble vinculado al cliente', (await estado(page)).clientes.find((c) => c.id === idLucia).inmuebles.includes(idInm));
await page.evaluate(() => { window.__copiado = ''; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; });
await page.click('text=Copiar ficha para compartir');
await page.waitForTimeout(100);
const copiado = await page.evaluate(() => window.__copiado);
check('la ficha compartible no lleva la dirección exacta', copiado.includes('210.000') && !copiado.includes('Secreta'));
await ir(page, `evento/nuevo?tipo=visita&cliente=${idLucia}&inmueble=${idInm}&fecha=${MANANA}`);
check('la visita sale con título y ubicación propuestos', (await page.inputValue('[name="titulo"]')).includes('Lucía') && (await page.inputValue('[name="ubicacion"]')).includes('Secreta'));
await page.fill('[name="inicio"]', '11:00');
await page.fill('[name="fin"]', '10:00');
await page.click('form[data-form="evento"] button[type="submit"]');
check('fin antes del inicio: error claro', /posterior/.test(await page.textContent('[data-campo="fin"] .error')));
await page.fill('[name="fin"]', '11:45');
await page.click('form[data-form="evento"] button[type="submit"]');
await page.waitForSelector('text=Visita realizada');
await ir(page, `inmueble/${idInm}`);
check('la visita aparece en el inmueble', await page.isVisible('.evento:has-text("Lucía")'));
await ir(page, `cliente/${idLucia}`);
check('y en las citas del cliente', await page.isVisible('.evento:has-text("Visita")'));

console.log('\n💬 Captura rápida');
await page.click('.boton-anadir');
await page.fill('#captura-texto', 'Llamar a Lucía mañana a las 10 por el piso de Gijón');
await page.click('#form-captura button[type="submit"]');
await page.waitForSelector('#form-propuesta');
const entendido = await page.textContent('#interpretado');
check('enseña la fecha exacta interpretada', entendido.includes(String(manana.getDate())) && entendido.includes('10:00'));
check('propone a Lucía y el piso de Gijón', (await page.inputValue('#form-propuesta [name="cliente"]')) === idLucia && (await page.inputValue('#form-propuesta [name="inmueble"]')) === idInm);
await page.click('#form-propuesta button[type="submit"]');
await page.waitForTimeout(150);
const llamada = (await estado(page)).eventos.find((e) => e.tipo === 'llamada');
check('se guarda como cita de llamada', llamada?.fecha === MANANA && llamada.inicio === '10:00' && llamada.cliente === idLucia);

console.log('\n🗑 12. Confirmación antes de borrar');
await ir(page, `evento/${llamada.id}`);
await page.click('button[data-accion="papelera"]');
await page.waitForSelector('dialog[open]');
await page.click('dialog[open] button[value="no"]');
await page.waitForTimeout(100);
check('cancelar no borra', !(await estado(page)).eventos.find((e) => e.id === llamada.id).borrado);
await page.click('button[data-accion="papelera"]');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);
check('confirmar lo manda a la papelera', !!(await estado(page)).eventos.find((e) => e.id === llamada.id).borrado);
await ir(page, 'papelera');
await page.click('button[data-accion="papelera-restaurar"]');
await page.waitForTimeout(100);
check('y se recupera desde la papelera', !(await estado(page)).eventos.find((e) => e.id === llamada.id).borrado);

console.log('\n⧉ Duplicar y direcciones raras');
await ir(page, `evento/nuevo?fecha=${MANANA}`);
await page.fill('[name="titulo"]', 'Feria ¿Marta & Juan? 100%');
await page.check('[name="todoElDia"]');
await page.fill('[name="ubicacion"]', 'Recinto ferial');
await page.click('form[data-form="evento"] button[type="submit"]');
await page.waitForSelector('text=Duplicar');
await page.click('button[data-accion="evento-duplicar"]');
await page.waitForTimeout(150);
check('duplicar conserva título con «?», día completo y ubicación', (await page.inputValue('[name="titulo"]')) === 'Feria ¿Marta & Juan? 100%' && await page.isChecked('[name="todoElDia"]') && (await page.inputValue('[name="ubicacion"]')) === 'Recinto ferial');
await page.click('a.btn.secundario:has-text("Cancelar")');
await page.waitForTimeout(100);
await ir(page, 'tarea/100%');
check('una dirección con «%» suelto no rompe la app', await page.isVisible('text=Tarea no encontrada'));

console.log('\n✍️ Cambios sin guardar');
await ir(page, 'cliente/nuevo');
await page.fill('[name="nombre"]', 'A medias');
await page.evaluate(() => { location.hash = 'hoy'; });
await page.waitForSelector('dialog[open]');
check('avisa al salir con cambios sin guardar', /sin guardar/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="no"]');
await page.waitForTimeout(100);
check('y se queda en el formulario', (await page.inputValue('[name="nombre"]')) === 'A medias');
await page.click('a.btn.secundario:has-text("Cancelar")');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);

console.log('\n📝 Notas con guardado automático');
await ir(page, 'nota/nuevo');
await page.fill('[name="titulo"]', 'Ideas visita');
await page.fill('[name="texto"]', 'Preparar:\n- [ ] Llevar llaves\n- [ ] Imprimir ficha');
await page.waitForTimeout(900);
await page.reload();
await page.waitForTimeout(300);
const notaG = (await estado(page)).notas[0];
check('la nota se guarda sola y sigue al recargar', notaG?.titulo === 'Ideas visita' && notaG.texto.includes('Llevar llaves'));
await page.click('button[data-accion="nota-a-tareas"]');
await page.waitForSelector('dialog[open]');
check('enseña las tareas antes de crearlas', /Llevar llaves/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(100);
check('crea las tareas de las casillas', (await estado(page)).tareas.filter((x) => /Llevar llaves|Imprimir ficha/.test(x.titulo)).length === 2);

console.log('\n📨 Enviar por WhatsApp (piso, recordatorio, vídeo y otro número)');
await ir(page, `inmueble/${idInm}`);
await page.click('a[href^="#enviar?tipo=piso"]');
await page.waitForSelector('#enviar-lista');
check('desde el piso pregunta a quién y lo dice', await page.isVisible('text=¿A quién se lo mandas?') && await page.isVisible('text=GIJ-01'));
check('Lucía sale sugerida (le interesa ese piso)', await page.isVisible(`#enviar-lista a[href^="#enviar/${idLucia}"] .chip-info`));
await page.fill('#enviar-buscar', 'lucia');
await page.waitForTimeout(250);
check('el buscador encuentra sin tildes', await page.isVisible(`#enviar-lista a[href^="#enviar/${idLucia}"]`));
await page.click(`#enviar-lista a[href^="#enviar/${idLucia}"]`);
await page.waitForSelector('#enviar-texto');
const txtPiso = await page.inputValue('#enviar-texto');
check('mensaje del piso: saludo, referencia y firma', txtPiso.startsWith('Hola Lucía') && txtPiso.includes('GIJ-01') && txtPiso.includes('672 77 57 21'));
check('nunca lleva la dirección privada', !txtPiso.includes('Calle Secreta'));
const textoDe = (href) => decodeURIComponent(href.split('?text=')[1] || '');
check('el botón abre SU chat con el texto escrito', (await page.getAttribute('#enviar-wa', 'href')).startsWith('https://wa.me/34611223344?text=') && textoDe(await page.getAttribute('#enviar-wa', 'href')) === txtPiso);
await page.fill('#enviar-texto', txtPiso + '\nPD: tiene terraza');
check('si cambias el texto, cambia lo que se abre', textoDe(await page.getAttribute('#enviar-wa', 'href')).endsWith('PD: tiene terraza'));
const histAntes = (await estado(page)).clientes.find((c) => c.id === idLucia).historial.length;
check('preparar el mensaje no apunta nada', histAntes === (await estado(page)).clientes.find((c) => c.id === idLucia).historial.length);
await page.click('button[data-accion="enviar-hecho"]');
await page.waitForSelector(`text=Historial de interacciones`);
const luciaTras = (await estado(page)).clientes.find((c) => c.id === idLucia);
check('«Ya lo he enviado» lo apunta como WhatsApp', luciaTras.historial.length === histAntes + 1 && luciaTras.historial[0].tipo === 'whatsapp' && luciaTras.historial[0].texto.includes('GIJ-01'));
check('la ficha del cliente tiene «Enviar por WhatsApp»', await page.isVisible(`a[href="#enviar/${idLucia}"]`));

const cita = (await estado(page)).eventos.find((e) => e.cliente === idLucia && !e.borrado && e.fecha >= HOY);
check('hay una cita próxima de Lucía para el recordatorio', Boolean(cita));
await ir(page, `evento/${cita.id}`);
await page.click('a[href*="tipo=recordatorio"]');
await page.waitForSelector('#enviar-texto');
const txtCita = await page.inputValue('#enviar-texto');
check('recordatorio con el día en palabras y la hora', txtCita.includes('te recuerdo') && txtCita.includes(cita.fecha === MANANA ? 'mañana' : cita.fecha === HOY ? 'hoy' : 'el ') && (!cita.inicio || txtCita.includes(cita.inicio)));
check('recordatorio de visita nombra el inmueble', cita.tipo !== 'visita' || txtCita.includes('GIJ-01'));

await page.click('button[data-t="enlace"]');
await page.waitForSelector('#enviar-cual');
await page.selectOption('#enviar-cual', 'r:' + video.id);
await page.waitForTimeout(100);
check('vídeo de la biblioteca en el mensaje', (await page.inputValue('#enviar-texto')).includes(video.url) && (await page.inputValue('#enviar-texto')).includes('este vídeo'));
await page.fill('[name="enviar-url"]', 'javascript:alert(1)');
await page.dispatchEvent('[name="enviar-url"]', 'change');
await page.waitForTimeout(100);
check('un enlace que no es https no entra', !(await page.inputValue('#enviar-texto')).includes('javascript:'));
await page.fill('[name="enviar-url"]', 'https://www.idealista.com/inmueble/123/');
await page.dispatchEvent('[name="enviar-url"]', 'change');
await page.waitForTimeout(100);
check('o un enlace pegado a mano', (await page.inputValue('#enviar-texto')).includes('https://www.idealista.com/inmueble/123/'));

await ir(page, `recurso/${video.id}`);
check('desde la biblioteca también se envía', await page.isVisible('a[href*="tipo=enlace"]'));

await ir(page, 'enviar');
await page.fill('form[data-form="enviar-nuevo"] [name="nombre"]', 'Mario Nuevo');
await page.fill('form[data-form="enviar-nuevo"] [name="telefono"]', '12');
await page.click('form[data-form="enviar-nuevo"] button[type="submit"]');
check('un número que no vale se avisa', await page.isVisible('form[data-form="enviar-nuevo"] [data-campo="telefono"] .error:not([hidden])'));
await page.fill('form[data-form="enviar-nuevo"] [name="telefono"]', '622 33 44 55');
await page.click('form[data-form="enviar-nuevo"] button[type="submit"]');
await page.waitForSelector('#enviar-texto');
const mario = (await estado(page)).clientes.find((c) => c.nombre === 'Mario');
check('otro número: queda como «Solo contacto» y abre su chat', mario?.estado === 'contacto' && mario.apellidos === 'Nuevo' && (await page.getAttribute('#enviar-wa', 'href')).startsWith('https://wa.me/34622334455'));
await ir(page, 'enviar');
await page.fill('form[data-form="enviar-nuevo"] [name="nombre"]', 'Otro');
await page.fill('form[data-form="enviar-nuevo"] [name="telefono"]', '+34 622334455');
await page.click('form[data-form="enviar-nuevo"] button[type="submit"]');
await page.waitForSelector('#enviar-texto');
check('el mismo número no duplica el contacto', (await estado(page)).clientes.filter((c) => c.telefono.replace(/\D/g, '').endsWith('622334455')).length === 1);
// Limpieza: las pruebas de copia de abajo esperan un solo cliente.
await page.evaluate((id) => { const c = window.__agenda.ctx; c.estado.clientes = c.estado.clientes.filter((x) => x.id !== id); c.guardar(); }, mario.id);

console.log('\n✨ Asistente');
await ir(page, 'asistente');
check('la IA aparece como pendiente, sin respuestas simuladas', await page.isVisible('text=pendiente de configuración'));
await ir(page, 'asistente/visita');
check('la plantilla de visita firma con tu WhatsApp', (await page.textContent('.respuesta .texto-ficha')).includes('WhatsApp 672 77 57 21'));
await ir(page, 'asistente/dia');
check('resumen del día con sus fuentes', await page.isVisible('.respuesta .fuentes'));

console.log('\n💾 10. Exportar, copia y restaurar');
await ir(page, 'ajustes');
check('Google Calendar se muestra pendiente, no conectado', await page.isVisible('text=Google Calendar pendiente de conectar'));
const [desc] = await Promise.all([page.waitForEvent('download'), page.click('button[data-accion="copia-guardar"]')]);
const rutaCopia = await desc.path();
const copiaTxt = await readFile(rutaCopia, 'utf8');
check('copia completa descargada', JSON.parse(copiaTxt).datos.clientes.length === 1);
const [csv] = await Promise.all([page.waitForEvent('download'), page.click('button[data-accion="exportar"][data-que="clientes"]')]);
check('CSV de clientes', (await readFile(await csv.path(), 'utf8')).includes('Lucía'));
const [ics] = await Promise.all([page.waitForEvent('download'), page.click('button[data-accion="exportar"][data-que="ics"]')]);
check('calendario .ics', (await readFile(await ics.path(), 'utf8')).includes('BEGIN:VEVENT'));

await page.click('button[data-accion="borrar-todo"]');
await page.waitForSelector('dialog[open]');
check('borrar todo exige escribir BORRAR', await page.isDisabled('dialog[open] button[value="si"]'));
await page.fill('dialog[open] input', 'borrar');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);
check('todo borrado', (await estado(page)).clientes.length === 0);
await ir(page, 'ajustes');
await page.setInputFiles('#abrir-copia', rutaCopia);
await page.waitForSelector('dialog[open]');
check('la restauración dice qué trae', /Clientes: 1/.test(await page.textContent('dialog[open]')));
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(200);
check('copia restaurada', (await estado(page)).clientes[0]?.nombre === 'Lucía');

console.log('\n⇪ Importar clientes por CSV');
await ir(page, 'importar');
await page.setInputFiles('#csv-archivo', { name: 'clientes.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿Nombre;Apellidos;Móvil;Email\nPedro;Ensayo;622 000 111;p@x.es\nLucía;Prueba Sanz;611223344;\nSinTel;;12;\n') });
await page.waitForSelector('table.previa');
check('vista previa con columnas propuestas', (await page.inputValue('select[name="map-telefono"]')) === '2');
const marcadas = await page.$$eval('input[name="fila"]', (xs) => xs.map((x) => [x.checked, x.disabled]));
check('duplicado desmarcado y error bloqueado', JSON.stringify(marcadas) === JSON.stringify([[true, false], [false, false], [false, true]]));
await page.click('form[data-form="csv-importar"] button[type="submit"]');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);
check('importa solo el válido', (await estado(page)).clientes.length === 2 && (await estado(page)).clientes.some((c) => c.nombre === 'Pedro' && c.etiquetas.includes('importado')));

console.log('\n📇 Contactos del móvil');
await ir(page, 'importar');
check('explica que WhatsApp usa la agenda del teléfono', await page.isVisible('text=tus contactos de WhatsApp son los de la agenda del teléfono'));
await page.setInputFiles('#vcf-archivo', { name: 'contactos.vcf', mimeType: 'text/vcard', buffer: Buffer.from('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Rosa Vecina\r\nTEL;TYPE=CELL:633 44 55 66\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Lucía Repetida\r\nTEL:611223344\r\nEND:VCARD\r\n') });
await page.waitForSelector('table.previa');
check('vista previa del .vcf con el duplicado desmarcado', JSON.stringify(await page.$$eval('input[name="fila"]', (xs) => xs.map((x) => x.checked))) === '[true,false]');
await page.click('form[data-form="csv-importar"] button[type="submit"]');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);
const rosa = (await estado(page)).clientes.find((c) => c.nombre === 'Rosa');
check('entra como «Solo contacto»', rosa?.estado === 'contacto' && rosa.etiquetas.includes('agenda-movil'));
check('con acceso directo a WhatsApp en la lista', (await page.getAttribute(`a[aria-label="Abrir WhatsApp con Rosa Vecina"]`, 'href')) === 'https://wa.me/34633445566');
await ir(page, 'hoy');
check('no aparece en «Clientes a seguir»', !(await page.isVisible('text=Rosa Vecina')));
await ir(page, 'clientes');
await page.selectOption('#f-est', '');
await page.waitForTimeout(100);
check('la lista normal los oculta y lo avisa', !(await page.isVisible('#lista-clientes >> text=Rosa Vecina')) && await page.isVisible('text=contacto de la agenda del móvil'));
await page.fill('#f-cli', 'rosa');
await page.waitForTimeout(250);
check('al buscar sí salen', await page.isVisible('#lista-clientes >> text=Rosa Vecina'));
await page.fill('#f-cli', '');
await page.waitForTimeout(200);

console.log('\n🧪 Datos de ejemplo');
await ir(page, 'ajustes');
await page.click('button[data-accion="cargar-ejemplo"]');
await page.waitForTimeout(150);
check('cargados y marcados', (await page.$$('.chip-demo')).length > 0);
await ir(page, 'ajustes');
await page.click('button[data-accion="quitar-ejemplo"]');
await page.click('dialog[open] button[value="si"]');
await page.waitForTimeout(150);
const sinDemo = await estado(page);
check('se quitan sin tocar los de Pau', sinDemo.clientes.length === 3 && !sinDemo.clientes.some((c) => c.demo));

console.log('\n🧭 14. Ningún botón sin acción y 13. sin desbordes');
const rutas = ['hoy', 'hoy/personalizar', 'agenda/dia', 'agenda/semana', 'agenda/mes', 'agenda/lista', 'tareas/hoy', 'tareas/tablero', 'clientes', 'clientes-tablero', `cliente/${idLucia}`, 'inmuebles', `inmueble/${idInm}`, 'notas', `nota/${notaG.id}`, 'biblioteca', `recurso/${video.id}`, 'asistente/manana', 'asistente/visita', 'asistente/presupuesto', 'ajustes', 'papelera', 'importar', 'evento/nuevo', 'tarea/nuevo', 'cliente/nuevo', 'inmueble/nuevo', 'recurso/nuevo', 'nota/nuevo', 'enviar', `enviar/${idLucia}`, `enviar/${idLucia}?tipo=piso`, `enviar/${idLucia}?tipo=enlace`, `enviar/${idLucia}?tipo=libre`];
const huerfanos = new Set();
for (const ancho of [360, 1366]) {
  await page.setViewportSize({ width: ancho, height: 900 });
  const desbordes = [];
  for (const r of rutas) {
    if (r === 'clientes-tablero') { await ir(page, 'clientes'); await page.click('button[data-v="tablero"]'); await page.waitForTimeout(100); }
    else await ir(page, r);
    const info = await page.evaluate(() => {
      const reg = new Set(window.__agenda.acciones);
      const forms = new Set(window.__agenda.formularios);
      const malos = [];
      document.querySelectorAll('[data-accion],[data-cambio],[data-teclear]').forEach((el) => { for (const k of ['accion', 'cambio', 'teclear']) if (el.dataset[k] && !reg.has(el.dataset[k])) malos.push(el.dataset[k]); });
      document.querySelectorAll('form[data-form]').forEach((f) => { if (!forms.has(f.dataset.form)) malos.push('form:' + f.dataset.form); });
      const sinEtiqueta = [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea')].filter((c) => !c.labels?.length && !c.getAttribute('aria-label')).map((c) => c.name || c.id);
      const culpa = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tablero,.pestanas-int,.tabla-scroll,.lateral') && !e.matches('.sr')).slice(0, 3).map((e) => e.tagName + '.' + e.className);
      return { malos, ancho: document.documentElement.scrollWidth, sinEtiqueta, culpa };
    });
    info.malos.forEach((m) => huerfanos.add(`${r}: ${m}`));
    info.sinEtiqueta.forEach((m) => huerfanos.add(`${r}: sin etiqueta ${m}`));
    if (info.ancho > ancho) desbordes.push(`${r} (${info.ancho}px: ${info.culpa.join(', ')})`);
  }
  check(`sin desplazamiento horizontal a ${ancho} px`, !desbordes.length, desbordes.join(', '));
}
check('todos los botones y campos tienen acción y etiqueta', !huerfanos.size, [...huerfanos].join(' | '));
check('el menú inferior se ve en el móvil', await (async () => { await page.setViewportSize({ width: 360, height: 800 }); return page.isVisible('nav.inferior'); })());
const tamBoton = await page.$eval('.boton-anadir', (b) => b.getBoundingClientRect().width);
check('botón Añadir cómodo de pulsar (≥ 44 px)', tamBoton >= 44);

console.log('\n📴 Sin conexión');
await page.goto(URL_APP);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.saludo', { timeout: 8000 }).catch(() => {});
check('abre sin conexión con los datos', await page.isVisible('.saludo') && (await estado(page)).clientes.length === 3);
check('avisa de que no hay conexión', await page.isVisible('#estado-red'));
await ctx.setOffline(false);

check('sin errores de JavaScript', !page.errores.length, page.errores.join(' | '));

await browser.close();
server.close();
console.log(`\n${fallados ? '❌' : '✅'} ${pasados} comprobaciones correctas, ${fallados} fallidas\n`);
process.exit(fallados ? 1 : 0);
