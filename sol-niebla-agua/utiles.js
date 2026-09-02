/* ═══════════════════════════════════════════════════════════════════
   UTILIDADES — sin estado y sin dependencias. Las usan todas las capas.
   ═══════════════════════════════════════════════════════════════════ */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const limita = (v, a, b) => Math.min(b, Math.max(a, v));
export const redondea = (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; };
export const interpola = (v, x1, x2, y1, y2) => y1 + (limita(v, Math.min(x1,x2), Math.max(x1,x2)) - x1) * (y2 - y1) / (x2 - x1);

export const hhmm = f => f.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
export const hh   = f => f.toLocaleTimeString('es-ES', { hour:'2-digit' }).replace(/\D+$/, '') + 'h';

/** Familia visual del cielo a partir del código WMO. */
export function familiaCielo(codigo){
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

export const NOMBRE_CIELO = {
  'sol':'Despejado', 'sol-nubes':'Poco nuboso', 'nubes':'Intervalos nubosos',
  'cubierto':'Cubierto', 'niebla':'Niebla', 'orbayu':'Orbayu',
  'lluvia':'Lluvia', 'chubascos':'Chubascos', 'tormenta':'Tormenta', 'nieve':'Nieve'
};

/** Icono de cielo en SVG en línea (hereda el color del sistema). */
export function iconoCielo(codigo, esDeDia = true, clase = 'ico-cielo'){
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
export function rumbo(grados){
  const r = ['N','NE','E','SE','S','SO','O','NO'];
  return r[Math.round(((grados % 360) / 45)) % 8];
}

/** Amanecer y ocaso (aproximación NOAA) para una fecha y coordenada. */
export function horasSolares(fecha, lat, lon){
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


export const media = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
export const signo = (v, d) => (v >= 0 ? '+' : '−') + redondea(Math.abs(v), d).toFixed(d);
