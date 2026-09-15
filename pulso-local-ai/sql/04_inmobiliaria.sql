-- ============================================================================
--  PULSO LOCAL AI — sector inmobiliaria
-- ----------------------------------------------------------------------------
--  Aditivo: se ejecuta DESPUÉS de 01_esquema.sql y 02_rls.sql y no toca una
--  sola línea de lo que ya funciona en hostelería. Las 18 tablas genéricas
--  (negocios, permisos, ajustes, prueba de 7 días, leads, feedback,
--  consentimientos, QR, analítica, textos legales) se reutilizan tal cual;
--  las 8 de carta y reservas de mesa simplemente no se encienden.
--
--  Orden: 01_esquema.sql → 02_rls.sql → 03_seed.sql → 04_inmobiliaria.sql
--
--  Tres decisiones que conviene entender antes de leer el SQL:
--
--  1. VISIBILIDAD, no solo publicado/borrador. El boca a boca es la mitad del
--     negocio de una agencia y esos inmuebles muchas veces no pueden salir en
--     el listado ni en Google, porque el propietario no quiere que se sepa que
--     vende. De ahí 'enlace_privado': existe, tiene ficha y QR, pero no aparece
--     en ningún listado. RLS NO se lo enseña nunca al público; se resuelve por
--     token en un Route Handler. Así el aislamiento no depende de que una
--     consulta esté bien escrita.
--
--  2. CERTIFICADO ENERGÉTICO. El RD 390/2021 obliga a mostrar la etiqueta en
--     cualquier anuncio de venta o alquiler. Por eso no es un campo suelto que
--     se pueda dejar a null y olvidar: es rating + estado, y "pendiente" es un
--     estado explícito que la ficha canta y el panel marca en rojo. Preferimos
--     que se vea que falta a que parezca que no hace falta.
--
--  3. PUBLICACIÓN Y ESTADO COMERCIAL SON COSAS DISTINTAS. status dice si la
--     ficha se ve; deal_state dice si el piso está libre, reservado o vendido.
--     Un vendido se sigue enseñando tachado a propósito: es prueba social y
--     alimenta el QR de captación ("este lo vendimos, ¿cuánto vale el tuyo?").
-- ============================================================================

-- ============================================================================
--  ENUMS
-- ============================================================================

create type property_operation as enum ('venta', 'alquiler');

create type property_kind as enum (
  'piso', 'casa', 'chalet', 'atico', 'duplex', 'estudio',
  'local', 'oficina', 'nave', 'garaje', 'trastero', 'terreno', 'edificio', 'otro'
);

-- 'enlace_privado' = existe y tiene ficha, pero no sale en listados ni en
-- buscadores. Es lo que necesita una captación de boca a boca.
create type property_visibility as enum ('publico', 'enlace_privado', 'borrador');

-- Estado comercial, independiente de si la ficha está publicada.
create type property_deal_state as enum ('disponible', 'reservado', 'vendido', 'alquilado');

create type energy_rating as enum ('A', 'B', 'C', 'D', 'E', 'F', 'G');

-- 'pendiente' no es un hueco: es una declaración de que todavía no se ha
-- cargado, y la ficha lo dice en voz alta.
create type energy_status as enum ('disponible', 'en_tramite', 'exento', 'pendiente');

-- De dónde salió la ficha. 'manual' es el boca a boca dado de alta a mano.
create type property_source as enum ('web', 'manual', 'portal');

-- --- Valores nuevos para enums que ya existían -------------------------------
-- Se usan solo en tiempo de ejecución (inserciones de la app), nunca en un
-- DEFAULT de este mismo archivo, para no chocar con la regla de PostgreSQL de
-- no usar un valor de enum recién añadido dentro de la misma transacción.

alter type qr_target   add value if not exists 'property';
alter type qr_target   add value if not exists 'valuation';
alter type qr_target   add value if not exists 'listings';

-- 'window' (escaparate) ya existía. Faltaban el cartel del balcón y el de
-- "VENDIDO", que es el que convierte un cartel de presumir en captación.
alter type qr_location add value if not exists 'balcony';
alter type qr_location add value if not exists 'sold_sign';

