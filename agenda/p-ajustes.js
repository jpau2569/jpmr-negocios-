/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — ajustes, datos, papelera e importación
   · Dónde se guarda todo y cuánto ocupa.
   · Copia de seguridad COMPLETA (.json) y su restauración, que enseña
     qué trae antes de sustituir nada.
   · Exportaciones (CSV, .ics): sirven para Excel o el calendario, pero
     NO son una copia recuperable.
   · Importar clientes desde CSV con columnas, vista previa y duplicados.
   · Estado real de las conexiones (Google Calendar, cuenta, IA): hoy
     ninguna está conectada y así se dice.
   ═══════════════════════════════════════════════════════════════════ */

import { AJUSTES_BASE, COLECCIONES, copiaSeguridad, datosEjemplo, DIAS_PAPELERA, estadoVacio, leeCopia, nombreCliente, nombreInmueble, quitaReferencias, tamanoKb } from './datos.js';
import { CAMPOS_IMPORTABLES, csvClientes, csvInmuebles, csvTareas, icsEventos, leeCsv, previaImportacion, proponeMapeo } from './exportar.js';
import { aplicaTema, cabecera, campo, confirma, descarga, h, selector, vacio } from './ui.js';
import { aISO, fechaCorta } from './utiles.js';

const NOMBRES = { clientes: 'Clientes', inmuebles: 'Inmuebles', eventos: 'Citas', tareas: 'Tareas', notas: 'Notas', recursos: 'Recursos' };
const TITULO_DE = { clientes: nombreCliente, inmuebles: nombreInmueble, eventos: (r) => r.titulo, tareas: (r) => r.titulo, notas: (r) => r.titulo || r.texto.slice(0, 50) || 'Nota', recursos: (r) => r.titulo || r.url };

