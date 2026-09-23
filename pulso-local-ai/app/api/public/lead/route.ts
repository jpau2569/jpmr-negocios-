import { admin } from "@/lib/supabase/servidor";
import { manejar, bien, idDeQr, registrarConsentimiento } from "@/lib/api";
import { esquemaLead, telefonoLimpio } from "@/lib/schemas/formularios";
import { TEXTO_CONSENTIMIENTO } from "@/components/publico/fidelizacion";

// Sin consentimiento no se crea la fila: lo garantiza el esquema Zod, que
// exige literal(true), y la columna consent_version, que es NOT NULL.
// En el MVP no se envía ningún mensaje automático: solo se captan segmentos.
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejar(peticion, esquemaLead, "lead", async ({ datos, negocio, peticion: p, ip }) => {
    const qrId = await idDeQr(negocio.id, datos.qr);

    const { data, error: fallo } = await admin()
      .from("leads")
      .insert({
        business_id: negocio.id,
        name: datos.name || null,
        phone: datos.phone ? telefonoLimpio(datos.phone) : null,
        email: datos.email || null,
        channel: datos.channel,
        interests: datos.interests,
        consent_version: "v1",
        qr_code_id: qrId,
        utm: datos.utm ?? {},
      })
      .select("id")
      .single();

    if (fallo) throw fallo;

    await registrarConsentimiento({
      businessId: negocio.id,
      tipo: "lead",
      sujetoId: data.id,
      texto: TEXTO_CONSENTIMIENTO,
      version: "v1",
      ip,
      userAgent: p.headers.get("user-agent"),
    });

    return bien({ id: data.id });
  });
}
