/* ═══════════════════════════════════════════════════════════════════
   CAPA DE DATOS
   Un proveedor = { id, etiqueta, obtener() } y todos devuelven el mismo
   objeto normalizado, así que el motor y la interfaz no saben ni les
   importa de dónde vienen los números.
   ═══════════════════════════════════════════════════════════════════ */

import { limita, redondea, interpola, horasSolares } from './utiles.js';


export const CONFIG = {
  // 'auto'  → intenta datos reales y cae a simulados si no hay red
  // 'openmeteo' → siempre datos reales   |   'mock' → siempre simulados
  proveedor: 'auto',
  rutaApi: '/api/tiempo',   // backend propio; si no existe, se cae a Open-Meteo
  horasVista: 12,          // franjas mostradas en "Próximas horas"
  zonaHoraria: 'Europe/Madrid',
  version: '2.1.0'
};

export const CIUDADES = [
  { id:'oviedo', nombre:'Oviedo', zona:'interior', lat:43.3619, lon:-5.8494, altitud:232 },
  { id:'mieres', nombre:'Mieres', zona:'valle',    lat:43.2500, lon:-5.7756, altitud:209 },
  { id:'gijon',  nombre:'Gijón',  zona:'costa',    lat:43.5453, lon:-5.6615, altitud:5   }
];


/* ── Proveedor simulado ───────────────────────────────────────────── */
/* Datos plausibles para Asturias: valles con niebla matinal e inversión
   térmica, costa más suave y ventosa, interior con más amplitud.        */

const PERFILES = {
  oviedo: { tBase:14.5, amplitud:8.5,  nubes:60, lluvia:32, viento:10, niebla:.30 },
  mieres: { tBase:15.0, amplitud:10.5, nubes:56, lluvia:29, viento:6,  niebla:.55 },
  gijon:  { tBase:16.0, amplitud:5.5,  nubes:67, lluvia:36, viento:17, niebla:.16 }
};