function ajustes(ctx) {
  const e = ctx.estado;
  const aj = e.ajustes;
  const kb = tamanoKb(e);
  const hayDemo = COLECCIONES.some((c) => e[c].some((r) => r.demo));
  const enPapelera = COLECCIONES.reduce((n, c) => n + e[c].filter((r) => r.borrado).length, 0);
  const permiso = 'Notification' in window ? Notification.permission : 'no-disponible';
  return `${cabecera('Ajustes y datos')}
  <form class="tarjeta ficha" data-form="ajustes" novalidate>
    <h2>👤 Preferencias</h2>
    <div class="dos-col">
      ${campo('nombre', 'Tu nombre (para el saludo)', aj.nombre, { maxlength: 40 })}
      ${selector('tema', 'Tema', aj.tema, { auto: 'Como el sistema', claro: 'Claro', oscuro: 'Oscuro' })}
      ${campo('diasSinSeguimiento', 'Avisar de clientes sin contacto tras (días)', aj.diasSinSeguimiento, { tipo: 'number', min: 1, max: 90 })}
    </div>
    <p class="detalle" style="color:var(--suave);font-size:.85rem">Fechas DD/MM/AAAA, 24 horas y euros. La hora es la de este aparato (Europe/Madrid si el móvil está en España).</p>
    <div class="fila-botones"><button class="btn primario" type="submit">Guardar preferencias</button><a class="btn" href="#hoy/personalizar">Ordenar el panel Mi día</a></div>
  </form>

  <section class="tarjeta"><h2>💾 Dónde están tus datos</h2>
    <p>Todo se guarda <strong>solo en este navegador de este aparato</strong> (${kb} KB de unos 5.000 KB disponibles). No hay cuenta ni servidor: nadie más puede verlos, pero <strong>tampoco se sincronizan</strong> con tu otro móvil u ordenador.</p>
    <p class="nota-atencion"><strong>Ojo:</strong> si borras los datos del navegador, usas modo incógnito o pierdes el móvil, se pierden. Guarda una copia de vez en cuando${aj.ultimaCopia ? ` (la última: ${h(fechaCorta(aj.ultimaCopia.slice(0, 10)))})` : ' (aún no has guardado ninguna)'}.</p>
    <div class="fila-botones">
      <button class="btn primario" data-accion="copia-guardar">⬇ Guardar copia completa (.json)</button>
      <label class="btn" for="abrir-copia">⬆ Restaurar una copia</label><input id="abrir-copia" type="file" accept=".json,application/json" class="sr" data-cambio="copia-abrir" />
    </div>
    <p class="detalle" style="color:var(--suave);font-size:.85rem">Para pasar tus datos a otro aparato: guarda la copia aquí, mándatela (correo, Drive…) y en el otro aparato pulsa «Restaurar una copia».</p>
  </section>

  <section class="tarjeta"><h2>📤 Exportar e importar</h2>
    <p class="detalle" style="color:var(--suave)">Para abrir en Excel o en tu calendario. <strong>No son una copia completa</strong>: para recuperar la agenda usa la copia .json.</p>
    <div class="fila-botones">
      <button class="btn" data-accion="exportar" data-que="clientes">Clientes (CSV)</button>
      <button class="btn" data-accion="exportar" data-que="tareas">Tareas (CSV)</button>
      <button class="btn" data-accion="exportar" data-que="inmuebles">Inmuebles (CSV)</button>
      <button class="btn" data-accion="exportar" data-que="ics">Calendario (.ics)</button>
      <a class="btn" href="#importar">⇪ Importar clientes (CSV)</a>
    </div>
  </section>

  <section class="tarjeta"><h2>🔔 Avisos</h2>
    <ul>
      <li><strong>Dentro de la app:</strong> franja arriba a la hora del recordatorio. Funciona sin permisos, pero solo con la app abierta.</li>
      <li><strong>Notificaciones del navegador:</strong> ${permiso === 'granted' ? (aj.avisosNavegador ? 'activadas' : 'permitidas pero apagadas') : permiso === 'denied' ? 'bloqueadas en el navegador (cámbialo en los permisos del sitio)' : permiso === 'no-disponible' ? 'este navegador no las admite' : 'sin activar'}. También necesitan la app abierta o en segundo plano: sin un servidor de avisos, una web no puede despertar al móvil.</li>
      <li><strong>Calendario del móvil:</strong> en cada cita, «Añadir a mi calendario (.ics)». Ese aviso sí suena con la app cerrada. Con Google Calendar conectado (fase 2) será automático.</li>
    </ul>
    <div class="fila-botones">${permiso === 'no-disponible' ? '' : aj.avisosNavegador && permiso === 'granted'
      ? '<button class="btn" data-accion="avisos" data-v="no">Apagar notificaciones</button>'
      : permiso === 'denied' ? '' : '<button class="btn primario" data-accion="avisos" data-v="si">Activar notificaciones</button>'}</div>
  </section>

  <section class="tarjeta"><h2>🔌 Conexiones</h2>
    <p class="estado-conexion"><span class="punto" style="background:var(--atencion)"></span> Google Calendar pendiente de conectar</p>
    <p class="detalle" style="color:var(--suave)">Falta la fase 2: un servidor que guarde el permiso de Google de forma segura (nunca en el navegador), un proyecto en Google Cloud con la API de Calendar y su pantalla de consentimiento, y tu cuenta de usuario. Los pasos están en <code>agenda/README.md</code>. Hasta entonces la agenda interna funciona entera, y puedes llevar citas a tu calendario con los archivos .ics.</p>
    <p class="estado-conexion"><span class="punto" style="background:var(--atencion)"></span> Cuenta y sincronización entre aparatos: no configuradas</p>
    <p class="estado-conexion"><span class="punto" style="background:var(--atencion)"></span> Asistente con IA: pendiente (fase 3)</p>
  </section>

  <section class="tarjeta"><h2>🧪 Datos de ejemplo</h2>
    <p class="detalle" style="color:var(--suave)">Son ficticios, van marcados como EJEMPLO y no se mezclan con los tuyos al quitarlos.</p>
    <div class="fila-botones">${hayDemo ? '<button class="btn" data-accion="quitar-ejemplo">Quitar los datos de ejemplo</button>' : '<button class="btn" data-accion="cargar-ejemplo">Cargar datos de ejemplo</button>'}</div>
  </section>

  <section class="tarjeta"><h2>🗑 Papelera y borrado</h2>
    <p>${enPapelera} elemento${enPapelera === 1 ? '' : 's'} en la papelera. Se vacía sola a los ${DIAS_PAPELERA} días.</p>
    <div class="fila-botones"><a class="btn" href="#papelera">Abrir la papelera</a><button class="btn peligro" data-accion="borrar-todo">Borrar todos mis datos</button></div>
  </section>
  <p class="detalle" style="color:var(--suave);text-align:center;font-size:.82rem">OLVIDO DE PAU AGENDA · fase 1 · datos en este aparato</p>`;
}

