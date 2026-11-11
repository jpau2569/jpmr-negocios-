import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argsCodificar, consumoEstimado, evaluarBucle, filtroBucle, medirBucle, planDeVariantes, procesar, sonda, validarOriginal, verificarSalida, PERFILES } from '../procesar.mjs';

// ───── lógica pura ─────
const ok = { ancho: 1080, alto: 1920, duracion: 15, tieneAudio: false };
assert.deepEqual(validarOriginal(ok), { errores: [], avisos: [] });
assert.match(validarOriginal({ ...ok, ancho: 1920, alto: 1080 }).errores[0], /vertical 9:16/);
assert.match(validarOriginal({ ...ok, duracion: 9 }).errores[0], /mínimo 10/);
assert.match(validarOriginal({ ...ok, duracion: 21 }).errores[0], /máximo 20/);
assert.match(validarOriginal({ ...ok, ancho: 540, alto: 960 }).errores.join(), /resolución insuficiente/);
assert.ok(validarOriginal({ ...ok, tieneAudio: true }).avisos.some((a) => /audio/.test(a)));
assert.ok(validarOriginal({ ...ok, ancho: 1000, alto: 1920 }).avisos.some((a) => /recortará/.test(a)), 'proporción casi 9:16 → aviso, no error');
assert.equal(validarOriginal({ ...ok, duracion: 11 }, { hacerBucle: 1 }).errores.length, 0, '11 s − 1 s de fundido = 10 s: justo válido');
assert.match(validarOriginal({ ...ok, duracion: 10.5 }, { hacerBucle: 1 }).errores[0], /tras hacer el bucle/);
assert.match(validarOriginal(ok, { hacerBucle: 5 }).errores.join(), /entre 0.3 y 3/);

// el plan nunca amplía ni pasa de la calidad máxima y los nombres coinciden con la convención de R2
assert.deepEqual(planDeVariantes(1280).map((v) => v.archivo), ['q720-h264.mp4']);
assert.deepEqual(planDeVariantes(1920).map((v) => v.archivo), ['q720-h264.mp4', 'q1080-h264.mp4', 'q1080-hevc.mp4']);
assert.deepEqual(planDeVariantes(3840, 'q1080').map((v) => v.archivo), ['q720-h264.mp4', 'q1080-h264.mp4', 'q1080-hevc.mp4']);
assert.equal(planDeVariantes(3840).length, PERFILES.length);
assert.throws(() => planDeVariantes(1920, 'q9999'));
for (const v of planDeVariantes(3840)) assert.match(v.archivo, /^q(720|1080|1440|2160)-(h264|hevc)\.mp4$/);
assert.ok(argsCodificar('a', 'b', planDeVariantes(1920)[2]).includes('hvc1'), 'HEVC etiquetado hvc1');
assert.ok(argsCodificar('a', 'b', planDeVariantes(1920)[0]).includes('-an'), 'sin audio');
assert.ok(argsCodificar('a', 'b', planDeVariantes(1920)[0]).includes('+faststart'));

// métrica de bucle: casos calibrados con vídeo real
assert.equal(evaluarBucle({ ssimSalto: 0.396, ssimBase: 0.973 }).ok, false, 'corte de escena');
assert.equal(evaluarBucle({ ssimSalto: 0.912, ssimBase: 0.948 }).ok, true, 'bucle fabricado');
assert.equal(evaluarBucle({ ssimSalto: 0.93, ssimBase: 0.99 }).ok, false, 'fondo casi estático con salto visible');
assert.equal(evaluarBucle({ ssimSalto: 0.999, ssimBase: 0.9999 }).ok, true, 'fondo estático sin salto');
assert.equal(consumoEstimado(1800), 'bajo'); assert.equal(consumoEstimado(4000), 'medio'); assert.equal(consumoEstimado(9000), 'alto');
assert.match(filtroBucle(12, 1), /xfade=transition=fade:duration=1:offset=0/);

