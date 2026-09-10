/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — enlace corto, QR y cartel para compartir
   -----------------------------------------------------------------------
   Deja la app lista para vivir en su propio dominio: genera el QR del
   enlace, un cartel para el local o para mandar por WhatsApp, y pone las
   direcciones absolutas en las etiquetas que necesitan una URL completa
   (canonical y Open Graph), que son las que hacen que al pegar el enlace en
   WhatsApp salga la tarjeta con el logo.

   Uso:
     node chivato/herramientas/generar-enlace.mjs --dominio chivato.ai
     node chivato/herramientas/generar-enlace.mjs --dominio https://chivato.ai/app
     node chivato/herramientas/generar-enlace.mjs --dominio chivato.ai --solo-qr

   Escribe:
     chivato/qr.svg        → el QR, en vectorial (vale para imprimir a cualquier tamaño)
     chivato/comparte.html → cartel con el QR y el enlace, imprimible en A5

   Y, salvo con --solo-qr, actualiza canonical y Open Graph en
   `chivato/index.html` y en la ficha pública `chivato.html`.
   ═══════════════════════════════════════════════════════════════════════ */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svg as qrSVG, ascii as qrASCII } from './qr.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MONOREPO = join(RAIZ, '..');

/* ── Argumentos ─────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const soloQR = args.includes('--solo-qr');
const bruto = opcion('dominio');

if (!bruto) {
  console.error(`Falta el dominio.
Uso:  node chivato/herramientas/generar-enlace.mjs --dominio chivato.ai
      node chivato/herramientas/generar-enlace.mjs --dominio https://chivato.ai/app [--solo-qr]`);
  process.exit(1);
}

/* Admite "chivato.ai", "www.chivato.ai/app" o la URL entera. */
const url = new URL(/^https?:\/\//.test(bruto) ? bruto : `https://${bruto}`);
const ENLACE = url.href.replace(/\/$/, '') || url.origin;
const BASE = ENLACE.endsWith('/') ? ENLACE : `${ENLACE}/`;
const VISIBLE = ENLACE.replace(/^https:\/\//, '');

/* ── QR ─────────────────────────────────────────────────────────────── */
const qr = qrSVG(ENLACE, { nivel: 'M', margen: 3, claro: '#ffffff', oscuro: '#0b1220' });
await writeFile(join(RAIZ, 'qr.svg'), qr + '\n', 'utf8');

/* ── Cartel para compartir ──────────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const mensajeWhatsApp =
  `¿Se te ha encendido una luz rara en el coche? Hazle una foto al cuadro y esta app te dice ` +
  `qué es y si puedes seguir conduciendo: ${ENLACE}`;

const cartel = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chivato AI — comparte la app</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#070d18">
<link rel="icon" href="icono-32.png" sizes="32x32">
<style>
  :root { --fondo:#070d18; --tarjeta:#101c30; --borde:#1e304c; --texto:#eef3fb;
          --suave:#9db0cc; --tenue:#6c809f; --ambar:#ff9d2e; --ambar2:#ffc46b }
  * { box-sizing:border-box }
  body { margin:0; color:var(--texto); font-size:16px; line-height:1.55;
         font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
         background:radial-gradient(1000px 560px at 20% -10%, #163358 0%, transparent 60%),
                    radial-gradient(700px 420px at 105% 5%, #3a2408 0%, transparent 55%), var(--fondo);
         display:grid; place-items:center; min-height:100dvh; padding:24px }
  .cartel { width:100%; max-width:430px; text-align:center;
            background:var(--tarjeta); border:1px solid var(--borde);
            border-radius:26px; padding:28px 24px 24px }
  .cartel img.logo { width:78px; height:78px; border-radius:20px }
  h1 { margin:14px 0 4px; font-size:27px; letter-spacing:-.03em }
  h1 span { color:var(--ambar) }
  .lema { color:var(--suave); margin:0 0 20px; font-size:15.5px }
  .placa { background:#fff; border-radius:20px; padding:16px; display:inline-block; line-height:0 }
  .placa svg { width:212px; height:212px; display:block }
  .enlace { display:inline-block; margin:18px 0 4px; font-weight:800; font-size:19px;
            color:var(--ambar2); text-decoration:none; word-break:break-all }
  .pie { color:var(--tenue); font-size:13px; margin:2px 0 20px }
  .botones { display:grid; gap:9px }
  button, .boton { display:block; width:100%; padding:14px; border-radius:14px; cursor:pointer;
                   font-family:inherit; font-size:15.5px; font-weight:700; text-decoration:none }
  .principal { border:none; color:#26140a;
               background:linear-gradient(150deg,var(--ambar2),var(--ambar) 50%,#c96f00) }
  .secundario { background:#16243c; color:var(--texto); border:1px solid var(--borde) }
  #copiado { color:#4ade80; font-size:14px; min-height:20px; margin-top:8px }
  .instruccion { color:var(--tenue); font-size:13px; margin-top:18px }
  @media print {
    body { background:#fff; color:#000; display:block; padding:0 }
    .cartel { border:none; background:#fff; max-width:none; margin:0 auto; padding:28px }
    .botones, #copiado, .instruccion { display:none }
    h1 span { color:#c96f00 } .lema { color:#444 } .enlace { color:#000 } .pie { color:#555 }
    .placa { padding:0 } .placa svg { width:330px; height:330px }
  }
</style>
</head>
<body>
<div class="cartel">
  <img class="logo" src="icono-192.png" alt="" width="78" height="78">
  <h1>CHIVATO <span>AI</span></h1>
  <p class="lema">¿Se te ha encendido una luz en el coche?<br>Hazle una foto al cuadro y te digo qué es.</p>

  <div class="placa">${qr}</div>

  <a class="enlace" style="font-size:${VISIBLE.length > 30 ? 15 : VISIBLE.length > 22 ? 17 : 19}px"
     href="${esc(ENLACE)}">${esc(VISIBLE)}</a>
  <p class="pie">Gratis · sin registro · se instala en el móvil</p>

  <div class="botones">
    <a class="boton principal" href="https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}"
       target="_blank" rel="noopener">Mandar por WhatsApp</a>
    <button class="secundario" id="copiar" type="button">Copiar el enlace</button>
    <button class="secundario" id="imprimir" type="button">Imprimir el cartel</button>
  </div>
  <p id="copiado" role="status"></p>
  <p class="instruccion">Apunta con la cámara del móvil al código y se abre sola.</p>
</div>

<script>
  const ENLACE = ${JSON.stringify(ENLACE)};
  document.getElementById('copiar').addEventListener('click', async () => {
    const aviso = document.getElementById('copiado');
    try {
      if (navigator.share) { await navigator.share({ title: 'Chivato AI', url: ENLACE }); return; }
      await navigator.clipboard.writeText(ENLACE);
      aviso.textContent = 'Enlace copiado.';
    } catch { aviso.textContent = 'Cópialo a mano: ' + ENLACE; }
    setTimeout(() => { aviso.textContent = ''; }, 3000);
  });
  document.getElementById('imprimir').addEventListener('click', () => window.print());
</script>
</body>
</html>
`;
await writeFile(join(RAIZ, 'comparte.html'), cartel, 'utf8');

/* ── Direcciones absolutas en canonical y Open Graph ─────────────────── */
/*  Al pegar un enlace en WhatsApp o en Telegram, la tarjeta con el logo solo
    sale si `og:image` es una dirección ABSOLUTA. De ahí este paso.          */
async function ponerURLs(ruta, { canonical = null, imagen, etiqueta }) {
  if (!existsSync(ruta)) return `${etiqueta}: no está, me lo salto`;
  let html = await readFile(ruta, 'utf8');
  const antes = html;

  if (canonical) {
    if (/<link rel="canonical"/.test(html)) {
      html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/,
        `<link rel="canonical" href="${canonical}" />`);
    } else {
      html = html.replace(/<meta name="theme-color"/,
        `<link rel="canonical" href="${canonical}" />\n<meta name="theme-color"`);
    }
    if (/<meta property="og:url"/.test(html)) {
      html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/,
        `<meta property="og:url" content="${canonical}" />`);
    } else {
      html = html.replace(/<meta property="og:title"/,
        `<meta property="og:url" content="${canonical}" />\n<meta property="og:title"`);
    }
  }

  html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${imagen}" />`);

  if (html === antes) return `${etiqueta}: ya estaba al día`;
  await writeFile(ruta, html, 'utf8');
  return `${etiqueta}: ${canonical ? `canonical, og:url y og:image → ${canonical}` : `og:image → ${imagen}`}`;
}