function papelera(ctx) {
  const filas = COLECCIONES.flatMap((c) => ctx.estado[c].filter((r) => r.borrado).map((r) => ({ c, r }))).sort((a, b) => b.r.borrado.localeCompare(a.r.borrado));
  return `${cabecera('Papelera', filas.length ? '<button class="btn peligro" data-accion="papelera-vaciar">Vaciar</button>' : '', 'ajustes')}
    <section class="tarjeta">${filas.length ? `<ul class="lista">${filas.map(({ c, r }) => `<li class="elemento"><span class="cuerpo"><span class="titulo">${h(TITULO_DE[c](r))}</span><br><span class="detalle">${NOMBRES[c]} · borrado el ${h(fechaCorta(r.borrado.slice(0, 10)))}</span></span>
      <button class="btn pequeno" data-accion="papelera-restaurar" data-c="${c}" data-id="${h(r.id)}">Recuperar</button>
      <button class="btn pequeno peligro" data-accion="papelera-borrar" data-c="${c}" data-id="${h(r.id)}" aria-label="Borrar definitivamente ${h(TITULO_DE[c](r))}">Borrar</button></li>`).join('')}</ul>` : vacio('🗑', 'La papelera está vacía.')}</section>`;
}

/* ───────────── importar clientes desde CSV ───────────── */

let importacion = null; // { nombre, cabecera, filas, mapeo }

function importar(ctx) {
  if (!importacion) {
    return `${cabecera('Importar clientes', '', 'clientes')}<section class="tarjeta">
      <p>Elige un archivo CSV (de Excel, Google Contactos, tu CRM…). Primero verás cómo quedaría; no se guarda nada hasta que confirmes.</p>
      <label class="btn primario" for="csv-archivo">Elegir archivo CSV</label><input id="csv-archivo" class="sr" type="file" accept=".csv,text/csv,text/plain" data-cambio="csv-abrir" />
      <p class="detalle" style="color:var(--suave);font-size:.85rem">Separado por «;» o «,», con una primera fila de títulos. Si tienes un .xlsx, en Excel: Archivo → Guardar como → CSV UTF-8.</p></section>`;
  }
  const { nombre, cabecera: cab, filas, mapeo } = importacion;
  const previa = previaImportacion(ctx.estado, filas, mapeo);
  const validas = previa.filter((p) => !p.errores.length);
  const ops = [[-1, '— No importar —'], ...cab.map((c, i) => [i, c || `Columna ${i + 1}`])];
  return `${cabecera('Importar clientes', '<button class="btn" data-accion="csv-cancelar">Cancelar</button>', 'clientes')}
    <section class="tarjeta"><h2>1. Columnas de «${h(nombre)}»</h2>
      <p class="detalle" style="color:var(--suave)">${filas.length} fila${filas.length === 1 ? '' : 's'}. He propuesto la correspondencia; cámbiala si hace falta.</p>
      <div class="dos-col">${Object.entries(CAMPOS_IMPORTABLES).map(([k, def]) => selector(`map-${k}`, def.nombre, mapeo[k], ops, { 'data-cambio': 'csv-mapeo', 'data-k': k })).join('')}</div>
    </section>
    <form class="tarjeta" data-form="csv-importar"><h2>2. Vista previa</h2>
      <p>${validas.length} válida${validas.length === 1 ? '' : 's'} · ${previa.length - validas.length} con errores · ${previa.filter((p) => p.duplicados.length).length} posible${previa.filter((p) => p.duplicados.length).length === 1 ? '' : 's'} duplicado${previa.filter((p) => p.duplicados.length).length === 1 ? '' : 's'} (desmarcados).</p>
      <div class="tabla-scroll"><table class="previa"><thead><tr><th scope="col">Importar</th><th scope="col">Fila</th><th scope="col">Nombre</th><th scope="col">Teléfono</th><th scope="col">Correo</th><th scope="col">Avisos</th></tr></thead><tbody>
      ${previa.slice(0, 300).map((p, i) => `<tr><td><input type="checkbox" name="fila" value="${i}" ${p.importar ? 'checked' : ''} ${p.errores.length ? 'disabled' : ''} aria-label="Importar fila ${p.fila}" /></td><td>${p.fila}</td><td>${h(nombreCliente(p.cliente))}</td><td>${h(p.cliente.telefono)}</td><td>${h(p.cliente.email)}</td>
        <td>${p.errores.map((e) => `<span class="chip chip-mal">${h(e)}</span>`).join(' ')}${p.duplicados.map((d) => `<span class="chip chip-demo">Ya existe: ${h(d)}</span>`).join(' ')}</td></tr>`).join('')}
      </tbody></table></div>
      ${previa.length > 300 ? `<p class="detalle">Se muestran las 300 primeras de ${previa.length}. Las demás válidas sin duplicado se importan también.</p>` : ''}
      <div class="barra-guardar"><button class="btn primario" type="submit">Importar los marcados</button></div>
    </form>`;
}

