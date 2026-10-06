// Verificación de suscripciones de Google Play (Play Developer API · purchases.subscriptionsv2).
// Lógica pura + llamadas con `fetch` inyectable → testeable sin red. FALLA CERRADO: ante cualquier duda, sin acceso.

export type EstadoSusc = 'ninguna' | 'activa' | 'en_gracia' | 'pausada' | 'cancelada' | 'expirada';

export interface SuscripcionPlay {
  estado: EstadoSusc; productoId: string; inicio: Date | null; expiracion: Date | null;
  pendienteReconocer: boolean; cuentaOfuscada: string | null; enlazadaA: string | null; prueba: boolean; ordenId: string | null;
}

const ESTADOS: Record<string, EstadoSusc> = {
  SUBSCRIPTION_STATE_ACTIVE: 'activa',
  SUBSCRIPTION_STATE_CANCELED: 'cancelada',            // canceló la renovación; conserva acceso hasta expiryTime
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'en_gracia',
  SUBSCRIPTION_STATE_ON_HOLD: 'pausada',               // fallo de cobro: sin acceso
  SUBSCRIPTION_STATE_PAUSED: 'pausada',
  SUBSCRIPTION_STATE_EXPIRED: 'expirada',
  SUBSCRIPTION_STATE_PENDING: 'ninguna',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'ninguna',
};

/** Traduce la respuesta de subscriptionsv2.get. Lanza si el formato es inesperado (nunca "adivina" un acceso). */
export function mapearSuscripcionV2(j: any): SuscripcionPlay {
  if (typeof j !== 'object' || j === null) throw new Error('respuesta de Play vacía');
  const estado = ESTADOS[j.subscriptionState];
  if (!estado) throw new Error(`estado de suscripción desconocido: ${String(j.subscriptionState).slice(0, 60)}`);
  const lineas = Array.isArray(j.lineItems) ? j.lineItems : [];
  if (!lineas.length || typeof lineas[0].productId !== 'string') throw new Error('suscripción sin productId');
  const fechas = lineas.map((l: any) => (l.expiryTime ? new Date(l.expiryTime) : null)).filter((d: Date | null): d is Date => !!d && !isNaN(d.getTime()));
  const exp = fechas.length ? new Date(Math.max(...fechas.map((d: Date) => d.getTime()))) : null;
  const ini = j.startTime && !isNaN(Date.parse(j.startTime)) ? new Date(j.startTime) : null;
  return {
    estado, productoId: lineas[0].productId, inicio: ini, expiracion: exp,
    pendienteReconocer: j.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    cuentaOfuscada: j.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    enlazadaA: typeof j.linkedPurchaseToken === 'string' ? j.linkedPurchaseToken : null,
    prueba: j.testPurchase !== undefined && j.testPurchase !== null,
    ordenId: typeof j.latestOrderId === 'string' ? j.latestOrderId : null,
  };
}

/** ¿Da derecho de acceso AHORA? Misma regla que tiene_premium() en SQL (se prueban juntas). */
export function daAcceso(s: Pick<SuscripcionPlay, 'estado' | 'expiracion'>, ahora = new Date()): boolean {
  const vigente = s.expiracion !== null && s.expiracion.getTime() > ahora.getTime();
  if (s.estado === 'activa' || s.estado === 'en_gracia') return s.expiracion === null || vigente;
  if (s.estado === 'cancelada') return vigente;
  return false;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
/** Se guarda el HASH del token de compra, nunca el token. */
export const hashToken = (token: string) => sha256Hex(token);
/** Identificador que la app pasa a Play (setObfuscatedAccountId) para ligar la compra a la cuenta. Debe coincidir con la app. */
export const idOfuscado = (uid: string) => sha256Hex(`ilusion:${uid}`);

export function productosPermitidos(env: string | undefined): Set<string> {
  const s = new Set((env ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  if (!s.size) throw new Error('PLAY_PRODUCTOS sin configurar');
  return s;
}

// ───────── OAuth de cuenta de servicio (JWT RS256) ─────────
const b64u = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function importarClave(pem: string): Promise<CryptoKey> {
  const cuerpo = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  if (!cuerpo) throw new Error('clave privada vacía');
  const der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
export async function firmarAserto(sa: { client_email: string; private_key: string }, ahora = new Date()): Promise<string> {
  const iat = Math.floor(ahora.getTime() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3000 }));
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importarClave(sa.private_key), enc.encode(`${cab}.${cuerpo}`));
  return `${cab}.${cuerpo}.${b64u(firma)}`;
}
type Fetch = typeof fetch;
export async function tokenAcceso(sa: { client_email: string; private_key: string }, f: Fetch = fetch, ahora = new Date()): Promise<string> {
  const r = await f('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await firmarAserto(sa, ahora) }),
  });
  if (!r.ok) throw new Error(`OAuth de Google: HTTP ${r.status}`);
  const j = await r.json();
  if (typeof j.access_token !== 'string') throw new Error('OAuth de Google sin access_token');
  return j.access_token;
}

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
export type ErrorPlay = Error & { estadoHttp: number };
const errorPlay = (m: string, estadoHttp: number) => Object.assign(new Error(m), { estadoHttp }) as ErrorPlay;

export async function consultarSuscripcion(paquete: string, token: string, acceso: string, f: Fetch = fetch): Promise<SuscripcionPlay> {
  const r = await f(`${BASE}/${encodeURIComponent(paquete)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${acceso}` } });
  if (r.status === 404 || r.status === 410 || r.status === 400) throw errorPlay('compra no encontrada en Google Play', 404);
  if (!r.ok) throw errorPlay(`Google Play: HTTP ${r.status}`, 502);
  return mapearSuscripcionV2(await r.json());
}
export async function reconocer(paquete: string, producto: string, token: string, acceso: string, f: Fetch = fetch): Promise<void> {
  const r = await f(`${BASE}/${encodeURIComponent(paquete)}/purchases/subscriptions/${encodeURIComponent(producto)}/tokens/${encodeURIComponent(token)}:acknowledge`,
    { method: 'POST', headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok && r.status !== 409) throw errorPlay(`no se pudo reconocer la compra: HTTP ${r.status}`, 502);   // 409 = ya reconocida
}

/** Comparación en tiempo constante para secretos (webhook de Pub/Sub). */
export function igualesSeguro(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b); let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

export type Decision = { ok: true } | { ok: false; codigo: 'producto_no_permitido' | 'compra_sin_cuenta' | 'compra_de_otra_cuenta' | 'sin_acceso'; mensaje: string };
/** Reglas de aceptación de una compra para ESTE usuario. */
export function validarCompra(s: SuscripcionPlay, uidOfuscado: string, permitidos: Set<string>): Decision {
  if (!permitidos.has(s.productoId)) return { ok: false, codigo: 'producto_no_permitido', mensaje: 'Producto no reconocido.' };
  if (!s.cuentaOfuscada) return { ok: false, codigo: 'compra_sin_cuenta', mensaje: 'La compra no está ligada a una cuenta. Inicia sesión y vuelve a comprar.' };
  if (!igualesSeguro(s.cuentaOfuscada, uidOfuscado)) return { ok: false, codigo: 'compra_de_otra_cuenta', mensaje: 'Esta compra pertenece a otra cuenta.' };
  return { ok: true };
}
