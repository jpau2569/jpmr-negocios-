// Acceso a datos de suscripciones (service_role). Compartido por verificar-compra y notificacion-play.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashToken, type SuscripcionPlay } from './play.ts';

/** Inserta/actualiza la fila de una compra. Devuelve 'otra_cuenta' si ese token ya pertenece a otro usuario. */
export async function guardarSuscripcion(sb: SupabaseClient, uid: string, token: string, s: SuscripcionPlay): Promise<'ok' | 'otra_cuenta'> {
  const hash = await hashToken(token);
  const { data: previa } = await sb.from('suscripciones').select('id,usuario_id').eq('plataforma', 'google_play').eq('purchase_token_hash', hash).maybeSingle();
  if (previa && previa.usuario_id !== uid) return 'otra_cuenta';
  const fila = {
    usuario_id: uid, plataforma: 'google_play', producto_id: s.productoId, purchase_token_hash: hash, estado: s.estado,
    inicio: (s.inicio ?? new Date()).toISOString(), renovacion: s.estado === 'activa' ? s.expiracion?.toISOString() ?? null : null,
    expiracion: s.expiracion?.toISOString() ?? null, recibo_verificado: true, ultima_verificacion: new Date().toISOString(),
  };
  const { error } = previa ? await sb.from('suscripciones').update(fila).eq('id', previa.id) : await sb.from('suscripciones').insert(fila);
  if (error) throw error;
  // Si esta compra sustituye a otra (cambio de plan / resuscripción), la anterior deja de dar acceso.
  if (s.enlazadaA) await sb.from('suscripciones').update({ estado: 'expirada', ultima_verificacion: new Date().toISOString() }).eq('plataforma', 'google_play').eq('purchase_token_hash', await hashToken(s.enlazadaA)).eq('usuario_id', uid);
  const { error: e2 } = await sb.rpc('sincronizar_plan', { p_usuario: uid });
  if (e2) throw e2;
  return 'ok';
}
