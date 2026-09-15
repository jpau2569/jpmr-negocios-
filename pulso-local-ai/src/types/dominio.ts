/**
 * Tipos del dominio.
 *
 * Están escritos a mano en vez de generados con `supabase gen types` para que el
 * repositorio compile sin necesidad de tener un proyecto de Supabase levantado.
 * Cuando quieras los tipos generados: `npx supabase gen types typescript
 * --project-id <id> > src/types/supabase.ts` y cámbialos aquí.
 */

export type EstadoNegocio = "trial" | "active" | "suspended" | "expired";
export type RolMiembro = "owner" | "admin" | "agent" | "viewer";

export type OperacionInmueble = "venta" | "alquiler" | "alquiler_opcion_compra" | "traspaso";
export type TipoInmueble =
  | "piso" | "casa" | "chalet" | "atico" | "duplex" | "estudio"
  | "local" | "oficina" | "nave" | "garaje" | "trastero" | "parcela" | "edificio";
export type EstadoInmueble = "borrador" | "disponible" | "reservado" | "vendido" | "alquilado" | "archivado";
export type CalificacionEnergetica = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "en_tramite" | "exento";

export type TipoLead =
  | "buyer" | "tenant" | "investor" | "seller" | "landlord" | "valuation_request"
  | "general_consultation" | "community_administration" | "tax_labor_legal_consultation";
export type FuenteLead = "qr" | "web" | "inmueble" | "escaparate" | "cartel" | "tarjeta" | "visita" | "campana" | "otro";
export type EstadoLead = "nuevo" | "contactado" | "cualificado" | "visita_agendada" | "cerrado" | "descartado";
export type EstadoVisita = "pendiente" | "confirmado" | "realizado" | "cancelado";
export type ModoVisita = "presencial" | "videollamada" | "llamada";
export type EstadoOpinion = "nuevo" | "en_revision" | "resuelto";
export type AreaServicio = "inmobiliaria" | "administracion_fincas" | "fiscal" | "laboral" | "juridico" | "otros";
export type DestinoQr =
  | "landing" | "inmueble" | "valoracion" | "buscar_vivienda" | "servicios"
  | "administracion_fincas" | "opinion" | "whatsapp" | "url_personalizada";

export type TipoEvento =
  | "qr_landing_view" | "public_landing_view" | "service_view" | "property_list_view"
  | "property_view" | "property_gallery_view" | "property_tour_click"
  | "whatsapp_click" | "call_click" | "directions_click"
  | "valuation_start" | "valuation_submit"
  | "buyer_request_start" | "buyer_request_submit"
  | "visit_request_start" | "visit_request_submit"
  | "feedback_start" | "feedback_submit"
  | "google_review_click" | "review_intent" | "lead_submit"
  | "ai_chat_open" | "ai_question_submit"
  | "qr_download" | "qr_print_preview";

export interface Tema {
  marca?: string;
  acento?: string;
  fondo?: string;
  texto?: string;
  modo?: "claro" | "oscuro";
}

export interface Modulos {
  inmuebles?: boolean;
  servicios?: boolean;
  valoracion?: boolean;
  buscar_vivienda?: boolean;
  opinion?: boolean;
  asistente_ia?: boolean;
  qr?: boolean;
  campanas?: boolean;
}

export interface NegocioPublico {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  status: EstadoNegocio;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  tagline: string | null;
  founded_note: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  review_url: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  opening_hours: Record<string, string>;
  theme: Tema;
  modules: Modulos;
  is_demo_data: boolean;
  trial_ends_at: string | null;
}

export interface AjustesPublicos {
  business_id: string;
  google_review_url: string | null;
  review_request_high: string | null;
  review_request_low: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  valuation_mode: "personalizada" | "orientativa_manual";
  valuation_manual_note: string | null;
  ai_assistant_enabled: boolean;
  ai_assistant_name: string;
  privacy_policy_url: string | null;
  show_demo_badge: boolean;
}

