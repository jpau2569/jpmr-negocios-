/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — avisos de citas
   Tres canales distintos (se explican en Ajustes):
   1. Aviso dentro de la app: una franja arriba cuando llega la hora de un
      recordatorio. Solo con la app ABIERTA.
   2. Notificación del navegador: lo mismo como notificación del sistema,
      si Pau da permiso. También solo con la app abierta (o en segundo
      plano en el ordenador): sin servidor de avisos, una web no puede
      despertar al móvil.
   3. Calendario del móvil o Google Calendar: descargando la cita en .ics
      (hoy) o con la sincronización de la fase 2. Este SÍ avisa con la
      app cerrada.
   ═══════════════════════════════════════════════════════════════════ */

import { activos, TIPOS_EVENTO } from './datos.js';
import { h } from './ui.js';
import { aISO, sumaDias } from './utiles.js';

const CLAVE_AVISADOS = 'olvido_pau_agenda_avisados';

function avisados() {
  try { return JSON.parse(localStorage.getItem(CLAVE_AVISADOS) || '{}'); } catch { return {}; }
}
function guardaAvisados(m) {
  // Solo se guardan los de los últimos 3 días.
  const limite = Date.now() - 3 * 86400000;
  for (const k of Object.keys(m)) if (m[k] < limite) delete m[k];
  try { localStorage.setItem(CLAVE_AVISADOS, JSON.stringify(m)); } catch { /* sin espacio: se repetiría el aviso, nada más */ }
}

/** Recordatorios que tocan ahora (desde su hora hasta el inicio de la cita, y 2 h de margen). */
/** «en 25 min», «en 1 h 10 min», «empieza ahora» o «ya ha empezado». */
export function cuentaAtras(faltan) {
  if (faltan < 0) return ' · ya ha empezado';
  if (faltan === 0) return ' · empieza ahora';
  return ` · en ${faltan >= 60 ? `${Math.floor(faltan / 60)} h${faltan % 60 ? ` ${faltan % 60} min` : ''}` : `${faltan} min`}`;
}

export function recordatoriosPendientes(estado, ahora = new Date(), ya = {}) {
  const hoy = aISO(ahora);
  const salida = [];
  for (const e of activos(estado.eventos)) {
    if (e.todoElDia || !e.inicio || !e.recordatorios.length) continue;
    if (e.fecha < hoy || e.fecha > sumaDias(hoy, 1)) continue;
    const [hh, mm] = e.inicio.split(':').map(Number);
    const [a, m, d] = e.fecha.split('-').map(Number);
    const inicio = new Date(a, m - 1, d, hh, mm).getTime();
    // Solo un aviso por cita aunque se abra la app tarde: el último recordatorio vencido.
    const t = ahora.getTime();
    if (t > inicio + 2 * 3600000) continue;
    const vencidos = e.recordatorios.filter((min) => t >= inicio - min * 60000);
    if (!vencidos.length) continue;
    const claves = vencidos.map((min) => `${e.id}|${e.fecha}|${e.inicio}|${min}`);
    if (claves.every((k) => ya[k])) continue;
    salida.push({ clave: claves[0], claves, evento: e, faltan: Math.round((inicio - t) / 60000) });
  }
  return salida;
}

/** En Android solo vale showNotification del service worker; en el PC también new Notification. */
async function notifica(texto, tag) {
  const opciones = { body: texto, tag, icon: 'icono-192.png', badge: 'icono-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification('OLVIDO DE PAU AGENDA', opciones); return; }
  } catch { /* se prueba el otro camino */ }
  try { new Notification('OLVIDO DE PAU AGENDA', opciones); } catch { /* el aviso dentro de la app ya se ha mostrado */ }
}

export function arrancaRecordatorios(ctx) {
  const caja = document.getElementById('recordatorios');
  const revisa = () => {
    const ya = avisados();
    const lista = recordatoriosPendientes(ctx.estado, new Date(), ya);
    for (const { clave, claves, evento, faltan } of lista) {
      for (const k of claves) ya[k] = Date.now();
      const texto = `${evento.inicio} · ${evento.titulo}`;
      const div = document.createElement('div');
      div.className = 'recordatorio';
      div.setAttribute('role', 'alert');
      div.innerHTML = `<span aria-hidden="true">🔔</span><span><a href="#evento/${h(evento.id)}">${h(texto)}</a><br><span class="detalle">${h(TIPOS_EVENTO[evento.tipo]?.nombre || '')}${h(cuentaAtras(faltan))}${evento.ubicacion ? ' · ' + h(evento.ubicacion) : ''}</span></span><button class="btn pequeno cerrar" type="button" aria-label="Cerrar aviso">✕</button>`;
      div.querySelector('button').onclick = () => div.remove();
      div.querySelector('a').onclick = () => div.remove();
      caja.appendChild(div);
      if (ctx.estado.ajustes.avisosNavegador && 'Notification' in window && Notification.permission === 'granted') {
        notifica(texto, clave);
      }
    }
    if (lista.length) guardaAvisados(ya);
  };
  revisa();
  setInterval(revisa, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisa(); });
}
