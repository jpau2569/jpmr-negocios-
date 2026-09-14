// ============================================================================
//  Mensajes de WhatsApp contextuales
// ----------------------------------------------------------------------------
//  Un botón de WhatsApp que abre el chat vacío obliga al cliente a escribir, y
//  la mitad no escribe. Aquí el mensaje va redactado según DESDE DÓNDE se
//  pulsa: no es lo mismo preguntar por un plato que pedir mesa para doce.
//
//  Regla: si el negocio no ha dado número, la función devuelve null y el botón
//  NO SE PINTA. Nunca se inventa un número ni se cae a otro.
// ============================================================================

import { whatsappLimpio } from "./schemas/formularios";

export type ContextoWhatsapp =
  | { tipo: "general" }
  | { tipo: "reserva" }
  | { tipo: "menu_dia" }
  | { tipo: "plato"; plato: string }
  | { tipo: "grupo" }
  | { tipo: "evento"; evento: string };

export function mensajeWhatsapp(negocio: string, contexto: ContextoWhatsapp): string {
  switch (contexto.tipo) {
    case "reserva":
      return `Hola, me gustaría solicitar una reserva en ${negocio}.`;
    case "menu_dia":
      return `Hola, he visto el menú del día mediante vuestro QR y quiero consultar disponibilidad.`;
    case "plato":
      return `Hola, he visto ${contexto.plato} y me gustaría hacer una consulta.`;
    case "grupo":
      return `Hola, quiero consultar una celebración o reserva de grupo.`;
    case "evento":
      return `Hola, quiero información sobre ${contexto.evento}.`;
    default:
      return `Hola, os escribo desde la web de ${negocio}.`;
  }
}

/**
 * Enlace a WhatsApp, o null si el negocio no tiene número configurado.
 * Devolver null es importante: el componente que llame debe no pintar nada,
 * no pintar un botón roto.
 */
export function enlaceWhatsapp(
  numero: string | null | undefined,
  negocio: string,
  contexto: ContextoWhatsapp = { tipo: "general" },
): string | null {
  const limpio = whatsappLimpio(numero);
  if (limpio.length < 9) return null;
  return `https://wa.me/${limpio}?text=${encodeURIComponent(mensajeWhatsapp(negocio, contexto))}`;
}

/** Enlace para llamar, o null si no hay teléfono. */
export function enlaceTelefono(numero: string | null | undefined): string | null {
  const limpio = String(numero ?? "").replace(/[^\d+]/g, "");
  return limpio.length >= 9 ? `tel:${limpio}` : null;
}

/** Cómo llegar: por coordenadas si las hay, si no por la dirección escrita. */
export function enlaceMapa(
  direccion: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
): string | null {
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const texto = String(direccion ?? "").trim();
  if (!texto) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}
