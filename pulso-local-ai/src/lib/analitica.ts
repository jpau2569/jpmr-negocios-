import "server-only";

import { clienteAdmin } from "@/lib/supabase/servidor";
import type { TipoEvento } from "@/types/dominio";

/**
 * Registro de eventos analíticos.
 *
 * Tres reglas que no se negocian:
 *   · `session_id` es un identificador aleatorio del navegador, no una persona.
 *   · `metadata` nunca lleva nombre, teléfono, email ni texto escrito por el
 *     usuario. Si hace falta saber «qué escribió», eso vive en el lead, con su
 *     consentimiento, no en la analítica.
 *   · Se escribe siempre desde el servidor con service role: el navegador no
 *     tiene permiso de INSERT, así que nadie puede inflar métricas desde fuera.
 */

const CLAVES_PROHIBIDAS = ["name", "nombre", "phone", "telefono", "email", "correo", "message", "mensaje", "comment"];

export function limpiarMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(metadata)) {
    if (CLAVES_PROHIBIDAS.some((prohibida) => clave.toLowerCase().includes(prohibida))) continue;
    if (typeof valor === "string" && valor.length > 80) continue;
    salida[clave] = valor;
  }
  return salida;
}

export interface EventoAnalitico {
  businessId: string;
  tipo: TipoEvento;
  qrId?: string | null;
  propertyId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  deviceKind?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  metadata?: Record<string, unknown>;
}

export async function registrarEvento(evento: EventoAnalitico): Promise<void> {
  try {
    const supabase = clienteAdmin();
    await supabase.from("analytics_events").insert({
      business_id: evento.businessId,
      qr_id: evento.qrId ?? null,
      property_id: evento.propertyId ?? null,
      session_id: evento.sessionId ?? null,
      event_type: evento.tipo,
      path: evento.path ?? null,
      device_kind: evento.deviceKind ?? null,
      utm_source: evento.utm?.source ?? null,
      utm_medium: evento.utm?.medium ?? null,
      utm_campaign: evento.utm?.campaign ?? null,
      metadata: limpiarMetadata(evento.metadata),
    });
  } catch {
    // La analítica nunca debe tumbar una página pública ni impedir que se
    // registre un lead. Si falla, se pierde el evento y ya está.
  }
}

export function tipoDispositivo(userAgent: string | null): "movil" | "tablet" | "escritorio" {
  if (!userAgent) return "escritorio";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "movil";
  return "escritorio";
}
