/* ═══════════════════════════════════════════════════════════════════
   API del tiempo para "Sol Niebla y Agua" (Vercel serverless).

   Existe por dos razones que el navegador no puede resolver solo:
     1. AEMET OpenData exige una clave que no puede vivir en el cliente.
     2. AEMET no da CORS ni una serie horaria completa por sí sola.

   Estrategia: Open-Meteo aporta la malla horaria completa (visibilidad,
   nubosidad, probabilidad) y AEMET, cuando hay clave, corrige la
   observación actual con la estación real más cercana a cada ciudad.
   Así el "ahora mismo" es medición española y el resto, modelo.

   Variables de entorno (todas opcionales):
     AEMET_API_KEY  → activa la corrección con observación real de AEMET
   ═══════════════════════════════════════════════════════════════════ */

const CIUDADES = [
  // `estaciones`: indicativos AEMET por cercanía, en orden de preferencia
  { id:'oviedo', nombre:'Oviedo', zona:'interior', lat:43.3619, lon:-5.8494, estaciones:['1249I','1249X'] },
  { id:'mieres', nombre:'Mieres', zona:'valle',    lat:43.2500, lon:-5.7756, estaciones:['1208H','1249I'] },
  { id:'gijon',  nombre:'Gijón',  zona:'costa',    lat:43.5453, lon:-5.6615, estaciones:['1207U','1208H'] }
];

const ZONA = 'Europe/Madrid';
const CAMPOS_HORA = ['temperature_2m','apparent_temperature','relative_humidity_2m',
  'precipitation_probability','precipitation','weather_code','cloud_cover','visibility',
  'wind_speed_10m','wind_gusts_10m','wind_direction_10m','is_day'].join(',');

/* ── Open-Meteo: la malla horaria ─────────────────────────────────── */
async function openMeteo(){
  const p = new URLSearchParams({
    latitude:  CIUDADES.map(c => c.lat).join(','),
    longitude: CIUDADES.map(c => c.lon).join(','),
    current:  'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    hourly:   CAMPOS_HORA,
    daily:    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset',
    timezone: ZONA,
    forecast_days: '2'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`, {
    signal: AbortSignal.timeout(9000)
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [json];
}

/* ── AEMET: observación real de las últimas horas ─────────────────── */
/* OpenData responde en dos pasos: primero una URL, luego los datos.    */
async function aemetJson(ruta, clave){
  const cabeceras = { 'api_key': clave, 'cache-control': 'no-cache' };
  const puerta = await fetch(`https://opendata.aemet.es/opendata${ruta}`, {
    headers: cabeceras, signal: AbortSignal.timeout(8000)
  });
  if (!puerta.ok) throw new Error(`AEMET ${puerta.status}`);
  const sobre = await puerta.json();
  if (!sobre.datos) throw new Error(`AEMET sin datos: ${sobre.descripcion || sobre.estado}`);
  const datos = await fetch(sobre.datos, { signal: AbortSignal.timeout(8000) });
  if (!datos.ok) throw new Error(`AEMET datos ${datos.status}`);
  // El fichero de datos viene en latin-1 con más frecuencia de la deseable
  const cuerpo = await datos.arrayBuffer();
  const texto = new TextDecoder(datos.headers.get('content-type')?.includes('utf') ? 'utf-8' : 'iso-8859-15')
    .decode(cuerpo);
  return JSON.parse(texto);
}

/** Última observación válida de una estación (o null si no hay). */
async function observacion(estaciones, clave){
  for (const idema of estaciones){
    try {
      const filas = await aemetJson(`/api/observacion/convencional/datos/estacion/${idema}`, clave);
      const ultima = [...filas].reverse().find(f => f.ta !== undefined);
      if (ultima) return {
        estacion: ultima.ubi?.trim() || idema,
        instante: ultima.fint,
        temperatura: ultima.ta,
        humedad: ultima.hr,
        viento: ultima.vv !== undefined ? ultima.vv * 3.6 : undefined,   // m/s → km/h
        rachas:  ultima.vmax !== undefined ? ultima.vmax * 3.6 : undefined,
        dirViento: ultima.dv,
        precipitacion: ultima.prec,
        visibilidad: ultima.vis !== undefined ? ultima.vis * 1000 : undefined   // km → m
      };
    } catch { /* probamos la siguiente estación */ }
  }
  return null;
}

