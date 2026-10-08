// ============================================================================
//  Secciones que llegan en fases posteriores. No son maquetas vacías: dicen
//  con claridad qué hará cada una, cuándo llega y qué usar mientras tanto.
// ============================================================================
import { h, cabecera, panel, boton, aviso } from "../ui.js";

const SECCIONES = {
  visitas: {
    titulo: "Visitas", fase: 2,
    resumen: "Distinguirá las visitas de captación o valoración de las visitas comerciales con un comprador.",
    hara: ["Registrar inmueble, participantes, fecha y hora, estado, observaciones, resultado y comentarios del comprador.", "Preparar una ficha de visita imprimible. Cualquier documento de firma será un borrador: no se simula firma electrónica.", "Alimentar el panel («visitas próximas») y los informes."],
    mientras: ["Crea una tarea de tipo «Visita» con fecha y hora (Agenda y tareas) y relaciónala con la oportunidad o el inmueble.", "Anota lo que pasó en «Registrar actividad» de la ficha."],
  },
  ofertas: {
    titulo: "Ofertas", fase: 2,
    resumen: "Registrará cada oferta de un comprador sobre un inmueble y su negociación.",
    hara: ["Importe, fecha, condiciones manifestadas, respuesta del propietario e historial de negociación.", "Estados: recibida, pendiente de trasladar, en estudio, contraoferta, aceptada, rechazada y retirada.", "Al avanzar una oferta se creará la operación vinculada."],
    mientras: ["Anota la oferta como actividad en la ficha del inmueble y crea una tarea para trasladarla al propietario."],
  },
  operaciones: {
    titulo: "Operaciones", fase: 2,
    resumen: "Seguirá cada compraventa desde la oferta aceptada hasta el cierre.",
    hara: ["Hitos configurables (no todos los procesos jurídicos son iguales), documentación pendiente, fechas previstas y honorarios previstos y cobrados.", "No sustituye el asesoramiento jurídico, fiscal ni contable."],
    mientras: ["Para plazos y papeles de una operación ya puedes usar tu app «Cerebro Útil Pau» (sección Operaciones)."],
  },
  documentos: {
    titulo: "Documentos y fotografías", fase: 2,
    resumen: "Guardará documentos y fotos vinculados a cada ficha, dentro de la carpeta de datos y de las copias de seguridad.",
    hara: ["Adjuntar, clasificar, descargar y eliminar con confirmación; elegir la foto principal y separar el material interno del publicable.", "Una carpeta de archivos ya existe y las copias de seguridad ya la incluyen; falta la pantalla para gestionarla.", "Subir un archivo no significa que esté validado: se mostrará como «sin revisar» hasta que lo marques."],
    mientras: ["Guarda los documentos en una carpeta de tu ordenador y anota en la ficha dónde están."],
  },
  marketing: {
    titulo: "Marketing inmobiliario", fase: 3,
    resumen: "Preparará fichas comerciales, borradores de anuncio, dosieres imprimibles y textos para redes con los datos CONFIRMADOS del inmueble.",
    hara: ["Registrar dónde se ha publicado cada inmueble, el enlace y la fecha de revisión.", "No publica automáticamente en portales ni simula integraciones.", "No inventa características ni quita defectos relevantes de los textos."],
    mientras: ["Escribe la descripción comercial en la ficha del inmueble (campo «Descripción comercial») con datos confirmados."],
  },
  asistente: {
    titulo: "Asistente IA", fase: 3,
    resumen: "En su primera versión será un generador de prompts y plantillas que copias y pegas en Claude. No necesita API de pago.",
    hara: ["Resumir una ficha, preparar preguntas de captación, preparar una visita, redactar una propuesta, un anuncio con datos confirmados o un seguimiento.", "Antes de copiar podrás elegir los campos, se excluirán los datos personales por defecto, verás una vista previa, se marcarán los datos desconocidos y se recordará la revisión humana.", "Una integración real con IA será opcional y posterior (Fase 4); la clave nunca estará en el navegador."],
    mientras: ["Copia a mano los datos que quieras de la ficha (sin datos personales) y pégalos en Claude."],
  },
  informes: {
    titulo: "Informes", fase: 3,
    resumen: "Calculará con datos reales cómo va la captación y la venta, indicando siempre el periodo y la definición de cada indicador.",
    hara: ["Oportunidades por fuente, conversión entre etapas, tiempo entre etapas, encargos, visitas por inmueble, ofertas, operaciones cerradas, honorarios y coste por encargo.", "No dividirá por cero y distinguirá «sin datos» de «cero».", "Importar y exportar datos (importación CSV con vista previa y detección de duplicados, Fase 2-3)."],
    mientras: ["El Inicio ya muestra recuentos reales por estado, fuente y municipio, y puedes exportar a CSV cada lista."],
  },
};

export async function vista(cont, { seccion }) {
  const s = SECCIONES[seccion];
  cont.append(cabecera({ titulo: s.titulo, subtitulo: s.resumen }));
  cont.append(aviso("info", h("b", null, `Esta sección llega en la Fase ${s.fase}.`), " Aún no está implementada: nada de lo que ves aquí guarda datos todavía."));
  cont.append(h("div", { class: "dos-col" },
    panel("Qué hará", h("ul", { style: { margin: 0, paddingLeft: "18px", lineHeight: "1.7" } }, s.hara.map((x) => h("li", null, x)))),
    panel("Mientras tanto", [h("ul", { style: { margin: "0 0 12px", paddingLeft: "18px", lineHeight: "1.7" } }, s.mientras.map((x) => h("li", null, x))), boton("Ir al inicio", { href: "#/inicio" })])));
}