function semilla(txt){
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++){ h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function aleatorio(sem){
  let a = sem;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function generarMock(ciudad, ahora, sal){
  const clave = ahora.toISOString().slice(0, 10);
  const dado = aleatorio(semilla(clave + '|' + ciudad.id + '|' + sal));
  const dadoDia = aleatorio(semilla(clave));           // arquetipo común a las tres
  const a = dadoDia();
  const arquetipo = a < .32 ? 'frente' : a < .66 ? 'variable' : 'estable';
  const p = PERFILES[ciudad.id];
  const mes = ahora.getMonth();
  const estacion = Math.cos((mes - 6.6) / 12 * 2 * Math.PI);   // 1 en julio, -1 en enero
  const tEstacional = p.tBase + estacion * 5.5;
  const hayNieblaHoy = dado() < p.niebla * (arquetipo === 'estable' ? 1.25 : arquetipo === 'frente' ? .35 : .8);

  const sol = horasSolares(ahora, ciudad.lat, ciudad.lon);
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const horas = [];

  for (let i = 0; i < 48; i++){
    const t = new Date(inicio.getTime() + i * 36e5);
    const h = t.getHours();
    const curva = Math.sin(((h - 9) / 24) * 2 * Math.PI);            // pico ~15 h
    const esDeDia = t >= sol.amanecer && t <= sol.ocaso;

    const nubesBase = { frente:88, variable:62, estable:34 }[arquetipo];
    const nubosidad = limita(nubesBase + (p.nubes - 60) * .6 + (dado() - .5) * 34 - curva * 6, 0, 100);

    const lluviaBase = { frente:74, variable:38, estable:9 }[arquetipo];
    const probLluvia = limita(lluviaBase + (p.lluvia - 32) * .8 + (dado() - .5) * 26 + curva * 4, 0, 100);
    const precipitacion = probLluvia > 55 ? redondea((probLluvia - 50) / 100 * (arquetipo === 'frente' ? 2.6 : 1.1) * dado(), 1) : 0;

    const nieblaAhora = hayNieblaHoy && h >= 4 && h <= 10 && nubosidad < 92;
    const visibilidad = nieblaAhora ? Math.round(interpola(dado(), 0, 1, 180, 1400))
      : precipitacion > .6 ? Math.round(interpola(precipitacion, .6, 3, 12000, 5000))
      : nubosidad > 80 ? 18000 : Math.round(interpola(dado(), 0, 1, 22000, 40000));

    const viento = redondea(limita(p.viento + (dado() - .45) * 11 + (esDeDia ? 3 : -1) + (arquetipo === 'frente' ? 9 : 0), 1, 75), 0);
    const humedad = Math.round(limita(64 + (nieblaAhora ? 26 : 0) + probLluvia * .2 - curva * 9 + (dado() - .5) * 8, 30, 100));
    const temperatura = redondea(tEstacional + curva * p.amplitud / 2
      - (nubosidad / 100) * 2.2 - (nieblaAhora ? 2.4 : 0) + (dado() - .5) * 1.4, 1);
    const sensacion = redondea(temperatura - (viento > 14 ? (viento - 14) * .10 : 0) - (precipitacion > 0 ? .8 : 0)
      + (temperatura > 24 && humedad > 75 ? 1.6 : 0), 1);

    let codigo = 0;
    if (nieblaAhora && visibilidad < 900) codigo = 45;
    else if (precipitacion >= 1.6) codigo = arquetipo === 'frente' ? 65 : 81;
    else if (precipitacion >= .5) codigo = 63;
    else if (precipitacion > 0) codigo = 51;
    else if (nubosidad > 85) codigo = 3;
    else if (nubosidad > 55) codigo = 2;
    else if (nubosidad > 22) codigo = 1;

    horas.push({ instante:t, temperatura, sensacion, humedad, viento,
      rachas: redondea(viento * 1.45, 0), dirViento: Math.round(dado() * 360),
      precipitacion, probLluvia: Math.round(probLluvia), nubosidad: Math.round(nubosidad),
      visibilidad, codigo, esDeDia });
  }

  const hoy = horas.slice(0, 24);
  const actual = horas[ahora.getHours()];
  return {
    ...ciudad,
    actual,
    hoy: {
      max: redondea(Math.max(...hoy.map(x => x.temperatura)), 0),
      min: redondea(Math.min(...hoy.map(x => x.temperatura)), 0),
      probLluviaMax: Math.max(...hoy.map(x => x.probLluvia)),
      precipTotal: redondea(hoy.reduce((s, x) => s + x.precipitacion, 0), 1),
      amanecer: sol.amanecer, ocaso: sol.ocaso
    },
    horas
  };
}

export const ProveedorMock = {
  id:'mock',
  etiqueta:'Simulados',
  async obtener(sal = 0){
    const ahora = new Date();
    await new Promise(r => setTimeout(r, 260));           // latencia realista
    return { ciudades: CIUDADES.map(c => generarMock(c, ahora, sal)), origen:'mock', instante: ahora };
  }
};

/* ── Proveedor real: Open-Meteo, sin clave ────────────────────────── */
/* Sin clave de API. Para AEMET (OpenData) basta con crear otro objeto con
   la misma forma { id, etiqueta, obtener() } y añadirlo a Proveedores.   */

export const ProveedorOpenMeteo = {
  id:'openmeteo',
  etiqueta:'En directo',
  async obtener(){
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude:  CIUDADES.map(c => c.lat).join(','),
      longitude: CIUDADES.map(c => c.lon).join(','),
      current:  'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
      hourly:   'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,cloud_cover,visibility,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day',
      daily:    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset',
      timezone: CONFIG.zonaHoraria,
      forecast_days:'2'
    }).toString();

    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 9000);
    let bruto;
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache:'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      bruto = await res.json();
    } finally { clearTimeout(corte); }

    const lista = Array.isArray(bruto) ? bruto : [bruto];
    const ahora = new Date();
    const ciudades = CIUDADES.map((ciudad, i) => normalizaOpenMeteo(ciudad, lista[i], ahora));
    return { ciudades, origen:'openmeteo', instante: ahora };
  }
};

function normalizaOpenMeteo(ciudad, d, ahora){
  const H = d.hourly, C = d.current, D = d.daily;
  const horas = H.time.map((iso, i) => ({
    instante: new Date(iso),
    temperatura: redondea(H.temperature_2m[i], 1),
    sensacion:   redondea(H.apparent_temperature[i], 1),
    humedad:     H.relative_humidity_2m[i],
    viento:      redondea(H.wind_speed_10m[i], 0),
    rachas:      redondea(H.wind_gusts_10m?.[i] ?? H.wind_speed_10m[i] * 1.4, 0),
    dirViento:   H.wind_direction_10m?.[i] ?? 0,
    precipitacion: redondea(H.precipitation[i] ?? 0, 1),
    probLluvia:  H.precipitation_probability?.[i] ?? 0,
    nubosidad:   H.cloud_cover[i],
    visibilidad: H.visibility?.[i] ?? 24000,
    codigo:      H.weather_code[i],
    esDeDia:     H.is_day[i] === 1
  }));

  // La hora actual sirve de referencia para visibilidad y probabilidad,
  // que Open-Meteo solo publica en la serie horaria.
  const iAhora = Math.max(0, horas.findIndex(h => h.instante.getHours() === ahora.getHours()
    && h.instante.getDate() === ahora.getDate()));
  const ref = horas[iAhora] || horas[0];

  return {
    ...ciudad,
    actual: {
      instante: ahora,
      temperatura: redondea(C.temperature_2m, 1),
      sensacion:   redondea(C.apparent_temperature, 1),
      humedad:     C.relative_humidity_2m,
      viento:      redondea(C.wind_speed_10m, 0),
      rachas:      redondea(C.wind_gusts_10m, 0),
      dirViento:   C.wind_direction_10m,
      precipitacion: redondea(C.precipitation ?? 0, 1),
      probLluvia:  ref.probLluvia,
      nubosidad:   C.cloud_cover,
      visibilidad: ref.visibilidad,
      codigo:      C.weather_code,
      esDeDia:     C.is_day === 1
    },
    hoy: {
      max: redondea(D.temperature_2m_max[0], 0),
      min: redondea(D.temperature_2m_min[0], 0),
      probLluviaMax: D.precipitation_probability_max?.[0] ?? 0,
      precipTotal: redondea(D.precipitation_sum?.[0] ?? 0, 1),
      amanecer: new Date(D.sunrise[0]),
      ocaso:    new Date(D.sunset[0])
    },
    horas
  };
}

