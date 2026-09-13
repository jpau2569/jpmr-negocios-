-- ============================================================================
--  PULSO LOCAL AI — 0007 · Funciones de autorización y vistas públicas
-- ----------------------------------------------------------------------------
--  Las funciones de pertenencia son SECURITY DEFINER a propósito: si una política
--  de `business_members` consultara `business_members` bajo RLS, Postgres entraría
--  en recursión infinita. Con SECURITY DEFINER la consulta se hace una vez, sin
--  RLS, y siempre con `search_path` fijado para que nadie pueda secuestrarla.
-- ============================================================================

-- --- ¿Quién soy? --------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.es_miembro(negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = negocio and m.user_id = auth.uid() and m.is_active
  ) or public.es_superadmin();
$$;

create or replace function public.rol_en_negocio(negocio uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.es_superadmin() then 'owner'::public.member_role
    else (select m.role from public.business_members m
          where m.business_id = negocio and m.user_id = auth.uid() and m.is_active
          limit 1)
  end;
$$;

-- Escribir contenido: owner, admin y agent. `viewer` solo mira.
create or replace function public.puede_escribir(negocio uuid)
returns boolean
language sql
stable
as $$
  select public.rol_en_negocio(negocio) in ('owner', 'admin', 'agent');
$$;

-- Administrar el negocio (ajustes, miembros, QR, borrados): owner y admin.
create or replace function public.puede_administrar(negocio uuid)
returns boolean
language sql
stable
as $$
  select public.rol_en_negocio(negocio) in ('owner', 'admin');
$$;

-- --- ¿Este negocio puede enseñarse al público? --------------------------------
--  La verdad sobre la caducidad de la demo vive AQUÍ, en el servidor de base de
--  datos. El frontend puede pintar lo que quiera: si esto devuelve false, no hay
--  fila que leer.
create or replace function public.negocio_publicable(negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = negocio
      and b.deleted_at is null
      and (
        b.status = 'active'
        or (b.status = 'trial' and b.trial_ends_at is not null and b.trial_ends_at > now())
      )
  );
$$;

-- Marca como `expired` las demos cuya fecha ya pasó. Se puede llamar desde un
-- cron de Vercel o desde pg_cron; aun sin ejecutarla, `negocio_publicable()` ya
-- deja de publicar el negocio, así que la caducidad nunca depende de este cron.
create or replace function public.caducar_demos()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  afectados integer;
begin
  update public.businesses
     set status = 'expired'
   where status = 'trial'
     and trial_ends_at is not null
     and trial_ends_at <= now()
     and deleted_at is null;
  get diagnostics afectados = row_count;
  return afectados;
end;
$$;

-- --- Contadores ---------------------------------------------------------------
create or replace function public.registrar_escaneo_qr(p_qr_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.qr_codes set scan_count = scan_count + 1 where id = p_qr_id;
$$;

create or replace function public.registrar_visita_inmueble(p_property_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.properties set view_count = view_count + 1 where id = p_property_id;
$$;

-- --- Vistas públicas ----------------------------------------------------------
--  El rol `anon` NO tiene permiso sobre las tablas: solo sobre estas vistas, que
--  eligen columna a columna qué es público. Así `private_address`, las notas
--  internas o los leads no pueden filtrarse ni por error ni por una consulta
--  creativa desde el navegador.
--  Son vistas SECURITY DEFINER (el modo por defecto) con `security_barrier`: se
--  ejecutan con los permisos del propietario y su cláusula WHERE es la frontera
--  de seguridad. Se eligió así en vez de `security_invoker = on` porque este
--  último obligaría a dar SELECT sobre las tablas base al rol `anon`, y entonces
--  la protección de columnas como `private_address` dependería de no equivocarse
--  al revocar privilegios columna a columna. Con vistas definer, `anon` no tiene
--  ningún privilegio sobre las tablas: su única superficie de lectura son estas
--  vistas, que enumeran explícitamente lo que es público.

create or replace view public.v_negocios_publicos
with (security_barrier = true) as
  select b.id, b.name, b.slug, b.business_type, b.status, b.logo_url, b.cover_url,
         b.description, b.tagline, b.founded_note, b.phone, b.whatsapp_phone, b.email,
         b.address, b.city, b.postal_code, b.country, b.latitude, b.longitude,
         b.review_url, b.website_url, b.social_links, b.opening_hours, b.theme,
         b.modules, b.is_demo_data, b.trial_ends_at
    from public.businesses b
   where b.deleted_at is null
     and public.negocio_publicable(b.id);

create or replace view public.v_inmuebles_publicos
with (security_barrier = true) as
  select p.id, p.business_id, p.slug, p.reference_code, p.title, p.operation_type,
         p.property_type, p.status, p.price, p.price_on_request, p.currency,
         p.municipality, p.neighborhood,
         case when p.show_public_address then p.public_address else null end as public_address,
         p.latitude, p.longitude, p.map_radius_m,
         p.bedrooms, p.bathrooms, p.built_area_m2, p.usable_area_m2, p.plot_area_m2,
         p.floor, p.has_elevator, p.has_terrace, p.has_garage, p.has_storage,
         p.energy_rating, p.energy_consumption, p.year_built, p.condition_note,
         p.short_description, p.description, p.conditions_note, p.tags, p.featured,
         p.is_demo_data, p.published_at, p.created_at
    from public.properties p
   where p.deleted_at is null
     and p.published_at is not null
     and p.status in ('disponible', 'reservado', 'vendido', 'alquilado')
     and public.negocio_publicable(p.business_id);

create or replace view public.v_media_publica
with (security_barrier = true) as
  select m.id, m.property_id, m.business_id, m.kind, m.url, m.alt_text, m.position, m.is_cover
    from public.property_media m
    join public.properties p on p.id = m.property_id
   where m.is_public
     and p.deleted_at is null
     and p.published_at is not null
     and public.negocio_publicable(m.business_id);

create or replace view public.v_caracteristicas_publicas
with (security_barrier = true) as
  select f.id, f.property_id, f.business_id, f.label, f.value, f.position
    from public.property_features f
    join public.properties p on p.id = f.property_id
   where p.deleted_at is null and p.published_at is not null
     and public.negocio_publicable(f.business_id);

create or replace view public.v_servicios_publicos
with (security_barrier = true) as
  select s.id, s.business_id, s.category_id, s.slug, s.name, s.short_description,
         s.description, s.benefits, s.image_url, s.icon, s.cta_label, s.cta_type,
         s.cta_url, s.position,
         c.area, c.name as category_name, c.slug as category_slug
    from public.services s
    left join public.service_categories c on c.id = s.category_id
   where s.is_published and s.deleted_at is null
     and public.negocio_publicable(s.business_id);

create or replace view public.v_faqs_publicas
with (security_barrier = true) as
  select f.id, f.business_id, f.question, f.answer, f.area, f.position
    from public.faqs f
   where f.is_published
     and public.negocio_publicable(f.business_id);

create or replace view public.v_ajustes_publicos
with (security_barrier = true) as
  select s.business_id, s.google_review_url, s.review_request_high, s.review_request_low,
         s.hero_title, s.hero_subtitle, s.valuation_mode, s.valuation_manual_note,
         s.ai_assistant_enabled, s.ai_assistant_name, s.privacy_policy_url, s.show_demo_badge
    from public.business_settings s
   where public.negocio_publicable(s.business_id);

create or replace view public.v_textos_legales_vigentes
with (security_barrier = true) as
  select l.id, l.business_id, l.kind, l.version, l.body
    from public.legal_text_versions l
   where l.is_current;
