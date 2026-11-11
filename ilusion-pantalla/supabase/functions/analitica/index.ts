// POST /functions/v1/analitica
//   { accion: 'consentimiento', instalacion_id, concedido: boolean, version_texto }
//   { accion: 'eventos',        instalacion_id, eventos: [{ evento, propiedades, hace_s? }] }
//   { accion: 'borrar',         instalacion_id }
// Privacidad: no se guarda IP, user-agent ni usuario_id. Sin consentimiento vigente los eventos se DESCARTAN.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONSENTIMIENTO_VERSION, LIMITES, esUuid, sanearConsentimiento, sanearLote } from '../_shared/analitica.ts';
import { CORS, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  try {
    const texto = await req.text();
    if (texto.length > LIMITES.cuerpo_max_bytes) return json({ error: 'cuerpo demasiado grande' }, 413);
    let b: Record<string, unknown>;
    try { b = JSON.parse(texto); } catch { return json({ error: 'JSON inválido' }, 400); }
    if (!esUuid(b.instalacion_id)) return json({ error: 'instalacion_id inválido' }, 400);
    const inst = b.instalacion_id;
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    if (b.accion === 'consentimiento') {
      let c; try { c = sanearConsentimiento(b); } catch (e) { return json({ error: (e as Error).message }, 400); }
      // Solo se puede CONCEDER sobre la versión vigente del texto; revocar vale con cualquier versión.
      if (c.concedido && c.version_texto !== CONSENTIMIENTO_VERSION) return json({ error: 'versión del texto desactualizada', version_vigente: CONSENTIMIENTO_VERSION }, 409);
      const desde = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await sb.from('consentimientos').select('id', { count: 'exact', head: true }).eq('instalacion_id', inst).gte('created_at', desde);
      if ((count ?? 0) >= 20) return json({ error: 'demasiados cambios' }, 429);
      const { error } = await sb.from('consentimientos').insert({ instalacion_id: inst, finalidad: 'analitica', concedido: c.concedido, version_texto: c.version_texto });
      if (error) throw error;
      return json({ ok: true, version_vigente: CONSENTIMIENTO_VERSION });
    }

    if (b.accion === 'borrar') {
      const { data, error } = await sb.rpc('borrar_analitica', { p_instalacion: inst, p_version: CONSENTIMIENTO_VERSION });
      if (error) throw error;
      return json({ ok: true, borrados: data });
    }

    if (b.accion === 'eventos') {
      let lote; try { lote = sanearLote(b); } catch (e) { return json({ error: (e as Error).message }, 400); }
      const { data: vigente } = await sb.rpc('consentimiento_vigente', { p_instalacion: inst, p_finalidad: 'analitica', p_version: CONSENTIMIENTO_VERSION });
      if (!vigente) return json({ guardados: 0, descartados: lote.eventos.length + lote.descartados, motivo: 'sin_consentimiento' });
      if (!lote.eventos.length) return json({ guardados: 0, descartados: lote.descartados });

      const desde = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await sb.from('eventos_analitica').select('id', { count: 'exact', head: true }).eq('instalacion_id', inst).gte('created_at', desde);
      const hueco = LIMITES.eventos_por_dia_y_instalacion - (count ?? 0);
      if (hueco <= 0) return json({ guardados: 0, descartados: lote.eventos.length + lote.descartados, motivo: 'limite_diario' });
      const aGuardar = lote.eventos.slice(0, hueco);
      const ahora = Date.now();
      const { error } = await sb.from('eventos_analitica').insert(aGuardar.map((e) => ({
        instalacion_id: inst, usuario_id: null, evento: e.evento, propiedades_evento: e.propiedades,
        created_at: new Date(ahora - e.hace_s * 1000).toISOString(),
      })));
      if (error) throw error;
      return json({ guardados: aGuardar.length, descartados: lote.descartados + (lote.eventos.length - aGuardar.length) });
    }
    return json({ error: 'acción desconocida' }, 400);
  } catch (e) {
    console.error('analitica', e instanceof Error ? e.message : 'error');   // nunca el cuerpo
    return json({ error: 'error interno' }, 500);
  }
});
