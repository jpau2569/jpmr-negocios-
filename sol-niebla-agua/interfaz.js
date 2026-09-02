/* ═══════════════════════════════════════════════════════════════════
   INTERFAZ — render puro
   Recibe la evaluación y un contexto con lo que necesita del exterior
   (qué ciudad tiene el foco y a quién avisar cuando el usuario toca
   algo). No lee estado global ni sabe de red: así se puede probar y
   crecer sin enredar las capas.
   ═══════════════════════════════════════════════════════════════════ */

import { $, $$, hh, hhmm, redondea, rumbo, familiaCielo, iconoCielo,
         NOMBRE_CIELO, media, signo } from './utiles.js';
import { CONFIG, Proveedores } from './datos.js';
import { MODOS, banda, colorIndice, colorTenue, recomendacion,
         lecturaDelDia, ICONOS_CONSEJO } from './indice.js';

/* El contexto lo inyecta app.js en cada pintada. */
let ctx = { ciudadFoco:null, alRefrescar(){}, alEnfocar(){} };
let ultimaEv = null;   // permite repintar solo un bloque sin volver a evaluar


const FECHA_LARGA = { weekday:'long', day:'numeric', month:'long' };

function anillo(indice, tam = 62, grosor = 5){
  const r = (tam - grosor) / 2, c = 2 * Math.PI * r;
  return `<div class="anillo" style="--acento:${colorIndice(indice)}; width:${tam}px; height:${tam}px">
    <svg width="${tam}" height="${tam}" aria-hidden="true">
      <circle class="anillo__fondo" cx="${tam/2}" cy="${tam/2}" r="${r}" stroke-width="${grosor}"/>
      <circle class="anillo__valor" cx="${tam/2}" cy="${tam/2}" r="${r}" stroke-width="${grosor}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - indice / 100)).toFixed(1)}"/>
    </svg>
    <span class="anillo__num num" style="font-size:${Math.round(tam * .34)}px">${indice}</span>
  </div>`;
}

/* ── Hero: la lectura del día, la mejor opción y el consejo ───────── */
function pintarHero(ev){
  const m = ev.mejor, r = recomendacion(ev), b = banda(m.indice);
  const fecha = ev.instante.toLocaleDateString('es-ES', FECHA_LARGA);
  $('#hero').className = 'hero entra';
  $('#hero').style.setProperty('--acento', colorIndice(m.indice));
  $('#hero').style.setProperty('--acento-tenue', colorTenue(m.indice));
  $('#hero').innerHTML = `
    <p class="hero__fecha">${fecha}</p>
    <p class="hero__titular">${lecturaDelDia(ev)}</p>
    <div class="hero__mejor">
      <div class="hero__mejor-txt">
        <p class="hero__donde">Ahora mismo, mejor en</p>
        <p class="hero__ciudad">${m.nombre}</p>
        <p class="hero__detalle">${b.etiqueta} para ${MODOS[ev.modo].nombre.toLowerCase()} ·
          ${NOMBRE_CIELO[familiaCielo(m.actual.codigo)].toLowerCase()}, ${Math.round(m.actual.temperatura)}°
          y ${m.actual.probLluvia}% de lluvia</p>
      </div>
      ${anillo(m.indice, 74, 6)}
    </div>
    <div class="hero__consejo">
      <span class="hero__consejo-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_CONSEJO[r.icono]}</svg></span>
      <div>
        <p class="hero__consejo-tit">${r.titulo}</p>
        <p class="hero__consejo-txt">${r.texto}</p>
      </div>
    </div>
    ${pieHero(ev)}`;
  $('#btn-refrescar')?.addEventListener('click', () => ctx.alRefrescar());
}

function pieHero(ev){
  const minutos = Math.round((Date.now() - ev.instante.getTime()) / 60000);
  const viejo = minutos >= 40;
  const real = ev.origen !== 'mock';
  const tipo = viejo ? 'viejo' : real ? 'real' : 'mock';
  const texto = viejo ? `Hace ${minutos < 90 ? minutos + ' min' : Math.round(minutos / 60) + ' h'}`
    : (Proveedores[ev.origen]?.etiqueta ?? 'Simulados');
  return `<div class="hero__pie">
      <span class="sello" data-tipo="${tipo}" title="${real ? 'Datos reales' : 'Datos simulados'}">${texto}</span>
      <span class="hero__hora">Actualizado a las ${hhmm(ev.instante)}</span>
      <button class="btn-refresco" id="btn-refrescar" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>
        <span>Actualizar</span>
      </button>
    </div>`;
}

