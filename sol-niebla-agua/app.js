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
  horasVista: 12,          // franjas mostradas en "Próximas horas"
  zonaHoraria: 'Europe/Madrid',
  version: '1.0.0'
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

const Proveedores = { mock: ProveedorMock, openmeteo: ProveedorOpenMeteo };

/** Punto único de entrada de datos para el resto de la app. */
async function cargarDatos(sal = 0){
  if (CONFIG.proveedor === 'mock') return Proveedores.mock.obtener(sal);
  try {
    return await Proveedores.openmeteo.obtener();
  } catch (err){
    if (CONFIG.proveedor === 'openmeteo') throw err;
    console.warn('[SNA] Sin datos reales, uso simulados:', err.message);
    return Proveedores.mock.obtener(sal);
  }
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

function anillo(indice, tam = 62, grosor = 5){
  const r = (tam - grosor) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - indice / 100);
  return `<div class="anillo" style="--acento:${colorIndice(indice)}; width:${tam}px; height:${tam}px">
    <svg width="${tam}" height="${tam}" aria-hidden="true">
      <circle class="anillo__fondo" cx="${tam/2}" cy="${tam/2}" r="${r}" stroke-width="${grosor}"/>
      <circle class="anillo__valor" cx="${tam/2}" cy="${tam/2}" r="${r}" stroke-width="${grosor}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
    <span class="anillo__num num" style="font-size:${Math.round(tam * .34)}px">${indice}</span>
  </div>`;
}

function pintarTitular(ev){
  $('#titular-frase').textContent = lecturaDelDia(ev);
  $('#ultima-actualizacion').textContent = `Actualizado a las ${hhmm(ev.instante)}`;
  const sello = $('#sello-fuente');
  const real = ev.origen === 'openmeteo';
  sello.dataset.tipo = real ? 'real' : 'mock';
  sello.textContent = real ? 'En directo' : 'Simulados';
  sello.title = real ? 'Datos de Open-Meteo' : 'Datos simulados (sin conexión o modo demo)';
  $('#pie-fuente').textContent = real
    ? 'Datos: Open-Meteo · Índice Sol Niebla y Agua, cálculo propio'
    : 'Datos simulados · Índice Sol Niebla y Agua, cálculo propio';
}

function pintarAhora(ev){
  $('#ahora').innerHTML = CIUDADES.map(base => {
    const c = ev.ciudades.find(x => x.id === base.id);
    return `<div class="ahora__celda">
      <p class="ahora__ciudad">${c.nombre}</p>
      <p class="ahora__temp num">${Math.round(c.actual.temperatura)}°</p>
      <p class="ahora__ind num" style="color:${colorIndice(c.indice)}">${c.indice}<span style="opacity:.5">/100</span></p>
      <p class="ahora__cielo">${NOMBRE_CIELO[familiaCielo(c.actual.codigo)]}</p>
    </div>`;
  }).join('');
}

function pintarMejor(ev){
  const m = ev.mejor, r = recomendacion(ev);
  const b = banda(m.indice);
  $('#mejor').innerHTML = `<article class="tarjeta mejor"
      style="--acento:${colorIndice(m.indice)}; --acento-tenue:${colorTenue(m.indice)}">
    <div class="mejor__cab">
      <div class="mejor__txt">
        <p class="mejor__donde">Ahora mismo, mejor en</p>
        <h3 class="mejor__ciudad">${m.nombre}</h3>
        <p class="mejor__sub">${b.etiqueta} para ${MODOS[ev.modo].nombre.toLowerCase()} · ${NOMBRE_CIELO[familiaCielo(m.actual.codigo)].toLowerCase()}, ${Math.round(m.actual.temperatura)}° y ${m.actual.probLluvia}% de lluvia.</p>
      </div>
      ${anillo(m.indice, 72, 6)}
    </div>
    <div class="mejor__consejo">
      <span class="mejor__consejo-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_CONSEJO[r.icono]}</svg></span>
      <div>
        <p class="mejor__consejo-tit">${r.titulo}</p>
        <p class="mejor__consejo-txt">${r.texto}</p>
      </div>
    </div>
  </article>`;
}