/* ── Normalización: la misma forma que consume la app ─────────────── */
function normaliza(ciudad, d, ahora){
  const H = d.hourly, C = d.current, D = d.daily;
  const horas = H.time.map((iso, i) => ({
    instante: iso,
    temperatura: red(H.temperature_2m[i], 1),
    sensacion:   red(H.apparent_temperature[i], 1),
    humedad:     H.relative_humidity_2m[i],
    viento:      red(H.wind_speed_10m[i], 0),
    rachas:      red(H.wind_gusts_10m?.[i] ?? H.wind_speed_10m[i] * 1.4, 0),
    dirViento:   H.wind_direction_10m?.[i] ?? 0,
    precipitacion: red(H.precipitation[i] ?? 0, 1),
    probLluvia:  H.precipitation_probability?.[i] ?? 0,
    nubosidad:   H.cloud_cover[i],
    visibilidad: H.visibility?.[i] ?? 24000,
    codigo:      H.weather_code[i],
    esDeDia:     H.is_day[i] === 1
  }));

  // Referencia horaria más cercana a "ahora": visibilidad y probabilidad
  // solo existen en la serie horaria, no en la observación actual.
  const iRef = indiceMasCercano(H.time, ahora);
  const ref = horas[iRef] || horas[0];

  return {
    ...sinEstaciones(ciudad),
    actual: {
      instante: ahora.toISOString(),
      temperatura: red(C.temperature_2m, 1),
      sensacion:   red(C.apparent_temperature, 1),
      humedad:     C.relative_humidity_2m,
      viento:      red(C.wind_speed_10m, 0),
      rachas:      red(C.wind_gusts_10m, 0),
      dirViento:   C.wind_direction_10m,
      precipitacion: red(C.precipitation ?? 0, 1),
      probLluvia:  ref.probLluvia,
      nubosidad:   C.cloud_cover,
      visibilidad: ref.visibilidad,
      codigo:      C.weather_code,
      esDeDia:     C.is_day === 1
    },
    hoy: {
      max: red(D.temperature_2m_max[0], 0),
      min: red(D.temperature_2m_min[0], 0),
      probLluviaMax: D.precipitation_probability_max?.[0] ?? 0,
      precipTotal: red(D.precipitation_sum?.[0] ?? 0, 1),
      amanecer: D.sunrise[0],
      ocaso:    D.sunset[0]
    },
    horas
  };
}

/** Corrige el "ahora mismo" con lo que mide de verdad la estación. */
function aplicaObservacion(ciudad, obs){
  if (!obs) return ciudad;
  const a = { ...ciudad.actual };
  if (num(obs.temperatura)) a.temperatura = red(obs.temperatura, 1);
  if (num(obs.humedad))     a.humedad = Math.round(obs.humedad);
  if (num(obs.viento))      a.viento = red(obs.viento, 0);
  if (num(obs.rachas))      a.rachas = red(obs.rachas, 0);
  if (num(obs.dirViento))   a.dirViento = Math.round(obs.dirViento);
  if (num(obs.precipitacion)) a.precipitacion = red(obs.precipitacion, 1);
  if (num(obs.visibilidad)) a.visibilidad = Math.round(obs.visibilidad);
  // La sensación se recalcula con la temperatura medida, no la modelada
  if (num(obs.temperatura)){
    const v = a.viento ?? 0;
    a.sensacion = red(a.temperatura - (v > 14 ? (v - 14) * .10 : 0)
      + (a.temperatura > 24 && a.humedad > 75 ? 1.6 : 0), 1);
  }
  return { ...ciudad, actual: a, observacion: { estacion: obs.estacion, instante: obs.instante } };
}

const num = v => typeof v === 'number' && Number.isFinite(v);
const red = (v, d) => { if (!num(v)) return v; const f = 10 ** d; return Math.round(v * f) / f; };
const sinEstaciones = ({ estaciones, ...resto }) => resto;

function indiceMasCercano(tiempos, ahora){
  let mejor = 0, dif = Infinity;
  for (let i = 0; i < tiempos.length; i++){
    const d = Math.abs(new Date(tiempos[i]) - ahora);
    if (d < dif){ dif = d; mejor = i; }
  }
  return mejor;
}

/* ── Manejador ────────────────────────────────────────────────────── */
export default async function handler(req, res){
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ahora = new Date();
  try {
    const malla = await openMeteo();
    let ciudades = CIUDADES.map((c, i) => normaliza(c, malla[i], ahora));
    let origen = 'openmeteo';
    const avisos = [];

    const clave = process.env.AEMET_API_KEY;
    if (clave){
      const obs = await Promise.all(CIUDADES.map(c => observacion(c.estaciones, clave).catch(() => null)));
      const logradas = obs.filter(Boolean).length;
      if (logradas){
        ciudades = ciudades.map((c, i) => aplicaObservacion(c, obs[i]));
        origen = logradas === CIUDADES.length ? 'aemet' : 'aemet-parcial';
      } else {
        avisos.push('AEMET no devolvió observaciones; se usa solo el modelo.');
      }
    } else {
      avisos.push('Sin AEMET_API_KEY: se usa solo Open-Meteo.');
    }

    return res.status(200).json({ origen, instante: ahora.toISOString(), avisos, ciudades });
  } catch (err){
    return res.status(502).json({ error: 'No se han podido obtener los datos', detalle: String(err.message || err) });
  }
}
