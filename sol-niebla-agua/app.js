/* ═══════════════════════════════════════════════════════════════════
   SOL NIEBLA Y AGUA
   App personal del tiempo para Asturias central y costa.

   Orden del archivo:
     1) Configuración y ciudades
     2) Utilidades
     3) Capa de datos — proveedor simulado (mock)
     4) Capa de datos — proveedor real (Open-Meteo) y hueco para AEMET
     5) Motor — Índice Sol Niebla y Agua
     6) Motor — etiquetas, lectura del día y recomendación
     7) Presentación — render
     8) Estado, eventos y PWA

   La capa de datos devuelve SIEMPRE el mismo objeto normalizado, así que
   cambiar de datos simulados a datos reales o a AEMET no toca ni el motor
   ni el render: solo CONFIG.proveedor / Proveedores.
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1) Configuración y ciudades ──────────────────────────────────── */

const CONFIG = {
  // 'auto'  → intenta datos reales y cae a simulados si no hay red
  // 'openmeteo' → siempre datos reales   |   'mock' → siempre simulados
  proveedor: 'auto',
  rutaApi: '/api/tiempo',   // backend propio; si no existe, se cae a Open-Meteo
  horasVista: 12,          // franjas mostradas en "Próximas horas"
  zonaHoraria: 'Europe/Madrid',
  version: '2.0.0'
};

const CIUDADES = [
  { id:'oviedo', nombre:'Oviedo', zona:'interior', lat:43.3619, lon:-5.8494, altitud:232 },
  { id:'mieres', nombre:'Mieres', zona:'valle',    lat:43.2500, lon:-5.7756, altitud:209 },
  { id:'gijon',  nombre:'Gijón',  zona:'costa',    lat:43.5453, lon:-5.6615, altitud:5   }
];

const MODOS = {
  paseo: {
    nombre:'Paseo',
    nota:'Confort general y ausencia de lluvia.',
    pesos:{ lluvia:1.35, nubes:.45, visibilidad:.40, viento:.75, humedad:.45, confort:1.05, luz:.55 }
  },
  fotos: {
    nombre:'Fotos',
    nota:'Luz, visibilidad y cielos con carácter.',
    pesos:{ lluvia:.85, nubes:.70, visibilidad:1.15, viento:.30, humedad:.20, confort:.30, luz:1.35 }
  },
  visitas: {
    nombre:'Visitas',
    nota:'Poca lluvia, comodidad y estabilidad.',
    pesos:{ lluvia:1.55, nubes:.35, visibilidad:.45, viento:.65, humedad:.40, confort:.95, luz:.50 }
  },
  carretera: {
    nombre:'Carretera',
    nota:'Visibilidad, niebla, viento y agua en la calzada.',
    pesos:{ lluvia:1.15, nubes:.15, visibilidad:1.70, viento:1.05, humedad:.15, confort:.15, luz:.65 }
  }
};

const BANDAS = [
  { min:85, etiqueta:'Excelente',        tono:'sol'    },
  { min:70, etiqueta:'Muy aprovechable', tono:'sol'    },
  { min:50, etiqueta:'Aceptable',        tono:'niebla' },
  { min:30, etiqueta:'Día cerrado',      tono:'agua'   },
  { min:0,  etiqueta:'Muy mala ventana', tono:'agua'   }
];

/* ── 2) Utilidades ────────────────────────────────────────────────── */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const limita = (v, a, b) => Math.min(b, Math.max(a, v));
const redondea = (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; };
const interpola = (v, x1, x2, y1, y2) => y1 + (limita(v, Math.min(x1,x2), Math.max(x1,x2)) - x1) * (y2 - y1) / (x2 - x1);

const hhmm = f => f.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
const hh   = f => f.toLocaleTimeString('es-ES', { hour:'2-digit' }).replace(/\D+$/, '') + 'h';

/** Banda del índice (etiqueta + tono de color). */
function banda(indice){ return BANDAS.find(b => indice >= b.min) || BANDAS.at(-1); }

/** Color CSS asociado a un índice. */
function colorIndice(indice){
  const t = banda(indice).tono;
  return { sol:'var(--sol)', niebla:'var(--niebla)', agua:'var(--agua)' }[t];
}
function colorTenue(indice){
  const t = banda(indice).tono;
  return { sol:'var(--sol-tenue)', niebla:'var(--niebla-tenue)', agua:'var(--agua-tenue)' }[t];
}

