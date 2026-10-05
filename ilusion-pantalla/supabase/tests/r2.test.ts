import { firmarUrl } from '../functions/_shared/r2.ts';
import { puedeDescargar, elegirArchivo, claveSubida } from '../functions/_shared/acceso.ts';
import assert from 'node:assert/strict';

// 1) Vector OFICIAL de la documentación de AWS S3 (presigned GET) → valida el algoritmo entero.
const url = await firmarUrl({
  metodo: 'GET', host: 'examplebucket.s3.amazonaws.com', ruta: '/test.txt', region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  caducaSeg: 86400, ahora: new Date('2013-05-24T00:00:00Z'),
});
assert.ok(url.endsWith('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'), 'firma SigV4 ≠ vector AWS: ' + url);

// 2) R2 path-style + caracteres raros en la clave + límites de caducidad
const r2 = await firmarUrl({ metodo: 'PUT', host: 'abc.r2.cloudflarestorage.com', ruta: '/ilusion-videos/videos/bosque-1/q1080.mp4', accessKeyId: 'K', secretAccessKey: 'S', caducaSeg: 600, cabecerasFirmadas: { 'Content-Type': 'video/mp4' } });
assert.match(r2, /^https:\/\/abc\.r2\.cloudflarestorage\.com\/ilusion-videos\/videos\/bosque-1\/q1080\.mp4\?/);
assert.match(r2, /X-Amz-SignedHeaders=content-type%3Bhost/);
assert.match(r2, /X-Amz-Credential=K%2F\d{8}%2Fauto%2Fs3%2Faws4_request/);
await assert.rejects(firmarUrl({ metodo: 'GET', host: 'h', ruta: '/a', accessKeyId: 'K', secretAccessKey: 'S', caducaSeg: 0 }));
await assert.rejects(firmarUrl({ metodo: 'GET', host: 'h', ruta: '/a/../b', accessKeyId: 'K', secretAccessKey: 'S', caducaSeg: 60 }));
await assert.rejects(firmarUrl({ metodo: 'GET', host: 'h', ruta: '/a', accessKeyId: 'K', secretAccessKey: 'S', caducaSeg: 999999 }));

// 3) Reglas de acceso
assert.equal(puedeDescargar({ es_premium: false, estado_publicacion: 'publicado' }, false), true);
assert.equal(puedeDescargar({ es_premium: true, estado_publicacion: 'publicado' }, false), false, 'premium sin derecho');
assert.equal(puedeDescargar({ es_premium: true, estado_publicacion: 'publicado' }, true), true);
assert.equal(puedeDescargar({ es_premium: false, estado_publicacion: 'borrador' }, true), false, 'borrador no se sirve');

const A = (calidad: any, codec: any, fps = 30) => ({ calidad, codec, fps, storage_path: `${calidad}-${codec}`, tamano_bytes: 1 });
const lista = [A('q720', 'h264'), A('q1080', 'h264'), A('q1080', 'hevc'), A('q2160', 'hevc', 60)];
assert.equal(elegirArchivo(lista, 'q1080', true)!.storage_path, 'q1080-hevc');
assert.equal(elegirArchivo(lista, 'q2160', false)!.storage_path, 'q1080-h264', 'sin HEVC cae a h264');
assert.equal(elegirArchivo(lista, 'q2160', true, 30)!.storage_path, 'q1080-hevc', 'respeta fps');
assert.equal(elegirArchivo([A('q2160', 'hevc')], 'q720', true), null);

// 4) Validación de subidas
assert.equal(claveSubida({ slug: 'bosque-1', tipo: 'video', calidad: 'q1080', mime: 'video/mp4', bytes: 9e6 }), 'videos/bosque-1/q1080.mp4');
assert.equal(claveSubida({ slug: 'bosque-1', tipo: 'poster', mime: 'image/webp', bytes: 1e5 }), 'imagenes/bosque-1/poster.webp');
for (const mal of [
  { slug: '../etc', tipo: 'video', calidad: 'q720', mime: 'video/mp4', bytes: 1 },
  { slug: 'ok', tipo: 'video', calidad: 'q720', mime: 'video/x-msvideo', bytes: 1 },
  { slug: 'ok', tipo: 'video', calidad: 'q720', mime: 'video/mp4', bytes: 151 * 1024 * 1024 },
  { slug: 'ok', tipo: 'video', calidad: 'q999', mime: 'video/mp4', bytes: 1 },
  { slug: 'ok', tipo: 'poster', mime: 'video/mp4', bytes: 1 },
  { slug: 'ok', tipo: 'video', calidad: 'q720', mime: 'image/png', bytes: 1 },
  { slug: 'ok', tipo: 'thumb', mime: 'image/png', bytes: 0 },
] as any[]) assert.throws(() => claveSubida(mal), undefined, JSON.stringify(mal));
console.log('✓ r2 + acceso: todo OK');
