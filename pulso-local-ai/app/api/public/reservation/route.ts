import { admin } from "@/lib/supabase/servidor";
import { manejar, bien, idDeQr, registrarConsentimiento, referencia } from "@/lib/api";
import { esquemaReserva, telefonoLimpio } from "@/lib/schemas/formularios";
import { TEXTO_RGPD_RESERVA } from "@/components/publico/formulario-reserva";

// La reserva nace SIEMPRE en 'pending'. La web no confirma mesas.
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejar(peticion, esquemaReserva, "reserva", async ({ datos, negocio, peticion: p, ip }) => {
    const id = referencia("RES");
    const qrId = await idDeQr(negocio.id, datos.qr);

    const { data, error: fallo } = await admin()
      .from("reservations")
      .insert({
        business_id: negocio.id,
        name: datos.name,
        phone: telefonoLimpio(datos.phone),
        email: datos.email || null,
        service_date: datos.service_date,
        service_time: datos.service_time,
        party_size: datos.party_size,
        occasion: datos.occasion,
        comments: datos.comments || null,
        allergies_note: datos.allergies_note || null,
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
      tipo: "reservation",
      sujetoId: data.id,
      texto: TEXTO_RGPD_RESERVA,
      version: "v1",
      ip,
      userAgent: p.headers.get("user-agent"),
    });

    return bien({ id });
  });
}
