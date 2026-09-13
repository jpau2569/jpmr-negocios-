-- ============================================================================
--  PULSO LOCAL AI — 0002 · Núcleo multi-tenant
-- ----------------------------------------------------------------------------
--  `businesses` es el tenant. Absolutamente todo lo demás cuelga de él con
--  `business_id not null`: esa columna es la que luego usan las políticas RLS
--  para que una inmobiliaria jamás vea los leads de otra.
-- ============================================================================

-- Marca la hora de la última modificación sin que la aplicación tenga que
-- acordarse de hacerlo (y sin fiarse del reloj del cliente).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Perfiles (extensión de auth.users) -------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  email          citext,
  phone          text,
  avatar_url     text,
  is_superadmin  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.profiles.is_superadmin is
  'Propietario de PULSO LOCAL AI. Solo se activa a mano desde SQL o service role: ningún endpoint de la aplicación lo escribe.';

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cada usuario nuevo de Supabase Auth recibe su fila de perfil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Plantillas de vertical ---------------------------------------------------
--  «Inmobiliaria y Asesoría Local» es una fila de esta tabla. Clonar una demo es
--  copiar su `content` (servicios, FAQs, textos, módulos) sobre un negocio nuevo.
create table if not exists public.business_templates (
  id           uuid primary key default gen_random_uuid(),
  slug         citext not null unique,
  name         text not null,
  vertical     public.business_vertical not null,
  description  text,
  theme        jsonb not null default '{}'::jsonb,
  modules      jsonb not null default '{}'::jsonb,
  content      jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_business_templates_updated before update on public.business_templates
  for each row execute function public.set_updated_at();

-- --- Negocios (tenants) -------------------------------------------------------
create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           citext not null unique,
  business_type  public.business_vertical not null default 'inmobiliaria_asesoria',
  template_id    uuid references public.business_templates(id) on delete set null,
  status         public.business_status not null default 'trial',
  logo_url       text,
  cover_url      text,
  description    text,
  tagline        text,
  founded_note   text,
  phone          text,
  whatsapp_phone text,
  email          citext,
  address        text,
  city           text,
  postal_code    text,
  country        text not null default 'ES',
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  review_url     text,
  website_url    text,
  social_links   jsonb not null default '{}'::jsonb,
  opening_hours  jsonb not null default '{}'::jsonb,
  theme          jsonb not null default '{}'::jsonb,
  modules        jsonb not null default '{}'::jsonb,
  is_demo_data   boolean not null default false,
  trial_ends_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint businesses_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint businesses_trial_con_fecha check (status <> 'trial' or trial_ends_at is not null)
);

comment on column public.businesses.trial_ends_at is
  'Siempre en UTC (timestamptz). La caducidad se comprueba en servidor: ver public.negocio_publicable().';
comment on column public.businesses.is_demo_data is
  'true = el contenido es de demostración y la interfaz debe avisarlo. Nunca se presenta como dato real del negocio.';

create index if not exists idx_businesses_status on public.businesses (status) where deleted_at is null;
create index if not exists idx_businesses_trial_ends on public.businesses (trial_ends_at) where status = 'trial';
create index if not exists idx_businesses_slug on public.businesses (slug) where deleted_at is null;

create trigger trg_businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();

-- --- Miembros del negocio -----------------------------------------------------
create table if not exists public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.member_role not null default 'agent',
  display_name text,
  phone        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists idx_business_members_user on public.business_members (user_id);
create index if not exists idx_business_members_business on public.business_members (business_id);

create trigger trg_business_members_updated before update on public.business_members
  for each row execute function public.set_updated_at();

-- --- Suscripciones y demo -----------------------------------------------------
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  plan              public.subscription_plan not null default 'demo',
  status            public.subscription_status not null default 'trialing',
  price_cents       integer not null default 0,
  currency          text not null default 'EUR',
  started_at        timestamptz not null default now(),
  current_period_end timestamptz,
  canceled_at       timestamptz,
  external_ref      text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_subscriptions_business on public.subscriptions (business_id);

create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Parámetros de la demo: cuántos días dura, qué se enseña al caducar y a qué
-- WhatsApp del SaaS lleva el botón «Reactivar mi espacio».
create table if not exists public.trial_settings (
  business_id        uuid primary key references public.businesses(id) on delete cascade,
  trial_days         integer not null default 7 check (trial_days between 1 and 90),
  reactivation_url   text,
  reactivation_phone text,
  retain_data_days   integer not null default 30 check (retain_data_days between 0 and 365),
  show_public_badge  boolean not null default false,
  notified_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.trial_settings.show_public_badge is
  'Si es false (por defecto), el aviso «quedan X días» solo lo ve el equipo del negocio, nunca el cliente público.';

create trigger trg_trial_settings_updated before update on public.trial_settings
  for each row execute function public.set_updated_at();

-- --- Ajustes del negocio ------------------------------------------------------
create table if not exists public.business_settings (
  business_id            uuid primary key references public.businesses(id) on delete cascade,
  google_review_url      text,
  review_request_high    text,
  review_request_low     text,
  hero_title             text,
  hero_subtitle          text,
  valuation_mode         text not null default 'personalizada'
                         check (valuation_mode in ('personalizada', 'orientativa_manual')),
  valuation_manual_note  text,
  ai_assistant_enabled   boolean not null default true,
  ai_assistant_name      text not null default 'Asistente 24/7',
  lead_notification_email citext,
  privacy_policy_url     text,
  show_demo_badge        boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_business_settings_updated before update on public.business_settings
  for each row execute function public.set_updated_at();

-- --- Notas comerciales del superadministrador --------------------------------
--  Vive aparte de `businesses` a propósito: son notas internas del SaaS y no
--  deben poder leerse nunca desde el panel del cliente ni desde la web pública.
create table if not exists public.business_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  note        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_business_admin_notes_business on public.business_admin_notes (business_id, created_at desc);
