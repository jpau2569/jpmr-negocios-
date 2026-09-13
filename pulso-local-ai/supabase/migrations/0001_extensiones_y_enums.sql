-- ============================================================================
--  PULSO LOCAL AI — 0001 · Extensiones y tipos enumerados
-- ----------------------------------------------------------------------------
--  Todo el vocabulario del dominio vive en enums de Postgres, no en cadenas
--  sueltas: si mañana alguien escribe 'vendida' en vez de 'vendido', la base de
--  datos lo rechaza en vez de romper un filtro del panel seis meses después.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- emails y slugs sin sorpresas de mayúsculas

-- --- Ciclo de vida comercial del negocio ------------------------------------
do $$ begin
  create type public.business_status as enum ('trial', 'active', 'suspended', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner', 'admin', 'agent', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_plan as enum ('demo', 'basico', 'pro', 'multi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

-- --- Vertical de negocio (la plantilla que se clona) ------------------------
do $$ begin
  create type public.business_vertical as enum (
    'inmobiliaria_asesoria', 'restauracion', 'belleza', 'taller', 'salud', 'comercio', 'servicios'
  );
exception when duplicate_object then null; end $$;

-- --- Inmuebles ---------------------------------------------------------------
do $$ begin
  create type public.property_operation as enum ('venta', 'alquiler', 'alquiler_opcion_compra', 'traspaso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_type as enum (
    'piso', 'casa', 'chalet', 'atico', 'duplex', 'estudio',
    'local', 'oficina', 'nave', 'garaje', 'trastero', 'parcela', 'edificio'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_status as enum (
    'borrador', 'disponible', 'reservado', 'vendido', 'alquilado', 'archivado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.energy_rating as enum ('A','B','C','D','E','F','G','en_tramite','exento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_media_kind as enum ('foto', 'video', 'tour_virtual', 'plano', 'documento');
exception when duplicate_object then null; end $$;

-- --- Captación y CRM ---------------------------------------------------------
do $$ begin
  create type public.lead_type as enum (
    'buyer', 'tenant', 'investor', 'seller', 'landlord', 'valuation_request',
    'general_consultation', 'community_administration', 'tax_labor_legal_consultation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum (
    'qr', 'web', 'inmueble', 'escaparate', 'cartel', 'tarjeta', 'visita', 'campana', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'nuevo', 'contactado', 'cualificado', 'visita_agendada', 'cerrado', 'descartado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visit_status as enum ('pendiente', 'confirmado', 'realizado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visit_mode as enum ('presencial', 'videollamada', 'llamada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feedback_status as enum ('nuevo', 'en_revision', 'resuelto');
exception when duplicate_object then null; end $$;

-- --- Servicios profesionales -------------------------------------------------
do $$ begin
  create type public.service_area as enum (
    'inmobiliaria', 'administracion_fincas', 'fiscal', 'laboral', 'juridico', 'otros'
  );
exception when duplicate_object then null; end $$;

-- --- QR y campañas -----------------------------------------------------------
do $$ begin
  create type public.qr_target_type as enum (
    'landing', 'inmueble', 'valoracion', 'buscar_vivienda', 'servicios',
    'administracion_fincas', 'opinion', 'whatsapp', 'url_personalizada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('borrador', 'programada', 'pausada', 'archivada');
exception when duplicate_object then null; end $$;

-- --- Analítica ---------------------------------------------------------------
--  Lista cerrada: un evento que no esté aquí se rechaza. Así la analítica no se
--  llena de tipos inventados por un `fetch` mal escrito.
do $$ begin
  create type public.analytics_event_type as enum (
    'qr_landing_view', 'public_landing_view', 'service_view', 'property_list_view',
    'property_view', 'property_gallery_view', 'property_tour_click',
    'whatsapp_click', 'call_click', 'directions_click',
    'valuation_start', 'valuation_submit',
    'buyer_request_start', 'buyer_request_submit',
    'visit_request_start', 'visit_request_submit',
    'feedback_start', 'feedback_submit',
    'google_review_click', 'review_intent', 'lead_submit',
    'ai_chat_open', 'ai_question_submit',
    'qr_download', 'qr_print_preview'
  );
exception when duplicate_object then null; end $$;
