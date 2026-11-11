-- ILUSIÓN PANTALLA · 0005 · Premium (Google Play) y derechos de cuenta

-- Corrección de 0001: un usuario que CANCELA conserva el acceso hasta que vence lo ya pagado (regla de Google Play).
-- Con acceso: verificada y (activa|en_gracia sin vencer) o (cancelada con vencimiento futuro). Pausada/en espera/expirada: sin acceso.
create or replace function tiene_premium(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from suscripciones
    where usuario_id = uid and recibo_verificado
      and ( (estado in ('activa','en_gracia') and (expiracion is null or expiracion > now()))
         or (estado = 'cancelada' and expiracion is not null and expiracion > now()) )
  )
$$;

-- Una suscripción por token de compra: el mismo token no puede pertenecer a dos cuentas (anti-reutilización).
-- (ya existe unique (plataforma, purchase_token_hash); aquí se exige que el hash exista en las verificadas de Play)
alter table suscripciones add constraint susc_play_con_token check (plataforma <> 'google_play' or purchase_token_hash is not null);

-- Sincroniza perfiles.plan / estado_suscripcion desde las suscripciones (lo llama el backend con service_role tras verificar).
create or replace function sincronizar_plan(p_usuario uuid) returns void language plpgsql security definer set search_path = public as $$
declare vigente boolean; estado_visible estado_suscripcion;
begin
  vigente := tiene_premium(p_usuario);
  select s.estado into estado_visible from suscripciones s where s.usuario_id = p_usuario order by s.updated_at desc limit 1;
  update perfiles set plan = case when vigente then 'premium'::plan_usuario else 'gratis'::plan_usuario end,
                      estado_suscripcion = coalesce(estado_visible, 'ninguna') where id = p_usuario;
end $$;
revoke all on function sincronizar_plan(uuid) from public, anon, authenticated;
grant execute on function sincronizar_plan(uuid) to service_role;

-- Derecho de acceso/portabilidad (RGPD art. 15 y 20): el propio usuario descarga todo lo que guardamos de él.
create or replace function exportar_mis_datos() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no autenticado'; end if;
  return jsonb_build_object(
    'generado_utc', now(),
    'perfil',        (select to_jsonb(p) - 'borrado_solicitado_at' from perfiles p where p.id = uid),
    'favoritos',     coalesce((select jsonb_agg(jsonb_build_object('wallpaper_id', f.wallpaper_id, 'created_at', f.created_at)) from favoritos f where f.usuario_id = uid), '[]'),
    'historial',     coalesce((select jsonb_agg(jsonb_build_object('wallpaper_id', h.wallpaper_id, 'accion', h.accion, 'created_at', h.created_at) order by h.created_at) from historial h where h.usuario_id = uid), '[]'),
    'descargas',     coalesce((select jsonb_agg(jsonb_build_object('wallpaper_id', d.wallpaper_id, 'calidad', d.calidad, 'estado', d.estado, 'created_at', d.created_at)) from descargas d where d.usuario_id = uid), '[]'),
    'suscripciones', coalesce((select jsonb_agg(jsonb_build_object('plataforma', s.plataforma, 'producto_id', s.producto_id, 'estado', s.estado, 'inicio', s.inicio, 'expiracion', s.expiracion)) from suscripciones s where s.usuario_id = uid), '[]'),
    'dispositivos',  coalesce((select jsonb_agg(jsonb_build_object('plataforma', d.plataforma, 'modelo', d.modelo, 'version_sistema', d.version_sistema, 'created_at', d.created_at)) from dispositivos d where d.usuario_id = uid), '[]'),
    'consentimientos', coalesce((select jsonb_agg(jsonb_build_object('finalidad', c.finalidad, 'concedido', c.concedido, 'version_texto', c.version_texto, 'created_at', c.created_at)) from consentimientos c where c.usuario_id = uid), '[]'),
    'reportes',      coalesce((select jsonb_agg(jsonb_build_object('wallpaper_id', r.wallpaper_id, 'motivo', r.motivo, 'created_at', r.created_at)) from reportes_contenido r where r.usuario_id = uid), '[]')
  );
end $$;
revoke all on function exportar_mis_datos() from public, anon;
grant execute on function exportar_mis_datos() to authenticated;
