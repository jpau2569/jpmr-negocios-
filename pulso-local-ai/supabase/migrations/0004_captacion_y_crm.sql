-- ============================================================================
--  PULSO LOCAL AI — 0004 · Captación, CRM ligero, visitas y reputación
-- ----------------------------------------------------------------------------
--  Todo lo que escribe una persona anónima desde el móvil acaba aquí. Por eso
--  cada tabla guarda el consentimiento con su versión de texto legal y su fecha:
--  un lead sin consentimiento verificable no vale nada y además es un problema.
-- ============================================================================

-- --- Leads (el CRM ligero) ----------------------------------------------------
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  property_id           uuid references public.properties(id) on delete set null,
  service_id            uuid references public.services(id) on delete set null,
  lead_type             public.lead_type not null default 'general_consultation',
  source                public.lead_source not null default 'qr',
  qr_id                 uuid,
  name                  text not null,
  phone                 text,
  email                 citext,
  message               text,
  preferred_contact_time text,
  interest_level        smallint check (interest_level between 1 and 5),
  status                public.lead_status not null default 'nuevo',
  assigned_to           uuid references public.business_members(id) on delete set null,
  next_action           text,
  next_action_at        timestamptz,
  tags                  text[] not null default '{}',
  consented_at          timestamptz not null default now(),
  legal_text_version    text not null default 'v1',
  is_demo_data          boolean not null default false,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint leads_contacto_minimo check (phone is not null or email is not null)
);

comment on column public.leads.metadata is
  'Datos de contexto minimizados: utm, tipo de dispositivo, respuestas del formulario. Nunca IP en claro ni datos sensibles.';

create index if not exists idx_leads_business_created on public.leads (business_id, created_at desc);
create index if not exists idx_leads_business_status on public.leads (business_id, status);
create index if not exists idx_leads_property on public.leads (property_id) where property_id is not null;
create index if not exists idx_leads_tipo on public.leads (business_id, lead_type);
create index if not exists idx_leads_asignado on public.leads (assigned_to) where assigned_to is not null;

create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

create table if not exists public.lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  note        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_lead_notes_lead on public.lead_notes (lead_id, created_at desc);

