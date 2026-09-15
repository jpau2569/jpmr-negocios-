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
    // El fijo de la pizarra, como segunda opción: hay clientes que prefieren
    // llamar al local de toda la vida antes que escribir por WhatsApp.
    telefonoAlt: "+34984253352",
    telefonoAltEtiqueta: "Reservas (fijo): 984 25 33 52",

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
    email: "Restaurantelagarlavina@gmail.com",

    // Pau: "siempre a ambos al móvil, no al fijo". El móvil lo dio el
    // 2026-09-14. El fijo del local (985 42 66 90) existe y sigue en su ficha
    // de Google, pero NO es el que se pone aquí: quien escanea el QR desde la
    // mesa escribe por WhatsApp, y eso solo funciona en un móvil.
    telefono: "+34620583770",
    telefonoTexto: "620 58 37 70",
    whatsapp: "34620583770",
    telefonoAlt: "+34985426690",
    telefonoAltEtiqueta: "Fijo del local: 985 42 66 90",

    instagram: "https://www.instagram.com/restaurantelavinacenera/",
    tripadvisor: "https://www.tripadvisor.es/Restaurant_Review-g21305928-d10392942-Reviews-La_Vina_Restaurante-Casaviedra_Mieres_Municipality_Asturias.html",

    pendiente: [
      "Falta confirmar que el 620 58 37 70 tiene WhatsApp activo y lo atiende alguien",
      "Falta el enlace oficial de Google Reviews: sin él no se pinta el botón de reseña",
      "Faltan las fotos de los platos",
      "La carta cargada son solo sus especialidades conocidas, no la carta completa con precios",
    ],
  },

  "asesoria-castresana": {
    origen: "Datos facilitados directamente por Pau (es su agencia) el 2026-09-15, "
      + "con fotos del local. Corrigen el correo y el horario que estaban "
      + "fichados en escaparate3d desde antes.",
    fecha: "2026-09-15",

    // Oficina, no hostelería: dos tramos y cerrado el fin de semana.
    horario: [
      { dow: 0, ranges: [] },                            // domingo: CERRADO
      { dow: 1, ranges: [["10:00", "14:00"], ["17:00", "19:00"]] },
      { dow: 2, ranges: [["10:00", "14:00"], ["17:00", "19:00"]] },
      { dow: 3, ranges: [["10:00", "14:00"], ["17:00", "19:00"]] },
      { dow: 4, ranges: [["10:00", "14:00"], ["17:00", "19:00"]] },
      { dow: 5, ranges: [["10:00", "14:00"], ["17:00", "19:00"]] },
      { dow: 6, ranges: [] },                            // sábado: CERRADO
    ],

    direccion: "Calle Cabo Noval, 8 Bajo 2 · 33007 Oviedo (Asturias)",
    // OJO: no es asesoriacastresana@gmail.com, que es lo que había fichado.
    email: "inmobiliariacastresana@gmail.com",
    web: "https://www.asesoriacastresana.com",

    // La agencia tiene DOS móviles con WhatsApp. El botón grande solo puede
    // apuntar a uno: se toma el 689 por ser el primero que dio Pau, y el 672
    // queda como segunda opción junto al fijo. Pendiente de que Pau confirme
    // cuál quiere de principal, porque va impreso en los carteles.
    telefono: "+34689929926",
    telefonoTexto: "689 92 99 26",
    whatsapp: "34689929926",
    whatsappAlt: "34672775721",
    whatsappAltTexto: "672 77 57 21",
    telefonoAlt: "+34985210468",
    // La etiqueta lleva DENTRO el segundo móvil. Si no, se perdería: el
    // esquema solo tiene un hueco para WhatsApp y otro para el teléfono
    // alternativo, y la agencia tiene tres números. Debe decir exactamente
    // lo mismo que sql/05_castresana.sql; hay una prueba que lo compara.
    telefonoAltEtiqueta: "Oficina (fijo): 985 21 04 68 · Otro WhatsApp: 672 77 57 21",

    // Enlace de compartir de su ficha de Google, facilitado por Pau el
    // 2026-09-15. OJO: es un enlace de FICHA, no de "escribir reseña". Abre el
    // perfil del negocio y el cliente tiene que buscar el botón de opinar: una
    // pulsación más. El bueno sería el g.page/r/.../review que da el panel de
    // Google Business ("Pedir reseñas"), y está pendiente.
    //
    // No se ha podido verificar desde el entorno de desarrollo: la política de
    // red no deja salir a dominios de Google. Lo dio Pau, que es el dueño.
    reviewUrl: "https://maps.app.goo.gl/rJXqk2JiHjRsev1g7",
    reviewUrlDirecto: false,

    pendiente: [
      "Falta confirmar cuál de los dos móviles (689 92 99 26 o 672 77 57 21) es el WhatsApp principal",
      "El enlace de Google abre la ficha, no el formulario de reseña: con el enlace directo el cliente se ahorra una pulsación",
      "La cartera se carga desde la web oficial al pulsar «Sincronizar» en el panel",
      "Ningún inmueble tiene todavía cargada la etiqueta energética (obligatoria en anuncios, RD 390/2021)",
    ],
  },
};

/** Lo que este fichero confirma de un negocio, o un objeto vacío. */
export const confirmadoDe = (slug) => CONFIRMADO[slug] ?? {};
