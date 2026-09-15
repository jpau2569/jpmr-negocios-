import { clienteAdmin } from "@/lib/supabase/servidor";
import { manejarFormulario, ok } from "@/lib/api";
import { crearLead, deducirFuente, negocioParaCaptacion } from "@/lib/captacion";
import { esquemaVisita } from "@/lib/validaciones/formularios";

export const runtime = "nodejs";

/**
 * Solicitud de visita. Crea el lead y además la fila de `visit_requests`, que es
 * la que el equipo gestiona en la agenda. No se crea ningún evento de calendario
 * externo: eso exige autorización explícita del administrador.
 */
export async function POST(peticion: Request) {
  return manejarFormulario(peticion, esquemaVisita, { ambito: "visita", limite: 6 }, async (datos) => {
    const negocio = await negocioParaCaptacion(datos.businessSlug);

    const { leadId } = await crearLead({
      negocio,
      tipo: "buyer",
      fuente: deducirFuente(datos.contexto?.qrCode, datos.propertyId),
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      mensaje: datos.mensaje,
      horarioPreferido: datos.franja,
      propertyId: datos.propertyId,
      qrCode: datos.contexto?.qrCode,
      sessionId: datos.contexto?.sessionId,
      path: datos.contexto?.path,
      peticion,
      eventoAnalitico: "visit_request_submit",
    });

    await clienteAdmin().from("visit_requests").insert({
      business_id: negocio.id,
      property_id: datos.propertyId ?? null,
      lead_id: leadId,
      mode: datos.modo,
      preferred_date: datos.fechaPreferida ?? null,
      preferred_slot: datos.franja ?? null,
    });

    return ok({
      leadId,
      mensaje: "Hemos recibido tu solicitud de visita. Te confirmamos la cita en cuanto la revisemos.",
    });
  });
}