export const pantallas = { ajustes, papelera, importar };

/* ───────────── acciones ───────────── */

function lee(archivo) {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsText(archivo, 'utf-8');
  });
}

export const formularios = {
  ajustes(ctx, form, d) {
    const dias = Number(d.diasSinSeguimiento);
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) return { errores: { diasSinSeguimiento: 'Entre 1 y 90 días.' } };
    Object.assign(ctx.estado.ajustes, { nombre: d.nombre.trim().slice(0, 40) || AJUSTES_BASE.nombre, tema: d.tema, diasSinSeguimiento: dias });
    aplicaTema(d.tema);
    ctx.guardar();
    ctx.aviso('Preferencias guardadas.');
    ctx.repinta();
  },
  async 'csv-importar'(ctx, form) {
    const previa = previaImportacion(ctx.estado, importacion.filas, importacion.mapeo);
    const marcadas = new Set([...form.querySelectorAll('input[name="fila"]:checked')].map((x) => Number(x.value)));
    const elegidas = previa.filter((p, i) => !p.errores.length && (i < 300 ? marcadas.has(i) : p.importar));
    if (!elegidas.length) { ctx.aviso('No hay ninguna fila marcada.', { tipo: 'mal' }); return; }
    if (!(await confirma({ titulo: `¿Importar ${elegidas.length} cliente${elegidas.length === 1 ? '' : 's'}?`, boton: 'Importar' }))) return;
    for (const p of elegidas) ctx.estado.clientes.unshift({ ...p.cliente, etiquetas: [...new Set([...p.cliente.etiquetas, 'importado'])] });
    ctx.guardar();
    importacion = null;
    ctx.aviso(`${elegidas.length} cliente${elegidas.length === 1 ? '' : 's'} importado${elegidas.length === 1 ? '' : 's'} (etiqueta «importado»).`);
    ctx.ir('clientes');
  },
};

