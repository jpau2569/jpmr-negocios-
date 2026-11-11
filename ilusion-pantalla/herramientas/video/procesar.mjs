#!/usr/bin/env node
// Pipeline de producción de wallpapers de vídeo: valida el original, (opcional) lo convierte en bucle perfecto,
// genera las variantes por calidad/códec con los nombres que espera R2 y comprueba CADA salida con ffprobe.
//
//   node procesar.mjs original.mp4 --slug bosque-niebla [--hacer-bucle 1] [--max-calidad q1440] [--salida ./salida] [--rapido]
//
// Salida: <salida>/<slug>/{q720-h264,q1080-h264,q1080-hevc,q1440-hevc,q2160-hevc}.mp4 + thumb.webp + poster.webp + manifest.json
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LIMITES = { duracionMin: 10, duracionMax: 20, bytesMaxVideo: 150 * 1024 * 1024, thumbMaxBytes: 60 * 1024, posterMaxBytes: 250 * 1024, fps: 30 };
export const CALIDADES = { q720: [720, 1280], q1080: [1080, 1920], q1440: [1440, 2560], q2160: [2160, 3840] };
// crf = calidad constante; maxrate/bufsize = techo para que un fondo "difícil" no dispare el consumo ni el tamaño.
export const PERFILES = [
  { calidad: 'q720',  codec: 'h264', crf: 23, maxrate: '3M',  bufsize: '6M' },
  { calidad: 'q1080', codec: 'h264', crf: 23, maxrate: '6M',  bufsize: '12M' },
  { calidad: 'q1080', codec: 'hevc', crf: 26, maxrate: '4M',  bufsize: '8M' },
  { calidad: 'q1440', codec: 'hevc', crf: 26, maxrate: '7M',  bufsize: '14M' },
  { calidad: 'q2160', codec: 'hevc', crf: 27, maxrate: '14M', bufsize: '28M' },
];
const ORDEN = Object.keys(CALIDADES);

// ───────── lógica pura ─────────
/** Valida el original. Devuelve { errores, avisos }. `info` = { ancho, alto, duracion, fps, tieneAudio }. */
export function validarOriginal(info, { hacerBucle = 0 } = {}) {
  const errores = [], avisos = [];
  const ratio = info.ancho / info.alto;
  if (!(ratio > 0.5 && ratio < 0.625)) errores.push(`debe ser vertical 9:16 (ratio ${ratio.toFixed(3)}; esperado ≈0.5625)`);
  else if (Math.abs(ratio - 9 / 16) > 0.01) avisos.push('proporción distinta de 9:16: se recortará para llenar la pantalla');
  const dur = info.duracion - hacerBucle;
  if (dur < LIMITES.duracionMin) errores.push(`dura ${dur.toFixed(1)} s${hacerBucle ? ' tras hacer el bucle' : ''}; mínimo ${LIMITES.duracionMin} s`);
  if (dur > LIMITES.duracionMax) errores.push(`dura ${dur.toFixed(1)} s; máximo ${LIMITES.duracionMax} s`);
  if (info.alto < 1280) errores.push(`resolución insuficiente (${info.ancho}x${info.alto}); mínimo 720x1280`);
  if (info.tieneAudio) avisos.push('tiene audio: se eliminará (los fondos nunca suenan)');
  if (hacerBucle && (hacerBucle < 0.3 || hacerBucle > 3)) errores.push('--hacer-bucle debe estar entre 0.3 y 3 segundos');
  return { errores, avisos };
}

/** Qué variantes generar: sin ampliar (no se sube de resolución) y hasta la calidad máxima pedida. */
export function planDeVariantes(altoOriginal, maxCalidad = 'q2160') {
  const tope = ORDEN.indexOf(maxCalidad);
  if (tope < 0) throw new Error(`calidad máxima inválida: ${maxCalidad}`);
  return PERFILES.filter((p) => ORDEN.indexOf(p.calidad) <= tope && CALIDADES[p.calidad][1] <= altoOriginal)
    .map((p) => ({ ...p, archivo: `${p.calidad}-${p.codec}.mp4`, ancho: CALIDADES[p.calidad][0], alto: CALIDADES[p.calidad][1] }));
}

