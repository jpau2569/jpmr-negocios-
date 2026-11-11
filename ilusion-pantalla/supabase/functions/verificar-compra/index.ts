// POST /functions/v1/verificar-compra   (requiere sesión)
// Body: { purchase_token: string }  → consulta Google Play, valida que sea NUESTRO producto y de ESTA cuenta, guarda y devuelve el estado.
// También sirve para «Restaurar compras»: la app llama una vez por cada token que Play le devuelva.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consultarSuscripcion, daAcceso, idOfuscado, productosPermitidos, reconocer, tokenAcceso, validarCompra, type ErrorPlay } from '../_shared/play.ts';
import { guardarSuscripcion } from '../_shared/suscripciones.ts';
import { CORS, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  try {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'inicia sesión para continuar', codigo: 'sin_sesion' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: u, error: eu } = await sb.auth.getUser(jwt);
    if (eu || !u.user) return json({ error: 'sesión no válida', codigo: 'sin_sesion' }, 401);
    const uid = u.user.id;

    const b = await req.json().catch(() => ({}));
    const token = b.purchase_token;
    if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return json({ error: 'purchase_token inválido' }, 400);

    const paquete = Deno.env.get('PLAY_PACKAGE_NAME'), sa = Deno.env.get('GOOGLE_PLAY_SA_JSON');
    if (!paquete || !sa) { console.error('verificar-compra: Play sin configurar'); return json({ error: 'servicio no disponible' }, 503); }
    const permitidos = productosPermitidos(Deno.env.get('PLAY_PRODUCTOS'));

    const acceso = await tokenAcceso(JSON.parse(sa));
    let s;
    try { s = await consultarSuscripcion(paquete, token, acceso); }
    catch (e) { const st = (e as ErrorPlay).estadoHttp; return json({ error: st === 404 ? 'compra no encontrada' : 'no se pudo verificar ahora', codigo: st === 404 ? 'compra_no_encontrada' : 'play_no_disponible' }, st === 404 ? 404 : 502); }

    const dec = validarCompra(s, await idOfuscado(uid), permitidos);
    if (!dec.ok) return json({ error: dec.mensaje, codigo: dec.codigo }, dec.codigo === 'compra_de_otra_cuenta' ? 409 : 400);

    const r = await guardarSuscripcion(sb, uid, token, s);
    if (r === 'otra_cuenta') return json({ error: 'Esta compra ya está asociada a otra cuenta.', codigo: 'compra_de_otra_cuenta' }, 409);
    // Play devuelve el dinero a los 3 días si no se reconoce: lo hace el servidor, no depende de que la app siga abierta.
    if (s.pendienteReconocer && daAcceso(s)) await reconocer(paquete, s.productoId, token, acceso);
    return json({ premium: daAcceso(s), estado: s.estado, expiracion: s.expiracion?.toISOString() ?? null, producto: s.productoId, renueva: s.estado === 'activa' });
  } catch (e) {
    console.error('verificar-compra', e instanceof Error ? e.message : 'error');   // sin tokens ni cuerpo
    return json({ error: 'error interno' }, 500);
  }
});