export interface InmueblePublico {
  id: string;
  business_id: string;
  slug: string;
  reference_code: string | null;
  title: string;
  operation_type: OperacionInmueble;
  property_type: TipoInmueble;
  status: EstadoInmueble;
  price: number | null;
  price_on_request: boolean;
  currency: string;
  municipality: string | null;
  neighborhood: string | null;
  public_address: string | null;
  latitude: number | null;
  longitude: number | null;
  map_radius_m: number;
  bedrooms: number | null;
  bathrooms: number | null;
  built_area_m2: number | null;
  usable_area_m2: number | null;
  plot_area_m2: number | null;
  floor: string | null;
  has_elevator: boolean | null;
  has_terrace: boolean | null;
  has_garage: boolean | null;
  has_storage: boolean | null;
  energy_rating: CalificacionEnergetica | null;
  energy_consumption: string | null;
  year_built: number | null;
  condition_note: string | null;
  short_description: string | null;
  description: string | null;
  conditions_note: string | null;
  tags: string[];
  featured: boolean;
  is_demo_data: boolean;
  published_at: string | null;
  created_at: string;
}

export interface MedioPublico {
  id: string;
  property_id: string;
  business_id: string;
  kind: "foto" | "video" | "tour_virtual" | "plano" | "documento";
  url: string;
  alt_text: string | null;
  position: number;
  is_cover: boolean;
}

export interface CaracteristicaPublica {
  id: string;
  property_id: string;
  label: string;
  value: string | null;
  position: number;
}

export interface ServicioPublico {
  id: string;
  business_id: string;
  category_id: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  benefits: string[];
  image_url: string | null;
  icon: string | null;
  cta_label: string | null;
  cta_type: "formulario" | "whatsapp" | "llamada" | "cita" | "url";
  cta_url: string | null;
  position: number;
  area: AreaServicio | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface FaqPublica {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  area: AreaServicio;
  position: number;
}

export interface Lead {
  id: string;
  business_id: string;
  property_id: string | null;
  lead_type: TipoLead;
  source: FuenteLead;
  qr_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  preferred_contact_time: string | null;
  interest_level: number | null;
  status: EstadoLead;
  assigned_to: string | null;
  next_action: string | null;
  next_action_at: string | null;
  tags: string[];
  consented_at: string;
  legal_text_version: string;
  is_demo_data: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SolicitudVisita {
  id: string;
  business_id: string;
  property_id: string | null;
  lead_id: string | null;
  mode: ModoVisita;
  preferred_date: string | null;
  preferred_slot: string | null;
  status: EstadoVisita;
  internal_note: string | null;
  created_at: string;
}

export interface Opinion {
  id: string;
  business_id: string;
  property_id: string | null;
  rating: number;
  comment: string | null;
  wants_contact: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: EstadoOpinion;
  internal_note: string | null;
  clicked_review: boolean;
  is_demo_data: boolean;
  created_at: string;
}

export interface CodigoQr {
  id: string;
  business_id: string;
  property_id: string | null;
  code: string;
  label: string;
  location_note: string | null;
  target_type: DestinoQr;
  target_url: string | null;
  whatsapp_message: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fg_color: string;
  bg_color: string;
  scan_count: number;
  is_active: boolean;
  created_at: string;
}

export interface ResumenNegocio {
  escaneos_qr: number;
  visitas_unicas: number;
  vistas_landing: number;
  fichas_vistas: number;
  clics_whatsapp: number;
  clics_llamada: number;
  clics_resena: number;
  leads: number;
  leads_nuevos: number;
  visitas_solicitadas: number;
  visitas_pendientes: number;
  valoraciones: number;
  opiniones: number;
  nota_media: number | null;
  opiniones_bajas: number;
  inmuebles_publicados: number;
}

export interface MetricasSaas {
  negocios_total: number;
  en_demo: number;
  activos: number;
  suspendidos: number;
  caducados: number;
  demos_por_caducar: number;
  leads_total: number;
  leads_30d: number;
  inmuebles_publicados: number;
}
