-- ============================================================================
--  PULSO LOCAL AI — 0003 · Servicios profesionales e inmuebles
-- ----------------------------------------------------------------------------
--  Regla de oro de esta migración: la dirección exacta de una vivienda NO es
--  contenido público. `private_address` se queda dentro del panel y la web solo
--  enseña `public_address` (zona aproximada) si el administrador la rellena.
-- ============================================================================

-- --- Categorías y servicios ---------------------------------------------------
create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  area        public.service_area not null default 'otros',
  slug        citext not null,
  name        text not null,
  description text,
  icon        text,
  position    integer not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (business_id, slug)
);

create index if not exists idx_service_categories_business on public.service_categories (business_id, position);

create trigger trg_service_categories_updated before update on public.service_categories
  for each row execute function public.set_updated_at();

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  category_id  uuid references public.service_categories(id) on delete set null,
  slug         citext not null,
  name         text not null,
  short_description text,
  description  text,
  benefits     jsonb not null default '[]'::jsonb,
  image_url    text,
  icon         text,
  cta_label    text,
  cta_type     text not null default 'formulario'
               check (cta_type in ('formulario', 'whatsapp', 'llamada', 'cita', 'url')),
  cta_url      text,
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (business_id, slug)
);

create index if not exists idx_services_business on public.services (business_id, position);
create index if not exists idx_services_publicados on public.services (business_id)
  where is_published and deleted_at is null;

create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- --- Inmuebles ----------------------------------------------------------------
create table if not exists public.properties (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  agent_id         uuid references public.business_members(id) on delete set null,
  slug             citext not null,
  reference_code   text,
  title            text not null,
  operation_type   public.property_operation not null default 'venta',
  property_type    public.property_type not null default 'piso',
  status           public.property_status not null default 'borrador',
  price            numeric(12,2),
  price_on_request boolean not null default false,
  currency         text not null default 'EUR',
  municipality     text,
  neighborhood     text,
  public_address   text,
  private_address  text,
  show_public_address boolean not null default false,
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  map_radius_m     integer not null default 400 check (map_radius_m between 100 and 3000),
  bedrooms         smallint check (bedrooms >= 0),
  bathrooms        smallint check (bathrooms >= 0),
  built_area_m2    integer check (built_area_m2 >= 0),
  usable_area_m2   integer check (usable_area_m2 >= 0),
  plot_area_m2     integer check (plot_area_m2 >= 0),
  floor            text,
  has_elevator     boolean,
  has_terrace      boolean,
  has_garage       boolean,
  has_storage      boolean,
  energy_rating    public.energy_rating,
  energy_consumption text,
  year_built       smallint,
  condition_note   text,
  short_description text,
  description      text,
  conditions_note  text,
  tags             text[] not null default '{}',
  featured         boolean not null default false,
  is_demo_data     boolean not null default false,
  view_count       integer not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (business_id, slug),
  constraint properties_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on column public.properties.private_address is
  'Dirección exacta, uso interno. Nunca se expone en la API pública: la vista v_inmuebles_publicos no la incluye y anon no tiene SELECT sobre la tabla.';
comment on column public.properties.show_public_address is
  'El administrador decide explícitamente si la ficha pública muestra `public_address`. Por defecto, no.';

create index if not exists idx_properties_business_status on public.properties (business_id, status) where deleted_at is null;
create index if not exists idx_properties_publicados on public.properties (business_id, published_at desc)
  where published_at is not null and deleted_at is null;
create index if not exists idx_properties_slug on public.properties (business_id, slug);
create index if not exists idx_properties_operacion on public.properties (business_id, operation_type, property_type);
create index if not exists idx_properties_precio on public.properties (business_id, price);
create index if not exists idx_properties_municipio on public.properties (business_id, municipality);
create index if not exists idx_properties_created on public.properties (created_at desc);

create trigger trg_properties_updated before update on public.properties
  for each row execute function public.set_updated_at();

-- --- Multimedia y características ---------------------------------------------
create table if not exists public.property_media (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  kind         public.property_media_kind not null default 'foto',
  url          text not null,
  storage_path text,
  alt_text     text,
  position     integer not null default 0,
  is_cover     boolean not null default false,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_property_media_property on public.property_media (property_id, position);
create unique index if not exists idx_property_media_portada on public.property_media (property_id)
  where is_cover;

create table if not exists public.property_features (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  label       text not null,
  value       text,
  position    integer not null default 0
);

create index if not exists idx_property_features_property on public.property_features (property_id, position);
