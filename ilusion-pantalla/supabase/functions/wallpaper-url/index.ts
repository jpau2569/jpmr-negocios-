// POST /functions/v1/wallpaper-url
// Body: { wallpaper_id: uuid, calidad?: 'q720'|'q1080'|'q1440'|'q2160', hevc?: boolean, fps?: 24|30|60 }
// Devuelve una URL firmada de R2 (10 min) del mejor archivo permitido. Premium exige suscripción verificada.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { firmarUrl } from '../_shared/r2.ts';
import { CALIDADES, elegirArchivo, puedeDescargar, type Calidad } from '../_shared/acceso.ts';
import { CORS, json, r2Config } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    if (!UUID.test(b.wallpaper_id ?? '')) return json({ error: 'wallpaper_id inválido' }, 400);
    const calidad: Calidad = CALIDADES.includes(b.calidad) ? b.calidad : 'q1080';
    const fps = [24, 30, 60].includes(b.fps) ? b.fps : 30;

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // Identidad: opcional (el contenido gratis funciona sin cuenta). Si hay token, debe ser válido.
    let uid: string | null = null;
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (token && token !== Deno.env.get('SUPABASE_ANON_KEY')) {
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return json({ error: 'sesión no válida' }, 401);
      uid = data.user.id;
    }

    const { data: w } = await sb.from('wallpapers').select('id,es_premium,estado_publicacion').eq('id', b.wallpaper_id).maybeSingle();
    if (!w) return json({ error: 'no encontrado' }, 404);
    let premium = false;
    if (w.es_premium && uid) premium = !!(await sb.rpc('tiene_premium', { uid })).data;
    if (!puedeDescargar(w, premium)) {
      // Mismo 404 para borrador y no publicado (no filtra su existencia); 402 solo si es premium publicado.
      return w.estado_publicacion === 'publicado' ? json({ error: 'requiere Premium', codigo: 'premium_requerido' }, 402) : json({ error: 'no encontrado' }, 404);
    }

    const { data: archivos } = await sb.from('wallpaper_archivos').select('calidad,codec,fps,storage_path,tamano_bytes').eq('wallpaper_id', w.id);
    const a = elegirArchivo(archivos ?? [], calidad, b.hevc === true, fps);
    if (!a) return json({ error: 'sin archivo compatible' }, 404);

    const r2 = r2Config();
    const caducaSeg = 600;
    const url = await firmarUrl({ metodo: 'GET', host: r2.host, ruta: `/${r2.bucket}/${a.storage_path}`, accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey, caducaSeg });
    return json({ url, calidad: a.calidad, codec: a.codec, fps: a.fps, tamano_bytes: a.tamano_bytes, caduca_en_s: caducaSeg });
  } catch (e) {
    console.error('wallpaper-url', e instanceof Error ? e.message : 'error');   // sin cuerpo ni tokens en logs
    return json({ error: 'error interno' }, 500);
  }
});
