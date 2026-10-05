// POST /functions/v1/admin-subida   (solo staff: admin/editor)
// Body: { slug, tipo: 'video'|'preview'|'thumb'|'poster', calidad?, mime, bytes }
// Devuelve una URL PUT firmada (10 min) con Content-Type fijado. Tras subir, el panel registra la fila en wallpaper_archivos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { firmarUrl } from '../_shared/r2.ts';
import { claveSubida } from '../_shared/acceso.ts';
import { CORS, json, r2Config } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'sin sesión' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: u, error } = await sb.auth.getUser(token);
    if (error || !u.user) return json({ error: 'sesión no válida' }, 401);
    const { data: perfil } = await sb.from('perfiles').select('rol').eq('id', u.user.id).maybeSingle();
    if (!perfil || !['admin', 'editor'].includes(perfil.rol)) return json({ error: 'sin permiso' }, 403);

    const b = await req.json().catch(() => ({}));
    let clave: string;
    try { clave = claveSubida({ slug: b.slug, tipo: b.tipo, calidad: b.calidad, mime: b.mime, bytes: Number(b.bytes) }); }
    catch (e) { return json({ error: (e as Error).message }, 400); }

    const r2 = r2Config();
    const url = await firmarUrl({
      metodo: 'PUT', host: r2.host, ruta: `/${r2.bucket}/${clave}`, accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey,
      caducaSeg: 600, cabecerasFirmadas: { 'content-type': b.mime },
    });
    return json({ url, clave, cabeceras: { 'Content-Type': b.mime }, caduca_en_s: 600 });
  } catch (e) {
    console.error('admin-subida', e instanceof Error ? e.message : 'error');
    return json({ error: 'error interno' }, 500);
  }
});