/** Familia visual del cielo a partir del código WMO. */
function familiaCielo(codigo){
  if (codigo === 0) return 'sol';
  if (codigo === 1) return 'sol-nubes';
  if (codigo === 2) return 'nubes';
  if (codigo === 3) return 'cubierto';
  if (codigo === 45 || codigo === 48) return 'niebla';
  if (codigo >= 51 && codigo <= 57) return 'orbayu';
  if (codigo >= 61 && codigo <= 67) return 'lluvia';
  if (codigo >= 71 && codigo <= 77) return 'nieve';
  if (codigo >= 80 && codigo <= 82) return 'chubascos';
  if (codigo === 85 || codigo === 86) return 'nieve';
  if (codigo >= 95) return 'tormenta';
  return 'nubes';
}

const NOMBRE_CIELO = {
  'sol':'Despejado', 'sol-nubes':'Poco nuboso', 'nubes':'Intervalos nubosos',
  'cubierto':'Cubierto', 'niebla':'Niebla', 'orbayu':'Orbayu',
  'lluvia':'Lluvia', 'chubascos':'Chubascos', 'tormenta':'Tormenta', 'nieve':'Nieve'
};

/** Icono de cielo en SVG en línea (hereda el color del sistema). */
function iconoCielo(codigo, esDeDia = true, clase = 'ico-cielo'){
  const f = familiaCielo(codigo);
  const astro = esDeDia
    ? '<circle cx="9" cy="9" r="3.6" class="s"/><path class="s" d="M9 2v1.6M9 14.4V16M16 9h-1.6M3.6 9H2M13.9 4.1l-1.1 1.1M5.2 12.8l-1.1 1.1M13.9 13.9l-1.1-1.1M5.2 5.2 4.1 4.1"/>'
    : '<path class="s" d="M13.4 10.6A5.2 5.2 0 0 1 7 4.2a5.6 5.6 0 1 0 6.4 6.4Z"/>';
  const nube = '<path class="n" d="M7.4 20h9.2a3.6 3.6 0 0 0 .3-7.2 5.2 5.2 0 0 0-9.9-1A3.6 3.6 0 0 0 7.4 20Z"/>';
  const cuerpo = {
    'sol':        esDeDia
      ? '<circle cx="12" cy="12" r="5" class="s"/><path class="s" d="M12 2.6v2M12 19.4v2M21.4 12h-2M4.6 12h-2M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4M18.6 18.6l-1.4-1.4M6.8 6.8 5.4 5.4"/>'
      : '<path class="s" d="M17.5 14.2A7 7 0 0 1 9.8 6.5a7.6 7.6 0 1 0 7.7 7.7Z"/>',
    'sol-nubes':  astro + nube,
    'nubes':      astro + nube,
    'cubierto':   '<path class="n" d="M6 10.4a4.6 4.6 0 0 1 8.8-1.5A3.4 3.4 0 0 1 19 12.2"/>' + nube,
    'niebla':     '<path class="n" d="M4 8h16M6 12h14M3 16h13M7 20h12"/>',
    'orbayu':     nube + '<path class="a" d="M9 21.6v1.2M13 21.6v1.2M17 21.6v1.2" stroke-dasharray="0.1 3"/>',
    'lluvia':     nube + '<path class="a" d="M9.4 21.4 8.4 23.6M13.2 21.4l-1 2.2M17 21.4l-1 2.2"/>',
    'chubascos':  astro + nube + '<path class="a" d="M10 21.4 9 23.6M15 21.4l-1 2.2"/>',
    'tormenta':   nube + '<path class="s" d="m13 20.6-2.4 2.6h2.6l-1.4 2"/><path class="a" d="M17.4 21.2l-1 2.2"/>',
    'nieve':      nube + '<path class="a" d="M9.6 22.4h.01M13.2 22.4h.01M16.8 22.4h.01" stroke-width="2.4"/>'
  }[f];
  return `<svg viewBox="0 0 24 26" class="${clase}" aria-hidden="true" width="100%" height="100%">${cuerpo}</svg>`;
}

/** Rumbo cardinal desde grados. */
function rumbo(grados){
  const r = ['N','NE','E','SE','S','SO','O','NO'];
  return r[Math.round(((grados % 360) / 45)) % 8];
}

