import { sanearEvento, sanearLote, sanearConsentimiento, esUuid, LIMITES } from '../functions/_shared/analitica.ts';
import assert from 'node:assert/strict';

const ok = (e: any) => sanearEvento(e);
// válidos
assert.deepEqual(ok({ evento: 'wallpaper_visto', propiedades: { wallpaper_slug: 'bosque-niebla', origen: 'inicio' } }), { evento: 'wallpaper_visto', propiedades: { wallpaper_slug: 'bosque-niebla', origen: 'inicio' }, hace_s: 0 });
assert.ok(ok({ evento: 'app_abierta', propiedades: { version_app: '0.2.0', android_sdk: 34, primera_vez: true }, hace_s: 3600 }));
assert.ok(ok({ evento: 'wallpaper_aplicado', propiedades: { wallpaper_slug: 'a' } }));
// propiedades extra se descartan (no filtran datos)
const extra = ok({ evento: 'wallpaper_aplicado', propiedades: { wallpaper_slug: 'a', email: 'ana@x.es', texto: 'hola' } })!;
assert.deepEqual(Object.keys(extra.propiedades), ['wallpaper_slug']);
// inválidos
const malos: any[] = [
  null, 'x', {}, { evento: 'evento_inventado', propiedades: {} },
  { evento: '__proto__', propiedades: {} }, { evento: 'constructor' }, { evento: 'toString' },
  { evento: 'wallpaper_visto', propiedades: { wallpaper_slug: 'a' } },                                   // falta origen
  { evento: 'wallpaper_visto', propiedades: { wallpaper_slug: 'Ana García <script>', origen: 'inicio' } }, // texto libre
  { evento: 'wallpaper_visto', propiedades: { wallpaper_slug: 'a', origen: 'otro' } },                     // enum
  { evento: 'busqueda', propiedades: { resultados: -1, con_filtros: true } },
  { evento: 'busqueda', propiedades: { resultados: 1.5, con_filtros: true } },
  { evento: 'busqueda', propiedades: { resultados: '3', con_filtros: true } },
  { evento: 'busqueda', propiedades: { resultados: 3, con_filtros: 'si' } },
  { evento: 'app_abierta', propiedades: { version_app: 'a'.repeat(21), android_sdk: 34, primera_vez: false } },
  { evento: 'wallpaper_aplicado', propiedades: { wallpaper_slug: 'a' }, hace_s: -1 },
  { evento: 'wallpaper_aplicado', propiedades: { wallpaper_slug: 'a' }, hace_s: LIMITES.antiguedad_max_s + 1 },
  { evento: 'descarga_completada', propiedades: { wallpaper_slug: 'a', calidad: 'q1080', duracion_ms: 99999999 } },
];
for (const m of malos) assert.equal(ok(m), null, JSON.stringify(m));

// lote
const id = '3f0c2b6e-8a41-4c8e-9b7d-1a2b3c4d5e6f';
assert.ok(esUuid(id)); assert.ok(!esUuid('no-uuid')); assert.ok(!esUuid('3f0c2b6e-8a41-0c8e-9b7d-1a2b3c4d5e6f'));
const lote = sanearLote({ instalacion_id: id, eventos: [{ evento: 'ajuste_cambiado', propiedades: { ajuste: 'fps' } }, { evento: 'x' }, 5] });
assert.equal(lote.eventos.length, 1); assert.equal(lote.descartados, 2);
assert.throws(() => sanearLote({ instalacion_id: 'x', eventos: [] }));
assert.throws(() => sanearLote({ instalacion_id: id, eventos: 'no' }));
assert.throws(() => sanearLote({ instalacion_id: id, eventos: Array(LIMITES.eventos_por_lote + 1).fill({}) }));
assert.throws(() => sanearLote(null));

// consentimiento
assert.deepEqual(sanearConsentimiento({ concedido: true, version_texto: '2026-10-v1' }), { concedido: true, version_texto: '2026-10-v1' });
for (const m of [null, {}, { concedido: 'true', version_texto: 'v1' }, { concedido: true }, { concedido: true, version_texto: 'x y' }]) assert.throws(() => sanearConsentimiento(m));
console.log('✓ analítica (servidor): validación estricta OK');