function pintarCiudades(ev){
  $('#ciudades').innerHTML = ev.ciudades.map(c => {
    const a = c.actual;
    return `<button type="button" class="tarjeta ciudad" data-ciudad="${c.id}"
        data-foco="${c.id === Estado.ciudadFoco ? 'si' : 'no'}"
        aria-label="${c.nombre}, índice ${c.indice} sobre 100. Ver próximas horas">
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
        <div class="metrica"><p class="metrica__k">Lluvia</p><p class="metrica__v num">${a.probLluvia}%</p></div>
        <div class="metrica"><p class="metrica__k">Sensación</p><p class="metrica__v num">${Math.round(a.sensacion)}°</p></div>
        <div class="metrica"><p class="metrica__k">Viento</p><p class="metrica__v num">${a.viento}<span style="font-size:10px"> km/h ${rumbo(a.dirViento)}</span></p></div>
        <div class="metrica"><p class="metrica__k">Humedad</p><p class="metrica__v num">${a.humedad}%</p></div>
      </div>
      <div class="etiquetas">
        ${c.etiquetas.map(e => `<span class="etiqueta" data-tono="${e.tono}">${e.txt}</span>`).join('')}
      </div>
    </button>`;
  }).join('');

  $$('.ciudad').forEach(el => el.addEventListener('click', () => {
    Estado.ciudadFoco = el.dataset.ciudad;
    guarda('sna.ciudad', Estado.ciudadFoco);
    $$('.ciudad').forEach(x => x.dataset.foco = x === el ? 'si' : 'no');
    pintarFranjas(Estado.evaluacion);
    $('#franjas').scrollIntoView({ behavior:'smooth', block:'center' });
  }));
}

function pintarComparativa(ev){
  const orden = ev.ciudades;
  const costa = ev.costa, interior = ev.interior;
  const dTemp = costa ? costa.actual.temperatura - media(interior.map(c => c.actual.temperatura)) : 0;
  const dLluvia = costa ? costa.actual.probLluvia - media(interior.map(c => c.actual.probLluvia)) : 0;
  const dViento = costa ? costa.actual.viento - media(interior.map(c => c.actual.viento)) : 0;
  const ganaCosta = costa && costa.indice > ev.mediaInterior;

  $('#comparativa').innerHTML = `
    ${orden.map(c => `<div class="barra" style="--acento:${colorIndice(c.indice)}">
      <span class="barra__n">${c.nombre}</span>
      <span class="barra__pista"><span class="barra__relleno" style="width:${c.indice}%"></span></span>
      <span class="barra__v num">${c.indice}</span>
    </div>`).join('')}
    <div class="deltas">
      <div class="delta"><p class="delta__k">Temp. costa</p><p class="delta__v num">${signo(dTemp, 1)}°</p></div>
      <div class="delta"><p class="delta__k">Lluvia costa</p><p class="delta__v num">${signo(dLluvia, 0)}%</p></div>
      <div class="delta"><p class="delta__k">Viento costa</p><p class="delta__v num">${signo(dViento, 0)}</p></div>
    </div>
    <p class="comparativa__nota">
      <strong>${ganaCosta ? 'Mejor ahora en costa.' : 'Mejor ahora en interior.'}</strong>
      ${ganaCosta
        ? `Gijón saca ${Math.round(costa.indice - ev.mediaInterior)} puntos a la media de Oviedo y Mieres${dViento > 6 ? `, aunque con ${Math.round(dViento)} km/h más de viento` : ''}.`
        : `Oviedo y Mieres promedian ${Math.round(ev.mediaInterior - (costa?.indice ?? 0))} puntos por encima de Gijón${dLluvia > 8 ? ', con menos agua tierra adentro' : ''}.`}
    </p>`;
}

const media = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
const signo = (v, d) => (v >= 0 ? '+' : '−') + redondea(Math.abs(v), d).toFixed(d);

function pintarFranjas(ev){
  const c = ev.ciudades.find(x => x.id === Estado.ciudadFoco) || ev.mejor;
  $('#horas-ciudad').textContent = '· ' + c.nombre;
  const maxIdx = Math.max(...c.futuras.map(h => h.indice), 1);
  void maxIdx;

  const pista = c.futuras.map((h, i) => {
    const dentro = c.ventana && i >= c.ventana.iDesde && i <= c.ventana.iHasta;
    return `<div class="hora" data-ventana="${dentro ? 'si' : 'no'}" style="--acento:${colorIndice(h.indice)}">
      <p class="hora__h num">${i === 0 ? 'Ahora' : hh(h.instante)}</p>
      <div class="hora__ico">${iconoCielo(h.codigo, h.esDeDia)}</div>
      <p class="hora__t num">${Math.round(h.temperatura)}°</p>
      <div class="hora__col"><span style="height:${Math.max(6, h.indice)}%"></span></div>
      <p class="hora__p num">${h.probLluvia >= 15 ? h.probLluvia + '%' : ''}</p>
    </div>`;
  }).join('');

  const pie = c.ventana
    ? `Mejor tramo en ${c.nombre}: <strong>${hhmm(c.ventana.desde)}–${hhmm(c.ventana.hasta)}</strong> (${c.ventana.indice}/100). La banda ámbar marca la ventana.`
    : c.bajon
      ? `${c.nombre} aguanta hasta las <strong>${hhmm(c.bajon.desde)}</strong>; a partir de ahí cae a ${c.bajon.indice}/100.`
      : c.indice >= 70
        ? `${c.nombre} se mantiene estable durante las próximas ${CONFIG.horasVista} horas. Sin prisa.`
        : `Sin ventana clara en ${c.nombre} durante las próximas ${CONFIG.horasVista} horas.`;

  $('#franjas').innerHTML = `<div class="franjas__pista">${pista}</div><p class="franjas__pie">${pie}</p>`;
}