/** Amanecer y ocaso (aproximación NOAA) para una fecha y coordenada. */
function horasSolares(fecha, lat, lon){
  const inicioAnio = Date.UTC(fecha.getFullYear(), 0, 0);
  const dia = Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - inicioAnio) / 864e5);
  const g = (2 * Math.PI / 365) * (dia - 1);
  const eq = 229.18 * (0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g)
            - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g));
  const dec = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g)
            - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g)
            - 0.002697*Math.cos(3*g) + 0.00148*Math.sin(3*g);
  const latR = lat * Math.PI / 180;
  const cosH = Math.cos(90.833 * Math.PI / 180) / (Math.cos(latR) * Math.cos(dec)) - Math.tan(latR) * Math.tan(dec);
  const ha = Math.acos(limita(cosH, -1, 1)) * 180 / Math.PI;
  const base = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const desdeUTC = (min) => new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, min));
  void base;
  return { amanecer: desdeUTC(720 - 4*(lon + ha) - eq), ocaso: desdeUTC(720 - 4*(lon - ha) - eq) };
}

/* ── 3) Capa de datos — proveedor simulado ────────────────────────── */
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

function generarMock(ciudad, ahora, sal){
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

const ProveedorMock = {
  id:'mock',
  etiqueta:'Simulados',
  async obtener(sal = 0){
    const ahora = new Date();
    await new Promise(r => setTimeout(r, 260));           // latencia realista
    return { ciudades: CIUDADES.map(c => generarMock(c, ahora, sal)), origen:'mock', instante: ahora };
  }
};

/* ── 4) Capa de datos — proveedor real (Open-Meteo) ───────────────── */
/* Sin clave de API. Para AEMET (OpenData) basta con crear otro objeto con
   la misma forma { id, etiqueta, obtener() } y añadirlo a Proveedores.   */

const ProveedorOpenMeteo = {
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

const ProveedorApi = {
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
function revivirFechas(d){
  d.instante = new Date(d.instante);
  d.ciudades.forEach(c => {
    c.actual.instante = new Date(c.actual.instante);
    c.hoy.amanecer = new Date(c.hoy.amanecer);
    c.hoy.ocaso = new Date(c.hoy.ocaso);
    c.horas.forEach(h => h.instante = new Date(h.instante));
  });
  return d;
}

const Proveedores = { mock: ProveedorMock, openmeteo: ProveedorOpenMeteo, api: ProveedorApi };

/* Cascada por origen elegido. 'auto' baja un peldaño cada vez que algo
   falla, para que la app siempre tenga algo que enseñar.               */
const CASCADAS = {
  auto:      ['api', 'openmeteo', 'mock'],
  api:       ['api'],
  openmeteo: ['openmeteo'],
  mock:      ['mock']
};

/* Distintas fuentes pueden contradecirse: el código del cielo viene del
   modelo y la visibilidad puede venir medida por una estación. Aquí se
   dejan coherentes antes de que nadie los lea, y se redondea lo que
   luego se enseña como entero.                                         */
function reconcilia(p){
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
async function cargarDatos(sal = 0){
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

/* ── 5) Motor — Índice Sol Niebla y Agua ──────────────────────────── */
/* 0-100. Se parte de 100 y se restan penalizaciones ponderadas por modo.
   Después se aplican matices (hora dorada, cielos con carácter) y topes
   duros para situaciones que no admiten media: niebla densa, agua fuerte. */

function calcularIndice(punto, modo, ciudad){
  const p = MODOS[modo].pesos;

  // Agua: la probabilidad avisa, la intensidad real es la que arruina el plan
  const penLluvia = limita(punto.probLluvia * .45 + limita(punto.precipitacion, 0, 4) / 4 * 55, 0, 100);

  // Nubes: en fotos un cielo totalmente limpio o totalmente plomizo pierde;
  // lo interesante está entre el 25 % y el 65 % de nubosidad.
  const penNubes = modo === 'fotos'
    ? (punto.nubosidad < 25 ? interpola(punto.nubosidad, 0, 25, 26, 4)
      : punto.nubosidad <= 65 ? 4
      : interpola(punto.nubosidad, 65, 100, 4, 62))
    : interpola(punto.nubosidad, 0, 100, 0, 38);

  // Visibilidad: la curva se dispara por debajo de 2 km (niebla asturiana)
  const v = punto.visibilidad;
  const penVisib = v >= 20000 ? 0
    : v >= 10000 ? interpola(v, 20000, 10000, 0, 7)
    : v >= 5000  ? interpola(v, 10000, 5000, 7, 20)
    : v >= 2000  ? interpola(v, 5000, 2000, 20, 44)
    : v >= 1000  ? interpola(v, 2000, 1000, 44, 66)
    : v >= 500   ? interpola(v, 1000, 500, 66, 82)
    : 94;

  const penViento  = limita((punto.viento - 12) * 1.9 + Math.max(0, punto.rachas - 35) * 1.1, 0, 100);
  const penHumedad = limita((punto.humedad - 82) * 1.7, 0, 26);

  // Confort térmico: óptimo entre 15 y 23 °C de sensación
  const s = punto.sensacion;
  const desvio = s < 15 ? 15 - s : s > 23 ? s - 23 : 0;
  const penConfort = limita(desvio * 3.4, 0, 55);

  // Luz: la noche no invalida conducir, pero sí pasear o fotografiar
  const penLuz = punto.esDeDia ? 0 : (modo === 'carretera' ? 22 : modo === 'visitas' ? 45 : 62);

  const pares = [
    [p.lluvia, penLluvia], [p.nubes, penNubes], [p.visibilidad, penVisib],
    [p.viento, penViento], [p.humedad, penHumedad], [p.confort, penConfort], [p.luz, penLuz]
  ];
  // Los factores se combinan de forma saturante, no promediando: dos cosas
  // malas se acumulan y una muy mala no queda diluida por las que van bien
  // (una media ponderada daría "excelente" a un día con 75 % de lluvia).
  const pesoMax = Math.max(...pares.map(([w]) => w));
  const bueno = pares.reduce((t, [w, x]) => t * (1 - limita(x, 0, 100) / 100 * (w / pesoMax)), 1);

  let indice = 100 * bueno;

  // Matices por modo
  if (modo === 'fotos'){
    const dorada = horaDorada(punto, ciudad);
    if (dorada && v > 8000 && punto.precipitacion === 0) indice += 9;
    if (punto.nubosidad >= 30 && punto.nubosidad <= 60 && v > 15000) indice += 4;
  }
  if (modo === 'carretera' && punto.viento < 14 && punto.precipitacion === 0 && v > 20000) indice += 3;
  if (modo === 'visitas' && punto.probLluvia < 15 && punto.viento < 16) indice += 4;

  // Topes duros: hay condiciones que ninguna media puede maquillar
  if (v < 600) indice = Math.min(indice, modo === 'carretera' ? 14 : 34);
  else if (v < 1500 && modo === 'carretera') indice = Math.min(indice, 32);
  if (punto.precipitacion >= 2) indice = Math.min(indice, 30);
  else if (punto.precipitacion >= .8) indice = Math.min(indice, 48);
  if (punto.rachas >= 60) indice = Math.min(indice, 38);

  return Math.round(limita(indice, 0, 100));
}

/** ¿Estamos en hora dorada? (±70 min de amanecer u ocaso) */
function horaDorada(punto, ciudad){
  if (!ciudad?.hoy) return false;
  const t = punto.instante.getTime();
  const margen = 70 * 60e3;
  return Math.abs(t - ciudad.hoy.amanecer.getTime()) < margen
      || Math.abs(t - ciudad.hoy.ocaso.getTime()) < margen;
}

/** Enriquece cada ciudad con índice actual, serie horaria y ventana buena. */
function evaluar(datos, modo){
  const ahora = datos.instante;
  const ciudades = datos.ciudades.map(c => {
    const indice = calcularIndice(c.actual, modo, c);
    const futuras = c.horas
      .filter(h => h.instante >= new Date(ahora.getTime() - 30 * 60e3))
      .slice(0, CONFIG.horasVista)
      .map(h => ({ ...h, indice: calcularIndice(h, modo, c) }));
    return { ...c, indice, futuras, ventana: buscarVentana(futuras, indice),
      bajon: buscarBajon(futuras, indice), etiquetas: [] };
  });

  ciudades.sort((a, b) => b.indice - a.indice);
  const mejor = ciudades[0];
  const costa    = ciudades.find(c => c.zona === 'costa');
  const interior = ciudades.filter(c => c.zona !== 'costa');
  const mediaInterior = interior.reduce((s, c) => s + c.indice, 0) / interior.length;

  ciudades.forEach(c => { c.etiquetas = etiquetasDe(c, mejor, costa, mediaInterior); });

  return { ...datos, ciudades, mejor, costa, interior, mediaInterior, modo };
}

/** Primer tramo de al menos 2 h seguidas con índice notablemente mejor. */
function buscarVentana(futuras, indiceActual){
  const umbral = Math.max(66, indiceActual + 10);
  for (let i = 0; i < futuras.length - 1; i++){
    if (futuras[i].indice >= umbral && futuras[i + 1].indice >= umbral){
      let fin = i + 1;
      while (fin + 1 < futuras.length && futuras[fin + 1].indice >= umbral - 6) fin++;
      return { desde: futuras[i].instante, hasta: futuras[fin].instante, indice: futuras[i].indice, iDesde: i, iHasta: fin };
    }
  }
  return null;
}

/** Hora a la que las condiciones se estropean dentro de la vista. */
function buscarBajon(futuras, indiceActual){
  const suelo = Math.min(indiceActual - 15, 62);
  const i = futuras.findIndex((h, j) => j > 0 && h.indice <= suelo);
  return i > 0 ? { desde: futuras[i].instante, indice: futuras[i].indice } : null;
}

/* ── 6) Motor — etiquetas, lectura del día y recomendación ────────── */

function etiquetasDe(c, mejor, costa, mediaInterior){
  const a = c.actual, et = [];
  const b = banda(c.indice);

  if (c.indice >= 85) et.push({ txt:'Excelente', tono:'sol' });
  else if (c.indice >= 70) et.push({ txt:'Muy aprovechable', tono:'sol' });

  if (a.visibilidad < 2000) et.push({ txt:'Ojo con niebla', tono:'niebla' });
  else if (c.futuras.some(h => h.visibilidad < 1500 && h.instante < new Date(Date.now() + 4 * 36e5)))
    et.push({ txt:'Niebla en camino', tono:'niebla' });

  if (a.nubosidad > 75 && a.probLluvia < 30 && a.precipitacion === 0)
    et.push({ txt:'Gris pero estable', tono:'niebla' });

  if (a.probLluvia >= 70 || a.precipitacion >= .5) et.push({ txt:'Agua segura', tono:'agua' });
  else if (a.probLluvia >= 45) et.push({ txt:'Agua probable', tono:'agua' });

  if (c.ventana && c.indice < 70) et.push({ txt:`Ventana buena ${hh(c.ventana.desde)}`, tono:'sol' });
  if (c.indice >= 70 && c.bajon) et.push({ txt:`Aprovecha hasta ${hh(c.bajon.desde)}`, tono:'sol' });
  if (a.rachas >= 50) et.push({ txt:'Viento fuerte', tono:'agua' });

  if (c.id === mejor.id){
    const esCosta = c.zona === 'costa';
    const margen = esCosta ? c.indice - mediaInterior : c.indice - (costa?.indice ?? 0);
    if (margen >= 6) et.push({ txt: esCosta ? 'Mejor ahora en costa' : 'Mejor ahora en interior', tono:'sol' });
  }

  if (!et.length) et.push({ txt: b.etiqueta, tono: b.tono });
  return et.slice(0, 4);
}

/** Frase de cabecera: qué está pasando hoy en Asturias, en una línea. */
function lecturaDelDia(ev){
  const { mejor, ciudades, costa } = ev;
  const conNiebla = ciudades.filter(c => c.actual.visibilidad < 2000);
  const nieblaPronto = ciudades.filter(c => c.futuras.slice(0, 5).some(h => h.visibilidad < 1500));
  const lluviosas = ciudades.filter(c => c.actual.probLluvia >= 55 || c.actual.precipitacion > 0);
  const mediaLluvia = Math.round(ciudades.reduce((s, c) => s + c.actual.probLluvia, 0) / ciudades.length);
  const mediaNubes  = Math.round(ciudades.reduce((s, c) => s + c.actual.nubosidad, 0) / ciudades.length);

  if (conNiebla.length)
    return `Niebla ahora en ${lista(conNiebla.map(c => c.nombre))}. ${mejor.nombre} es hoy la apuesta clara.`;
  if (lluviosas.length === 3)
    return `Agua en toda Asturias central. ${mejor.nombre} aguanta algo mejor, pero es día de paraguas.`;
  if (lluviosas.length)
    return `Llueve en ${lista(lluviosas.map(c => c.nombre))} y se salva ${mejor.nombre}. ${costa && costa.indice > ev.mediaInterior ? 'La costa gana al interior.' : 'El interior gana a la costa.'}`;
  if (nieblaPronto.length)
    return `Cielos manejables ahora, con niebla asomando en ${lista(nieblaPronto.map(c => c.nombre))}. Aprovecha temprano.`;
  if (mediaNubes > 78 && mediaLluvia < 30)
    return `Cubierto pero estable en las tres. Día gris de andar por casa: se puede salir sin miedo.`;
  if (mejor.indice >= 82)
    return `Día grande en Asturias central. ${mejor.nombre} está para exprimirlo ahora mismo.`;
  if (mejor.indice >= 65)
    return `Buen rato en ${mejor.nombre}, con el resto un escalón por debajo. Ventana aprovechable.`;
  return `Día cerrado en las tres. Si hay que salir, ${mejor.nombre} es lo menos malo.`;
}

function lista(nombres){
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres.at(-1);
}

/** Recomendación accionable en función del modo y del momento. */
function recomendacion(ev){
  const { mejor, modo, ciudades } = ev;
  const a = mejor.actual;
  const nieblaCarretera = ciudades.filter(c => c.actual.visibilidad < 1500);
  const nieblaPronto = ciudades.filter(c => c.futuras.slice(0, 4).some(h => h.visibilidad < 1200));

  if (modo === 'carretera' && nieblaCarretera.length)
    return { icono:'aviso', titulo:'Evita carretera por niebla',
      texto:`Visibilidad bajo mínimos en ${lista(nieblaCarretera.map(c => c.nombre))}. Si tienes que ir, luces antiniebla y margen de tiempo.` };

  if (modo === 'carretera' && nieblaPronto.length)
    return { icono:'aviso', titulo:'Sal antes de que cierre',
      texto:`Se espera niebla en ${lista(nieblaPronto.map(c => c.nombre))} en las próximas horas. Mejor hacer el trayecto ya.` };

  if (mejor.indice >= 74)
    return { icono:'salir', titulo:'Sal ahora',
      texto:`${mejor.nombre} está en su mejor momento (${mejor.indice}/100). ${
        mejor.bajon ? `Se estropea sobre las ${hhmm(mejor.bajon.desde)}: no lo dejes para luego.`
        : mejor.ventana ? `Aguanta bien hasta las ${hhmm(mejor.ventana.hasta)}.`
        : 'Es el rato bueno del día.'}` };

  if (mejor.ventana)
    return { icono:'esperar', titulo: horasHasta(mejor.ventana.desde) <= 1 ? 'Espera una hora' : `Espera a las ${hhmm(mejor.ventana.desde)}`,
      texto:`Ahora ${mejor.nombre} va justo (${mejor.indice}/100). De ${hhmm(mejor.ventana.desde)} a ${hhmm(mejor.ventana.hasta)} sube a ${mejor.ventana.indice}/100.` };

  if (a.probLluvia >= 55 || a.precipitacion > 0){
    const textos = {
      visitas:   `${a.probLluvia}% de lluvia en ${mejor.nombre}. Avisa al cliente, aparca cerca y deja los exteriores para el final.`,
      carretera: `${a.probLluvia}% de lluvia en ${mejor.nombre}. Calzada mojada: distancia de sobra y ojo a las salidas de túnel.`,
      fotos:     `${a.probLluvia}% de lluvia en ${mejor.nombre}. Protege el equipo o cambia a interiores; la luz no compensa el riesgo.`,
      paseo:     `${a.probLluvia}% de lluvia en ${mejor.nombre}. Sin ventana limpia en las próximas ${CONFIG.horasVista} horas.`
    };
    return { icono:'agua', titulo: modo === 'carretera' ? 'Conduce con margen' : 'Lleva paraguas', texto: textos[modo] };
  }

  if (modo === 'fotos' && mejor.actual.esDeDia)
    return { icono:'esperar', titulo:'Mejor a última hora',
      texto:`Luz plana y poco interesante ahora. Prueba cerca del ocaso (${hhmm(mejor.hoy.ocaso)}) en ${mejor.nombre}.` };

  return { icono:'aviso', titulo:'Día para plan bajo techo',
    texto:`Ninguna de las tres pasa de ${Math.max(...ciudades.map(c => c.indice))}/100 en las próximas horas. Deja lo de fuera para mañana.` };
}

function horasHasta(fecha){ return (fecha - Date.now()) / 36e5; }

const ICONOS_CONSEJO = {
  salir:   '<path d="M5 12h13M13 6l6 6-6 6"/>',
  esperar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  agua:    '<path d="M12 3.5s6 6.5 6 10.4A6 6 0 0 1 6 13.9C6 10 12 3.5 12 3.5Z"/>',
  aviso:   '<path d="M12 4.5 21 19.5H3L12 4.5Z"/><path d="M12 10v4M12 17h.01"/>'
};

/* ── 7) Presentación — render ─────────────────────────────────────── */

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
  $('#btn-refrescar')?.addEventListener('click', () => refrescar({ manual:true }));
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
function pintarHeroError(mensaje){
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
  $('#btn-refrescar').addEventListener('click', () => refrescar({ manual:true }));
  $('#app').setAttribute('aria-busy', 'false');
}

/* ── Ranking: las tres ciudades como una sola unidad ──────────────── */
function pintarRanking(ev){
  const ganaCosta = ev.costa && ev.costa.indice > ev.mediaInterior;
  const dif = Math.abs(Math.round((ev.costa?.indice ?? 0) - ev.mediaInterior));
  $('#ranking').innerHTML = ev.ciudades.map(c => `
    <button type="button" class="fila" data-ciudad="${c.id}" data-foco="${c.id === Estado.ciudadFoco ? 'si' : 'no'}"
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

  $$('#ranking .fila').forEach(el => el.addEventListener('click', () => enfocar(el.dataset.ciudad)));
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
  const c = ev.ciudades.find(x => x.id === Estado.ciudadFoco) || ev.mejor;
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
        data-foco="${c.id === Estado.ciudadFoco ? 'si' : 'no'}"
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

  $$('.ciudad').forEach(el => el.addEventListener('click', () => enfocar(el.dataset.ciudad, true)));
}

/** Cambia la ciudad sobre la que se leen las próximas horas. */
function enfocar(id, desplaza = false){
  Estado.ciudadFoco = id;
  guarda('sna.ciudad', id);
  $$('[data-ciudad]').forEach(x => x.dataset.foco = x.dataset.ciudad === id ? 'si' : 'no');
  pintarFranjas(Estado.evaluacion);
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

const media = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
const signo = (v, d) => (v >= 0 ? '+' : '−') + redondea(Math.abs(v), d).toFixed(d);

/* ── Orquestador del render ───────────────────────────────────────── */
function pintar(ev){
  Estado.evaluacion = ev;
  if (!ev.ciudades.some(c => c.id === Estado.ciudadFoco)) Estado.ciudadFoco = ev.mejor.id;
  pintarHero(ev); pintarRanking(ev); pintarFranjas(ev);
  pintarCiudades(ev); pintarComparativa(ev);
  $('#app').setAttribute('aria-busy', 'false');
}

/* ── 8) Estado, ajustes, eventos y PWA ────────────────────────────── */

const FUENTES = [
  { id:'auto',      nombre:'Automático',
    nota:'AEMET si está disponible, luego Open-Meteo y, sin red, simulados. Recomendado.' },
  { id:'api',       nombre:'AEMET + modelo',
    nota:'Observación real de la estación más cercana sobre la previsión horaria. Necesita el backend desplegado.' },
  { id:'openmeteo', nombre:'Open-Meteo directo',
    nota:'Del navegador a Open-Meteo, sin pasar por el backend.' },
  { id:'mock',      nombre:'Simulados',
    nota:'Escenarios plausibles de Asturias, sin red. Útil para probar los cuatro modos.' }
];

const Estado = {
  modo: lee('sna.modo', 'paseo'),
  tema: lee('sna.tema', 'auto'),
  fuente: lee('sna.fuente', 'auto'),
  ciudadFoco: lee('sna.ciudad', 'oviedo'),
  datos: null, evaluacion: null, sal: 0, cargando: false
};

function lee(k, def){ try { return localStorage.getItem(k) ?? def; } catch { return def; } }
function guarda(k, v){ try { localStorage.setItem(k, v); } catch {} }

function brindis(txt){
  const el = $('#brindis');
  el.textContent = txt;
  el.setAttribute('data-visible', '');
  clearTimeout(brindis._t);
  brindis._t = setTimeout(() => el.removeAttribute('data-visible'), 2600);
}

function aplicaTema(){
  document.documentElement.dataset.tema = Estado.tema;
  const oscuro = Estado.tema === 'oscuro'
    || (Estado.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach(m => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = oscuro ? '#0b0d10' : '#f4f3ef';
  document.head.appendChild(m);
  $$('#op-tema .opcion').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === Estado.tema)));
}

function aplicaModo(){
  const modos = Object.keys(MODOS);
  $$('.modo').forEach(b => b.setAttribute('aria-selected', String(b.dataset.modo === Estado.modo)));
  $('#modos-indicador').style.transform = `translateX(${modos.indexOf(Estado.modo) * 100}%)`;
  $('#modo-nota').textContent = MODOS[Estado.modo].nota;
}

function aplicaFuente(){
  CONFIG.proveedor = Estado.fuente;
  $$('#op-fuente .opcion').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fuente === Estado.fuente)));
  $('#nota-fuente').textContent = FUENTES.find(f => f.id === Estado.fuente)?.nota ?? '';
}

function montarAjustes(){
  $('#op-fuente').innerHTML = FUENTES.map(f =>
    `<button type="button" class="opcion" role="radio" aria-checked="false" data-fuente="${f.id}">
      ${f.nombre}<small>${f.nota}</small></button>`).join('');
  $('#version-app').textContent = `Sol Niebla y Agua ${CONFIG.version}`;

  $('#op-tema').addEventListener('click', e => {
    const b = e.target.closest('.opcion'); if (!b) return;
    Estado.tema = b.dataset.tema; guarda('sna.tema', Estado.tema); aplicaTema();
  });
  $('#op-fuente').addEventListener('click', e => {
    const b = e.target.closest('.opcion'); if (!b || b.dataset.fuente === Estado.fuente) return;
    Estado.fuente = b.dataset.fuente; guarda('sna.fuente', Estado.fuente);
    aplicaFuente(); refrescar({ manual:true });
  });
  $('#btn-limpiar').addEventListener('click', async () => {
    try { localStorage.removeItem('sna.cache'); } catch {}
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    brindis('Caché vaciada');
    refrescar({ manual:true });
  });

  $('#btn-ajustes').addEventListener('click', () => hoja(true));
  $('#btn-cerrar-ajustes').addEventListener('click', () => hoja(false));
  $('#velo').addEventListener('click', () => hoja(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ajustes').hidden) hoja(false); });
}

function hoja(abrir){
  const h = $('#ajustes'), v = $('#velo');
  if (abrir){
    h.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { h.dataset.abierto = ''; v.dataset.abierto = ''; });
    h.querySelector('.opcion')?.focus();
  } else {
    delete h.dataset.abierto; delete v.dataset.abierto;
    setTimeout(() => { h.hidden = true; v.hidden = true; }, 340);
    $('#btn-ajustes').focus();
  }
}

async function refrescar({ manual = false } = {}){
  if (Estado.cargando) return;
  Estado.cargando = true;
  $('#btn-refrescar')?.setAttribute('data-cargando', '');
  try {
    if (manual) Estado.sal++;
    const datos = await cargarDatos(Estado.sal);
    Estado.datos = datos;
    guardaCache(datos);
    pintar(evaluar(datos, Estado.modo));
    if (manual) brindis(datos.origen === 'mock' ? 'Datos simulados actualizados' : 'Datos actualizados');
  } catch (err){
    console.error('[SNA]', err);
    if (Estado.datos) brindis('No se han podido actualizar los datos');
    else pintarHeroError('No hay conexión ni datos guardados. Vuelve a intentarlo o cambia el origen a "simulados" en Ajustes.');
  } finally {
    Estado.cargando = false;
    $('#btn-refrescar')?.removeAttribute('data-cargando');
  }
}

/* Caché local: la app pinta al instante aunque se abra sin cobertura. */
function guardaCache(datos){
  try { localStorage.setItem('sna.cache', JSON.stringify({ ts: Date.now(), datos })); } catch {}
}
function leeCache(){
  try {
    const c = JSON.parse(localStorage.getItem('sna.cache') || 'null');
    if (!c || Date.now() - c.ts > 6 * 36e5) return null;
    return revivirFechas(c.datos);
  } catch { return null; }
}

function arrancar(){
  // Accesos directos del manifiesto: app.html?modo=carretera
  const modoUrl = new URLSearchParams(location.search).get('modo');
  if (modoUrl && MODOS[modoUrl]){ Estado.modo = modoUrl; guarda('sna.modo', modoUrl); }

  montarAjustes();
  aplicaTema();
  aplicaModo();
  aplicaFuente();

  // Pintado inmediato desde caché mientras llegan los datos frescos
  const cache = leeCache();
  if (cache){ Estado.datos = cache; pintar(evaluar(cache, Estado.modo)); }

  $('#modos').addEventListener('click', e => {
    const b = e.target.closest('.modo');
    if (!b || b.dataset.modo === Estado.modo) return;
    Estado.modo = b.dataset.modo;
    guarda('sna.modo', Estado.modo);
    aplicaModo();
    if (Estado.datos) pintar(evaluar(Estado.datos, Estado.modo));
  });

  $('#modos').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const modos = Object.keys(MODOS);
    const i = (modos.indexOf(Estado.modo) + (e.key === 'ArrowRight' ? 1 : -1) + modos.length) % modos.length;
    const b = $(`.modo[data-modo="${modos[i]}"]`);
    b.click(); b.focus();
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicaTema);

  // Al volver a la app tras un rato, los datos se refrescan solos
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible'
      && Date.now() - (Estado.datos?.instante?.getTime() ?? 0) > 15 * 60e3) refrescar();
  });

  refrescar().finally(() => {
    setTimeout(() => {
      const s = $('#splash');
      s.dataset.fuera = '';
      setTimeout(() => s.remove(), 500);
    }, cache ? 250 : 560);
  });
}

document.addEventListener('DOMContentLoaded', arrancar);

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('[SNA] SW:', e));
  });
}
