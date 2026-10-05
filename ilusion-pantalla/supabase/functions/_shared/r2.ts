// Firma de URLs S3-compatibles (AWS SigV4, firma en query) para Cloudflare R2.
// Solo Web Crypto: funciona igual en Deno (Edge Functions) y Node (tests).

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}
// RFC 3986 estricto (SigV4 lo exige): encodeURIComponent deja sin escapar ! ' ( ) *
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const rutaCodificada = (p: string) => p.split('/').map(rfc3986).join('/');

export interface OpcionesFirma {
  metodo: 'GET' | 'PUT';
  host: string;            // <cuenta>.r2.cloudflarestorage.com
  ruta: string;            // /<bucket>/<clave> (path-style, el que usa R2)
  region?: string;         // R2: 'auto'
  accessKeyId: string;
  secretAccessKey: string;
  caducaSeg: number;       // 1..604800
  ahora?: Date;            // inyectable para tests
  cabecerasFirmadas?: Record<string, string>; // p. ej. content-type en PUT
}

export async function firmarUrl(o: OpcionesFirma): Promise<string> {
  if (!(o.caducaSeg >= 1 && o.caducaSeg <= 604800)) throw new Error('caducaSeg fuera de 1..604800');
  if (!o.ruta.startsWith('/') || o.ruta.includes('..')) throw new Error('ruta inválida');
  const region = o.region ?? 'auto';
  const f = (o.ahora ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20130524T000000Z
  const dia = f.slice(0, 8);
  const alcance = `${dia}/${region}/s3/aws4_request`;
  const cab: Record<string, string> = { host: o.host };
  for (const [k, v] of Object.entries(o.cabecerasFirmadas ?? {})) cab[k.toLowerCase()] = v.trim();
  const nombres = Object.keys(cab).sort();
  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${o.accessKeyId}/${alcance}`,
    'X-Amz-Date': f,
    'X-Amz-Expires': String(o.caducaSeg),
    'X-Amz-SignedHeaders': nombres.join(';'),
  };
  const consulta = Object.keys(q).sort().map((k) => `${rfc3986(k)}=${rfc3986(q[k])}`).join('&');
  const peticion = [
    o.metodo, rutaCodificada(o.ruta), consulta,
    nombres.map((n) => `${n}:${cab[n]}\n`).join(''), nombres.join(';'), 'UNSIGNED-PAYLOAD',
  ].join('\n');
  const aFirmar = ['AWS4-HMAC-SHA256', f, alcance, await sha256(peticion)].join('\n');
  let k = await hmac(enc.encode('AWS4' + o.secretAccessKey), dia);
  for (const parte of [region, 's3', 'aws4_request']) k = await hmac(k, parte);
  const firma = hex(await hmac(k, aFirmar));
  return `https://${o.host}${rutaCodificada(o.ruta)}?${consulta}&X-Amz-Signature=${firma}`;
}
