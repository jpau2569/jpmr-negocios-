// Genera supabase/seed.sql desde catalogo-inicial.json. Uso: node ilusion-pantalla/content/generar-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(new URL('./catalogo-inicial.json', import.meta.url), 'utf8'));
const q = (v) => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const consumo = { ahorro: 'bajo', estandar: 'medio', alta: 'medio', ultra: 'alto' };
let sql = '-- GENERADO por content/generar-seed.mjs — no editar a mano.\n-- Los wallpapers se cargan como BORRADOR: se publican desde el panel cuando el vídeo real esté subido.\nbegin;\n';
d.categorias.forEach((c) => {
  sql += `insert into categorias (nombre,slug,descripcion,orden) values (${q(c.nombre)},${q(c.slug)},${q(c.descripcion)},${c.orden}) on conflict (slug) do nothing;\n`;
});
let destacado = 0;
d.wallpapers.forEach((w) => {
  sql += `insert into wallpapers (slug,titulo,descripcion,categoria_id,etiquetas,duracion_s,resolucion,fps_recomendado,perfil_rendimiento,consumo_estimado,color_dominante,estilo,es_premium,destacado_orden,estado_publicacion,licencia) values (${q(w.slug)},${q(w.titulo)},${q(w.descripcion)},(select id from categorias where slug=${q(w.categoria)}),${arr(w.etiquetas)},${w.duracion_s},${q(w.resolucion)},${w.fps_recomendado},${q(w.perfil_rendimiento)},${q(consumo[w.perfil_rendimiento])},${q(w.color_dominante)},${q(w.estilo)},${!!w.es_premium},${w.destacado_premium ? ++destacado : 'null'},'borrador','original-propia') on conflict (slug) do nothing;\n`;
});
sql += 'commit;\n';
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`seed.sql: ${d.categorias.length} categorías, ${d.wallpapers.length} wallpapers`);
