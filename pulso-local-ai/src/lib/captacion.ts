import "server-only";

import { createHash } from "node:crypto";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { entornoServidor } from "@/lib/entorno";
import { registrarEvento, tipoDispositivo } from "@/lib/analitica";
import { sanear } from "@/lib/validaciones/comunes";
import type { FuenteLead, TipoEvento, TipoLead } from "@/types/dominio";

/**
 * Alta de contactos desde los formularios públicos.
 *
 * Este módulo es el único sitio del proyecto donde se escribe un lead, y hace
 * siempre la misma secuencia:
 *
 *   1. Comprobar que el negocio existe y está activo (o en demo no caducada).
 *      Un negocio con la demo vencida no capta: deja de recibir datos ese mismo
 *      segundo, sin esperar a ningún cron.
 *   2. Guardar el lead.
 *   3. Guardar el consentimiento con su versión de texto legal, la fecha, la URL
 *      de origen y un hash con sal de la IP (nunca la IP).
 *   4. Registrar el evento analítico, sin datos personales.
 *
 * Si el paso 1 falla, no se llega al 2.
 */

export interface NegocioCaptador {
  id: string;
  name: string;
  slug: string;
  status: string;
  whatsapp_phone: string | null;
  trial_ends_at: string | null;
}

export class ErrorCaptacion extends Error {
  constructor(
    message: string,
    readonly codigo: "negocio_no_encontrado" | "negocio_inactivo" | "error_interno",
    readonly estado = 400,
  ) {
    super(message);
  }
}

/** Busca el negocio y verifica en servidor que puede seguir captando. */
export async function negocioParaCaptacion(slug: string): Promise<NegocioCaptador> {
  const supabase = clienteAdmin();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug, status, whatsapp_phone, trial_ends_at")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new ErrorCaptacion("No se ha podido comprobar el negocio", "error_interno", 500);
  if (!data) throw new ErrorCaptacion("Negocio no encontrado", "negocio_no_encontrado", 404);

  const negocio = data as NegocioCaptador;
  const activo =
    negocio.status === "active" ||
    (negocio.status === "trial" && negocio.trial_ends_at !== null && new Date(negocio.trial_ends_at) > new Date());

  if (!activo) {
    throw new ErrorCaptacion("Este espacio no está activo en este momento", "negocio_inactivo", 410);
  }
  return negocio;
}

/** Versión vigente del texto de consentimiento de ese negocio. */
async function versionLegalVigente(businessId: string): Promise<{ id: string | null; version: string }> {
  const supabase = clienteAdmin();
  const { data } = await supabase
    .from("legal_text_versions")
    .select("id, version")
    .eq("business_id", businessId)
    .eq("kind", "consentimiento_lead")
    .eq("is_current", true)
    .maybeSingle();
  const fila = data as { id: string; version: string } | null;
  return { id: fila?.id ?? null, version: fila?.version ?? "v1" };
}

function hashConSal(valor: string): string {
  const { salConsentimiento } = entornoServidor();
  return createHash("sha256").update(`${salConsentimiento}:${valor}`).digest("hex").slice(0, 40);
}

/** Resuelve un código de QR a su id, para atribuir el lead al cartel correcto. */
export async function qrPorCodigo(businessId: string, code: string | undefined | null): Promise<string | null> {
  if (!code) return null;
  const supabase = clienteAdmin();
  const { data } = await supabase
    .from("qr_codes")
    .select("id")
    .eq("business_id", businessId)
    .eq("code", code)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export interface EntradaLead {
  negocio: NegocioCaptador;
  tipo: TipoLead;
  fuente: FuenteLead;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  mensaje?: string | null;
  horarioPreferido?: string | null;
  propertyId?: string | null;
  serviceId?: string | null;
  qrCode?: string | null;
  sessionId?: string | null;
  path?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  metadata?: Record<string, unknown>;
  peticion: Request;
  eventoAnalitico?: TipoEvento;
}

export interface ResultadoLead {
  leadId: string;
  qrId: string | null;
  duplicado: boolean;
}

export async function crearLead(entrada: EntradaLead): Promise<ResultadoLead> {
  const supabase = clienteAdmin();
  const { negocio } = entrada;
  const qrId = await qrPorCodigo(negocio.id, entrada.qrCode);
  const legal = await versionLegalVigente(negocio.id);

  const telefono = sanear(entrada.telefono ?? null);
  const email = sanear(entrada.email ?? null)?.toLowerCase() ?? null;

  // Antiduplicados: el mismo teléfono, mismo negocio y mismo tipo en los últimos
  // diez minutos es casi siempre un doble toque en el botón, no dos personas.
  if (telefono) {
    const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: previo } = await supabase
      .from("leads")
      .select("id")
      .eq("business_id", negocio.id)
      .eq("phone", telefono)
      .eq("lead_type", entrada.tipo)
      .gte("created_at", desde)
      .maybeSingle();
    if (previo) {
      return { leadId: (previo as { id: string }).id, qrId, duplicado: true };
    }
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      business_id: negocio.id,
      property_id: entrada.propertyId ?? null,
      service_id: entrada.serviceId ?? null,
      lead_type: entrada.tipo,
      source: entrada.fuente,
      qr_id: qrId,
      name: sanear(entrada.nombre) ?? "Sin nombre",
      phone: telefono,
      email,
      message: sanear(entrada.mensaje ?? null),
      preferred_contact_time: sanear(entrada.horarioPreferido ?? null),
      consented_at: new Date().toISOString(),
      legal_text_version: legal.version,
      metadata: entrada.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) throw new ErrorCaptacion("No se ha podido guardar la solicitud", "error_interno", 500);
  const leadId = (data as { id: string }).id;

  const ip = entrada.peticion.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  await supabase.from("consent_records").insert({
    business_id: negocio.id,
    lead_id: leadId,
    kind: "consentimiento_lead",
    legal_text_version: legal.version,
    legal_text_id: legal.id,
    source_url: entrada.path ?? null,
    ip_hash: hashConSal(ip),
    user_agent_hash: hashConSal(entrada.peticion.headers.get("user-agent") ?? "desconocido"),
  });

  await registrarEvento({
    businessId: negocio.id,
    tipo: entrada.eventoAnalitico ?? "lead_submit",
    qrId,
    propertyId: entrada.propertyId ?? null,
    sessionId: entrada.sessionId ?? null,
    path: entrada.path ?? null,
    deviceKind: tipoDispositivo(entrada.peticion.headers.get("user-agent")),
    utm: entrada.utm,
    metadata: { lead_type: entrada.tipo, fuente: entrada.fuente },
  });

  return { leadId, qrId, duplicado: false };
}

/** Fuente del lead a partir del contexto: si vino de un QR, se anota como tal. */
export function deducirFuente(qrCode: string | undefined | null, propertyId?: string | null): FuenteLead {
  if (qrCode) return "qr";
  if (propertyId) return "inmueble";
  return "web";
}
