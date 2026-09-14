-- ============================================================================
--  PULSO LOCAL AI — esquema (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
--  Multi-tenant: TODO cuelga de businesses.id. No hay una sola tabla de
--  contenido o de datos personales sin business_id, porque es la columna sobre
--  la que se apoyan todas las políticas de seguridad de 02_rls.sql.
--
--  Orden: 01_esquema.sql → 02_rls.sql → 03_seed.sql
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
--  ENUMS
-- ============================================================================

-- Roles dentro de un negocio. Van de más a menos permiso.
create type app_role as enum ('owner', 'admin', 'staff', 'viewer');

-- Ciclo de vida comercial del negocio. La demo de 7 días vive aquí.
create type business_status as enum ('trial', 'active', 'suspended', 'expired');

-- Estado de una pieza de contenido. 'sold_out' es específico de hostelería:
-- el plato existe y se enseña, pero hoy se acabó.
create type content_status as enum ('draft', 'published', 'sold_out');

create type reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type reservation_occasion as enum ('lunch', 'dinner', 'birthday', 'group', 'event', 'other');

-- Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011.
-- Enum cerrado a propósito: en texto libre acabarían apareciendo alérgenos
-- inventados o mal escritos, y eso es un problema sanitario, no de formato.
create type allergen as enum (
  'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja', 'lacteos',
  'frutos_de_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos', 'altramuces', 'moluscos'
);

create type special_menu_kind as enum (
  'weekend', 'christmas', 'valentines', 'mothers_day', 'fathers_day',
  'gastro', 'group', 'event', 'other'
);

-- Dónde está pegado el QR. Es lo que permite saber si convierte más la mesa,
-- el ticket o el escaparate.
create type qr_location as enum ('table', 'bar', 'ticket', 'window', 'social', 'event', 'other');
create type qr_target as enum ('landing', 'menu', 'daily_menu', 'reservation', 'group', 'review', 'event', 'social');

create type lead_channel as enum ('whatsapp', 'email', 'sms');
create type lead_interest as enum ('daily_menu', 'events', 'special_menus', 'promotions');

create type analytics_event as enum (
  'qr_landing_view', 'menu_view', 'daily_menu_view', 'special_menu_view',
  'category_view', 'dish_view', 'whatsapp_click', 'call_click', 'directions_click',
  'reservation_start', 'reservation_submit', 'group_request_start', 'group_request_submit',
  'feedback_start', 'feedback_submit', 'google_review_click', 'promotion_view',
  'lead_submit', 'ai_chat_open', 'ai_question_submit', 'qr_download', 'qr_print_preview'
);

-- ============================================================================
--  UTILIDADES
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
--  1. IDENTIDAD Y TENENCIA
-- ============================================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext,
  full_name     text,
  phone         text,
  -- Superadmin = Pau. Puede ver y gestionar todos los negocios.
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table businesses (
  id             uuid primary key default gen_random_uuid(),
  -- El slug es la dirección pública: /b/thewhitebar-mieres
  slug           citext not null unique,
  name           text not null,
  legal_name     text,
  sector         text not null default 'hosteleria',
  status         business_status not null default 'trial',
  -- UTC siempre. La comprobación del trial se hace en servidor contra now().
  trial_ends_at  timestamptz,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint slug_valido check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$')
);
create index on businesses (status);

create table business_members (
  business_id uuid not null references businesses(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        app_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  primary key (business_id, profile_id)
);
create index on business_members (profile_id);

-- Plantilla de sector: decide qué módulos nacen encendidos y con qué contenido
-- de muestra. "Taberna urbana" y "parrilla y grupos" son dos plantillas.
create table business_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  -- { "modules": {...}, "theme": {...}, "sections": [...] }
  defaults    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table business_settings (
  business_id     uuid primary key references businesses(id) on delete cascade,
  tagline         text,
  address         text,
  lat             double precision,
  lng             double precision,
  phone           text,
  -- Solo dígitos con prefijo (34...). Vacío = no se pinta el botón.
  whatsapp        text,
  email           citext,
  -- URL oficial de reseñas del negocio. NULL = no hay botón de Google.
  -- Nunca se construye una URL de reseña a mano.
  review_url      text,
  website         text,
  instagram       text,
  facebook        text,
  tiktok          text,
  -- En hostelería TripAdvisor da tanta confianza como Google, y muchos locales
  -- tienen ficha ahí antes que web propia.
  tripadvisor     text,
  -- [{ "dow":1, "ranges":[["11:00","23:00"]] }]. Vacío = no se muestra
  -- abierto/cerrado: preferimos no decir nada a decir una mentira.
  opening_hours   jsonb not null default '[]'::jsonb,
  theme           jsonb not null default '{}'::jsonb,
  logo_url        text,
  cover_url       text,
  modules         jsonb not null default '{}'::jsonb,
  -- Qué falta por confirmar. Se PINTA EN EL PIE de la web pública: mientras
  -- haya algo aquí, el visitante sabe qué no está verificado.
  pending_notes   jsonb not null default '[]'::jsonb,
  -- Teléfono y WhatsApp de Pulso Local AI para el CTA de reactivación.
  reactivation_whatsapp text,
  updated_at      timestamptz not null default now(),
  constraint whatsapp_solo_digitos check (whatsapp is null or whatsapp ~ '^[0-9]{6,15}$'),
  constraint review_url_https check (review_url is null or review_url ~* '^https://')
);

create table subscriptions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  plan           text not null default 'starter',
  status         text not null default 'trialing',
  price_cents    integer not null default 0,
  currency       text not null default 'EUR',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  -- Hueco para Stripe, sin dependerlo todavía.
  external_ref   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on subscriptions (business_id);

create table trial_settings (
  business_id      uuid primary key references businesses(id) on delete cascade,
  trial_days       integer not null default 7,
  -- Qué se apaga al caducar. Editable por si algún cliente negocia.
  hide_content     boolean not null default true,
  keep_data_days   integer not null default 30,
  expired_headline text,
  expired_cta_url  text,
  updated_at       timestamptz not null default now()
);

-- ============================================================================
--  2. CONTENIDO
-- ============================================================================

create table menu_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  description text,
  position    integer not null default 0,
  status      content_status not null default 'published',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on menu_categories (business_id, position);

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  category_id     uuid references menu_categories(id) on delete set null,
  name            text not null,
  description     text,
  -- NULL = no se enseña precio (se consulta). Mejor eso que un precio inventado.
  price_cents     integer,
  price_from      boolean not null default false,
  image_url       text,
  -- recomendado, mas_pedido, nuevo, para_compartir, vegetariano, vegano,
  -- sin_gluten, picante, oferta, especial_de_hoy
  tags            text[] not null default '{}',
  position        integer not null default 0,
  status          content_status not null default 'published',
  available_from  date,
  available_to    date,
  -- true mientras el negocio no haya confirmado nombre, precio y alérgenos.
  -- La página pública LO DICE. No se publica como real lo que no se ha
  -- confirmado.
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint precio_no_negativo check (price_cents is null or price_cents >= 0)
);
create index on menu_items (business_id, category_id, position);
create index on menu_items (business_id, status);

create table menu_item_allergens (
  item_id  uuid not null references menu_items(id) on delete cascade,
  allergen allergen not null,
  -- 'contiene' o 'trazas'
  kind     text not null default 'contiene',
  primary key (item_id, allergen)
);

create table menu_item_extras (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references menu_items(id) on delete cascade,
  name        text not null,
  price_cents integer,
  position    integer not null default 0
);

create table daily_menus (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  -- La fecha de servicio: permite programar los menús de toda la semana.
  service_date   date not null,
  price_cents    integer,
  includes_drink boolean not null default false,
  notes          text,
  status         content_status not null default 'draft',
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, service_date)
);
create index on daily_menus (business_id, service_date desc);

