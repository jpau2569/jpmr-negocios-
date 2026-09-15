import { clienteAdmin } from "@/lib/supabase/servidor";
import { manejarFormulario, ok } from "@/lib/api";
import { crearLead, deducirFuente, negocioParaCaptacion } from "@/lib/captacion";
import { esquemaValoracion } from "@/lib/validaciones/formularios";

export const runtime = "nodejs";

/**
 * Solicitud de valoración.
 *
 * No se calcula ninguna valoración automática: se guarda la solicitud y la
 * revisa una persona. Dar un número inventado a quien va a tomar una decisión
 * de cien mil euros sería el peor favor posible.
 */
export async function POST(peticion: Request) {
  return manejarFormulario(peticion, esquemaValoracion, { ambito: "valoracion", limite: 5 }, async (datos) => {
    const negocio = await negocioParaCaptacion(datos.businessSlug);

    const { leadId } = await crearLead({
      negocio,
      tipo: "valuation_request",
      fuente: deducirFuente(datos.contexto?.qrCode),
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      mensaje: datos.mensaje,
      horarioPreferido: datos.horarioPreferido,
      qrCode: datos.contexto?.qrCode,
      sessionId: datos.contexto?.sessionId,
      path: datos.contexto?.path,
      metadata: {
        tipo_inmueble: datos.tipoInmueble,
        objetivo: datos.objetivo,
        municipio: datos.municipio,
        metros: datos.metros ?? null,
      },
      peticion,
      eventoAnalitico: "valuation_submit",
    });

    await clienteAdmin().from("valuation_requests").insert({
      business_id: negocio.id,
      lead_id: leadId,
      property_type: datos.tipoInmueble,
      goal: datos.objetivo,
      municipality: datos.municipio,
      neighborhood: datos.zona ?? null,
      built_area_m2: datos.metros ?? null,
      bedrooms: datos.habitaciones ?? null,
      bathrooms: datos.banos ?? null,
      condition_level: datos.estado ?? null,
      has_elevator: datos.ascensor ?? null,
      has_terrace: datos.terraza ?? null,
      has_garage: datos.garaje ?? null,
      needs_reform: datos.reforma ?? null,
      notes: datos.mensaje ?? null,
    });

    return ok({
      leadId,
      mensaje: `Hemos recibido tu solicitud. Un profesional de ${negocio.name} revisará los datos y contactará contigo.`,
    });
  });
}
