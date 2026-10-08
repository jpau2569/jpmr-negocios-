// ============================================================================
//  Catálogos y enumeraciones. Única fuente de verdad: la interfaz las lee de
//  /api/catalogos, así que no hay listas duplicadas en el navegador.
//  - Los ESTADOS son fijos (gobiernan reglas y el panel).
//  - Los catálogos CONFIGURABLES (municipios, fuentes, tipos de inmueble,
//    motivos de descarte) se siembran aquí y se pueden ampliar en Configuración.
// ============================================================================

const lista = (...pares) => pares.map(([clave, etiqueta, extra = {}]) => ({ clave, etiqueta, ...extra }));
export const claves = (l) => l.map((x) => x.clave);
export const etiquetaDe = (l, clave) => l.find((x) => x.clave === clave)?.etiqueta ?? clave;

// ------------------------------------------------------- oportunidades ----
// grupo: detectada | contacto | encargo | cerrada  (el panel los separa)
export const ESTADOS_OPORTUNIDAD = lista(
  ["detectada", "Detectada", { grupo: "detectada", color: "gris" }],
  ["pendiente_revision", "Pendiente de revisión", { grupo: "detectada", color: "gris" }],
  ["pendiente_verificar_contacto", "Pendiente de verificar posibilidad de contacto", { grupo: "detectada", color: "ambar" }],
  ["preparada_contacto", "Preparada para contacto permitido", { grupo: "contacto", color: "azul" }],
  ["conversacion_iniciada", "Conversación iniciada", { grupo: "contacto", color: "azul" }],
  ["propietario_interesado", "Propietario interesado", { grupo: "contacto", color: "verde" }],
  ["visita_valoracion_programada", "Visita de valoración programada", { grupo: "contacto", color: "verde" }],
  ["valoracion_realizada", "Valoración realizada", { grupo: "contacto", color: "verde" }],
  ["propuesta_presentada", "Propuesta presentada", { grupo: "contacto", color: "verde" }],
  ["encargo_confirmado", "Encargo confirmado", { grupo: "encargo", color: "esmeralda" }],
  ["descartada", "Descartada", { grupo: "cerrada", color: "rojo" }],
  ["no_contactar", "No contactar", { grupo: "cerrada", color: "rojo" }],
);
/** Estados en los que ya se está trabajando el contacto con el propietario. */
export const ESTADOS_CON_CONTACTO = [
  "preparada_contacto", "conversacion_iniciada", "propietario_interesado",
  "visita_valoracion_programada", "valoracion_realizada", "propuesta_presentada",
];
export const ESTADOS_ABIERTOS = claves(ESTADOS_OPORTUNIDAD).filter((e) => !["encargo_confirmado", "descartada", "no_contactar"].includes(e));

export const CLASIFICACION_ANUNCIANTE = lista(
  ["sin_verificar", "Sin verificar"], ["particular", "Particular"], ["profesional", "Profesional"],
);
export const VERIFICACION_CONTACTO = lista(
  ["sin_verificar", "Sin verificar"],
  ["permitido", "Contacto permitido (verificado)"],
  ["no_permitido", "Contacto no permitido"],
);

// ------------------------------------------------------------ contactos ----
export const CANALES = lista(
  ["telefono", "Teléfono"], ["whatsapp", "WhatsApp"], ["email", "Correo electrónico"],
  ["sms", "SMS"], ["portal", "Mensajería del portal"],
);
export const CANAL_PREFERIDO = [...CANALES, { clave: "presencial", etiqueta: "En persona" }];

export const PROCEDENCIAS = lista(
  ["propia_persona", "Me lo facilitó la propia persona"],
  ["anuncio_particular", "Figura en un anuncio publicado por la propia persona"],
  ["referido", "Referido por otra persona"],
  ["formulario_web", "Formulario web o solicitud de la persona"],
  ["portal_mensajeria", "Mensajería de un portal inmobiliario"],
  ["cliente_previo", "Cliente anterior de la inmobiliaria"],
  ["registro_publico", "Registro o fuente pública"],
  ["otra", "Otra (indicar)"],
);
export const PLAZOS_VENTA = lista(
  ["inmediato", "Lo antes posible"], ["3_meses", "En unos 3 meses"], ["6_meses", "En unos 6 meses"],
  ["12_meses", "En unos 12 meses"], ["sin_prisa", "Sin prisa"], ["desconocido", "No lo ha dicho"],
);