/** Hero cuando no hay ningún dato con el que trabajar. */
export function pintarHeroError(mensaje){
  $('#hero').className = 'hero hero--error';
  $('#hero').innerHTML = `
    <p class="hero__fecha">Sin datos</p>
    <p class="hero__titular">${mensaje}</p>
    <div class="hero__pie">
      <button class="btn-refresco" id="btn-refrescar" type="button" style="margin-left:0">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>
        <span>Reintentar</span>
      </button>
    </div>`;
  $('#btn-refrescar').addEventListener('click', () => ctx.alRefrescar());
  $('#app').setAttribute('aria-busy', 'false');
}

/* ── Ranking: las tres ciudades como una sola unidad ──────────────── */
function pintarRanking(ev){
  const ganaCosta = ev.costa && ev.costa.indice > ev.mediaInterior;
  const dif = Math.abs(Math.round((ev.costa?.indice ?? 0) - ev.mediaInterior));
  $('#ranking').innerHTML = ev.ciudades.map(c => `
    <button type="button" class="fila" data-ciudad="${c.id}" data-foco="${c.id === ctx.ciudadFoco ? 'si' : 'no'}"
        style="--acento:${colorIndice(c.indice)}"
        aria-label="${c.nombre}, ${c.indice} sobre 100, ${Math.round(c.actual.temperatura)} grados. Ver sus próximas horas">
      <span class="fila__n">${c.nombre} <span class="fila__zona">${c.zona}</span></span>
      <span class="fila__pista"><span class="fila__relleno" style="width:${c.indice}%"></span></span>
      <span class="fila__t num">${Math.round(c.actual.temperatura)}°</span>
      <span class="fila__i num">${c.indice}</span>
    </button>`).join('')
    + `<p class="ranking__pie"><strong>${ganaCosta ? 'Mejor ahora en costa.' : 'Mejor ahora en interior.'}</strong>
        ${dif <= 3 ? 'Las tres van muy parejas: decide por cercanía.'
          : ganaCosta ? `Gijón saca ${dif} puntos a la media de Oviedo y Mieres.`
          : `Oviedo y Mieres promedian ${dif} puntos por encima de Gijón.`}</p>`;

  $$('#ranking .fila').forEach(el => el.addEventListener('click', () => ctx.alEnfocar(el.dataset.ciudad)));
}

/* ── Gráfico de las próximas horas ────────────────────────────────── */
const G = { ancho:360, alto:180, izq:26, der:26, arriba:30, base:120, lluviaBase:152, lluviaAlto:22 };