const avisos = [];
if (!soloQR) {
  // La app se lleva el dominio entero: es la que queremos que indexe Google.
  avisos.push(await ponerURLs(join(RAIZ, 'index.html'),
    { canonical: BASE, imagen: `${BASE}icono-512.png`, etiqueta: 'chivato/index.html' }));
  // La ficha vive en el monorepo y conserva su propia dirección: solo se le
  // pone la imagen absoluta, para que su previsualización siga saliendo bien.
  avisos.push(await ponerURLs(join(MONOREPO, 'chivato.html'),
    { imagen: `${BASE}icono-512.png`, etiqueta: 'chivato.html (ficha)' }));
}

/* ── Resumen ────────────────────────────────────────────────────────── */
console.log(`\n🚨 Chivato AI — enlace listo\n`);
console.log(qrASCII(ENLACE, { margen: 2 }));
console.log(`   Enlace:  ${ENLACE}`);
console.log(`   Escrito: chivato/qr.svg`);
console.log(`            chivato/comparte.html`);
for (const a of avisos) console.log(`            ${a}`);
if (soloQR) console.log(`   (con --solo-qr no se han tocado los HTML)`);
console.log(`\n   Abre comparte.html para enseñar el QR o imprimirlo para el local.`);
console.log(`   Los pasos del dominio están en chivato/DOMINIO.md\n`);
