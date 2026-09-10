/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — dibujos de los testigos
   -----------------------------------------------------------------------
   Cada testigo del catálogo tiene una clave `icono` que apunta aquí. Los
   dibujos son SVG en un lienzo de 48×48 que heredan trazo y color del
   contenedor (`currentColor`), así que el mismo símbolo vale para la
   tarjeta roja, la ámbar o la verde.

   No pretenden ser una reproducción exacta de la norma ISO 2575 —cada
   marca dibuja los suyos con pequeñas variaciones— sino que se reconozcan
   de un vistazo junto al nombre.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Piezas que se repiten ──────────────────────────────────────────── */
const PARENTESIS = '<path d="M9 14a20 20 0 0 0 0 20M39 14a20 20 0 0 1 0 20"/>';
const FARO = '<path d="M17 11a13.5 13.5 0 0 1 0 26z"/>';
const FARO_IZQ = '<path d="M31 11a13.5 13.5 0 0 0 0 26z"/>';
const PERSONA = '<path d="M17 13a3.2 3.2 0 1 0 0-.1zM12 38v-8a8 8 0 0 1 8-8h3"/>';
const COCHE_PLANTA = '<path d="M22 5h4a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6z"/>'
  + '<path d="M18 15h12M18 30h12"/>'
  + '<rect x="9" y="11" width="6" height="8" rx="2.5"/><rect x="33" y="11" width="6" height="8" rx="2.5"/>'
  + '<rect x="9" y="25" width="6" height="8" rx="2.5"/><rect x="33" y="25" width="6" height="8" rx="2.5"/>';
/** El mismo coche encogido, para dejar sitio a lo que va debajo. */
const COCHE_PLANTA_MINI = `<g transform="translate(24 20) scale(.78) translate(-24 -20)">${COCHE_PLANTA}</g>`;
const COCHE_LATERAL = '<path d="M8 31v-5l5-1 4-6h12l4 6 5 1v5h-3a3 3 0 0 0-6 0H17a3 3 0 0 0-6 0z"/>';
const TERMOMETRO =
  '<path d="M24 6a4.5 4.5 0 0 0-4.5 4.5V27a7.5 7.5 0 1 0 9 0V10.5A4.5 4.5 0 0 0 24 6z"/>'
  + '<circle cx="24" cy="34" r="3.4" fill="currentColor" stroke="none"/><path d="M24 34V15"/>'
  + '<path d="M3 16q3-3.5 6 0t6 0M3 26q3-3.5 6 0t6 0M33 16q3-3.5 6 0t6 0M33 26q3-3.5 6 0t6 0"/>';
const rayo = (x, y, e = 1) =>
  `<path d="M${x} ${y - 7 * e}l-${4 * e} ${8 * e}h${4 * e}l-${2 * e} ${7 * e} ${7 * e}-${9 * e}h-${4.5 * e}z" fill="currentColor" stroke="none"/>`;
const texto = (t, y = 29, tam = 13) =>
  `<text x="24" y="${y}" text-anchor="middle" font-size="${tam}" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor" stroke="none" letter-spacing="-.5">${t}</text>`;
const admiracion = (x = 24, y = 17, alto = 11) =>
  `<path d="M${x} ${y}v${alto}"/><circle cx="${x}" cy="${y + alto + 4.5}" r="1.6" fill="currentColor" stroke="none"/>`;
const ondas = (y, x0 = 13, ancho = 22, n = 2) => {
  const paso = ancho / (n * 2);
  let d = `M${x0} ${y}`;
  for (let i = 0; i < n; i++) d += `q${paso / 2} -3 ${paso} 0q${paso / 2} 3 ${paso} 0`;
  return `<path d="${d}"/>`;
};