/** Catmull-Rom convertido a curvas de Bézier: trazo suave sin librerías. */
function curvaSuave(pts){
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++){
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)},${c2[0].toFixed(1)} ${c2[1].toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function pintarFranjas(ev){
  const c = ev.ciudades.find(x => x.id === ctx.ciudadFoco) || ev.mejor;
  $('#horas-ciudad').textContent = '· ' + c.nombre;

  const h = c.futuras;
  const paso = (G.ancho - G.izq - G.der) / (h.length - 1);
  const x = i => G.izq + i * paso;
  const y = v => G.base - (v / 100) * (G.base - G.arriba);
  const pts = h.map((p, i) => [x(i), y(p.indice)]);

  const ventana = c.ventana
    ? `<rect class="g-ventana" x="${(x(c.ventana.iDesde) - paso / 2).toFixed(1)}" y="${G.arriba - 6}"
         width="${(paso * (c.ventana.iHasta - c.ventana.iDesde + 1)).toFixed(1)}"
         height="${G.base - G.arriba + 6}" rx="8"/>` : '';

  const lluvia = h.map((p, i) => p.probLluvia < 10 ? '' :
    `<rect class="g-lluvia" x="${(x(i) - 3).toFixed(1)}"
       y="${(G.lluviaBase - (p.probLluvia / 100) * G.lluviaAlto).toFixed(1)}" width="6"
       height="${((p.probLluvia / 100) * G.lluviaAlto).toFixed(1)}" rx="3"/>`).join('');

  const etiquetas = h.map((p, i) => i % 2 ? '' :
    `<text class="g-txt" x="${x(i).toFixed(1)}" y="${G.lluviaBase + 15}">${i === 0 ? 'Ahora' : hh(p.instante)}</text>`).join('');
  const temps = h.map((p, i) => i % 2 ? '' :
    `<text class="g-temp" x="${x(i).toFixed(1)}" y="14">${Math.round(p.temperatura)}°</text>`).join('');

  const pie = c.ventana
    ? `Mejor tramo en ${c.nombre}: <strong>${hhmm(c.ventana.desde)}–${hhmm(c.ventana.hasta)}</strong> (${c.ventana.indice}/100).`
    : c.bajon
      ? `${c.nombre} aguanta hasta las <strong>${hhmm(c.bajon.desde)}</strong>; a partir de ahí cae a ${c.bajon.indice}/100.`
      : c.indice >= 70
        ? `${c.nombre} se mantiene estable durante las próximas ${CONFIG.horasVista} horas. Sin prisa.`
        : `Sin ventana clara en ${c.nombre} durante las próximas ${CONFIG.horasVista} horas.`;

  $('#franjas').style.setProperty('--acento', colorIndice(c.indice));
  $('#franjas').style.setProperty('--acento-tenue', colorTenue(c.indice));
  $('#franjas').innerHTML = `
    <svg viewBox="0 0 ${G.ancho} ${G.alto}" role="img"
         aria-label="Índice Sol Niebla y Agua de ${c.nombre} en las próximas ${h.length} horas, de ${Math.min(...h.map(p=>p.indice))} a ${Math.max(...h.map(p=>p.indice))} sobre 100">
      <defs><clipPath id="g-caja"><rect x="0" y="${G.arriba - 8}" width="${G.ancho}" height="${G.base - G.arriba + 8}"/></clipPath></defs>
      ${ventana}
      <line class="g-rejilla" x1="${G.izq}" y1="${y(70).toFixed(1)}" x2="${G.ancho - G.der}" y2="${y(70).toFixed(1)}" stroke-dasharray="2 4"/>
      <text class="g-ref" x="${G.ancho - G.der + 3}" y="${(y(70) + 3.5).toFixed(1)}">70</text>
      <text class="g-ref" x="${G.izq - 5}" y="${G.base + 3.5}" style="text-anchor:end">0</text>
      <line class="g-rejilla" x1="${G.izq}" y1="${G.base}" x2="${G.ancho - G.der}" y2="${G.base}"/>
      <g clip-path="url(#g-caja)">
        <path class="g-area" d="${curvaSuave(pts)}L${x(h.length-1).toFixed(1)} ${G.base}L${G.izq} ${G.base}Z"/>
        <path class="g-linea" d="${curvaSuave(pts)}"/>
      </g>
      <line class="g-ahora" x1="${G.izq}" y1="${G.arriba - 6}" x2="${G.izq}" y2="${G.base}"/>
      <circle class="g-punto" cx="${G.izq}" cy="${y(h[0].indice).toFixed(1)}" r="3.8"/>
      <text class="g-ahora-num" x="${G.izq + 7}" y="${(y(h[0].indice) - 7).toFixed(1)}">${h[0].indice}</text>
      ${lluvia}${temps}${etiquetas}
    </svg>
    <div class="leyenda">
      <span><i style="background:${colorIndice(c.indice)}"></i>Índice</span>
      <span><i style="background:var(--agua);opacity:.55"></i>Prob. de lluvia</span>
      ${c.ventana ? '<span><i style="background:var(--sol-tenue);border:1px solid var(--sol)"></i>Ventana buena</span>' : ''}
    </div>
    <p class="grafico__pie">${pie}</p>`;
}

/* ── Detalle por ciudad ───────────────────────────────────────────── */
function pintarCiudades(ev){
  $('#ciudades').innerHTML = ev.ciudades.map((c, i) => {
    const a = c.actual;
    const km = a.visibilidad >= 1000 ? `${redondea(a.visibilidad / 1000, a.visibilidad < 10000 ? 1 : 0)}<small> km</small>`
      : `${a.visibilidad}<small> m</small>`;
    return `<button type="button" class="tarjeta ciudad entra" style="--i:${i}" data-ciudad="${c.id}"
        data-foco="${c.id === ctx.ciudadFoco ? 'si' : 'no'}"
        aria-label="${c.nombre}, índice ${c.indice} sobre 100. Ver sus próximas horas">
      <div class="ciudad__cab">
        ${anillo(c.indice, 54, 4.5)}
        <div class="ciudad__id">
          <p class="ciudad__nombre">${c.nombre} <span class="ciudad__zona">${c.zona}</span></p>
          <p class="ciudad__cielo">${iconoCielo(a.codigo, a.esDeDia)} ${NOMBRE_CIELO[familiaCielo(a.codigo)]}</p>
        </div>
        <div class="ciudad__bloque-temp">
          <p class="ciudad__temp num">${Math.round(a.temperatura)}°</p>
          <p class="ciudad__minmax num">${Math.round(c.hoy.max)}° / ${Math.round(c.hoy.min)}°</p>
        </div>
      </div>
      <div class="metricas">
        <div class="metrica" data-alerta="${a.probLluvia >= 60 ? 'si' : 'no'}">
          <p class="metrica__k">Lluvia</p><p class="metrica__v num">${a.probLluvia}%</p></div>
        <div class="metrica"><p class="metrica__k">Sensación</p><p class="metrica__v num">${Math.round(a.sensacion)}°</p></div>
        <div class="metrica" data-alerta="${a.visibilidad < 2000 ? 'si' : 'no'}">
          <p class="metrica__k">Visibilidad</p><p class="metrica__v num">${km}</p></div>
        <div class="metrica" data-alerta="${a.rachas >= 50 ? 'si' : 'no'}">
          <p class="metrica__k">Viento</p><p class="metrica__v num">${a.viento}<small> km/h ${rumbo(a.dirViento)}</small></p></div>
        <div class="metrica"><p class="metrica__k">Humedad</p><p class="metrica__v num">${a.humedad}%</p></div>
        <div class="metrica"><p class="metrica__k">Nubes</p><p class="metrica__v num">${a.nubosidad}%</p></div>
      </div>
      <div class="etiquetas">
        ${c.etiquetas.map(e => `<span class="etiqueta" data-tono="${e.tono}">${e.txt}</span>`).join('')}
      </div>
    </button>`;
  }).join('');

  $$('.ciudad').forEach(el => el.addEventListener('click', () => ctx.alEnfocar(el.dataset.ciudad, true)));
}

/** Cambia la ciudad sobre la que se leen las próximas horas. */
export function enfocar(id, desplaza = false){
  ctx.ciudadFoco = id;
  $$('[data-ciudad]').forEach(x => x.dataset.foco = x.dataset.ciudad === id ? 'si' : 'no');
  if (ultimaEv) pintarFranjas(ultimaEv);
  if (desplaza) $('#franjas').scrollIntoView({ behavior:'smooth', block:'center' });
}

/* ── Interior y costa ─────────────────────────────────────────────── */
function pintarComparativa(ev){
  const costa = ev.costa, interior = ev.interior;
  const dTemp   = costa ? costa.actual.temperatura - media(interior.map(c => c.actual.temperatura)) : 0;
  const dLluvia = costa ? costa.actual.probLluvia  - media(interior.map(c => c.actual.probLluvia))  : 0;
  const dViento = costa ? costa.actual.viento      - media(interior.map(c => c.actual.viento))      : 0;
  const ganaCosta = costa && costa.indice > ev.mediaInterior;

  $('#comparativa').innerHTML = `
    <div class="deltas">
      <div class="delta"><p class="delta__k">Temperatura</p><p class="delta__v num">${signo(dTemp, 1)}°</p></div>
      <div class="delta"><p class="delta__k">Prob. lluvia</p><p class="delta__v num">${signo(dLluvia, 0)}%</p></div>
      <div class="delta"><p class="delta__k">Viento</p><p class="delta__v num">${signo(dViento, 0)}</p></div>
    </div>
    <p class="comparativa__nota">Diferencia de <strong>Gijón</strong> frente a la media de Oviedo y Mieres.
      ${ganaCosta
        ? `Hoy la costa gana${dViento > 6 ? `, aunque con ${Math.round(dViento)} km/h más de viento` : ''}.`
        : `Hoy gana el interior${dLluvia > 8 ? ': en Gijón hay más agua' : ''}.`}</p>`;
}


/* ── Orquestador del render ───────────────────────────────────────── */

/** Punto de entrada: `contexto` trae el foco y los avisos hacia app.js. */
export function pintar(ev, contexto){
  if (contexto) ctx = { ...ctx, ...contexto };
  ultimaEv = ev;
  if (!ev.ciudades.some(c => c.id === ctx.ciudadFoco)) ctx.ciudadFoco = ev.mejor.id;
  pintarHero(ev); pintarRanking(ev); pintarFranjas(ev);
  pintarCiudades(ev); pintarComparativa(ev);
  $('#app').setAttribute('aria-busy', 'false');
}


/** Qué ciudad está enfocada ahora mismo (lo necesita app.js al guardar). */
export const ciudadEnfocada = () => ctx.ciudadFoco;
