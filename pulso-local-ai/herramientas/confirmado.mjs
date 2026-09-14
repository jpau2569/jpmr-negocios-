// ============================================================================
//  Datos CONFIRMADOS por el negocio (o por Pau con la ficha delante)
// ----------------------------------------------------------------------------
//  Este fichero es la diferencia entre "lo hemos encontrado por ahí" y "esto
//  es así". Lo de aquí se pinta como dato real; lo que no esté aquí sigue
//  marcado como muestra en la propia página.
//
//  Cada bloque lleva su ORIGEN y su FECHA. Dentro de seis meses, cuando alguien
//  se pregunte de dónde salió un horario, la respuesta está escrita.
//
//  Lo que NO esté confirmado va en `pendiente` y se ve en el pie de la web.
// ============================================================================

/** dow: 0 domingo … 6 sábado. Sin tramos, ese día cierra. */
export const CONFIRMADO = {
  "thewhitebar-mieres": {
    origen: "Ficha pública de Google del local, facilitada por Pau el 2026-09-14.",
    fecha: "2026-09-14",

    // Confirmado: coincide exactamente con lo que ya estaba fichado en
    // escaparate3d-pro desde el 2026-09-09 (dos fuentes independientes).
    horario: [
      { dow: 0, ranges: [["11:00", "17:00"]] },          // domingo
      { dow: 1, ranges: [["11:00", "23:00"]] },          // lunes
      { dow: 2, ranges: [["11:00", "23:00"]] },          // martes
      { dow: 3, ranges: [] },                            // miércoles: CERRADO
      { dow: 4, ranges: [["11:00", "23:00"]] },          // jueves
      { dow: 5, ranges: [["11:00", "01:00"]] },          // viernes, cruza medianoche
      { dow: 6, ranges: [["11:00", "01:00"]] },          // sábado, cruza medianoche
    ],

    // Pau: "siempre a ambos al móvil, no al fijo". El 684 es móvil y ya estaba
    // confirmado como teléfono del local; el 984 25 33 52 es el fijo de la
    // pizarra de reservas. El botón "Llamar" apunta al móvil.
    telefono: "+34684650516",
    telefonoTexto: "684 65 05 16",
    whatsapp: "34684650516",

    // Nada de esto está confirmado todavía: se ve avisado en el pie de la web.
    pendiente: [
      "Falta el enlace oficial de Google Reviews: sin él no se pinta el botón de reseña",
      "Falta confirmar que el 684 65 05 16 tiene WhatsApp activo y lo atiende alguien",
      "Faltan las fotos de los platos",
      "30 de los 44 platos tienen el precio sin confirmar por el local",
      "El menú del día que se ve es de muestra: el real lo carga el negocio cada día",
    ],
  },

  "la-vina-cenera": {
    origen: "Ficha pública de Google y redes del local, facilitadas por Pau el 2026-09-14. Pau es de Cenera.",
    fecha: "2026-09-14",

    // Cocina de valle: abren a mediodía y cierran de madrugada. Los siete
    // tramos cruzan la medianoche menos el martes, que cierran.
    horario: [
      { dow: 0, ranges: [["12:00", "02:00"]] },          // domingo
      { dow: 1, ranges: [["12:00", "02:00"]] },          // lunes
      { dow: 2, ranges: [] },                            // martes: CERRADO
      { dow: 3, ranges: [["12:00", "02:00"]] },          // miércoles
      { dow: 4, ranges: [["12:00", "02:00"]] },          // jueves
      { dow: 5, ranges: [["12:00", "02:00"]] },          // viernes
      { dow: 6, ranges: [["12:00", "02:00"]] },          // sábado
    ],

    direccion: "La Viña, 1 · 33615 Cenera, Mieres (Asturias)",
    telefono: "+34985426690",
    telefonoTexto: "985 42 66 90",
    email: "Restaurantelagarlavina@gmail.com",

    // Pau pidió que el contacto vaya al móvil y no al fijo, pero el 985 es un
    // fijo y es el único número que hay. NO se pone un WhatsApp inventado:
    // hasta que llegue el móvil del local, el botón sencillamente no aparece.
    whatsapp: null,

    instagram: "https://www.instagram.com/restaurantelavinacenera/",
    tripadvisor: "https://www.tripadvisor.es/Restaurant_Review-g21305928-d10392942-Reviews-La_Vina_Restaurante-Casaviedra_Mieres_Municipality_Asturias.html",

    pendiente: [
      "FALTA EL MÓVIL del local: Pau pidió que el contacto vaya al móvil, pero el 985 42 66 90 es fijo. Sin móvil no hay botón de WhatsApp",
      "Falta el enlace oficial de Google Reviews: sin él no se pinta el botón de reseña",
      "Faltan las fotos de los platos",
      "La carta cargada son solo sus especialidades conocidas, no la carta completa con precios",
    ],
  },
};

/** Lo que este fichero confirma de un negocio, o un objeto vacío. */
export const confirmadoDe = (slug) => CONFIRMADO[slug] ?? {};
