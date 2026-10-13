// ============================================================================
//  Enlaces de WhatsApp y teléfono para el panel — lógica pura
// ----------------------------------------------------------------------------
//  El panel NO envía nada: prepara un enlace wa.me con el texto ya escrito y
//  es Pau quien lo abre y pulsa «enviar» si quiere. Solo para móviles (6/7):
//  un fijo no tiene WhatsApp, y para eso está el enlace tel:.
// ============================================================================
import { esMovil } from "./validacion.js";
import { TIPOS, textoDe } from "./validacion.js";
import { etiquetaLarga } from "./horario.js";

const nombrePila = (nombre) => String(nombre || "").trim().split(/\s+/)[0] || "";

export function textoWhatsappValoracion(v) {
  const tipo = textoDe(TIPOS, v.tipo).toLowerCase();
  return `Hola ${nombrePila(v.nombre)}, soy Pau, de Asesoría Castresana. He recibido tu solicitud para valorar tu ${tipo} en ${v.zona}. ¿Cuándo te viene bien que te llame?`;
}

export function textoWhatsappVisita(v) {
  const [fecha, hora] = String(v.fecha_hora || v.fechaHora || "").split("T");
  return `Hola ${nombrePila(v.nombre)}, soy Pau, de Asesoría Castresana. Te confirmo la visita al inmueble ${v.referencia} el ${etiquetaLarga(fecha)} a las ${hora}. Si te surge cualquier cambio, escríbeme por aquí.`;
}

/** https://wa.me/34XXXXXXXXX?text=… o '' si no es un móvil español. */
export function enlaceWhatsapp(telefono, texto) {
  if (!esMovil(telefono)) return "";
  return `https://wa.me/34${telefono}?text=${encodeURIComponent(texto)}`;
}

export const enlaceTelefono = (telefono) => (/^\d{9}$/.test(String(telefono || "")) ? `tel:+34${telefono}` : "");