// Habilitación de comunicaciones por canal (registro interno, NO asesoramiento
// jurídico). Reglas operativas de la skill legal del ecosistema:
//  - correo, WhatsApp y SMS comerciales a un particular sin relación previa
//    exigen consentimiento (art. 21 LSSI): solo se pueden "habilitar" con una
//    base acreditada;
//  - el teléfono exige base acreditada o haber comprobado la Lista Robinson;
//  - la mensajería del propio portal es un canal aparte.
export const ESTADOS_HABILITACION = lista(
  ["sin_revisar", "Sin revisar", { color: "gris" }],
  ["habilitado", "Habilitado", { color: "verde" }],
  ["no_habilitado", "No habilitado", { color: "ambar" }],
  ["baja", "Oposición o baja", { color: "rojo" }],
);
export const BASES_COMUNICACION = lista(
  ["consentimiento", "Consentimiento expreso de la persona"],
  ["solicitud_interesado", "La persona nos contactó o pidió información"],
  ["relacion_previa", "Relación contractual previa (servicio similar)"],
  ["robinson", "Llamada tras comprobar la Lista Robinson"],
  ["via_portal", "Mensajería del propio portal"],
);
/** Bases admitidas para marcar un canal como habilitado. */
export const BASES_POR_CANAL = {
  email: ["consentimiento", "solicitud_interesado", "relacion_previa"],
  whatsapp: ["consentimiento", "solicitud_interesado", "relacion_previa"],
  sms: ["consentimiento", "solicitud_interesado", "relacion_previa"],
  telefono: ["consentimiento", "solicitud_interesado", "relacion_previa", "robinson"],
  portal: ["via_portal", "solicitud_interesado"],
};

// ------------------------------------------------------------ inmuebles ----
export const OPERACIONES = lista(["venta", "Venta"], ["alquiler", "Alquiler"]);
export const TIPOS_SUPERFICIE = lista(
  ["desconocida", "Sin indicar"], ["util", "Útil"], ["construida", "Construida"], ["parcela", "Parcela"],
);
export const ESTADOS_CONSERVACION = lista(
  ["a_reformar", "A reformar"], ["buen_estado", "Buen estado"], ["reformado", "Reformado"],
  ["obra_nueva", "Obra nueva"], ["desconocido", "Sin indicar"],
);
export const ESTADOS_COMERCIALES = lista(
  ["en_preparacion", "En preparación", { color: "gris" }],
  ["disponible", "Disponible", { color: "verde" }],
  ["reservado", "Reservado", { color: "ambar" }],
  ["en_negociacion", "En negociación", { color: "azul" }],
  ["vendido", "Vendido", { color: "esmeralda" }],
  ["alquilado", "Alquilado", { color: "esmeralda" }],
  ["retirado", "Retirado", { color: "rojo" }],
  ["archivado", "Archivado", { color: "gris" }],
);
/** "Activo" = a la vista del mercado o en proceso. */
export const ESTADOS_COMERCIALES_ACTIVOS = ["disponible", "reservado", "en_negociacion"];

export const TIPOS_ENCARGO = lista(["venta", "Venta"], ["alquiler", "Alquiler"]);
export const HONORARIOS_TIPO = lista(["sin_definir", "Sin definir"], ["porcentaje", "Porcentaje sobre el precio"], ["fijo", "Importe fijo"]);
export const ESTADOS_ENCARGO = lista(
  ["vigente", "Vigente", { color: "verde" }], ["vencido", "Vencido", { color: "ambar" }],
  ["finalizado", "Finalizado", { color: "gris" }], ["cancelado", "Cancelado", { color: "rojo" }],
);

