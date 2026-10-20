/* Genera los PNG de OLVIDO DE PAU AGENDA a partir de logo.svg, con Chromium.
   Salen: icono-180/192/512, icono-maskable-512 (con margen de seguridad)
   y presentacion-4k.png (3840 × 2160, logo centrado).
   Uso:  node agenda/herramientas/generar-imagenes.mjs                      */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(DIR, 'logo.svg'), 'utf8');
const datos = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
async function foto(nombre, ancho, alto, html, transparente = false) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><body style="margin:0;background:transparent;width:${ancho}px;height:${alto}px;overflow:hidden">${html}</body></html>`);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: join(DIR, nombre), omitBackground: transparente });
  await p.close();
  console.log('✓', nombre);
}

for (const n of [180, 192, 512]) await foto(`icono-${n}.png`, n, n, `<img src="${datos}" width="${n}" height="${n}" style="display:block">`, true);
// Maskable: el sistema recorta un círculo; el dibujo va dentro del 80 % central.
await foto('icono-maskable-512.png', 512, 512, `<div style="width:512px;height:512px;background:#0b1530;display:grid;place-items:center"><img src="${datos}" width="400" height="400"></div>`);
await foto('presentacion-4k.png', 3840, 2160, `<div style="width:3840px;height:2160px;background:radial-gradient(circle at 50% 40%,#183076 0%,#0b1530 55%,#050a18 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,'Segoe UI',Roboto,sans-serif">
  <img src="${datos}" width="1000" height="1000" style="filter:drop-shadow(0 60px 80px rgba(0,0,0,.55))">
  <div style="margin-top:90px;color:#fff;font-size:150px;font-weight:800;letter-spacing:.05em">OLVIDO DE PAU</div>
  <div style="color:#19d3c5;font-size:96px;font-weight:700;letter-spacing:.45em;margin-top:10px;padding-left:.45em">AGENDA</div></div>`);
await navegador.close();