function pintar(ev){
  Estado.evaluacion = ev;
  if (!ev.ciudades.some(c => c.id === Estado.ciudadFoco)) Estado.ciudadFoco = ev.mejor.id;
  pintarTitular(ev); pintarAhora(ev); pintarMejor(ev);
  pintarCiudades(ev); pintarComparativa(ev); pintarFranjas(ev);
  $('#app').setAttribute('aria-busy', 'false');
}

/* ── 8) Estado, eventos y PWA ─────────────────────────────────────── */

const Estado = {
  modo: lee('sna.modo', 'paseo'),
  tema: lee('sna.tema', 'auto'),
  ciudadFoco: lee('sna.ciudad', 'oviedo'),
  datos: null,
  evaluacion: null,
  sal: 0,
  cargando: false
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
  m.content = oscuro ? '#0d0f12' : '#f4f3ef';
  document.head.appendChild(m);
}

function aplicaModo(){
  const modos = Object.keys(MODOS);
  const i = modos.indexOf(Estado.modo);
  $$('.modo').forEach(b => b.setAttribute('aria-selected', String(b.dataset.modo === Estado.modo)));
  $('#modos-indicador').style.transform = `translateX(${i * 100}%)`;
  $('#modo-nota').textContent = MODOS[Estado.modo].nota;
}

async function refrescar({ manual = false } = {}){
  if (Estado.cargando) return;
  Estado.cargando = true;
  const btn = $('#btn-refrescar');
  btn.setAttribute('data-cargando', '');
  try {
    if (manual) Estado.sal++;
    const datos = await cargarDatos(Estado.sal);
    Estado.datos = datos;
    guardaCache(datos);
    pintar(evaluar(datos, Estado.modo));
    if (manual) brindis(datos.origen === 'openmeteo' ? 'Datos actualizados' : 'Datos simulados actualizados');
  } catch (err){
    console.error('[SNA]', err);
    brindis('No se han podido actualizar los datos');
  } finally {
    Estado.cargando = false;
    btn.removeAttribute('data-cargando');
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
    const d = c.datos;
    d.instante = new Date(d.instante);
    d.ciudades.forEach(x => {
      x.actual.instante = new Date(x.actual.instante);
      x.hoy.amanecer = new Date(x.hoy.amanecer);
      x.hoy.ocaso = new Date(x.hoy.ocaso);
      x.horas.forEach(h => h.instante = new Date(h.instante));
    });
    return d;
  } catch { return null; }
}

function arrancar(){
  // Accesos directos del manifiesto: app.html?modo=carretera
  const modoUrl = new URLSearchParams(location.search).get('modo');
  if (modoUrl && MODOS[modoUrl]){ Estado.modo = modoUrl; guarda('sna.modo', modoUrl); }

  aplicaTema();
  aplicaModo();

  // Pintado inmediato desde caché mientras llegan los datos frescos
  const cache = leeCache();
  if (cache){ Estado.datos = cache; pintar(evaluar(cache, Estado.modo)); }

  $('#btn-refrescar').addEventListener('click', () => refrescar({ manual:true }));

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
    const modos = Object.keys(MODOS);
    const i = (modos.indexOf(Estado.modo) + (e.key === 'ArrowRight' ? 1 : -1) + modos.length) % modos.length;
    $(`.modo[data-modo="${modos[i]}"]`).click();
    $(`.modo[data-modo="${modos[i]}"]`).focus();
  });

  $('#btn-tema').addEventListener('click', () => {
    const ciclo = ['auto', 'claro', 'oscuro'];
    Estado.tema = ciclo[(ciclo.indexOf(Estado.tema) + 1) % 3];
    guarda('sna.tema', Estado.tema);
    aplicaTema();
    brindis({ auto:'Tema automático', claro:'Tema claro', oscuro:'Tema oscuro' }[Estado.tema]);
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicaTema);

  // Al volver a la app tras un rato, los datos se refrescan solos
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (Estado.datos?.instante ?? 0) > 15 * 60e3) refrescar();
  });

  refrescar().finally(() => {
    setTimeout(() => {
      const s = $('#splash');
      s.setAttribute('hidden-anim', '');
      setTimeout(() => s.remove(), 600);
    }, cache ? 300 : 620);
  });
}

document.addEventListener('DOMContentLoaded', arrancar);

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('[SNA] SW:', e));
  });
}
