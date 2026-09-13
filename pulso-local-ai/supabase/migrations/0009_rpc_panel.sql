-- ============================================================================
--  PULSO LOCAL AI — 0009 · RPC del panel
-- ----------------------------------------------------------------------------
--  Agregados que no tiene sentido traerse fila a fila al navegador. Todas
--  comprueban la pertenencia al negocio ANTES de leer nada: son SECURITY DEFINER
--  y por tanto no pueden confiar en RLS.
-- ============================================================================

create or replace function public.resumen_negocio(
  p_business_id uuid,
  p_desde timestamptz default (now() - interval '30 days'),
  p_hasta timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
begin
  if not public.es_miembro(p_business_id) then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'escaneos_qr', (select count(*) from public.qr_scan_events e
                     where e.business_id = p_business_id and e.created_at between p_desde and p_hasta),
    'visitas_unicas', (select count(distinct e.session_id) from public.analytics_events e
                     where e.business_id = p_business_id and e.created_at between p_desde and p_hasta),
    'vistas_landing', (select count(*) from public.analytics_events e
                     where e.business_id = p_business_id and e.event_type in ('public_landing_view', 'qr_landing_view')
                       and e.created_at between p_desde and p_hasta),
    'fichas_vistas', (select count(*) from public.analytics_events e
                     where e.business_id = p_business_id and e.event_type = 'property_view'
                       and e.created_at between p_desde and p_hasta),
    'clics_whatsapp', (select count(*) from public.analytics_events e
                     where e.business_id = p_business_id and e.event_type = 'whatsapp_click'
                       and e.created_at between p_desde and p_hasta),
    'clics_llamada', (select count(*) from public.analytics_events e
                     where e.business_id = p_business_id and e.event_type = 'call_click'
                       and e.created_at between p_desde and p_hasta),
    'clics_resena', (select count(*) from public.analytics_events e
                     where e.business_id = p_business_id and e.event_type = 'google_review_click'
                       and e.created_at between p_desde and p_hasta),
    'leads', (select count(*) from public.leads l
                     where l.business_id = p_business_id and l.created_at between p_desde and p_hasta),
    'leads_nuevos', (select count(*) from public.leads l
                     where l.business_id = p_business_id and l.status = 'nuevo'),
    'visitas_solicitadas', (select count(*) from public.visit_requests v
                     where v.business_id = p_business_id and v.created_at between p_desde and p_hasta),
    'visitas_pendientes', (select count(*) from public.visit_requests v
                     where v.business_id = p_business_id and v.status = 'pendiente'),
    'valoraciones', (select count(*) from public.valuation_requests v
                     where v.business_id = p_business_id and v.created_at between p_desde and p_hasta),
    'opiniones', (select count(*) from public.feedback f
                     where f.business_id = p_business_id and f.created_at between p_desde and p_hasta),
    'nota_media', (select round(avg(f.rating)::numeric, 2) from public.feedback f
                     where f.business_id = p_business_id and f.created_at between p_desde and p_hasta),
    'opiniones_bajas', (select count(*) from public.feedback f
                     where f.business_id = p_business_id and f.rating <= 3 and f.status <> 'resuelto'),
    'inmuebles_publicados', (select count(*) from public.properties p
                     where p.business_id = p_business_id and p.published_at is not null and p.deleted_at is null)
  ) into r;

  return r;
end;
$$;

-- Serie diaria de eventos para los gráficos del panel.
create or replace function public.serie_eventos(
  p_business_id uuid,
  p_dias integer default 30
)
returns table (dia date, vistas bigint, leads bigint, whatsapp bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_miembro(p_business_id) then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;

  return query
  with dias as (
    select generate_series((current_date - (p_dias - 1)), current_date, interval '1 day')::date as dia
  )
  select d.dia,
         coalesce((select count(*) from public.analytics_events e
                    where e.business_id = p_business_id and e.created_at::date = d.dia
                      and e.event_type in ('public_landing_view', 'qr_landing_view', 'property_view')), 0),
         coalesce((select count(*) from public.leads l
                    where l.business_id = p_business_id and l.created_at::date = d.dia), 0),
         coalesce((select count(*) from public.analytics_events e
                    where e.business_id = p_business_id and e.created_at::date = d.dia
                      and e.event_type = 'whatsapp_click'), 0)
    from dias d
   order by d.dia;
end;
$$;

-- Ranking de inmuebles por interés real (vistas + leads).
create or replace function public.ranking_inmuebles(
  p_business_id uuid,
  p_dias integer default 30,
  p_limite integer default 10
)
returns table (property_id uuid, titulo text, slug text, vistas bigint, leads bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_miembro(p_business_id) then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;

  return query
  select p.id, p.title, p.slug::text,
         coalesce(v.vistas, 0) as vistas,
         coalesce(l.leads, 0) as leads
    from public.properties p
    left join (
      select e.property_id, count(*) as vistas from public.analytics_events e
       where e.business_id = p_business_id and e.event_type = 'property_view'
         and e.created_at > now() - make_interval(days => p_dias)
       group by e.property_id
    ) v on v.property_id = p.id
    left join (
      select le.property_id, count(*) as leads from public.leads le
       where le.business_id = p_business_id
         and le.created_at > now() - make_interval(days => p_dias)
       group by le.property_id
    ) l on l.property_id = p.id
   where p.business_id = p_business_id and p.deleted_at is null
   order by coalesce(v.vistas, 0) desc, coalesce(l.leads, 0) desc
   limit p_limite;
end;
$$;

-- Rendimiento por QR: escaneos y leads atribuidos.
create or replace function public.rendimiento_qr(p_business_id uuid, p_dias integer default 30)
returns table (qr_id uuid, etiqueta text, codigo text, escaneos bigint, leads bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_miembro(p_business_id) then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;

  return query
  select q.id, q.label, q.code::text,
         coalesce((select count(*) from public.qr_scan_events s
                    where s.qr_id = q.id and s.created_at > now() - make_interval(days => p_dias)), 0),
         coalesce((select count(*) from public.leads l
                    where l.qr_id = q.id and l.created_at > now() - make_interval(days => p_dias)), 0)
    from public.qr_codes q
   where q.business_id = p_business_id and q.deleted_at is null
   order by 4 desc;
end;
$$;

-- Métricas globales del SaaS (solo superadministrador).
create or replace function public.metricas_saas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare r jsonb;
begin
  if not public.es_superadmin() then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'negocios_total', (select count(*) from public.businesses where deleted_at is null),
    'en_demo', (select count(*) from public.businesses where status = 'trial' and deleted_at is null),
    'activos', (select count(*) from public.businesses where status = 'active' and deleted_at is null),
    'suspendidos', (select count(*) from public.businesses where status = 'suspended' and deleted_at is null),
    'caducados', (select count(*) from public.businesses where status = 'expired' and deleted_at is null),
    'demos_por_caducar', (select count(*) from public.businesses
                           where status = 'trial' and trial_ends_at between now() and now() + interval '3 days'),
    'leads_total', (select count(*) from public.leads),
    'leads_30d', (select count(*) from public.leads where created_at > now() - interval '30 days'),
    'inmuebles_publicados', (select count(*) from public.properties where published_at is not null and deleted_at is null)
  ) into r;
  return r;
end;
$$;
