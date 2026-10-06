// Valida catalogo-inicial.json contra las reglas del producto. Uso: node ilusion-pantalla/content/validar-catalogo.mjs
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(new URL('./catalogo-inicial.json', import.meta.url), 'utf8'));
const err = [];
const e = (m) => err.push(m);
const cats = d.categorias.map((c) => c.slug);
const REPARTO = { 'naturaleza-viva':4,'lluvia-y-calma':3,'espacio-y-galaxias':3,'neon-y-cyberpunk':3,'coches-y-velocidad':2,'minimalismo':3,'gaming':2,'musica-y-energia':2,'arquitectura-e-interiores':6,'casas-de-lujo':5,'mar-montana-y-paisajes-del-norte':5,'fondo-del-dia':2 };
if (cats.join() !== Object.keys(REPARTO).join()) e('categorías/orden incorrectos');
if (d.wallpapers.length !== 40) e('hay ' + d.wallpapers.length + ' wallpapers, deben ser 40');
const campos = ['slug','titulo','descripcion','categoria','etiquetas','orientacion','duracion_s','resolucion','fps_recomendado','perfil_rendimiento','dispositivo_recomendado','es_premium','estilo','color_dominante','miniatura_idea','prompt_produccion_es','prompt_negativo'];
const vistos = new Set(); const cuenta = {}; let prem = 0, dest = 0;
const palabras = (t) => t.trim().split(/\s+/).length;
for (const w of d.wallpapers) {
  for (const c of campos) if (w[c] === undefined || w[c] === '') e(`${w.slug}: falta ${c}`);
  if (vistos.has(w.slug)) e('slug repetido ' + w.slug); vistos.add(w.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(w.slug)) e(w.slug + ': slug inválido');
  cuenta[w.categoria] = (cuenta[w.categoria] || 0) + 1;
  if (!cats.includes(w.categoria)) e(w.slug + ': categoría desconocida');
  if (w.titulo?.length > 40) e(`${w.slug}: título ${w.titulo.length}>40`);
  if (w.descripcion?.length > 160) e(`${w.slug}: descripción ${w.descripcion.length}>160`);
  if (!Number.isInteger(w.duracion_s) || w.duracion_s < 10 || w.duracion_s > 20) e(w.slug + ': duración');
  if (!['1080x1920','1440x2560','2160x3840'].includes(w.resolucion)) e(w.slug + ': resolución');
  if (![24,30,60].includes(w.fps_recomendado)) e(w.slug + ': fps');
  if (!['ahorro','estandar','alta','ultra'].includes(w.perfil_rendimiento)) e(w.slug + ': perfil');
  if (w.orientacion !== 'vertical') e(w.slug + ': orientación');
  if (!/^#[0-9A-Fa-f]{6}$/.test(w.color_dominante || '')) e(w.slug + ': color');
  if (!(w.etiquetas?.length >= 3 && w.etiquetas.length <= 6)) e(w.slug + ': etiquetas 3-6');
  const n = palabras(w.prompt_produccion_es || ''); if (n < 40 || n > 90) e(`${w.slug}: prompt ${n} palabras`);
  if (!/bucle perfecto: el último fotograma enlaza con el primero/i.test(w.prompt_produccion_es || '')) e(w.slug + ': falta frase de bucle');
  if (!/9:16/.test(w.prompt_produccion_es || '')) e(w.slug + ': falta 9:16');
  if (w.es_premium) prem++;
  if (w.destacado_premium) { dest++; if (!w.es_premium) e(w.slug + ': destacado no premium'); }
  if (/\b(nike|adidas|ferrari|porsche|lamborghini|bmw|mercedes|tesla|audi|pokemon|minecraft|fortnite|zelda|disney|marvel)\b/i.test(JSON.stringify(w))) e(w.slug + ': posible marca registrada');
}
for (const [k, v] of Object.entries(REPARTO)) if (cuenta[k] !== v) e(`reparto ${k}: ${cuenta[k] ?? 0} != ${v}`);
if (dest !== 10) e('destacados=' + dest + ' (deben ser 10)');
if (prem < 14 || prem > 18) e('premium=' + prem);
if (err.length) { console.error(err.join('\n')); console.error(`\n✗ ${err.length} problemas`); process.exit(1); }
console.log(`✓ catálogo válido: ${d.wallpapers.length} wallpapers, ${prem} premium, ${dest} destacados`);
