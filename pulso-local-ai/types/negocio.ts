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
  | "ai_chat_open" | "ai_question_submit" | "qr_download" | "qr_print_preview"
  // Inmobiliaria. Los mismos valores que añade sql/04_inmobiliaria.sql al
  // enum analytics_event: si aquí y allí no coinciden, la inserción revienta.
  | "property_list_view" | "property_view" | "property_photo_view"
  | "private_link_view" | "visit_request_start" | "visit_request_submit"
  | "valuation_start" | "valuation_submit";

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
  // Inmobiliaria. Las rutas son comunes a todos los sectores, así que son
  // estos interruptores —y no el nombre del sector— los que deciden qué
  // páginas existen para cada negocio.
  properties?: boolean;
  visits?: boolean;
  private_listings?: boolean;
  valuation?: boolean;
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
  /** Segunda opción de contacto, normalmente el fijo del local. */
  phone_alt: string | null;
  phone_alt_label: string | null;
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

// ============================================================================
//  SECTOR INMOBILIARIA
// ----------------------------------------------------------------------------
//  Las formas coinciden con sql/04_inmobiliaria.sql.
// ============================================================================

export type OperacionInmueble = "venta" | "alquiler";

export type TipoInmueble =
  | "piso" | "casa" | "chalet" | "atico" | "duplex" | "estudio"
  | "local" | "oficina" | "nave" | "garaje" | "trastero" | "terreno"
  | "edificio" | "otro";

export const TIPOS_INMUEBLE_ES: Record<TipoInmueble, string> = {
  piso: "Piso",
  casa: "Casa",
  chalet: "Chalet",
  atico: "Ático",
  duplex: "Dúplex",
  estudio: "Estudio",
  local: "Local",
  oficina: "Oficina",
  nave: "Nave",
  garaje: "Garaje",
  trastero: "Trastero",
  terreno: "Terreno",
  edificio: "Edificio",
  otro: "Inmueble",
};

/**
 * "enlace_privado" es la captación de boca a boca: existe y tiene ficha, pero
 * no sale en el listado ni en buscadores. RLS no se la enseña nunca al
 * público; la resuelve el servidor a partir del token.
 */
export type VisibilidadInmueble = "publico" | "enlace_privado" | "borrador";

/** Estado comercial, independiente de si la ficha está publicada. */
export type EstadoOperacion = "disponible" | "reservado" | "vendido" | "alquilado";

export const ESTADO_OPERACION_ES: Record<EstadoOperacion, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  alquilado: "Alquilado",
};

export type LetraEnergia = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/**
 * "pendiente" no es un hueco, es una declaración. El RD 390/2021 obliga a
 * mostrar la etiqueta energética en cualquier anuncio, así que la ficha dice
 * en voz alta que falta en vez de callar.
 */
export type EstadoEnergia = "disponible" | "en_tramite" | "exento" | "pendiente";

export const ESTADO_ENERGIA_ES: Record<EstadoEnergia, string> = {
  disponible: "Certificado energético",
  en_tramite: "Certificado energético en trámite",
  exento: "Exento de certificado energético",
  pendiente: "Certificado energético pendiente de cargar",
};

export type OrigenInmueble = "web" | "manual" | "portal";

export interface FotoInmueble {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  is_cover: boolean;
}

export interface Inmueble {
  id: string;
  reference: string;
  slug: string;
  title: string;
  description: string | null;
  operation: OperacionInmueble;
  kind: TipoInmueble;
  /** En céntimos. null + price_on_request = "consultar". Nunca inventado. */
  price_cents: number | null;
  price_on_request: boolean;
  surface_built_m2: number | null;
  surface_useful_m2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor_label: string | null;
  has_lift: boolean | null;
  condition_note: string | null;
  year_built: number | null;
  municipality: string | null;
  zone: string | null;
  street: string | null;
  street_is_public: boolean;
  lat: number | null;
  lng: number | null;
  energy_rating: LetraEnergia | null;
  energy_status: EstadoEnergia;
  status: EstadoContenido;
  visibility: VisibilidadInmueble;
  deal_state: EstadoOperacion;
  source: OrigenInmueble;
  source_url: string | null;
  synced_at: string | null;
  featured: boolean;
  position: number;
  is_demo: boolean;
  fotos: FotoInmueble[];
}

export type FranjaVisita = "manana" | "tarde" | "indiferente";

export const FRANJA_VISITA_ES: Record<FranjaVisita, string> = {
  manana: "Por la mañana",
  tarde: "Por la tarde",
  indiferente: "Me da igual",
};

export interface PeticionVisita {
  id: string;
  property_id: string | null;
  property_ref: string | null;
  name: string;
  phone: string;
  email: string | null;
  preferred_date: string | null;
  preferred_slot: string | null;
  needs_financing: boolean | null;
  comments: string | null;
  status: EstadoReserva;
  staff_notes: string | null;
  created_at: string;
}

/** Precio por metro construido, en euros. null si falta alguno de los dos. */
export function precioPorM2(inmueble: Inmueble): number | null {
  if (inmueble.price_cents === null) return null;
  if (!inmueble.surface_built_m2) return null;
  return Math.round(inmueble.price_cents / 100 / inmueble.surface_built_m2);
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
  /** Solo los de visibilidad "publico". Los de enlace privado nunca van aquí. */
  inmuebles: Inmueble[];
}
