import { clienteAdmin } from "@/lib/supabase/servidor";
import { manejarFormulario, ok } from "@/lib/api";
import { negocioParaCaptacion } from "@/lib/captacion";
import { registrarEvento, tipoDispositivo } from "@/lib/analitica";
import { sanear } from "@/lib/validaciones/comunes";
import { esquemaOpinion } from "@/lib/validaciones/formularios";

export const runtime = "nodejs";

/**
 * Opinión privada tras una visita o una gestión.
 *
 * Lo que NO hace este endpoint, y no es un olvido:
 *   · No decide quién ve el enlace de Google en función de la nota. El enlace se
 *     ofrece siempre, con un 1 y con un 5.
 *   · No ofrece nada a cambio de una reseña.
 *   · No guarda datos de contacto si la persona no ha pedido que la llamen.
 */
export async function POST(peticion: Request) {
  return manejarFormulario(peticion, esquemaOpinion, { ambito: "opinion", limite: 8 }, async (datos) => {
    const negocio = await negocioParaCaptacion(datos.businessSlug);
    const quiereContacto = datos.quiereContacto === true;

    const { data, error: errorInsercion } = await clienteAdmin()
      .from("feedback")
      .insert({
        business_id: negocio.id,
        property_id: datos.propertyId ?? null,
        rating: datos.puntuacion,
        comment: sanear(datos.comentario ?? null),
        wants_contact: quiereContacto,
        contact_name: quiereContacto ? sanear(datos.nombre ?? null) : null,
        contact_phone: quiereContacto ? sanear(datos.telefono ?? null) : null,
        contact_email: quiereContacto ? sanear(datos.email ?? null)?.toLowerCase() ?? null : null,
        consented_at: quiereContacto ? new Date().toISOString() : null,
        legal_text_version: quiereContacto ? "v1" : null,
      })
      .select("id")
      .single();

    if (errorInsercion) throw errorInsercion;

    await registrarEvento({
      businessId: negocio.id,
      tipo: "feedback_submit",
      sessionId: datos.contexto?.sessionId ?? null,
      propertyId: datos.propertyId ?? null,
      path: datos.contexto?.path ?? null,
      deviceKind: tipoDispositivo(peticion.headers.get("user-agent")),
      metadata: { puntuacion: datos.puntuacion, quiere_contacto: quiereContacto },
    });

    return ok({
      feedbackId: (data as { id: string }).id,
      mensaje: quiereContacto
        ? "Gracias. Hemos anotado tu comentario y el equipo se pondrá en contacto contigo."
        : "Gracias por contárnoslo. Nos ayuda a mejorar.",
    });
  });
}
