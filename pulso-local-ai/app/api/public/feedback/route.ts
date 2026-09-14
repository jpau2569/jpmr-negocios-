import { admin } from "@/lib/supabase/servidor";
import { manejar, bien, idDeQr } from "@/lib/api";
import { esquemaFeedback, telefonoLimpio } from "@/lib/schemas/formularios";

// Nota: aquí NO se decide nada en función de la puntuación. El feedback se
// guarda igual con un 1 que con un 5, y el botón de Google lo enseña el
// cliente en los dos casos. Filtrar reseñas por nota incumple las políticas
// de Google y puede costarle al negocio su ficha entera.
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejar(peticion, esquemaFeedback, "feedback", async ({ datos, negocio }) => {
    const qrId = await idDeQr(negocio.id, datos.qr);

    const { error: fallo } = await admin().from("feedback").insert({
      business_id: negocio.id,
      rating: datos.rating,
      comment: datos.comment || null,
      wants_contact: datos.wants_contact,
      contact_name: datos.wants_contact ? datos.contact_name || null : null,
      contact_phone: datos.wants_contact && datos.contact_phone
        ? telefonoLimpio(datos.contact_phone)
        : null,
      qr_code_id: qrId,
    });

    if (fallo) throw fallo;
    return bien();
  });
}