export const acciones = {
  'copia-guardar'(ctx) {
    descarga(copiaSeguridad(ctx.estado), `olvido-de-pau-agenda-${aISO()}.json`, 'application/json');
    ctx.estado.ajustes.ultimaCopia = new Date().toISOString();
    ctx.guardar();
    ctx.aviso('Copia descargada. Guárdala fuera del móvil (correo, Drive…).');
    ctx.repinta();
  },
  async 'copia-abrir'(ctx, el) {
    const archivo = el.files?.[0];
    el.value = '';
    if (!archivo) return;
    if (archivo.size > 20 * 1024 * 1024) { ctx.aviso('El archivo es demasiado grande para ser una copia de la agenda.', { tipo: 'mal' }); return; }
    const r = leeCopia(await lee(archivo));
    if (!r.ok) { ctx.aviso(r.error, { tipo: 'mal', ms: 6000 }); return; }
    const resumen = Object.entries(r.cuentas).map(([c, n]) => `<li>${NOMBRES[c]}: ${n}</li>`).join('');
    const si = await confirma({
      titulo: 'Restaurar esta copia',
      texto: `Copia del ${r.fecha ? fechaCorta(r.fecha.slice(0, 10)) : 'día desconocido'}. SUSTITUYE todo lo que tienes ahora en este aparato. Si no estás seguro, guarda antes una copia de lo actual.`,
      detalle: `<ul>${resumen}</ul>`,
      boton: 'Sustituir mis datos',
      peligro: true,
    });
    if (!si) return;
    ctx.estado = r.estado;
    aplicaTema(r.estado.ajustes.tema);
    ctx.guardar();
    ctx.aviso('Copia restaurada.');
    ctx.ir('hoy');
  },
  exportar(ctx, el) {
    const q = el.dataset.que;
    const hoy = aISO();
    if (q === 'ics') descarga(icsEventos(ctx.estado), `agenda-${hoy}.ics`, 'text/calendar');
    else descarga({ clientes: csvClientes, tareas: csvTareas, inmuebles: csvInmuebles }[q](ctx.estado), `${q}-${hoy}.csv`, 'text/csv;charset=utf-8');
    ctx.aviso('Archivo descargado.');
  },
  async avisos(ctx, el) {
    if (el.dataset.v === 'no') { ctx.estado.ajustes.avisosNavegador = false; ctx.guardar(); ctx.repinta(); return; }
    const p = await Notification.requestPermission();
    ctx.estado.ajustes.avisosNavegador = p === 'granted';
    ctx.guardar();
    ctx.aviso(p === 'granted' ? 'Notificaciones activadas (con la app abierta o en segundo plano).' : 'No has dado permiso: seguirás viendo los avisos dentro de la app.', { tipo: p === 'granted' ? 'ok' : 'mal' });
    ctx.repinta();
  },
  'cargar-ejemplo'(ctx) {
    const demo = datosEjemplo(aISO());
    for (const c of COLECCIONES) {
      const ids = new Set(ctx.estado[c].map((r) => r.id));
      ctx.estado[c].push(...demo[c].filter((r) => !ids.has(r.id)));
    }
    ctx.guardar();
    ctx.aviso('Datos de ejemplo cargados (marcados como EJEMPLO).');
    ctx.ir('hoy');
  },
  async 'quitar-ejemplo'(ctx) {
    if (!(await confirma({ titulo: '¿Quitar los datos de ejemplo?', texto: 'Solo se borran los marcados como EJEMPLO. Tus datos no se tocan.', boton: 'Quitar', peligro: true }))) return;
    const quitados = [];
    for (const c of COLECCIONES) { quitados.push(...ctx.estado[c].filter((r) => r.demo).map((r) => r.id)); ctx.estado[c] = ctx.estado[c].filter((r) => !r.demo); }
    quitaReferencias(ctx.estado, quitados);
    ctx.guardar();
    ctx.aviso('Datos de ejemplo quitados.');
    ctx.repinta();
  },
  async 'borrar-todo'(ctx) {
    const si = await confirma({ titulo: '¿Borrar TODOS tus datos de este aparato?', texto: 'Clientes, inmuebles, citas, tareas, notas y biblioteca. No se puede deshacer. Guarda antes una copia si la quieres.', boton: 'Borrar todo', peligro: true, escribir: 'BORRAR' });
    if (!si) return;
    ctx.estado = estadoVacio();
    try { localStorage.removeItem('olvido_pau_agenda_avisados'); } catch { /* nada */ }
    ctx.guardar();
    aplicaTema('auto');
    ctx.aviso('Todos los datos borrados.');
    ctx.ir('hoy');
  },
  'papelera-restaurar'(ctx, el) {
    const r = ctx.estado[el.dataset.c].find((x) => x.id === el.dataset.id);
    if (!r) return;
    r.borrado = '';
    ctx.guardar();
    ctx.aviso('Recuperado.');
    ctx.repinta();
  },
  async 'papelera-borrar'(ctx, el) {
    if (!(await confirma({ titulo: '¿Borrar definitivamente?', texto: 'No se podrá recuperar.', boton: 'Borrar', peligro: true }))) return;
    ctx.estado[el.dataset.c] = ctx.estado[el.dataset.c].filter((x) => x.id !== el.dataset.id);
    quitaReferencias(ctx.estado, [el.dataset.id]);
    ctx.guardar();
    ctx.repinta();
  },
  async 'papelera-vaciar'(ctx) {
    if (!(await confirma({ titulo: '¿Vaciar la papelera?', texto: 'Todo lo que hay en ella se borra para siempre.', boton: 'Vaciar', peligro: true }))) return;
    const quitados = [];
    for (const c of COLECCIONES) { quitados.push(...ctx.estado[c].filter((r) => r.borrado).map((r) => r.id)); ctx.estado[c] = ctx.estado[c].filter((r) => !r.borrado); }
    quitaReferencias(ctx.estado, quitados);
    ctx.guardar();
    ctx.aviso('Papelera vaciada.');
    ctx.repinta();
  },
  async 'csv-abrir'(ctx, el) {
    const archivo = el.files?.[0];
    el.value = '';
    if (!archivo) return;
    if (/\.xlsx?$/i.test(archivo.name)) { ctx.aviso('Eso es un Excel: guárdalo como «CSV UTF-8» y vuelve a elegirlo.', { tipo: 'mal', ms: 6000 }); return; }
    let texto = await lee(archivo);
    // Excel en español a veces guarda en Windows-1252: si salen «�», se relee así.
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(await archivo.arrayBuffer());
    const { cabecera: cab, filas } = leeCsv(texto);
    if (!cab.length || !filas.length) { ctx.aviso('El archivo no tiene filas de datos.', { tipo: 'mal' }); return; }
    importacion = { nombre: archivo.name, cabecera: cab, filas, mapeo: proponeMapeo(cab) };
    ctx.repinta();
  },
  'csv-mapeo'(ctx, el) { importacion.mapeo[el.dataset.k] = Number(el.value); ctx.repinta(); },
  'csv-cancelar'(ctx) { importacion = null; ctx.ir('clientes'); },
};