/**
 * Bucle perfecto por fundido cruzado. Con duración L y fundido d, el resultado dura P = L − d y:
 *   S(t) = mezcla(v(P+t), v(t)) para t<d ;  S(t) = v(t) para d ≤ t < P.
 * Así el último fotograma (≈v(P⁻)) enlaza con el primero (v(P)) sin salto.
 */
export function filtroBucle(L, d, fps = LIMITES.fps) {
  const P = +(L - d).toFixed(3);
  return `[0:v]fps=${fps},format=yuv420p,split=3[a][b][c];` +
    `[a]trim=start=${P}:end=${L},setpts=PTS-STARTPTS[tail];[b]trim=start=0:end=${d},setpts=PTS-STARTPTS[head];[c]trim=start=${d}:end=${P},setpts=PTS-STARTPTS[mid];` +
    `[tail][head]xfade=transition=fade:duration=${d}:offset=0[x];[x][mid]concat=n=2:v=1:a=0[out]`;
}

/**
 * ¿El salto del último al primer fotograma se nota? Compara cuánto DIFIEREN (1−SSIM) respecto a lo normal entre
 * fotogramas consecutivos. Calibrado con vídeo real: contenido que enlaza ≈ 1,5–1,7×; un corte de escena ≈ 22×.
 * Umbral 4× (con un mínimo de diferencia base para no dividir por casi cero en fondos casi estáticos).
 */
export function evaluarBucle({ ssimSalto, ssimBase }, maxRazon = 4) {
  const razon = (1 - ssimSalto) / Math.max(1 - ssimBase, 0.005);
  const ok = razon <= maxRazon;
  return { ok, razon, ssimSalto, ssimBase, mensaje: ok ? `bucle sin salto apreciable (${razon.toFixed(1)}× lo normal)` : `salto visible en el bucle (${razon.toFixed(1)}× la diferencia normal entre fotogramas; SSIM ${ssimSalto.toFixed(3)} frente a ${ssimBase.toFixed(3)}); usa --hacer-bucle` };
}

/** Consumo estimado para el panel, a partir del bitrate real de la variante de 1080p (o la mayor disponible). */
export function consumoEstimado(bitrateKbps) { return bitrateKbps < 2500 ? 'bajo' : bitrateKbps < 6000 ? 'medio' : 'alto'; }

