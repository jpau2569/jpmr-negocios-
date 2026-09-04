/* Genera un único archivo HTML autocontenido con toda la app dentro.
   Sirve para llevarla en el móvil sin servidor: se abre desde Archivos y
   funciona. Pierde el service worker y la función de AEMET (necesitan un
   origen HTTP de verdad), así que tira de Open-Meteo o de datos simulados.

   Uso:  node herramientas/empaquetar.mjs
   Sale: sol-niebla-agua.html   (en la raíz de la carpeta)                */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const lee = f => readFileSync(join(RAIZ, f), 'utf8');

/* Los módulos van en orden de dependencia; como ningún nombre se repite
   entre ellos, basta con quitar imports y exports y concatenar. */
const MODULOS = ['utiles.js', 'datos.js', 'indice.js', 'interfaz.js', 'app.js'];

const aplana = src => src
  .replace(/^import\s+[\s\S]*?from\s+'[^']+';\s*$/gm, '')   // import { a, b } from '...'
  .replace(/^export\s+(?=const|let|var|function|async|class)/gm, '')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');

const guion = MODULOS.map(m => `\n/* ═══ ${m} ═══ */\n` + aplana(lee(m))).join('\n');

let html = lee('app.html');

/* Ojo: en replace(), la cadena de reemplazo interpreta `$$`, `$&` y
   compañía. El código usa `$$` como selector, así que se pasa una función
   de reemplazo, que entrega el texto tal cual.                          */
const mete = (marca, texto) => { html = html.replace(marca, () => texto); };

mete('<link rel="stylesheet" href="styles.css" />', `<style>\n${lee('styles.css')}\n</style>`);
mete('<script type="module" src="app.js"></script>', `<script>\n(() => {\n${guion}\n})();\n</script>`);

// Iconos y manifiesto: no existen junto al archivo, se incrustan o se quitan
const icono = lee('icono.svg').replace(/\n\s*/g, ' ').trim();
const datosSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(icono);
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="icon" type="image\/png"[^>]*>\s*/, '');
mete(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${datosSvg}" />`);
mete(/<link rel="icon" type="image\/svg\+xml"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="${datosSvg}" />`);

// Aviso honesto en el pie: este archivo no es la PWA completa
mete('<p class="pie__fino">Hecho para decidir rápido, no para mirar números.</p>',
  '<p class="pie__fino">Archivo único, sin servidor: datos de Open-Meteo o simulados.</p>');

writeFileSync(join(RAIZ, 'sol-niebla-agua.html'), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✓ sol-niebla-agua.html (${kb} KB, todo dentro)`);
