-- ============================================================================
--  PULSO LOCAL AI — 0005 · QR, analítica y campañas
-- ----------------------------------------------------------------------------
--  La analítica es anónima por diseño: `session_id` es un identificador aleatorio
--  que vive en el navegador y se rota, y `metadata` tiene prohibido llevar datos
--  personales. Con eso basta para medir conversión por QR sin fichar a nadie.
-- ============================================================================

create table if not exists public.qr_codes (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  code          citext not null unique,
  label         text not null,
  location_note text,
  target_type   public.qr_target_type not null default 'landing',
  target_url    text,
  whatsapp_message text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  fg_color      text not null default '#0E2A3F',
  bg_color      text not null default '#FFFFFF',
  logo_url      text,
  scan_count    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint qr_codes_code_formato check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on column public.qr_codes.code is
  'Parte final de la URL corta /q/<code>. El servidor la resuelve, registra el escaneo y redirige: así un cartel impreso puede cambiar de destino sin reimprimirlo.';

create index if not exists idx_qr_codes_business on public.qr_codes (business_id) where deleted_at is null;
create index if not exists idx_qr_codes_property on public.qr_codes (property_id) where property_id is not null;

create trigger trg_qr_codes_updated before update on public.qr_codes
  for each row execute function public.set_updated_at();

create table if not exists public.qr_scan_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  qr_id       uuid not null references public.qr_codes(id) on delete cascade,
  session_id  text,
  device_kind text,
  referrer_host text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_qr_scan_events_qr on public.qr_scan_events (qr_id, created_at desc);
create index if not exists idx_qr_scan_events_business on public.qr_scan_events (business_id, created_at desc);

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  qr_id       uuid references public.qr_codes(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  session_id  text,
  event_type  public.analytics_event_type not null,
  path        text,
  device_kind text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  is_demo_data boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on column public.analytics_events.metadata is
  'Minimizada y sin datos personales: nunca nombre, teléfono, email ni texto libre escrito por el usuario.';

create index if not exists idx_analytics_business_fecha on public.analytics_events (business_id, created_at desc);
create index if not exists idx_analytics_business_tipo on public.analytics_events (business_id, event_type, created_at desc);
create index if not exists idx_analytics_property on public.analytics_events (property_id, created_at desc) where property_id is not null;
create index if not exists idx_analytics_qr on public.analytics_events (qr_id, created_at desc) where qr_id is not null;

-- --- Campañas (solo borradores en el MVP) -------------------------------------
create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  channel      text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'sms')),
  status       public.campaign_status not null default 'borrador',
  subject      text,
  body_draft   text,
  scheduled_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.campaigns is
  'El MVP solo guarda borradores. No envía nada: cualquier envío futuro exigirá consentimiento del destinatario y confirmación explícita del administrador.';

create index if not exists idx_campaigns_business on public.campaigns (business_id, created_at desc);

create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.campaign_audiences (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  lead_types  public.lead_type[] not null default '{}',
  zones       text[] not null default '{}',
  statuses    public.lead_status[] not null default '{}',
  only_consented boolean not null default true,
  estimated_size integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_campaign_audiences_campaign on public.campaign_audiences (campaign_id);