export function argsCodificar(entrada, salida, v, { rapido = false, fps = LIMITES.fps, filtroPrevio = null } = {}) {
  const escala = `scale=${v.ancho}:${v.alto}:force_original_aspect_ratio=increase:flags=lanczos,crop=${v.ancho}:${v.alto},fps=${fps},format=yuv420p`;
  const vf = filtroPrevio ? escala : escala;
  const comunes = ['-y', '-hide_banner', '-loglevel', 'error', '-i', entrada, ...(filtroPrevio ? [] : []), '-vf', vf, '-an', '-fps_mode', 'cfr', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-g', String(fps * 2), '-keyint_min', String(fps)];
  if (v.codec === 'h264') return [...comunes, '-c:v', 'libx264', '-profile:v', 'high', '-preset', rapido ? 'ultrafast' : 'slow', '-crf', String(v.crf), '-maxrate', v.maxrate, '-bufsize', v.bufsize, salida];
  return [...comunes, '-c:v', 'libx265', '-tag:v', 'hvc1', '-preset', rapido ? 'ultrafast' : 'medium', '-crf', String(v.crf),
    '-x265-params', `vbv-maxrate=${parseInt(v.maxrate) * 1000}:vbv-bufsize=${parseInt(v.bufsize) * 1000}:log-level=error`, salida];
}

// ───────── ffmpeg / ffprobe ─────────
function ejecutar(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${bin} no disponible: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${bin} falló (${r.status}): ${(r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ')}`);
  return r;
}
export function sonda(ruta, contarFotogramas = false) {
  const r = ejecutar('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', ...(contarFotogramas ? ['-count_frames'] : []), ruta]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error('el archivo no tiene vídeo');
  const [n, d] = (v.avg_frame_rate || v.r_frame_rate).split('/').map(Number);
  return {
    ancho: v.width, alto: v.height, codec: v.codec_name, fps: d ? n / d : n, pixFmt: v.pix_fmt,
    duracion: parseFloat(j.format.duration), bytes: parseInt(j.format.size), bitrateKbps: Math.round(parseInt(j.format.bit_rate) / 1000),
    tieneAudio: j.streams.some((s) => s.codec_type === 'audio'), fotogramas: v.nb_read_frames ? parseInt(v.nb_read_frames) : null,
  };
}
const ssimMedia = (stderr) => { const m = /All:([0-9.]+)/.exec(stderr); if (!m) throw new Error('no se pudo leer el SSIM'); return parseFloat(m[1]); };

/** Mide similitud entre consecutivos (baseline) y entre el último y el primer fotograma (salto del bucle). */
export function medirBucle(ruta) {
  const info = sonda(ruta, true); const N = info.fotogramas;
  const tmp = mkdtempSync(join(tmpdir(), 'bucle-'));
  try {
    const base = ejecutar('ffmpeg', ['-hide_banner', '-i', ruta, '-i', ruta, '-lavfi', '[1:v]trim=start_frame=1,setpts=PTS-STARTPTS[b];[0:v][b]ssim', '-f', 'null', '-']);
    const ssimBase = ssimMedia(base.stderr);
    ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', ruta, '-vf', `select=eq(n\\,${N - 1})`, '-frames:v', '1', join(tmp, 'ultimo.png')]);
    ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', ruta, '-frames:v', '1', join(tmp, 'primero.png')]);
    const salto = ejecutar('ffmpeg', ['-hide_banner', '-i', join(tmp, 'ultimo.png'), '-i', join(tmp, 'primero.png'), '-lavfi', 'ssim', '-f', 'null', '-']);
    return { ssimBase, ssimSalto: ssimMedia(salto.stderr) };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/** Comprueba una variante YA generada contra lo prometido. Devuelve lista de problemas (vacía = correcta). */
export function verificarSalida(ruta, v, duracionEsperada) {
  const i = sonda(ruta); const p = [];
  if (i.ancho !== v.ancho || i.alto !== v.alto) p.push(`tamaño ${i.ancho}x${i.alto} ≠ ${v.ancho}x${v.alto}`);
  if (i.codec !== v.codec) p.push(`códec ${i.codec} ≠ ${v.codec}`);
  if (Math.abs(i.fps - LIMITES.fps) > 0.01) p.push(`fps ${i.fps} ≠ ${LIMITES.fps}`);
  if (i.tieneAudio) p.push('contiene audio');
  if (i.pixFmt !== 'yuv420p') p.push(`pix_fmt ${i.pixFmt} (debe ser yuv420p para compatibilidad)`);
  if (Math.abs(i.duracion - duracionEsperada) > 0.15) p.push(`duración ${i.duracion.toFixed(2)} ≠ ${duracionEsperada.toFixed(2)}`);
  if (i.bytes > LIMITES.bytesMaxVideo) p.push(`pesa ${(i.bytes / 1048576).toFixed(1)} MB (máx. 150)`);
  const cab = readFileSync(ruta).subarray(0, 64 * 1024);
  const moov = cab.indexOf('moov'), mdat = cab.indexOf('mdat');
  if (moov < 0 || (mdat >= 0 && mdat < moov)) p.push('sin faststart (el índice debe ir al principio para empezar a reproducir ya)');
  return p;
}

const sha256 = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');

// ───────── orquestación ─────────
export function procesar({ entrada, slug, salida = './salida', hacerBucle = 0, maxCalidad = 'q2160', rapido = false, log = console.log }) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '') || slug.length > 60) throw new Error('--slug debe ser kebab-case (a-z, 0-9 y guiones)');
  const orig = sonda(entrada);
  const { errores, avisos } = validarOriginal(orig, { hacerBucle });
  avisos.forEach((a) => log(`⚠ ${a}`));
  if (errores.length) throw new Error('original no válido:\n  - ' + errores.join('\n  - '));

  const dir = join(salida, slug); mkdirSync(dir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'proc-'));
  try {
    let fuente = entrada; let duracion = orig.duracion;
    if (hacerBucle) {
      fuente = join(tmp, 'bucle.mp4');
      ejecutar('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', entrada, '-filter_complex', filtroBucle(orig.duracion, hacerBucle), '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p', fuente]);
      duracion = sonda(fuente).duracion; log(`↻ bucle creado con fundido de ${hacerBucle} s → dura ${duracion.toFixed(2)} s`);
    }
    const bucle = evaluarBucle(medirBucle(fuente)); log(bucle.ok ? `✓ ${bucle.mensaje}` : `✗ ${bucle.mensaje}`);
    if (!bucle.ok) throw new Error(bucle.mensaje);
    const plan = planDeVariantes(orig.alto, maxCalidad);
    if (!plan.length) throw new Error('el original es demasiado pequeño para generar ninguna variante');
    const archivos = [];
    for (const v of plan) {
      const destino = join(dir, v.archivo);
      log(`→ ${v.archivo} (${v.ancho}x${v.alto} ${v.codec})`);
      ejecutar('ffmpeg', argsCodificar(fuente, destino, v, { rapido }));
      const problemas = verificarSalida(destino, v, duracion);
      if (problemas.length) throw new Error(`${v.archivo} incorrecto:\n  - ${problemas.join('\n  - ')}`);
      const i = sonda(destino);
      archivos.push({ calidad: v.calidad, codec: v.codec, fps: LIMITES.fps, bitrate_kbps: i.bitrateKbps, tamano_bytes: i.bytes, sha256: sha256(destino), archivo: v.archivo });
    }
    // Imágenes del catálogo (WebP): miniatura ligera y póster nítido, del segundo 1 (fuera del fundido inicial).
    const instante = Math.min(1, duracion / 2);
    for (const [nombre, w, h, q, max] of [['thumb', 360, 640, 70, LIMITES.thumbMaxBytes], ['poster', 1080, 1920, 78, LIMITES.posterMaxBytes]]) {
      const destino = join(dir, `${nombre}.webp`);
      let calidad = q;
      for (;;) {
        ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(instante), '-i', fuente, '-frames:v', '1', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, '-c:v', 'libwebp', '-quality', String(calidad), destino]);
        if (statSync(destino).size <= max || calidad <= 20) break; calidad -= 10;
      }
      if (statSync(destino).size > max) throw new Error(`${nombre}.webp pesa ${statSync(destino).size} B (máx. ${max}); simplifica la imagen`);
    }
    const ref = archivos.find((a) => a.calidad === 'q1080') ?? archivos[archivos.length - 1];
    const manifest = {
      slug, duracion_s: +duracion.toFixed(2), resolucion_maxima: `${plan.at(-1).ancho}x${plan.at(-1).alto}`, fps_recomendado: LIMITES.fps,
      consumo_estimado: consumoEstimado(ref.bitrate_kbps), tamano_archivo_bytes: ref.tamano_bytes, bucle: { ssim_salto: +bucle.ssimSalto.toFixed(4), ssim_base: +bucle.ssimBase.toFixed(4) },
      archivos, imagenes: { thumb: 'thumb.webp', poster: 'poster.webp' }, generado_utc: new Date().toISOString(),
    };
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    log(`✓ ${archivos.length} variantes + imágenes en ${dir}`);
    return manifest;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2); const val = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (!a[0] || a[0].startsWith('--') || !val('--slug')) { console.error('Uso: node procesar.mjs original.mp4 --slug mi-fondo [--hacer-bucle 1] [--max-calidad q1440] [--salida ./salida] [--rapido]'); process.exit(2); }
  try { procesar({ entrada: a[0], slug: val('--slug'), salida: val('--salida', './salida'), hacerBucle: parseFloat(val('--hacer-bucle', '0')) || 0, maxCalidad: val('--max-calidad', 'q2160'), rapido: a.includes('--rapido') }); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
