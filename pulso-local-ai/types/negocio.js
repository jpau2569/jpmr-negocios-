// ============================================================================
//  Tipos del dominio
// ----------------------------------------------------------------------------
//  Se escriben a mano en vez de generarlos con `supabase gen types` porque el
//  proyecto todavía no existe. Cuando exista, se genera types/database.ts y
//  estos tipos se derivan de aquél. Las formas coinciden con sql/01_esquema.sql.
// ============================================================================
export const ALERGENOS_ES = {
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
export const ETIQUETAS_ES = {
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