create table if not exists public.lead_assignments (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id   uuid references public.business_members(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  from_status public.lead_status,
  to_status   public.lead_status,
  created_at  timestamptz not null default now()
);

create index if not exists idx_lead_assignments_lead on public.lead_assignments (lead_id, created_at desc);

-- --- Interés por un inmueble concreto ----------------------------------------
create table if not exists public.property_inquiries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete set null,
  message     text,
  wants_similar boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_property_inquiries_property on public.property_inquiries (property_id, created_at desc);
create index if not exists idx_property_inquiries_business on public.property_inquiries (business_id, created_at desc);

-- --- Solicitudes de visita ----------------------------------------------------
create table if not exists public.visit_requests (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  property_id    uuid references public.properties(id) on delete set null,
  lead_id        uuid references public.leads(id) on delete set null,
  mode           public.visit_mode not null default 'presencial',
  preferred_date date,
  preferred_slot text,
  status         public.visit_status not null default 'pendiente',
  assigned_to    uuid references public.business_members(id) on delete set null,
  internal_note  text,
  calendar_event_id text,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.visit_requests.calendar_event_id is
  'Reservado para la integración futura con Google Calendar. El MVP NUNCA crea eventos externos sin autorización explícita del administrador.';

create index if not exists idx_visit_requests_business on public.visit_requests (business_id, status, preferred_date);
create index if not exists idx_visit_requests_property on public.visit_requests (property_id);

create trigger trg_visit_requests_updated before update on public.visit_requests
  for each row execute function public.set_updated_at();

-- --- Solicitudes de valoración ------------------------------------------------
create table if not exists public.valuation_requests (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  property_type   public.property_type not null default 'piso',
  goal            text not null default 'venta'
                  check (goal in ('venta', 'alquiler', 'herencia', 'orientacion', 'otra')),
  municipality    text,
  neighborhood    text,
  built_area_m2   integer check (built_area_m2 >= 0),
  bedrooms        smallint,
  bathrooms       smallint,
  condition_level text check (condition_level in ('a_reformar', 'buen_estado', 'reformado', 'obra_nueva', 'no_lo_se')),
  has_elevator    boolean,
  has_terrace     boolean,
  has_garage      boolean,
  needs_reform    boolean,
  notes           text,
  status          public.lead_status not null default 'nuevo',
  answer_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.valuation_requests.answer_note is
  'Respuesta orientativa que escribe a mano un profesional. El MVP no calcula valoraciones automáticas.';

create index if not exists idx_valuation_requests_business on public.valuation_requests (business_id, created_at desc);

create trigger trg_valuation_requests_updated before update on public.valuation_requests
  for each row execute function public.set_updated_at();

-- --- Demanda de compradores e inquilinos --------------------------------------
create table if not exists public.buyer_requests (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  lead_id        uuid references public.leads(id) on delete set null,
  operation_type public.property_operation not null default 'venta',
  property_types public.property_type[] not null default '{}',
  zones          text[] not null default '{}',
  budget_max     numeric(12,2),
  budget_min     numeric(12,2),
  min_bedrooms   smallint,
  must_have      text[] not null default '{}',
  timeframe      text,
  notes          text,
  status         public.lead_status not null default 'nuevo',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_buyer_requests_business on public.buyer_requests (business_id, created_at desc);

create trigger trg_buyer_requests_updated before update on public.buyer_requests
  for each row execute function public.set_updated_at();

-- --- Opinión privada y reputación ---------------------------------------------
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  property_id    uuid references public.properties(id) on delete set null,
  rating         smallint not null check (rating between 1 and 5),
  comment        text,
  wants_contact  boolean not null default false,
  contact_name   text,
  contact_phone  text,
  contact_email  citext,
  status         public.feedback_status not null default 'nuevo',
  internal_note  text,
  resolved_at    timestamptz,
  resolved_by    uuid references public.profiles(id) on delete set null,
  clicked_review boolean not null default false,
  consented_at   timestamptz,
  legal_text_version text,
  is_demo_data   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.feedback is
  'Opinión privada. El enlace a Google Reviews se ofrece SIEMPRE, con cualquier puntuación, y nunca se condiciona ni se premia.';

create index if not exists idx_feedback_business on public.feedback (business_id, created_at desc);
create index if not exists idx_feedback_rating on public.feedback (business_id, rating);

create trigger trg_feedback_updated before update on public.feedback
  for each row execute function public.set_updated_at();

-- --- Consentimientos y textos legales versionados -----------------------------
create table if not exists public.legal_text_versions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  kind        text not null check (kind in ('consentimiento_lead', 'privacidad', 'aviso_legal', 'cookies')),
  version     text not null,
  body        text not null,
  is_current  boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (business_id, kind, version)
);

comment on table public.legal_text_versions is
  'Los textos son PLANTILLAS TÉCNICAS. Deben ser revisados por un profesional legal antes de publicarse.';

create index if not exists idx_legal_text_vigente on public.legal_text_versions (business_id, kind) where is_current;

create table if not exists public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  lead_id        uuid references public.leads(id) on delete cascade,
  feedback_id    uuid references public.feedback(id) on delete cascade,
  kind           text not null default 'consentimiento_lead',
  legal_text_version text not null,
  legal_text_id  uuid references public.legal_text_versions(id) on delete set null,
  source_url     text,
  ip_hash        text,
  user_agent_hash text,
  consented_at   timestamptz not null default now()
);

comment on column public.consent_records.ip_hash is
  'Hash con sal del servidor (SHA-256), no la IP. Sirve para demostrar el consentimiento y limitar abuso sin guardar el dato personal en claro.';

create index if not exists idx_consent_records_business on public.consent_records (business_id, consented_at desc);
create index if not exists idx_consent_records_lead on public.consent_records (lead_id);
