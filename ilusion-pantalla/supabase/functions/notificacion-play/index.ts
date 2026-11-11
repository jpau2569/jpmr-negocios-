// POST /functions/v1/notificacion-play?k=<PLAY_RTDN_SECRET>
// Notificaciones de desarrollador en tiempo real (Pub/Sub push): renovaciones, cancelaciones, fallos de cobro, reembolsos.
// Solo REFRESCA compras que ya conocemos (no crea derechos nuevos): el alta siempre pasa por verificar-compra.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consultarSuscripcion, hashToken, igualesSeguro, tokenAcceso } from '../_shared/play.ts';
import { guardarSuscripcion } from '../_shared/suscripciones.ts';

const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método no permitido', { status: 405 });
  const secreto = Deno.env.get('PLAY_RTDN_SECRET') ?? '';
  const k = new URL(req.url).searchParams.get('k') ?? '';
  if (secreto.length < 24 || !igualesSeguro(k, secreto)) return new Response('no autorizado', { status: 401 });
  try {
    const cuerpo = await req.json().catch(() => null);
    const datos = cuerpo?.message?.data;
    if (typeof datos !== 'string') return ok();                       // mensaje irrelevante: confirmar para que no se reintente
    const n = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(datos), (c) => c.charCodeAt(0))));
    const paquete = Deno.env.get('PLAY_PACKAGE_NAME');
    if (!paquete || n.packageName !== paquete) return ok();
    const token = n.subscriptionNotification?.purchaseToken;
    if (typeof token !== 'string') return ok();                       // testNotification u otros tipos

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: fila } = await sb.from('suscripciones').select('usuario_id').eq('plataforma', 'google_play').eq('purchase_token_hash', await hashToken(token)).maybeSingle();
    if (!fila) return ok();                                           // compra desconocida (aún sin verificar desde la app)

    const acceso = await tokenAcceso(JSON.parse(Deno.env.get('GOOGLE_PLAY_SA_JSON')!));
    const s = await consultarSuscripcion(paquete, token, acceso);
    await guardarSuscripcion(sb, fila.usuario_id, token, s);
    return ok();
  } catch (e) {
    console.error('notificacion-play', e instanceof Error ? e.message : 'error');
    return new Response('reintentar', { status: 500 });               // Pub/Sub reintenta con backoff
  }
});
