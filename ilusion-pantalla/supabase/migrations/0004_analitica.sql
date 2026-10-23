-- ILUSIÓN PANTALLA · 0004 · Analítica con consentimiento
-- Cambio de modelo respecto a 0001: los clientes YA NO escriben en eventos_analitica ni en consentimientos.
-- Todo entra por la Edge Function `analitica` (valida contra supabase/functions/_shared/eventos.json y exige consentimiento vigente).

alter table eventos_analitica add column instalacion_id uuid;
create index eventos_instalacion_idx on eventos_analitica (instalacion_id, created_at desc);
create index consent_instalacion_idx on consentimientos (instalacion_id, finalidad, created_at desc);

drop policy eventos_insert on eventos_analitica;
drop policy consent_insert on consentimientos;
revoke insert on eventos_analitica, consentimientos from anon, authenticated;

-- ¿Tiene esta instalación un consentimiento de analítica vigente para esta versión del texto?
-- Vigente = el ÚLTIMO registro es "concedido" y de la versión actual (revocar o cambiar el texto invalida).
create or replace function consentimiento_vigente(p_instalacion uuid, p_finalidad text, p_version text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select concedido and version_texto = p_version
                   from consentimientos
                   where instalacion_id = p_instalacion and finalidad = p_finalidad
                   order by created_at desc, id desc limit 1), false)
$$;
revoke all on function consentimiento_vigente(uuid, text, text) from public, anon, authenticated;
grant execute on function consentimiento_vigente(uuid, text, text) to service_role;

-- Derecho de supresión: borra los eventos de una instalación y deja constancia de la revocación.
create or replace function borrar_analitica(p_instalacion uuid, p_version text) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  delete from eventos_analitica where instalacion_id = p_instalacion;
  get diagnostics n = row_count;
  insert into consentimientos (instalacion_id, finalidad, concedido, version_texto) values (p_instalacion, 'analitica', false, p_version);
  return n;
end $$;
revoke all on function borrar_analitica(uuid, text) from public, anon, authenticated;
grant execute on function borrar_analitica(uuid, text) to service_role;

-- Minimización: conservar como máximo N meses (por defecto 13). Programar a diario (pg_cron o cron externo con service_role).
create or replace function purgar_analitica(p_meses int default 13) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if p_meses < 1 then raise exception 'p_meses debe ser >= 1'; end if;
  delete from eventos_analitica where created_at < now() - make_interval(months => p_meses);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purgar_analitica(int) from public, anon, authenticated;
grant execute on function purgar_analitica(int) to service_role;

-- ───────── Métricas para el panel (solo staff: las vistas respetan la RLS de eventos_analitica) ─────────
create view metricas_diarias with (security_invoker = true) as
select created_at::date as dia, evento, count(*) as eventos, count(distinct instalacion_id) as instalaciones
from eventos_analitica group by 1, 2;

create view wallpapers_top with (security_invoker = true) as
select propiedades_evento->>'wallpaper_slug' as wallpaper_slug,
  count(*) filter (where evento = 'wallpaper_visto')       as vistas,
  count(*) filter (where evento = 'descarga_completada')   as descargas,
  count(*) filter (where evento = 'wallpaper_aplicado')    as aplicados,
  count(*) filter (where evento = 'wallpaper_activado')    as activados,
  count(*) filter (where evento = 'favorito_alternado' and (propiedades_evento->>'activo')::boolean) as favoritos_altas
from eventos_analitica
where propiedades_evento ? 'wallpaper_slug'
group by 1;

-- Embudo: instalaciones que abren la app → descargan → activan el wallpaper.
create view embudo_activacion with (security_invoker = true) as
select count(distinct instalacion_id) filter (where evento = 'app_abierta')          as abren_app,
       count(distinct instalacion_id) filter (where evento = 'descarga_completada')  as descargan,
       count(distinct instalacion_id) filter (where evento = 'wallpaper_activado')   as activan,
       round(100.0 * count(distinct instalacion_id) filter (where evento = 'wallpaper_activado')
             / nullif(count(distinct instalacion_id) filter (where evento = 'app_abierta'), 0), 1) as pct_activacion
from eventos_analitica;

-- Retención por cohorte (día de la primera actividad vista). D1/D7 = volvieron exactamente ese día (UTC).
create view retencion_cohortes with (security_invoker = true) as
with primera as (select instalacion_id, min(created_at::date) as d0 from eventos_analitica where instalacion_id is not null group by 1),
     activo   as (select distinct instalacion_id, created_at::date as d from eventos_analitica where instalacion_id is not null)
select p.d0 as cohorte, count(*) as instalaciones,
       count(*) filter (where exists (select 1 from activo a where a.instalacion_id = p.instalacion_id and a.d = p.d0 + 1)) as vuelven_d1,
       count(*) filter (where exists (select 1 from activo a where a.instalacion_id = p.instalacion_id and a.d = p.d0 + 7)) as vuelven_d7
from primera p group by 1;

-- Uso por dispositivo (versión de Android), sin identificar a nadie.
create view uso_por_android with (security_invoker = true) as
select (propiedades_evento->>'android_sdk')::int as android_sdk, count(distinct instalacion_id) as instalaciones
from eventos_analitica where evento = 'app_abierta' group by 1;

grant select on metricas_diarias, wallpapers_top, embudo_activacion, retencion_cohortes, uso_por_android to authenticated;