alter type analytics_event add value if not exists 'property_list_view';
alter type analytics_event add value if not exists 'property_view';
alter type analytics_event add value if not exists 'property_photo_view';
alter type analytics_event add value if not exists 'private_link_view';
alter type analytics_event add value if not exists 'visit_request_start';
alter type analytics_event add value if not exists 'visit_request_submit';
alter type analytics_event add value if not exists 'valuation_start';
alter type analytics_event add value if not exists 'valuation_submit';

-- ============================================================================
--  INMUEBLES
-- ============================================================================

create table properties (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,

  -- Referencia comercial de la agencia (PIS0210). Es lo que el equipo dice por
  -- teléfono, así que manda sobre el id técnico.
  reference     text not null,
  -- Trozo de URL. Se deriva del título, pero se guarda para que un enlace ya
  -- repartido no se rompa si alguien reescribe el título.
  slug          text not null,

  title         text not null,
  description   text,

  operation     property_operation not null,
  kind          property_kind not null default 'piso',

  -- En céntimos. null + price_on_request = "consultar". Nunca un precio
  -- inventado: en inmobiliaria un precio mal puesto es una reclamación.
  price_cents   bigint,
  price_on_request boolean not null default false,

  surface_built_m2  integer,
  surface_useful_m2 integer,
  rooms         integer,
  bathrooms     integer,
  floor_label   text,
  has_lift      boolean,
  condition_note text,
  year_built    integer,

  municipality  text,
  zone          text,
  -- La dirección exacta casi nunca se publica, pero hace falta para la visita.
  street        text,
  street_is_public boolean not null default false,
  lat           double precision,
  lng           double precision,

  -- Obligatorio en anuncios (RD 390/2021). Ver la nota de cabecera.
  energy_rating energy_rating,
  energy_status energy_status not null default 'pendiente',

  status        content_status not null default 'draft',
  visibility    property_visibility not null default 'borrador',
  deal_state    property_deal_state not null default 'disponible',

  -- Token del enlace privado. Solo lo resuelve el servidor, nunca RLS.
  private_token text unique,

  source        property_source not null default 'manual',
  source_url    text,
  -- Última vez que la sincronización confirmó que sigue en la web oficial.
  synced_at     timestamptz,

  featured      boolean not null default false,
  position      integer not null default 0,

  -- true = todavía no lo ha confirmado la agencia. La ficha lo dice.
  is_demo       boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (business_id, reference),
  unique (business_id, slug),

  -- Si se pide consultar precio, no puede haber precio; y al revés.
  constraint precio_coherente check (
    (price_on_request and price_cents is null)
    or (not price_on_request)
  ),
  constraint precio_positivo check (price_cents is null or price_cents > 0),

  -- Decir "etiqueta disponible" obliga a tener la letra.
  constraint energia_coherente check (
    (energy_status = 'disponible' and energy_rating is not null)
    or (energy_status <> 'disponible')
  ),

  -- Un enlace privado sin token no se puede abrir; un token suelto no sirve.
  constraint enlace_privado_con_token check (
    (visibility = 'enlace_privado' and private_token is not null)
    or (visibility <> 'enlace_privado' and private_token is null)
  ),

  constraint superficies_razonables check (
    (surface_built_m2 is null or surface_built_m2 between 1 and 100000)
    and (surface_useful_m2 is null or surface_useful_m2 between 1 and 100000)
  )
);

create index on properties (business_id, visibility, status);
create index on properties (business_id, operation, deal_state);
create index on properties (business_id, municipality);

comment on column properties.private_token is
  'Token del enlace privado. El público NUNCA alcanza estas filas por RLS: '
  'las resuelve un Route Handler con service_role a partir del token.';

