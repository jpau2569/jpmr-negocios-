// ============================================================================
//  Datos de DEMOSTRACIÓN. Todo es ficticio: nombres inventados, teléfonos
//  600 000 1xx, correos @example.com y enlaces a example.com. Se crean
//  usando los propios servicios (no SQL a mano), así cumplen las mismas reglas
//  que los datos reales y, de paso, prueban el recorrido completo.
//  Las fechas son relativas a «hoy» para que la agenda siempre tenga sentido.
// ============================================================================
import * as contactos from "./contactos.mjs";
import * as oportunidades from "./oportunidades.mjs";
import * as inmuebles from "./inmuebles.mjs";
import * as demandas from "./demandas.mjs";
import * as tareas from "./tareas.mjs";
import * as actividades from "./actividades.mjs";
import { guardarConfig } from "./config.mjs";
import { hoy, sumaDias, horaAhora } from "./util.mjs";

export function sembrarDemo(ctx) {
  const h = hoy(ctx.reloj);
  const d = (n) => sumaDias(h, n);
  const bd = ctx.bd;
  bd.ejecutar("INSERT INTO configuracion (clave, valor) VALUES ('demo', 'true')");
  guardarConfig(ctx, "usuario", { nombre: "Demo" });
  guardarConfig(ctx, "inmobiliaria", { nombre: "Inmobiliaria de demostración" });
  ctx._cfg = null;

  const c = (o) => contactos.crear(ctx, o, { confirmar_duplicado: true });
  const elena = c({ nombre: "Elena", apellidos: "Marqués Ríos", telefono: "600 000 101", email: "elena.demo@example.com", procedencia: "formulario_web", canal_preferido: "email", es_propietario: true, motivo_venta: "Quiere mudarse a una vivienda más pequeña (lo dijo ella)." });
  const roberto = c({ nombre: "Roberto", apellidos: "Alonso Vega", telefono: "600 000 102", procedencia: "anuncio_particular", es_propietario: true });
  const carmen = c({ nombre: "Carmen", apellidos: "Iglesias Soto", telefono: "600 000 103", email: "carmen.demo@example.com", procedencia: "cliente_previo", es_propietario: true, es_comprador: true });
  const javier = c({ nombre: "Javier", apellidos: "Pando Cuesta", telefono: "600 000 104", procedencia: "propia_persona", es_comprador: true });
  const lucia = c({ nombre: "Lucía", apellidos: "Fernández Roces", telefono: "600 000 105", email: "lucia.demo@example.com", procedencia: "formulario_web", es_comprador: true });
  const marcos = c({ nombre: "Marcos", apellidos: "Díaz Álvarez", telefono: "600 000 106", procedencia: "anuncio_particular", es_propietario: true });
  const inversor = c({ nombre: "Inversiones Cantábrico", empresa: "Inversiones Cantábrico S.L. (ficticia)", email: "info.demo@example.com", procedencia: "referido", es_comprador: true });

  contactos.guardarHabilitaciones(ctx, elena.id, [
    { canal: "email", estado: "habilitado", base: "consentimiento", evidencia: "Marcó la casilla de consentimiento en el formulario web (dato ficticio).", fecha_autorizacion: d(-12) },
    { canal: "telefono", estado: "habilitado", base: "solicitud_interesado", evidencia: "Pidió que la llamaran en el formulario (dato ficticio).", fecha_autorizacion: d(-12) },
  ]);
  contactos.guardarHabilitaciones(ctx, lucia.id, [{ canal: "whatsapp", estado: "habilitado", base: "solicitud_interesado", evidencia: "Escribió ella primero por WhatsApp (dato ficticio).", fecha_autorizacion: d(-3) }]);

  const op = (o) => oportunidades.crear(ctx, o, { confirmar_duplicado: true });
  const entrante = { verificacion_contacto: "permitido", verificacion_evidencia: "La propia persona contactó con nosotros (dato ficticio)." };
  op({ fuente: "Idealista", enlace: "https://www.example.com/anuncio/demo-001", fecha_deteccion: d(-1), tipo_inmueble: "Piso", municipio: "Gijón", zona: "Centro", titulo: "Piso reformado cerca del Muro", precio_anunciado: 245000, superficie_m2: 92, habitaciones: 3, banos: 2, clasificacion_anunciante: "particular", evidencia_clasificacion: "El anuncio dice «vendo directamente» (ficticio).", proxima_accion: "Revisar el anuncio", proxima_accion_fecha: d(0) });
  op({ fuente: "Fotocasa", enlace: "https://www.example.com/anuncio/demo-002", fecha_deteccion: d(-4), tipo_inmueble: "Casa", municipio: "Siero", zona: "Pola de Siero", precio_anunciado: 189000, superficie_m2: 140, habitaciones: 4, banos: 2 });
  op({ fuente: "Idealista", enlace: "https://www.example.com/anuncio/demo-003", fecha_deteccion: d(-6), tipo_inmueble: "Piso", municipio: "Avilés", precio_anunciado: 128000, superficie_m2: 78, habitaciones: 2, banos: 1, clasificacion_anunciante: "profesional", evidencia_clasificacion: "Aparece el logotipo de una agencia (ficticio)." });
  const op4 = op({ fuente: "Llamada entrante", fecha_deteccion: d(-9), tipo_inmueble: "Piso", municipio: "Oviedo", zona: "Vallobín", titulo: "Piso para reformar", precio_anunciado: 99000, superficie_m2: 70, habitaciones: 3, banos: 1, contacto_id: roberto.id, ...entrante });
  const op5 = op({ fuente: "Web propia", fecha_deteccion: d(-14), tipo_inmueble: "Piso", municipio: "Oviedo", zona: "Centro", titulo: "Piso céntrico con ascensor", precio_anunciado: 265000, superficie_m2: 105, habitaciones: 3, banos: 2, contacto_id: elena.id, ...entrante, verificacion_evidencia: "Rellenó el formulario de valoración de la web (ficticio)." });
  const op6 = op({ fuente: "Referido", fecha_deteccion: d(-20), tipo_inmueble: "Chalet", municipio: "Mieres", zona: "Santullano", precio_anunciado: 210000, superficie_m2: 160, habitaciones: 4, banos: 2, contacto_id: roberto.id, ...entrante });
  const op7 = op({ fuente: "Cartel o calle", fecha_deteccion: d(-26), tipo_inmueble: "Piso", municipio: "Langreo", zona: "Sama", precio_anunciado: 82000, superficie_m2: 68, habitaciones: 2, banos: 1, contacto_id: lucia.id, ...entrante });
  const op8 = op({ fuente: "Referido", fecha_deteccion: d(-40), tipo_inmueble: "Piso", municipio: "Gijón", zona: "La Arena", titulo: "Piso luminoso cerca de la playa", precio_anunciado: 295000, superficie_m2: 98, habitaciones: 3, banos: 2, caracteristicas: "Exterior, soleado (según el propietario).", contacto_id: carmen.id, ...entrante });
  const op9 = op({ fuente: "Milanuncios", fecha_deteccion: d(-30), tipo_inmueble: "Piso", municipio: "Mieres", precio_anunciado: 60000, clasificacion_anunciante: "profesional", evidencia_clasificacion: "Anunciante con varios inmuebles (ficticio)." });
  const op10 = op({ fuente: "Facebook Marketplace", fecha_deteccion: d(-18), tipo_inmueble: "Piso", municipio: "Oviedo", precio_anunciado: 150000, contacto_id: marcos.id, ...entrante });

  const estado = (id, e, cuerpo = {}) => oportunidades.cambiarEstado(ctx, id, { estado: e, ...cuerpo });
  estado(op4.id, "conversacion_iniciada");
  estado(op5.id, "conversacion_iniciada"); estado(op5.id, "propietario_interesado");
  estado(op6.id, "conversacion_iniciada"); estado(op6.id, "propietario_interesado"); estado(op6.id, "visita_valoracion_programada");
  estado(op7.id, "conversacion_iniciada"); estado(op7.id, "propietario_interesado"); estado(op7.id, "visita_valoracion_programada");
  estado(op7.id, "valoracion_realizada"); estado(op7.id, "propuesta_presentada");
  estado(op9.id, "descartada", { motivo: "Es una agencia o profesional" });
  estado(op10.id, "no_contactar", { motivo: "Pidió por teléfono que no volviéramos a llamarle (ficticio)." });

  // Encargo confirmado: crea el inmueble, vincula a Carmen y deja un aviso de vencimiento.
  const conf = oportunidades.confirmarEncargo(ctx, op8.id, {
    encargo: { tipo: "venta", exclusividad: true, fecha_encargo: d(-35), vigencia_hasta: d(21), honorarios_tipo: "porcentaje", honorarios_valor: 4, honorarios_notas: "Importe de ejemplo, sin valor real." },
    inmueble: { direccion_interna: "Calle Ficticia 1, 2º A (dato de demostración)", planta: "2", ascensor: true, estado_conservacion: "buen_estado" },
  });
  inmuebles.actualizarInmueble(ctx, conf.inmueble.id, { estado_comercial: "disponible", precio_actual: 289000, motivo_precio: "Ajuste tras la valoración" });

  const i2 = inmuebles.crear(ctx, { tipo: "Piso", municipio: "Oviedo", zona: "Ciudad Naranco", superficie_m2: 85, tipo_superficie: "util", habitaciones: 3, banos: 2, planta: "4", ascensor: true, garaje: true, terraza: false, estado_conservacion: "reformado", precio_actual: 215000, estado_comercial: "reservado", direccion_interna: "Calle Imaginaria 7 (demo)" });
  inmuebles.anadirPropietario(ctx, i2.id, { contacto_id: elena.id, porcentaje: 50 });
  inmuebles.anadirPropietario(ctx, i2.id, { contacto_id: carmen.id, porcentaje: 50 });
  const i3 = inmuebles.crear(ctx, { tipo: "Casa", municipio: "Llanes", zona: "Posada", superficie_m2: 180, tipo_superficie: "construida", habitaciones: 5, banos: 3, ascensor: false, garaje: true, terraza: true, estado_conservacion: "a_reformar", precio_actual: 310000, estado_comercial: "en_negociacion" });
  inmuebles.anadirPropietario(ctx, i3.id, { contacto_id: carmen.id });
  inmuebles.actualizarInmueble(ctx, i3.id, { precio_actual: 295000, motivo_precio: "Bajada pactada con la propiedad (ejemplo)" });
  inmuebles.crear(ctx, { tipo: "Parcela o terreno", municipio: "Villaviciosa", zona: "Rural", superficie_m2: 1200, tipo_superficie: "parcela", precio_actual: 45000, estado_comercial: "en_preparacion" });

  const dem = (o) => demandas.crear(ctx, o);
  dem({ contacto_id: javier.id, nombre: "Piso en Oviedo hasta 220.000", municipios: ["Oviedo"], zonas: "Centro, Ciudad Naranco", presupuesto_min: 150000, presupuesto_max: 220000, tipos: ["Piso"], superficie_min: 80, habitaciones_min: 3, ascensor: "imprescindible", garaje: "deseable", estados_aceptables: ["buen_estado", "reformado"], plazo_compra: "6_meses", financiacion: "hipoteca_manifestada", requisitos_imprescindibles: "Ascensor y exterior." });
  dem({ contacto_id: lucia.id, nombre: "Primera vivienda cuenca minera", municipios: ["Mieres", "Langreo"], presupuesto_max: 95000, tipos: ["Piso"], habitaciones_min: 2, plazo_compra: "3_meses", financiacion: "aprobada_acreditada", financiacion_evidencia: "Carta de preaprobación del banco (documento ficticio de ejemplo)." });
  dem({ contacto_id: carmen.id, nombre: "Casa con terraza en la costa", municipios: ["Llanes", "Ribadesella"], presupuesto_min: 200000, presupuesto_max: 350000, tipos: ["Casa", "Chalet"], terraza: "imprescindible", plazo_compra: "12_meses", financiacion: "contado_manifestado", estado: "pausada" });
  const demInv = dem({ contacto_id: inversor.id, nombre: "Inversión para alquilar", municipios: ["Gijón", "Avilés", "Oviedo"], presupuesto_max: 130000, tipos: ["Piso"], preferencias: "Pisos pequeños, cerca de universidad o hospital.", plazo_compra: "sin_prisa" });
  bd.ejecutar("UPDATE demandas SET actualizado_en = ? WHERE id = ?", [new Date(ctx.reloj.ahora().getTime() - 95 * 86400000).toISOString(), demInv.id]);

  const t = (o) => tareas.crear(ctx, o);
  t({ titulo: "Llamar a Roberto por el piso de Vallobín", tipo: "llamada", fecha: d(-1), hora: "11:00", prioridad: "alta", oportunidad_id: op4.id, contacto_id: roberto.id });
  t({ titulo: "Preparar la valoración del chalet de Mieres", tipo: "valoracion", fecha: h, hora: horaAhora(ctx.reloj) < "18:00" ? "18:00" : "23:30", prioridad: "media", oportunidad_id: op6.id, aviso_min: 30 });
  t({ titulo: "Enviar propuesta a Lucía", tipo: "email", fecha: d(1), hora: "10:00", oportunidad_id: op7.id, contacto_id: lucia.id });
  t({ titulo: "Revisar documentación del piso de La Arena", tipo: "documentacion", fecha: d(3), inmueble_id: conf.inmueble.id, prioridad: "baja" });
  t({ titulo: "Contactar con compradores para el piso de Ciudad Naranco", tipo: "seguimiento", fecha: d(5), inmueble_id: i2.id });
  t({ titulo: "Visita de valoración en Santullano", tipo: "visita", fecha: d(2), hora: "17:00", oportunidad_id: op6.id, contacto_id: roberto.id, prioridad: "alta", aviso_min: 60 });

  const a = (o) => actividades.crear(ctx, o);
  a({ tipo: "llamada", direccion: "entrante", fecha: d(-9), hora: "10:30", resumen: "Llamó él para vender su piso. Le interesa saber en cuánto se puede valorar (ficticio).", oportunidad_id: op4.id, contacto_id: roberto.id });
  a({ tipo: "email", direccion: "saliente", fecha: d(-13), hora: "09:15", resumen: "Se le envió información sobre el proceso de valoración (ficticio).", oportunidad_id: op5.id, contacto_id: elena.id });
  a({ tipo: "reunion", direccion: "saliente", fecha: d(-5), hora: "12:00", resumen: "Visita al inmueble y primera conversación sobre el precio (ficticio).", oportunidad_id: op7.id, contacto_id: lucia.id, resultado: "Le interesa una propuesta" });
  a({ tipo: "nota", direccion: "interna", fecha: d(-2), resumen: "Comprador interesado en pisos con ascensor; revisar cartera.", demanda_id: Number(bd.valor("SELECT id FROM demandas WHERE contacto_id = ? LIMIT 1", [javier.id])), contacto_id: javier.id });
  return true;
}
