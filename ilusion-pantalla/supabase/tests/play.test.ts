import assert from 'node:assert/strict';
import { mapearSuscripcionV2, daAcceso, hashToken, idOfuscado, productosPermitidos, firmarAserto, tokenAcceso, consultarSuscripcion, reconocer, igualesSeguro, validarCompra } from '../functions/_shared/play.ts';

const base = (estado: string, extra: any = {}) => ({
  kind: 'androidpublisher#subscriptionPurchaseV2', subscriptionState: estado, startTime: '2026-09-01T10:00:00Z', latestOrderId: 'GPA.1234-5678',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', externalAccountIdentifiers: { obfuscatedExternalAccountId: 'abc' },
  lineItems: [{ productId: 'ilusion_premium_mensual', expiryTime: '2026-11-01T10:00:00Z', autoRenewingPlan: { autoRenewEnabled: true } }], ...extra,
});
const AHORA = new Date('2026-10-06T00:00:00Z');

// mapeo de estados (los 8 que documenta Play) y acceso resultante
const casos: [string, string, boolean][] = [
  ['SUBSCRIPTION_STATE_ACTIVE', 'activa', true], ['SUBSCRIPTION_STATE_CANCELED', 'cancelada', true], ['SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'en_gracia', true],
  ['SUBSCRIPTION_STATE_ON_HOLD', 'pausada', false], ['SUBSCRIPTION_STATE_PAUSED', 'pausada', false], ['SUBSCRIPTION_STATE_EXPIRED', 'expirada', false],
  ['SUBSCRIPTION_STATE_PENDING', 'ninguna', false], ['SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED', 'ninguna', false],
];
for (const [play, nuestro, acceso] of casos) { const s = mapearSuscripcionV2(base(play)); assert.equal(s.estado, nuestro, play); assert.equal(daAcceso(s, AHORA), acceso, 'acceso ' + play); }
// vencidas no dan acceso aunque Play diga "activa/cancelada" (reloj o notificación retrasada)
assert.equal(daAcceso({ estado: 'activa', expiracion: new Date('2026-10-01') }, AHORA), false);
assert.equal(daAcceso({ estado: 'cancelada', expiracion: new Date('2026-10-01') }, AHORA), false);
assert.equal(daAcceso({ estado: 'cancelada', expiracion: null }, AHORA), false, 'cancelada sin fecha: nunca acceso');

// campos
const m = mapearSuscripcionV2(base('SUBSCRIPTION_STATE_ACTIVE', { linkedPurchaseToken: 'viejo', testPurchase: {}, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING' }));
assert.equal(m.productoId, 'ilusion_premium_mensual'); assert.equal(m.pendienteReconocer, true); assert.equal(m.enlazadaA, 'viejo'); assert.equal(m.prueba, true); assert.equal(m.cuentaOfuscada, 'abc');
assert.equal(m.expiracion!.toISOString(), '2026-11-01T10:00:00.000Z'); assert.equal(m.ordenId, 'GPA.1234-5678');
const dos = mapearSuscripcionV2(base('SUBSCRIPTION_STATE_ACTIVE', { lineItems: [{ productId: 'a', expiryTime: '2026-11-01T00:00:00Z' }, { productId: 'b', expiryTime: '2027-01-01T00:00:00Z' }] }));
assert.equal(dos.expiracion!.toISOString(), '2027-01-01T00:00:00.000Z', 'toma la expiración más tardía');
// fallo cerrado ante formatos raros
for (const mal of [null, 'x', {}, base('SUBSCRIPTION_STATE_NUEVO_QUE_NO_CONOZCO'), base('SUBSCRIPTION_STATE_ACTIVE', { lineItems: [] }), base('SUBSCRIPTION_STATE_ACTIVE', { lineItems: [{ expiryTime: 'x' }] })])
  assert.throws(() => mapearSuscripcionV2(mal as any), undefined, JSON.stringify(mal)?.slice(0, 80));
assert.equal(mapearSuscripcionV2(base('SUBSCRIPTION_STATE_ACTIVE', { lineItems: [{ productId: 'p', expiryTime: 'basura' }] })).expiracion, null, 'fecha ilegible → null (y activa sin fecha solo si Play lo dice)');

// hashes: vector fijo compartido con Kotlin (si cambia uno, falla el test del otro lado)
assert.equal(await hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 de "abc" (vector oficial)');
assert.equal(await idOfuscado('11111111-1111-4111-8111-111111111111'), '9b67d432d4711014990e4577e54213747429e17e7091c1689bbd184b6c2bedb2', 'vector compartido con la app Kotlin');
assert.notEqual(await idOfuscado('11111111-1111-4111-8111-111111111111'), await idOfuscado('22222222-2222-4222-8222-222222222222'));
assert.match(await idOfuscado('x'), /^[0-9a-f]{64}$/);

// productos
assert.deepEqual([...productosPermitidos(' a , b ,, ')], ['a', 'b']); assert.throws(() => productosPermitidos('')); assert.throws(() => productosPermitidos(undefined));

// validarCompra
const permit = new Set(['ilusion_premium_mensual', 'ilusion_premium_anual']);
const yo = await idOfuscado('11111111-1111-4111-8111-111111111111');
const compra = (c: any) => ({ ...mapearSuscripcionV2(base('SUBSCRIPTION_STATE_ACTIVE')), ...c });
assert.deepEqual(validarCompra(compra({ cuentaOfuscada: yo }), yo, permit), { ok: true });
assert.equal((validarCompra(compra({ cuentaOfuscada: yo, productoId: 'otro' }), yo, permit) as any).codigo, 'producto_no_permitido');
assert.equal((validarCompra(compra({ cuentaOfuscada: null }), yo, permit) as any).codigo, 'compra_sin_cuenta');
assert.equal((validarCompra(compra({ cuentaOfuscada: await idOfuscado('22222222-2222-4222-8222-222222222222') }), yo, permit) as any).codigo, 'compra_de_otra_cuenta');
assert.ok(igualesSeguro('abc', 'abc')); assert.ok(!igualesSeguro('abc', 'abd')); assert.ok(!igualesSeguro('abc', 'abcd')); assert.ok(!igualesSeguro('', 'a'));

// JWT de cuenta de servicio: se firma de verdad y se verifica con la clave pública
const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', par.privateKey)).toString('base64');
const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
const sa = { client_email: 'play@proyecto.iam.gserviceaccount.com', private_key: pem };
const jwt = await firmarAserto(sa, new Date('2026-10-06T00:00:00Z')); const [h, c, f] = jwt.split('.');
const dec = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
assert.deepEqual(JSON.parse(dec(h).toString()), { alg: 'RS256', typ: 'JWT' });
const claims = JSON.parse(dec(c).toString());
assert.equal(claims.iss, sa.client_email); assert.equal(claims.scope, 'https://www.googleapis.com/auth/androidpublisher'); assert.equal(claims.aud, 'https://oauth2.googleapis.com/token'); assert.equal(claims.exp - claims.iat, 3000);
assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', par.publicKey, dec(f), new TextEncoder().encode(`${h}.${c}`)), 'la firma RS256 es válida');
await assert.rejects(firmarAserto({ client_email: 'x', private_key: '' }));

// llamadas HTTP con fetch simulado
const llamadas: any[] = [];
const falso = (resp: (u: string, i: any) => Response) => (async (u: any, i: any) => { llamadas.push({ u: String(u), i }); return resp(String(u), i); }) as typeof fetch;
assert.equal(await tokenAcceso(sa, falso(() => new Response(JSON.stringify({ access_token: 'TOK' }))), AHORA), 'TOK');
assert.match(String(llamadas[0].i.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
await assert.rejects(tokenAcceso(sa, falso(() => new Response('{}', { status: 401 })), AHORA), /HTTP 401/);
await assert.rejects(tokenAcceso(sa, falso(() => new Response('{}')), AHORA), /sin access_token/);
llamadas.length = 0;
const s1 = await consultarSuscripcion('es.ilusionpantalla.app', 'tok/con+raros', 'TOK', falso(() => new Response(JSON.stringify(base('SUBSCRIPTION_STATE_ACTIVE')))));
assert.equal(s1.estado, 'activa'); assert.equal(llamadas[0].u, 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/es.ilusionpantalla.app/purchases/subscriptionsv2/tokens/tok%2Fcon%2Braros');
assert.equal(llamadas[0].i.headers.Authorization, 'Bearer TOK');
await assert.rejects(consultarSuscripcion('p', 't', 'A', falso(() => new Response('{}', { status: 410 }))), (e: any) => e.estadoHttp === 404);
await assert.rejects(consultarSuscripcion('p', 't', 'A', falso(() => new Response('{}', { status: 500 }))), (e: any) => e.estadoHttp === 502);
llamadas.length = 0; await reconocer('p', 'prod', 'tk', 'A', falso(() => new Response('{}')));
assert.match(llamadas[0].u, /purchases\/subscriptions\/prod\/tokens\/tk:acknowledge$/); assert.equal(llamadas[0].i.method, 'POST');
await reconocer('p', 'prod', 'tk', 'A', falso(() => new Response('{}', { status: 409 })));   // ya reconocida: no es error
await assert.rejects(reconocer('p', 'prod', 'tk', 'A', falso(() => new Response('{}', { status: 403 }))));
console.log('✓ Play: mapeo de estados, vinculación de cuenta, JWT RS256 y llamadas verificados');