/* ── Catálogo de dibujos ────────────────────────────────────────────── */
export const ICONOS = {
  /* Motor y propulsión ------------------------------------------------ */
  motor: '<path d="M7 33v-9h4v-5h7l4-4h8v6h5l7 4v8h-4v4H11v-4z"/><path d="M18 19v-4h8"/>',
  aceitera: '<path d="M6 19h15l5 4h11v9a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"/><path d="M26 19l7-7h9"/>'
    + '<path d="M20 45c2.3 0 4.2-1.9 4.2-4.2 0-2.8-4.2-7.4-4.2-7.4s-4.2 4.6-4.2 7.4c0 2.3 1.9 4.2 4.2 4.2z" fill="currentColor" stroke="none"/>',
  'aceitera-nivel': '<path d="M6 19h15l5 4h11v9a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"/><path d="M26 19l7-7h9"/>'
    + ondas(41, 13, 22, 2),
  'aceitera-llave': '<path d="M4 17h14l5 4h10v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M23 17l6-6h8"/>'
    + '<path d="M45 30a6 6 0 0 0-8 7l-7 7 3 3 7-7a6 6 0 0 0 7-8l-4 4-3-1-1-3z" fill="currentColor" stroke="none"/>',
  termometro: TERMOMETRO,
  'termometro-frio': TERMOMETRO,
  refrigerante: '<path d="M12 18h24v20a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z"/><path d="M20 18v-4h8v4"/>' + ondas(30, 15, 18, 2),
  precalentamiento: '<path d="M8 24q4-8 8 0t8 0 8 0 8 0"/><path d="M8 32q4-8 8 0t8 0 8 0 8 0"/>',
  turbo: '<circle cx="21" cy="27" r="12"/><circle cx="21" cy="27" r="4.5"/>'
    + '<path d="M21 15V7h10"/><path d="M33 27h9v9"/>',
  epc: texto('EPC', 30, 15) + '<rect x="5" y="16" width="38" height="19" rx="4"/>',
  tortuga: '<path d="M11 32a13 8 0 0 1 26 0z"/><path d="M37 30l5-3M11 32l-4 4M17 32v5M31 32v5"/><circle cx="40" cy="26" r="3"/>',
  'start-stop': '<circle cx="24" cy="24" r="15"/>' + texto('A', 30, 17) + '<path d="M35 12l4-2-1 5"/>',
  eco: texto('ECO', 30, 15),
  sport: texto('SPORT', 29, 11),
  stop: texto('STOP', 29, 13) + '<circle cx="24" cy="24" r="18"/>',

  /* Frenos y estabilidad ---------------------------------------------- */
  'freno-circulo': PARENTESIS + '<circle cx="24" cy="24" r="12"/>' + admiracion(24, 17, 9),
  'freno-mano': PARENTESIS + '<circle cx="24" cy="24" r="12"/>' + texto('P', 29, 15),
  'freno-electrico': PARENTESIS + '<circle cx="24" cy="24" r="12"/>' + texto('P', 29, 15) + admiracion(38, 34, 4),
  'liquido-frenos': PARENTESIS + '<circle cx="24" cy="24" r="11"/>' + ondas(24, 17, 14, 2) + '<path d="M20 15h8"/>',
  pastillas: '<circle cx="24" cy="24" r="10"/><path d="M8 15v18M12 15v18M36 15v18M40 15v18"/>',
  abs: PARENTESIS + '<circle cx="24" cy="24" r="12"/>' + texto('ABS', 28, 10),
  esp: COCHE_PLANTA_MINI + '<path d="M7 41q3-4 6-1.5t6-1.5M29 41q3-4 6-1.5t6-1.5"/>',
  'esp-off': COCHE_PLANTA_MINI + '<path d="M7 41q3-4 6-1.5t6-1.5M29 41q3-4 6-1.5t6-1.5"/>'
    + '<path d="M8 8l32 32" stroke-width="3.4"/>',
  'auto-hold': '<circle cx="24" cy="24" r="14"/>' + texto('H', 30, 16) + PARENTESIS,

  /* Ruedas ------------------------------------------------------------ */
  tpms: '<path d="M11 33V23a13 13 0 0 1 26 0v10z"/><path d="M8 37h32"/>'
    + '<path d="M16 33v4M24 33v4M32 33v4"/>' + admiracion(24, 17, 7),
  'tpms-fallo': '<path d="M11 33V23a13 13 0 0 1 26 0v10z"/><path d="M8 37h32"/>'
    + '<path d="M16 33v4M32 33v4"/><path d="M13 12l22 22"/>',

  /* Luces ------------------------------------------------------------- */
  posicion: FARO + '<path d="M34 17h9M34 24h9M34 31h9"/>' + FARO_IZQ.replace('31', '17').replace('M17', 'M17') + '<path d="M14 17H5M14 24H5M14 31H5"/>',
  cruce: FARO + '<path d="M33 15l9 4M33 22l9 4M33 29l9 4"/>',
  largas: FARO + '<path d="M33 15h10M33 22h10M33 29h10"/>',
  'largas-auto': FARO + '<path d="M33 15h10M33 22h10M33 29h10"/>' + '<text x="22" y="30" text-anchor="middle" font-size="12" font-weight="800" font-family="system-ui,sans-serif" fill="var(--fondo-icono,#0b1220)" stroke="none">A</text>',
  'antiniebla-del': FARO + '<path d="M33 15l8 4M33 22l8 4M33 29l8 4"/>' + '<path d="M43 12q-4 3 0 6t0 6 0 6 0 6"/>',
  'antiniebla-tras': FARO_IZQ + '<path d="M15 15l-8 4M15 22l-8 4M15 29l-8 4"/>' + '<path d="M5 12q4 3 0 6t0 6 0 6 0 6"/>',
  drl: FARO + '<path d="M35 17h6M35 24h6M35 31h6"/>',
  'luces-auto': FARO + '<path d="M33 17h9M33 24h9M33 31h9"/>' + '<text x="21" y="30" text-anchor="middle" font-size="12" font-weight="800" font-family="system-ui,sans-serif" fill="var(--fondo-icono,#0b1220)" stroke="none">A</text>',
  'intermitente-izq': '<path d="M20 10L6 24l14 14v-8h10V18H20z" fill="currentColor" stroke="none"/>',
  'intermitente-der': '<path d="M28 10l14 14-14 14v-8H18V18h10z" fill="currentColor" stroke="none"/>',
  warning: '<path d="M24 8L4 40h40z"/>' + admiracion(24, 22, 8),
  bombilla: FARO + '<path d="M33 17h9M33 24h9M33 31h9"/>' + '<text x="21" y="30" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui,sans-serif" fill="var(--fondo-icono,#0b1220)" stroke="none">!</text>',
  'luz-freno': COCHE_LATERAL + '<path d="M36 20h8M36 26h8M36 32h8"/>',
  afs: FARO + '<path d="M33 16l9 3M33 23l9 3"/><path d="M32 33q7 3 11-3" marker-end=""/>',
  'nivel-faros': FARO + '<path d="M33 18h9M33 25h9"/><path d="M38 33v8M35 38l3 3 3-3"/>',

  /* Seguridad --------------------------------------------------------- */
  airbag: PERSONA + '<circle cx="34" cy="27" r="9"/>',
  'airbag-off': PERSONA + '<circle cx="34" cy="27" r="9"/><path d="M28 21l12 12M40 21L28 33"/>',
  cinturon: PERSONA + '<path d="M18 16l12 22"/><path d="M12 38h20"/>',

  /* Carrocería -------------------------------------------------------- */
  puerta: '<path d="M19 7h10v34H19z"/>'
    + '<path d="M17 13L3 19l4 9 10-3z"/><path d="M31 13l14 6-4 9-10-3z"/>',
  capo: '<path d="M10 36v-5l5-1 4-6h12l4 6 5 1v5h-3a3 3 0 0 0-6 0H19a3 3 0 0 0-6 0z"/>'
    + '<path d="M15 30L5 15h13"/>',
  maletero: '<path d="M10 36v-5l5-1 4-6h12l4 6 5 1v5h-3a3 3 0 0 0-6 0H19a3 3 0 0 0-6 0z"/>'
    + '<path d="M33 30l10-15H30"/>',
  remolque: COCHE_LATERAL.replace('M8 31', 'M4 31') + '<path d="M34 28h12v8H34z"/><circle cx="40" cy="38" r="2.5"/>',

  /* Eléctrico --------------------------------------------------------- */
  bateria: '<rect x="7" y="16" width="34" height="20" rx="3"/><path d="M14 16v-4h6v4M28 16v-4h6v4"/>' + '<path d="M14 26h6M31 26h6M34 23v6"/>',
  'bateria-hv': '<rect x="7" y="16" width="34" height="20" rx="3"/><path d="M14 16v-4h6v4M28 16v-4h6v4"/>' + rayo(24, 27, 1),
  'bateria-baja': '<rect x="7" y="17" width="30" height="18" rx="3"/><path d="M41 23v6"/><path d="M12 22v8"/>' + admiracion(27, 20, 6),
  llave: '<circle cx="16" cy="24" r="7"/><path d="M23 24h19M36 24v6M42 24v5"/>',
  enchufe: '<path d="M16 12v10M28 12v10"/><path d="M10 22h24v4a12 12 0 0 1-12 12 12 12 0 0 1-12-12z"/><path d="M22 38v6"/>',
  ready: texto('READY', 29, 11),
  ev: texto('EV', 30, 16),
  hibrido: COCHE_LATERAL + rayo(24, 26, .7),
  regeneracion: '<path d="M14 24a10 10 0 1 1 4 8"/><path d="M11 16v8h8"/>' + '<rect x="28" y="20" width="14" height="10" rx="2"/><path d="M42 23v4"/>',
  avas: '<path d="M10 20h6l8-6v20l-8-6h-6z"/><path d="M30 18q5 6 0 12M35 14q9 10 0 20"/>',

  /* Escape y combustible ---------------------------------------------- */
  dpf: '<rect x="4" y="18" width="24" height="14" rx="7"/><path d="M11 18v14M18 18v14"/><path d="M28 25h5"/>'
    + '<circle cx="38" cy="18" r="2.2" fill="currentColor" stroke="none"/><circle cx="44" cy="25" r="2.2" fill="currentColor" stroke="none"/><circle cx="38" cy="32" r="2.2" fill="currentColor" stroke="none"/>',
  catalizador: '<rect x="5" y="17" width="26" height="13" rx="6"/><path d="M12 17v13M19 17v13M26 17v13"/><path d="M31 23h4"/>'
    + '<path d="M39 41c2.6 0 4.6-2 4.6-4.6 0-3.4-4.6-8.4-4.6-8.4s-4.6 5-4.6 8.4c0 2.6 2 4.6 4.6 4.6z" fill="currentColor" stroke="none"/>',
  emisiones: COCHE_LATERAL + '<path d="M40 30q5 0 5-4M40 36q8 0 8-6"/>',
  adblue: '<path d="M12 14h18v24H12z"/><path d="M30 20h6v10"/><path d="M20 44c2.8 0 5-2.2 5-5 0-3.3-5-8-5-8s-5 4.7-5 8c0 2.8 2.2 5 5 5z" fill="currentColor" stroke="none" opacity=".9"/>',
  'cuenta-atras': '<circle cx="24" cy="26" r="14"/><path d="M24 18v8l6 4"/><path d="M18 8h12"/>',
  surtidor: '<path d="M10 40V14a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v26z"/><path d="M6 40h26"/><path d="M14 16h10v8H14z"/>' + '<path d="M28 20h6v14a3 3 0 0 0 6 0V22l-4-6"/>',
  'agua-combustible': '<rect x="13" y="8" width="19" height="20" rx="3"/><path d="M18 8V4h9v4"/><path d="M13 15h19"/>'
    + '<path d="M22.5 45c3 0 5.4-2.4 5.4-5.4 0-3.9-5.4-9.6-5.4-9.6s-5.4 5.7-5.4 9.6c0 3 2.4 5.4 5.4 5.4z" fill="currentColor" stroke="none"/>',
  gas: '<rect x="14" y="10" width="20" height="30" rx="8"/>' + texto('GLP', 30, 10),

  /* Transmisión y chasis ---------------------------------------------- */
  transmision: '<circle cx="24" cy="24" r="10"/><path d="M24 8v6M24 34v6M8 24h6M34 24h6M13 13l4 4M35 13l-4 4M13 35l4-4M35 35l-4-4"/>' + admiracion(24, 19, 5),
  'cuatro-por-cuatro': '<path d="M22 5h4a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6z"/>'
    + '<path d="M18 15h12M18 30h12"/>'
    + '<rect x="8" y="10" width="7" height="9" rx="3" fill="currentColor" stroke="none"/><rect x="33" y="10" width="7" height="9" rx="3" fill="currentColor" stroke="none"/>'
    + '<rect x="8" y="25" width="7" height="9" rx="3" fill="currentColor" stroke="none"/><rect x="33" y="25" width="7" height="9" rx="3" fill="currentColor" stroke="none"/>',
  diferencial: '<circle cx="12" cy="24" r="5"/><circle cx="36" cy="24" r="5"/><path d="M17 24h14"/><path d="M20 18l8 12M28 18l-8 12"/>',
  suspension: '<path d="M7 27v-5l5-1 4-6h12l4 6 5 1v5h-3a3 3 0 0 0-6 0H16a3 3 0 0 0-6 0z"/>'
    + '<path d="M13 33v10M9 35h8M9 39h8M9 43h8M35 33v10M31 35h8M31 39h8M31 43h8"/>',
  volante: '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="5"/><path d="M24 19v-4M20 27L9 32M28 27l11 5"/>',

  /* Asistentes -------------------------------------------------------- */
  colision: COCHE_LATERAL + '<path d="M40 16q5 4 0 8M44 12q8 8 0 16"/>',
  acc: '<path d="M26 10h12a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z"/>'
    + '<path d="M17 17v14M11 20v8M5 22v4"/>',
  crucero: '<circle cx="24" cy="24" r="15"/><path d="M24 24l8-6"/><path d="M14 32h20"/>' + '<circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/>',
  limitador: '<circle cx="24" cy="24" r="15"/>' + texto('90', 30, 15),
  carril: '<path d="M12 8L4 40M36 8l8 32"/>' + COCHE_LATERAL.replace('M8 31v-5l5-1 4-6h12l4 6 5 1v5', 'M14 32v-4l4-1 3-5h8l3 5 4 1v4'),
  'angulo-muerto': '<path d="M8 14h12v20H8z"/><path d="M28 14h12v20H28z"/><path d="M22 20h4M22 26h4"/>',
  'trafico-cruzado': COCHE_PLANTA_MINI + '<path d="M4 42h13M4 42l4-3.5M4 42l4 3.5M44 42H31M44 42l-4-3.5M44 42l-4 3.5"/>',
  aparcamiento: COCHE_PLANTA_MINI
    + '<path d="M18 6q6-4 12 0M14 2.5q10-6 20 0"/>'
    + '<path d="M18 42q6 4 12 0M14 45.5q10 6 20 0"/>',
  camara: '<path d="M5 17h13l4-4h8l4 4h9v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><circle cx="24" cy="26" r="6"/>'
    + '<path d="M7 7l34 34" stroke-width="3.4"/>',
  senal: '<circle cx="24" cy="24" r="15"/>' + texto('50', 30, 15),
  cafe: '<path d="M10 22h22v10a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z"/><path d="M32 24h5a5 5 0 0 1 0 10h-5"/>' + '<path d="M16 16q3-4 0-8M24 16q3-4 0-8"/>',
  descenso: '<path d="M3 9L45 41"/>'
    + '<path d="M23 34v-4l4-1 3-5h8l3 5 4 1v4h-2a3 3 0 0 0-6 0h-6a3 3 0 0 0-6 0z" transform="translate(-2,4)"/>'
    + '<path d="M12 22v13M7.5 30.5L12 35l4.5-4.5"/>',
  cuesta: '<path d="M3 41L45 9"/>'
    + '<path d="M23 34v-4l4-1 3-5h8l3 5 4 1v4h-2a3 3 0 0 0-6 0h-6a3 3 0 0 0-6 0z" transform="translate(-4,2)"/>'
    + '<path d="M11 36V23M6.5 27.5L11 23l4.5 4.5"/>',

  /* Mantenimiento y confort ------------------------------------------- */
  'llave-inglesa': '<path d="M36 8a10 10 0 0 0-13 13L9 35a4 4 0 0 0 0 6l2 2a4 4 0 0 0 6 0l14-14a10 10 0 0 0 13-13l-7 7-6-1-1-6z"/>',
  filtro: '<path d="M8 14h32l-12 12v14l-8-4V26z"/>',
  limpia: '<path d="M5 32q19-19 38 0"/><path d="M10 38l9-16"/>'
    + '<path d="M27 39q2-6 8-8M30 42q1-8 8-11M33 44q0-10 8-13"/>',
  'limpia-fallo': '<path d="M5 30q19-19 38 0"/><path d="M10 36l9-16"/>' + admiracion(33, 22, 9),
  escobillas: '<path d="M6 32q18-16 36 0"/><path d="M12 38l8-14"/>' + '<text x="33" y="28" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor" stroke="none">A</text>',
  desempanado: '<path d="M8 34q16-18 32 0"/><path d="M14 40q3-6 0-10M24 42q3-7 0-12M34 40q3-6 0-10"/>',
  luneta: '<path d="M8 32q16-16 32 0v6H8z"/><path d="M14 40q3-6 0-10M24 42q3-7 0-12M34 40q3-6 0-10"/>',
  aire: texto('A/C', 30, 16),
  recirculacion: COCHE_LATERAL + '<path d="M18 26q6-6 12 0"/><path d="M30 26l-3-3M30 26l-3 3"/>',
  copo: '<path d="M24 6v36M9 15l30 18M39 15L9 33"/><path d="M18 10l6 5 6-5M18 38l6-5 6 5"/>',

  /* General ----------------------------------------------------------- */
  interrogacion: '<circle cx="24" cy="24" r="17"/>' + '<text x="24" y="32" text-anchor="middle" font-size="22" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor" stroke="none">?</text>',
};

/* Respaldo por categoría, para que nunca salga un hueco vacío. */
const POR_CATEGORIA = {
  motor: 'motor', frenos: 'freno-circulo', ruedas: 'tpms', luces: 'cruce',
  electrico: 'bateria', asistentes: 'acc', seguridad: 'airbag', escape: 'dpf',
  combustible: 'surtidor', transmision: 'transmision', direccion: 'volante',
  suspension: 'suspension', carroceria: 'puerta', confort: 'limpia',
  mantenimiento: 'llave-inglesa', general: 'interrogacion',
};

/**
 * Devuelve el SVG completo de un testigo, listo para insertar en el HTML.
 * @param {{icono?:string, categoria?:string}} testigo
 * @param {number} tam lado del cuadrado en píxeles
 */
export function svgTestigo(testigo, tam = 40) {
  const clave = testigo?.icono && ICONOS[testigo.icono]
    ? testigo.icono
    : (POR_CATEGORIA[testigo?.categoria] || 'interrogacion');
  return `<svg viewBox="0 0 48 48" width="${tam}" height="${tam}" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICONOS[clave]}</svg>`;
}

export const CLAVES_ICONO = Object.keys(ICONOS);
