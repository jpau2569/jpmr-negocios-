-- ============================================================================
--  PULSO LOCAL AI — 0006 · FAQs y base de conocimiento del asistente
-- ----------------------------------------------------------------------------
--  El asistente solo puede responder con lo que el negocio ha aprobado. Esta
--  tabla ES el límite del asistente: si algo no está aquí, no lo dice.
-- ============================================================================

create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  question     text not null,
  answer       text not null,
  area         public.service_area not null default 'otros',
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_faqs_business on public.faqs (business_id, position);

create trigger trg_faqs_updated before update on public.faqs
  for each row execute function public.set_updated_at();

create table if not exists public.ai_knowledge_entries (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  title        text not null,
  body         text not null,
  keywords     text[] not null default '{}',
  is_approved  boolean not null default false,
  approved_by  uuid references public.profiles(id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.ai_knowledge_entries.is_approved is
  'Solo las entradas aprobadas entran en el contexto del asistente. Sin aprobación, el asistente deriva a una persona.';

create index if not exists idx_ai_knowledge_business on public.ai_knowledge_entries (business_id) where is_approved;

-- Registro mínimo de preguntas para mejorar las FAQs. Sin datos de contacto:
-- solo la pregunta, si se resolvió con la base aprobada y la sesión anónima.
create table if not exists public.ai_chat_logs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  session_id   text,
  question     text not null,
  matched_entry_id uuid references public.ai_knowledge_entries(id) on delete set null,
  matched_faq_id uuid references public.faqs(id) on delete set null,
  was_deferred boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ai_chat_logs_business on public.ai_chat_logs (business_id, created_at desc);

create trigger trg_ai_knowledge_updated before update on public.ai_knowledge_entries
  for each row execute function public.set_updated_at();