create table daily_menu_items (
  id           uuid primary key default gen_random_uuid(),
  daily_menu_id uuid not null references daily_menus(id) on delete cascade,
  -- 'primero' | 'segundo' | 'postre' | 'bebida'
  course       text not null,
  name         text not null,
  description  text,
  position     integer not null default 0,
  -- Si el plato ya está en la carta, se enlaza y hereda alérgenos.
  menu_item_id uuid references menu_items(id) on delete set null
);
create index on daily_menu_items (daily_menu_id, course, position);

create table special_menus (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind        special_menu_kind not null default 'other',
  name        text not null,
  description text,
  image_url   text,
  price_cents integer,
  conditions  text,
  starts_on   date,
  ends_on     date,
  -- [{ "course":"primero", "name":"..." }]
  courses     jsonb not null default '[]'::jsonb,
  status      content_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on special_menus (business_id, status, starts_on);

create table events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  description text,
  image_url   text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      content_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on events (business_id, starts_at);

create table promotions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  description text,
  conditions  text,
  starts_on   date,
  ends_on     date,
  status      content_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on promotions (business_id, status);

create table faqs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  question    text not null,
  answer      text not null,
  position    integer not null default 0,
  status      content_status not null default 'published',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on faqs (business_id, position);

-- Lo único que el asistente puede usar para responder. Si no está aquí ni en
-- la carta publicada, el asistente NO lo sabe y remite al local.
create table ai_knowledge_entries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  topic       text not null,
  content     text not null,
  -- Nadie publica una respuesta del asistente sin que el negocio la apruebe.
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on ai_knowledge_entries (business_id, approved);

-- ============================================================================
--  3. CONVERSIÓN (datos personales — nunca legibles por el público)
-- ============================================================================

create table legal_text_versions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  -- 'privacy' | 'marketing_consent' | 'terms'
  kind        text not null,
  version     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  unique (business_id, kind, version)
);

