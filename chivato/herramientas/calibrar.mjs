/* ═══════════════════════════════════════════════════════════════════════
   CHIVATO AI — banco de calibración
   -----------------------------------------------------------------------
   Pasa una carpeta de fotos reales de salpicadero por el análisis y escribe
   un informe con lo que ha detectado. Si además hay un fichero de respuestas
   correctas, calcula aciertos, falsos positivos y olvidos, para poder tocar
   el prompt sabiendo si mejora o empeora.

   Uso:
     node chivato/herramientas/calibrar.mjs fotos/
     node chivato/herramientas/calibrar.mjs fotos/ --url https://tu-app.vercel.app/api/chivato
     node chivato/herramientas/calibrar.mjs fotos/ --plantilla     (crea esperado.json en blanco)

   El fichero de respuestas correctas va DENTRO de la carpeta de fotos, se
   llama `esperado.json` y tiene esta forma:

     {
       "cuadro-01.jpg": ["motor-mil", "tpms"],
       "cuadro-02.jpg": []
     }

   Los identificadores son los `id` de datos/testigos.json. Con `--plantilla`
   se genera el esqueleto ya relleno con lo que detectó la IA, para que solo
   haya que corregirlo a mano.
   ═══════════════════════════════════════════════════════════════════════ */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONES = ['.jpg', '.jpeg', '.png', '.webp'];
const MIMES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const LIMITE = 5 * 1024 * 1024;   // el mismo tope que aplica el endpoint

/* ── Argumentos ─────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const carpeta = resolve(args.find((a) => !a.startsWith('--')) || 'fotos');
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
};
const URL_API = opcion('url', 'http://localhost:3000/api/chivato');
const soloPlantilla = args.includes('--plantilla');
const vehiculo = {
  marca: opcion('marca', ''), modelo: opcion('modelo', ''),
  ano: opcion('ano', ''), combustible: opcion('combustible', ''),
};

if (!existsSync(carpeta)) {
  console.error(`No encuentro la carpeta ${carpeta}.\n` +
    `Uso: node chivato/herramientas/calibrar.mjs <carpeta-con-fotos> [--url <endpoint>]`);
  process.exit(1);
}

/* ── Reducir la foto como hace la app, si hay Playwright a mano ──────── */
let motivoSinReductor = '';
async function abrirReductor() {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch {
    motivoSinReductor = 'no está instalado Playwright (ejecuta "npm install" en la raíz del repo)';
    return null;
  }
  try {
    const navegador = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
    const pagina = await (await navegador.newContext()).newPage();
    await pagina.goto('about:blank');
    return {
      async reducir(buffer, mime) {
        return pagina.evaluate(async ({ datos, mime }) => {
          const blob = new Blob([new Uint8Array(datos)], { type: mime });
          const bitmap = await createImageBitmap(blob);
          const escala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(bitmap.width * escala);
          lienzo.height = Math.round(bitmap.height * escala);
          lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
          const url = lienzo.toDataURL('image/jpeg', 0.72);
          return url.slice(url.indexOf(',') + 1);
        }, { datos: [...buffer], mime });
      },
      cerrar: () => navegador.close(),
    };
  } catch (e) {
    motivoSinReductor = `no arranca el navegador (${String(e.message).split('\n')[0]}). ` +
      `Prueba con "npx playwright install chromium"`;
    return null;
  }
}

/* ── Análisis de una foto ───────────────────────────────────────────── */
async function analizar(ruta, reductor) {
  const buffer = await readFile(ruta);
  const ext = extname(ruta).toLowerCase();
  let imagen, mime = MIMES[ext] || 'image/jpeg';

  if (reductor) {
    imagen = await reductor.reducir(buffer, mime);
    mime = 'image/jpeg';
  } else {
    imagen = buffer.toString('base64');
    if (imagen.length > LIMITE) {
      return { error: `la foto pesa ${(buffer.length / 1048576).toFixed(1)} MB y no hay Playwright para reducirla ` +
        `(instálalo con "npm install" en la raíz del repo, o reduce la foto a 1280 px de lado)` };
    }
  }

  const resp = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagen, mime, vehiculo }),
  });
  const datos = await resp.json().catch(() => null);
  if (!resp.ok) return { error: datos?.error || `el servidor respondió ${resp.status}` };
  return datos;
}

/* ── Comparación con las respuestas correctas ───────────────────────── */
function comparar(detectados, esperados) {
  const d = new Set(detectados), e = new Set(esperados);
  return {
    aciertos: [...e].filter((x) => d.has(x)),
    olvidados: [...e].filter((x) => !d.has(x)),      // estaba encendido y no lo vio
    sobrantes: [...d].filter((x) => !e.has(x)),      // lo vio y no estaba
  };
}