// ───── vídeo real (ffmpeg) ─────
const T = mkdtempSync(join(tmpdir(), 'vt-'));
const ff = (...a) => { const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
try {
  // Original vertical 1080x1920 de 12 s, con audio (debe eliminarse), que NO enlaza consigo mismo (dos escenas distintas).
  const src = join(T, 'src.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=6', '-f', 'lavfi', '-i', 'rgbtestsrc=size=1080x1920:rate=30:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12',
     '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', src);
  assert.equal(sonda(src).tieneAudio, true);

  // 1) Sin bucle: la herramienta lo RECHAZA con un mensaje accionable
  assert.throws(() => procesar({ entrada: src, slug: 'prueba', salida: join(T, 'o1'), maxCalidad: 'q1080', rapido: true, log: () => {} }), /salto visible en el bucle.*--hacer-bucle/);

  // 2) Con --hacer-bucle 1: genera variantes correctas y todo verificado
  const logs = []; const m = procesar({ entrada: src, slug: 'prueba', salida: join(T, 'o2'), hacerBucle: 1, maxCalidad: 'q1080', rapido: true, log: (x) => logs.push(x) });
  assert.ok(logs.some((l) => /audio/.test(l)), 'avisa de que quita el audio');
  assert.deepEqual(m.archivos.map((a) => `${a.calidad}-${a.codec}`), ['q720-h264', 'q1080-h264', 'q1080-hevc']);
  assert.equal(m.duracion_s, 11);
  assert.ok(m.bucle.ssim_salto > 0.5 && (1 - m.bucle.ssim_salto) / Math.max(1 - m.bucle.ssim_base, 0.005) <= 4);
  const dir = join(T, 'o2', 'prueba');
  for (const a of m.archivos) {
    const ruta = join(dir, a.archivo); const i = sonda(ruta);
    assert.equal(i.tieneAudio, false, a.archivo + ' sin audio'); assert.equal(i.pixFmt, 'yuv420p'); assert.equal(Math.round(i.fps), 30);
    assert.equal(a.tamano_bytes, statSync(ruta).size); assert.match(a.sha256, /^[0-9a-f]{64}$/);
    assert.ok(a.tamano_bytes < 150 * 1048576);
  }
  assert.equal(sonda(join(dir, 'q720-h264.mp4')).ancho, 720); assert.equal(sonda(join(dir, 'q1080-hevc.mp4')).codec, 'hevc');
  assert.ok(statSync(join(dir, 'thumb.webp')).size <= 60 * 1024 && statSync(join(dir, 'poster.webp')).size <= 250 * 1024);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.slug, 'prueba'); assert.equal(manifest.imagenes.thumb, 'thumb.webp'); assert.ok(['bajo', 'medio', 'alto'].includes(manifest.consumo_estimado));
  // el bucle de la variante final también enlaza (se mide sobre el archivo que se publicará)
  const med = medirBucle(join(dir, 'q1080-h264.mp4')); assert.equal(evaluarBucle(med).ok, true, 'el archivo final enlaza');

  // 3) verificarSalida detecta problemas reales
  const v1080 = planDeVariantes(1920)[1];
  assert.deepEqual(verificarSalida(join(dir, 'q1080-h264.mp4'), v1080, 11), []);
  assert.ok(verificarSalida(join(dir, 'q1080-h264.mp4'), v1080, 14).some((p) => /duración/.test(p)), 'duración incorrecta');
  assert.ok(verificarSalida(join(dir, 'q720-h264.mp4'), v1080, 11).some((p) => /tamaño/.test(p)), 'tamaño incorrecto');
  assert.ok(verificarSalida(join(dir, 'q1080-hevc.mp4'), v1080, 11).some((p) => /códec/.test(p)), 'códec incorrecto');
  const sinFast = join(T, 'sinfast.mp4'); ff('-i', join(dir, 'q1080-h264.mp4'), '-c', 'copy', sinFast);
  assert.ok(verificarSalida(sinFast, v1080, 11).some((p) => /faststart/.test(p)), 'detecta falta de faststart');

  // 4) Entradas inválidas: errores claros y sin dejar salidas
  const horiz = join(T, 'h.mp4'); ff('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=12', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', horiz);
  assert.throws(() => procesar({ entrada: horiz, slug: 'x', salida: join(T, 'o3'), log: () => {} }), /vertical 9:16/);
  assert.equal(existsSync(join(T, 'o3', 'x', 'manifest.json')), false);
  assert.throws(() => procesar({ entrada: src, slug: '../mal', salida: join(T, 'o4'), log: () => {} }), /kebab-case/);
  assert.throws(() => procesar({ entrada: join(T, 'no-existe.mp4'), slug: 'x', salida: join(T, 'o5'), log: () => {} }));
} finally { rmSync(T, { recursive: true, force: true }); }
console.log('✓ pipeline de vídeo: lógica pura + codificación real verificadas');
