export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') ?? '*',   // la app Android no usa CORS; el panel fija su dominio
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function r2Config() {
  const cuenta = Deno.env.get('R2_ACCOUNT_ID'), key = Deno.env.get('R2_ACCESS_KEY_ID'),
    secret = Deno.env.get('R2_SECRET_ACCESS_KEY'), bucket = Deno.env.get('R2_BUCKET'),
    bucketPublico = Deno.env.get('R2_BUCKET_PUBLIC'), urlPublicaBase = Deno.env.get('R2_PUBLIC_BASE_URL');
  if (!cuenta || !key || !secret || !bucket) throw new Error('R2 sin configurar');
  return { host: `${cuenta}.r2.cloudflarestorage.com`, accessKeyId: key, secretAccessKey: secret, bucket, bucketPublico, urlPublicaBase };
}
