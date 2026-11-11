// POST /functions/v1/borrar-cuenta   (requiere sesión)   Body: { confirmar: true, acepto_suscripcion_activa?: boolean }
// Borra la cuenta y, por cascada, todos sus datos (perfil, favoritos, historial, descargas, suscripciones, dispositivos…).
// OJO: no cancela la suscripción de Google Play (solo el usuario puede, en Play): se avisa antes de borrar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  try {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'sin sesión' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: u, error } = await sb.auth.getUser(jwt);
    if (error || !u.user) return json({ error: 'sesión no válida' }, 401);
    const b = await req.json().catch(() => ({}));
    if (b.confirmar !== true) return json({ error: 'falta confirmación explícita', codigo: 'sin_confirmar' }, 400);

    const { data: premium } = await sb.rpc('tiene_premium', { uid: u.user.id });
    if (premium && b.acepto_suscripcion_activa !== true)
      return json({ error: 'Tienes una suscripción activa. Bórrala o cancélala antes en Google Play (Play Store → Pagos y suscripciones) o confirma que lo has entendido.', codigo: 'suscripcion_activa' }, 409);

    const { error: eb } = await sb.auth.admin.deleteUser(u.user.id);
    if (eb) throw eb;
    return json({ ok: true });
  } catch (e) {
    console.error('borrar-cuenta', e instanceof Error ? e.message : 'error');
    return json({ error: 'error interno' }, 500);
  }
});
