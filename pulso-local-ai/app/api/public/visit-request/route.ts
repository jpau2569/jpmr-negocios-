import { admin } from "@/lib/supabase/servidor";
import { manejar, bien, idDeQr, registrarConsentimiento, referencia } from "@/lib/api";
import { esquemaVisita, telefonoLimpio } from "@/lib/schemas/formularios";
import { TEXTO_RGPD_VISITA } from "@/components/publico/formulario-visita";

// ============================================================================
//  Petición de visita — /api/public/visit-request
// ----------------------------------------------------------------------------
//  Nace SIEMPRE en 'pending'. La web no cierra visitas: la agencia tiene que
//  cuadrarlas con la propiedad antes de prometer una hora.
//
//  La referencia del inmueble se resuelve CONTRA LA BASE y filtrando por
//  business_id. Si alguien manda una referencia de otra agencia, no se ata a
//  nada: se guarda como texto y ya. Aquí se escribe con service_role, que
//  salta RLS, así que el filtro por negocio es responsabilidad de este código.
// ============================================================================

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejar(peticion, esquemaVisita, "visita", async ({ datos, negocio, peticion: p, ip }) => {
    const id = referencia("VIS");
    const qrId = await idDeQr(negocio.id, datos.qr);

    // Buscar el inmueble por su referencia comercial, SOLO dentro de este
    // negocio. Si no aparece, la petición vale igual: el contacto es el
    // contacto, y perderlo por una referencia mal escrita sería absurdo.
    let propertyId: string | null = null;
    if (datos.property_ref) {
      const { data: encontrado } = await admin()
        .from("properties")
        .select("id")
        .eq("business_id", negocio.id)
        .eq("reference", datos.property_ref)
        .maybeSingle();
      propertyId = encontrado?.id ?? null;
    }

    const financiacion = datos.needs_financing;
    const { data, error: fallo } = await admin()
      .from("visit_requests")
      .insert({
        business_id: negocio.id,
        property_id: propertyId,
        property_ref: datos.property_ref || null,
        name: datos.name,
        phone: telefonoLimpio(datos.phone),
        email: datos.email || null,
        preferred_date: datos.preferred_date || null,
        preferred_slot: datos.preferred_slot,
        // "no lo sé" no es ni sí ni no: se guarda como desconocido, no como
        // "no". Meterlo en el cajón equivocado ensucia el seguimiento.
        needs_financing:
          financiacion === "si" ? true : financiacion === "no" ? false : null,
        comments: datos.comments || null,
        status: "pending",
        consent_version: "v1",
        qr_code_id: qrId,
        utm: datos.utm ?? {},
      })
      .select("id")
      .single();

    if (fallo) throw fallo;

    await registrarConsentimiento({
      businessId: negocio.id,
      tipo: "visit_request",
      sujetoId: data.id,
      texto: TEXTO_RGPD_VISITA,
      version: "v1",
      ip,
      userAgent: p.headers.get("user-agent"),
    });

    return bien({ id });
  });
}