create table property_photos (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  url         text not null,
  alt         text,
  position    integer not null default 0,
  is_cover    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on property_photos (property_id, position);

-- ============================================================================
--  PETICIÓN DE VISITA
-- ----------------------------------------------------------------------------
--  El equivalente inmobiliario de la reserva de mesa, pero los campos no se
--  parecen en nada: aquí no hay comensales, hay financiación y franja horaria.
--  Por eso tabla propia en vez de estirar reservations.
--
--  property_id admite null a propósito: alguien puede pedir visita desde el
--  listado sin haber elegido piso, y ese lead vale igual.
-- ============================================================================

create table visit_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  property_id   uuid references properties(id) on delete set null,
  -- Se guarda la referencia por si el inmueble se borra: el lead sobrevive.
  property_ref  text,

  name          text not null,
  phone         text not null,
  email         citext,

  preferred_date date,
  -- 'manana' | 'tarde' | 'indiferente'. Texto y no enum porque cada agencia
  -- parte el día a su manera y no merece una migración.
  preferred_slot text,

  -- Saber esto antes de la visita ahorra visitas que no van a ningún sitio.
  needs_financing boolean,
  comments      text,

  -- Nace en pending: la web no confirma una visita que nadie ha mirado aún.
  status        reservation_status not null default 'pending',
  staff_notes   text,

  consent_version text,
  qr_code_id    uuid,
  utm           jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on visit_requests (business_id, status, created_at desc);
create index on visit_requests (property_id);

-- ============================================================================
--  updated_at
-- ============================================================================

create trigger properties_updated_at before update on properties
  for each row execute function set_updated_at();

create trigger visit_requests_updated_at before update on visit_requests
  for each row execute function set_updated_at();

-- ============================================================================
--  RLS
-- ----------------------------------------------------------------------------
--  Mismo criterio que el resto del proyecto: el público solo ve contenido
--  publicado de un negocio vigente, y no alcanza un solo dato personal.
-- ============================================================================

alter table properties     enable row level security;
alter table property_photos enable row level security;
alter table visit_requests enable row level security;

-- Público: solo los marcados 'publico'. Los de enlace privado se quedan fuera
-- aquí y no hay forma de sacarlos con la clave anon, ni escribiendo mal una
-- consulta ni adivinando el token.
create policy inmuebles_publico on properties
  for select using (
    (business_is_live(business_id)
     and visibility = 'publico'
     and content_is_public(status))
    or can_at_least(business_id, 'viewer'));

create policy inmuebles_equipo on properties
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- Las fotos heredan del inmueble: si la ficha no se ve, sus fotos tampoco.
create policy fotos_inmueble_publico on property_photos
  for select using (exists (select 1 from properties p where p.id = property_id));

create policy fotos_inmueble_equipo on property_photos
  for all using (exists (select 1 from properties p
                          where p.id = property_id and can_at_least(p.business_id, 'staff')))
  with check (exists (select 1 from properties p
                       where p.id = property_id and can_at_least(p.business_id, 'staff')));

-- Datos personales: solo el equipo del negocio. El público no tiene política
-- de lectura NI de inserción — las peticiones entran por Route Handler con
-- service_role, igual que las reservas de mesa.
create policy visitas_equipo on visit_requests
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- ============================================================================
--  PERMISOS
-- ----------------------------------------------------------------------------
--  02_rls.sql revoca todo a anon y va concediendo lo justo. Aquí se sigue el
--  mismo camino: el público lee fichas y fotos, y nada más. visit_requests no
--  aparece en ningún grant a anon, así que el público se queda fuera dos
--  veces: por permiso y por RLS.
-- ============================================================================

grant select on properties, property_photos to anon, authenticated;

grant select, insert, update, delete on
  properties, property_photos, visit_requests
to authenticated;

-- ============================================================================
--  PLANTILLA DEL SECTOR
-- ----------------------------------------------------------------------------
--  Decide qué módulos nacen encendidos al crear una inmobiliaria nueva. Es lo
--  que convierte "otro cliente" en cinco minutos de alta en vez de un
--  proyecto. Los de carta y menú del día nacen apagados.
-- ============================================================================

insert into business_templates (key, name, description, defaults) values (
  'inmobiliaria',
  'Inmobiliaria',
  'Agencia inmobiliaria: cartera con ficha por inmueble, petición de visita, '
  'inmuebles de enlace privado para el boca a boca y un QR por piso para el '
  'escaparate.',
  jsonb_build_object(
    'modules', jsonb_build_object(
      'properties', true,
      'visits', true,
      'private_listings', true,
      'valuation', false,          -- Fase 2
      'feedback', true,
      'promotions', true,
      'qr', true,
      'assistant', false,
      'menu', false,               -- lo de hostelería nace apagado
      'daily_menu', false,
      'special_menus', false,
      'reservations', false,
      'groups', false,
      'loyalty', false
    ),
    'theme', jsonb_build_object(
      'fondo', '#11161d',
      'superficie', '#1a222c',
      'acento', '#c8a24a',
      'acento2', '#6f8fae',
      'texto', '#eef2f6'
    ),
    'sections', jsonb_build_array('cartera', 'visita', 'contacto')
  )
) on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      defaults = excluded.defaults;