// ------------------------------------------------------------- demandas ----
export const OPERACIONES_DEMANDA = lista(["compra", "Compra"], ["alquiler", "Alquiler"]);
export const NIVEL_REQUISITO = lista(["indiferente", "Indiferente"], ["deseable", "Deseable"], ["imprescindible", "Imprescindible"]);
export const PLAZOS_COMPRA = lista(
  ["desconocido", "No lo ha dicho"], ["inmediato", "Lo antes posible"], ["3_meses", "En unos 3 meses"],
  ["6_meses", "En unos 6 meses"], ["12_meses", "En unos 12 meses"], ["sin_prisa", "Sin prisa"],
);
// Lo que el cliente MANIFIESTA no es lo que está acreditado: solo la última
// opción exige evidencia.
export const FINANCIACION = lista(
  ["no_indicada", "No indicada"],
  ["contado_manifestado", "Pago al contado (manifestado, sin acreditar)"],
  ["hipoteca_manifestada", "Necesita hipoteca (manifestado, sin estudio)"],
  ["hipoteca_en_estudio", "Hipoteca en estudio por el banco"],
  ["vende_para_comprar", "Depende de vender su vivienda"],
  ["aprobada_acreditada", "Financiación aprobada y acreditada (con evidencia)"],
);
export const ESTADOS_DEMANDA = lista(
  ["activa", "Activa", { color: "verde" }], ["pausada", "Pausada", { color: "ambar" }], ["cerrada", "Cerrada", { color: "gris" }],
);

// --------------------------------------------------------------- tareas ----
export const TIPOS_TAREA = lista(
  ["llamada", "Llamada"], ["whatsapp", "WhatsApp"], ["email", "Correo"], ["visita", "Visita"],
  ["documentacion", "Documentación"], ["seguimiento", "Seguimiento"], ["valoracion", "Valoración"],
  ["vencimiento_encargo", "Vencimiento de encargo"], ["otro", "Otro"],
);
/** Tipos de tarea que implican comunicarse con la persona y su canal. */
export const CANAL_DE_TAREA = { llamada: "telefono", whatsapp: "whatsapp", email: "email" };
export const PRIORIDADES = lista(["alta", "Alta", { color: "rojo" }], ["media", "Media", { color: "ambar" }], ["baja", "Baja", { color: "gris" }]);
export const ESTADOS_TAREA = lista(
  ["pendiente", "Pendiente", { color: "azul" }], ["en_curso", "En curso", { color: "ambar" }],
  ["hecha", "Hecha", { color: "verde" }], ["cancelada", "Cancelada", { color: "gris" }],
);
export const TIPOS_ACTIVIDAD = lista(
  ["llamada", "Llamada"], ["whatsapp", "WhatsApp"], ["email", "Correo"], ["mensaje_portal", "Mensaje en portal"],
  ["reunion", "Reunión"], ["visita", "Visita"], ["nota", "Nota"],
);
/** Cuentan como "conversación registrada" en los informes. */
export const TIPOS_CONVERSACION = ["llamada", "whatsapp", "email", "mensaje_portal", "reunion"];
export const DIRECCIONES = lista(["saliente", "La iniciamos nosotros"], ["entrante", "Nos contactaron"], ["interna", "Interna"]);

// ------------------------------------------- catálogos configurables ----
export const MUNICIPIOS_ASTURIAS = [
  // Los 78 concejos (INE, 1-1-2023), por orden alfabético.
  "Allande", "Aller", "Amieva", "Avilés", "Belmonte de Miranda", "Bimenes", "Boal", "Cabranes", "Cabrales",
  "Candamo", "Cangas de Onís", "Cangas del Narcea", "Caravia", "Carreño", "Caso", "Castrillón", "Castropol",
  "Coaña", "Colunga", "Corvera de Asturias", "Cudillero", "Degaña", "El Franco", "Gijón", "Gozón", "Grado",
  "Grandas de Salime", "Ibias", "Illano", "Illas", "Langreo", "Las Regueras", "Laviana", "Lena", "Llanera",
  "Llanes", "Mieres", "Morcín", "Muros de Nalón", "Nava", "Navia", "Noreña", "Onís", "Oviedo", "Parres",
  "Peñamellera Alta", "Peñamellera Baja", "Pesoz", "Piloña", "Ponga", "Pravia", "Proaza", "Quirós",
  "Ribadedeva", "Ribadesella", "Ribera de Arriba", "Riosa", "Salas", "San Martín de Oscos",
  "San Martín del Rey Aurelio", "San Tirso de Abres", "Santa Eulalia de Oscos", "Santo Adriano", "Sariego",
  "Siero", "Sobrescobio", "Somiedo", "Soto del Barco", "Tapia de Casariego", "Taramundi", "Teverga", "Tineo",
  "Valdés", "Vegadeo", "Villanueva de Oscos", "Villaviciosa", "Villayón", "Yernes y Tameza",
];

