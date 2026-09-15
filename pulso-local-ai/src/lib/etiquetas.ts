import type {
  AreaServicio, DestinoQr, EstadoInmueble, EstadoLead, EstadoNegocio, EstadoOpinion,
  EstadoVisita, FuenteLead, ModoVisita, OperacionInmueble, RolMiembro, TipoInmueble, TipoLead,
} from "@/types/dominio";

/**
 * Los enums de la base de datos están en inglés o en snake_case porque son
 * identificadores. Lo que ve una persona, aquí. Un único sitio que traducir.
 */

export const ETIQUETA_OPERACION: Record<OperacionInmueble, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_opcion_compra: "Alquiler con opción a compra",
  traspaso: "Traspaso",
};

export const ETIQUETA_TIPO_INMUEBLE: Record<TipoInmueble, string> = {
  piso: "Piso", casa: "Casa", chalet: "Chalet", atico: "Ático", duplex: "Dúplex",
  estudio: "Estudio", local: "Local", oficina: "Oficina", nave: "Nave",
  garaje: "Garaje", trastero: "Trastero", parcela: "Parcela", edificio: "Edificio",
};

export const ETIQUETA_ESTADO_INMUEBLE: Record<EstadoInmueble, string> = {
  borrador: "Borrador", disponible: "Disponible", reservado: "Reservado",
  vendido: "Vendido", alquilado: "Alquilado", archivado: "Archivado",
};

export const ETIQUETA_TIPO_LEAD: Record<TipoLead, string> = {
  buyer: "Comprador",
  tenant: "Inquilino",
  investor: "Inversor",
  seller: "Vendedor",
  landlord: "Arrendador",
  valuation_request: "Valoración",
  general_consultation: "Consulta general",
  community_administration: "Administración de fincas",
  tax_labor_legal_consultation: "Asesoría fiscal, laboral o jurídica",
};

export const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  nuevo: "Nuevo", contactado: "Contactado", cualificado: "Cualificado",
  visita_agendada: "Visita agendada", cerrado: "Cerrado", descartado: "Descartado",
};

export const ETIQUETA_FUENTE: Record<FuenteLead, string> = {
  qr: "QR", web: "Web", inmueble: "Ficha de inmueble", escaparate: "Escaparate",
  cartel: "Cartel", tarjeta: "Tarjeta", visita: "Visita", campana: "Campaña", otro: "Otro",
};

export const ETIQUETA_ESTADO_VISITA: Record<EstadoVisita, string> = {
  pendiente: "Pendiente", confirmado: "Confirmada", realizado: "Realizada", cancelado: "Cancelada",
};

export const ETIQUETA_MODO_VISITA: Record<ModoVisita, string> = {
  presencial: "Visita presencial", videollamada: "Videollamada", llamada: "Llamada",
};

export const ETIQUETA_ESTADO_OPINION: Record<EstadoOpinion, string> = {
  nuevo: "Sin revisar", en_revision: "En revisión", resuelto: "Resuelta",
};

export const ETIQUETA_AREA: Record<AreaServicio, string> = {
  inmobiliaria: "Gestión inmobiliaria",
  administracion_fincas: "Administración de fincas",
  fiscal: "Asesoría fiscal",
  laboral: "Asesoría laboral",
  juridico: "Asesoría jurídica",
  otros: "Otros servicios",
};

export const ETIQUETA_ESTADO_NEGOCIO: Record<EstadoNegocio, string> = {
  trial: "Demo activa", active: "Cliente activo", suspended: "Suspendido", expired: "Demo caducada",
};

export const ETIQUETA_ROL: Record<RolMiembro, string> = {
  owner: "Propietario", admin: "Administrador", agent: "Agente", viewer: "Solo lectura",
};

export const ETIQUETA_DESTINO_QR: Record<DestinoQr, string> = {
  landing: "Landing del negocio",
  inmueble: "Ficha de un inmueble",
  valoracion: "Solicitud de valoración",
  buscar_vivienda: "Buscador de vivienda",
  servicios: "Servicios",
  administracion_fincas: "Administración de fincas",
  opinion: "Formulario de opinión",
  whatsapp: "WhatsApp con mensaje",
  url_personalizada: "URL personalizada",
};

export const ETIQUETA_ETIQUETA_INMUEBLE: Record<string, string> = {
  nuevo: "Nuevo", destacado: "Destacado", oportunidad: "Oportunidad",
  rebajado: "Rebajado", exclusivo: "Exclusivo", inversion: "Inversión",
};