/* ── Capa de datos — backend propio (AEMET + Open-Meteo) ──────────── */
/* `api/tiempo.js` compone la malla horaria de Open-Meteo con la
   observación real de la estación AEMET más cercana a cada ciudad. Es la
   única forma de usar AEMET: su clave no puede vivir en el navegador.   */

export const ProveedorApi = {
  id:'api',
  etiqueta:'AEMET',
  async obtener(){
    const res = await fetch(CONFIG.rutaApi, { cache:'no-store', signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error('API ' + res.status);
    const datos = await res.json();
    if (!datos?.ciudades?.length) throw new Error('API sin ciudades');
    // El servidor dice si la observación real llegó entera, a medias o nada
    return revivirFechas({ ...datos, origen: datos.origen === 'openmeteo' ? 'openmeteo' : 'api' });
  }
};

/** Las fechas viajan como texto ISO; aquí vuelven a ser Date. */
export function revivirFechas(d){
  d.instante = new Date(d.instante);
  d.ciudades.forEach(c => {
    c.actual.instante = new Date(c.actual.instante);
    c.hoy.amanecer = new Date(c.hoy.amanecer);
    c.hoy.ocaso = new Date(c.hoy.ocaso);
    c.horas.forEach(h => h.instante = new Date(h.instante));
  });
  return d;
}

export const Proveedores = { mock: ProveedorMock, openmeteo: ProveedorOpenMeteo, api: ProveedorApi };

/* Cascada por origen elegido. 'auto' baja un peldaño cada vez que algo
   falla, para que la app siempre tenga algo que enseñar.               */
export const CASCADAS = {
  auto:      ['api', 'openmeteo', 'mock'],
  api:       ['api'],
  openmeteo: ['openmeteo'],
  mock:      ['mock']
};

/* Distintas fuentes pueden contradecirse: el código del cielo viene del
   modelo y la visibilidad puede venir medida por una estación. Aquí se
   dejan coherentes antes de que nadie los lea, y se redondea lo que
   luego se enseña como entero.                                         */
export function reconcilia(p){
  const esNiebla = p.codigo === 45 || p.codigo === 48;
  if (p.visibilidad < 1000 && !esNiebla && p.precipitacion < .5) p.codigo = 45;
  else if (esNiebla && p.visibilidad > 5000)
    p.codigo = p.nubosidad > 85 ? 3 : p.nubosidad > 55 ? 2 : p.nubosidad > 22 ? 1 : 0;
  p.nubosidad  = Math.round(p.nubosidad);
  p.humedad    = Math.round(p.humedad);
  p.probLluvia = Math.round(p.probLluvia);
  p.viento     = Math.round(p.viento);
  p.rachas     = Math.round(p.rachas);
  p.visibilidad = Math.round(p.visibilidad);
  return p;
}

/** Punto único de entrada de datos para el resto de la app. */
export async function cargarDatos(sal = 0){
  const cadena = CASCADAS[CONFIG.proveedor] || CASCADAS.auto;
  let ultimo;
  for (const id of cadena){
    try {
      const datos = await Proveedores[id].obtener(sal);
      datos.ciudades.forEach(c => { reconcilia(c.actual); c.horas.forEach(reconcilia); });
      return datos;
    } catch (err){
      ultimo = err;
      console.warn(`[SNA] proveedor "${id}" no disponible: ${err.message}`);
    }
  }
  throw ultimo ?? new Error('Sin proveedores disponibles');
}


/* ── Caché local: pintar al instante aunque se abra sin cobertura ──── */

export function guardaCache(datos){
  try { localStorage.setItem('sna.cache', JSON.stringify({ ts: Date.now(), datos })); } catch {}
}

export function leeCache(){
  try {
    const c = JSON.parse(localStorage.getItem('sna.cache') || 'null');
    if (!c || Date.now() - c.ts > 6 * 36e5) return null;
    return revivirFechas(c.datos);
  } catch { return null; }
}

export function borraCache(){ try { localStorage.removeItem('sna.cache'); } catch {} }