export const FUENTES_DEFECTO = [
  "Idealista", "Fotocasa", "Habitaclia", "Pisos.com", "Milanuncios", "Facebook Marketplace", "Web propia",
  "Referido", "Cartel o calle", "Llamada entrante", "Redes sociales", "Cliente anterior", "Otra",
];
export const TIPOS_INMUEBLE_DEFECTO = [
  "Piso", "Casa", "Chalet", "Adosado", "Parcela o terreno", "Local", "Garaje", "Trastero", "Edificio", "Otro",
];
export const MOTIVOS_DESCARTE_DEFECTO = [
  "No quiere vender", "Vendido por otro medio", "Precio fuera de mercado", "Es una agencia o profesional",
  "Exclusiva con otra agencia", "Datos insuficientes", "No responde", "Anuncio duplicado", "Otro",
];

/** Tipos de catálogo configurables (clave → etiqueta en la interfaz). */
export const TIPOS_CATALOGO = {
  municipio: "Municipios",
  fuente: "Fuentes de oportunidades",
  tipo_inmueble: "Tipos de inmueble",
  motivo_descarte: "Motivos de descarte",
};

export const CONFIG_DEFECTO = {
  inmobiliaria: { nombre: "", telefono: "", email: "", web: "", direccion: "" },
  usuario: { nombre: "Pau" },
  referencias: { inmueble_prefijo: "INM", inmueble_digitos: 4, oportunidad_prefijo: "OP" },
  avisos: { encargo_dias: 30, demanda_obsoleta_dias: 60, copia_dias: 7 },
  copias: { automaticas: true, conservar: 14 },
};

/** Todo lo que necesita la interfaz para pintar listas desplegables y etiquetas. */
export function enumeraciones() {
  return {
    estados_oportunidad: ESTADOS_OPORTUNIDAD, clasificacion_anunciante: CLASIFICACION_ANUNCIANTE,
    verificacion_contacto: VERIFICACION_CONTACTO, canales: CANALES, canal_preferido: CANAL_PREFERIDO,
    procedencias: PROCEDENCIAS, plazos_venta: PLAZOS_VENTA, estados_habilitacion: ESTADOS_HABILITACION,
    bases_comunicacion: BASES_COMUNICACION, bases_por_canal: BASES_POR_CANAL,
    operaciones: OPERACIONES, tipos_superficie: TIPOS_SUPERFICIE, estados_conservacion: ESTADOS_CONSERVACION,
    estados_comerciales: ESTADOS_COMERCIALES, tipos_encargo: TIPOS_ENCARGO, honorarios_tipo: HONORARIOS_TIPO,
    estados_encargo: ESTADOS_ENCARGO, operaciones_demanda: OPERACIONES_DEMANDA, nivel_requisito: NIVEL_REQUISITO,
    plazos_compra: PLAZOS_COMPRA, financiacion: FINANCIACION, estados_demanda: ESTADOS_DEMANDA,
    tipos_tarea: TIPOS_TAREA, prioridades: PRIORIDADES, estados_tarea: ESTADOS_TAREA,
    tipos_actividad: TIPOS_ACTIVIDAD, direcciones: DIRECCIONES, tipos_conversacion: TIPOS_CONVERSACION,
    estados_con_contacto: ESTADOS_CON_CONTACTO, tipos_catalogo: TIPOS_CATALOGO,
  };
}
