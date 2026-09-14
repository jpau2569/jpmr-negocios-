// ============================================================================
//  Tipos del dominio
// ----------------------------------------------------------------------------
//  Se escriben a mano en vez de generarlos con `supabase gen types` porque el
//  proyecto todavía no existe. Cuando exista, se genera types/database.ts y
//  estos tipos se derivan de aquél. Las formas coinciden con sql/01_esquema.sql.
// ============================================================================

export type Rol = "owner" | "admin" | "staff" | "viewer";
export type EstadoNegocio = "trial" | "active" | "suspended" | "expired";
export type EstadoContenido = "draft" | "published" | "sold_out";
export type EstadoReserva = "pending" | "confirmed" | "cancelled" | "completed";

export type Ocasion = "lunch" | "dinner" | "birthday" | "group" | "event" | "other";

/** Los 14 de declaración obligatoria (Reglamento UE 1169/2011). */
export type Alergeno =
  | "gluten" | "crustaceos" | "huevos" | "pescado" | "cacahuetes" | "soja"
  | "lacteos" | "frutos_de_cascara" | "apio" | "mostaza" | "sesamo"
  | "sulfitos" | "altramuces" | "moluscos";

export const ALERGENOS_ES: Record<Alergeno, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Lácteos",
  frutos_de_cascara: "Frutos de cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export type EtiquetaPlato =
  | "recomendado" | "mas_pedido" | "nuevo" | "para_compartir" | "vegetariano"
  | "vegano" | "sin_gluten" | "picante" | "oferta" | "especial_de_hoy";

export const ETIQUETAS_ES: Record<EtiquetaPlato, string> = {
  recomendado: "Recomendado",
  mas_pedido: "Más pedido",
  nuevo: "Nuevo",
  para_compartir: "Para compartir",
  vegetariano: "Vegetariano",
  vegano: "Vegano",
  sin_gluten: "Sin gluten",
  picante: "Picante",
  oferta: "Oferta",
  especial_de_hoy: "Especial de hoy",
};

export type TipoEventoAnalitica =
  | "qr_landing_view" | "menu_view" | "daily_menu_view" | "special_menu_view"
  | "category_view" | "dish_view" | "whatsapp_click" | "call_click"
  | "directions_click" | "reservation_start" | "reservation_submit"
  | "group_request_start" | "group_request_submit" | "feedback_start"
  | "feedback_submit" | "google_review_click" | "promotion_view" | "lead_submit"
  | "ai_chat_open" | "ai_question_submit" | "qr_download" | "qr_print_preview";

export type DestinoQr =
  | "landing" | "menu" | "daily_menu" | "reservation" | "group" | "review"
  | "event" | "social";

export type UbicacionQr =
  | "table" | "bar" | "ticket" | "window" | "social" | "event" | "other";

/** Un tramo de apertura: [ "13:00", "16:30" ]. */
export type Tramo = [string, string];

/** dow: 0 domingo … 6 sábado. Sin tramos, ese día cierra. */
export interface DiaHorario {
  dow: number;
  ranges: Tramo[];
}

export interface Tema {
  fondo?: string;
  superficie?: string;
  acento?: string;
  acento2?: string;
  texto?: string;
}

export interface Modulos {
  menu?: boolean;
  daily_menu?: boolean;
  special_menus?: boolean;
  reservations?: boolean;
  groups?: boolean;
  events?: boolean;
  promotions?: boolean;
  feedback?: boolean;
  loyalty?: boolean;
  assistant?: boolean;
  qr?: boolean;
}

export interface Negocio {
  id: string;
  slug: string;
  name: string;
  sector: string;
  status: EstadoNegocio;
  trial_ends_at: string | null;
}

export interface AjustesNegocio {
  business_id: string;
  tagline: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  /** URL oficial de Google. null = no se pinta botón de reseña. Jamás se inventa. */
  review_url: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  tripadvisor: string | null;
  opening_hours: DiaHorario[];
  theme: Tema;
  logo_url: string | null;
  cover_url: string | null;
  modules: Modulos;
  /** Lo que el negocio aún no ha confirmado. Se pinta en el pie. */
  pending_notes: string[];
  reactivation_whatsapp: string | null;
}

export interface CategoriaCarta {
  id: string;
  name: string;
  description: string | null;
  position: number;
  is_demo: boolean;
}

export interface Plato {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  /** En céntimos. null = "consultar": mejor eso que un precio inventado. */
  price_cents: number | null;
  price_from: boolean;
  image_url: string | null;
  tags: string[];
  position: number;
  status: EstadoContenido;
  /** true = el negocio todavía no lo ha confirmado. La página lo dice. */
  is_demo: boolean;
  alergenos: Alergeno[];
}

export interface PlatoMenuDia {
  id: string;
  course: string;
  name: string;
  description: string | null;
  position: number;
}

export interface MenuDelDia {
  id: string;
  service_date: string;
  price_cents: number | null;
  includes_drink: boolean;
  notes: string | null;
  status: EstadoContenido;
  is_demo: boolean;
  platos: PlatoMenuDia[];
}

export interface MenuEspecial {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  conditions: string | null;
  starts_on: string | null;
  ends_on: string | null;
  courses: { course: string; name: string }[];
  is_demo: boolean;
}

export interface EventoNegocio {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  starts_at: string | null;
  is_demo: boolean;
}

export interface Promocion {
  id: string;
  name: string;
  description: string | null;
  conditions: string | null;
  is_demo: boolean;
}

/** Todo lo que la página pública necesita, en una sola consulta. */
export interface EspacioNegocio {
  negocio: Negocio;
  ajustes: AjustesNegocio;
  categorias: CategoriaCarta[];
  platos: Plato[];
  menuDeHoy: MenuDelDia | null;
  menusEspeciales: MenuEspecial[];
  eventos: EventoNegocio[];
  promociones: Promocion[];
}
