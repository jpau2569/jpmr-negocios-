import { admin } from "@/lib/supabase/servidor";
import { manejar, bien, idDeQr, registrarConsentimiento, referencia } from "@/lib/api";
import { esquemaGrupo, telefonoLimpio } from "@/lib/schemas/formularios";
import { TEXTO_RGPD_GRUPO } from "@/components/publico/formulario-grupo";

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejar(peticion, esquemaGrupo, "grupo", async ({ datos, negocio, peticion: p, ip }) => {
    const id = referencia("GRP");
    const qrId = await idDeQr(negocio.id, datos.qr);

    const { data, error: fallo } = await admin()
      .from("group_requests")
      .insert({
        business_id: negocio.id,
        name: datos.name,
        phone: telefonoLimpio(datos.phone),
        email: datos.email || null,
        service_date: datos.service_date || null,
        party_size: datos.party_size ?? null,
        celebration: datos.celebration || null,
        budget_hint: datos.budget_hint || null,
        needs_menu: datos.needs_menu,
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
      tipo: "group_request",
      sujetoId: data.id,
      texto: TEXTO_RGPD_GRUPO,
      version: "v1",
      ip,
      userAgent: p.headers.get("user-agent"),
    });

    return bien({ id });
  });
}
