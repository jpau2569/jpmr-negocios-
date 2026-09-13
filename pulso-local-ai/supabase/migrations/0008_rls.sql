-- ============================================================================
--  PULSO LOCAL AI — 0008 · Row Level Security y privilegios
-- ----------------------------------------------------------------------------
--  Modelo de acceso, en una frase por rol:
--
--    anon          → no toca ninguna tabla. Solo lee las vistas `v_*`.
--    authenticated → solo ve filas de negocios donde tiene fila en
--                    business_members (o es superadministrador del SaaS).
--    service_role  → salta RLS. Lo usan exclusivamente las rutas de servidor
--                    que validan formularios públicos (Zod + honeypot + rate
--                    limit + negocio activo) antes de escribir.
--
--  Ningún formulario público inserta con la clave anónima: el rol `anon` no
--  tiene INSERT en ninguna tabla. Es deliberado.
-- ============================================================================

-- --- Activar RLS en todo ------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.businesses            enable row level security;
alter table public.business_members      enable row level security;
alter table public.business_templates    enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.trial_settings        enable row level security;
alter table public.business_settings     enable row level security;
alter table public.business_admin_notes  enable row level security;
alter table public.service_categories    enable row level security;
alter table public.services              enable row level security;
alter table public.properties            enable row level security;
alter table public.property_media        enable row level security;
alter table public.property_features     enable row level security;
alter table public.leads                 enable row level security;
alter table public.lead_notes            enable row level security;
alter table public.lead_assignments      enable row level security;
alter table public.property_inquiries    enable row level security;
alter table public.visit_requests        enable row level security;
alter table public.valuation_requests    enable row level security;
alter table public.buyer_requests        enable row level security;
alter table public.feedback              enable row level security;
alter table public.legal_text_versions   enable row level security;
alter table public.consent_records       enable row level security;
alter table public.qr_codes              enable row level security;
alter table public.qr_scan_events        enable row level security;
alter table public.analytics_events      enable row level security;
alter table public.campaigns             enable row level security;
alter table public.campaign_audiences    enable row level security;
alter table public.faqs                  enable row level security;
alter table public.ai_knowledge_entries  enable row level security;
alter table public.ai_chat_logs          enable row level security;

-- --- Privilegios base ---------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- El público solo lee vistas.
grant select on public.v_negocios_publicos,
                public.v_inmuebles_publicos,
                public.v_media_publica,
                public.v_caracteristicas_publicas,
                public.v_servicios_publicos,
                public.v_faqs_publicas,
                public.v_ajustes_publicos,
                public.v_textos_legales_vigentes
  to anon, authenticated;

-- El equipo del negocio trabaja contra las tablas, siempre filtrado por RLS.
grant select, insert, update, delete on
  public.businesses, public.business_members, public.business_settings,
  public.service_categories, public.services,
  public.properties, public.property_media, public.property_features,
  public.leads, public.lead_notes, public.lead_assignments,
  public.property_inquiries, public.visit_requests, public.valuation_requests,
  public.buyer_requests, public.feedback, public.qr_codes,
  public.campaigns, public.campaign_audiences,
  public.faqs, public.ai_knowledge_entries, public.legal_text_versions,
  public.trial_settings, public.subscriptions, public.business_templates,
  public.business_admin_notes, public.profiles
  to authenticated;

grant select on public.qr_scan_events, public.analytics_events,
                public.ai_chat_logs, public.consent_records
  to authenticated;

-- Nadie que no sea el propio superadministrador (vía SQL o service role) puede
-- concederse el flag de superadministrador.
revoke update (is_superadmin) on public.profiles from authenticated;

-- --- profiles -----------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_superadmin() or exists (
    select 1 from public.business_members m1
      join public.business_members m2 on m1.business_id = m2.business_id
     where m1.user_id = auth.uid() and m2.user_id = public.profiles.id
  ));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.es_superadmin())
  with check (id = auth.uid() or public.es_superadmin());

-- --- businesses ---------------------------------------------------------------
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses for select to authenticated
  using (deleted_at is null and public.es_miembro(id));

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses for update to authenticated
  using (public.puede_administrar(id))
  with check (public.puede_administrar(id));

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses for insert to authenticated
  with check (public.es_superadmin());

drop policy if exists businesses_delete on public.businesses;
create policy businesses_delete on public.businesses for delete to authenticated
  using (public.es_superadmin());

-- --- business_members ---------------------------------------------------------
drop policy if exists members_select on public.business_members;
create policy members_select on public.business_members for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists members_write on public.business_members;
create policy members_write on public.business_members for all to authenticated
  using (public.puede_administrar(business_id))
  with check (public.puede_administrar(business_id));

-- --- Plantillas, suscripciones y demo (gobierna el SaaS) ----------------------
drop policy if exists templates_select on public.business_templates;
create policy templates_select on public.business_templates for select to authenticated using (true);

drop policy if exists templates_write on public.business_templates;
create policy templates_write on public.business_templates for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists trial_settings_select on public.trial_settings;
create policy trial_settings_select on public.trial_settings for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists trial_settings_write on public.trial_settings;
create policy trial_settings_write on public.trial_settings for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists admin_notes_all on public.business_admin_notes;
create policy admin_notes_all on public.business_admin_notes for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

-- --- business_settings --------------------------------------------------------
drop policy if exists settings_select on public.business_settings;
create policy settings_select on public.business_settings for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists settings_write on public.business_settings;
create policy settings_write on public.business_settings for all to authenticated
  using (public.puede_administrar(business_id))
  with check (public.puede_administrar(business_id));

-- --- Contenido editable por el equipo ----------------------------------------
--  Mismo patrón repetido para cada tabla de contenido: ver = miembro,
--  crear/editar = puede_escribir, borrar = puede_administrar.
do $$
declare
  t text;
begin
  foreach t in array array[
    'service_categories', 'services', 'properties', 'property_media',
    'property_features', 'qr_codes', 'faqs', 'ai_knowledge_entries',
    'legal_text_versions', 'campaigns', 'campaign_audiences'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.es_miembro(business_id))', t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (public.puede_escribir(business_id))', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (public.puede_escribir(business_id)) with check (public.puede_escribir(business_id))', t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (public.puede_administrar(business_id))', t, t);
  end loop;
end $$;

-- --- Datos de personas: leads, visitas, valoraciones, opiniones ---------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'lead_notes', 'lead_assignments', 'property_inquiries',
    'visit_requests', 'valuation_requests', 'buyer_requests', 'feedback'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.es_miembro(business_id))', t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (public.puede_escribir(business_id))', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (public.puede_escribir(business_id)) with check (public.puede_escribir(business_id))', t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (public.puede_administrar(business_id))', t, t);
  end loop;
end $$;

-- --- Solo lectura para el equipo: analítica y consentimientos ------------------
--  Se escriben únicamente desde el servidor con service_role. Un miembro del
--  negocio no puede fabricar métricas ni consentimientos a mano.
drop policy if exists analytics_select on public.analytics_events;
create policy analytics_select on public.analytics_events for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists qr_scan_select on public.qr_scan_events;
create policy qr_scan_select on public.qr_scan_events for select to authenticated
  using (public.es_miembro(business_id));

drop policy if exists ai_logs_select on public.ai_chat_logs;
create policy ai_logs_select on public.ai_chat_logs for select to authenticated
  using (public.es_miembro(business_id));

-- Los consentimientos son prueba legal: los ve quien administra, no cualquiera.
drop policy if exists consent_select on public.consent_records;
create policy consent_select on public.consent_records for select to authenticated
  using (public.puede_administrar(business_id));