/* ── Programa ───────────────────────────────────────────────────────── */
const catalogo = JSON.parse(await readFile(join(RAIZ, 'datos', 'testigos.json'), 'utf8'));
const nombreDe = (id) => catalogo.testigos.find((t) => t.id === id)?.nombre || `⚠️ ${id} (no está en el catálogo)`;

const ficheros = (await readdir(carpeta))
  .filter((f) => EXTENSIONES.includes(extname(f).toLowerCase()))
  .sort();

if (!ficheros.length) {
  console.error(`No hay fotos (${EXTENSIONES.join(', ')}) en ${carpeta}.`);
  process.exit(1);
}

const rutaEsperado = join(carpeta, 'esperado.json');
let esperado = null;
if (!soloPlantilla && existsSync(rutaEsperado)) {
  esperado = JSON.parse(await readFile(rutaEsperado, 'utf8'));
}

console.log(`\n🚨 Calibrando Chivato AI`);
console.log(`   Fotos:    ${ficheros.length} en ${carpeta}`);
console.log(`   Endpoint: ${URL_API}`);
console.log(`   Correcto: ${esperado ? 'esperado.json encontrado' : 'sin esperado.json (solo se listará lo detectado)'}\n`);

const reductor = await abrirReductor();
console.log(reductor
  ? '   Las fotos se reducen a 1280 px como hace la app.\n'
  : `   ⚠️ Las fotos se mandan tal cual, sin reducir (tope de 5 MB): ${motivoSinReductor}.\n`);

const filas = [];
const plantilla = {};
let global = { aciertos: 0, olvidados: 0, sobrantes: 0, fallos: 0 };

for (const fichero of ficheros) {
  const ruta = join(carpeta, fichero);
  if (!(await stat(ruta)).isFile()) continue;
  process.stdout.write(`   ▸ ${fichero} … `);

  const inicio = Date.now();
  const r = await analizar(ruta, reductor);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  if (r.error) {
    global.fallos++;
    console.log(`❌ ${r.error}`);
    filas.push({ fichero, error: r.error });
    continue;
  }

  const detectados = r.testigos.map((t) => t.id);
  plantilla[fichero] = detectados;

  if (!esperado) {
    console.log(`${detectados.length} testigo(s) · ${segundos}s`);
    filas.push({ fichero, detectados, r, segundos });
    continue;
  }

  const correctos = esperado[fichero];
  if (!Array.isArray(correctos)) {
    console.log(`⏭️  sin respuesta correcta en esperado.json`);
    filas.push({ fichero, detectados, r, segundos, sinEsperado: true });
    continue;
  }

  const c = comparar(detectados, correctos);
  global.aciertos += c.aciertos.length;
  global.olvidados += c.olvidados.length;
  global.sobrantes += c.sobrantes.length;
  const perfecto = !c.olvidados.length && !c.sobrantes.length;
  console.log(`${perfecto ? '✅ perfecto' : `${c.aciertos.length} ✅  ${c.olvidados.length} 🔍 sin ver  ${c.sobrantes.length} ➕ de más`} · ${segundos}s`);
  filas.push({ fichero, detectados, r, segundos, c, perfecto });
}

if (reductor) await reductor.cerrar();

/* ── Plantilla de respuestas correctas ──────────────────────────────── */
if (soloPlantilla) {
  await writeFile(rutaEsperado, JSON.stringify(plantilla, null, 2) + '\n', 'utf8');
  console.log(`\n📝 Escrito ${rutaEsperado} con lo que detectó la IA.`);
  console.log(`   Corrígelo a mano (quita lo que no estuviera encendido, añade lo que faltó)`);
  console.log(`   y vuelve a lanzar la calibración sin --plantilla.\n`);
  process.exit(0);
}

/* ── Informe ────────────────────────────────────────────────────────── */
const l = [];
l.push(`# Calibración de Chivato AI`, ``);
l.push(`- Fecha: ${new Date().toLocaleString('es-ES')}`);
l.push(`- Fotos: ${ficheros.length} · Endpoint: \`${URL_API}\``);
l.push(`- Catálogo: versión ${catalogo.version} (${catalogo.testigos.length} testigos)`, ``);

