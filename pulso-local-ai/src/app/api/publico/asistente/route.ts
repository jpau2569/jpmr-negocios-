import { clienteAdmin } from "@/lib/supabase/servidor";
import { manejarFormulario, ok } from "@/lib/api";
import { negocioParaCaptacion } from "@/lib/captacion";
import { registrarEvento } from "@/lib/analitica";
import { esquemaPreguntaAsistente } from "@/lib/validaciones/formularios";
import { MENSAJE_DERIVACION, buscarRespuesta, requiereProfesional } from "@/lib/asistente";

export const runtime = "nodejs";

/**
 * Asistente «24/7».
 *
 * Hoy responde por coincidencia de palabras contra la base de conocimiento
 * aprobada y las FAQs publicadas. Es deliberado: un asistente que solo puede
 * repetir lo aprobado nunca inventará disponibilidad ni dará asesoramiento
 * fiscal. Cuando se conecte un LLM con RAG, el contrato de esta ruta no cambia
 * y `requiereProfesional()` seguirá siendo la última palabra.
 */
export async function POST(peticion: Request) {
  return manejarFormulario(
    peticion,
    esquemaPreguntaAsistente,
    { ambito: "asistente", limite: 20, ventanaSegundos: 600 },
    async (datos) => {
      const negocio = await negocioParaCaptacion(datos.businessSlug);
      const supabase = clienteAdmin();

      const [{ data: entradas }, { data: faqs }] = await Promise.all([
        supabase
          .from("ai_knowledge_entries")
          .select("id, title, body, keywords")
          .eq("business_id", negocio.id)
          .eq("is_approved", true),
        supabase
          .from("faqs")
          .select("id, question, answer")
          .eq("business_id", negocio.id)
          .eq("is_published", true),
      ]);

      const derivar = requiereProfesional(datos.pregunta);
      const respuesta = derivar
        ? null
        : buscarRespuesta(datos.pregunta, {
            entradas: (entradas as { id: string; title: string; body: string; keywords: string[] }[]) ?? [],
            faqs: (faqs as { id: string; question: string; answer: string }[]) ?? [],
          });

      // Registro mínimo, sin datos de contacto: solo sirve para saber qué se
      // pregunta y qué falta en las FAQs.
      await supabase.from("ai_chat_logs").insert({
        business_id: negocio.id,
        session_id: datos.sessionId ?? null,
        question: datos.pregunta.slice(0, 300),
        matched_entry_id: respuesta?.origen === "conocimiento" ? respuesta.id : null,
        matched_faq_id: respuesta?.origen === "faq" ? respuesta.id : null,
        was_deferred: !respuesta,
      });

      await registrarEvento({
        businessId: negocio.id,
        tipo: "ai_question_submit",
        sessionId: datos.sessionId ?? null,
        metadata: { derivado: !respuesta },
      });

      return ok({
        respuesta: respuesta?.texto ?? MENSAJE_DERIVACION(negocio.name),
        derivado: !respuesta,
        fuente: respuesta?.origen ?? null,
      });
    },
  );
}