create table reservations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  phone        text not null,
  email        citext,
  service_date date not null,
  service_time time not null,
  party_size   integer not null,
  occasion     reservation_occasion not null default 'other',
  comments     text,
  -- Aviso voluntario para preparar el servicio, NO historial médico.
  allergies_note text,
  -- Nace siempre en pending: la web no confirma mesas que no puede confirmar.
  status       reservation_status not null default 'pending',
  staff_notes  text,
  consent_version text,
  qr_code_id   uuid,
  utm          jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint comensales_razonables check (party_size between 1 and 200)
);
create index on reservations (business_id, service_date, status);

create table group_requests (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  phone        text not null,
  email        citext,
  service_date date,
  party_size   integer,
  celebration  text,
  budget_hint  text,
  needs_menu   boolean not null default false,
  comments     text,
  status       reservation_status not null default 'pending',
  consent_version text,
  qr_code_id   uuid,
  utm          jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on group_requests (business_id, status, created_at desc);

create table leads (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text,
  phone        text,
  email        citext,
  channel      lead_channel not null default 'whatsapp',
  interests    lead_interest[] not null default '{}',
  -- Sin consentimiento no hay lead: la fila no se crea.
  consent_version text not null,
  qr_code_id   uuid,
  utm          jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint algun_contacto check (phone is not null or email is not null)
);
create index on leads (business_id, created_at desc);

create table feedback (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  rating      smallint not null,
  comment     text,
  -- Solo si la persona lo pide expresamente.
  contact_name  text,
  contact_phone text,
  wants_contact boolean not null default false,
  -- Se registra si pulsó el botón de Google, para medir. NUNCA para decidir
  -- si se le enseña: el botón se enseña con cualquier puntuación.
  clicked_review boolean not null default false,
  qr_code_id  uuid,
  created_at  timestamptz not null default now(),
  constraint rating_1_5 check (rating between 1 and 5)
);
create index on feedback (business_id, created_at desc);

create table consent_records (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  -- A qué fila se refiere el consentimiento.
  subject_kind text not null,
  subject_id   uuid,
  legal_text_id uuid references legal_text_versions(id) on delete set null,
  -- Copia literal del texto aceptado: si mañana cambia, esta prueba no cambia.
  text_snapshot text not null,
  accepted_at  timestamptz not null default now(),
  ip_hash      text,
  user_agent   text
);
create index on consent_records (business_id, accepted_at desc);

-- ============================================================================
--  4. MEDICIÓN
-- ============================================================================

create table qr_codes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  -- Token corto que viaja en la URL: /b/<slug>?qr=<token>
  token       text not null unique,
  label       text not null,
  target      qr_target not null default 'landing',
  location    qr_location not null default 'other',
  -- Número de mesa, nombre del cartel...
  location_ref text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint token_valido check (token ~ '^[a-zA-Z0-9_-]{4,32}$')
);
create index on qr_codes (business_id, active);

create table analytics_events (
  id          bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  event_type  analytics_event not null,
  qr_code_id  uuid references qr_codes(id) on delete set null,
  -- Id de la pieza mirada (plato, categoría, menú especial...).
  subject_id  uuid,
  -- Sin datos personales: ni IP en claro, ni identificador de persona.
  -- Solo una huella de sesión efímera para no contar 40 veces al mismo móvil.
  session_hash text,
  path        text,
  referrer    text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on analytics_events (business_id, created_at desc);
create index on analytics_events (business_id, event_type, created_at desc);
create index on analytics_events (qr_code_id) where qr_code_id is not null;

-- Las claves de origen se añaden al final porque qr_codes se crea después.
alter table reservations   add constraint reservations_qr_fk   foreign key (qr_code_id) references qr_codes(id) on delete set null;
alter table group_requests add constraint group_requests_qr_fk foreign key (qr_code_id) references qr_codes(id) on delete set null;
alter table leads          add constraint leads_qr_fk          foreign key (qr_code_id) references qr_codes(id) on delete set null;
alter table feedback       add constraint feedback_qr_fk       foreign key (qr_code_id) references qr_codes(id) on delete set null;

-- ============================================================================
--  TRIGGERS de updated_at
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','businesses','business_settings','subscriptions','trial_settings',
    'menu_categories','menu_items','daily_menus','special_menus','events',
    'promotions','ai_knowledge_entries','reservations','group_requests'
  ] loop
    execute format(
      'create trigger %I_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================================
--  ALTA DE USUARIO: cada usuario de auth tiene su fila en profiles
-- ============================================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