if (esperado) {
  const totalEsperados = global.aciertos + global.olvidados;
  const totalDetectados = global.aciertos + global.sobrantes;
  const cobertura = totalEsperados ? (100 * global.aciertos / totalEsperados).toFixed(1) : '—';
  const precision = totalDetectados ? (100 * global.aciertos / totalDetectados).toFixed(1) : '—';
  const perfectas = filas.filter((f) => f.perfecto).length;

  l.push(`## Resultado`, ``);
  l.push(`| Métrica | Valor | Qué significa |`);
  l.push(`|---|---|---|`);
  l.push(`| Cobertura | **${cobertura} %** | De los testigos encendidos, cuántos vio |`);
  l.push(`| Precisión | **${precision} %** | De los que dijo ver, cuántos estaban de verdad |`);
  l.push(`| Fotos clavadas | **${perfectas} de ${ficheros.length}** | Ni un olvido ni un sobrante |`);
  l.push(`| Sin ver | ${global.olvidados} | Lo más grave: un rojo que se escapa |`);
  l.push(`| De más | ${global.sobrantes} | Falsas alarmas |`);
  l.push(`| Errores de red | ${global.fallos} | |`, ``);

  const cuenta = (clave) => {
    const m = new Map();
    for (const f of filas) for (const id of f.c?.[clave] || []) m.set(id, (m.get(id) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const olvidos = cuenta('olvidados');
  const sobras = cuenta('sobrantes');
  if (olvidos.length) {
    l.push(`### Testigos que más se le escapan`, ``);
    for (const [id, n] of olvidos) l.push(`- ${n}× **${nombreDe(id)}** (\`${id}\`)`);
    l.push(``);
  }
  if (sobras.length) {
    l.push(`### Testigos que se inventa o confunde`, ``);
    for (const [id, n] of sobras) l.push(`- ${n}× **${nombreDe(id)}** (\`${id}\`)`);
    l.push(``);
  }
}

l.push(`## Foto a foto`, ``);
for (const f of filas) {
  l.push(`### ${f.fichero}`);
  if (f.error) { l.push(``, `❌ ${f.error}`, ``); continue; }
  l.push(``, `Calidad de la foto según la IA: **${f.r.calidad_foto}**${f.r.consejo_foto ? ` — ${f.r.consejo_foto}` : ''} · ${f.segundos}s`);
  if (f.r.lectura_extra) l.push(``, `Se lee en el cuadro: ${f.r.lectura_extra}`);
  l.push(``);
  if (!f.r.testigos.length) l.push(`_No detectó ningún testigo._ ${f.r.mensaje || ''}`, ``);
  for (const t of f.r.testigos) {
    const marca = f.c ? (f.c.sobrantes.includes(t.id) ? ' ➕ **de más**' : ' ✅') : '';
    l.push(`- ${t.gravedad === 'critico' ? '🔴' : t.gravedad === 'atencion' ? '🟠' : '🟡'} ` +
      `**${t.nombre}** (\`${t.id}\`, ${t.estado}, confianza ${t.confianza})${marca}` +
      (t.observacion ? ` — _${t.observacion}_` : ''));
  }
  if (f.c?.olvidados.length) {
    l.push(``, `**No vio:**`);
    for (const id of f.c.olvidados) l.push(`- 🔍 ${nombreDe(id)} (\`${id}\`)`);
  }
  if (f.r.no_identificados?.length) {
    l.push(``, `**Símbolos que no supo nombrar:**`);
    for (const n of f.r.no_identificados) l.push(`- ${n.descripcion} (${n.color})`);
  }
  if (f.r.ignorados?.length) {
    l.push(``, `⚠️ Devolvió identificadores que no existen: ${f.r.ignorados.join(', ')}`);
  }
  l.push(``);
}

l.push(`---`, ``, `## Qué tocar si los números no salen`, ``);
l.push(`- **Se le escapan testigos** → el problema suele ser la foto (lejos, con reflejos, cuadro apagado).`);
l.push(`  Mira la columna de calidad. Si las fotos son buenas, endurece el punto 1 de \`INSTRUCCIONES\``);
l.push(`  en \`chivato/api/chivato.js\` para que revise el cuadro entero antes de responder.`);
l.push(`- **Confunde dos símbolos parecidos** → afina el campo \`forma\` de esos testigos en`);
l.push(`  \`chivato/datos/testigos.json\`: es lo único que el modelo tiene para distinguirlos.`);
l.push(`- **Se inventa testigos** → refuerza el punto 7 ("no inventes testigos probables").`);
l.push(`- **Devuelve identificadores que no existen** → el endpoint ya los descarta, pero conviene`);
l.push(`  repetir en el prompt que use el identificador EXACTO de la lista.`);
l.push(`- Cambia **una cosa cada vez** y vuelve a lanzar la calibración sobre las mismas fotos.`, ``);

const informe = join(carpeta, 'informe-calibracion.md');
await writeFile(informe, l.join('\n'), 'utf8');

console.log(`\n📄 Informe en ${informe}`);
if (esperado) {
  const totalEsperados = global.aciertos + global.olvidados;
  const totalDetectados = global.aciertos + global.sobrantes;
  console.log(`   Cobertura ${totalEsperados ? (100 * global.aciertos / totalEsperados).toFixed(1) : '—'} % · ` +
    `Precisión ${totalDetectados ? (100 * global.aciertos / totalDetectados).toFixed(1) : '—'} %`);
}
console.log('');
